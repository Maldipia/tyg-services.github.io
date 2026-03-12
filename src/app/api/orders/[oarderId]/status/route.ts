// ============================================================
// TYG POS — PATCH /api/orders/[orderId]/status
// Staff-only endpoint. All auth guards enforced here.
// Auth guard on EVERY endpoint — not just in UI.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import type { OrderStatus, AuthContext } from '@/types';
import { fireSheetsWebhook } from '@/lib/sheets/webhook';

const CANCEL_REASONS = [
  'Customer changed mind',
  'Item out of stock',
  'Duplicate order',
  'Payment not received',
  'Test order / migration cleanup',
  'Other',
] as const;

const StatusUpdateSchema = z.object({
  status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
  cancelReason: z.enum(CANCEL_REASONS).optional(),
  cancelNote: z.string().max(500).optional(),
});

type Params = { params: { orderId: string } };

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(
    req,
    async (request, ctx: AuthContext) => {
      const { orderId } = params;

      if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
        return apiError('Invalid order ID', 400);
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return apiError('Invalid JSON', 400);
      }

      const parseResult = StatusUpdateSchema.safeParse(body);
      if (!parseResult.success) {
        return apiError(parseResult.error.errors[0]?.message ?? 'Validation error', 400);
      }

      const { status: newStatus, cancelReason, cancelNote } = parseResult.data;
      const db = createServiceClient();

      // Fetch order — MUST belong to this staff's tenant
      const { data: order, error: fetchError } = await db
        .from('orders')
        .select('id, tenant_id, branch_id, status, order_number')
        .eq('id', orderId)
        .eq('tenant_id', ctx.tenantId) // ← tenant isolation enforced here
        .single();

      if (fetchError || !order) {
        return apiError('Order not found', 404, 'NOT_FOUND');
      }

      // Branch-level staff can only update orders from their branch
      if (
        ctx.branchId !== null &&
        order.branch_id !== null &&
        ctx.branchId !== order.branch_id
      ) {
        return apiError('You do not have access to this order', 403, 'FORBIDDEN');
      }

      // Validate status transition
      const currentStatus = order.status as OrderStatus;
      if (!isValidTransition(currentStatus, newStatus)) {
        return apiError(
          `Cannot transition from ${currentStatus} to ${newStatus}`,
          400,
          'INVALID_TRANSITION'
        );
      }

      if (newStatus === 'CANCELLED' && !cancelReason) {
        return apiError('Cancel reason is required', 400, 'CANCEL_REASON_REQUIRED');
      }

      // Build update payload
      const updatePayload: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'CANCELLED') {
        updatePayload['cancel_reason'] = cancelReason;
        updatePayload['cancel_note'] = cancelNote ?? null;
      }

      const { error: updateError } = await db
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .eq('tenant_id', ctx.tenantId);

      if (updateError) {
        return apiError('Failed to update order status', 500);
      }

      // Log event to audit trail
      await db.from('order_events').insert({
        tenant_id: ctx.tenantId,
        order_id: orderId,
        event_type: 'status_change',
        from_status: currentStatus,
        to_status: newStatus,
        staff_id: ctx.staffId,
        metadata: {
          cancelReason: cancelReason ?? null,
          cancelNote: cancelNote ?? null,
        },
      });


      // Fire-and-forget sheets webhook
      fireSheetsWebhook('UPDATE_ORDER', {
        orderNumber: (currentOrder as { order_number: string }).order_number ?? orderId,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});

      return apiSuccess({ orderId, status: newStatus });
    },
    // KITCHEN can update to PREPARING/READY; CASHIER/ADMIN can CONFIRM/COMPLETE/CANCEL
    ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN']
  );
}

// ── Valid Status Transitions ──────────────────────────────────
function isValidTransition(from: OrderStatus, to: string): boolean {
  const transitions: Record<OrderStatus, string[]> = {
    PENDING:    ['CONFIRMED', 'CANCELLED'],
    CONFIRMED:  ['PREPARING', 'CANCELLED'],
    PREPARING:  ['READY', 'CANCELLED'],
    READY:      ['COMPLETED', 'CANCELLED'],
    COMPLETED:  [],   // terminal — cannot transition out
    CANCELLED:  [],   // terminal
  };

  return transitions[from]?.includes(to) ?? false;
}
