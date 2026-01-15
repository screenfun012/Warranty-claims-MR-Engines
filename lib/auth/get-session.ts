import { auth0 } from "@/lib/auth0";
import { getUserRoles } from "@/lib/auth0-management";

export async function getSession() {
  const session = await auth0.getSession();
  if (!session) return null;
  
  const user = session.user as any;
  const userId = user.sub || user.id;
  
  // Pročitaj role iz custom claim (ubacuje Auth0 Action) - ovo je fallback
  let rolesFromToken = user?.['https://mr-engines-warranty/roles'] || [];
  if (!Array.isArray(rolesFromToken)) {
    rolesFromToken = rolesFromToken ? [rolesFromToken] : [];
  }
  
  // UVEK proveri Management API za najnovije role (source of truth)
  // Ovo omogućava da se role promene u Dashboard-u primene odmah nakon reload-a
  let roles: string[] = [];
  if (userId) {
    try {
      roles = await getUserRoles(userId);
      if (process.env.NODE_ENV === 'development') {
        console.log('[getSession] Roles from Management API (source of truth):', roles);
        if (rolesFromToken.length > 0) {
          console.log('[getSession] Roles from token (fallback):', rolesFromToken);
        }
      }
    } catch (mgmtError) {
      // Ako Management API ne radi, koristi role iz tokena
      if (process.env.NODE_ENV === 'development') {
        console.warn('[getSession] Could not fetch roles from Management API, using token roles:', mgmtError);
      }
      roles = rolesFromToken;
    }
  } else {
    // Ako nema userId, koristi role iz tokena
    roles = rolesFromToken;
  }
  
  // Ako i dalje nema role, dodeli default VIEWER (read-only)
  if (roles.length === 0) {
    roles = ['VIEWER'];
  }
  
  // Uzmi prvi role (ili VIEWER ako nema)
  const role = Array.isArray(roles) ? roles[0] : roles || 'VIEWER';
  
  // Debug logging u development modu
  if (process.env.NODE_ENV === 'development') {
    console.log('[getSession] User roles:', {
      customClaimRoles: user?.['https://mr-engines-warranty/roles'],
      finalRoles: roles,
      finalRole: role,
      email: user?.email,
    });
  }
  
  return {
    user: {
      ...user,
      role: role,
      id: userId,
      email: user.email,
      name: user.name,
    },
    expires: session.expires,
  };
}
