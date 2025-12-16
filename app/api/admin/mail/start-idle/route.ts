import { NextResponse } from "next/server";
import { startIdleSync, isIdleSyncActive } from "@/lib/email/mailSyncScheduler";

export async function POST() {
  try {
    // Check if already active
    if (isIdleSyncActive()) {
      return NextResponse.json({
        success: true,
        message: "Automatic email sync is already active",
      });
    }

    await startIdleSync();
    return NextResponse.json({
      success: true,
      message: "Automatic email sync started (checking every 2 minutes)",
    });
  } catch (error) {
    console.error("Error starting automatic email sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      active: isIdleSyncActive(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        active: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

