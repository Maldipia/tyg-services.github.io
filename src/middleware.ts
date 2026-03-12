// ============================================================
// TYG POS — Next.js Edge Middleware
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/admin/:path*',
    '/kitchen/:path*',
    '/superadmin/:path*',
    '/api/cron/:path*',
  ],
};

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // ── Admin + Kitchen: require staff session cookie ─────────
  if (pathname.startsWith('/admin') || pathname.startsWith('/kitchen')) {
    const sessionCookie = req.cookies.get('tyg-staff-session');
    if (!sessionCookie) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Super Admin: require superadmin cookie ────────────────
  if (pathname.startsWith('/superadmin') && !pathname.startsWith('/superadmin/login')) {
    const saCookie = req.cookies.get('tyg_superadmin');
    if (!saCookie) {
      return NextResponse.redirect(new URL('/superadmin/login', req.url));
    }
  }

  // ── CRON routes: require CRON_SECRET ─────────────────────
  if (pathname.startsWith('/api/cron')) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}
