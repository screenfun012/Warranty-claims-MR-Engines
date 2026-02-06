/**
 * PATCH /api/notifications/[id] – mark notification as read
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { getPrisma } from "@/lib/db/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const { id } = await params;
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.warn("[PATCH /api/notifications]", err);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
