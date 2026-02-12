/**
 * Poboljšan Mail Sync Service sa boljim threading-om
 * 
 * Ključne izmene:
 * 1. Koristi Message-ID i References za pravilno grupisanje
 * 2. Deduplikuje poruke
 * 3. Pravilno hendluje RE: odgovore
 * 4. Extraktuje čist sadržaj bez quoted text-a
 * 5. Hendluje CC emailove
 */

import { getPrisma } from "@/lib/db/prisma";
import { fetchNewMessagesSince, type FetchedMessage } from "./imapClient";
import { env } from "@/lib/config/env";
import { isEmailConfigured } from "@/lib/config/envLoader";
import {
  saveAttachmentForUnassignedThread,
  saveAttachmentForClaim,
} from "@/lib/files/fileStorage";
import {
  cleanSubject,
  generateThreadId,
  belongsToSameThread,
  extractCleanBody,
  isClaimEmail,
  isSentDirectlyToClaim,
  extractEmailAddress,
  isForwardedEmail,
  extractOriginalSenderFromForward,
} from "./emailThreadingUtils";

export interface SyncResult {
  newMessages: number;
  newThreads: number;
  newClaims: number;
}

/**
 * Sync new emails from IMAP sa poboljšanim threading-om
 */
export async function syncNewEmails(): Promise<SyncResult> {
  const syncStartTime = Date.now();
  
  if (!env.MAIL_SYNC_ENABLED) {
    return { newMessages: 0, newThreads: 0, newClaims: 0 };
  }

  if (!isEmailConfigured()) {
    return { newMessages: 0, newThreads: 0, newClaims: 0 };
  }

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
    if (error instanceof Error && error.message.includes("does not exist")) {
      throw new Error("MailSyncState table does not exist. Please run database migrations.");
    }
    throw error;
  }

  const lastUid = syncState.lastUid;
  const limit = env.MAIL_SYNC_MAX_MESSAGES_PER_RUN;

  console.log("[MailSync] Starting sync:", {
    lastUid,
    limit,
    lastSyncedAt: syncState.lastSyncedAt,
  });

  // Fetch new messages from IMAP
  const fetchStartTime = Date.now();
  const fetchedMessages = await fetchNewMessagesSince(lastUid, limit);
  const fetchDuration = Date.now() - fetchStartTime;
  
  console.log(`[MailSync] Fetched ${fetchedMessages.length} messages in ${fetchDuration}ms`);
  
  if (fetchedMessages.length === 0) {
    console.log("[MailSync] No new messages found");
    return { newMessages: 0, newThreads: 0, newClaims: 0 };
  }

  let newMessagesCount = 0;
  let newThreadsCount = 0;
  let newClaimsCount = 0;
  let highestUid: string | null = null;
  let errorCount = 0;

  const { getEmailConfig } = await import("@/lib/config/envLoader");
  const emailConfig = getEmailConfig();
  const claimsEmail = (emailConfig.imapUserEmail || emailConfig.smtpUserEmail || "").toLowerCase().trim();

  for (const fetchedMsg of fetchedMessages) {
    try {
      const uidNum = parseInt(fetchedMsg.uid, 10);
      if (!highestUid || uidNum > parseInt(highestUid, 10)) {
        highestUid = fetchedMsg.uid;
      }

      // ===== KLJUČNA IZMENA: Proveri da li je email relevantan za reklamacije =====
      const isRelevant = isClaimEmail(
        fetchedMsg.headers.to,
        fetchedMsg.headers.cc,
        claimsEmail
      );

      if (!isRelevant) {
        console.log(`[MailSync] Skipping irrelevant email: ${fetchedMsg.headers.subject}`);
        continue;
      }

      // ===== NOVA LOGIKA: Thread matching sa Message-ID i References =====
      const thread = await findOrCreateThreadWithMessageId(fetchedMsg, prisma, claimsEmail);
      
      const isNewThread = !(await prisma.emailThread.findUnique({
        where: { id: thread.id },
        select: { createdAt: true }
      }));
      
      if (isNewThread) {
        newThreadsCount++;
        console.log(`[MailSync] ✓ New thread: ${thread.id} - ${fetchedMsg.headers.subject}`);
      }

      // ===== DEDUPLICATION: Proveri da li poruka već postoji =====
      const isDuplicate = await checkIfMessageExists(
        thread.id,
        fetchedMsg.headers.messageId,
        fetchedMsg.headers.date,
        fetchedMsg.headers.from,
        prisma
      );

      if (isDuplicate) {
        console.log(`[MailSync] Duplicate message skipped: ${fetchedMsg.headers.messageId || fetchedMsg.headers.subject}`);
        continue;
      }

      // ===== EKSTRAKTUJ ČIST SADRŽAJ bez quoted text-a =====
      const cleanBodyText = extractCleanBody(
        fetchedMsg.bodyText || '',
        fetchedMsg.bodyHtml
      );

      // ===== KREIRAJ EMAIL MESSAGE =====
      const emailMessage = await prisma.emailMessage.create({
        data: {
          emailThreadId: thread.id,
          direction: "INBOUND",
          from: fetchedMsg.headers.from,
          to: fetchedMsg.headers.to,
          cc: fetchedMsg.headers.cc,
          subject: fetchedMsg.headers.subject,
          bodyText: cleanBodyText, // Sačuvaj clean version
          bodyHtml: fetchedMsg.bodyHtml, // Zadrži original HTML za reference
          messageId: fetchedMsg.headers.messageId,
          inReplyTo: fetchedMsg.headers.inReplyTo,
          date: fetchedMsg.headers.date,
        },
      });

      newMessagesCount++;

      // Process attachments (parallelno)
      if (fetchedMsg.attachments.length > 0) {
        await processAttachmentsOptimized(
          fetchedMsg,
          emailMessage.id,
          thread,
          prisma
        );
      }

      // Detektuj forwarded emails i update thread
      await detectAndUpdateForwardedEmail(thread, fetchedMsg, prisma);
      
    } catch (error) {
      errorCount++;
      console.error(`[MailSync] ✗ Error processing UID ${fetchedMsg.uid}:`, error);
      continue;
    }
  }

  // Update sync state
  await prisma.mailSyncState.update({
    where: { id: "default" },
    data: {
      lastSyncedAt: new Date(),
      ...(highestUid ? { lastUid: highestUid } : {}),
    },
  });

  const syncDuration = Date.now() - syncStartTime;
  console.log("[MailSync] ✓ Sync completed:", {
    newMessages: newMessagesCount,
    newThreads: newThreadsCount,
    errors: errorCount,
    duration: `${syncDuration}ms`,
  });

  if (newMessagesCount > 0) {
    console.log(`[MailSync] ${newMessagesCount} new messages synced`);
  }

  return {
    newMessages: newMessagesCount,
    newThreads: newThreadsCount,
    newClaims: newClaimsCount,
  };
}

