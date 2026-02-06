/**
 * GET - Export batch items as CSV
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);

    const prisma = await getPrisma();
    const { id } = await params;
    const batch = await (prisma as any).exportBatch.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { assignedTo: { select: { fullName: true, email: true } } },
        },
      },
    });

    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

    const headers = ["RN", "Engine No", "Engine Type", "MR Code", "Status", "Start", "Due", "Assigned", "Details"];
    const rows = batch.items.map((i: any) => [
      escapeCsv(i.rn),
      escapeCsv(i.engineNo),
      escapeCsv(i.engineType),
      escapeCsv(i.mrCode),
      escapeCsv(i.status),
      escapeCsv(i.startDate ? new Date(i.startDate).toISOString().slice(0, 10) : null),
      escapeCsv(i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : null),
      escapeCsv(i.assignedTo?.fullName ?? i.assignedTo?.email ?? null),
      escapeCsv(i.details),
    ]);
    const csv = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");
    const bom = "\uFEFF";

    return new NextResponse(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${(batch.customName || batch.batchCode).replace(/[^a-zA-Z0-9-_]/g, "-")}.csv"`,
      },
    });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
