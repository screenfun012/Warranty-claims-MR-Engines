import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { ensureIdleStarted } from "@/lib/email/mailSyncScheduler";
import { countEffectivelyUnreadThreads } from "@/lib/inbox/effectiveUnread";

export async function GET() {
  try {
    ensureIdleStarted();
    const prisma = await getPrisma();
    
    // Outlook-style: never opened OR new message after last viewedAt (all threads)
    const unreadCount = await countEffectivelyUnreadThreads(prisma).catch((dbError) => {
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

