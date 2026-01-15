import { NextRequest, NextResponse } from 'next/server';

/**
 * Logout route - redirects to Auth0 logout endpoint
 * Auth0 will clear the session and redirect back to the app
 */
export async function GET(request: NextRequest) {
  try {
    const baseURL = process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
    const domain = process.env.AUTH0_DOMAIN || 
                   process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, '');
    const clientId = process.env.AUTH0_CLIENT_ID;
    
    if (!domain || !clientId) {
      console.error('[Logout] Missing Auth0 configuration');
      return NextResponse.redirect(new URL('/login', baseURL));
    }
    
    // Build Auth0 logout URL
    // returnTo must be in "Allowed Logout URLs" in Auth0 Dashboard
    const returnTo = encodeURIComponent(`${baseURL}/login`);
    const logoutUrl = `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${returnTo}`;
    
    // Create response that clears session cookies
    const response = NextResponse.redirect(logoutUrl);
    
    // Clear Auth0 session cookies
    response.cookies.delete('appSession');
    response.cookies.delete('__Secure-appSession');
    
    return response;
  } catch (error) {
    console.error('[Logout] Error:', error);
    const baseURL = process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(new URL('/login', baseURL));
  }
}
