import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth0-management';
import { requirePermission, createPermissionError, PERMISSIONS } from '@/lib/auth/permissions';

/**
 * Debug endpoint - direktno proverava šta Management API vraća za role
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
    
    if (!userId) {
      return NextResponse.json({ error: 'No user ID' }, { status: 400 });
    }
    
    console.log('[Debug Roles] User ID:', userId);
    console.log('[Debug Roles] Fetching roles from Management API...');
    
    // Direktno pozovi Management API
    const roles = await getUserRoles(userId);
    
    console.log('[Debug Roles] Roles returned:', roles);
    
    return NextResponse.json({
      userId,
      email: user.email,
      roles: roles,
      rolesCount: roles.length,
      hasSuperAdmin: roles.includes('SUPER_ADMIN'),
    });
  } catch (error: unknown) {
    console.error('[Debug Roles] Error:', error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
