/**
 * Webhook endpoint for Synology MailPlus email notifications
 * This is triggered when a new email arrives (if MailPlus supports webhooks)
 * 
 * To configure in Synology MailPlus:
 * Control Panel → Application Portal → Reverse Proxy
 * Or set up mail forwarding to trigger this webhook
 */

import { NextResponse } from "next/server";
import { syncNewEmails } from "@/lib/email/mailSyncService";
import { isEmailConfigured } from "@/lib/config/envLoader";
import { env } from "@/lib/config/env";

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // Verify webhook secret if needed (optional)
    // const webhookSecret = request.headers.get("x-webhook-secret");
    // if (webhookSecret !== process.env.WEBHOOK_SECRET) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    if (!env.MAIL_SYNC_ENABLED || !isEmailConfigured()) {
      return NextResponse.json({ 
        success: false, 
        message: "Email sync disabled or not configured" 
      });
    }

    // Immediately sync new emails when webhook is triggered
    const result = await syncNewEmails();
    
    return NextResponse.json({
      success: true,
      ...result,
      triggeredBy: "webhook",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Webhook] Email sync error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Simple ping endpoint to verify webhook is accessible
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/webhook/synology-email",
    message: "Webhook endpoint is active",
  });
}
