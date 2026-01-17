// @ts-nocheck
/**
 * IMAP client wrapper for fetching emails
 * Uses imapflow for incremental email sync
 */

import { ImapFlow } from "imapflow";
import { getEmailConfig } from "@/lib/config/envLoader";
import { cleanEmailBodyText, extractTextFromHtml } from "./emailBodyCleaner";

export interface FetchedMessage {
  uid: string;
  headers: {
    from: string;
    to: string;
    cc?: string;
    subject: string;
    messageId?: string;
    inReplyTo?: string;
    date: Date;
  };
  bodyText?: string;
  bodyHtml?: string;
  attachments: Array<{
    filename: string;
    mimeType: string;
    buffer: Buffer;
  }>;
}

/**
 * Get a configured IMAP client instance
 */
export function getImapClient(): ImapFlow {
  const config = getEmailConfig();
  
  const host = config.imapServer;
  const user = config.imapUserEmail;
  const pass = config.imapUserPass;
  const port = config.imapPort;
  const tls = config.imapTls;

  console.log("IMAP Config:", {
    host,
    user,
    port,
    tls,
    hasPassword: !!pass,
    passwordLength: pass?.length || 0,
  });

  if (!host || !user) {
    throw new Error("IMAP configuration is missing. Please set IMAP_SERVER and IMAP_USER_EMAIL in your .env file.");
  }

  if (!pass) {
    throw new Error("IMAP password is missing. Please set IMAP_USER_PASS in your .env file.");
  }

  console.log(`Connecting to IMAP: ${user}@${host}:${port} (TLS: ${tls})`);

  // CRITICAL: Synology MailPlus Server requires 'mail.mrgroup.rs' as hostname for authentication
  // Even when connecting through proxy, we must use 'mail.mrgroup.rs' as the host
  // The proxy IP (139.59.139.89) is only for TCP connection, but hostname must be 'mail.mrgroup.rs'
  const isProxyConnection = host !== 'mail.mrgroup.rs' && (host.includes('139.59.139.89') || host.includes('localhost'));
  
  // For proxy connections, use 'mail.mrgroup.rs' as hostname (required for auth)
  // But connect to proxy IP for TCP connection
  const connectionHost = isProxyConnection ? host : host; // Keep proxy IP for TCP connection
  const authHostname = 'mail.mrgroup.rs'; // Always use mail.mrgroup.rs for authentication

  return new ImapFlow({
    host: connectionHost, // Use proxy IP for TCP connection
    port,
    secure: tls, // true for port 993 (direct TLS)
    auth: {
      user,
      pass: pass,
    },
    logger: true,
    // Add connection timeout for external servers
    timeout: 30000, // 30 seconds
    // Always use 'mail.mrgroup.rs' as servername for SNI (required for Synology auth)
    tls: tls ? {
      rejectUnauthorized: false, // Don't validate certificate (accept self-signed from HAProxy)
      servername: authHostname, // Use mail.mrgroup.rs for SNI (required for authentication)
      checkServerIdentity: () => undefined, // Skip hostname verification
    } : false,
  });
}

/**
 * Fetch new messages since the last UID
 * @param lastUid - Last processed UID (null for first sync)
 * @param limit - Maximum number of messages to fetch
 * @returns Array of fetched messages
 */
