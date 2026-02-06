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
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "30"), 50);

    const entries = await prisma.exportBatchAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const batchIds = [...new Set(entries.map((e) => e.batchId))];
    const batches = await prisma.exportBatch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, batchCode: true, customName: true },
    });
    const batchMap = new Map(batches.map((b) => [b.id, b]));

    const activity = entries.map((e) => ({
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
