export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { fireSheetsWebhook } from '@/lib/sheets/webhook';
import type { AuthContext } from '@/types';

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
    .select('id, tenant_id, order_number, total_amount, customer_name')
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
      .update({ payment_status: 'PAID', updated_at: now })
      .eq('id', orderId)
      .eq('tenant_id', ctx.tenantId);
  }

  // Audit log
  await supabase.from('audit_log').insert({
    actor: ctx.staffId,
    action: action === 'verify' ? 'PAYMENT_VERIFY' : 'PAYMENT_REJECT',
    target_type: 'payment',
    target_id: paymentId,
    metadata: { orderId, amount: order.total_amount, reason: reason ?? null },
  });

  // Fire-and-forget Sheets sync
  fireSheetsWebhook('UPDATE_PAYMENT', {
    tenantId: ctx.tenantId,
    paymentId,
    orderId,
    orderNumber: order.order_number,
    status: newStatus,
    verifiedBy: ctx.displayName,
  }).catch(() => {});

  return apiSuccess({ paymentId, status: newStatus });
}
