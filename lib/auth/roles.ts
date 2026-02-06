/**
 * Role definitions and permissions
 * 4-tier role system: SUPER_ADMIN > ADMIN > OPERATOR > VIEWER
 */

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  OPERATOR: "OPERATOR",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Permission constants
 */
export const PERMISSIONS = {
  // Claims permissions
  CLAIMS_READ: "claims.read",
  CLAIMS_CREATE: "claims.create",
  CLAIMS_UPDATE: "claims.update",
  CLAIMS_DELETE: "claims.delete",
  CLAIMS_UNLOCK: "claims.unlock",
  // Inbox permissions
  INBOX_READ: "inbox.read",
  INBOX_DELETE: "inbox.delete",
  // Settings permissions
  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update",
  // Admin permissions
  ADMIN_USERS: "admin.users",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Role hierarchy (higher index = more permissions)
 */
export const ROLE_HIERARCHY: Role[] = [
  ROLES.VIEWER,
  ROLES.OPERATOR,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

/**
 * Permission matrix - which roles have which permissions
 */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPER_ADMIN: [
    PERMISSIONS.CLAIMS_READ,
    PERMISSIONS.CLAIMS_CREATE,
    PERMISSIONS.CLAIMS_UPDATE,
    PERMISSIONS.CLAIMS_DELETE,
    PERMISSIONS.CLAIMS_UNLOCK,
    PERMISSIONS.INBOX_READ,
    PERMISSIONS.INBOX_DELETE,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.ADMIN_USERS,
  ],
  ADMIN: [
    PERMISSIONS.CLAIMS_READ,
    PERMISSIONS.CLAIMS_CREATE,
    PERMISSIONS.CLAIMS_UPDATE,
    PERMISSIONS.INBOX_READ,
    PERMISSIONS.SETTINGS_READ,
  ],
  OPERATOR: [
    PERMISSIONS.CLAIMS_READ,
    PERMISSIONS.CLAIMS_CREATE,
    PERMISSIONS.CLAIMS_UPDATE,
    PERMISSIONS.INBOX_READ,
  ],
  VIEWER: [
    PERMISSIONS.CLAIMS_READ,
    PERMISSIONS.INBOX_READ,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role | null | undefined, permission: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

/**
 * Check if role is SUPER_ADMIN
 */
export function isSuperAdmin(role: Role | null | undefined): boolean {
  return role === ROLES.SUPER_ADMIN;
}

/**
 * Get role level (for hierarchy comparison)
 */
export function getRoleLevel(role: Role | null | undefined): number {
  if (!role) return -1;
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Check if role meets minimum required level
 */
export function hasMinimumRole(userRole: Role | null | undefined, minimumRole: Role): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(minimumRole);
}
