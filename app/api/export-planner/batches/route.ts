/**
 * API: Export Planner - List and create batches
 * GET - List all batches (EXPORT_PLANNER_READ)
 * POST - Create new batch (EXPORT_PLANNER_EDIT)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

const MR_ENGINES_COLUMNS = [
  { id: "PLANIRANO", label: "U planu", order: 0, color: "slate" },
  { id: "RAD", label: "U radu", order: 1, color: "blue" },
  { id: "IZVOZ", label: "Izvoz", order: 2, color: "green" },
];

function generateBatchCode(batchType: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = batchType === "MR_ENGINES" ? "EXO" : "GNR";
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `EXP-${date}-${rand}${suffix}`;
}

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const prisma = await getPrisma();

    const batches = await prisma.exportBatch.findMany({
      orderBy: [{ exportDate: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { items: true } },
        createdBy: { select: { fullName: true, email: true } },
      },
    });

    return NextResponse.json(batches);
  } catch (error) {
    const { status, message } = createPermissionError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_EDIT);
    const prisma = await getPrisma();
    const body = await request.json();

    const batchType = (body.batchType as string) || "MR_ENGINES";
    const customName = (body.customName as string) || null;

    const batchCode = generateBatchCode(batchType);
    const columns =
      batchType === "MR_ENGINES"
        ? JSON.stringify(MR_ENGINES_COLUMNS)
        : body.columns || JSON.stringify([{ id: "todo", label: "To Do", order: 0, color: "slate" }]);

    const session = await import("@/lib/auth/get-session").then((m) => m.getSession());
    const createdById = (session?.user as { id?: string })?.id ?? null;

    const batch = await prisma.exportBatch.create({
      data: {
        batchCode,
        batchType,
        customName,
        customFields: batchType === "GENERIC" ? body.customFields ?? null : null,
        columns,
        exportDate: new Date(),
        createdById,
      },
      include: {
        _count: { select: { items: true } },
        createdBy: { select: { fullName: true, email: true } },
      },
    });

    return NextResponse.json(batch);
  } catch (error) {
    const { status, message } = createPermissionError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
