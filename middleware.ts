import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth0 } from "./lib/auth0";

export async function middleware(request: NextRequest) {
  // Proveri da li su Auth0 varijable postavljene
  if (!process.env.AUTH0_ISSUER_BASE_URL) {
    console.error("[Middleware] AUTH0_ISSUER_BASE_URL is not set!");
    return new Response("Auth0 configuration error", { status: 500 });
  }
  
  const pathname = request.nextUrl.pathname;
  
  // Za /auth/profile, POTPUNO preskoči Auth0 middleware
  // Profile ruta će sama vratiti 204 ako nema session-a
  if (pathname === '/auth/profile') {
    return NextResponse.next();
  }
  
  // Za /login stranicu, direktno redirect na Auth0 login
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
  
  // Za base URL (/) nakon logout-a, proveri da li korisnik nije ulogovan i redirect-uj direktno na Auth0
  if (pathname === '/') {
    try {
      const session = await auth0.getSession(request);
      // Ako nema session-a, redirect-uj direktno na Auth0 login
      if (!session || !session.user) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }
    } catch (error) {
      // Ako ima grešku pri dobijanju session-a, redirect-uj direktno na Auth0 login
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }
  
  // Za /auth/logout, dozvoli Auth0 SDK da ga obradi
  // SDK će pozvati našu custom rutu u app/auth/logout/route.ts
  // Auth0 SDK automatski rukuje sa /auth/logout i ostalim /api/auth/* i /auth/* rutama
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - /api/auth/profile (preskačemo jer vraća 204 umesto 401)
     * 
     * Auth0 SDK automatski rukuje sa /api/auth/* i /auth/* rutama kroz middleware
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|auth/profile).*)",
  ],
};
