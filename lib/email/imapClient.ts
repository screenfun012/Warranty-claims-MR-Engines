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
    console.log("Attempting to connect to IMAP server...");
    await client.connect();
    connected = true;
    console.log("IMAP connected successfully");
    
    console.log("Opening INBOX...");
    await client.mailboxOpen("INBOX");
    console.log("INBOX opened successfully");

    const messages: FetchedMessage[] = [];
    
    // First, let's check how many messages are in the mailbox
    const status = await client.status("INBOX", { messages: true });
    console.log(`INBOX has ${status.messages} total messages`);

    // CRITICAL: Log current state for debugging
    console.log(`[fetchNewMessagesSince] lastUid: ${lastUid || 'none'}, limit: ${limit}`);
    console.log(`[fetchNewMessagesSince] INBOX status: ${status.messages} total messages`);
    
    // If we have a lastUid, fetch messages with UID greater than it
    // Otherwise, fetch recent messages (for first sync, get the last N messages)
    let messageList: any[] = [];
    
    if (lastUid) {
      const lastUidNum = parseInt(lastUid, 10);
      if (!isNaN(lastUidNum)) {
        // Fetch messages with UID greater than lastUid
        // CRITICAL: Use `lastUidNum:*` instead of `lastUidNum + 1:*` to include ALL new messages
        // Some IMAP servers may have gaps in UIDs, so we should include lastUidNum too and filter duplicates
        console.log(`[fetchNewMessagesSince] Searching for messages with UID >= ${lastUidNum + 1}`);
        try {
          // Try to fetch with UID range (more efficient)
          const searchResult = await client.search({ uid: `${lastUidNum + 1}:*` }, { limit });
          console.log(`[fetchNewMessagesSince] Search returned ${Array.isArray(searchResult) ? searchResult.length : 'non-array'} messages`);
          
          // Ensure we have an array
          messageList = Array.isArray(searchResult) ? searchResult : [];
          
          // CRITICAL: Also check if there are messages at lastUidNum (in case of race condition)
          // If we found 0 messages, try without the +1 to see if there's a message at lastUidNum
          if (messageList.length === 0) {
            console.log(`[fetchNewMessagesSince] No messages with UID > ${lastUidNum}, checking if message exists at UID ${lastUidNum}`);
            try {
              const checkResult = await client.search({ uid: `${lastUidNum}` }, { limit: 1 });
              if (Array.isArray(checkResult) && checkResult.length > 0) {
                console.log(`[fetchNewMessagesSince] Found message at UID ${lastUidNum}, but it should be skipped (already synced)`);
              }
            } catch (e) {
              // Ignore check errors
            }
          }
        } catch (error) {
          console.error("[fetchNewMessagesSince] Error searching with UID range:", error);
          console.error("[fetchNewMessagesSince] Error details:", error instanceof Error ? error.message : String(error));
          
          // Fallback: try to get all messages and filter
          console.log("[fetchNewMessagesSince] Fallback: fetching all messages and filtering...");
          const allMsgs = await client.search({}, { limit: limit * 2 });
          console.log(`[fetchNewMessagesSince] Fallback fetched ${Array.isArray(allMsgs) ? allMsgs.length : 'non-array'} messages`);
          
          messageList = (Array.isArray(allMsgs) ? allMsgs : []).filter((msg) => {
            try {
              const msgUid = typeof msg === 'number' ? msg : (msg?.uid || msg?.seq || msg);
              if (msgUid === undefined || msgUid === null) return false;
              const msgUidNum = parseInt(String(msgUid), 10);
              return msgUidNum > lastUidNum; // Use > not >= to avoid duplicates
            } catch (e) {
              console.error("[fetchNewMessagesSince] Error filtering message:", e, msg);
              return false;
            }
          }).slice(0, limit);
        }
      } else {
        console.log(`[fetchNewMessagesSince] Invalid lastUid format: ${lastUid}, fetching recent messages`);
        // If lastUid is not valid, fetch recent messages
        const recentMsgs = await client.search({}, { limit });
        messageList = Array.isArray(recentMsgs) ? recentMsgs : [];
      }
    } else {
      console.log("No lastUid found, fetching recent messages (first sync)");
      // First sync - fetch the most recent messages
      // Get all messages and take the last N
      const allMessages = await client.search({}, { limit: limit * 2 });
      // Sort by UID descending and take the first N
      messageList = allMessages
        .filter((msg) => {
          // Filter out any undefined/null messages
          if (msg === undefined || msg === null) return false;
          try {
            const uid = typeof msg === 'number' ? msg : (msg?.uid || msg?.seq || msg);
            return uid !== undefined && uid !== null;
          } catch (e) {
            return false;
          }
        })
        .sort((a, b) => {
          try {
            const uidA = typeof a === 'number' ? a : (a?.uid || a?.seq || a);
            const uidB = typeof b === 'number' ? b : (b?.uid || b?.seq || b);
            if (uidA === undefined || uidB === undefined) return 0;
            return parseInt(String(uidB), 10) - parseInt(String(uidA), 10);
          } catch (e) {
            console.error("Error sorting messages:", e);
            return 0;
          }
        })
        .slice(0, limit);
      console.log(`Fetched ${allMessages.length} total messages, taking ${messageList.length} most recent`);
    }

    console.log(`[fetchNewMessagesSince] Found ${messageList.length} messages to process`);
    
    // CRITICAL: Log message UIDs for debugging
    if (messageList.length > 0) {
      const uids = messageList.map((msg) => {
        if (typeof msg === 'number') return msg;
        return msg?.uid || msg?.seq || msg;
      }).filter((uid) => uid !== undefined && uid !== null);
      console.log(`[fetchNewMessagesSince] Message UIDs to process: ${uids.slice(0, 10).join(', ')}${uids.length > 10 ? ` ... (${uids.length} total)` : ''}`);
    } else {
      console.log(`[fetchNewMessagesSince] ⚠️ WARNING: No messages found! This could mean:`);
      console.log(`[fetchNewMessagesSince]   1. No new messages since lastUid=${lastUid}`);
      console.log(`[fetchNewMessagesSince]   2. IMAP search returned empty (check search criteria)`);
      console.log(`[fetchNewMessagesSince]   3. All messages were already processed`);
    }
    
    for (const message of messageList) {
      try {
        // Handle different message formats from imapflow
        // message can be a number (UID) or an object with uid property
        let messageUid: string;
        if (message === undefined || message === null) {
          console.error("Skipping undefined/null message");
          continue;
        }
        
        if (typeof message === 'number') {
          messageUid = String(message);
        } else if (typeof message === 'object' && message !== null) {
          const uid = message.uid || message.seq || message;
          if (uid === undefined || uid === null) {
            console.error("Message object has no UID:", message);
            continue;
          }
          messageUid = String(uid);
        } else if (message !== undefined && message !== null) {
          messageUid = String(message);
        } else {
          console.error("Message is undefined or null:", message);
          continue;
        }
        
        if (!messageUid || messageUid === 'undefined' || messageUid === 'null') {
          console.error("Invalid message UID:", messageUid, message);
          continue;
        }
        
        console.log(`Processing message UID: ${messageUid}`);
        
        const fullMessage = await client.fetchOne(messageUid, {
          source: true,
          envelope: true,
          bodyStructure: true,
        });

        if (!fullMessage) {
          console.log(`No data for message UID ${messageUid}`);
          continue;
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
        
        // CRITICAL: Log bodyStructure to see what IMAP actually sees
        console.log(`[IMAP] Message UID ${messageUid} bodyStructure type: ${bodyStructure?.type || 'unknown'}`);
        if (bodyStructure && typeof bodyStructure === 'object') {
          // Count parts that look like attachments from bodyStructure
          const attachmentParts = countAttachmentPartsInBodyStructure(bodyStructure);
          console.log(`[IMAP] BodyStructure indicates approximately ${attachmentParts} potential attachment parts`);
        }
        
        const bodyParts = await parseMessageBody(source, bodyStructure);

        console.log(`[IMAP] Message UID ${messageUid} parsed: mailparser found ${bodyParts.attachments.length} attachments`);
        
        // WARNING if mismatch detected
        if (bodyStructure && typeof bodyStructure === 'object') {
          const attachmentParts = countAttachmentPartsInBodyStructure(bodyStructure);
          if (attachmentParts > bodyParts.attachments.length) {
            console.error(`[IMAP] ⚠️ WARNING: BodyStructure suggests ~${attachmentParts} attachments, but mailparser found only ${bodyParts.attachments.length}!`);
          }
        }

        console.log(`Successfully parsed message UID ${messageUid}: ${headers.subject}`);
        
        messages.push({
          uid: messageUid,
          headers,
          bodyText: bodyParts.text,
          bodyHtml: bodyParts.html,
          attachments: bodyParts.attachments,
        });
      } catch (error) {
        console.error(`Error processing message:`, error);
        // Continue with next message
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
    
    const attachments: Array<{ filename: string; mimeType: string; buffer: Buffer }> = [];
    
    console.log(`[parseMessageBody] Total attachments found by mailparser: ${parsed.attachments?.length || 0}`);
    
    // Log details about all attachments found
    if (parsed.attachments && parsed.attachments.length > 0) {
      parsed.attachments.forEach((att, idx) => {
        console.log(`[parseMessageBody] Attachment ${idx + 1}: filename="${att.filename}", contentType="${att.contentType}", contentId="${att.contentId}", cid="${att.cid}", size=${att.size || 'unknown'}`);
      });
    }
    
    if (parsed.attachments) {
      for (const attachment of parsed.attachments) {
        try {
          // Generate filename if missing (for inline attachments without filename)
          let filename = attachment.filename;
          if (!filename) {
            // Try to use Content-ID or CID as filename
            if (attachment.contentId || attachment.cid) {
              filename = attachment.contentId || attachment.cid || `unnamed-${Date.now()}`;
              // Add extension based on content type if possible
              const mimeType = attachment.contentType || "application/octet-stream";
              if (mimeType.startsWith("image/")) {
                const ext = mimeType.split("/")[1];
                if (ext && !filename.includes(".")) {
                  filename = `${filename}.${ext}`;
                }
              }
            } else {
              filename = `unnamed-${Date.now()}`;
            }
          }
          
          const mimeType = attachment.contentType || "application/octet-stream";
          const content = attachment.content;
          
          // Check if content exists and is Buffer
          if (!content) {
            console.warn(`[parseMessageBody] Attachment ${filename} (contentId: ${attachment.contentId}, cid: ${attachment.cid}) has no content, skipping`);
            continue;
          }
          
          const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content as ArrayBuffer);
          
          if (buffer.length === 0) {
            console.warn(`[parseMessageBody] Attachment ${filename} (contentId: ${attachment.contentId}, cid: ${attachment.cid}) is empty (0 bytes), skipping`);
            continue;
          }
          
          // Log if it's an inline attachment
          const isInline = !!attachment.contentId || !!attachment.cid;
          console.log(`[parseMessageBody] Processing attachment: ${filename} (${buffer.length} bytes, ${mimeType})${isInline ? ' [INLINE]' : ''}${attachment.contentId ? ` contentId="${attachment.contentId}"` : ''}${attachment.cid ? ` cid="${attachment.cid}"` : ''}`);
          
          attachments.push({
            filename,
            mimeType,
            buffer,
          });
        } catch (error) {
          console.error(`[parseMessageBody] Error processing attachment ${attachment.filename || attachment.contentId || 'unknown'}:`, error);
          // Continue with next attachment
        }
      }
    }
    
    console.log(`[parseMessageBody] Successfully parsed ${attachments.length} attachments`);

    // Clean the text and HTML to remove unwanted content
    let cleanedText = parsed.text;
    if (cleanedText) {
      cleanedText = cleanEmailBodyText(cleanedText);
    }
    
    // For HTML, we'll clean it when extracting text, but keep original for reference
    let cleanedHtml = parsed.html;
    if (cleanedHtml) {
      // Remove HTML comments and styles from HTML
      cleanedHtml = cleanedHtml
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    }

    return {
      text: cleanedText || undefined,
      html: cleanedHtml || undefined,
      attachments,
    };
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

