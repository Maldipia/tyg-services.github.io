export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

const CreateSchema = z.object({
  code:           z.string().min(2).max(30).trim().toUpperCase(),
  description:    z.string().max(200).optional(),
  discountType:   z.enum(['PERCENT','FIXED']),
  discountValue:  z.number().min(0.01).max(100),
  minOrderAmount: z.number().min(0).default(0),
  usageLimit:     z.number().int().min(1).nullable().optional(),
  startsAt:       z.string().datetime({ offset: true }).nullable().optional(),
  expiresAt:      z.string().datetime({ offset: true }).nullable().optional(),
  isActive:       z.boolean().default(true),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    const db = createServiceClient();
    const { data, error } = await db
      .from('promo_codes')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false });
    if (error) return apiError('Failed to fetch promo codes', 500);
    return apiSuccess(data ?? []);
  }, ['OWNER', 'ADMIN']);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

    if (parsed.data.discountType === 'PERCENT' && parsed.data.discountValue > 100) {
      return apiError('Percent discount cannot exceed 100%', 400);
    }

    const db = createServiceClient();
    const { data, error } = await db
      .from('promo_codes')
      .insert({
        tenant_id:        ctx.tenantId,
        code:             parsed.data.code,
        description:      parsed.data.description ?? null,
        discount_type:    parsed.data.discountType,
        discount_value:   parsed.data.discountValue,
        min_order_amount: parsed.data.minOrderAmount,
        usage_limit:      parsed.data.usageLimit ?? null,
        starts_at:        parsed.data.startsAt ?? null,
        expires_at:       parsed.data.expiresAt ?? null,
        is_active:        parsed.data.isActive,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return apiError(`Code "${parsed.data.code}" already exists`, 409);
      return apiError('Failed to create promo code', 500);
    }
    return apiSuccess(data, 201);
  }, ['OWNER', 'ADMIN']);
}
