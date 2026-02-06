/**
 * GET - Nedavna aktivnost u planeru (audit log)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);

    const prisma = await getPrisma();
    const db = prisma as any;
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "30"), 50);

    const entries = await db.exportBatchAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const batchIds = [...new Set(entries.map((e: { batchId: string }) => e.batchId))];
    const batches = await db.exportBatch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, batchCode: true, customName: true },
    });
    const batchMap = new Map(batches.map((b: { id: string }) => [b.id, b]));

    const activity = entries.map((e: { batchId: string } & Record<string, unknown>) => ({
      ...e,
      batch: batchMap.get(e.batchId)
        ? { ...batchMap.get(e.batchId)!, id: e.batchId }
        : null,
    }));

    return NextResponse.json({ activity });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
