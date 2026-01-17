/**
 * Vercel Cron Job - Checks for new emails every 5 seconds
 * This provides near real-time email detection (event-driven style)
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-email",
 *     "schedule": "*/5 * * * * *"  // Every 5 seconds
 *   }]
 * }
 */

import { NextResponse } from "next/server";
import { syncNewEmails } from "@/lib/email/mailSyncService";
import { isEmailConfigured } from "@/lib/config/envLoader";
import { env } from "@/lib/config/env";

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Verify it's from Vercel Cron (optional but recommended)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!env.MAIL_SYNC_ENABLED || !isEmailConfigured()) {
      return NextResponse.json({ 
        success: false, 
        message: "Email sync disabled or not configured" 
      });
    }

    const result = await syncNewEmails();
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Email sync error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
