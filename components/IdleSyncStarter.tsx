"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Client component that starts automatic email sync when the app loads
 * This runs on the client side to trigger the server-side sync
 * Uses a ref to ensure it only runs once
 */
export function IdleSyncStarter() {
  const hasStarted = useRef(false);
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || !pathname;

  useEffect(() => {
    // Ne pokreći sync na login/register stranicama
    if (isAuthPage) return;

    // Only start once
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Start automatic email sync when app loads
    fetch("/api/admin/mail/start-idle", {
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log("[AutoSync] Automatic email sync started:", data.message);
        } else {
          console.error("[AutoSync] Failed to start:", data.error);
        }
      })
      .catch((error) => {
        console.error("[AutoSync] Failed to start automatic email sync:", error);
      });
  }, [isAuthPage]);

  return null; // This component doesn't render anything
}

