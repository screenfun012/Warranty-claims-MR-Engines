"use client";

import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getPusherClient, CHANNELS, EVENTS } from "@/lib/realtime/pusher";

/**
 * Hook to subscribe to real-time updates and automatically invalidate React Query cache
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   useRealtime(); // Subscribe to all events
 *   // or
 *   useRealtime({ channels: ['claims'] }); // Subscribe to specific channels
 * }
 * ```
 */
export function useRealtime(options?: {
  channels?: string[];
  onClaimCreated?: (data: any) => void;
  onClaimUpdated?: (data: any) => void;
  onClaimDeleted?: (data: any) => void;
  onInboxNew?: (data: any) => void;
}) {
  const queryClient = useQueryClient();

  const invalidateClaims = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["claims"] });
    queryClient.invalidateQueries({ queryKey: ["claim"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["statistics"] });
  }, [queryClient]);

  const invalidateInbox = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["inbox"] });
    queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const invalidateExportPlanner = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["export-planner-batches"] });
    queryClient.invalidateQueries({ queryKey: ["export-batch"] });
    queryClient.invalidateQueries({ queryKey: ["export-planner-my-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["export-planner-activity"] });
  }, [queryClient]);

  useEffect(() => {
    console.log("[useRealtime] Hook initialized");
    const pusher = getPusherClient();
    if (!pusher) {
      console.log("[useRealtime] ⚠️ Pusher not available, using fallback (window events)");
      console.log("[useRealtime] This means real-time will only work within the same browser tab");
      // Fallback: listen to custom window events for same-tab updates
      const handleClaimUpdate = () => {
        console.log("[useRealtime] Fallback: Claim update event received");
        invalidateClaims();
      };
      const handleInboxUpdate = () => {
        console.log("[useRealtime] Fallback: Inbox update event received");
        invalidateInbox();
      };
      
      window.addEventListener("claim-created", handleClaimUpdate);
      window.addEventListener("claim-updated", handleClaimUpdate);
      window.addEventListener("claim-deleted", handleClaimUpdate);
      window.addEventListener("inbox-new", handleInboxUpdate);
      
      return () => {
        window.removeEventListener("claim-created", handleClaimUpdate);
        window.removeEventListener("claim-updated", handleClaimUpdate);
        window.removeEventListener("claim-deleted", handleClaimUpdate);
        window.removeEventListener("inbox-new", handleInboxUpdate);
      };
    }
    
    console.log("[useRealtime] ✅ Pusher client available, subscribing to channels");

    const channels = options?.channels || [CHANNELS.CLAIMS, CHANNELS.INBOX, CHANNELS.EXPORT_PLANNER];
    const subscriptions: any[] = [];

    // Subscribe to claims channel
    if (channels.includes(CHANNELS.CLAIMS)) {
      const claimsChannel = pusher.subscribe(CHANNELS.CLAIMS);
      
      claimsChannel.bind(EVENTS.CLAIM_CREATED, (data: any) => {
        console.log("[useRealtime] Claim created:", data);
        invalidateClaims();
        options?.onClaimCreated?.(data);
      });
      
      claimsChannel.bind(EVENTS.CLAIM_UPDATED, (data: any) => {
        console.log("[useRealtime] Claim updated:", data);
        invalidateClaims();
        options?.onClaimUpdated?.(data);
      });
      
      claimsChannel.bind(EVENTS.CLAIM_DELETED, (data: any) => {
        console.log("[useRealtime] Claim deleted:", data);
        invalidateClaims();
        options?.onClaimDeleted?.(data);
      });
      
      subscriptions.push(claimsChannel);
    }

    // Subscribe to inbox channel
    if (channels.includes(CHANNELS.INBOX)) {
      const inboxChannel = pusher.subscribe(CHANNELS.INBOX);
      
      inboxChannel.bind(EVENTS.INBOX_NEW, (data: any) => {
        console.log("[useRealtime] New inbox item:", data);
        invalidateInbox();
        options?.onInboxNew?.(data);
      });
      
      inboxChannel.bind(EVENTS.INBOX_READ, (data: any) => {
        console.log("[useRealtime] Inbox item read:", data);
        invalidateInbox();
      });
      
      subscriptions.push(inboxChannel);
    }

    if (channels.includes(CHANNELS.EXPORT_PLANNER)) {
      const plannerChannel = pusher.subscribe(CHANNELS.EXPORT_PLANNER);
      plannerChannel.bind(EVENTS.EXPORT_BATCH_CHANGED, () => invalidateExportPlanner());
      subscriptions.push(plannerChannel);
    }

    return () => {
      subscriptions.forEach((channel) => {
        channel.unbind_all();
        pusher.unsubscribe(channel.name);
      });
    };
  }, [invalidateClaims, invalidateInbox, invalidateExportPlanner, options]);
}

/**
 * Hook for triggering local events that will be picked up by useRealtime
 * Use this when Pusher is not available
 */
export function useLocalEvents() {
  const dispatchClaimCreated = useCallback((data?: any) => {
    window.dispatchEvent(new CustomEvent("claim-created", { detail: data }));
  }, []);

  const dispatchClaimUpdated = useCallback((data?: any) => {
    window.dispatchEvent(new CustomEvent("claim-updated", { detail: data }));
  }, []);

  const dispatchClaimDeleted = useCallback((data?: any) => {
    window.dispatchEvent(new CustomEvent("claim-deleted", { detail: data }));
  }, []);

  const dispatchInboxNew = useCallback((data?: any) => {
    window.dispatchEvent(new CustomEvent("inbox-new", { detail: data }));
  }, []);

  return {
    dispatchClaimCreated,
    dispatchClaimUpdated,
    dispatchClaimDeleted,
    dispatchInboxNew,
  };
}
