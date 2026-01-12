import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    // Count unread email threads (threads that haven't been viewed/opened and are not linked to a claim)
    // Use count() for better performance and SQLite compatibility
    const unreadCount = await prisma.emailThread.count({
      where: {
        viewedAt: null,
        claimId: null,
      },
    }).catch((dbError) => {
      console.error("Database error in unread count:", dbError);
      throw dbError;
    });

    return NextResponse.json({ count: unreadCount }, { status: 200 });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { errorMessage, errorStack });
    
    // Return 0 instead of error to prevent UI breaking
    // Make sure to return 200 status, not 500
    console.warn("Returning 0 as safe default due to error:", errorMessage);
    try {
      return NextResponse.json({ count: 0 }, { status: 200 });
    } catch (responseError) {
      // If even creating the response fails, log it
      console.error("Failed to create error response:", responseError);
      // Return a simple text response as last resort
      return new NextResponse(JSON.stringify({ count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}

