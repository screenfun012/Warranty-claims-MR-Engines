/**
 * Permission utilities using Auth0 session
 * Server-side permission checking for API routes
 */

import { getSession } from "./get-session";
import {
  isSuperAdmin as checkSuperAdmin,
  hasPermission as checkPermission,
  hasMinimumRole as checkMinimumRole,
  ROLES,
  PERMISSIONS,
  type Role,
  type Permission,
} from "./roles";

// Re-export for convenience
export { ROLES, PERMISSIONS };
export type { Role, Permission };

/**
 * Get current user role from session (server-side)
 */
export async function getUserRole(): Promise<Role | null> {
  const session = await getSession();
  const user = session?.user as { role?: string; roles?: string[] } | undefined;
  
  // Check for role in different locations
  const role = user?.role || user?.roles?.[0] || null;
  
  // Validate that role is one of our defined roles
  if (role && (Object.values(ROLES) as string[]).includes(role)) {
    return role as Role;
  }
  
  return null;
}

/**
 * Check if current user is super admin (server-side)
 */
export async function isSuperAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return checkSuperAdmin(role);
}

/**
 * Check if current user has specific permission (server-side)
 */
export async function userHasPermission(permission: string): Promise<boolean> {
  const role = await getUserRole();
  return checkPermission(role, permission);
}

/**
 * Check if current user has minimum role level (server-side)
 */
export async function userHasMinimumRole(minimumRole: Role): Promise<boolean> {
  const role = await getUserRole();
  return checkMinimumRole(role, minimumRole);
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(): Promise<void> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized: Authentication required");
  }
}

/**
 * Require super admin permission - throws error if not super admin
 */
export async function requireSuperAdmin(): Promise<void> {
  await requireAuth();
  
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    console.warn("[Permission] Super admin access denied for user");
    throw new Error("Forbidden: Super admin access required");
  }
}

/**
 * Require specific permission - throws error if user doesn't have it
 */
export async function requirePermission(permission: string): Promise<void> {
  await requireAuth();
  
  const role = await getUserRole();
  const hasPerm = await userHasPermission(permission);
  
  if (!hasPerm) {
    console.warn(`[Permission] Permission '${permission}' denied for user with role '${role}'`);
    throw new Error(`Forbidden: Permission '${permission}' required`);
  }
}

/**
 * Require minimum role level - throws error if user's role is lower
 */
export async function requireMinimumRole(minimumRole: Role): Promise<void> {
  await requireAuth();
  
  const hasRole = await userHasMinimumRole(minimumRole);
  if (!hasRole) {
    console.warn(`[Permission] Minimum role '${minimumRole}' denied for user`);
    throw new Error(`Forbidden: Minimum role '${minimumRole}' required`);
  }
}

/**
 * Get all permissions for current user
 */
export async function getUserPermissions(): Promise<string[]> {
  const { ROLE_PERMISSIONS } = await import("./roles");
  const role = await getUserRole();
  if (!role) return [];
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Helper to create standardized error response for API routes
 */
export function createPermissionError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : "Unknown error";
  
  if (message.includes("Authentication required")) {
    return { status: 401, message: "Unauthorized" };
  }
  
  if (message.includes("Forbidden") || message.includes("required")) {
    return { status: 403, message };
  }
  
  return { status: 500, message };
}
