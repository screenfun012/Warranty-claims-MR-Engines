/**
 * Mail Sync Scheduler - Automatic email synchronization
 * Uses periodic polling to check for new emails automatically
 * Polls every 2 minutes by default
 */

import { syncNewEmails } from "./mailSyncService";
import { getEmailConfig } from "@/lib/config/envLoader";
import { env } from "@/lib/config/env";

let syncInterval: NodeJS.Timeout | null = null;
let isSyncActive = false;

/**
 * Start automatic email sync with periodic polling
 */
export async function startIdleSync(): Promise<void> {
  if (isSyncActive) {
    console.log("[AutoSync] Already active, skipping start");
    return;
  }

  if (!env.MAIL_SYNC_ENABLED) {
    console.log("[AutoSync] Mail sync disabled, not starting auto-sync");
    return;
  }

  const dbConfig = await getEmailConfig();
  const imapHost = dbConfig?.imapHost || env.IMAP_HOST;
  const imapUser = dbConfig?.imapUser || env.IMAP_USER;

  if (!imapHost || !imapUser) {
    console.log("[AutoSync] Email not configured, not starting auto-sync");
    return;
  }

  console.log("[AutoSync] Starting automatic email sync (polling every 2 minutes)...");
  isSyncActive = true;

  // Initial sync
  try {
    const result = await syncNewEmails();
    if (result.newMessages > 0) {
      console.log(`[AutoSync] Initial sync: ${result.newMessages} new messages, ${result.newThreads} new threads`);
    }
  } catch (error) {
    console.error("[AutoSync] Error in initial sync:", error);
  }

  // Set up periodic polling - every 2 minutes
  const pollInterval = 2 * 60 * 1000; // 2 minutes
  syncInterval = setInterval(async () => {
    if (isSyncActive) {
      try {
        console.log("[AutoSync] Checking for new emails...");
        const result = await syncNewEmails();
        if (result.newMessages > 0) {
          console.log(`[AutoSync] Found ${result.newMessages} new messages, ${result.newThreads} new threads`);
        }
      } catch (error) {
        console.error("[AutoSync] Error syncing emails:", error);
      }
    }
  }, pollInterval);
}

/**
 * Stop automatic email sync
 */
export async function stopIdleSync(): Promise<void> {
  console.log("[AutoSync] Stopping automatic sync...");
  isSyncActive = false;

  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  console.log("[AutoSync] Automatic sync stopped");
}

/**
 * Check if automatic sync is currently active
 */
export function isIdleSyncActive(): boolean {
  return isSyncActive;
}

