export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { setSuperAdminCookie, clearSuperAdminCookie, checkSuperAdminRateLimit, logSecurityEvent } from '@/lib/auth/superadmin';
import { getClientIp } from '@/lib/auth/middleware';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { secret, action } = body as { secret?: string; action?: string };

  if (action === 'logout') {
    return clearSuperAdminCookie(NextResponse.json({ ok: true }));
  }

  // Rate limit with Upstash Redis (persistent across serverless instances)
  const { allowed, remaining } = await checkSuperAdminRateLimit(ip);
  if (!allowed) {
    logSecurityEvent('SUPERADMIN_RATE_LIMITED', ip);
    return NextResponse.json(
      { error: 'Too many attempts. Try again in 15 minutes.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    );
  }

  const SECRET = process.env.SUPERADMIN_SECRET;
  if (!SECRET) {
    console.error('[SuperAdmin] SUPERADMIN_SECRET env var is not set!');
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 503 });
  }

  if (!secret || secret !== SECRET) {
    logSecurityEvent('SUPERADMIN_LOGIN_FAILED', ip, { remaining });
    return NextResponse.json(
      { error: `Invalid password. ${remaining} attempts remaining.` },
      { status: 401 }
    );
  }

  logSecurityEvent('SUPERADMIN_LOGIN_SUCCESS', ip);
  return setSuperAdminCookie(NextResponse.json({ ok: true }));
}
