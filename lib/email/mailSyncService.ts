/**
 * Mail sync service - core logic for syncing emails from IMAP
 * Incrementally syncs new emails and creates threads, messages, and attachments
 */

import { prisma } from "@/lib/db/prisma";
import { fetchNewMessagesSince, type FetchedMessage } from "./imapClient";
import { env } from "@/lib/config/env";
import { getEmailConfig } from "@/lib/config/envLoader";
import {
  saveAttachmentForUnassignedThread,
  saveAttachmentForClaim,
} from "@/lib/files/fileStorage";

export interface SyncResult {
  newMessages: number;
  newThreads: number;
  newClaims: number;
}

/**
 * Sync new emails from IMAP
 * Reads MailSyncState.lastUid, fetches new messages, creates threads/messages/attachments
 */
export async function syncNewEmails(): Promise<SyncResult> {
  if (!env.MAIL_SYNC_ENABLED) {
    return { newMessages: 0, newThreads: 0, newClaims: 0 };
  }

  // Check if email is configured (from database or env)
  const dbConfig = await getEmailConfig();
  const imapHost = dbConfig?.imapHost || env.IMAP_HOST;
  const imapUser = dbConfig?.imapUser || env.IMAP_USER;

  if (!imapHost || !imapUser) {
    return { newMessages: 0, newThreads: 0, newClaims: 0 };
  }

  // Get or create sync state
  let syncState = await prisma.mailSyncState.findUnique({
    where: { id: "default" },
  });

  if (!syncState) {
    syncState = await prisma.mailSyncState.create({
      data: { id: "default" },
    });
  }

  const lastUid = syncState.lastUid;
  const limit = env.MAIL_SYNC_MAX_MESSAGES_PER_RUN;

  console.log("Starting mail sync:", {
    lastUid,
    limit,
    lastSyncedAt: syncState.lastSyncedAt,
  });

  // Fetch new messages from IMAP
  console.log(`Fetching messages from IMAP (lastUid: ${lastUid || "none"}, limit: ${limit})`);
  const fetchedMessages = await fetchNewMessagesSince(lastUid, limit);
  
  console.log(`Fetched ${fetchedMessages.length} messages from IMAP`);
  
  if (fetchedMessages.length === 0) {
    console.log("No messages fetched. This could mean:");
    console.log("1. There are no new messages since last sync");
    console.log("2. All messages were already processed");
    console.log("3. IMAP search returned no results");
    console.log("4. There's an issue with the search criteria");
  }

  let newMessagesCount = 0;
  let newThreadsCount = 0;
  let newClaimsCount = 0;
  let highestUid: string | null = null;

  for (const fetchedMsg of fetchedMessages) {
    try {
      // Update highest UID (always track highest, even if message is duplicate)
      const uidNum = parseInt(fetchedMsg.uid, 10);
      if (!highestUid || uidNum > parseInt(highestUid, 10)) {
        highestUid = fetchedMsg.uid;
      }

      // Check if message already exists (by messageId) BEFORE creating thread
      let isNewMessage = true;
      if (fetchedMsg.headers.messageId) {
        const existingMessage = await prisma.emailMessage.findFirst({
          where: {
            messageId: fetchedMsg.headers.messageId,
          },
        });

        if (existingMessage) {
          // Skip duplicate message, but still track UID
          console.log(`Skipping duplicate message: ${fetchedMsg.headers.messageId}`);
          continue;
        }
      }

      // Find or create email thread
      const threadBefore = await prisma.emailThread.findFirst({
        where: {
          OR: [
            { subjectOriginal: fetchedMsg.headers.subject },
            {
              messages: {
                some: {
                  OR: [
                    { messageId: fetchedMsg.headers.messageId },
                    fetchedMsg.headers.inReplyTo ? { messageId: fetchedMsg.headers.inReplyTo } : {},
                  ],
                },
              },
            },
          ],
        },
      });

      let thread = await findOrCreateThread(fetchedMsg);
      const isNewThread = !threadBefore;
      
      if (isNewThread) {
        newThreadsCount++;
        console.log(`New thread created: ${thread.id} - ${fetchedMsg.headers.subject}`);
      }

      // Create email message
      const emailMessage = await prisma.emailMessage.create({
        data: {
          emailThreadId: thread.id,
          direction: "INBOUND",
          from: fetchedMsg.headers.from,
          to: fetchedMsg.headers.to,
          cc: fetchedMsg.headers.cc,
          subject: fetchedMsg.headers.subject,
          bodyText: fetchedMsg.bodyText,
          bodyHtml: fetchedMsg.bodyHtml,
          messageId: fetchedMsg.headers.messageId,
          inReplyTo: fetchedMsg.headers.inReplyTo,
          date: fetchedMsg.headers.date,
        },
      });

      newMessagesCount++;

      // Process attachments
      for (const attachment of fetchedMsg.attachments) {
        try {
          let filePath: string;

          if (thread.claimId) {
            // Save to claim folder
            const claim = await prisma.claim.findUnique({
              where: { id: thread.claimId },
            });
            if (claim) {
              filePath = await saveAttachmentForClaim({
                claim,
                fileBuffer: attachment.buffer,
                originalFileName: attachment.filename,
                mimeType: attachment.mimeType,
                subfolder: "03_attachments",
              });
            } else {
              // Fallback to unassigned
              filePath = await saveAttachmentForUnassignedThread({
                threadId: thread.id,
                fileBuffer: attachment.buffer,
                originalFileName: attachment.filename,
                mimeType: attachment.mimeType,
              });
            }
          } else {
            // Save to unassigned thread folder
            filePath = await saveAttachmentForUnassignedThread({
              threadId: thread.id,
              fileBuffer: attachment.buffer,
              originalFileName: attachment.filename,
              mimeType: attachment.mimeType,
            });
          }

          await prisma.attachment.create({
            data: {
              emailMessageId: emailMessage.id,
              fileName: attachment.filename,
              mimeType: attachment.mimeType,
              filePath,
              isRelevant: true,
              source: "CLIENT",
            },
          });
        } catch (error) {
          console.error(`Error saving attachment ${attachment.filename}:`, error);
          // Continue with next attachment
        }
      }

      // Detect forwarded emails and update thread
      await detectForwardedEmail(thread, fetchedMsg);
    } catch (error) {
      console.error(`Error processing message UID ${fetchedMsg.uid}:`, error);
      // Continue with next message
    }
  }

  // Update sync state - always update lastSyncedAt, and update lastUid if we have one
  // If we fetched messages but they were all duplicates, we still want to update lastSyncedAt
  // to avoid re-checking the same messages
  const updateData: any = {
    lastSyncedAt: new Date(),
  };
  
  if (highestUid) {
    updateData.lastUid = highestUid;
  }

  await prisma.mailSyncState.update({
    where: { id: "default" },
    data: updateData,
  });

  console.log("Sync completed:", {
    newMessages: newMessagesCount,
    newThreads: newThreadsCount,
    newClaims: newClaimsCount,
    highestUid,
    totalFetched: fetchedMessages.length,
  });

  return {
    newMessages: newMessagesCount,
    newThreads: newThreadsCount,
    newClaims: newClaimsCount,
  };
}

