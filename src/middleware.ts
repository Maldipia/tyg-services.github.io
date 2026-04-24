// ============================================================
// TYG POS — Next.js Edge Middleware
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/admin/:path*',
    '/kitchen/:path*',
    '/superadmin/:path*',
  ],
};

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // ── Admin + Kitchen: require staff session cookie ─────────
  if (pathname.startsWith('/admin') || pathname.startsWith('/kitchen')) {
    const sessionCookie = req.cookies.get('tyg-staff-session');
    if (!sessionCookie) {
      // Redirect to /login — user must enter their café slug
      // Tenant slug is part of the URL path /login/[tenant], not a query param
      const loginUrl = new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Super Admin: require superadmin cookie (existence check) ─
  // Full HMAC verification happens in the API route handlers (async).
  // Edge middleware: check presence + basic non-empty value.
  if (pathname.startsWith('/superadmin') && !pathname.startsWith('/superadmin/login')) {
    const saCookie = req.cookies.get('tyg_superadmin');
    if (!saCookie?.value || saCookie.value.length < 10) {
      return NextResponse.redirect(new URL('/superadmin/login', req.url));
    }
  }

  return NextResponse.next();
}
