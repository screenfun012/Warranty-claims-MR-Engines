/**
 * API route for inbox (email threads)
 * GET /api/inbox - List all email threads (VIEWER+)
 */

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { ensureIdleStarted } from "@/lib/email/mailSyncScheduler";
import { isThreadEffectivelyUnread } from "@/lib/inbox/effectiveUnread";
import { hydrateEmailMessages } from "@/lib/email/hydrateRawEmail";

export async function GET() {
  try {
    ensureIdleStarted();
    // VIEWER+ can read inbox
    await requirePermission(PERMISSIONS.INBOX_READ);
    
    const prisma = await getPrisma();
    const threads = await prisma.emailThread.findMany({
      include: {
        claim: {
          select: {
            id: true,
            claimCodeRaw: true,
          },
        },
        messages: {
          select: {
            id: true,
            date: true,
            from: true,
            bodyText: true,
            bodyHtml: true,
            rawSourcePath: true,
            attachments: { select: { id: true } },
          },
          orderBy: {
            date: "desc",
          },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const threadsWithHydratedPreview = await Promise.all(
      threads.map(async ({ _count, messages, ...t }) => {
        const hydrated = messages?.length ? await hydrateEmailMessages(messages) : [];
        return {
          ...t,
          messages: hydrated,
          threadStatus: t.threadStatus ?? "NEW_CLAIM",
          messageCount: _count?.messages ?? 0,
        };
      })
    );

    const threadsForResponse = threadsWithHydratedPreview;

    const latestMessageDate = (t: (typeof threadsForResponse)[0]) =>
      t.messages?.[0]?.date ? new Date(t.messages[0].date).getTime() : new Date(t.createdAt).getTime();

    const effectivelyUnread = (t: (typeof threadsForResponse)[0]) =>
      isThreadEffectivelyUnread(t.viewedAt, t.messages?.[0]?.date ?? t.createdAt);

    threadsForResponse.sort((a, b) => {
      const aUnread = effectivelyUnread(a);
      const bUnread = effectivelyUnread(b);
      if (aUnread && !bUnread) return -1;
      if (!aUnread && bUnread) return 1;
      return latestMessageDate(b) - latestMessageDate(a);
    });

    return NextResponse.json({ threads: threadsForResponse });
  } catch (error) {
    console.error("Error fetching inbox:", error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch inbox" },
      { status: 500 }
    );
  }
}

