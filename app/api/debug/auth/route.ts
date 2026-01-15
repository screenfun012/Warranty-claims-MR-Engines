import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth0-management';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, createPermissionError, PERMISSIONS } from '@/lib/auth/permissions';

/**
 * Debug endpoint - prikazuje sve što Auth0 vraća u session-u + Management API role
 * SUPER_ADMIN only
 */
export async function GET(request: NextRequest) {
  try {
    // Only SUPER_ADMIN can access debug endpoints
    await requirePermission(PERMISSIONS.ADMIN_USERS);
    
    const session = await auth0.getSession(request);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No session' }, { status: 401 });
    }
    
    const user = session.user as any;
    const userId = user.sub || user.id;
    
    // Proveri Management API za role
    let managementApiRoles: string[] = [];
    let managementApiError: string | null = null;
    try {
      managementApiRoles = await getUserRoles(userId);
    } catch (error: any) {
      managementApiError = error.message || String(error);
    }
    
    return NextResponse.json({
      user: {
        email: user.email,
        sub: user.sub,
        name: user.name,
        userId: userId,
        // Svi custom claims
        customClaims: {
          roles: user['https://mr-engines-warranty/roles'],
          permissions: user['https://mr-engines-warranty/permissions'],
        },
        // App metadata
        app_metadata: user.app_metadata,
        // User metadata
        user_metadata: user.user_metadata,
        // Management API roles (source of truth)
        managementApiRoles: managementApiRoles,
        managementApiError: managementApiError,
        // Svi ostali podaci
        allClaims: Object.keys(user).filter(key => 
          key.startsWith('https://') || 
          key === 'app_metadata' || 
          key === 'user_metadata'
        ).reduce((acc, key) => {
          acc[key] = user[key];
          return acc;
        }, {} as Record<string, any>),
        // Full user object (za debug)
        fullUser: user,
      },
      session: {
        expires: session.expires,
      },
    });
  } catch (error: unknown) {
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
