export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — POST /api/bir/generate
// Generates a BIR Official Receipt for a completed order.
// PRO/ENTERPRISE tier only — requires bir_tin + bir_atp_series.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

export interface ORData {
  orNumber: string;
  series: string;
  dateIssued: string;
  tenantName: string;
  tenantAddress: string;
  birTin: string;
  customerName: string;
  items: { description: string; qty: number; unitPrice: number; amount: number }[];
  subtotal: number;
  vatableSales: number;
  vatAmount: number;
  total: number;
  cashierName: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const db = createServiceClient();

    // Plan + BIR config check
    const { data: tenant } = await db
      .from('tenants')
      .select('plan_tier, name, address, bir_tin, bir_atp_series, bir_or_counter')
      .eq('id', ctx.tenantId)
      .single();

    if (!tenant) return apiError('Tenant not found', 404);
    if (tenant.plan_tier !== 'PRO' && tenant.plan_tier !== 'ENTERPRISE') {
      return apiError('BIR OR generation requires PRO plan or higher', 403);
    }
    if (!tenant.bir_tin || !tenant.bir_atp_series) {
      return apiError('Configure BIR TIN and ATP Series in Settings first', 400);
    }

    // Parse body
    const body = await request.json() as { orderId?: string };
    if (!body.orderId) return apiError('orderId is required', 400);
    const orderId = body.orderId;

    // Fetch order
    const { data: order } = await db
      .from('orders')
      .select('id, order_number, status, total_amount, vat_amount, customer_name, order_items(item_name, size_label, qty, line_total)')
      .eq('id', orderId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (!order) return apiError('Order not found', 404);
    if (order.status !== 'COMPLETED') return apiError('OR can only be issued for COMPLETED orders', 400);

    // Idempotency check
    const { data: existing } = await db
      .from('payments')
      .select('or_number')
      .eq('order_id', orderId)
      .not('or_number', 'is', null)
      .maybeSingle();

    if (existing) {
      const existingOrNum = (existing as Record<string, unknown>)['or_number'] as string;
      return apiError(`OR ${existingOrNum} already issued for this order`, 409);
    }

    // Atomic counter via RPC
    let counter: number;
    const { data: rpcData, error: rpcErr } = await db.rpc('increment_bir_counter', { p_tenant_id: ctx.tenantId });
    if (rpcErr || rpcData === null || rpcData === undefined) {
      const cur = Number(tenant.bir_or_counter ?? 1);
      await db.from('tenants').update({ bir_or_counter: cur + 1 }).eq('id', ctx.tenantId);
      counter = cur;
    } else {
      counter = Number(rpcData);
    }

    const orNumber = `${String(tenant.bir_atp_series)}-${String(counter).padStart(8, '0')}`;

    // Persist OR number
    await db.from('payments')
      .update({ or_number: orNumber } as Record<string, unknown>)
      .eq('order_id', orderId)
      .eq('status', 'VERIFIED');

    // Build response
    const rawItems = (order.order_items as Array<{ item_name: string; size_label: string | null; qty: number; line_total: number }>) ?? [];
    const items = rawItems.map(i => ({
      description: i.size_label ? `${i.item_name} (${i.size_label})` : i.item_name,
      qty:       i.qty,
      unitPrice: i.qty > 0 ? Number(i.line_total) / i.qty : 0,
      amount:    Number(i.line_total),
    }));

    const total   = Number(order.total_amount);
    const vat     = Number(order.vat_amount ?? total * (12 / 112));
    const net     = total - vat;

    const orData: ORData = {
      orNumber,
      series:       String(tenant.bir_atp_series),
      dateIssued:   new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' }),
      tenantName:   String(tenant.name),
      tenantAddress: String(tenant.address ?? ''),
      birTin:       String(tenant.bir_tin),
      customerName: String(order.customer_name ?? 'Cash Customer'),
      items,
      subtotal:     net,
      vatableSales: net,
      vatAmount:    vat,
      total,
      cashierName:  ctx.displayName ?? 'Staff',
    };

    return apiSuccess(orData);
  }, ['OWNER', 'ADMIN', 'CASHIER']);
}
