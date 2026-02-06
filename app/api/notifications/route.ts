/**
 * GET /api/notifications – list notifications for the current user (unread first, limit 20)
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { getPrisma } from "@/lib/db/prisma";

export async function GET() {
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
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: 50,
    });
    const unreadCount = notifications.filter((n: { readAt: unknown }) => !n.readAt).length;
    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    console.warn("[GET /api/notifications]", err);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
