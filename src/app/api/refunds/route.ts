export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { logEvent } from '@/lib/logger';

const CreateRefundSchema = z.object({
  orderId:    z.string().uuid(),
  refundType: z.enum(['FULL','PARTIAL','VOID']),
  amount:     z.number().min(0.01).max(999999),
  reason:     z.string().min(1).max(500),
  reasonCode: z.enum(['CUSTOMER_REQUEST','WRONG_ORDER','QUALITY_ISSUE','DUPLICATE','OTHER']).optional(),
  notes:      z.string().max(500).optional(),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const db = createServiceClient();

    let query = db
      .from('refunds')
      .select(`id, refund_type, amount, reason, reason_code, notes, created_at,
        staff:staff!processed_by(display_name),
        order:orders!order_id(order_number, total_amount)`)
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (orderId) query = query.eq('order_id', orderId);

    const { data, error } = await query;
    if (error) return apiError('Failed to fetch refunds', 500);
    return apiSuccess(data ?? []);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = CreateRefundSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

    const db = createServiceClient();

    // Validate order belongs to tenant
    const { data: order } = await db
      .from('orders')
      .select('id, total_amount, status, order_number')
      .eq('id', parsed.data.orderId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (!order) return apiError('Order not found', 404);

    // For FULL refund, amount must equal order total
    if (parsed.data.refundType === 'FULL') {
      const fullAmount = Number(order.total_amount);
      if (Math.abs(parsed.data.amount - fullAmount) > 1) {
        return apiError(`Full refund must be for the full amount (₱${fullAmount.toFixed(2)})`, 400);
      }
    }

    const { data, error } = await db
      .from('refunds')
      .insert({
        tenant_id:    ctx.tenantId,
        order_id:     parsed.data.orderId,
        refund_type:  parsed.data.refundType,
        amount:       parsed.data.amount,
        reason:       parsed.data.reason,
        reason_code:  parsed.data.reasonCode ?? null,
        notes:        parsed.data.notes ?? null,
        processed_by: ctx.staffId,
      })
      .select()
      .single();

    if (error || !data) return apiError('Failed to create refund', 500);

    // If FULL or VOID, update order payment_status to REFUNDED
    if (parsed.data.refundType !== 'PARTIAL') {
      await db.from('orders').update({ payment_status: 'REFUNDED' }).eq('id', parsed.data.orderId);
      await db.from('payments').update({ status: 'REFUNDED' }).eq('order_id', parsed.data.orderId).eq('tenant_id', ctx.tenantId);
    }

    void logEvent({ eventType: 'REFUND_ISSUED', entityType: 'ORDER', entityId: parsed.data.orderId, tenantId: ctx.tenantId, source: 'ADMIN', details: { refundType: parsed.data.refundType, amount: parsed.data.amount, reason: parsed.data.reason } });
    return apiSuccess(data, 201);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}
