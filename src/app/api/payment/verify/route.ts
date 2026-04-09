export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { writeSheetsAction } from '@/lib/sheets/direct';
import type { AuthContext } from '@/types';
import { logEvent } from '@/lib/logger';
import { sendPaymentVerifiedEmail } from '@/lib/resend/email';

const VerifySchema = z.object({
  paymentId: z.string().uuid('Invalid paymentId'),
  orderId:   z.string().uuid('Invalid orderId'),
  action:    z.enum(['verify', 'reject'], { errorMap: () => ({ message: 'action must be verify or reject' }) }),
  reason:    z.string().max(500).optional(),
});

export function PATCH(req: NextRequest) {
  return withStaffAuth(req, handleVerify, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}

// Handle CORS preflight
export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

async function handleVerify(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = VerifySchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
  }

  const { paymentId, orderId, action, reason } = parsed.data;

  if (action === 'reject' && !reason?.trim()) {
    return apiError('reason is required when rejecting a payment', 400);
  }

  const supabase = createServiceClient();

  // Fetch payment + ensure it belongs to this tenant's order
  const { data: payment, error: pmtErr } = await supabase
    .from('payments')
    .select('id, order_id, status, proof_url, method, amount')
    .eq('id', paymentId)
    .eq('order_id', orderId)
    .single();

  if (pmtErr || !payment) return apiError('Payment not found', 404);
  if (payment.status === 'VERIFIED') return apiError('Payment already verified', 409);

  // Verify order belongs to this tenant
  const { data: order, error: ordErr } = await supabase
    .from('orders')
    .select('id, tenant_id, order_number, total_amount, customer_name, customer_email')
    .eq('id', orderId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (ordErr || !order) return apiError('Order not found or access denied', 404);

  const newStatus = action === 'verify' ? 'VERIFIED' : 'REJECTED';
  const now = new Date().toISOString();

  // Update payment
  const { error: updateErr } = await supabase
    .from('payments')
    .update({
      status: newStatus,
      verified_at: action === 'verify' ? now : null,
      verified_by: ctx.staffId,
      rejection_reason: action === 'reject' ? reason : null,
    })
    .eq('id', paymentId);

  if (updateErr) return apiError('Failed to update payment', 500);

  // If verified: mark order as payment-complete
  if (action === 'verify') {
    await supabase
      .from('orders')
      .update({ payment_status: 'VERIFIED', updated_at: now })
      .eq('id', orderId)
      .eq('tenant_id', ctx.tenantId);
  }

  // Send payment verified email to customer (fire-and-forget)
  if (action === 'verify') {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', ctx.tenantId)
      .single();
    const orderWithEmail = order as typeof order & { customer_email?: string };
    if (orderWithEmail.customer_email) {
      void sendPaymentVerifiedEmail(
        orderWithEmail.customer_email,
        order.customer_name as string,
        order.order_number as string,
        Number(order.total_amount),
        tenant?.name ?? 'TYG POS'
      ).catch((e) => console.error('Payment email failed:', e));
    }
  }

  // Audit log
  // logEvent below is the single audit trail (system_logs)
  void logEvent({
    eventType: action === 'verify' ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
    entityType: 'PAYMENT',
    entityId: paymentId,
    tenantId: ctx.tenantId,
    userId: ctx.staffId,
    userName: ctx.displayName ?? undefined,
    source: 'ADMIN',
    details: {
      orderId,
      action,
      reason: reason ?? null,
    },
  });

  writeSheetsAction('UPDATE_PAYMENT', {
    tenantId: ctx.tenantId,
    paymentId,
    orderId,
    orderNumber: order.order_number,
    status: newStatus,
    verifiedBy: ctx.displayName,
  }).catch(() => {});

  return apiSuccess({ paymentId, status: newStatus });
}
