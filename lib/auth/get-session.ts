import { auth0 } from "@/lib/auth0";
import { getUserRoles } from "@/lib/auth0-management";

export async function getSession() {
  const session = await auth0.getSession();
  if (!session) return null;
  
  const user = session.user as any;
  const userId = user.sub || user.id;
  
  // Pročitaj role iz custom claim (ubacuje Auth0 Action) - ovo je PRIMARY izvor
  // Token se osvežava na svakih 24h, tako da će role biti ažurirane nakon refresh-a
  // Management API pozivamo samo kao fallback ako nema role u tokenu
  // Ovo DRAMATIČNO smanjuje broj API poziva i sprečava rate limiting
  let rolesFromToken = user?.['https://mr-engines-warranty/roles'] || [];
  if (!Array.isArray(rolesFromToken)) {
    rolesFromToken = rolesFromToken ? [rolesFromToken] : [];
  }
  
  // Koristi role iz tokena kao primarni izvor
  // Management API pozivamo samo ako nema role u tokenu (fallback za legacy korisnike)
  let roles: string[] = rolesFromToken;
  
  // Ako nema role u tokenu, probaj Management API (samo kao fallback)
  if (roles.length === 0 && userId) {
    try {
      roles = await getUserRoles(userId);
      if (process.env.NODE_ENV === 'development') {
        console.log('[getSession] No roles in token, fetched from Management API:', roles);
      }
    } catch (mgmtError) {
      // Ako Management API ne radi, koristi default VIEWER
      if (process.env.NODE_ENV === 'development') {
        console.warn('[getSession] Could not fetch roles from Management API, using default VIEWER:', mgmtError);
      }
      roles = ['VIEWER'];
    }
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