export async function fetchNewMessagesSince(
  lastUid: string | null,
  limit: number
): Promise<FetchedMessage[]> {
  const client = await getImapClient();
  let connected = false;

  try {
    await client.connect();
    connected = true;
    await client.mailboxOpen("INBOX");

    const messages: FetchedMessage[] = [];
    
    // SIMPLIFIED: Always fetch the most recent messages (ignore lastUid - we check duplicates by messageId)
    // This is more reliable and works even if UIDs have gaps or are inconsistent
    const status = await client.status("INBOX", { messages: true });
    
    if (status.messages === 0) {
      return [];
    }
    
    // Fetch the most recent N messages (limit)
    // Use sequence numbers (default) - fetchOne works better with sequence numbers
    console.log(`[fetchNewMessagesSince] Calling client.search({}, { limit: ${limit * 2} })...`);
    const allMessages = await client.search({}, { limit: limit * 2 }); // Returns sequence numbers by default
    console.log(`[fetchNewMessagesSince] Search returned:`, typeof allMessages, Array.isArray(allMessages) ? `array with ${allMessages.length} items` : 'not an array');
    const messageList = Array.isArray(allMessages) ? allMessages : [];
    console.log(`[fetchNewMessagesSince] messageList length: ${messageList.length}`);
    if (messageList.length > 0) {
      console.log(`[fetchNewMessagesSince] First few items from search:`, messageList.slice(0, 5));
    }
    
    // Extract sequence numbers and sort descending (newest first)
    const messageSeqs = messageList
      .map((msg) => {
        if (typeof msg === 'number') return msg;
        return msg?.uid || msg?.seq || msg;
      })
      .filter((seq) => seq !== undefined && seq !== null && seq !== 'undefined' && seq !== 'null')
      .map((seq) => parseInt(String(seq), 10))
      .filter((seq) => !isNaN(seq))
      .sort((a, b) => b - a) // Descending - newest first
      .slice(0, limit); // Take only the most recent N
    
    console.log(`[fetchNewMessagesSince] Extracted ${messageSeqs.length} message sequence numbers:`, messageSeqs.slice(0, 10));
    
    if (messageSeqs.length === 0) {
      console.log(`[fetchNewMessagesSince] ⚠️ No message sequence numbers found - returning empty array`);
      return [];
    }
    
    // Fetch all messages in parallel for speed
    const fetchPromises = messageSeqs.map(async (seq) => {
      const messageSeq = String(seq);
        
      try {
        // Use fetchOne() with sequence numbers (default) - no uid option needed
        console.log(`[fetchNewMessagesSince] Fetching message with sequence number: ${messageSeq}`);
        const fullMessage = await client.fetchOne(messageSeq, {
          source: true,
          envelope: true,
          bodyStructure: true,
        });

        if (!fullMessage) {
          console.log(`[fetchNewMessagesSince] fetchOne returned null for sequence ${messageSeq}`);
          return null;
        }
        
        console.log(`[fetchNewMessagesSince] Successfully fetched message sequence ${messageSeq}`);
        console.log(`[fetchNewMessagesSince] fullMessage keys:`, Object.keys(fullMessage || {}));
        console.log(`[fetchNewMessagesSince] fullMessage.envelope exists:`, !!fullMessage.envelope);
        
        // Parse headers
        const envelope = fullMessage.envelope;
        
        if (!envelope) {
          console.error(`[fetchNewMessagesSince] ERROR: fullMessage.envelope is undefined for sequence ${messageSeq}`);
          return null;
        }
        
        // Debug envelope structure
        console.log(`[fetchNewMessagesSince] envelope type:`, typeof envelope);
        console.log(`[fetchNewMessagesSince] envelope keys:`, envelope ? Object.keys(envelope) : 'N/A');
        console.log(`[fetchNewMessagesSince] envelope.from exists:`, !!envelope.from);
        console.log(`[fetchNewMessagesSince] envelope.from type:`, typeof envelope.from);
        console.log(`[fetchNewMessagesSince] envelope.from value:`, envelope.from);
        
        // Get UID from fullMessage for tracking (it's in uid property when fetched)
        const actualUid = String(fullMessage.uid || messageSeq);
        
        // Helper function to decode HTML entities
        const decodeHtmlEntities = (str: string): string => {
          if (!str) return "";
          return str
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&#x2F;/g, '/');
        };
        
        // Check if envelope.from exists and is array
        let fromValue = "";
        try {
          if (envelope && envelope.from) {
            // envelope.from is an array - access it directly
            const fromItem = envelope.from[0];
            if (fromItem) {
              if (typeof fromItem === 'object' && fromItem !== null) {
                fromValue = decodeHtmlEntities(fromItem.address || fromItem.name || "");
              } else {
                fromValue = decodeHtmlEntities(String(fromItem));
              }
            }
          } else {
            console.warn(`[fetchNewMessagesSince] envelope.from is missing for sequence ${messageSeq}`);
          }
        } catch (fromError) {
          console.error(`[fetchNewMessagesSince] Error parsing envelope.from for sequence ${messageSeq}:`, fromError);
          fromValue = "";
        }
        
        let toValue = "";
        try {
          if (envelope && envelope.to) {
            const toItem = envelope.to[0];
            if (toItem) {
              if (typeof toItem === 'object' && toItem !== null) {
                toValue = decodeHtmlEntities(toItem.address || toItem.name || "");
              } else {
                toValue = decodeHtmlEntities(String(toItem));
              }
            }
          }
        } catch (toError) {
          console.error(`[fetchNewMessagesSince] Error parsing envelope.to for sequence ${messageSeq}:`, toError);
          toValue = "";
        }
        
        let ccValue = "";
        try {
          if (envelope && envelope.cc && envelope.cc.length > 0) {
            ccValue = envelope.cc.map((c: any) => {
              if (typeof c === 'string') return decodeHtmlEntities(c);
              if (typeof c === 'object' && c !== null) {
                return decodeHtmlEntities(c?.address || c?.name || String(c));
              }
              return decodeHtmlEntities(String(c));
            }).join(", ");
          }
        } catch (ccError) {
          console.error(`[fetchNewMessagesSince] Error parsing envelope.cc for sequence ${messageSeq}:`, ccError);
          ccValue = "";
        }
        
        const headers = {
          from: fromValue,
          to: toValue,
          cc: ccValue || undefined,
          subject: decodeHtmlEntities(envelope.subject || ""),
          messageId: envelope.messageId || undefined,
          inReplyTo: Array.isArray(envelope.inReplyTo) ? envelope.inReplyTo[0] : envelope.inReplyTo || undefined,
          date: envelope.date || new Date(),
        };

        // Extract body and attachments
        const source = fullMessage.source;
        const bodyStructure = fullMessage.bodyStructure;
        
        if (!source) {
          console.error(`[fetchNewMessagesSince] ERROR: fullMessage.source is undefined for sequence ${messageSeq}`);
          return null;
        }
        
        console.log(`[fetchNewMessagesSince] Parsing message body for sequence ${messageSeq}...`);
        console.log(`[fetchNewMessagesSince] source type:`, typeof source);
        console.log(`[fetchNewMessagesSince] source is Buffer:`, Buffer.isBuffer(source));
        console.log(`[fetchNewMessagesSince] source length:`, source ? (Buffer.isBuffer(source) ? source.length : String(source).length) : 0);
        console.log(`[fetchNewMessagesSince] headers.from: ${headers.from}`);
        
        let bodyParts;
        try {
          bodyParts = await parseMessageBody(source, bodyStructure);
          console.log(`[fetchNewMessagesSince] Parsed body: text=${!!bodyParts?.text}, html=${!!bodyParts?.html}, attachments=${bodyParts?.attachments?.length || 0}`);
        } catch (parseError) {
          console.error(`[fetchNewMessagesSince] ERROR in parseMessageBody for sequence ${messageSeq}:`, parseError);
          console.error(`[fetchNewMessagesSince] Parse error details:`, parseError instanceof Error ? parseError.message : String(parseError));
          // Return message with empty body/attachments if parsing fails
          bodyParts = {
            text: undefined,
            html: undefined,
            attachments: [],
          };
        }
        
        if (!bodyParts) {
          console.error(`[fetchNewMessagesSince] ERROR: parseMessageBody returned null/undefined for sequence ${messageSeq}`);
          bodyParts = {
            text: undefined,
            html: undefined,
            attachments: [],
          };
        }
        
        const result = {
          uid: actualUid, // Use actual UID from message, or sequence number as fallback
          headers,
          bodyText: bodyParts?.text,
          bodyHtml: bodyParts?.html,
          attachments: bodyParts?.attachments || [],
        };
        
        console.log(`[fetchNewMessagesSince] Successfully processed message sequence ${messageSeq}, UID ${actualUid}, from: ${headers.from}`);
        
        return result;
      } catch (error) {
        // Log detailed error information
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        const errorName = error instanceof Error ? error.name : typeof error;
        console.error(`[fetchNewMessagesSince] Error processing message sequence ${messageSeq}:`, {
          name: errorName,
          message: errorMessage,
          stack: errorStack,
          error: error,
        });
        return null;
      }
    });
    
    // Wait for all messages to be fetched
    const fetchedResults = await Promise.all(fetchPromises);
    
    // Filter out null results (errors) and add to messages array
    for (const result of fetchedResults) {
      if (result) {
        messages.push(result);
      }
    }

    return messages;
  } catch (error) {
    console.error("IMAP fetch error:", error);
    console.error("IMAP fetch error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    if (error instanceof Error) {
      // Provide more helpful error messages
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes("enotfound") || errorMsg.includes("getaddrinfo")) {
        const config = getEmailConfig();
        throw new Error(`Cannot resolve IMAP host "${config.imapServer}". Please check if the host is correct (e.g., mail.mrgroup.rs).`);
      }
      if (errorMsg.includes("econnrefused") || errorMsg.includes("connection refused")) {
        throw new Error(`Connection refused. Please check IMAP host and port. Common ports: 993 (TLS), 143 (STARTTLS).`);
      }
      if (errorMsg.includes("authentication") || errorMsg.includes("auth") || errorMsg.includes("invalid credentials")) {
        throw new Error(`Authentication failed. Please check your email address and password.`);
      }
      if (errorMsg.includes("connection not available") || errorMsg.includes("timeout")) {
        throw new Error(`IMAP connection failed. Please check: 1) Host is correct (e.g., mail.mrgroup.rs), 2) Port is correct (993 for TLS), 3) TLS/SSL is enabled, 4) Network connection.`);
      }
      if (errorMsg.includes("certificate") || errorMsg.includes("ssl") || errorMsg.includes("tls")) {
        // Log full error for debugging
        console.error("TLS/SSL error details:", error.message);
        throw new Error(`TLS/SSL error: ${error.message}. Try disabling TLS or check certificate settings.`);
      }
    }
    throw error;
  } finally {
    if (connected) {
      try {
        await client.logout();
        console.log("IMAP disconnected");
      } catch (logoutError) {
        console.error("Error during logout:", logoutError);
      }
    }
  }
}

