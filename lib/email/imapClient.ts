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
    
    // Check mailbox status
    const status = await client.status("INBOX", { messages: true });
    
    if (status.messages === 0) {
      console.log("[fetchNewMessagesSince] Mailbox is empty");
      return [];
    }
    
    let messageUids: number[] = [];
    
    // Always fetch recent messages first (more reliable)
    // We check for duplicates by messageId later
    console.log(`[fetchNewMessagesSince] Fetching most recent ${limit} messages...`);
    const searchResult = await client.search({}, { limit: limit * 3 }); // Fetch more to ensure we get enough
    const messageList = Array.isArray(searchResult) ? searchResult : [];
    
    // Extract UIDs and sort descending (newest first)
    messageUids = messageList
      .map((msg) => {
        if (typeof msg === 'number') return msg;
        return msg?.uid || msg?.seq || msg;
      })
      .filter((uid) => uid !== undefined && uid !== null && uid !== 'undefined' && uid !== 'null')
      .map((uid) => parseInt(String(uid), 10))
      .filter((uid) => !isNaN(uid))
      .sort((a, b) => b - a) // Descending - newest first
      .slice(0, limit); // Take only the most recent N
    
    console.log(`[fetchNewMessagesSince] Found ${messageUids.length} messages to check (from most recent ${limit * 3})`);
    
    if (messageUids.length === 0) {
      return [];
    }
    
    // Fetch all messages in parallel for speed
    const fetchPromises = messageUids.map(async (uid) => {
      const messageUid = String(uid);
        
      try {
        const fullMessage = await client.fetchOne(messageUid, {
          source: true,
          envelope: true,
          bodyStructure: true,
        });

        if (!fullMessage) {
          return null;
        }

        // Parse headers
        const envelope = fullMessage.envelope;
        
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
        
        const headers = {
          from: decodeHtmlEntities(envelope.from?.[0]?.address || envelope.from?.[0]?.name || ""),
          to: decodeHtmlEntities(envelope.to?.[0]?.address || envelope.to?.[0]?.name || ""),
          cc: envelope.cc?.map((c) => decodeHtmlEntities(c.address || c.name)).join(", "),
          subject: decodeHtmlEntities(envelope.subject || ""),
          messageId: envelope.messageId || undefined,
          inReplyTo: envelope.inReplyTo?.[0] || undefined,
          date: envelope.date || new Date(),
        };

        // Extract body and attachments
        const source = fullMessage.source;
        const bodyStructure = fullMessage.bodyStructure;
        const bodyParts = await parseMessageBody(source, bodyStructure);
        
        return {
          uid: messageUid,
          headers,
          bodyText: bodyParts.text,
          bodyHtml: bodyParts.html,
          attachments: bodyParts.attachments,
        };
      } catch (error) {
        console.error(`Error processing message UID ${messageUid}:`, error);
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
      const sourceStream = Readable.from(source);
      sourceStream.pipe(parser);
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

