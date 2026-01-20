/**
 * Pusher real-time configuration
 * 
 * Server-side: Use pusherServer to trigger events
 * Client-side: Use getPusherClient() to subscribe to events
 * 
 * Events:
 * - claim:created - when a new claim is created
 * - claim:updated - when a claim is updated
 * - claim:deleted - when a claim is deleted
 */

import Pusher from "pusher";
import PusherClient from "pusher-js";

// Server-side Pusher instance
let pusherServer: Pusher | null = null;

export function getPusherServer(): Pusher | null {
  if (typeof window !== "undefined") {
    // Don't create server instance on client
    return null;
  }
  
  if (!pusherServer) {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu";
    
    if (!appId || !key || !secret) {
      console.warn("[Pusher] Missing credentials, real-time updates disabled");
      return null;
    }
    
    pusherServer = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
    
    console.log("[Pusher] Server initialized");
  }
  
  return pusherServer;
}

// Client-side Pusher instance
let pusherClient: PusherClient | null = null;

export function getPusherClient(): PusherClient | null {
  if (typeof window === "undefined") {
    // Don't create client instance on server
    return null;
  }
  
  if (!pusherClient) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu";
    
    if (!key) {
      console.warn("[Pusher] Missing key, real-time updates disabled");
      return null;
    }
    
    pusherClient = new PusherClient(key, {
      cluster,
    });
    
    console.log("[Pusher] Client initialized");
  }
  
  return pusherClient;
}

// Channel names
export const CHANNELS = {
  CLAIMS: "claims",
  INBOX: "inbox",
} as const;

// Event types
export const EVENTS = {
  CLAIM_CREATED: "claim:created",
  CLAIM_UPDATED: "claim:updated",
  CLAIM_DELETED: "claim:deleted",
  INBOX_NEW: "inbox:new",
  INBOX_READ: "inbox:read",
} as const;

// Helper to trigger events from server
export async function triggerEvent(
  channel: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) {
    console.log("[Pusher] Server not available, skipping event trigger");
    return;
  }
  
  try {
    await pusher.trigger(channel, event, data);
    console.log(`[Pusher] Triggered ${event} on ${channel}`);
  } catch (error) {
    console.error("[Pusher] Error triggering event:", error);
  }
}
