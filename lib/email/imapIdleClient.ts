/**
 * IMAP IDLE Client - Real-time push notifications for new emails
 * Uses IMAP IDLE extension for instant email notifications instead of polling
 */

import { ImapFlow } from "imapflow";
import { getImapClient } from "./imapClient";
import { syncNewEmails } from "./mailSyncService";
import { env } from "@/lib/config/env";
import { getEmailConfig } from "@/lib/config/envLoader";

export class ImapIdleClient {
  private client: ImapFlow | null = null;
  private mailboxLock: { release: () => void } | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isActive = false;
  private reconnectDelay = 5000; // 5 seconds
  private onNewMessageCallback?: () => Promise<void>;

  /**
   * Start IMAP IDLE mode for real-time email notifications
   */
  async start(onNewMessage?: () => Promise<void>): Promise<void> {
    // Reset reconnect attempts if we're restarting
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[IMAP IDLE] Resetting reconnect attempts and restarting IDLE...");
      this.reconnectAttempts = 0;
      this.isActive = false;
      // Stop any existing connection
      await this.stop();
    }

    if (this.isActive) {
      console.log("[IMAP IDLE] Already active, skipping start");
      return;
    }

    if (!env.MAIL_SYNC_ENABLED) {
      console.log("[IMAP IDLE] Mail sync disabled, not starting IDLE");
      return;
    }

    const dbConfig = await getEmailConfig();
    const imapHost = dbConfig?.imapHost || env.IMAP_HOST;
    const imapUser = dbConfig?.imapUser || env.IMAP_USER;

    if (!imapHost || !imapUser) {
      console.log("[IMAP IDLE] Email not configured, not starting IDLE");
      return;
    }

    console.log("[IMAP IDLE] Starting IMAP IDLE mode for real-time email notifications...");
    this.isActive = true;
    this.reconnectAttempts = 0;
    this.onNewMessageCallback = onNewMessage;

