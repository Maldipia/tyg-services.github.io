export const dynamic = 'force-dynamic';
// POST /api/promo-codes/validate
// Public endpoint — customers enter a code at checkout.
// Returns the discount details without exposing all promo data.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveTenant, apiSuccess, apiError, getClientIp } from '@/lib/auth/middleware';
import { promoValidateRateLimit } from '@/lib/redis/ratelimit';
import { createServiceClient } from '@/lib/supabase/client';

const ValidateSchema = z.object({
  tenantSlug:  z.string().min(1),
  code:        z.string().min(1).max(30).trim().toUpperCase(),
  orderAmount: z.number().min(0),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate-limited: 10/10min per IP — prevents promo code enumeration
  const { success } = await promoValidateRateLimit.limit(getClientIp(req));
  if (!success) return apiError('Too many requests. Please wait.', 429);

  let body: unknown;
  try { body = await req.json(); } catch { return apiError('Invalid JSON', 400); }
  const parsed = ValidateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

  const tenant = await resolveTenant(parsed.data.tenantSlug);
  if (!tenant) return apiError('Tenant not found', 404);

  const db = createServiceClient();
  const { data: promo } = await db
    .from('promo_codes')
    .select('id, code, description, discount_type, discount_value, min_order_amount, usage_limit, usage_count, starts_at, expires_at, is_active')
    .eq('tenant_id', tenant.tenantId)
    .eq('code', parsed.data.code)
    .eq('is_active', true)
    .maybeSingle();

  if (!promo) return apiError('Invalid or expired promo code', 404, 'PROMO_INVALID');

  const now = new Date();
  if (promo.starts_at && new Date(promo.starts_at) > now) return apiError('This promo is not yet active', 400, 'PROMO_NOT_STARTED');
  if (promo.expires_at && new Date(promo.expires_at) < now) return apiError('This promo has expired', 400, 'PROMO_EXPIRED');
  if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) return apiError('This promo has reached its usage limit', 400, 'PROMO_EXHAUSTED');
  if (parsed.data.orderAmount < (promo.min_order_amount ?? 0)) return apiError(`Minimum order of ₱${promo.min_order_amount} required`, 400, 'PROMO_MIN_NOT_MET');

  // Calculate discount amount
  const discountAmount = promo.discount_type === 'PERCENT'
    ? Math.round(parsed.data.orderAmount * (promo.discount_value / 100) * 100) / 100
    : Math.min(promo.discount_value, parsed.data.orderAmount);

  return apiSuccess({
    promoId:        promo.id,
    code:           promo.code,
    description:    promo.description,
    discountType:   promo.discount_type,
    discountValue:  promo.discount_value,
    discountAmount,
    finalAmount:    Math.max(0, parsed.data.orderAmount - discountAmount),
  });
}
