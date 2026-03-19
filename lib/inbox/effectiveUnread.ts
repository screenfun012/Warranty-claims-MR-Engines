/**
 * Outlook-style unread: thread is unread if never opened (viewedAt null)
 * OR any message is newer than viewedAt (new reply after you last read).
 */

import type { PrismaClient } from "@prisma/client";

export function isThreadEffectivelyUnread(
  viewedAt: string | Date | null | undefined,
  latestMessageDate: string | Date | null | undefined
): boolean {
  if (!latestMessageDate) {
    return !viewedAt;
  }
  const latest = new Date(latestMessageDate).getTime();
  if (!viewedAt) {
    return true;
  }
  const seen = new Date(viewedAt).getTime();
  return latest > seen;
}

export function latestMessageDateFromListPreview(
  messages: { date: string }[] | null | undefined
): string | null {
  if (!messages?.length) return null;
  return messages[0]?.date ?? null;
}

/** Count threads: never opened OR has a message newer than last viewed (Outlook-style). */
export async function countEffectivelyUnreadThreads(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*) AS c FROM EmailThread t
    WHERE t."viewedAt" IS NULL
       OR EXISTS (
         SELECT 1 FROM EmailMessage m
         WHERE m."emailThreadId" = t.id AND m.date > t."viewedAt"
       )
  `;
  return Number(rows[0]?.c ?? 0);
}
