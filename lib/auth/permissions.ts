/**
 * Permission utilities for super admin functionality
 * Super admin is determined by:
 * 1. SUPER_ADMIN_EMAIL environment variable (if set)
 * 2. Email stored in localStorage (set via Settings page)
 */

import { env } from "@/lib/config/env";

/**
 * Check if an email belongs to a super admin
 * Super admin is determined by SUPER_ADMIN_EMAIL environment variable OR
 * any email stored in localStorage (for easier setup)
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase().trim();
  
  // Check environment variable first (if set)
  const superAdminEmail = env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  if (superAdminEmail) {
    const isMatch = emailLower === superAdminEmail;
    if (typeof window !== "undefined") {
      console.log("[isSuperAdmin] Checking against env:", { email: emailLower, superAdminEmail, isMatch });
    }
    return isMatch;
  }
  
  // If no env variable, check if email is stored in localStorage
  // This allows any user to set their email in Settings and become super admin
  // (useful for development and single-user setups)
  if (typeof window !== "undefined") {
    const storedEmail = localStorage.getItem("userEmail");
    if (storedEmail) {
      const storedEmailLower = storedEmail.toLowerCase().trim();
      const isMatch = emailLower === storedEmailLower;
      console.log("[isSuperAdmin] Checking against localStorage:", { email: emailLower, storedEmail: storedEmailLower, isMatch });
      return isMatch;
    }
  }
  
  if (typeof window !== "undefined") {
    console.log("[isSuperAdmin] No match found:", { email: emailLower, hasEnv: !!superAdminEmail, hasStored: typeof window !== "undefined" && !!localStorage.getItem("userEmail") });
  }
  return false;
}

/**
 * Get super admin email from environment variable
 */
export function getSuperAdminEmail(): string | null {
  return env.SUPER_ADMIN_EMAIL || null;
}

/**
 * Require super admin permission (throws error if not super admin)
 * This is used in API routes to enforce permissions
 */
export function requireSuperAdmin(email: string | null | undefined): void {
  if (!isSuperAdmin(email)) {
    throw new Error("Unauthorized: Super admin access required");
  }
}

