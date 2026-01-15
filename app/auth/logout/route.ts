import { auth0 } from '@/lib/auth0';
import { NextRequest, NextResponse } from 'next/server';

// Auth0 logout ruta - eksplicitna implementacija koja osigurava pravilno brisanje session-a
// i redirect na login stranicu
export async function GET(request: NextRequest) {
  try {
    const baseURL = process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
    const loginURL = new URL('/login', baseURL);
    
    // Dodaj returnTo parametar u request URL da Auth0 SDK zna gde da redirect-uje nakon logout-a
    // VAŽNO: returnTo mora biti puna URL (ne relativna putanja) i mora biti u "Allowed Logout URLs" u Auth0 Dashboard-u
    const url = new URL(request.url);
    url.searchParams.set('returnTo', loginURL.toString());
    const modifiedRequest = new NextRequest(url, request);
    
    // Koristi Auth0 SDK handleLogout metodu koja automatski rukuje sa logout-om
    const response = await auth0.handleLogout(modifiedRequest);
    
    // Auth0 SDK handleLogout redirect-uje na Auth0 logout endpoint
    // Auth0 zatim redirect-uje nazad na returnTo URL
    // Međutim, ako returnTo nije u "Allowed Logout URLs", Auth0 će redirect-ovati na base URL
    // Zato proveravamo response i ako je redirect na base URL, menjamo ga na /login
    
    if (response.status === 302 || response.status === 307) {
      const location = response.headers.get('location');
      
      // Ako je redirect na Auth0 logout endpoint, pustimo ga da se izvrši
      // Auth0 će zatim redirect-ovati na returnTo koji smo postavili
      if (location && location.includes('auth0.com')) {
        return response;
      }
      
      // Ako Auth0 redirect-uje na base URL umesto na /login, redirect-uj na login
      if (location && (location === baseURL || location === `${baseURL}/`)) {
        return NextResponse.redirect(loginURL);
      }
      
      // Ako location ne sadrži /login i nije Auth0 endpoint, redirect-uj na login
      if (location && !location.includes('/login') && !location.includes('auth0.com')) {
        return NextResponse.redirect(loginURL);
      }
    }
    
    return response;
  } catch (error) {
    console.error('[Logout] Error:', error);
    // Fallback: redirect na login
    const baseURL = process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(new URL('/login', baseURL));
  }
}
