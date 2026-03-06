import { NextResponse } from "next/server";
import { startIdleSync, isIdleSyncActive, isUsingIdleMode } from "@/lib/email/mailSyncScheduler";

/**
 * POST: Start mail sync (IDLE ako je uključen, inače polling 15s).
 * GET: Da li je sync aktivan i da li radi IDLE ili polling.
 */
export async function POST() {
  try {
    await startIdleSync();
    const usingIdle = await isUsingIdleMode();
    const mode = usingIdle
      ? "IDLE (real-time) + backup polling 30s"
      : "Polling (every 15 seconds)";
    return NextResponse.json({
      success: true,
      message: `Mail sync started - ${mode}`,
      mode,
    });
  } catch (error) {
    console.error("Error starting mail sync:", error);
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
    const usingIdle = await isUsingIdleMode();
    let idleActive = false;
    let reconnectAttempts = 0;
    if (usingIdle) {
      try {
        const { getImapIdleClient } = await import("@/lib/email/imapIdleClient");
        const client = getImapIdleClient();
        idleActive = client.isIdleActive();
        reconnectAttempts = client.getReconnectAttempts();
      } catch {
        // ignore
      }
    }
    return NextResponse.json({
      active,
      usingIdle,
      idleActive,
      reconnectAttempts,
      mode: usingIdle
        ? "IDLE (real-time) + backup polling 30s"
        : "Polling (every 15 seconds)",
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
