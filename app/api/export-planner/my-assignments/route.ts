/**
 * API: Export Planner - My assigned items (GET)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/get-session";

export async function GET(_request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ items: [] });

    const prisma = await getPrisma();

    const items = await prisma.exportBatchItem.findMany({
      where: { assignedToId: userId },
      orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        rn: true,
        engineNo: true,
        status: true,
        dueDate: true,
        batchId: true,
        batch: { select: { batchCode: true, customName: true } },
      },
    });

    const list = items.map((i) => ({
      id: i.id,
      rn: i.rn,
      engineNo: i.engineNo,
      status: i.status,
      dueDate: i.dueDate ? new Date(i.dueDate).toISOString() : null,
      batchId: i.batchId,
      batchCode: i.batch?.batchCode,
      customName: i.batch?.customName,
    }));

    return NextResponse.json({ items: list });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
