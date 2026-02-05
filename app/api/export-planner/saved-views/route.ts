/**
 * GET - Lista sačuvanih prikaza trenutnog korisnika
 * POST - Kreiranje novog sačuvanog prikaza
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/get-session";

async function getCurrentUserId(request: NextRequest) {
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
    const prisma = await getPrisma();
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json([]);
    }
    const views = await prisma.exportPlannerSavedView.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(views);
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const prisma = await getPrisma();
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const name = (body.name as string)?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const batchType = (body.batchType as string) || null;
    const mineOnly = Boolean(body.mineOnly);
    const sortBy = ["dateDesc", "dateAsc", "nameAsc"].includes(body.sortBy) ? body.sortBy : "dateDesc";

    const view = await prisma.exportPlannerSavedView.create({
      data: { userId, name, batchType, mineOnly, sortBy },
    });
    return NextResponse.json(view);
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
