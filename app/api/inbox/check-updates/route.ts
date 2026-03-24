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
import { countEffectivelyUnreadThreads } from "@/lib/inbox/effectiveUnread";

export const maxDuration = 300;
export const runtime = 'nodejs';

// Track last sync time to avoid too frequent syncs
let lastSyncTime: number = 0;
/** Do not block JSON response on IMAP — was making inbox feel "3 days to load". */
const MIN_SYNC_INTERVAL = 45 * 1000;

export async function GET(request: Request) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const lastCheck = searchParams.get("lastCheck"); // ISO timestamp

    const now = Date.now();
    const shouldSync =
      env.MAIL_SYNC_ENABLED &&
      isEmailConfigured() &&
      now - lastSyncTime >= MIN_SYNC_INTERVAL;

    if (shouldSync) {
      lastSyncTime = Date.now();
      void syncNewEmails()
        .then((result) => {
          if (result.newMessages > 0) {
            console.log(
              `[CheckUpdates] Synced ${result.newMessages} new messages, ${result.newThreads} new threads`
            );
          }
        })
        .catch((error) => {
          console.error("[CheckUpdates] Error syncing emails:", error);
        });
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

    const unreadCount = await countEffectivelyUnreadThreads(prisma);

    return NextResponse.json({
      hasUpdates,
      lastUpdated: lastUpdated.toISOString(),
      unreadCount,
    });
  } catch (error) {
    console.error("Error checking inbox updates:", error);
    return NextResponse.json(
      { error: "Failed to check updates" },
      { status: 500 }
    );
  }
}

