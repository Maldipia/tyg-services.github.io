// src/app/api/payment/verify/route.ts
// PATCH — Staff verifies a payment proof
// Triggers Drive file move to PAYMENT/processed/ via Apps Script

import { NextRequest } from 'next/server';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { fireSheetsWebhook } from '@/lib/sheets/webhook';
import type { AuthContext } from '@/types';

interface VerifyBody {
  paymentId: string;
  orderId: string;
  action: 'verify' | 'reject';
  reason?: string; // required when action === 'reject'
}

export function PATCH(req: NextRequest) {
  return withStaffAuth(req, handleVerify, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}

async function handleVerify(req: NextRequest, ctx: AuthContext): Promise<Response> {
  const body = await req.json() as VerifyBody;
  const { paymentId, orderId, action, reason } = body;

  if (!paymentId || !orderId || !action) {
    return apiError('paymentId, orderId, and action are required', 400);
  }
  if (action === 'reject' && !reason?.trim()) {
    return apiError('reason is required when rejecting a payment', 400);
  }

  const supabase = createServiceClient();

  // ── Fetch payment + order ──────────────────────────────────
  const { data: payment, error: pmtErr } = await supabase
    .from('payments')
    .select('id, order_id, status, proof_url, method, amount')
    .eq('id', paymentId)
    .eq('order_id', orderId)
    .single();

  if (pmtErr || !payment) return apiError('Payment not found', 404);
  if (payment.status === 'VERIFIED') return apiError('Payment already verified', 409);

  // ── Fetch order for tenant isolation check ────────────────
  const { data: order, error: ordErr } = await supabase
    .from('orders')
    .select('id, tenant_id, order_number, customer_name, customer_email')
    .eq('id', orderId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (ordErr || !order) return apiError('Order not found or access denied', 404);

  const now = new Date().toISOString();
  const newPaymentStatus = action === 'verify' ? 'VERIFIED' : 'FAILED';
  const newOrderPaymentStatus = action === 'verify' ? 'VERIFIED' : 'FAILED';

  // ── Update payment in Supabase ────────────────────────────
  const { error: updatePmtErr } = await supabase
    .from('payments')
    .update({
      status:       newPaymentStatus,
      verified_by:  ctx.staffId ?? null,
      verified_at:  now,
      notes:        action === 'reject' ? reason : null,
    })
    .eq('id', paymentId);

  if (updatePmtErr) return apiError('Failed to update payment', 500);

  // ── Update order payment_status ───────────────────────────
  await supabase
    .from('orders')
    .update({ payment_status: newOrderPaymentStatus, updated_at: now })
    .eq('id', orderId);

  // ── Log order event ───────────────────────────────────────
  await supabase.from('order_events').insert({
    order_id:   orderId,
    tenant_id:  ctx.tenantId,
    event_type: `PAYMENT_${action.toUpperCase()}ED`,
    from_status: payment.status,
    to_status:   newPaymentStatus,
    staff_id:    ctx.staffId ?? null,
    notes:       action === 'reject' ? reason : null,
  });

  // ── Fire Drive routing webhook (fire-and-forget) ──────────
  const supabaseFilePath = payment.proof_url?.replace(/^.*payment-proofs\//, '') ?? '';

  if (action === 'verify') {
    void fireSheetsWebhook('VERIFY_PAYMENT', {
      payment_id:          paymentId,
      order_id:            orderId,
      order_number:        order.order_number,
      verified_by:         ctx.displayName ?? 'Staff',
      supabase_file_path:  supabaseFilePath,
    });
  } else {
    void fireSheetsWebhook('REJECT_PAYMENT', {
      payment_id:          paymentId,
      order_id:            orderId,
      order_number:        order.order_number,
      rejected_by:         ctx.displayName ?? 'Staff',
      reason:              reason,
      supabase_file_path:  supabaseFilePath,
    });
  }

  return apiSuccess({
    paymentId,
    orderId,
    action,
    newStatus: newPaymentStatus,
    message: action === 'verify'
      ? 'Payment verified. Proof moving to Drive/processed.'
      : 'Payment rejected. Proof moving to Drive/reject.',
  });
}
