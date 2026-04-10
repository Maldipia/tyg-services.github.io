// ================================================================
// TYG POS — Super Admin Auth
// Cookie stores HMAC-SHA256(secret, timestamp) — never raw secret.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const COOKIE_NAME = 'tyg_superadmin';
const SESSION_HOURS = 24;

// Derive a signed token from the secret + a daily salt (rotates daily)
async function deriveToken(secret: string): Promise<string> {
  const daySalt = new Date().toISOString().slice(0, 10); // "2026-03-12"
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`superadmin:${daySalt}`));
  return Buffer.from(sig).toString('base64url');
}

export async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  const SECRET = process.env.SUPERADMIN_SECRET;
  if (!SECRET) return false;
  try {
    const expected = await deriveToken(SECRET);
    // Also allow yesterday's token (grace period across midnight)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigYesterday = await crypto.subtle.sign('HMAC', key, encoder.encode(`superadmin:${yesterday}`));
    const expectedYesterday = Buffer.from(sigYesterday).toString('base64url');
    return cookie === expected || cookie === expectedYesterday;
  } catch { return false; }
}

export async function setSuperAdminCookie(res: NextResponse): Promise<NextResponse> {
  const SECRET = process.env.SUPERADMIN_SECRET;
  if (!SECRET) return res;
  const token = await deriveToken(SECRET);
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_HOURS * 60 * 60,
    path: '/',
  });
  return res;
}

export function clearSuperAdminCookie(res: NextResponse): NextResponse {
  res.cookies.delete(COOKIE_NAME);
  return res;
}

export function superAdminUnauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Upstash-backed rate limiter for superadmin login
export async function checkSuperAdminRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();
    const limiter = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(5, '15 m'), prefix: 'sa_login' });
    const { success, remaining } = await limiter.limit(ip);
    return { allowed: success, remaining };
  } catch {
    // Redis unavailable — fallback allow (fail open is safer than locking out admins)
    return { allowed: true, remaining: 4 };
  }
}

// Log security events to DB (non-blocking)
export function logSecurityEvent(
  eventType: string,
  ip: string,
  metadata: Record<string, unknown> = {}
): void {
  try {
    const db = createServiceClient();
    void db.from('security_events').insert({ event_type: eventType, ip, metadata });
  } catch { /* non-blocking */ }
}
