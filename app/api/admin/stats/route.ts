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
    const pendingApproval = await prisma.user.count({
      where: { approved: false },
    });

    // Get claims stats
    const totalClaims = await prisma.claim.count();
    const newClaims = await prisma.claim.count({ where: { status: "NEW" } });
    const inAnalysisClaims = await prisma.claim.count({ where: { status: "IN_ANALYSIS" } });
    const approvedClaims = await prisma.claim.count({ where: { status: "APPROVED" } });
    const rejectedClaims = await prisma.claim.count({ where: { status: "REJECTED" } });

    // Get unread emails
    const unreadEmails = await prisma.emailThread.count({
      where: { viewedAt: null },
    });
    const totalEmails = await prisma.emailThread.count();

    // Get other counts
    const totalCustomers = await prisma.customer.count();
    const totalAttachments = await prisma.attachment.count();
    const totalDepartments = await prisma.department.count();

    // Get recent activity (last 10 claims)
    const recentClaims = await prisma.claim.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        claimCodeRaw: true,
        status: true,
        createdAt: true,
        customer: {
          select: { company: true, name: true },
        },
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
      // User stats
      totalUsers,
      activeUsers,
      pendingApproval,
      
      // Claim stats
      totalClaims,
      claimsByStatus: {
        NEW: newClaims,
        IN_ANALYSIS: inAnalysisClaims,
        APPROVED: approvedClaims,
        REJECTED: rejectedClaims,
      },
      
      // Email stats
      unreadEmails,
      totalEmails,
      
      // Other stats
      totalCustomers,
      totalAttachments,
      totalDepartments,
      
      // Recent activity
      recentActivity: recentClaims.map(c => ({
        id: c.id,
        code: c.claimCodeRaw,
        status: c.status,
        customer: c.customer?.company || c.customer?.name || "N/A",
        createdAt: c.createdAt,
      })),
      
      // System status
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