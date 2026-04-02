export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

const UpdateSchema = z.object({
  description:    z.string().max(200).optional(),
  discountValue:  z.number().min(0.01).max(100).optional(),
  minOrderAmount: z.number().min(0).optional(),
  usageLimit:     z.number().int().min(1).nullable().optional(),
  startsAt:       z.string().datetime({ offset: true }).nullable().optional(),
  expiresAt:      z.string().datetime({ offset: true }).nullable().optional(),
  isActive:       z.boolean().optional(),
});

type Params = { params: { promoId: string } };

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

    const updates: Record<string, unknown> = {};
    if (parsed.data.description !== undefined)    updates['description']      = parsed.data.description;
    if (parsed.data.discountValue !== undefined)  updates['discount_value']   = parsed.data.discountValue;
    if (parsed.data.minOrderAmount !== undefined) updates['min_order_amount'] = parsed.data.minOrderAmount;
    if (parsed.data.usageLimit !== undefined)     updates['usage_limit']      = parsed.data.usageLimit;
    if (parsed.data.startsAt !== undefined)       updates['starts_at']        = parsed.data.startsAt;
    if (parsed.data.expiresAt !== undefined)      updates['expires_at']       = parsed.data.expiresAt;
    if (parsed.data.isActive !== undefined)       updates['is_active']        = parsed.data.isActive;

    const db = createServiceClient();
    const { data, error } = await db
      .from('promo_codes')
      .update(updates)
      .eq('id', params.promoId)
      .eq('tenant_id', ctx.tenantId)
      .select()
      .single();

    if (error || !data) return apiError('Promo code not found', 404);
    return apiSuccess(data);
  }, ['OWNER', 'ADMIN']);
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    const db = createServiceClient();
    const { error } = await db
      .from('promo_codes')
      .update({ is_active: false })
      .eq('id', params.promoId)
      .eq('tenant_id', ctx.tenantId);
    if (error) return apiError('Failed to deactivate promo code', 500);
    return apiSuccess({ deactivated: true });
  }, ['OWNER', 'ADMIN']);
}
