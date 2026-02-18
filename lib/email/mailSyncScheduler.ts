/**
 * Mail Sync Scheduler - Automatic email synchronization
 * Supports both IMAP IDLE (real-time push) and periodic polling
 * Falls back to polling if IDLE is not available or fails
 *
 */

import { isEmailConfigured } from "@/lib/config/envLoader";
import { env } from "@/lib/config/env";

let syncInterval: NodeJS.Timeout | null = null;
let isSyncActive = false;
let useIdleMode = false;
let idleStartPromise: Promise<void> | null = null;

/**
 * Ensure IDLE/sync is started (called on first inbox API request so no manual "start IDLE" is needed).
 * Safe to call from any API route; starts sync once in the background.
 */
export function ensureIdleStarted(): void {
  if (idleStartPromise !== null) return;
  if (!env.MAIL_SYNC_ENABLED || !isEmailConfigured()) return;
  idleStartPromise = startIdleSync().catch((err) => {
    console.warn("[AutoSync] ensureIdleStarted failed (non-fatal):", err?.message ?? err);
    idleStartPromise = null;
  });
}

/**
 * Start automatic email sync
 * Tries IMAP IDLE first (if enabled), falls back to periodic polling
 */
export async function startIdleSync(): Promise<void> {
  // If already active but IDLE failed, restart it
  if (isSyncActive) {
    const usingIdle = await isUsingIdleMode();
    if (!usingIdle && env.MAIL_SYNC_USE_IDLE) {
      console.log("[AutoSync] IDLE failed, restarting sync to retry IDLE...");
      await stopIdleSync();
    } else {
      console.log("[AutoSync] Already active, skipping start");
      return;
    }
  }

  if (!env.MAIL_SYNC_ENABLED) {
    console.log("[AutoSync] Mail sync disabled, not starting auto-sync");
    return;
  }

  if (!isEmailConfigured()) {
    console.log("[AutoSync] Email not configured, not starting auto-sync");
    return;
  }

  isSyncActive = true;
  useIdleMode = env.MAIL_SYNC_USE_IDLE;

  const { syncNewEmails } = await import("./mailSyncService");
  const { getImapIdleClient } = await import("./imapIdleClient");

  // Initial sync regardless of mode
  try {
    const result = await syncNewEmails();
    if (result.newMessages > 0) {
      console.log(`[AutoSync] Initial sync: ${result.newMessages} new messages, ${result.newThreads} new threads`);
    }
  } catch (error) {
    console.error("[AutoSync] Error in initial sync:", error);
  }

  // Try IMAP IDLE mode first (if enabled)
  if (useIdleMode) {
    try {
      console.log("[AutoSync] Attempting to start IMAP IDLE mode (real-time push notifications)...");
      const idleClient = getImapIdleClient();
      
      await idleClient.start(async () => {
        // Callback when new message is detected
        console.log("[AutoSync] IDLE detected mailbox change, syncing emails...");
        try {
          // Minimal delay so IMAP server has the message ready (was 2000ms; 300ms is enough for speed)
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const result = await syncNewEmails();
          if (result.newMessages > 0) {
            console.log(`[AutoSync] IDLE: Synced ${result.newMessages} new messages, ${result.newThreads} new threads`);
            console.log("[AutoSync] IDLE: New messages synced, frontend should refresh via polling");
          } else {
            console.log("[AutoSync] IDLE: No new messages found (may be a false positive or already synced)");
          }
        } catch (error) {
          console.error("[AutoSync] Error syncing emails via IDLE:", error);
        }
      });

      console.log("[AutoSync] IMAP IDLE mode started successfully - using real-time push notifications");
      
      // Also start periodic polling as backup (every 2 minutes) in case IDLE misses something
      console.log("[AutoSync] Starting backup polling (every 2 minutes) in addition to IDLE...");
      const backupPollInterval = 2 * 60 * 1000; // 2 minutes
      syncInterval = setInterval(async () => {
        if (isSyncActive) {
          try {
            console.log("[AutoSync] Backup polling: Checking for new emails...");
            const result = await syncNewEmails();
            if (result.newMessages > 0) {
              console.log(`[AutoSync] Backup polling: Found ${result.newMessages} new messages, ${result.newThreads} new threads`);
            }
          } catch (error) {
            console.error("[AutoSync] Error in backup polling:", error);
          }
        }
      }, backupPollInterval);
      
      return; // Successfully started IDLE with backup polling
    } catch (error) {
      console.error("[AutoSync] Failed to start IMAP IDLE, falling back to polling:", error);
      useIdleMode = false; // Fall back to polling
    }
  }

  // Fallback to periodic polling
  if (!useIdleMode) {
    console.log("[AutoSync] Starting periodic polling (every 30 seconds)...");
    const pollInterval = 30 * 1000; // 30 seconds for faster response
    syncInterval = setInterval(async () => {
      if (isSyncActive && !useIdleMode) {
        try {
          console.log("[AutoSync] Polling for new emails...");
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
}

/**
 * Stop automatic email sync
 */
export async function stopIdleSync(): Promise<void> {
  console.log("[AutoSync] Stopping automatic sync...");
  isSyncActive = false;

  // Stop IDLE if active
  if (useIdleMode) {
    try {
      const { getImapIdleClient } = await import("./imapIdleClient");
      const idleClient = getImapIdleClient();
      await idleClient.stop();
      useIdleMode = false;
    } catch (error) {
      console.error("[AutoSync] Error stopping IDLE:", error);
    }
  }

  // Stop polling if active
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

/**
 * Check if currently using IDLE mode
 */
export async function isUsingIdleMode(): Promise<boolean> {
  if (!isSyncActive) return false;
  const { getImapIdleClient } = await import("./imapIdleClient");
  return getImapIdleClient().isIdleActive();
}

