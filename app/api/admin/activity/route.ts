import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    // Only SUPER_ADMIN can view activity logs
    await requirePermission(PERMISSIONS.ADMIN_USERS);
  } catch (error) {
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json(
      { error: "Greška pri učitavanju aktivnosti" },
      { status: 500 }
    );
  }

  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const userId = searchParams.get("userId");

    console.log("[ActivityAPI] Fetching activities with params:", {
      limit,
      offset,
      action,
      entityType,
      userId,
    });

    // Build where clause
    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;

    // Fetch activities
    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count({ where }),
    ]);

    console.log("[ActivityAPI] Found activities:", {
      count: activities.length,
      total,
      activities: activities.map(a => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityName: a.entityName,
        userName: a.userName,
        createdAt: a.createdAt,
      })),
    });

    // Parse details JSON for each activity
    const activitiesWithDetails = activities.map((activity) => ({
      ...activity,
      details: activity.details ? JSON.parse(activity.details) : null,
    }));

    return NextResponse.json({
      activities: activitiesWithDetails,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[ActivityAPI] Error fetching activity logs:", error);
    
    if (error instanceof Error) {
      console.error("[ActivityAPI] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    
    // If table doesn't exist yet, return empty array
    if (error instanceof Error && (
      error.message.includes("no such table") ||
      error.message.includes("does not exist") ||
      error.message.includes("Unknown table")
    )) {
      console.log("[ActivityAPI] ActivityLog table does not exist, returning empty array");
      return NextResponse.json({
        activities: [],
        total: 0,
        limit: 50,
        offset: 0,
      });
    }
    
    return NextResponse.json(
      { error: "Greška pri učitavanju aktivnosti" },
      { status: 500 }
    );
  }
}
