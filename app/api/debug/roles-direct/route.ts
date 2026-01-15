import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { requirePermission, createPermissionError, PERMISSIONS } from '@/lib/auth/permissions';

/**
 * Debug endpoint - direktan poziv Management API bez SDK-a
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
    
    // Uzmi credentials iz environment varijabli
    const domain = process.env.AUTH0_MANAGEMENT_DOMAIN || 
                   process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '') ||
                   process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID;
    const clientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;
    
    console.log('[Debug Roles Direct] Domain:', domain);
    console.log('[Debug Roles Direct] Client ID:', clientId ? clientId.substring(0, 10) + '...' : 'MISSING');
    console.log('[Debug Roles Direct] Client Secret:', clientSecret ? 'SET' : 'MISSING');
    console.log('[Debug Roles Direct] User ID:', userId);
    
    if (!domain || !clientId || !clientSecret) {
      return NextResponse.json({ 
        error: 'Missing Management API credentials',
        domain: domain || 'MISSING',
        clientId: clientId ? 'SET' : 'MISSING',
        clientSecret: clientSecret ? 'SET' : 'MISSING',
      }, { status: 500 });
    }
    
    // 1. Dobij access token
    console.log('[Debug Roles Direct] Getting access token...');
    const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
        grant_type: 'client_credentials'
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[Debug Roles Direct] Token error:', tokenResponse.status, errorData);
      return NextResponse.json({ 
        error: 'Failed to get access token',
        status: tokenResponse.status,
        details: errorData,
      }, { status: 500 });
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('[Debug Roles Direct] Access token obtained');
    
    // 2. Dobij role korisnika
    console.log('[Debug Roles Direct] Fetching user roles...');
    const rolesUrl = `https://${domain}/api/v2/users/${encodeURIComponent(userId)}/roles`;
    console.log('[Debug Roles Direct] Roles URL:', rolesUrl);
    
    const rolesResponse = await fetch(rolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!rolesResponse.ok) {
      const errorData = await rolesResponse.text();
      console.error('[Debug Roles Direct] Roles error:', rolesResponse.status, errorData);
      return NextResponse.json({ 
        error: 'Failed to get user roles',
        status: rolesResponse.status,
        details: errorData,
      }, { status: 500 });
    }
    
    const rolesData = await rolesResponse.json();
    console.log('[Debug Roles Direct] Roles data:', JSON.stringify(rolesData, null, 2));
    
    // 3. Mapiraj role
    const roleNames = rolesData.map((role: any) => role.name || role.id || role);
    console.log('[Debug Roles Direct] Role names:', roleNames);
    
    return NextResponse.json({
      success: true,
      userId,
      email: user.email,
      domain,
      rawRolesData: rolesData,
      roleNames: roleNames,
      hasSuperAdmin: roleNames.includes('SUPER_ADMIN'),
    });
  } catch (error: unknown) {
    console.error('[Debug Roles Direct] Error:', error);
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
