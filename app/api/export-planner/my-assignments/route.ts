/**
 * GET - Liste u kojima je trenutni korisnik dodeljen na stavke
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/get-session";

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ batches: [], items: [] });
    }
    const items = await prisma.exportBatchItem.findMany({
      where: { assignedToId: userId },
      include: {
        batch: {
          select: {
            id: true,
            batchCode: true,
            customName: true,
            batchType: true,
            exportDate: true,
            frozenAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const batchIds = [...new Set(items.map((i) => i.batchId))];
    const batches = await prisma.exportBatch.findMany({
      where: { id: { in: batchIds } },
      select: {
        id: true,
        batchCode: true,
        customName: true,
        batchType: true,
        exportDate: true,
        frozenAt: true,
        _count: { select: { items: true } },
      },
    });

    const uniqueBatches = batches.map((b) => ({
      ...b,
      myAssignedCount: items.filter((i) => i.batchId === b.id).length,
    }));

    return NextResponse.json({
      batches: uniqueBatches,
      items,
    });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
