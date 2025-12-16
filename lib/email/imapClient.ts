/**
 * IMAP client wrapper for fetching emails
 * Uses imapflow for incremental email sync
 */

import { ImapFlow } from "imapflow";
import { env } from "@/lib/config/env";
import { getEmailConfig } from "@/lib/config/envLoader";

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
 * Checks database config first, then falls back to env vars
 */
async function getImapClient(): Promise<ImapFlow> {
  const dbConfig = await getEmailConfig();
  
  const host = dbConfig?.imapHost || env.IMAP_HOST;
  const user = dbConfig?.imapUser || env.IMAP_USER;
  const pass = dbConfig?.imapPass || env.IMAP_PASS;
  const port = dbConfig?.imapPort ?? env.IMAP_PORT;
  const tls = dbConfig?.imapTls ?? env.IMAP_TLS;

  console.log("IMAP Config:", {
    host,
    user,
    port,
    tls,
    hasPassword: !!pass,
    passwordLength: pass?.length || 0,
    fromDatabase: !!dbConfig,
  });

  if (!host || !user) {
    throw new Error("IMAP configuration is missing. Please configure email settings in Settings page or set IMAP_HOST and IMAP_USER in your .env file.");
  }

  if (!pass) {
    throw new Error("IMAP password is missing. Please set IMAP_PASS in your .env file or enable 'Remember credentials' in Settings and enter the password.");
  }

  console.log(`Connecting to IMAP: ${user}@${host}:${port} (TLS: ${tls})`);

  return new ImapFlow({
    host,
    port,
    secure: tls,
    auth: {
      user,
      pass: pass,
    },
    logger: true, // Enable logging for debugging
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

    // If we have a lastUid, fetch messages with UID greater than it
    // Otherwise, fetch recent messages (for first sync, get the last N messages)
    let messageList: any[] = [];
    
    if (lastUid) {
      const lastUidNum = parseInt(lastUid, 10);
      if (!isNaN(lastUidNum)) {
        // Fetch messages with UID greater than lastUid
        console.log(`Fetching messages with UID > ${lastUidNum}`);
        try {
          messageList = await client.search({ uid: `${lastUidNum + 1}:*` }, { limit });
        } catch (error) {
          console.error("Error searching with UID range:", error);
          // Fallback: try to get all messages and filter
          const allMsgs = await client.search({}, { limit: limit * 2 });
          messageList = allMsgs.filter((msg) => {
            try {
              const msgUid = typeof msg === 'number' ? msg : (msg?.uid || msg?.seq || msg);
              if (msgUid === undefined || msgUid === null) return false;
              return parseInt(String(msgUid), 10) > lastUidNum;
            } catch (e) {
              console.error("Error filtering message:", e, msg);
              return false;
            }
          }).slice(0, limit);
        }
      } else {
        console.log(`Invalid lastUid format: ${lastUid}, fetching recent messages`);
        // If lastUid is not valid, fetch recent messages
        messageList = await client.search({}, { limit });
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

    console.log(`Found ${messageList.length} messages to process`);
    
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
        const headers = {
          from: envelope.from?.[0]?.address || envelope.from?.[0]?.name || "",
          to: envelope.to?.[0]?.address || envelope.to?.[0]?.name || "",
          cc: envelope.cc?.map((c) => c.address || c.name).join(", "),
          subject: envelope.subject || "",
          messageId: envelope.messageId || undefined,
          inReplyTo: envelope.inReplyTo?.[0] || undefined,
          date: envelope.date || new Date(),
        };

        // Extract body and attachments
        const source = fullMessage.source;
        const bodyParts = await parseMessageBody(source, fullMessage.bodyStructure);

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
    if (error instanceof Error) {
      // Provide more helpful error messages
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes("enotfound") || errorMsg.includes("getaddrinfo")) {
        const config = await getEmailConfig();
        throw new Error(`Cannot resolve IMAP host "${config?.imapHost || env.IMAP_HOST}". Please check if the host is correct (e.g., mail.mrgroup.rs).`);
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
        throw new Error(`TLS/SSL error. Try disabling TLS or check certificate settings.`);
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
 * Parse message body and extract text, HTML, and attachments
 * Uses mailparser for proper MIME parsing
 */
async function parseMessageBody(
  source: Buffer,
  bodyStructure: any
): Promise<{
  text?: string;
  html?: string;
  attachments: Array<{ filename: string; mimeType: string; buffer: Buffer }>;
}> {
  const { simpleParser } = await import("mailparser");
  
  try {
    const parsed = await simpleParser(source);
    
    const attachments: Array<{ filename: string; mimeType: string; buffer: Buffer }> = [];
    
    if (parsed.attachments) {
      for (const attachment of parsed.attachments) {
        attachments.push({
          filename: attachment.filename || "unnamed",
          mimeType: attachment.contentType || "application/octet-stream",
          buffer: attachment.content as Buffer,
        });
      }
    }

    return {
      text: parsed.text || undefined,
      html: parsed.html || undefined,
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

