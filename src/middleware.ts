// ============================================================
// TYG POS — Next.js Edge Middleware
// Handles: admin route protection, public route passthrough,
// and tenant subdomain routing (if custom domains used)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/admin/:path*',
    '/kitchen/:path*',
    '/api/admin/:path*',
  ],
};

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // ── Admin routes: require staff session cookie ─────────────
  // Full validation happens in API route middleware (withStaffAuth).
  // This edge check is a fast redirect for users without any cookie.
  if (pathname.startsWith('/admin') || pathname.startsWith('/kitchen')) {
    const sessionCookie = req.cookies.get('tyg-staff-session');

    if (!sessionCookie) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── CRON routes: require CRON_SECRET ──────────────────────
  if (pathname.startsWith('/api/cron')) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}