/**
 * NOVA FUNKCIJA: Pronalazi ili kreira thread koristeći Message-ID i References
 */
async function findOrCreateThreadWithMessageId(
  fetchedMsg: FetchedMessage,
  prisma: Awaited<ReturnType<typeof getPrisma>>,
  claimsEmail: string
) {
  const cleanedSubject = cleanSubject(fetchedMsg.headers.subject);
  
  // 1. Pokušaj da nađeš thread preko Message-ID references
  if (fetchedMsg.headers.inReplyTo) {
    const existingThread = await prisma.emailThread.findFirst({
      where: {
        messages: {
          some: {
            messageId: fetchedMsg.headers.inReplyTo,
          },
        },
      },
    });
    
    if (existingThread) {
      console.log(`[MailSync] Found existing thread via InReplyTo: ${existingThread.id}`);
      return existingThread;
    }
  }

  // 2. Pokušaj preko References headers
  if (fetchedMsg.headers.messageId) {
    const existingThread = await prisma.emailThread.findFirst({
      where: {
        messages: {
          some: {
            OR: [
              { messageId: fetchedMsg.headers.messageId },
              ...(fetchedMsg.headers.inReplyTo ? [{ messageId: fetchedMsg.headers.inReplyTo }] : []),
            ],
          },
        },
      },
    });
    
    if (existingThread) {
      console.log(`[MailSync] Found existing thread via MessageId: ${existingThread.id}`);
      return existingThread;
    }
  }

  // 3. Fallback: Pokušaj preko cleaned subject-a
  const existingThreadBySubject = await prisma.emailThread.findFirst({
    where: {
      subjectOriginal: fetchedMsg.headers.subject,
    },
  });

  if (existingThreadBySubject) {
    console.log(`[MailSync] Found existing thread via subject: ${existingThreadBySubject.id}`);
    return existingThreadBySubject;
  }

  // 4. Kreiraj novi thread
  const isSentDirectly = isSentDirectlyToClaim(fetchedMsg.headers.to, claimsEmail);
  const threadStatus = isSentDirectly ? "NEW_CLAIM" : "HAS_REPLIES";

  const newThread = await prisma.emailThread.create({
    data: {
      subjectOriginal: fetchedMsg.headers.subject,
      originalSender: fetchedMsg.headers.from,
      threadStatus,
    },
  });

  console.log(`[MailSync] ✓ Created new thread: ${newThread.id} (status: ${threadStatus})`);
  return newThread;
}

