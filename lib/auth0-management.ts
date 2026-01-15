// Auth0 Management API credentials
const issuerBaseURL = process.env.AUTH0_ISSUER_BASE_URL;
const managementDomainFromEnv = process.env.AUTH0_MANAGEMENT_DOMAIN;
const domainFromEnv = process.env.AUTH0_DOMAIN;

// Ekstraktuj domain - prioritet: AUTH0_MANAGEMENT_DOMAIN > AUTH0_ISSUER_BASE_URL > AUTH0_DOMAIN
const domain = managementDomainFromEnv || 
               (issuerBaseURL ? issuerBaseURL.replace(/^https?:\/\//, '') : undefined) ||
               domainFromEnv;

const clientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID;
const clientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;

if (!domain) {
  console.warn('[Auth0 Management] Domain not set. Management API operations will fail.');
}

if (!clientId || !clientSecret) {
  console.warn('[Auth0 Management] Client ID or Secret not set. Management API operations will fail.');
  console.warn('[Auth0 Management] Please set AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET in .env.local');
}

// Cache za access token
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Očisti token cache (pozovi nakon promene permisija u Auth0)
 */
export function clearTokenCache() {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
  console.log('[Auth0 Management] Token cache cleared');
}

/**
 * Dobij Management API access token (sa caching-om)
 */
async function getManagementApiToken(): Promise<string> {
  // Ako imamo validan token, vrati ga
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }
  
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
    throw new Error(`Failed to get access token: ${tokenResponse.status} ${errorData}`);
  }
  
  const tokenData = await tokenResponse.json();
  cachedAccessToken = tokenData.access_token;
  // Token expires in 24h, ali refreshamo ga nakon 1h (za development)
  tokenExpiresAt = Date.now() + (1 * 60 * 60 * 1000);
  
  return cachedAccessToken!;
}

/**
 * Get user roles from Auth0 - koristi direktan HTTP poziv
 */
export async function getUserRoles(auth0UserId: string): Promise<string[]> {
  if (!domain || !clientId || !clientSecret) {
    console.error('[Auth0 Management] Missing credentials');
    return ['VIEWER'];
  }

  try {
    // Dobij access token
    const accessToken = await getManagementApiToken();
    
    // Pozovi Management API direktno
    const rolesUrl = `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}/roles`;
    const rolesResponse = await fetch(rolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!rolesResponse.ok) {
      const errorData = await rolesResponse.text();
      console.error('[Auth0 Management] Error fetching roles:', rolesResponse.status, errorData);
      return ['VIEWER'];
    }
    
    const rolesData = await rolesResponse.json();
    
    if (rolesData && Array.isArray(rolesData) && rolesData.length > 0) {
      const roleNames = rolesData.map((role: any) => role.name || role.id || role);
      console.log('[Auth0 Management] Roles from API:', roleNames);
      return roleNames;
    }
    
    console.log('[Auth0 Management] No roles found, using default VIEWER');
    return ['VIEWER'];
  } catch (error) {
    console.error('[Auth0 Management] Error getting user roles:', error);
    return ['VIEWER'];
  }
}

/**
 * Assign role to user in Auth0 Roles sistem - koristi direktan HTTP poziv
 */
