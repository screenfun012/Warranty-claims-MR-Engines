/**
 * API: Export Planner - Single batch
 * GET - Fetch batch with items
 * PATCH - Update batch (name, columns, freeze)
 * DELETE - Delete batch
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const prisma = await getPrisma();
    const { id } = await params;

    const batch = await prisma.exportBatch.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { assignedTo: { select: { id: true, fullName: true, email: true } } },
        },
        createdBy: { select: { fullName: true, email: true } },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    return NextResponse.json(batch);
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
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.customName !== undefined) updateData.customName = body.customName;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.columns !== undefined) updateData.columns = typeof body.columns === "string" ? body.columns : JSON.stringify(body.columns);
    if (body.frozenAt !== undefined) updateData.frozenAt = body.frozenAt ? new Date(body.frozenAt) : null;
    if (body.frozenById !== undefined) updateData.frozenById = body.frozenById;

    const batch = await prisma.exportBatch.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { assignedTo: { select: { id: true, fullName: true, email: true } } },
        },
        createdBy: { select: { fullName: true, email: true } },
      },
    });

    return NextResponse.json(batch);
  } catch (error) {
    const { status, message } = createPermissionError(error);
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
    const { id } = await params;

    await prisma.exportBatch.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = createPermissionError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
