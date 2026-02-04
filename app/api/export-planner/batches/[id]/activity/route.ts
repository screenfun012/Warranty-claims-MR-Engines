/**
 * GET - Aktivnost za jedan batch (istorija pomeranja stavki, dodele, itd.)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const prisma = await getPrisma();
    const { id: batchId } = await params;
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50"), 100);

    const entries = await prisma.exportBatchAudit.findMany({
      where: { batchId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ activity: entries });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