/**
 * Find or create an email thread based on message headers
 */
async function findOrCreateThread(fetchedMsg: FetchedMessage) {
  // Try to find existing thread by messageId or inReplyTo
  let thread = null;

  if (fetchedMsg.headers.messageId) {
    thread = await prisma.emailThread.findFirst({
      where: {
        OR: [
          { subjectOriginal: fetchedMsg.headers.subject },
          {
            messages: {
              some: {
                OR: [
                  { messageId: fetchedMsg.headers.messageId },
                  { messageId: fetchedMsg.headers.inReplyTo },
                ],
              },
            },
          },
        ],
      },
    });
  }

  // If not found, try by subject (for same conversation)
  if (!thread) {
    thread = await prisma.emailThread.findFirst({
      where: {
        subjectOriginal: fetchedMsg.headers.subject,
      },
    });
  }

  // Create new thread if not found
  if (!thread) {
    thread = await prisma.emailThread.create({
      data: {
        subjectOriginal: fetchedMsg.headers.subject,
        originalSender: fetchedMsg.headers.from,
      },
    });
  }

  return thread;
}

/**
 * Detect forwarded emails and update thread metadata
 */
async function detectForwardedEmail(
  thread: { id: string },
  fetchedMsg: FetchedMessage
) {
  const subject = fetchedMsg.headers.subject.toLowerCase();
  const bodyText = (fetchedMsg.bodyText || "").toLowerCase();
  const bodyHtml = (fetchedMsg.bodyHtml || "").toLowerCase();

  const isForwarded =
    subject.startsWith("fwd:") ||
    subject.startsWith("fw:") ||
    bodyText.includes("original message") ||
    bodyHtml.includes("original message");

  if (isForwarded) {
    // Try to extract original sender from body
    const originalSenderMatch =
      bodyText.match(/from:\s*([^\r\n]+)/i) ||
      bodyHtml.match(/from:\s*([^\r\n<]+)/i);

    if (originalSenderMatch) {
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          originalSender: originalSenderMatch[1].trim(),
          forwardedBy: fetchedMsg.headers.from,
        },
      });
    }
  }
}

