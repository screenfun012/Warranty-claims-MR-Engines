/**
 * API: Export Planner - Delete single item
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_EDIT);
    const prisma = await getPrisma();
    const { id: batchId, itemId } = await params;

    const batch = await prisma.exportBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }
    if (batch.frozenAt) {
      return NextResponse.json({ error: "Batch is frozen" }, { status: 400 });
    }

    await prisma.exportBatchItem.delete({
      where: { id: itemId, batchId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = createPermissionError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
