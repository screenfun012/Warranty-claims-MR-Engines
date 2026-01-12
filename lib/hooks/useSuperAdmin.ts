/**
 * Hook to check if current user is super admin
 * Uses localStorage to store user email (set via settings or environment)
 */

import { useState, useEffect } from "react";
import { isSuperAdmin, getSuperAdminEmail } from "@/lib/auth/permissions";

export function useSuperAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const checkAdminStatus = (email: string | null) => {
    if (!email) {
      setIsAdmin(false);
      return;
    }
    const adminStatus = isSuperAdmin(email);
    setIsAdmin(adminStatus);
  };

  useEffect(() => {
    // Get user email from localStorage or environment
    // In a real app, this would come from authentication
    const storedEmail = localStorage.getItem("userEmail");
    const envEmail = getSuperAdminEmail();
    const email = storedEmail || envEmail || "";
    
    setUserEmail(email || null);
    checkAdminStatus(email || null);

    // Listen for storage changes (when email is updated in another tab/window)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "userEmail") {
        const newEmail = e.newValue || "";
        console.log("[useSuperAdmin] Storage changed:", newEmail);
        setUserEmail(newEmail || null);
        checkAdminStatus(newEmail || null);
      }
    };

    // Also listen for custom event
    const handleUserEmailUpdated = (e: CustomEvent) => {
      const newEmail = e.detail || "";
      console.log("[useSuperAdmin] User email updated event:", newEmail);
      setUserEmail(newEmail || null);
      checkAdminStatus(newEmail || null);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("userEmailUpdated", handleUserEmailUpdated as EventListener);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("userEmailUpdated", handleUserEmailUpdated as EventListener);
    };
  }, []);

  return {
    isSuperAdmin: isAdmin,
    userEmail,
    setUserEmail: (email: string) => {
      const trimmedEmail = email.trim();
      if (trimmedEmail) {
        localStorage.setItem("userEmail", trimmedEmail);
        setUserEmail(trimmedEmail);
        checkAdminStatus(trimmedEmail);
        // Trigger storage event for other tabs/windows
        window.dispatchEvent(new StorageEvent("storage", {
          key: "userEmail",
          newValue: trimmedEmail,
        }));
      } else {
        localStorage.removeItem("userEmail");
        setUserEmail(null);
        setIsAdmin(false);
      }
    },
  };
}

