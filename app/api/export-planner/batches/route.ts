/**
 * API: Export Planner - List batches (GET), Create batch (POST)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { createBatchAudit, triggerBatchChanged, nextBatchCode } from "@/lib/export-planner/utils";
import { getSession } from "@/lib/auth/get-session";

const defaultColumns = [
  { id: "PLANIRANO", label: "U planu", order: 0, color: "slate" },
  { id: "RAD", label: "U radu", order: 1, color: "blue" },
  { id: "IZVOZ", label: "Izvoz", order: 2, color: "green" },
];

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const batchType = searchParams.get("batchType") ?? "GENERIC";
    const mine = searchParams.get("mine") === "1";

    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;

    const where: { batchType: string; createdById?: string } = { batchType };
    if (mine && userId) where.createdById = userId;

    const batches = await prisma.exportBatch.findMany({
      where,
      orderBy: { exportDate: "desc" },
      include: {
        _count: { select: { items: true } },
        createdBy: { select: { fullName: true, email: true } },
      },
    });

    const list = batches.map((b) => ({
      id: b.id,
      batchCode: b.batchCode,
      batchType: b.batchType,
      customName: b.customName,
      frozenAt: b.frozenAt ? new Date(b.frozenAt).toISOString() : null,
      exportDate: b.exportDate ? new Date(b.exportDate).toISOString() : b.exportDate,
      _count: b._count,
      createdBy: b.createdBy,
    }));

    return NextResponse.json(list);
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_EDIT);
    const prisma = await getPrisma();
    const body = await request.json();
    const batchType = body.batchType ?? "GENERIC";
    const customName = body.customName?.trim() || null;
    const template = body.template ?? "empty";

    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id ?? null;

    let batchCode = nextBatchCode(batchType);
    let exists = await prisma.exportBatch.findUnique({ where: { batchCode } });
    while (exists) {
      batchCode = nextBatchCode(batchType);
      exists = await prisma.exportBatch.findUnique({ where: { batchCode } });
    }

    const columns = template === "kanban3" ? defaultColumns : [];
    const now = new Date();
    const id = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const batch = await prisma.exportBatch.create({
      data: {
        id,
        batchCode,
        batchType,
        customName,
        columns: JSON.stringify(columns),
        exportDate: now,
        updatedAt: now,
        createdById: userId,
      },
      include: {
        _count: { select: { items: true } },
        createdBy: { select: { fullName: true, email: true } },
      },
    });

    await createBatchAudit(batch.id, "BATCH_CREATED", {
      userId,
      userEmail: (session?.user as { email?: string })?.email,
      details: batchCode,
    });
    await triggerBatchChanged(batch.id);

    return NextResponse.json({
      id: batch.id,
      batchCode: batch.batchCode,
      batchType: batch.batchType,
      customName: batch.customName,
      frozenAt: null,
      exportDate: batch.exportDate ? new Date(batch.exportDate).toISOString() : batch.exportDate,
      _count: batch._count,
      createdBy: batch.createdBy,
    });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
