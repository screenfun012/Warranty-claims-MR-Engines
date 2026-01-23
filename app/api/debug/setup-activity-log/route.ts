import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { auth0 } from "@/lib/auth0";

/**
 * Debug endpoint to setup ActivityLog table and test logging
 * GET /api/debug/setup-activity-log - Check table status
 * POST /api/debug/setup-activity-log - Create table and test
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const prisma = await getPrisma();
    
    // Try to count activities
    let activityCount = 0;
    let tableExists = false;
    let error = null;
    
    try {
      activityCount = await prisma.activityLog.count();
      tableExists = true;
    } catch (e) {
      error = e instanceof Error ? e.message : "Unknown error";
      tableExists = false;
    }

    // Get recent activities if table exists
    let recentActivities: any[] = [];
    if (tableExists) {
      try {
        recentActivities = await prisma.activityLog.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
        });
      } catch (e) {
        // Ignore
      }
    }

    return NextResponse.json({
      tableExists,
      activityCount,
      error,
      recentActivities: recentActivities.map(a => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityName: a.entityName,
        userEmail: a.userEmail,
        createdAt: a.createdAt,
      })),
      currentUser: session.user.email,
    });
  } catch (error) {
    console.error("[Setup ActivityLog] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const prisma = await getPrisma();
    const results: string[] = [];

    // Step 1: Try to create table using raw SQL
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ActivityLog" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT,
          "userEmail" TEXT,
          "userName" TEXT,
          "action" TEXT NOT NULL,
          "entityType" TEXT NOT NULL,
          "entityId" TEXT,
          "entityName" TEXT,
          "details" TEXT,
          "ipAddress" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      results.push("✓ Table created or already exists");
    } catch (e) {
      results.push(`✗ Table creation failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    // Step 2: Create indexes
    const indexes = [
      { name: "ActivityLog_userId_idx", column: "userId" },
      { name: "ActivityLog_action_idx", column: "action" },
      { name: "ActivityLog_entityType_idx", column: "entityType" },
      { name: "ActivityLog_createdAt_idx", column: "createdAt" },
    ];

    for (const idx of indexes) {
      try {
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "${idx.name}" ON "ActivityLog"("${idx.column}")`
        );
        results.push(`✓ Index ${idx.name} created or exists`);
      } catch (e) {
        results.push(`✗ Index ${idx.name} failed: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    // Step 3: Test insert
    const testId = `test_${Date.now()}`;
    try {
      await prisma.activityLog.create({
        data: {
          id: testId,
          userEmail: session.user.email,
          userName: session.user.name || session.user.email.split("@")[0],
          action: "VIEW",
          entityType: "SYSTEM",
          entityName: "Activity Log Setup Test",
          details: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
        },
      });
      results.push(`✓ Test activity created with ID: ${testId}`);
    } catch (e) {
      results.push(`✗ Test insert failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    // Step 4: Verify
    let activityCount = 0;
    try {
      activityCount = await prisma.activityLog.count();
      results.push(`✓ Total activities in database: ${activityCount}`);
    } catch (e) {
      results.push(`✗ Count failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    return NextResponse.json({
      success: true,
      results,
      activityCount,
      message: "Setup complete! Refresh the admin panel to see activities.",
    });
  } catch (error) {
    console.error("[Setup ActivityLog] Error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