export async function assignRoleToUser(auth0UserId: string, roleName: string): Promise<void> {
  if (!domain || !clientId || !clientSecret) {
    throw new Error('Auth0 Management API not initialized. Please set AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET in .env.local');
  }

  try {
    const accessToken = await getManagementApiToken();
    
    // 1. Pronađi role ID po imenu
    const rolesUrl = `https://${domain}/api/v2/roles?name_filter=${encodeURIComponent(roleName)}`;
    const rolesResponse = await fetch(rolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!rolesResponse.ok) {
      throw new Error(`Failed to get roles: ${rolesResponse.status}`);
    }
    
    const roles = await rolesResponse.json();
    if (!roles || roles.length === 0) {
      throw new Error(`Role '${roleName}' not found in Auth0`);
    }
    
    const roleId = roles[0].id;
    
    // 2. Ukloni sve postojeće role od korisnika
    const currentRolesUrl = `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}/roles`;
    const currentRolesResponse = await fetch(currentRolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (currentRolesResponse.ok) {
      const currentRoles = await currentRolesResponse.json();
      if (currentRoles && currentRoles.length > 0) {
        // Ukloni sve postojeće role
        await fetch(currentRolesUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ roles: currentRoles.map((r: { id: string }) => r.id) })
        });
      }
    }
    
    // 3. Dodeli novu rolu
    const assignResponse = await fetch(currentRolesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roles: [roleId] })
    });
    
    if (!assignResponse.ok) {
      const errorData = await assignResponse.text();
      throw new Error(`Failed to assign role: ${assignResponse.status} ${errorData}`);
    }
    
    console.log(`[Auth0 Management] Assigned role '${roleName}' to user ${auth0UserId}`);
  } catch (error) {
    console.error('[Auth0 Management] Error assigning role:', error);
    throw new Error(`Failed to assign role: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Remove role from user in Auth0 - koristi direktan HTTP poziv
 */
export async function removeRoleFromUser(auth0UserId: string, roleName: string): Promise<void> {
  if (!domain || !clientId || !clientSecret) {
    throw new Error('Auth0 Management API not initialized. Please set AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET in .env.local');
  }

  try {
    const accessToken = await getManagementApiToken();
    
    // 1. Pronađi role ID po imenu
    const rolesUrl = `https://${domain}/api/v2/roles?name_filter=${encodeURIComponent(roleName)}`;
    const rolesResponse = await fetch(rolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!rolesResponse.ok) {
      throw new Error(`Failed to get roles: ${rolesResponse.status}`);
    }
    
    const roles = await rolesResponse.json();
    if (!roles || roles.length === 0) {
      console.log(`[Auth0 Management] Role '${roleName}' not found, nothing to remove`);
      return;
    }
    
    const roleId = roles[0].id;
    
    // 2. Ukloni rolu od korisnika
    const userRolesUrl = `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}/roles`;
    const removeResponse = await fetch(userRolesUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roles: [roleId] })
    });
    
    if (!removeResponse.ok && removeResponse.status !== 204) {
      const errorData = await removeResponse.text();
      throw new Error(`Failed to remove role: ${removeResponse.status} ${errorData}`);
    }
    
    console.log(`[Auth0 Management] Removed role '${roleName}' from user ${auth0UserId}`);
  } catch (error) {
    console.error('[Auth0 Management] Error removing role:', error);
    throw new Error(`Failed to remove role: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get user by email from Auth0 - koristi direktan HTTP poziv
 */
export async function getUserByEmail(email: string) {
  if (!domain || !clientId || !clientSecret) {
    throw new Error('Auth0 Management API not initialized. Please set AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET in .env.local');
  }

  try {
    const accessToken = await getManagementApiToken();
    
    // Koristi /api/v2/users-by-email endpoint
    const url = `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('[Auth0 Management] Error getting user by email:', response.status, errorData);
      return null;
    }
    
    const users = await response.json();
    if (!users || users.length === 0) {
      return null;
    }
    return users[0];
  } catch (error) {
    console.error('[Auth0 Management] Error getting user by email:', error);
    throw new Error(`Failed to get user from Auth0: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all roles from Auth0 - koristi direktan HTTP poziv
 */
export async function getAllRoles() {
  if (!domain || !clientId || !clientSecret) {
    throw new Error('Auth0 Management API not initialized. Please set AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET in .env.local');
  }

  try {
    const accessToken = await getManagementApiToken();
    
    const rolesUrl = `https://${domain}/api/v2/roles`;
    const response = await fetch(rolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to get roles: ${response.status} ${errorData}`);
    }
    
    const roles = await response.json();
    if (!roles || !Array.isArray(roles)) {
      return [];
    }
    return roles.map((role: { id: string; name: string; description?: string }) => ({
      id: role.id,
      name: role.name,
      description: role.description,
    }));
  } catch (error) {
    console.error('[Auth0 Management] Error getting all roles:', error);
    throw new Error(`Failed to get roles: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
