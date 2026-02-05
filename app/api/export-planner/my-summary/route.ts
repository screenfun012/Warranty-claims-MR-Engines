/**
 * GET - Sažetak za trenutnog korisnika: broj dodeljenih i broj kasnih stavki (za badge u sidebaru)
 */

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/get-session";

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const prisma = await getPrisma();

    const session = await getSession();
    const sessionEmail = (session?.user as { email?: string })?.email;
    let userId: string | null = null;
    if (sessionEmail) {
      const dbUser = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true },
      });
      userId = dbUser?.id ?? null;
    }
    if (!userId) {
      return NextResponse.json({ assignedCount: 0, lateCount: 0 });
    }

    const items = await prisma.exportBatchItem.findMany({
      where: { assignedToId: userId },
      select: { id: true, dueDate: true },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lateCount = items.filter((i) => {
      if (!i.dueDate) return false;
      const due = new Date(i.dueDate);
      due.setHours(0, 0, 0, 0);
      return due < todayStart;
    }).length;

    return NextResponse.json({
      assignedCount: items.length,
      lateCount,
    });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
