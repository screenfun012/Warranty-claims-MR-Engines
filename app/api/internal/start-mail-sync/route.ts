/**
 * Samo za start aplikacije – pokreće mail sync (IDLE/polling) bez auth.
 * Poziva instrumentation.ts nakon podizanja servera. Middleware propušta ovu rutu.
 */
import { NextResponse } from "next/server";
import { ensureIdleStarted } from "@/lib/email/mailSyncScheduler";

export async function GET() {
  try {
    ensureIdleStarted();
    return NextResponse.json({ ok: true, message: "Mail sync started" });
  } catch (error) {
    console.warn("[internal/start-mail-sync]", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
