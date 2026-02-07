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
    const email = (session?.user as { email?: string })?.email;
    if (!email) {
      return NextResponse.json({ assignedCount: 0, lateCount: 0 });
    }

    const prisma = await getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!dbUser) return NextResponse.json({ assignedCount: 0, lateCount: 0 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assigned = await prisma.exportBatchItem.count({
      where: { assignedToId: dbUser.id },
    });

    const late = await prisma.exportBatchItem.count({
      where: {
        assignedToId: dbUser.id,
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
