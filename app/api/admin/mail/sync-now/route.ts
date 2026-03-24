/**
 * API route for manual mail sync
 * POST /api/admin/mail/sync-now
 */

import { NextResponse } from "next/server";
import { syncNewEmails } from "@/lib/email/mailSyncService";
import { isEmailConfigured } from "@/lib/config/envLoader";

// Vercel Pro: do 300s — isto kao cron mail-sync (veliki IMAP batch + attachment-i)
export const maxDuration = 300;
export const runtime = 'nodejs';

export async function POST() {
  try {
    // Check if email is configured
    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "IMAP is not configured. Please set IMAP_SERVER, IMAP_USER_EMAIL, and IMAP_USER_PASS in your .env file.",
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

