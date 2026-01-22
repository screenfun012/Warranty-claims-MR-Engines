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
    
    await prisma.activityLog.create({
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
  } catch (error) {
    // Log error but don't throw - activity logging should never break main functionality
    console.error("Failed to log activity:", error);
  }
}

/**
 * Get user info from Auth0 session
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
    
    if (session?.user) {
      return {
        userId: session.user.sub || null,
        userEmail: session.user.email || null,
        userName: session.user.name || session.user.email?.split("@")[0] || null,
        ipAddress,
      };
    }
    
    return {
      userId: null,
      userEmail: null,
      userName: null,
      ipAddress,
    };
  } catch (error) {
    console.error("Error getting user from session for activity log:", error);
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
