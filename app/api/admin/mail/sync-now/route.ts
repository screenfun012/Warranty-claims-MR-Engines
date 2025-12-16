/**
 * API route for manual mail sync
 * POST /api/admin/mail/sync-now
 */

import { NextResponse } from "next/server";
import { syncNewEmails } from "@/lib/email/mailSyncService";
import { getEmailConfig } from "@/lib/config/envLoader";
import { env } from "@/lib/config/env";

export async function POST() {
  try {
    // Check if email is configured (from database or env)
    const dbConfig = await getEmailConfig();
    const imapHost = dbConfig?.imapHost || env.IMAP_HOST;
    const imapUser = dbConfig?.imapUser || env.IMAP_USER;

    if (!imapHost || !imapUser) {
      return NextResponse.json(
        {
          success: false,
          error: "IMAP is not configured. Please configure email settings in Settings page or set IMAP_HOST and IMAP_USER in your .env file.",
        },
        { status: 400 }
      );
    }

    const result = await syncNewEmails();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Mail sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

