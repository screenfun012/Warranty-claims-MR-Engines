import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth0-management';
import { NextRequest, NextResponse } from 'next/server';

// Auth0 profile ruta - API verzija sa Management API fallback-om za role
export async function GET(request: NextRequest) {
  try {
    // Pokušaj da dobiješ session sa request objekatom
    const session = await auth0.getSession(request);
    
    // Ako nema session-a, vrati 204 (useUser hook očekuje 204, ne 401)
    if (!session || !session.user) {
      return new NextResponse(null, { 
        status: 204,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }
    
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
          console.log('[Profile API] Roles from Management API (source of truth):', roles);
          if (rolesFromToken.length > 0) {
            console.log('[Profile API] Roles from token (fallback):', rolesFromToken);
          }
        }
      } catch (mgmtError) {
        // Ako Management API ne radi, koristi role iz tokena
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Profile API] Could not fetch roles from Management API, using token roles:', mgmtError);
        }
        roles = rolesFromToken;
      }
    } else {
      // Ako nema userId, koristi role iz tokena
      roles = rolesFromToken;
    }
    
    // Ako i dalje nema role, dodeli default OPERATOR
    if (roles.length === 0) {
      roles = ['OPERATOR'];
    }
    
    // Uzmi prvi role (ili OPERATOR ako nema)
    const role = Array.isArray(roles) ? roles[0] : roles || 'OPERATOR';
    
    // Vrati user podatke sa role-om
    const enrichedUser = {
      ...user,
      role: role,
      id: userId,
      // Takođe dodaj roles array za kompatibilnost
      roles: roles,
      // Dodaj u custom claim format za kompatibilnost
      'https://mr-engines-warranty/roles': roles,
    };
    
    return NextResponse.json(enrichedUser, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    // Za SVE greške (uključujući 401), vrati 204
    // Ovo je normalno nakon logout-a ili kada korisnik nije ulogovan
    console.error('[Profile API] Error (returning 204):', error?.message || error);
    return new NextResponse(null, { 
      status: 204,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}