/**
 * Provera da li poruka već postoji u bazi (deduplication)
 */
async function checkIfMessageExists(
  threadId: string,
  messageId: string | undefined,
  date: Date,
  from: string,
  prisma: Awaited<ReturnType<typeof getPrisma>>
): Promise<boolean> {
  // 1. Proveri preko Message-ID (najpouzdanije)
  if (messageId) {
    const existing = await prisma.emailMessage.findFirst({
      where: {
        emailThreadId: threadId,
        messageId,
      },
    });
    
    if (existing) return true;
  }

  // 2. Fallback: Proveri preko date + from (za mailove bez Message-ID)
  const existingByMeta = await prisma.emailMessage.findFirst({
    where: {
      emailThreadId: threadId,
      date,
      from,
    },
  });

  return !!existingByMeta;
}

/**
 * Optimizovano procesiranje attachments-a (parallel upload)
 */
async function processAttachmentsOptimized(
  fetchedMsg: FetchedMessage,
  emailMessageId: string,
  thread: { id: string; claimId?: string | null },
  prisma: Awaited<ReturnType<typeof getPrisma>>
) {
  const claim = thread.claimId
    ? await prisma.claim.findUnique({ where: { id: thread.claimId } })
    : null;

  // Parallel processing
  const attachmentPromises = fetchedMsg.attachments.map(async (attachment) => {
    try {
      let filePath: string;

      if (claim) {
        filePath = await saveAttachmentForClaim({
          claim,
          fileBuffer: attachment.buffer,
          originalFileName: attachment.filename,
          mimeType: attachment.mimeType,
          subfolder: "03_attachments",
        });
      } else {
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
      console.error(`[MailSync] ✗ Attachment error (${attachment.filename}):`, error);
      return {
        success: false,
        attachment,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const results = await Promise.allSettled(attachmentPromises);
  const successful: Array<{ attachment: FetchedMessage['attachments'][0]; filePath: string }> = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      successful.push(result.value as any);
    }
  }

  // Batch insert
  if (successful.length > 0) {
    try {
      await prisma.attachment.createMany({
        data: successful.map(({ attachment, filePath }) => ({
          emailMessageId,
          fileName: attachment.filename,
          mimeType: attachment.mimeType,
          filePath,
          isRelevant: true,
          source: "CLIENT",
        })),
      });
      console.log(`[MailSync] ✓ Saved ${successful.length} attachments`);
    } catch (error) {
      console.error(`[MailSync] ✗ Batch attachment insert failed:`, error);
    }
  }
}

/**
 * Detektuje forwarded emails i update thread sa originalnim sender-om
 */
async function detectAndUpdateForwardedEmail(
  thread: { id: string },
  fetchedMsg: FetchedMessage,
  prisma: Awaited<ReturnType<typeof getPrisma>>
) {
  const bodyText = fetchedMsg.bodyText || '';
  const subject = fetchedMsg.headers.subject;

  if (isForwardedEmail(subject, bodyText)) {
    const originalSender = extractOriginalSenderFromForward(bodyText);

    if (originalSender) {
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: {
          originalSender,
          forwardedBy: fetchedMsg.headers.from,
        },
      });
      console.log(`[MailSync] ✓ Detected forward: original=${originalSender}`);
    }
  }
}
