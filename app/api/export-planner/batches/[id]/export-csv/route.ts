/**
 * GET - Export batch as CSV (MR_ENGINES i GENERIC)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

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
      include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });

    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

    const isMr = batch.batchType === "MR_ENGINES";
    // Izvoz šablon: MR Code, RN, Kod motora, Tip motora, OK (kao u PDF-u – radnik štampa i čekira)
    const headers = isMr
      ? ["MR Code", "RN", "Kod motora", "Tip motora", "OK"]
      : ["RN", "Opis", "Status", "Prioritet", "Početak", "Rok", "Detalji"];

    const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString("sr-RS") : "");
    const rows = batch.items.map((i) => {
      const base = isMr
        ? [i.mrCode || "", i.rn, i.engineNo, i.engineType || "", i.qcOk ? "DA" : ""]
        : [i.rn, i.engineNo, i.status, i.priority || "", fmtDate(i.startDate), fmtDate(i.dueDate), i.details || ""];
      if (!isMr && i.customData) {
        try {
          const parsed = JSON.parse(i.customData) as Record<string, string>;
          Object.values(parsed).forEach((v) => base.push(String(v ?? "")));
        } catch {
          base.push(i.customData);
        }
      }
      return base.map(escapeCsv).join(",");
    });

    let customHeaders: string[] = [];
    if (!isMr) {
      const firstWithCustom = batch.items.find((i) => i.customData);
      if (firstWithCustom?.customData) {
        try {
          const parsed = JSON.parse(firstWithCustom.customData) as Record<string, string>;
          customHeaders = Object.keys(parsed);
        } catch {
          //
        }
      }
    }

    const headerRow = [...headers, ...customHeaders].map(escapeCsv).join(",");
    const csv = [headerRow, ...rows].join("\n");
    const filename = `batch-${batch.batchCode}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
