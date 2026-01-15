import { Auth0Client } from '@auth0/nextjs-auth0/server';

// Auth0 SDK očekuje AUTH0_DOMAIN (bez https://) ili AUTH0_ISSUER_BASE_URL (sa https://)
// Ako imamo AUTH0_ISSUER_BASE_URL, ekstraktujemo domain iz njega
const issuerBaseURL = process.env.AUTH0_ISSUER_BASE_URL;
const domainFromEnv = process.env.AUTH0_DOMAIN;
const baseURL = process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL;
const clientID = process.env.AUTH0_CLIENT_ID;
const clientSecret = process.env.AUTH0_CLIENT_SECRET;
const secret = process.env.AUTH0_SECRET;

// Ekstraktuj domain iz issuerBaseURL ako postoji (uklanjamo https://)
const domain = domainFromEnv || (issuerBaseURL ? issuerBaseURL.replace(/^https?:\/\//, '') : undefined);

if (!domain) {
  const error = new Error('AUTH0_DOMAIN or AUTH0_ISSUER_BASE_URL must be set in environment variables');
  console.error('[Auth0]', error.message);
  console.error('[Auth0] Available AUTH0 env vars:', Object.keys(process.env).filter(k => k.startsWith('AUTH0')));
  throw error;
}
if (!baseURL) {
  throw new Error('AUTH0_BASE_URL or APP_BASE_URL must be set in environment variables');
}
if (!clientID) {
  throw new Error('AUTH0_CLIENT_ID is not set in environment variables');
}
if (!clientSecret) {
  throw new Error('AUTH0_CLIENT_SECRET is not set in environment variables');
}
if (!secret) {
  throw new Error('AUTH0_SECRET is not set in environment variables');
}

console.log('[Auth0] Initializing with:', {
  domain,
  baseURL,
  clientID: clientID.substring(0, 10) + '...',
  hasClientSecret: !!clientSecret,
  hasSecret: !!secret,
});

// Auth0Client v4 automatski čita environment varijable iz process.env
// Ali prosleđujemo eksplicitno da osiguramo da su učitane
// Optimizacije za performanse:
// - httpTimeout: povećan na 15s za sporije veze
// - enableTelemetry: isključujemo telemetriju za brže učitavanje
export const auth0 = new Auth0Client({
  domain,
  clientId: clientID,
  clientSecret,
  appBaseUrl: baseURL,
  secret,
  httpTimeout: 15000, // 15 sekundi timeout za Auth0 zahteve (povećano za sporije veze)
  enableTelemetry: false, // Isključi telemetriju za brže učitavanje
});
