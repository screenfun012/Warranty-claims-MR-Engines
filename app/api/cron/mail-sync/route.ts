/**
 * Vercel Cron Job — periodični IMAP sync bez korisničke sesije.
 *
 * Podesi u Vercel Dashboard → Environment Variables:
 *   CRON_SECRET=<jak nasumičan string>
 *
 * Vercel automatski šalje: Authorization: Bearer <CRON_SECRET>
 * @see https://vercel.com/docs/cron-jobs
 */

import { NextResponse } from "next/server";
import { syncNewEmails } from "@/lib/email/mailSyncService";
import { isEmailConfigured } from "@/lib/config/envLoader";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/mail-sync] CRON_SECRET nije postavljen u env");
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
      `[cron/mail-sync] OK: +${result.newMessages} poruka, +${result.newThreads} threadova`
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/mail-sync]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