    await this.connectAndStartIdle();
  }

  /**
   * Connect to IMAP and start IDLE mode
   */
  private async connectAndStartIdle(): Promise<void> {
    try {
      // Get IMAP client using existing function
      this.client = await getImapClient();
      
      console.log("[IMAP IDLE] Connecting to IMAP server...");
      await this.client.connect();
      console.log("[IMAP IDLE] Connected successfully");

      // Open mailbox first (required before getting lock)
      await this.client.mailboxOpen("INBOX");
      console.log("[IMAP IDLE] INBOX opened");
      
      // Check if server supports IDLE before getting lock
      const capabilities = this.client.capabilities;
      const capabilityList = capabilities ? Array.from(capabilities.keys()) : [];
      console.log("[IMAP IDLE] Server capabilities:", capabilityList);
      
      if (capabilities && !capabilities.has('IDLE')) {
        console.warn("[IMAP IDLE] WARNING: Server does not support IDLE extension!");
        console.warn("[IMAP IDLE] Available capabilities:", capabilityList);
        throw new Error("IMAP server does not support IDLE extension");
      }
      console.log("[IMAP IDLE] Server supports IDLE extension ✓");
      
      // Get mailbox lock for IDLE (required by imapflow)
      this.mailboxLock = await this.client.getMailboxLock("INBOX");
      console.log("[IMAP IDLE] INBOX locked for IDLE");

      // Set up event listeners for connection errors
      this.setupErrorHandlers();

      // Keep connection alive with periodic NOOP
      this.keepAliveInterval = setInterval(async () => {
        if (this.isActive && this.client) {
          try {
            await this.client.noop();
            console.log("[IMAP IDLE] Keepalive sent (NOOP)");
          } catch (error) {
            console.error("[IMAP IDLE] Error sending keepalive:", error);
            this.handleIdleError(error as Error);
          }
        }
      }, 4 * 60 * 1000); // Every 4 minutes

      // Start IDLE loop
      this.startIdleLoop();

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;
      console.log("[IMAP IDLE] IDLE mode active, listening for new messages...");

    } catch (error) {
      console.error("[IMAP IDLE] Error starting IDLE:", error);
      this.handleIdleError(error as Error);
    }
  }

  /**
   * Set up error handlers for connection
   */
  private setupErrorHandlers(): void {
    if (!this.client) return;

    // Listen for connection errors
    this.client.on("error", (error: Error) => {
      console.error("[IMAP IDLE] Client error:", error);
      this.handleIdleError(error);
    });

    // Listen for connection close
    this.client.on("close", () => {
      console.log("[IMAP IDLE] Connection closed");
      if (this.isActive) {
        // Attempt to reconnect
        this.handleIdleError(new Error("Connection closed"));
      }
    });
  }

  /**
   * Start IDLE loop using client.idle() method
   * This method waits for mailbox changes and resolves when changes are detected
   */
  private async startIdleLoop(): Promise<void> {
    if (!this.client || !this.isActive) return;

    try {
      console.log("[IMAP IDLE] Starting IDLE loop, waiting for mailbox changes...");
      
      // client.idle() returns a promise that resolves when mailbox changes are detected
      // It will wait indefinitely until a change occurs or connection is closed
      const startTime = Date.now();
      const idleResult = await this.client.idle();
      const detectionTime = Date.now() - startTime;
      
      console.log(`[IMAP IDLE] IDLE resolved after ${detectionTime}ms, result: ${idleResult}`);
      console.log(`[IMAP IDLE] Active: ${this.isActive}, Result: ${idleResult}`);
      
      // If we get here, a change was detected (idleResult is true)
      // Also handle even if idleResult is false, as some servers may not return true
      if (this.isActive) {
        if (idleResult) {
          console.log("[IMAP IDLE] Mailbox change detected (idleResult=true) - handling new message...");
        } else {
          console.log("[IMAP IDLE] IDLE resolved (idleResult=false) - checking for new messages anyway...");
        }
        
        const handleStartTime = Date.now();
        await this.handleNewMessage();
        const handleTime = Date.now() - handleStartTime;
        console.log(`[IMAP IDLE] Message handling completed in ${handleTime}ms`);
        
        // Small delay before restarting to avoid rapid loops
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Restart IDLE loop to wait for next change
        this.startIdleLoop();
      }
    } catch (error) {
      if (this.isActive) {
        console.error("[IMAP IDLE] Error in IDLE loop:", error);
        this.handleIdleError(error as Error);
      }
    }
  }

  /**
   * Handle new message event
   */
  private async handleNewMessage(): Promise<void> {
    const handleStartTime = Date.now();
    console.log(`[IMAP IDLE] Handling new message event at ${new Date().toISOString()}...`);
    
    // Dispatch event immediately to notify frontend (even before sync completes)
    // This will trigger frontend to check for updates
    try {
      // Use a custom event that can be listened to
      if (typeof process !== 'undefined') {
        // Server-side: we can't dispatch to window, but we'll log
        console.log("[IMAP IDLE] New message detected - frontend should check for updates");
      }
    } catch (error) {
      console.error("[IMAP IDLE] Error dispatching event:", error);
    }
    
    if (this.onNewMessageCallback) {
      try {
        const callbackStartTime = Date.now();
        await this.onNewMessageCallback();
        const callbackTime = Date.now() - callbackStartTime;
        console.log(`[IMAP IDLE] Callback completed in ${callbackTime}ms`);
      } catch (error) {
        console.error("[IMAP IDLE] Error in onNewMessage callback:", error);
      }
    } else {
      // Default: sync emails
      try {
        const syncStartTime = Date.now();
        const result = await syncNewEmails();
        const syncTime = Date.now() - syncStartTime;
        
        if (result.newMessages > 0) {
          console.log(`[IMAP IDLE] Synced ${result.newMessages} new messages, ${result.newThreads} new threads in ${syncTime}ms`);
        } else {
          console.log(`[IMAP IDLE] Sync completed in ${syncTime}ms, no new messages`);
        }
      } catch (error) {
        console.error("[IMAP IDLE] Error syncing emails:", error);
      }
    }
    
    const totalHandleTime = Date.now() - handleStartTime;
    console.log(`[IMAP IDLE] Total message handling time: ${totalHandleTime}ms`);
  }

  /**
   * Handle IDLE errors and attempt reconnection
   */
  private async handleIdleError(error: Error): Promise<void> {
    console.error("[IMAP IDLE] Handling error:", error.message);

    // Stop current IDLE session
    await this.stopIdle();

    // Check if we should reconnect
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[IMAP IDLE] Max reconnection attempts (${this.maxReconnectAttempts}) reached. Falling back to polling mode.`);
      this.isActive = false;
      return;
    }

    // Schedule reconnection
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts; // Exponential backoff
    
    console.log(`[IMAP IDLE] Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimeout = setTimeout(async () => {
      if (this.isActive) {
        await this.connectAndStartIdle();
      }
    }, delay);
  }

  /**
   * Stop IDLE mode
   */
  private async stopIdle(): Promise<void> {
    // Remove event listeners
    if (this.client) {
      this.client.removeAllListeners("error");
      this.client.removeAllListeners("close");
    }

    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.mailboxLock) {
      try {
        this.mailboxLock.release();
        console.log("[IMAP IDLE] Mailbox lock released");
      } catch (error) {
        console.error("[IMAP IDLE] Error releasing mailbox lock:", error);
      }
      this.mailboxLock = null;
    }
  }

  /**
   * Stop IMAP IDLE client completely
   */
  async stop(): Promise<void> {
    console.log("[IMAP IDLE] Stopping IMAP IDLE client...");
    this.isActive = false;

    await this.stopIdle();

    if (this.client) {
      try {
        await this.client.logout();
        console.log("[IMAP IDLE] Disconnected from IMAP server");
      } catch (error) {
        console.error("[IMAP IDLE] Error during logout:", error);
      }
      this.client = null;
    }

    console.log("[IMAP IDLE] IMAP IDLE client stopped");
  }

  /**
   * Check if IDLE is currently active
   */
  isIdleActive(): boolean {
    return this.isActive && this.client !== null && this.mailboxLock !== null;
  }

  /**
   * Get current reconnect attempts
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// Singleton instance
let idleClientInstance: ImapIdleClient | null = null;

/**
 * Get or create IMAP IDLE client instance
 */
export function getImapIdleClient(): ImapIdleClient {
  if (!idleClientInstance) {
    idleClientInstance = new ImapIdleClient();
  }
  return idleClientInstance;
}
