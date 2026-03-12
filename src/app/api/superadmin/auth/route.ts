export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { setSuperAdminCookie, clearSuperAdminCookie } from '@/lib/auth/superadmin';
import { getClientIp } from '@/lib/auth/middleware';

// Simple in-memory rate limiter for superadmin (edge-safe)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 min

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = attempts.get(ip);

  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { secret, action } = body as { secret?: string; action?: string };

  if (action === 'logout') {
    return clearSuperAdminCookie(NextResponse.json({ ok: true }));
  }

  // Rate limit login attempts
  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
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
    return NextResponse.json(
      { error: `Invalid password. ${remaining} attempts remaining.` },
      { status: 401 }
    );
  }

  // Clear rate limit on success
  attempts.delete(ip);

  return setSuperAdminCookie(NextResponse.json({ ok: true }));
}
