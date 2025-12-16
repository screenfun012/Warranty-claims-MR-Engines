import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    // Count unread email threads (threads that haven't been viewed/opened and are not linked to a claim)
    // Use findMany with select for better SQLite compatibility
    const unreadThreads = await prisma.emailThread.findMany({
      where: {
        viewedAt: null,
        claimId: null,
      },
      select: {
        id: true,
      },
    });

    const unreadCount = unreadThreads.length;

    return NextResponse.json({ count: unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    
    // Return 0 instead of error to prevent UI breaking
    console.warn("Returning 0 as safe default due to error:", errorMessage);
    return NextResponse.json({ count: 0 });
  }
}

