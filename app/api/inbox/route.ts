/**
 * API route for inbox (email threads)
 * GET /api/inbox - List all email threads (VIEWER+)
 */

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { ensureIdleStarted } from "@/lib/email/mailSyncScheduler";

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

    const threadsForResponse = threads.map(({ _count, ...t }) => ({
      ...t,
      threadStatus: t.threadStatus ?? "NEW_CLAIM",
      messageCount: _count?.messages ?? 0,
    }));

    const latestMessageDate = (t: (typeof threadsForResponse)[0]) =>
      t.messages?.[0]?.date ? new Date(t.messages[0].date).getTime() : new Date(t.createdAt).getTime();

    threadsForResponse.sort((a, b) => {
      const aUnread = !a.viewedAt;
      const bUnread = !b.viewedAt;
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

