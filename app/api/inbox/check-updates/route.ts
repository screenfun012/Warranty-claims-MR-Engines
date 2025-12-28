/**
 * Lightweight endpoint to check if there are new emails
 * Returns only the count and last updated timestamp
 * GET /api/inbox/check-updates
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lastCheck = searchParams.get("lastCheck"); // ISO timestamp

    // Get the most recent thread update time
    const mostRecentThread = await prisma.emailThread.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        updatedAt: true,
        id: true,
      },
    });

    const lastUpdated = mostRecentThread?.updatedAt || new Date();
    const hasUpdates = lastCheck 
      ? new Date(lastUpdated) > new Date(lastCheck)
      : true; // If no lastCheck provided, assume there are updates

    // Count unread threads
    const unreadCount = await prisma.emailThread.count({
      where: {
        viewedAt: null,
        claimId: null,
      },
    });

    return NextResponse.json({
      hasUpdates,
      lastUpdated: lastUpdated.toISOString(),
      unreadCount,
      threadCount: await prisma.emailThread.count(),
    });
  } catch (error) {
    console.error("Error checking inbox updates:", error);
    return NextResponse.json(
      { error: "Failed to check updates" },
      { status: 500 }
    );
  }
}

