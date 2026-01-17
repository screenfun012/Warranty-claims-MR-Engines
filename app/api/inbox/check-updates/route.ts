/**
 * Lightweight endpoint to check if there are new emails
 * Also triggers email sync if enough time has passed since last sync
 * Returns only the count and last updated timestamp
 * GET /api/inbox/check-updates
 */

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { syncNewEmails } from "@/lib/email/mailSyncService";
import { env } from "@/lib/config/env";
import { isEmailConfigured } from "@/lib/config/envLoader";

// Vercel serverless function config - increase timeout for large emails with many attachments
export const maxDuration = 60; // 60 seconds (Pro plan limit)
export const runtime = 'nodejs';

// Track last sync time to avoid too frequent syncs
let lastSyncTime: number = 0;
const MIN_SYNC_INTERVAL = 5 * 1000; // Minimum 5 seconds between syncs (fast email detection)

export async function GET(request: Request) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const lastCheck = searchParams.get("lastCheck"); // ISO timestamp

    // ALWAYS trigger sync when check-updates is called (fast, lightweight)
    // Frontend polls every 5 seconds, so this provides near real-time email detection
    const now = Date.now();
    const shouldSync = 
      env.MAIL_SYNC_ENABLED && 
      isEmailConfigured() && 
      (now - lastSyncTime) >= MIN_SYNC_INTERVAL;

    if (shouldSync) {
      // Trigger sync immediately (frontend will wait for response)
      // This makes every check-updates call a real sync check
      try {
        const result = await syncNewEmails();
        lastSyncTime = Date.now();
        if (result.newMessages > 0) {
          console.log(`[CheckUpdates] Synced ${result.newMessages} new messages, ${result.newThreads} new threads`);
        }
      } catch (error) {
        console.error("[CheckUpdates] Error syncing emails:", error);
      }
    }

    // Get the most recent thread update time
    const mostRecentThread = await prisma.emailThread.findFirst({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        updatedAt: true,
        id: true,
      },
    });

    const lastUpdated = mostRecentThread?.updatedAt || new Date();
    const hasUpdates = lastCheck 
      ? new Date(lastUpdated) > new Date(lastCheck)
      : true; // If no lastCheck provided, assume there are updates

    // Count unread threads
    const unreadCount = await prisma.emailThread.count({
      where: {
        viewedAt: null,
        claimId: null,
      },
    });

    return NextResponse.json({
      hasUpdates,
      lastUpdated: lastUpdated.toISOString(),
      unreadCount,
      threadCount: await prisma.emailThread.count(),
    });
  } catch (error) {
    console.error("Error checking inbox updates:", error);
    return NextResponse.json(
      { error: "Failed to check updates" },
      { status: 500 }
    );
  }
}