/**
 * Helper function to count attachment-like parts in bodyStructure
 * This helps us detect if mailparser is missing attachments
 */
function countAttachmentPartsInBodyStructure(structure: any, count = 0): number {
  if (!structure || typeof structure !== 'object') return count;
  
  // If it's a multipart structure, check all parts
  if (structure.parts && Array.isArray(structure.parts)) {
    for (const part of structure.parts) {
      count = countAttachmentPartsInBodyStructure(part, count);
    }
  }
  
  // Check if this part looks like an attachment
  // Attachment indicators: disposition=attachment, filename parameter, or specific content types
  const disposition = structure.disposition;
  const params = structure.parameters || [];
  const contentType = structure.type || '';
  
  // Check for filename in disposition params
  const dispositionParams = disposition?.parameters || [];
  const hasFilename = dispositionParams.some((p: any) => p.key?.toLowerCase() === 'filename') ||
                      params.some((p: any) => p.key?.toLowerCase() === 'name') ||
                      params.some((p: any) => p.key?.toLowerCase() === 'filename');
  
  // Count if it has attachment disposition or looks like attachment
  if (disposition?.type?.toLowerCase() === 'attachment' || 
      hasFilename ||
      (contentType && !contentType.startsWith('text/') && !contentType.startsWith('multipart/'))) {
    count++;
  }
  
  return count;
}

