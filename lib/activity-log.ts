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

/**
 * Log an activity to the database
 * This function is designed to be non-blocking and won't throw errors
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
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
