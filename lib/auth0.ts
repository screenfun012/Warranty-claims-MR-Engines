import { Auth0Client } from '@auth0/nextjs-auth0/server';

// Lazy initialization - Auth0 klijent se kreira samo kada je potreban
// Ovo omogućava da build prođe čak i kada env varijable nisu dostupne
let _auth0Client: Auth0Client | null = null;
let _initializationError: Error | null = null;

function getAuth0Config() {
  // Auth0 SDK očekuje AUTH0_DOMAIN (bez https://) ili AUTH0_ISSUER_BASE_URL (sa https://)
  const issuerBaseURL = process.env.AUTH0_ISSUER_BASE_URL;
  const domainFromEnv = process.env.AUTH0_DOMAIN;
  const baseURL = process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL;
  const clientID = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const secret = process.env.AUTH0_SECRET;

  // Ekstraktuj domain iz issuerBaseURL ako postoji (uklanjamo https://)
  const domain = domainFromEnv || (issuerBaseURL ? issuerBaseURL.replace(/^https?:\/\//, '') : undefined);

  return { domain, baseURL, clientID, clientSecret, secret };
}

/**
 * Check if Auth0 is configured (without throwing)
 */
export function isAuth0Configured(): boolean {
  const { domain, baseURL, clientID, clientSecret, secret } = getAuth0Config();
  return !!(domain && baseURL && clientID && clientSecret && secret);
}

/**
 * Check if we're in build phase
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build' || 
         process.env.VERCEL_ENV === undefined && !isAuth0Configured();
}

/**
 * Get Auth0 client instance (lazy initialization)
 * Returns null during build phase if Auth0 is not configured
 * Throws error at runtime if Auth0 is not configured
 */
export function getAuth0Client(): Auth0Client | null {
  // Return cached client if available
  if (_auth0Client) {
    return _auth0Client;
  }

  // Return cached error if we already tried and failed
  if (_initializationError && !isBuildPhase()) {
    throw _initializationError;
  }

  const { domain, baseURL, clientID, clientSecret, secret } = getAuth0Config();

  // During build, return null instead of throwing
  if (!isAuth0Configured()) {
    if (isBuildPhase()) {
      console.log('[Auth0] Skipping initialization during build phase (env vars not available)');
      return null;
    }
    
    // At runtime, throw error
    _initializationError = new Error(
      'AUTH0_DOMAIN or AUTH0_ISSUER_BASE_URL must be set in environment variables. ' +
      'Available AUTH0 env vars: ' + Object.keys(process.env).filter(k => k.startsWith('AUTH0')).join(', ')
    );
    console.error('[Auth0]', _initializationError.message);
    throw _initializationError;
  }

  console.log('[Auth0] Initializing with:', {
    domain,
    baseURL,
    clientID: clientID!.substring(0, 10) + '...',
    hasClientSecret: !!clientSecret,
    hasSecret: !!secret,
  });

  _auth0Client = new Auth0Client({
    domain: domain!,
    clientId: clientID!,
    clientSecret: clientSecret!,
    appBaseUrl: baseURL!,
    secret: secret!,
    httpTimeout: 15000,
    enableTelemetry: false,
  });

  return _auth0Client;
}

// Create a mock Auth0Client for build phase
function createMockAuth0Client(): Auth0Client {
  const throwNotConfigured = () => {
    throw new Error('Auth0 is not configured. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_BASE_URL, and AUTH0_SECRET environment variables.');
  };

  return {
    getSession: async () => null,
    getAccessToken: async () => throwNotConfigured(),
    touchSession: async () => throwNotConfigured(),
    updateSession: async () => throwNotConfigured(),
    handleAuth: () => throwNotConfigured(),
  } as unknown as Auth0Client;
}

// Legacy export za kompatibilnost - koristi lazy getter
// Vraća mock tokom build-a, pravi klijent tokom runtime-a
export const auth0: Auth0Client = new Proxy({} as Auth0Client, {
  get(_target, prop) {
    const client = getAuth0Client();
    
    // During build, use mock
    if (!client) {
      const mock = createMockAuth0Client();
      const value = (mock as Record<string | symbol, unknown>)[prop];
      if (typeof value === 'function') {
        return value.bind(mock);
      }
      return value;
    }
    
    const value = (client as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
