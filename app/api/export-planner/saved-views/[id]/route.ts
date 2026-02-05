/**
 * DELETE - Brisanje sačuvanog prikaza (samo svoj)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const { id } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const prisma = await getPrisma();
    const view = await prisma.exportPlannerSavedView.findFirst({
      where: { id, userId },
    });
    if (!view) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.exportPlannerSavedView.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { status, message } = createPermissionError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
