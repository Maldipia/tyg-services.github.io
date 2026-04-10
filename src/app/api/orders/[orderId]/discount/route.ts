export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';

const DiscountSchema = z.object({
  discountType: z.enum(['PWD', 'SENIOR', 'PROMO']).nullable(),
  pwdCount:     z.number().int().min(0).max(50).default(0),
  seniorCount:  z.number().int().min(0).max(50).default(0),
  pax:          z.number().int().min(1).max(50).default(1),
  note:         z.string().max(200).optional(),
});

type Params = { params: { orderId: string } };

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { orderId } = params;
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return apiError('Invalid order ID', 400);

    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = DiscountSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

    const db = createServiceClient();
    const { discountType, pwdCount, seniorCount, pax } = parsed.data;

    // Fetch order to get current totals
    const { data: order, error: oErr } = await db.from('orders')
      .select('id, subtotal_override, total_amount, service_charge, pax, tenant_id')
      .eq('id', orderId).eq('tenant_id', ctx.tenantId).single();
    if (oErr || !order) return apiError('Order not found', 404);

    const subtotal      = Number(order.subtotal_override ?? order.total_amount);
    const serviceCharge = Number(order.service_charge ?? 0);
    const orderPax      = pax || Number(order.pax) || 1;

    let discountAmount = 0;
    let discountPct    = 0;

    if (discountType === null) {
      // Clear discount
      const { error } = await db.from('orders').update({
        discount_type: null, discount_pct: 0, discount_amount: 0,
        discounted_total: null,
        total_amount: subtotal + serviceCharge,
      }).eq('id', orderId).eq('tenant_id', ctx.tenantId);
      if (error) return apiError('Failed to clear discount', 500);
      return apiSuccess({ discountType: null, discountAmount: 0, newTotal: subtotal + serviceCharge });
    }

    if (discountType === 'PWD' || discountType === 'SENIOR') {
      const qualifying = Math.min((pwdCount || 0) + (seniorCount || 0), orderPax);
      if (qualifying > 0) {
        discountPct    = 20;
        const perPerson = subtotal / orderPax;
        discountAmount  = Math.round(perPerson * qualifying * 0.20 * 100) / 100;
      }
    }

    const newTotal = Math.max(0, Math.round((subtotal + serviceCharge - discountAmount) * 100) / 100);

    const { error } = await db.from('orders').update({
      discount_type:    discountType,
      discount_pct:     discountPct,
      pwd_count:        pwdCount || 0,
      senior_count:     seniorCount || 0,
      discount_amount:  discountAmount,
      discounted_total: newTotal,
      total_amount:     newTotal,
    }).eq('id', orderId).eq('tenant_id', ctx.tenantId);

    if (error) return apiError(`Failed to apply discount: ${error.message}`, 500);

    return apiSuccess({
      discountType, discountAmount, discountPct,
      newTotal,
      qualifying: (pwdCount || 0) + (seniorCount || 0),
    });
  }, ['OWNER', 'ADMIN', 'CASHIER']);
}
