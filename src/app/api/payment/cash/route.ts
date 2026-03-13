export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — POST /api/payment/cash
// Instantly marks an order as paid via cash.
// No proof upload needed — CASHIER / OWNER / ADMIN only.
// Idempotent: returns existing payment if already paid.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { logEvent } from '@/lib/logger';

const Schema = z.object({
  orderId:    z.string().uuid(),
  amountPaid: z.number().positive().optional(),
  notes:      z.string().max(200).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
    const { orderId, amountPaid, notes } = parsed.data;

    const db = createServiceClient();

    const { data: order } = await db
      .from('orders')
      .select('id, order_number, status, total_amount, payment_status')
      .eq('id', orderId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (!order) return apiError('Order not found', 404);
    if (order.status === 'CANCELLED') return apiError('Cannot record payment for a cancelled order', 400);

    // Idempotency: already verified
    if (order.payment_status === 'VERIFIED') {
      const { data: existing } = await db
        .from('payments')
        .select('id, method, amount, status, created_at')
        .eq('order_id', orderId)
        .eq('status', 'VERIFIED')
        .maybeSingle();
      return apiSuccess({ alreadyPaid: true, payment: existing });
    }

    const amount = amountPaid ?? Number(order.total_amount);

    const { data: payment, error: payErr } = await db
      .from('payments')
      .insert({
        tenant_id:   ctx.tenantId,
        order_id:    orderId,
        method:      'CASH',
        amount,
        status:      'VERIFIED',
        proof_url:   null,
        notes:       notes ?? null,
        verified_by: ctx.staffId,
        verified_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .select('id, method, amount, status, created_at')
      .single();

    if (payErr || !payment) {
      console.error('Cash payment insert error:', payErr);
      return apiError('Failed to record payment', 500);
    }

    // Update order payment_status atomically
    await db
      .from('orders')
      .update({ payment_status: 'VERIFIED', updated_at: new Date().toISOString() } as Record<string, unknown>)
      .eq('id', orderId);

    void logEvent({
      eventType:  'PAYMENT_VERIFIED',
      entityType: 'PAYMENT',
      entityId:   payment.id as string,
      tenantId:   ctx.tenantId,
      userId:     ctx.staffId,
      userName:   ctx.displayName ?? undefined,
      source:     'ADMIN',
      status:     'SUCCESS',
      details:    { orderId, orderNumber: order.order_number, method: 'CASH', amount },
    });

    return apiSuccess({ alreadyPaid: false, payment });
  }, ['OWNER', 'ADMIN', 'CASHIER']);
}
