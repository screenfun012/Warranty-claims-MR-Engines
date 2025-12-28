import { NextResponse } from "next/server";
import { startIdleSync, isIdleSyncActive, isUsingIdleMode } from "@/lib/email/mailSyncScheduler";
import { getImapIdleClient } from "@/lib/email/imapIdleClient";

export async function POST() {
  try {
    // Always restart sync to ensure it's running
    // This will reset reconnect attempts if IDLE failed
    await startIdleSync();
    
    const usingIdle = isUsingIdleMode();
    const mode = usingIdle ? "IDLE (real-time push)" : "Polling (every 30 seconds)";
    
    return NextResponse.json({
      success: true,
      message: `Automatic email sync started - ${mode}`,
      mode,
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
    const active = isIdleSyncActive();
    const usingIdle = isUsingIdleMode();
    const idleClient = getImapIdleClient();
    const reconnectAttempts = idleClient.getReconnectAttempts();
    
    return NextResponse.json({
      active,
      usingIdle,
      idleActive: idleClient.isIdleActive(),
      reconnectAttempts,
      mode: usingIdle ? "IDLE (real-time push)" : "Polling (every 30 seconds)",
    });
  } catch (error) {
    return NextResponse.json(
      {
        active: false,
        usingIdle: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

