/**
 * GET - PDF "Plan izvoza" za Dadu (Lista motora) - sa checkbox kolonom
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { renderToBuffer } from "@react-pdf/renderer";
import { DadoListPdf } from "@/lib/export-planner/pdf-templates";

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
    if (batch.batchType !== "MR_ENGINES") return NextResponse.json({ error: "Only for MR Engines batches" }, { status: 400 });

    const exportDate = batch.exportDate instanceof Date ? batch.exportDate.toISOString() : String(batch.exportDate);
    const loadTime = batch.loadTime ? (batch.loadTime instanceof Date ? batch.loadTime.toISOString() : String(batch.loadTime)) : null;
    const pdfElement = DadoListPdf({
      batch: {
        batchCode: batch.batchCode,
        customName: batch.customName,
        exportDate,
        loadTime,
        items: batch.items.map((i) => ({ id: i.id, rn: i.rn, engineNo: i.engineNo, engineType: i.engineType, mrCode: i.mrCode, status: i.status, qcOk: i.qcOk })),
      },
    });

    const buffer = await renderToBuffer(pdfElement as Parameters<typeof renderToBuffer>[0]);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="lista-motora-${batch.batchCode}.pdf"`,
      },
    });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
