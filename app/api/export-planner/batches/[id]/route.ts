/**
 * API: Export Planner - Get batch (GET), Update batch (PATCH), Delete batch (DELETE)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { createBatchAudit, triggerBatchChanged } from "@/lib/export-planner/utils";
import { getSession } from "@/lib/auth/get-session";

function serializeBatch(batch: any) {
  return {
    id: batch.id,
    batchCode: batch.batchCode,
    batchType: batch.batchType,
    customName: batch.customName,
    frozenAt: batch.frozenAt ? new Date(batch.frozenAt).toISOString() : null,
    columns: batch.columns,
    items: (batch.items ?? []).map((i: any) => ({
      id: i.id,
      rn: i.rn,
      engineNo: i.engineNo,
      engineType: i.engineType,
      mrCode: i.mrCode,
      status: i.status,
      sortOrder: i.sortOrder,
      priority: i.priority,
      assignedTo: i.assignedTo ? { id: i.assignedTo.id, fullName: i.assignedTo.fullName } : null,
      qcOk: i.qcOk,
      details: i.details,
      startDate: i.startDate ? new Date(i.startDate).toISOString() : null,
      dueDate: i.dueDate ? new Date(i.dueDate).toISOString() : null,
      customData: i.customData,
    })),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const prisma = await getPrisma();
    const db = prisma as any;
    const { id } = await params;

    const batch = await db.exportBatch.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { assignedTo: { select: { id: true, fullName: true } } },
        },
      },
    });

    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    return NextResponse.json(serializeBatch(batch));
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_EDIT);
    const prisma = await getPrisma();
    const db = prisma as any;
    const { id } = await params;

    const batch = await db.exportBatch.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { assignedTo: { select: { id: true, fullName: true } } },
        },
      },
    });
    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

    const body = await request.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.frozenAt !== undefined) {
      const session = await getSession();
      updateData.frozenAt = body.frozenAt ? new Date(body.frozenAt) : null;
      updateData.frozenById = body.frozenAt ? (session?.user as { id?: string })?.id ?? null : null;
    }
    if (body.columns !== undefined) updateData.columns = typeof body.columns === "string" ? body.columns : JSON.stringify(body.columns ?? []);

    const updated = await db.exportBatch.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { assignedTo: { select: { id: true, fullName: true } } },
        },
      },
    });

    if (body.frozenAt) {
      const session = await getSession();
      await createBatchAudit(id, "BATCH_FROZEN", {
        userId: (session?.user as { id?: string })?.id,
        userEmail: (session?.user as { email?: string })?.email,
      });
    }
    await triggerBatchChanged(id);

    return NextResponse.json(serializeBatch(updated));
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_EDIT);
    const prisma = await getPrisma();
    const db = prisma as any;
    const { id } = await params;

    const batch = await db.exportBatch.findUnique({ where: { id } });
    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

    await db.exportBatch.delete({ where: { id } });

    const session = await getSession();
    await createBatchAudit(id, "BATCH_DELETED", {
      userId: (session?.user as { id?: string })?.id,
      userEmail: (session?.user as { email?: string })?.email,
      details: batch.batchCode,
    });
    await triggerBatchChanged(id);

    return NextResponse.json({ success: true });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
