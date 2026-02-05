/**
 * API: Export Planner - List and create batches
 * GET - List all batches (EXPORT_PLANNER_READ)
 * POST - Create new batch (EXPORT_PLANNER_EDIT)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { createBatchAudit, triggerBatchChanged } from "@/lib/export-planner/utils";
import { getSession } from "@/lib/auth/get-session";

// Šabloni kolona
const MR_ENGINES_COLUMNS = [
  { id: "PLANIRANO", label: "Planirano", order: 0, color: "blue" },
  { id: "RAD", label: "U radu", order: 1, color: "amber" },
  { id: "IZVOZ", label: "Izvoz", order: 2, color: "green" },
];

const GENERIC_EMPTY: typeof MR_ENGINES_COLUMNS = [];
const GENERIC_KANBAN3 = [
  { id: "TODO", label: "To Do", order: 0, color: "slate" },
  { id: "IN_PROGRESS", label: "In progress", order: 1, color: "amber" },
  { id: "DONE", label: "Done", order: 2, color: "green" },
];

function generateBatchCode(batchType: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = batchType === "MR_ENGINES" ? "EXO" : "GNR";
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `EXP-${date}-${rand}${suffix}`;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const prisma = await getPrisma();
    const batchType = request.nextUrl.searchParams.get("batchType"); // MR_ENGINES | GENERIC
    const mine = request.nextUrl.searchParams.get("mine") === "1";

    let createdById: string | null = null;
    if (mine) {
      const session = await getSession();
      const sessionEmail = (session?.user as { email?: string })?.email;
      if (sessionEmail) {
        const dbUser = await prisma.user.findUnique({
          where: { email: sessionEmail },
          select: { id: true },
        });
        createdById = dbUser?.id ?? null;
      }
    }

    if (mine && !createdById) {
      return NextResponse.json([]);
    }

    const where: { batchType?: string; createdById?: string } = {};
    if (batchType) where.batchType = batchType as string;
    if (mine && createdById) where.createdById = createdById;

    const batches = await prisma.exportBatch.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: [{ exportDate: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { items: true } },
        createdBy: { select: { fullName: true, email: true } },
      },
    });

    const batchIds = batches.map((b) => b.id);
    const exportCounts = await prisma.exportBatchItem.groupBy({
      by: ["batchId"],
      where: { batchId: { in: batchIds }, status: "IZVOZ" },
      _count: { id: true },
    });
    const exportMap = new Map(exportCounts.map((e) => [e.batchId, e._count.id]));

    const withExportCount = batches.map((b) => ({
      ...b,
      exportCount: b.batchType === "MR_ENGINES" ? (exportMap.get(b.id) ?? 0) : 0,
    }));

    return NextResponse.json(withExportCount);
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
    const template = (body.template as string) || "default"; // default | empty | kanban3

    const batchCode = generateBatchCode(batchType);
    let columns: string;
    if (batchType === "MR_ENGINES") {
      columns = JSON.stringify(MR_ENGINES_COLUMNS);
    } else {
      if (template === "kanban3") {
        columns = JSON.stringify(GENERIC_KANBAN3);
      } else if (body.columns != null) {
        columns = typeof body.columns === "string" ? body.columns : JSON.stringify(body.columns);
      } else {
        columns = JSON.stringify(GENERIC_EMPTY);
      }
    }

    const session = await getSession();
    // createdById must reference User.id (cuid), not Auth0 sub – resolve by email or leave null
    let createdById: string | null = null;
    const sessionEmail = (session?.user as { email?: string })?.email;
    if (sessionEmail) {
      const dbUser = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true },
      });
      createdById = dbUser?.id ?? null;
    }

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

    await createBatchAudit(batch.id, "CREATED", {
      userId: createdById,
      userEmail: (session?.user as { email?: string })?.email,
      details: JSON.stringify({ batchCode, customName }),
    });
    await triggerBatchChanged(batch.id);

    return NextResponse.json(batch);
  } catch (error) {
    const { status, message } = createPermissionError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
