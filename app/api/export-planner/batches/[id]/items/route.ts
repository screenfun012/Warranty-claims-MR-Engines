/**
 * API: Export Planner - Create item (POST), Update item (PATCH)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { createBatchAudit, triggerBatchChanged } from "@/lib/export-planner/utils";
import { getSession } from "@/lib/auth/get-session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_EDIT);
    const prisma = await getPrisma();
    const db = prisma as any;
    const { id: batchId } = await params;

    const batch = await db.exportBatch.findUnique({ where: { id: batchId } });
    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    if (batch.frozenAt) return NextResponse.json({ error: "Batch is frozen" }, { status: 400 });

    const body = await request.json();
    const rn = (body.rn ?? body.engineNo ?? "").trim() || `RN-${Date.now()}`;
    const engineNo = (body.engineNo ?? body.rn ?? rn).trim();
    if (!engineNo) return NextResponse.json({ error: "engineNo required" }, { status: 400 });

    const maxOrder = await db.exportBatchItem.aggregate({
      where: { batchId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const item = await db.exportBatchItem.create({
      data: {
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        batchId,
        rn,
        engineNo,
        engineType: body.engineType ?? null,
        mrCode: body.mrCode ?? null,
        status: body.status ?? "PLANIRANO",
        sortOrder,
        details: body.details ?? null,
        customData: body.customData != null ? JSON.stringify(body.customData) : null,
        priority: body.priority ?? null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        assignedToId: body.assignedToId ?? null,
        updatedAt: new Date(),
      },
      include: { assignedTo: { select: { id: true, fullName: true } } },
    });

    const session = await getSession();
    await createBatchAudit(batchId, "ITEM_ADDED", {
      userId: (session?.user as { id?: string })?.id,
      userEmail: (session?.user as { email?: string })?.email,
      entityId: item.id,
      details: JSON.stringify({ rn: item.rn, engineNo: item.engineNo }),
    });
    await triggerBatchChanged(batchId);

    return NextResponse.json({
      id: item.id,
      rn: item.rn,
      engineNo: item.engineNo,
      engineType: item.engineType,
      mrCode: item.mrCode,
      status: item.status,
      sortOrder: item.sortOrder,
      details: item.details,
      customData: item.customData,
      priority: item.priority,
      startDate: item.startDate?.toISOString() ?? null,
      dueDate: item.dueDate?.toISOString() ?? null,
      assignedTo: item.assignedTo,
      qcOk: item.qcOk,
    });
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
    const { id: batchId } = await params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

    const batch = await db.exportBatch.findUnique({ where: { id: batchId } });
    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    if (batch.frozenAt) return NextResponse.json({ error: "Batch is frozen" }, { status: 400 });

    const body = await request.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined) updateData.status = body.status;
    if (body.engineNo !== undefined) updateData.engineNo = body.engineNo;
    if (body.rn !== undefined) updateData.rn = body.rn;
    if (body.engineType !== undefined) updateData.engineType = body.engineType;
    if (body.mrCode !== undefined) updateData.mrCode = body.mrCode;
    if (body.details !== undefined) updateData.details = body.details;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId || null;
    if (body.qcOk !== undefined) updateData.qcOk = !!body.qcOk;
    if (body.customData !== undefined) updateData.customData = body.customData != null ? (typeof body.customData === "string" ? body.customData : JSON.stringify(body.customData)) : null;

    const item = await db.exportBatchItem.update({
      where: { id: itemId, batchId },
      data: updateData,
      include: { assignedTo: { select: { id: true, fullName: true } } },
    });

    await triggerBatchChanged(batchId);

    return NextResponse.json({
      id: item.id,
      rn: item.rn,
      engineNo: item.engineNo,
      engineType: item.engineType,
      mrCode: item.mrCode,
      status: item.status,
      sortOrder: item.sortOrder,
      details: item.details,
      customData: item.customData,
      priority: item.priority,
      startDate: item.startDate?.toISOString() ?? null,
      dueDate: item.dueDate?.toISOString() ?? null,
      assignedTo: item.assignedTo,
      qcOk: item.qcOk,
    });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
