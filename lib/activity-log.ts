import { getPrisma } from "@/lib/db/prisma";
import { auth0 } from "@/lib/auth0";
import { NextRequest } from "next/server";

export type ActivityAction = 
  | "CREATE" 
  | "UPDATE" 
  | "DELETE" 
  | "VIEW" 
  | "LOGIN" 
  | "LOGOUT" 
  | "UPLOAD" 
  | "DOWNLOAD"
  | "APPROVE"
  | "REJECT"
  | "LOCK"
  | "UNLOCK";

export type EntityType = 
  | "CLAIM" 
  | "EMAIL" 
  | "USER" 
  | "CUSTOMER" 
  | "ATTACHMENT" 
  | "DEPARTMENT"
  | "WORKER"
  | "COMPANY"
  | "SYSTEM";

export interface LogActivityParams {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  action: ActivityAction;
  entityType: EntityType;
  entityId?: string | null;
  entityName?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

// Cache to track if we've already tried to create the table
let tableSetupAttempted = false;

/**
 * Ensure ActivityLog table exists (create if missing)
 * This is a one-time setup that runs automatically
 */
async function ensureActivityLogTable(): Promise<void> {
  if (tableSetupAttempted) {
    return; // Already tried, don't retry on every call
  }
  
  try {
    const prisma = await getPrisma();
    
    // Try to create table if it doesn't exist
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
    
    // Create indexes
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
      } catch (e) {
        // Index might already exist, ignore
      }
    }
    
    console.log("[ActivityLog] Table and indexes ensured");
    tableSetupAttempted = true;
  } catch (error) {
    console.error("[ActivityLog] Failed to ensure table:", error);
    // Don't set tableSetupAttempted = true so we can retry
  }
}

/**
 * Log an activity to the database
 * This function is designed to be non-blocking and won't throw errors
 * Automatically creates the table if it doesn't exist
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    // Ensure table exists first
    await ensureActivityLogTable();
    
    const prisma = await getPrisma();
    
    console.log("[ActivityLog] Attempting to log activity:", {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
    });
    
    const result = await prisma.activityLog.create({
      data: {
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        userName: params.userName || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        entityName: params.entityName || null,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress || null,
      },
    });
    
    console.log("[ActivityLog] Successfully logged activity:", result.id);
  } catch (error) {
    // If it's a "table doesn't exist" error, try to create it and retry once
    if (error instanceof Error && (
      error.message.includes("does not exist") ||
      error.message.includes("no such table") ||
      error.message.includes("ActivityLog")
    )) {
      console.log("[ActivityLog] Table missing, attempting to create...");
      tableSetupAttempted = false; // Reset to allow retry
      try {
        await ensureActivityLogTable();
        // Retry the insert
        const prisma = await getPrisma();
        const result = await prisma.activityLog.create({
          data: {
            userId: params.userId || null,
            userEmail: params.userEmail || null,
            userName: params.userName || null,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId || null,
            entityName: params.entityName || null,
            details: params.details ? JSON.stringify(params.details) : null,
            ipAddress: params.ipAddress || null,
          },
        });
        console.log("[ActivityLog] Successfully logged activity after table creation:", result.id);
        return;
      } catch (retryError) {
        console.error("[ActivityLog] Failed to log activity after retry:", retryError);
      }
    }
    
    // Log error but don't throw - activity logging should never break main functionality
    console.error("[ActivityLog] Failed to log activity:", error);
    if (error instanceof Error) {
      console.error("[ActivityLog] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
  }
}

/**
 * Get user info from Auth0 session
 * IMPORTANT: userId should be from User table (database ID), not Auth0 sub
 */
export async function getUserFromSession(request: NextRequest): Promise<{
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  ipAddress: string | null;
}> {
  try {
    const session = await auth0.getSession(request);
    
    // Try to get IP address from various headers
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || null;
    
    console.log("[ActivityLog] Getting user from session:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      auth0Sub: session?.user?.sub,
    });
    
    if (session?.user?.email) {
      // Find user in database by email to get the correct User.id
      const prisma = await getPrisma();
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, fullName: true },
      });
      
      const userInfo = {
        userId: dbUser?.id || null, // Use database User.id, not Auth0 sub
        userEmail: session.user.email || null,
        userName: dbUser?.fullName || session.user.name || session.user.email?.split("@")[0] || null,
        ipAddress,
      };
      console.log("[ActivityLog] User info extracted:", {
        ...userInfo,
        dbUserFound: !!dbUser,
      });
      return userInfo;
    }
    
    console.log("[ActivityLog] No user session found");
    return {
      userId: null,
      userEmail: null,
      userName: null,
      ipAddress,
    };
  } catch (error) {
    console.error("[ActivityLog] Error getting user from session:", error);
    if (error instanceof Error) {
      console.error("[ActivityLog] Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    return {
      userId: null,
      userEmail: null,
      userName: null,
      ipAddress: null,
    };
  }
}

/**
 * Log activity with automatic user detection from request
 */
export async function logActivityFromRequest(
  request: NextRequest,
  params: Omit<LogActivityParams, "userId" | "userEmail" | "userName" | "ipAddress">
): Promise<void> {
  const userInfo = await getUserFromSession(request);
  await logActivity({
    ...params,
    ...userInfo,
  });
}
