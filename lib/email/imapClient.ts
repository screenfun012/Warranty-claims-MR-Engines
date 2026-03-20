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
  /** Full RFC822 source from IMAP — saved to NAS as .eml */
  rawSource?: Buffer;
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
    
    // Fetch the most recent N messages by UID (konzistentno – ne mešati UID i sequence numbers)
    // Neki serveri (npr. Synology) vraćaju UID; ako ih tumačimo kao seq, fetchOne(46) traži 46. poruku u sandučetu od 4 → null
    console.log(`[fetchNewMessagesSince] Calling client.search({}, { uid: true, limit: ${limit * 2} })...`);
    const allMessages = await client.search({}, { uid: true, limit: limit * 2 });
    console.log(`[fetchNewMessagesSince] Search returned:`, typeof allMessages, Array.isArray(allMessages) ? `array with ${allMessages.length} items` : 'not an array');
    const messageList = Array.isArray(allMessages) ? allMessages : [];
    console.log(`[fetchNewMessagesSince] messageList length: ${messageList.length}`);
    if (messageList.length > 0) {
      console.log(`[fetchNewMessagesSince] First few UIDs from search:`, messageList.slice(0, 5));
    }
    
    // Izvuci UID-ove, sortiraj opadajuće (najnoviji = najveći UID), uzmi prvih limit
    const messageUids = messageList
      .map((msg) => {
        if (typeof msg === 'number') return msg;
        return msg?.uid ?? msg?.seq ?? msg;
      })
      .filter((v) => v !== undefined && v !== null && v !== 'undefined' && v !== 'null')
      .map((v) => parseInt(String(v), 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => b - a)
      .slice(0, limit);
    
    console.log(`[fetchNewMessagesSince] Extracted ${messageUids.length} UIDs (newest first):`, messageUids.slice(0, 10));
    
    if (messageUids.length === 0) {
      console.log(`[fetchNewMessagesSince] ⚠️ No UIDs found - returning empty array`);
      return [];
    }
    
    // Fetch svake poruke po UID-u (uid: true da fetchOne koristi UID a ne sequence number)
    const fetchPromises = messageUids.map(async (uidNum) => {
      const uidStr = String(uidNum);
      try {
        console.log(`[fetchNewMessagesSince] Fetching message UID ${uidStr}...`);
        const fullMessage = await client.fetchOne(uidStr, {
          source: true,
          envelope: true,
          bodyStructure: true,
        }, { uid: true });

        if (!fullMessage) {
          console.log(`[fetchNewMessagesSince] fetchOne returned null for UID ${uidStr}`);
          return null;
        }
        
        console.log(`[fetchNewMessagesSince] Successfully fetched UID ${uidStr}`);
        
        const envelope = fullMessage.envelope;
        if (!envelope) {
          console.error(`[fetchNewMessagesSince] ERROR: fullMessage.envelope is undefined for UID ${uidStr}`);
          return null;
        }
        
        const actualUid = String(fullMessage.uid ?? uidStr);
        
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
            console.warn(`[fetchNewMessagesSince] envelope.from is missing for UID ${uidStr}`);
          }
        } catch (fromError) {
          console.error(`[fetchNewMessagesSince] Error parsing envelope.from for UID ${uidStr}:`, fromError);
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
          console.error(`[fetchNewMessagesSince] Error parsing envelope.to for UID ${uidStr}:`, toError);
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
          console.error(`[fetchNewMessagesSince] Error parsing envelope.cc for UID ${uidStr}:`, ccError);
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
          console.error(`[fetchNewMessagesSince] ERROR: fullMessage.source is undefined for UID ${uidStr}`);
          return null;
        }
        
        console.log(`[fetchNewMessagesSince] Parsing message body for UID ${uidStr}...`);
        
        let bodyParts;
        try {
          bodyParts = await parseMessageBody(source, bodyStructure);
          console.log(`[fetchNewMessagesSince] Parsed body UID ${uidStr}: text=${!!bodyParts?.text}, html=${!!bodyParts?.html}, attachments=${bodyParts?.attachments?.length || 0}`);
        } catch (parseError) {
          console.error(`[fetchNewMessagesSince] ERROR in parseMessageBody for UID ${uidStr}:`, parseError);
          // Return message with empty body/attachments if parsing fails
          bodyParts = {
            text: undefined,
            html: undefined,
            attachments: [],
          };
        }
        
        if (!bodyParts) {
          console.error(`[fetchNewMessagesSince] ERROR: parseMessageBody returned null/undefined for UID ${uidStr}`);
          bodyParts = {
            text: undefined,
            html: undefined,
            attachments: [],
          };
        }
        
        const rawBuf = Buffer.isBuffer(source)
          ? source
          : source
            ? Buffer.from(source as ArrayBuffer | Uint8Array | string)
            : undefined;

        const result = {
          uid: actualUid,
          rawSource: rawBuf,
          headers,
          bodyText: bodyParts?.text,
          bodyHtml: bodyParts?.html,
          attachments: bodyParts?.attachments || [],
        };
        
        console.log(`[fetchNewMessagesSince] Successfully processed UID ${actualUid}, from: ${headers.from}`);
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        const errorName = error instanceof Error ? error.name : typeof error;
        console.error(`[fetchNewMessagesSince] Error processing message UID ${uidStr}:`, {
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
  const { MailParser, simpleParser } = await import("mailparser");
  
  // Try simpleParser first (more reliable in serverless environments)
  // It doesn't require Readable streams and works directly with buffers
  try {
    console.log(`[parseMessageBody] Attempting to parse with simpleParser (${source.length} bytes)`);
    const parsed = await simpleParser(source);
    
    const attachments = (parsed.attachments || []).map((att: any) => ({
      filename: att.filename || att.contentId || 'attachment',
      mimeType: att.contentType || 'application/octet-stream',
      buffer: att.content instanceof Buffer ? att.content : Buffer.from(att.content || ''),
    }));
    
    let text = parsed.text;
    let html = parsed.html || undefined;
    
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
    
    console.log(`[parseMessageBody] Successfully parsed with simpleParser: text=${!!text}, html=${!!html}, attachments=${attachments.length}`);
    
    return {
      text: text || undefined,
      html: html || undefined,
      attachments,
    };
  } catch (simpleParserError) {
    console.error(`[parseMessageBody] simpleParser failed:`, simpleParserError);
    // Return empty result if simpleParser fails
    // This is safer than trying streaming parser which has issues in Vercel serverless
    return {
      text: undefined,
      html: undefined,
      attachments: [],
    };
  }
}

/**
 * Fetch attachments for a single message by its Message-ID header.
 * Used for "repair" when file was not saved to NAS (e.g. empty folder).
 * @param messageId - Message-ID value (with or without angle brackets)
 * @returns Attachments array or empty if message not found / no attachments
 */
export async function fetchMessageAttachmentsByMessageId(
  messageId: string
): Promise<Array<{ filename: string; mimeType: string; buffer: Buffer }>> {
  if (!messageId?.trim()) return [];
  const client = getImapClient();
  let connected = false;
  try {
    await client.connect();
    connected = true;
    await client.mailboxOpen("INBOX");
    const toTry = [
      messageId.trim(),
      messageId.trim().startsWith("<") ? messageId.trim() : `<${messageId.trim()}>`,
      messageId.trim().replace(/^<|>$/g, ""),
    ].filter((v, i, a) => a.indexOf(v) === i);
    let uids: number[] = [];
    for (const id of toTry) {
      const result = await client.search(
        { header: { "Message-ID": id } },
        { uid: true, limit: 1 }
      );
      const list = Array.isArray(result) ? result : [];
      uids = list
        .map((m: any) => (typeof m === "number" ? m : m?.uid ?? m?.seq ?? m))
        .filter((v) => v != null && !isNaN(Number(v)))
        .map((v) => Number(v));
      if (uids.length > 0) break;
    }
    if (uids.length === 0) {
      console.log(`[fetchMessageAttachmentsByMessageId] No message found for Message-ID: ${messageId}`);
      return [];
    }
    const uidStr = String(uids[0]);
    const fullMessage = await client.fetchOne(
      uidStr,
      { source: true, bodyStructure: true },
      { uid: true }
    );
    if (!fullMessage?.source) {
      console.warn(`[fetchMessageAttachmentsByMessageId] No source for UID ${uidStr}`);
      return [];
    }
    const source = fullMessage.source instanceof Buffer ? fullMessage.source : Buffer.from(fullMessage.source || "");
    const parsed = await parseMessageBody(source, fullMessage.bodyStructure || undefined);
    return parsed.attachments || [];
  } finally {
    if (connected) {
      try {
        await client.logout();
      } catch (_) {}
    }
  }
}
