/**
 * API: Export Planner - Batch items
 * GET - List items (included in batch fetch)
 * POST - Add item
 * PATCH - Update item (status for drag-drop, details)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_EDIT);
    const prisma = await getPrisma();
    const { id: batchId } = await params;
    const body = await request.json();

    const batch = await prisma.exportBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }
    if (batch.frozenAt) {
      return NextResponse.json({ error: "Batch is frozen" }, { status: 400 });
    }

    const rn = String(body.rn ?? body.engineNo ?? "").trim() || `RN-${Date.now()}`;
    const engineNo = String(body.engineNo ?? body.engineNumber ?? rn).trim();
    const status = (body.status as string) || "PLANIRANO";
    const mrCode = batch.batchType === "MR_ENGINES" ? (body.mrCode as string) || null : null;

    const maxOrder = await prisma.exportBatchItem
      .aggregate({ where: { batchId }, _max: { sortOrder: true } })
      .then((r) => (r._max.sortOrder ?? -1) + 1);

    const item = await prisma.exportBatchItem.create({
      data: {
        batchId,
        rn,
        engineNo,
        engineType: (body.engineType as string) || null,
        status,
        sortOrder: maxOrder,
        mrCode,
        customData: body.customData ? JSON.stringify(body.customData) : null,
        priority: (body.priority as string) || null,
        assignedToId: (body.assignedToId as string) || null,
        details: (body.details as string) || null,
      },
      include: { assignedTo: { select: { id: true, fullName: true, email: true } } },
    });

    return NextResponse.json(item);
  } catch (error) {
    const { status, message } = createPermissionError(error);
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
    const { id: batchId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const batch = await prisma.exportBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }
    if (batch.frozenAt) {
      return NextResponse.json({ error: "Batch is frozen" }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) updateData.status = body.status;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.mrCode !== undefined) updateData.mrCode = body.mrCode;
    if (body.engineNo !== undefined) updateData.engineNo = body.engineNo;
    if (body.engineType !== undefined) updateData.engineType = body.engineType;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId || null;
    if (body.details !== undefined) updateData.details = body.details;
    if (body.customData !== undefined) updateData.customData = typeof body.customData === "string" ? body.customData : JSON.stringify(body.customData);
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    const item = await prisma.exportBatchItem.update({
      where: { id: itemId, batchId },
      data: updateData,
      include: { assignedTo: { select: { id: true, fullName: true, email: true } } },
    });

    return NextResponse.json(item);
  } catch (error) {
    const { status, message } = createPermissionError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
