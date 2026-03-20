/**
 * API route for inbox (email threads)
 * GET /api/inbox - List email threads with cursor pagination (VIEWER+)
 *
 * Query: take (default 150, max 200), cursor, q (optional — server-side search)
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { ensureIdleStarted } from "@/lib/email/mailSyncScheduler";
import { isThreadEffectivelyUnread } from "@/lib/inbox/effectiveUnread";
import { inboxThreadSearchWhereSql, normalizeInboxSearchQuery } from "@/lib/inbox/threadSearchDb";

const DEFAULT_TAKE = 150;
const MAX_TAKE = 200;

const threadInclude = {
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
      date: "desc" as const,
    },
    take: 1,
  },
  _count: { select: { messages: true } },
} satisfies Prisma.EmailThreadInclude;

type ThreadRow = Prisma.EmailThreadGetPayload<{ include: typeof threadInclude }>;

function decodeCursor(cursor: string): { u: string; id: string } | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const o = JSON.parse(json) as { u?: string; id?: string };
    if (typeof o.u === "string" && typeof o.id === "string") return { u: o.u, id: o.id };
  } catch {
    /* ignore */
  }
  return null;
}

function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ u: updatedAt.toISOString(), id }), "utf8").toString("base64url");
}

function mapSliceToResponse(slice: ThreadRow[]) {
  return slice.map(({ _count, messages, ...t }) => ({
    ...t,
    messages: messages ?? [],
    threadStatus: t.threadStatus ?? "NEW_CLAIM",
    messageCount: _count?.messages ?? 0,
  }));
}

function sortThreadsOutlookStyle(
  threadsForResponse: ReturnType<typeof mapSliceToResponse>
) {
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
}

export async function GET(request: Request) {
  try {
    setTimeout(() => ensureIdleStarted(), 2000);
    await requirePermission(PERMISSIONS.INBOX_READ);

    const { searchParams } = new URL(request.url);
    const rawTake = Number.parseInt(searchParams.get("take") || String(DEFAULT_TAKE), 10);
    const take = Math.min(Math.max(Number.isFinite(rawTake) ? rawTake : DEFAULT_TAKE, 1), MAX_TAKE);
    const cursorParam = searchParams.get("cursor");
    const qRaw = searchParams.get("q")?.trim() ?? "";
    const nq = qRaw ? normalizeInboxSearchQuery(qRaw) : "";

    const prisma = await getPrisma();

    let hasMore: boolean;
    let slice: ThreadRow[];

    if (qRaw && nq.length > 0) {
      const searchWhere = inboxThreadSearchWhereSql(nq);
      const decodedList = cursorParam ? decodeCursor(cursorParam) : null;
      const cursorSql = decodedList
        ? (() => {
            const d = new Date(decodedList.u);
            return Prisma.sql`AND (
              t.updatedAt < ${d}
              OR (t.updatedAt = ${d} AND t.id < ${decodedList.id})
            )`;
          })()
        : Prisma.empty;

      const idRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT t.id
        FROM EmailThread t
        LEFT JOIN Claim c ON c.id = t.claimId
        WHERE ${searchWhere}
        ${cursorSql}
        ORDER BY t.updatedAt DESC, t.id DESC
        LIMIT ${take + 1}
      `);

      const ids = idRows.map((r) => r.id);
      hasMore = ids.length > take;
      const sliceIds = hasMore ? ids.slice(0, take) : ids;

      if (sliceIds.length === 0) {
        return NextResponse.json({
          threads: [],
          hasMore: false,
          nextCursor: null,
        });
      }

      const loaded = await prisma.emailThread.findMany({
        where: { id: { in: sliceIds } },
        include: threadInclude,
      });
      const order = new Map(sliceIds.map((id, i) => [id, i]));
      loaded.sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
      slice = loaded;
    } else {
      let where: Prisma.EmailThreadWhereInput | undefined;
      if (cursorParam) {
        const decoded = decodeCursor(cursorParam);
        if (decoded) {
          const d = new Date(decoded.u);
          where = {
            OR: [{ updatedAt: { lt: d } }, { AND: [{ updatedAt: d }, { id: { lt: decoded.id } }] }],
          };
        }
      }

      const rows = await prisma.emailThread.findMany({
        where,
        include: threadInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: take + 1,
      });

      hasMore = rows.length > take;
      slice = hasMore ? rows.slice(0, take) : rows;
    }

    const threadsForResponse = mapSliceToResponse(slice);

    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.updatedAt, last.id) : null;

    sortThreadsOutlookStyle(threadsForResponse);

    return NextResponse.json({
      threads: threadsForResponse,
      hasMore,
      nextCursor,
    });
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
