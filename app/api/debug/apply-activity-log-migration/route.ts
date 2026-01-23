import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { auth0 } from "@/lib/auth0";

/**
 * Debug endpoint to apply ActivityLog migration directly to Turso
 * POST /api/debug/apply-activity-log-migration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const prisma = await getPrisma();
    const results: string[] = [];

    // Apply migration SQL directly
    const migrationSQL = `
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
      );

      CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx" ON "ActivityLog"("userId");
      CREATE INDEX IF NOT EXISTS "ActivityLog_action_idx" ON "ActivityLog"("action");
      CREATE INDEX IF NOT EXISTS "ActivityLog_entityType_idx" ON "ActivityLog"("entityType");
      CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
    `;

    try {
      // Split by semicolon and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        try {
          await prisma.$executeRawUnsafe(statement);
          results.push(`✓ Executed: ${statement.substring(0, 50)}...`);
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : "Unknown error";
          // Ignore "already exists" errors
          if (errorMsg.includes("already exists") || errorMsg.includes("duplicate")) {
            results.push(`⚠ Skipped (already exists): ${statement.substring(0, 50)}...`);
          } else {
            results.push(`✗ Failed: ${statement.substring(0, 50)}... - ${errorMsg}`);
          }
        }
      }

      // Verify table exists
      let activityCount = 0;
      try {
        activityCount = await prisma.activityLog.count();
        results.push(`✓ Table verified - ${activityCount} activities found`);
      } catch (e) {
        results.push(`✗ Table verification failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      }

      return NextResponse.json({
        success: true,
        results,
        activityCount,
        message: "Migration applied! Try creating a claim now and check the activity log.",
      });
    } catch (error) {
      console.error("[Apply Migration] Error:", error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          results,
          stack: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Apply Migration] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
