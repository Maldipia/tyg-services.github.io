export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — GET /api/shift/summary
// Returns EOD shift summary: collections by method, order
// counts, discounts, VAT, top items — for a given date.
// Staff-auth required (any role).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const rawDate = searchParams.get('date');

    // Default to today in PH time (UTC+8) when date omitted — matches orders list behaviour
    const phToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    const dateStr = (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) ? rawDate : phToday;

    const db = createServiceClient();

    // All non-test orders for this tenant on this PH date
    const { data: orders } = await db
      .from('orders')
      .select(`
        id, status, payment_status, total_amount, discount_amount,
        discount_type, vat_amount
      `)
      .eq('tenant_id', ctx.tenantId)
      .eq('is_test', false)
      .gte('created_at', `${dateStr}T00:00:00+08:00`)
      .lt('created_at',  `${dateStr}T23:59:59+08:00`);

    if (!orders) return apiError('Failed to fetch orders', 500);

    // Payments for completed + verified orders on this date
    const completedIds = orders
      .filter(o => o.status === 'COMPLETED')
      .map(o => o.id as string);

    let payments: Array<{ order_id: string; method: string; amount: number }> = [];
    if (completedIds.length > 0) {
      const { data: p } = await db
        .from('payments')
        .select('order_id, method, amount')
        .in('order_id', completedIds)
        .eq('status', 'VERIFIED');
      payments = (p ?? []) as typeof payments;
    }

    // Top items for the day
    const { data: itemRows } = await db
      .from('order_items')
      .select('item_name, qty, line_total, addon_total')
      .in('order_id', completedIds.length > 0 ? completedIds : ['00000000-0000-0000-0000-000000000000']);

    // Aggregate
    const completed  = orders.filter(o => o.status === 'COMPLETED');
    const cancelled  = orders.filter(o => o.status === 'CANCELLED');
    const unpaidCompleted = completed.filter(o => o.payment_status !== 'VERIFIED');

    const byMethod = (method: string) =>
      payments.filter(p => p.method === method).reduce((s, p) => s + Number(p.amount), 0);

    const cashCollected  = byMethod('CASH');
    const gcashCollected = byMethod('GCASH');
    const mayaCollected  = byMethod('MAYA');
    const otherCollected = payments
      .filter(p => !['CASH','GCASH','MAYA'].includes(p.method))
      .reduce((s, p) => s + Number(p.amount), 0);

    const totalRevenue   = cashCollected + gcashCollected + mayaCollected + otherCollected;
    const totalDiscounts = completed.reduce((s, o) => s + Number(o.discount_amount ?? 0), 0);
    const vatCollected   = completed.reduce((s, o) => s + Number(o.vat_amount ?? 0), 0);
    const pwdOrders      = completed.filter(o => o.discount_type === 'PWD').length;
    const seniorOrders   = completed.filter(o => o.discount_type === 'SENIOR').length;

    // Top items aggregation
    const itemMap = new Map<string, { qty: number; revenue: number }>();
    for (const item of itemRows ?? []) {
      const name = item.item_name as string;
      const qty  = item.qty as number;
      const rev  = Number(item.line_total ?? 0) + Number(item.addon_total ?? 0) * qty;
      const existing = itemMap.get(name) ?? { qty: 0, revenue: 0 };
      itemMap.set(name, { qty: existing.qty + qty, revenue: existing.revenue + rev });
    }
    const topItems = Array.from(itemMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return apiSuccess({
      date: dateStr,
      totalRevenue,
      cashCollected,
      gcashCollected,
      mayaCollected,
      otherCollected,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length,
      unpaidCompleted: unpaidCompleted.length,
      totalDiscounts,
      vatCollected,
      pwdOrders,
      seniorOrders,
      topItems,
    });
  }, ['OWNER', 'ADMIN', 'CASHIER']);
}
