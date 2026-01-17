/**
 * Mail sync service - core logic for syncing emails from IMAP
 * Incrementally syncs new emails and creates threads, messages, and attachments
 */

import { getPrisma } from "@/lib/db/prisma";
import { fetchNewMessagesSince, type FetchedMessage } from "./imapClient";
import { env } from "@/lib/config/env";
import { isEmailConfigured } from "@/lib/config/envLoader";
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
  const syncStartTime = Date.now();
  
  if (!env.MAIL_SYNC_ENABLED) {
    return { newMessages: 0, newThreads: 0, newClaims: 0 };
  }

  // Check if email is configured
  if (!isEmailConfigured()) {
    return { newMessages: 0, newThreads: 0, newClaims: 0 };
  }

  // Get Prisma client (works for both SQLite and Turso)
  let prisma;
  try {
    prisma = await getPrisma();
  } catch (error) {
    console.error("Failed to get Prisma client:", error);
    throw new Error(`Failed to initialize database connection: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // Get or create sync state
  let syncState;
  try {
    syncState = await prisma.mailSyncState.findUnique({
      where: { id: "default" },
    });

    if (!syncState) {
      syncState = await prisma.mailSyncState.create({
        data: { id: "default" },
      });
    }
  } catch (error) {
    console.error("Error accessing MailSyncState:", error);
    // If table doesn't exist, try to create it
    if (error instanceof Error && error.message.includes("does not exist")) {
      throw new Error("MailSyncState table does not exist. Please run database migrations.");
    }
    throw error;
  }

  const lastUid = syncState.lastUid;
  const limit = env.MAIL_SYNC_MAX_MESSAGES_PER_RUN;

  console.log("Starting mail sync:", {
    lastUid,
    limit,
    lastSyncedAt: syncState.lastSyncedAt,
  });

  // Fetch new messages from IMAP
  console.log(`[Sync] Fetching messages from IMAP (lastUid: ${lastUid || "none"}, limit: ${limit})`);
  const fetchStartTime = Date.now();
  const fetchedMessages = await fetchNewMessagesSince(lastUid, limit);
  const fetchDuration = Date.now() - fetchStartTime;
  
  console.log(`[Sync] Fetched ${fetchedMessages.length} messages from IMAP in ${fetchDuration}ms`);
  
  if (fetchedMessages.length === 0) {
    console.log(`[Sync] ⚠️ No messages fetched. This could mean:`);
    console.log(`[Sync]   1. No new messages since lastUid=${lastUid}`);
    console.log(`[Sync]   2. All messages were already processed`);
    console.log(`[Sync]   3. IMAP search returned no results`);
    console.log(`[Sync]   4. There's an issue with the search criteria`);
    console.log(`[Sync] ⚠️ If you know there are new emails, check IMAP logs above for search details`);
  } else {
    console.log(`[Sync] ✓ Found ${fetchedMessages.length} new messages to process`);
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

      let thread = await findOrCreateThread(fetchedMsg, prisma);
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

      // Process attachments - OPTIMIZED: parallel processing and batch operations
      const attachmentCount = fetchedMsg.attachments.length;
      console.log(`[Sync] Processing ${attachmentCount} attachments for message UID ${fetchedMsg.uid}...`);
      
      if (attachmentCount === 0) {
        console.warn(`[Sync] Warning: Message UID ${fetchedMsg.uid} has no attachments, but email might have attachments in body`);
      } else {
        // OPTIMIZATION 1: Load claim once if needed (not for each attachment)
        let claim: Awaited<ReturnType<typeof getPrisma>>['claim']['findUnique'] extends (...args: any[]) => Promise<infer T> ? T : never | null = null;
        if (thread.claimId) {
          claim = await prisma.claim.findUnique({
            where: { id: thread.claimId },
          });
        }

        // OPTIMIZATION 2: Process all attachments in parallel
        const attachmentPromises = fetchedMsg.attachments.map(async (attachment, index) => {
          try {
            console.log(`[Sync] Saving attachment ${index + 1}/${attachmentCount}: ${attachment.filename} (${attachment.buffer.length} bytes, ${attachment.mimeType})`);
            
            let filePath: string;

            if (claim) {
              // Save to claim folder
              filePath = await saveAttachmentForClaim({
                claim,
                fileBuffer: attachment.buffer,
                originalFileName: attachment.filename,
                mimeType: attachment.mimeType,
                subfolder: "03_attachments",
              });
            } else {
              // Save to unassigned thread folder
              filePath = await saveAttachmentForUnassignedThread({
                threadId: thread.id,
                fileBuffer: attachment.buffer,
                originalFileName: attachment.filename,
                mimeType: attachment.mimeType,
              });
            }

            return {
              success: true,
              attachment,
              filePath,
            };
          } catch (error) {
            console.error(`[Sync] ✗ Error saving attachment ${attachment.filename}:`, error);
            console.error(`[Sync] Error details:`, error instanceof Error ? error.message : String(error));
            return {
              success: false,
              attachment,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        });

        // Wait for all attachments to be saved in parallel
        const results = await Promise.allSettled(attachmentPromises);
        
        // Collect successful and failed attachments
        const successful: Array<{ attachment: typeof fetchedMsg.attachments[0]; filePath: string }> = [];
        const failed: Array<{ attachment: typeof fetchedMsg.attachments[0]; error: string }> = [];
        
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            successful.push(result.value as { attachment: typeof fetchedMsg.attachments[0]; filePath: string });
          } else {
            const errorMsg = result.status === 'rejected' ? result.reason?.message || 'Unknown error' : (result.value as any).error || 'Unknown error';
            const attachment = result.status === 'rejected' ? null : (result.value as any).attachment;
            if (attachment) {
              failed.push({ attachment, error: errorMsg });
            }
          }
        }

        // OPTIMIZATION 3: Batch create attachment records instead of individual creates
        if (successful.length > 0) {
          try {
            await prisma.attachment.createMany({
              data: successful.map(({ attachment, filePath }) => ({
                emailMessageId: emailMessage.id,
                fileName: attachment.filename,
                mimeType: attachment.mimeType,
                filePath,
                isRelevant: true,
                source: "CLIENT",
              })),
            });
            console.log(`[Sync] ✓ Successfully saved ${successful.length} attachments in parallel`);
          } catch (error) {
            console.error(`[Sync] Error creating attachment records in batch:`, error);
            // Fallback: try individual creates
            for (const { attachment, filePath } of successful) {
              try {
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
              } catch (createError) {
                console.error(`[Sync] Error creating attachment record for ${attachment.filename}:`, createError);
                failed.push({ attachment, error: createError instanceof Error ? createError.message : String(createError) });
              }
            }
          }
        }

        console.log(`[Sync] Attachment summary for message UID ${fetchedMsg.uid}: ${successful.length} saved, ${failed.length} failed out of ${attachmentCount} total`);
      }

      // Detect forwarded emails and update thread
      await detectForwardedEmail(thread, fetchedMsg, prisma);
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

  const syncDuration = Date.now() - syncStartTime;
  console.log("Sync completed:", {
    newMessages: newMessagesCount,
    newThreads: newThreadsCount,
    newClaims: newClaimsCount,
    highestUid,
    totalFetched: fetchedMessages.length,
    duration: `${syncDuration}ms`,
  });

  // If new messages were synced, we can't dispatch to window from server-side
  // But the frontend polling will pick it up quickly (1-2 seconds)
  if (newMessagesCount > 0) {
    console.log(`[Sync] ${newMessagesCount} new messages synced - frontend should refresh soon`);
  }

  return {
    newMessages: newMessagesCount,
    newThreads: newThreadsCount,
    newClaims: newClaimsCount,
  };
}

/**
 * Find or create an email thread based on message headers
 */
async function findOrCreateThread(fetchedMsg: FetchedMessage, prisma: Awaited<ReturnType<typeof getPrisma>>) {
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
  fetchedMsg: FetchedMessage,
  prisma: Awaited<ReturnType<typeof getPrisma>>
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
      // Decode HTML entities from the matched sender
      let decodedSender = originalSenderMatch[1].trim();
      // Decode common HTML entities
      decodedSender = decodedSender
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
      
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          originalSender: decodedSender,
          forwardedBy: fetchedMsg.headers.from,
        },
      });
    }
  }
}

