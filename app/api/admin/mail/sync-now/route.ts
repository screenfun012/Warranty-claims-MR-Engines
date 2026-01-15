/**
 * API route for mail sync
 * GET /api/admin/mail/sync-now - Called by Vercel Cron
 * POST /api/admin/mail/sync-now - Manual sync
 */

import { NextRequest, NextResponse } from "next/server";
import { syncNewEmails } from "@/lib/email/mailSyncService";
import { isEmailConfigured } from "@/lib/config/envLoader";

// GET - Called by Vercel Cron
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // In production, verify the cron secret if set
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also allow Vercel's cron requests which don't have auth header but come from Vercel
    const isVercelCron = request.headers.get("x-vercel-cron") === "true";
    if (!isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return runSync();
}

// POST - Manual sync (authenticated users)
export async function POST() {
  return runSync();
}

async function runSync() {
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
    console.log("[Cron Sync] Result:", result);
    
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

