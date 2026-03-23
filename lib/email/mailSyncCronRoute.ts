/**
 * Deljeni handler za periodični mail sync (cron / GitHub Actions).
 */
import { NextResponse } from "next/server";
import { syncNewEmails } from "@/lib/email/mailSyncService";
import { isEmailConfigured } from "@/lib/config/envLoader";
import { env } from "@/lib/config/env";

export async function handleMailSyncCronGet(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[mail-sync cron] CRON_SECRET nije postavljen u env");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!env.MAIL_SYNC_ENABLED) {
    return NextResponse.json({ ok: true, skipped: true, reason: "MAIL_SYNC_ENABLED=false" });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: false,
      error: "IMAP nije konfigurisan (IMAP_SERVER, IMAP_USER_EMAIL, IMAP_USER_PASS)",
    });
  }

  try {
    const result = await syncNewEmails();
    console.log(
      `[mail-sync cron] OK: +${result.newMessages} poruka, +${result.newThreads} threadova`
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[mail-sync cron]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
