import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth0 } from "./lib/auth0";

export async function middleware(request: NextRequest) {
  if (!process.env.AUTH0_ISSUER_BASE_URL) {
    console.error("[Middleware] AUTH0_ISSUER_BASE_URL is not set!");
    return new Response("Auth0 configuration error", { status: 500 });
  }

  const pathname = request.nextUrl.pathname;

  if (pathname === "/auth/profile") return NextResponse.next();
  if (pathname === "/pending-approval") return NextResponse.next();
  if (pathname === "/api/auth/check-approval") return NextResponse.next();
  if (pathname === "/api/internal/start-mail-sync") return NextResponse.next();
  // Vercel Cron — autentifikacija Bearer CRON_SECRET unutar rute
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();
  // /api/files/* — auth done inside route so fetch() with credentials works reliably for img/video
  if (pathname.startsWith("/api/files/")) return NextResponse.next();
  if (pathname === "/login") return NextResponse.redirect(new URL("/auth/login", request.url));

  if (pathname === "/") {
    try {
      const session = await auth0.getSession(request);
      if (!session || !session.user) return NextResponse.redirect(new URL("/auth/login", request.url));
    } catch {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  return await auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|auth/profile).*)"],
};
