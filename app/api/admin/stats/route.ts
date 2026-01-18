import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { isEmailConfigured } from "@/lib/config/envLoader";

export async function GET(request: NextRequest) {
  try {
    // Only SUPER_ADMIN can view admin stats
    await requirePermission(PERMISSIONS.ADMIN_USERS);
  } catch (error) {
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Greška pri učitavanju statistika" },
      { status: 500 }
    );
  }

  try {
    const prisma = await getPrisma();
    
    // Get user stats
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: { active: true },
    });

    // Get claims stats
    const totalClaims = await prisma.claim.count();

    // Get unread emails
    const unreadEmails = await prisma.emailThread.count({
      where: {
        viewedAt: null,
      },
    });

    // Check email configuration
    const emailConfigured = isEmailConfigured();

    // Check database status (try a simple query)
    let databaseStatus = "Connected";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      databaseStatus = "Error";
    }

    const stats = {
      totalUsers,
      activeUsers,
      totalClaims,
      unreadEmails,
      emailConfigured,
      databaseStatus,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju statistika" },
      { status: 500 }
    );
  }
}