/**
 * Parse message body and extract text, HTML, and attachments
 * Uses MailParser streaming API instead of simpleParser for better reliability on Vercel
 * Streaming parser handles large emails and attachments better in serverless environments
 */
async function parseMessageBody(
  source: Buffer,
  bodyStructure: any
): Promise<{
  text?: string;
  html?: string;
  attachments: Array<{ filename: string; mimeType: string; buffer: Buffer }>;
}> {
  const { MailParser } = await import("mailparser");
  const { Readable } = await import("stream");
  
  // Check if Readable is available
  if (!Readable || !Readable.from) {
    console.error("[parseMessageBody] ERROR: Readable.from is not available");
    throw new Error("Readable.from is not available");
  }
  
  try {
    // Use streaming MailParser instead of simpleParser for better reliability on Vercel
    // This handles large emails and all attachments properly in serverless environments
    return new Promise((resolve, reject) => {
      const parser = new MailParser({
        // Include all attachments, including inline ones
        keepCidLinks: true, // Keep Content-ID links for inline attachments
        skipImageLinks: false, // Don't skip inline images - we want them as attachments
        skipCidLinks: false, // Don't skip CID links - we want inline attachments
      });
      
      const attachments: Array<{ filename: string; mimeType: string; buffer: Buffer }> = [];
      let text: string | undefined;
      let html: string | undefined;
      
      // Collect attachment data
      parser.on("attachment", async (attachment) => {
        try {
          const filename = attachment.filename || 
                          attachment.contentId || 
                          attachment.cid || 
                          `unnamed-${Date.now()}`;
          const mimeType = attachment.contentType || "application/octet-stream";
          
          // Read attachment content into buffer
          const chunks: Buffer[] = [];
          attachment.content.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });
          
          await new Promise<void>((resolve, reject) => {
            attachment.content.on("end", () => {
              const buffer = Buffer.concat(chunks);
              
              if (buffer.length === 0) {
                console.warn(`[parseMessageBody] Attachment ${filename} is empty (0 bytes), skipping`);
                attachment.release();
                resolve();
                return;
              }
              
              // Add extension if missing (for inline attachments)
              let finalFilename = filename;
              if (!finalFilename.includes('.') && mimeType.startsWith('image/')) {
                const ext = mimeType.split('/')[1];
                finalFilename = `${finalFilename}.${ext}`;
              }
              
              const isInline = !!attachment.contentId || !!attachment.cid;
              console.log(`[parseMessageBody] Processing attachment: ${finalFilename} (${buffer.length} bytes, ${mimeType})${isInline ? ' [INLINE]' : ''}${attachment.contentId ? ` contentId="${attachment.contentId}"` : ''}${attachment.cid ? ` cid="${attachment.cid}"` : ''}`);
              
              attachments.push({
                filename: finalFilename,
                mimeType,
                buffer,
              });
              
              attachment.release(); // CRITICAL: Must release to continue parsing
              resolve();
            });
            
            attachment.content.on("error", (err) => {
              console.error(`[parseMessageBody] Error reading attachment ${filename}:`, err);
              attachment.release();
              reject(err);
            });
          });
        } catch (error) {
          console.error(`[parseMessageBody] Error processing attachment:`, error);
          attachment.release();
        }
      });
      
      // Collect text/html parts
      parser.on("data", (data) => {
        if (data.type === "text") {
          if (data.textAsHtml) {
            html = data.textAsHtml;
          } else {
            text = data.text;
          }
        }
      });
      
      parser.on("headers", (headers) => {
        // Headers are already extracted, but we can use them if needed
      });
      
      parser.on("end", () => {
        console.log(`[parseMessageBody] Successfully parsed ${attachments.length} attachments using streaming parser`);
        
        // Clean the text and HTML
        if (text) {
          const { cleanEmailBodyText } = require("./emailBodyCleaner");
          text = cleanEmailBodyText(text);
        }
        
        if (html) {
          // Remove HTML comments and styles
          html = html
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
        }
        
        resolve({
          text: text || undefined,
          html: html || undefined,
          attachments,
        });
      });
      
      parser.on("error", (error) => {
        console.error("[parseMessageBody] Parser error:", error);
        reject(error);
      });
      
      // Pipe source buffer to parser
      // Ensure source is a Buffer
      let sourceBuffer: Buffer;
      if (Buffer.isBuffer(source)) {
        sourceBuffer = source;
      } else if (typeof source === 'string') {
        sourceBuffer = Buffer.from(source);
      } else if (source instanceof Uint8Array) {
        sourceBuffer = Buffer.from(source);
      } else {
        console.error("[parseMessageBody] ERROR: source is not a Buffer, string, or Uint8Array:", typeof source);
        reject(new Error(`Invalid source type: ${typeof source}`));
        return;
      }
      
      console.log(`[parseMessageBody] Creating stream from source buffer (${sourceBuffer.length} bytes)`);
      try {
        const sourceStream = Readable.from(sourceBuffer);
        sourceStream.pipe(parser);
        
        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.error("[parseMessageBody] Parser timeout after 30 seconds");
          reject(new Error("Parser timeout"));
        }, 30000);
        
        // Clear timeout when parser completes
        parser.once("end", () => {
          clearTimeout(timeout);
        });
        
        parser.once("error", () => {
          clearTimeout(timeout);
        });
      } catch (streamError) {
        console.error("[parseMessageBody] Error creating stream:", streamError);
        reject(streamError);
      }
    });
  } catch (error) {
    console.error("Error parsing message body:", error);
    // Fallback: return empty result
    return {
      text: undefined,
      html: undefined,
      attachments: [],
    };
  }
}

