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

// Cache za role (userId -> {roles: string[], expiresAt: number})
const roleCache = new Map<string, { roles: string[]; expiresAt: number }>();
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minuta

/**
 * Retry helper sa exponential backoff za rate limiting greške
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Ako je 429 (Too Many Requests), pokušaj ponovo sa delay-om
      if (response.status === 429) {
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`[Auth0 Management] Rate limit hit (429), retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          // Poslednji pokušaj - pročitaj Retry-After header ako postoji
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            const delay = parseInt(retryAfter) * 1000;
            console.log(`[Auth0 Management] Rate limit hit (429), waiting ${delay}ms as per Retry-After header...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            // Još jedan pokušaj nakon čekanja
            return await fetch(url, options);
          }
        }
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Ako nije poslednji pokušaj, čekaj pre ponovnog pokušaja
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Auth0 Management] Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch after retries');
}

/**
 * Delay helper za smanjenje rate limiting-a
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Očisti token cache (pozovi nakon promene permisija u Auth0)
 */
export function clearTokenCache() {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
  console.log('[Auth0 Management] Token cache cleared');
}

/**
 * Očisti role cache (pozovi nakon promene role korisnika)
 */
export function clearRoleCache(auth0UserId?: string) {
  if (auth0UserId) {
    roleCache.delete(auth0UserId);
    console.log(`[Auth0 Management] Role cache cleared for user ${auth0UserId}`);
  } else {
    roleCache.clear();
    console.log('[Auth0 Management] All role caches cleared');
  }
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
 * Get user roles from Auth0 - koristi direktan HTTP poziv sa caching-om
 */
export async function getUserRoles(auth0UserId: string): Promise<string[]> {
  if (!domain || !clientId || !clientSecret) {
    console.error('[Auth0 Management] Missing credentials');
    return ['VIEWER'];
  }

  // Proveri cache prvo
  const cached = roleCache.get(auth0UserId);
  if (cached && Date.now() < cached.expiresAt) {
    console.log('[Auth0 Management] Roles from cache:', cached.roles);
    return cached.roles;
  }

  try {
    // Dobij access token
    const accessToken = await getManagementApiToken();
    
    // Pozovi Management API direktno (sa retry logikom)
    const rolesUrl = `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}/roles`;
    const rolesResponse = await fetchWithRetry(rolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!rolesResponse.ok) {
      const errorData = await rolesResponse.text();
      console.error('[Auth0 Management] Error fetching roles:', rolesResponse.status, errorData);
      // Ako imamo stari cache, koristi ga
      if (cached) {
        console.log('[Auth0 Management] Using stale cache due to API error');
        return cached.roles;
      }
      return ['VIEWER'];
    }
    
    const rolesData = await rolesResponse.json();
    
    let roleNames: string[] = ['VIEWER'];
    if (rolesData && Array.isArray(rolesData) && rolesData.length > 0) {
      roleNames = rolesData.map((role: any) => role.name || role.id || role);
      console.log('[Auth0 Management] Roles from API:', roleNames);
    } else {
      console.log('[Auth0 Management] No roles found, using default VIEWER');
    }
    
    // Sačuvaj u cache
    roleCache.set(auth0UserId, {
      roles: roleNames,
      expiresAt: Date.now() + ROLE_CACHE_TTL
    });
    
    return roleNames;
  } catch (error) {
    console.error('[Auth0 Management] Error getting user roles:', error);
    // Ako imamo stari cache, koristi ga
    if (cached) {
      console.log('[Auth0 Management] Using stale cache due to error');
      return cached.roles;
    }
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
    
    // 1. Pronađi role ID po imenu (sa retry logikom)
    const rolesUrl = `https://${domain}/api/v2/roles?name_filter=${encodeURIComponent(roleName)}`;
    const rolesResponse = await fetchWithRetry(rolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!rolesResponse.ok) {
      const errorData = await rolesResponse.text();
      if (rolesResponse.status === 429) {
        throw new Error(`Rate limit reached. Molimo sačekajte nekoliko sekundi i pokušajte ponovo.`);
      }
      throw new Error(`Failed to get roles: ${rolesResponse.status} ${errorData}`);
    }
    
    const roles = await rolesResponse.json();
    if (!roles || roles.length === 0) {
      throw new Error(`Role '${roleName}' not found in Auth0`);
    }
    
    const roleId = roles[0].id;
    
    // 2. Ukloni sve postojeće role od korisnika (sa retry logikom)
    const currentRolesUrl = `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}/roles`;
    const currentRolesResponse = await fetchWithRetry(currentRolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (currentRolesResponse.ok) {
      const currentRoles = await currentRolesResponse.json();
      if (currentRoles && currentRoles.length > 0) {
        // Delay pre brisanja da smanjimo rate limiting
        await delay(200);
        
        // Ukloni sve postojeće role (sa retry logikom)
        const deleteResponse = await fetchWithRetry(currentRolesUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ roles: currentRoles.map((r: { id: string }) => r.id) })
        });
        
        if (!deleteResponse.ok && deleteResponse.status !== 204) {
          const errorData = await deleteResponse.text();
          if (deleteResponse.status === 429) {
            throw new Error(`Rate limit reached. Molimo sačekajte nekoliko sekundi i pokušajte ponovo.`);
          }
          console.warn(`[Auth0 Management] Failed to remove existing roles: ${deleteResponse.status} ${errorData}`);
        }
      }
    }
    
    // Delay pre dodele nove role
    await delay(200);
    
    // 3. Dodeli novu rolu (sa retry logikom)
    const assignResponse = await fetchWithRetry(currentRolesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roles: [roleId] })
    });
    
    if (!assignResponse.ok) {
      const errorData = await assignResponse.text();
      if (assignResponse.status === 429) {
        throw new Error(`Rate limit reached. Molimo sačekajte nekoliko sekundi i pokušajte ponovo.`);
      }
      throw new Error(`Failed to assign role: ${assignResponse.status} ${errorData}`);
    }
    
    console.log(`[Auth0 Management] Assigned role '${roleName}' to user ${auth0UserId}`);
    
    // Očisti role cache za ovog korisnika nakon promene
    clearRoleCache(auth0UserId);
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
    
    // 1. Pronađi role ID po imenu (sa retry logikom)
    const rolesUrl = `https://${domain}/api/v2/roles?name_filter=${encodeURIComponent(roleName)}`;
    const rolesResponse = await fetchWithRetry(rolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!rolesResponse.ok) {
      const errorData = await rolesResponse.text();
      if (rolesResponse.status === 429) {
        throw new Error(`Rate limit reached. Molimo sačekajte nekoliko sekundi i pokušajte ponovo.`);
      }
      throw new Error(`Failed to get roles: ${rolesResponse.status} ${errorData}`);
    }
    
    const roles = await rolesResponse.json();
    if (!roles || roles.length === 0) {
      console.log(`[Auth0 Management] Role '${roleName}' not found, nothing to remove`);
      return;
    }
    
    const roleId = roles[0].id;
    
    // Delay pre brisanja
    await delay(200);
    
    // 2. Ukloni rolu od korisnika (sa retry logikom)
    const userRolesUrl = `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}/roles`;
    const removeResponse = await fetchWithRetry(userRolesUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roles: [roleId] })
    });
    
    if (!removeResponse.ok && removeResponse.status !== 204) {
      const errorData = await removeResponse.text();
      if (removeResponse.status === 429) {
        throw new Error(`Rate limit reached. Molimo sačekajte nekoliko sekundi i pokušajte ponovo.`);
      }
      throw new Error(`Failed to remove role: ${removeResponse.status} ${errorData}`);
    }
    
    console.log(`[Auth0 Management] Removed role '${roleName}' from user ${auth0UserId}`);
    
    // Očisti role cache za ovog korisnika nakon promene
    clearRoleCache(auth0UserId);
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
    
    // Koristi /api/v2/users-by-email endpoint (sa retry logikom)
    const url = `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`;
    const response = await fetchWithRetry(url, {
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
    const response = await fetchWithRetry(rolesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      if (response.status === 429) {
        throw new Error(`Rate limit reached. Molimo sačekajte nekoliko sekundi i pokušajte ponovo.`);
      }
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
