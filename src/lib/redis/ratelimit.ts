// src/lib/redis/ratelimit.ts
// Lazy Upstash Redis rate limiter — safe to import even when env vars are placeholders

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Check if Upstash is actually configured
function isUpstashConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';
  return url.startsWith('https://') && token.length > 0 && !url.includes('PASTE_');
}

// Lazy singleton
let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    if (!isUpstashConfigured()) {
      throw new Error('[RateLimit] Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars.');
    }
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

function makeLimiter(requests: number, windowSeconds: number) {
  return {
    limit: async (identifier: string) => {
      if (!isUpstashConfigured()) {
        if (process.env.NODE_ENV === 'production') {
          // FAIL CLOSED in production — missing Upstash config is a deployment error
          console.error('[RateLimit] FATAL: Upstash not configured in production. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
          return { success: false, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve() };
        }
        // Dev/staging: allow all
        return { success: true, limit: requests, remaining: requests, reset: 0, pending: Promise.resolve() };
      }
      const limiter = new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
      });
      return limiter.limit(identifier);
    },
  };
}

export const orderRateLimit         = makeLimiter(10, 600);  // 10/10min
export const pinLoginRateLimit      = makeLimiter(5, 900);   // 5/15min
export const ownerLoginRateLimit    = makeLimiter(10, 3600); // 10/1hr
export const paymentUploadRateLimit = makeLimiter(5, 300);   // 5/5min
export const menuFetchRateLimit     = makeLimiter(100, 60);  // 100/1min
export const promoValidateRateLimit = makeLimiter(20, 60);   // 20/min per IP — promo enumeration guard
export const feedbackRateLimit      = makeLimiter(5, 300);   // 5/5min per IP — rating spam guard
export const discoveryRateLimit     = makeLimiter(3, 3600);  // 3/1hr per IP — discovery form spam guard
