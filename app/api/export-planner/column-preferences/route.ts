/**
 * GET - Redosled kolona po korisniku za batchType
 * PUT - Sačuvaj redosled (body: { batchType, columnOrder: string[] })
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/get-session";

async function getCurrentUserId() {
  const session = await getSession();
  const sessionEmail = (session?.user as { email?: string })?.email;
  if (!sessionEmail) return null;
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { email: sessionEmail },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const batchType = request.nextUrl.searchParams.get("batchType");
    if (!batchType) {
      return NextResponse.json({ columnOrder: null });
    }
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ columnOrder: null });
    }
    const prisma = await getPrisma();
    const pref = await prisma.exportPlannerColumnPreference.findUnique({
      where: { userId_batchType: { userId, batchType } },
      select: { columnOrder: true },
    });
    let columnOrder: string[] | null = null;
    if (pref?.columnOrder) {
      try {
        columnOrder = JSON.parse(pref.columnOrder) as string[];
      } catch {
        columnOrder = null;
      }
    }
    return NextResponse.json({ columnOrder });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_EDIT);
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const batchType = body.batchType as string;
    const columnOrder = body.columnOrder as string[];
    if (!batchType || !Array.isArray(columnOrder)) {
      return NextResponse.json({ error: "batchType and columnOrder (array) required" }, { status: 400 });
    }
    const prisma = await getPrisma();
    await prisma.exportPlannerColumnPreference.upsert({
      where: { userId_batchType: { userId, batchType } },
      create: { userId, batchType, columnOrder: JSON.stringify(columnOrder) },
      update: { columnOrder: JSON.stringify(columnOrder) },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
