/**
 * Mail Sync Scheduler - IDLE prvo (real-time), polling kao rezerva.
 * IDLE = mail stiže odmah kad server javi; ako IDLE ne uspe, polling svakih 15s.
 */

import { isEmailConfigured } from "@/lib/config/envLoader";
import { env } from "@/lib/config/env";

const POLL_INTERVAL_MS = 15 * 1000; // 15s kada koristimo samo polling
const BACKUP_POLL_MS = 30 * 1000;    // 30s backup dok je IDLE aktivan

let syncInterval: NodeJS.Timeout | null = null;
let isSyncActive = false;
let useIdleMode = false;
let startPromise: Promise<void> | null = null;

/**
 * Pokreni sync (IDLE ako je uključen, inače polling). Poziva se pri prvom zahtevu na inbox/dashboard.
 */
export function ensureIdleStarted(): void {
  if (startPromise !== null) return;
  if (!env.MAIL_SYNC_ENABLED || !isEmailConfigured()) return;
  startPromise = startIdleSync().catch((err) => {
    console.warn("[AutoSync] startIdleSync failed (non-fatal):", err?.message ?? err);
    startPromise = null;
  });
}

/**
 * Start: prvo IDLE (ako MAIL_SYNC_USE_IDLE=true), pa backup polling; ako IDLE padne → samo polling.
 */
export async function startIdleSync(): Promise<void> {
  if (isSyncActive) {
    const usingIdle = await isUsingIdleMode();
    if (!usingIdle && env.MAIL_SYNC_USE_IDLE) {
      console.log("[AutoSync] IDLE nije aktivan, restartujem...");
      await stopIdleSync();
    } else {
      console.log("[AutoSync] Već aktivan, skip");
      return;
    }
  }

  if (!env.MAIL_SYNC_ENABLED || !isEmailConfigured()) {
    console.log("[AutoSync] Sync disabled ili email nije konfigurisan");
    return;
  }

  isSyncActive = true;
  useIdleMode = env.MAIL_SYNC_USE_IDLE;

  const { syncNewEmails } = await import("./mailSyncService");

  try {
    const result = await syncNewEmails();
    if (result.newMessages > 0) {
      console.log(`[AutoSync] Initial sync: ${result.newMessages} new, ${result.newThreads} threads`);
    }
  } catch (error) {
    console.error("[AutoSync] Initial sync error:", error);
  }

  if (useIdleMode) {
    try {
      const { getImapIdleClient } = await import("./imapIdleClient");
      console.log("[AutoSync] Pokrećem IMAP IDLE (real-time)...");
      await getImapIdleClient().start(async () => {
        console.log("[AutoSync] IDLE: promena mailboxa, sync odmah...");
        try {
          let result = await syncNewEmails();
          if (result.newMessages === 0) {
            await new Promise((r) => setTimeout(r, 1200));
            result = await syncNewEmails();
          }
          if (result.newMessages > 0) {
            console.log(`[AutoSync] IDLE: ${result.newMessages} novih poruka`);
          }
        } catch (err) {
          console.error("[AutoSync] IDLE sync error:", err);
        }
      });
      console.log("[AutoSync] IDLE aktivan, backup polling svakih " + BACKUP_POLL_MS / 1000 + "s");
      syncInterval = setInterval(async () => {
        if (!isSyncActive) return;
        try {
          const result = await syncNewEmails();
          if (result.newMessages > 0) {
            console.log(`[AutoSync] Backup poll: ${result.newMessages} novih`);
          }
        } catch (err) {
          console.error("[AutoSync] Backup poll error:", err);
        }
      }, BACKUP_POLL_MS);
      return;
    } catch (error) {
      console.error("[AutoSync] IDLE nije uspeo, prelazim na polling:", error);
      useIdleMode = false;
    }
  }

  console.log("[AutoSync] Polling svakih " + POLL_INTERVAL_MS / 1000 + "s");
  syncInterval = setInterval(async () => {
    if (!isSyncActive) return;
    try {
      const result = await syncNewEmails();
      if (result.newMessages > 0) {
        console.log(`[AutoSync] Poll: ${result.newMessages} novih`);
      }
    } catch (err) {
      console.error("[AutoSync] Poll error:", err);
    }
  }, POLL_INTERVAL_MS);
}

export async function stopIdleSync(): Promise<void> {
  console.log("[AutoSync] Stopping...");
  isSyncActive = false;
  if (useIdleMode) {
    try {
      const { getImapIdleClient } = await import("./imapIdleClient");
      await getImapIdleClient().stop();
    } catch (err) {
      console.error("[AutoSync] Error stopping IDLE:", err);
    }
    useIdleMode = false;
  }
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log("[AutoSync] Stopped");
}

export function isIdleSyncActive(): boolean {
  return isSyncActive;
}

export async function isUsingIdleMode(): Promise<boolean> {
  if (!isSyncActive) return false;
  try {
    const { getImapIdleClient } = await import("./imapIdleClient");
    return getImapIdleClient().isIdleActive();
  } catch {
    return false;
  }
}
