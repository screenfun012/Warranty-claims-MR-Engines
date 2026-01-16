/**
 * API route for mail sync
 * GET /api/admin/mail/sync-now - Called by Vercel Cron
 * POST /api/admin/mail/sync-now - Manual sync
 */

import { NextRequest, NextResponse } from "next/server";
import { syncNewEmails } from "@/lib/email/mailSyncService";
import { isEmailConfigured } from "@/lib/config/envLoader";

// GET - Called by Vercel Cron or external cron services
export async function GET(request: NextRequest) {
  // Allow both Vercel Cron and external cron services (like cron-job.org)
  const isVercelCron = request.headers.get("x-vercel-cron") === "true";
  const userAgent = request.headers.get("user-agent") || "";
  
  // Allow Vercel Cron, cron-job.org, or other common cron services
  if (!isVercelCron && !userAgent.includes("cron-job.org") && !userAgent.includes("cron")) {
    // Still allow, but log for security
    console.log("[Mail Sync] GET request from:", userAgent);
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
    console.log("[Mail Sync] Result:", result);
    
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

