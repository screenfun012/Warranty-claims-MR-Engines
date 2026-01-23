import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { auth0 } from "@/lib/auth0";

/**
 * Debug endpoint to check activity logs and user data
 * GET /api/debug/activity-check
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    
    // Only allow authenticated users
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const prisma = await getPrisma();

    // Get activity count and recent activities
    const [activityCount, recentActivities, allUsers, targetUser] = await Promise.all([
      prisma.activityLog.count(),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          active: true,
          approved: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findUnique({
        where: { email: "natasa.stefanovic@mrgroup.rs" },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          active: true,
          approved: true,
        },
      }),
    ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      currentUser: session.user.email,
      activityLog: {
        totalCount: activityCount,
        recentActivities: recentActivities.map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entityType,
          entityName: a.entityName,
          userEmail: a.userEmail,
          userName: a.userName,
          createdAt: a.createdAt,
        })),
      },
      users: {
        totalCount: allUsers.length,
        list: allUsers,
      },
      targetUser: {
        email: "natasa.stefanovic@mrgroup.rs",
        found: !!targetUser,
        data: targetUser,
      },
    });
  } catch (error) {
    console.error("[Debug Activity Check] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to check activity", 
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST to create a test activity
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const prisma = await getPrisma();

    // Find user in database
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    // Create test activity
    const activity = await prisma.activityLog.create({
      data: {
        userId: dbUser?.id || null,
        userEmail: session.user.email,
        userName: session.user.name || session.user.email.split("@")[0],
        action: "VIEW",
        entityType: "SYSTEM",
        entityId: null,
        entityName: "Test Activity",
        details: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Test activity created",
      activity: {
        id: activity.id,
        action: activity.action,
        entityType: activity.entityType,
        entityName: activity.entityName,
        userEmail: activity.userEmail,
        createdAt: activity.createdAt,
      },
    });
  } catch (error) {
    console.error("[Debug Activity Check] Error creating test activity:", error);
    return NextResponse.json(
      { 
        error: "Failed to create test activity", 
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
