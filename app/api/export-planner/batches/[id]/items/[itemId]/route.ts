/**
 * API: Export Planner - Delete single item
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { createBatchAudit, triggerBatchChanged } from "@/lib/export-planner/utils";
import { getSession } from "@/lib/auth/get-session";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_EDIT);
    const prisma = await getPrisma();
    const db = prisma as any;
    const { id: batchId, itemId } = await params;

    const batch = await db.exportBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }
    if (batch.frozenAt) {
      return NextResponse.json({ error: "Batch is frozen" }, { status: 400 });
    }

    const deleted = await db.exportBatchItem.findUnique({ where: { id: itemId, batchId }, select: { rn: true, engineNo: true } });
    await db.exportBatchItem.delete({
      where: { id: itemId, batchId },
    });

    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;
    await createBatchAudit(batchId, "ITEM_REMOVED", {
      userId,
      userEmail: (session?.user as { email?: string })?.email,
      entityId: itemId,
      details: deleted ? JSON.stringify({ rn: deleted.rn, engineNo: deleted.engineNo }) : undefined,
    });
    await triggerBatchChanged(batchId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = createPermissionError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
