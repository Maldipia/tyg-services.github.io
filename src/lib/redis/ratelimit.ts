// ============================================================
// TYG POS — Upstash Redis Rate Limiter
//
// ARCHITECTURE RULE: Rate limiting MUST use Upstash Redis.
// In-memory Maps reset on every Vercel cold start — useless.
// Upstash persists across serverless instances globally.
// ============================================================

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── Rate Limit Configurations ────────────────────────────────

// Order creation: 10 orders per 10 minutes per IP (prevents order spam)
export const orderRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 m'),
  prefix: 'tyg:order',
  analytics: true,
});

// PIN login: 5 attempts per 15 minutes per IP (brute-force protection)
export const pinLoginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'tyg:pin',
  analytics: true,
});

// Owner login: 10 attempts per hour per IP
export const ownerLoginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'tyg:owner_login',
  analytics: true,
});

// Payment proof upload: 5 per 5 minutes per IP
export const paymentUploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'),
  prefix: 'tyg:payment_upload',
  analytics: true,
});

// Menu fetch: 100 per minute per tenant (high — customers browsing)
export const menuFetchRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: 'tyg:menu_fetch',
  analytics: true,
});

// ── Helper ───────────────────────────────────────────────────
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const { success, remaining, reset } = await limiter.limit(identifier);
  return { success, remaining, reset };
}
