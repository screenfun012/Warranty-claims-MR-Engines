/**
 * GET - Trenutni korisnik (DB User.id) za planer – rezolucija po session email
 */

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/get-session";

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.EXPORT_PLANNER_READ);
    const session = await getSession();
    const sessionEmail = (session?.user as { email?: string })?.email;
    if (!sessionEmail) {
      return NextResponse.json({ id: null });
    }
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: sessionEmail },
      select: { id: true },
    });
    return NextResponse.json({ id: user?.id ?? null });
  } catch (error) {
    const { status, message } = createPermissionError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
