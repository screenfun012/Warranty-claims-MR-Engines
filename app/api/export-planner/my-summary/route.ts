/**
 * API: Export Planner - My summary (assignedCount, lateCount) za sidebar
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
    if (!userId) {
      return NextResponse.json({ assignedCount: 0, lateCount: 0 });
    }

    const prisma = await getPrisma();
    const db = prisma as any;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assigned = await db.exportBatchItem.count({
      where: { assignedToId: userId },
    });

    const late = await db.exportBatchItem.count({
      where: {
        assignedToId: userId,
        dueDate: { lt: today },
        status: { not: "IZVOZ" },
      },
    });

    return NextResponse.json({ assignedCount: assigned, lateCount: late });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
