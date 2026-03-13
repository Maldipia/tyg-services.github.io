// ============================================================
// TYG POS — GET /api/analytics/summary
// Owner/Admin only. Reads from materialized views (fast).
// STARTER: basic; BUSINESS+: hourly heatmap
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError, requirePlan } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(
    req,
    async (request, ctx) => {
      if (!['OWNER', 'ADMIN'].includes(ctx.role)) {
        return apiError('Analytics requires OWNER or ADMIN role', 403);
      }

      const { searchParams } = new URL(request.url);
      const range = searchParams.get('range') ?? '7d';

      const db = createServiceClient();
      const now = new Date();
      const daysMap: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[range] ?? 7;
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // ── Daily summary (all tiers) ──────────────────────────
      // Columns: tenant_id, sale_date, completed_orders, cancelled_orders,
      //          gross_sales, vat_collected, total_discounts, net_sales, avg_order_value
      const { data: dailySummary } = await db
        .from('daily_sales_summary')
        .select('sale_date, completed_orders, cancelled_orders, gross_sales, vat_collected, total_discounts, net_sales, avg_order_value')
        .eq('tenant_id', ctx.tenantId)
        .gte('sale_date', since)
        .order('sale_date', { ascending: true });

      // Aggregate totals across date range
      const totals = (dailySummary ?? []).reduce(
        (acc, row) => ({
          completedOrders: acc.completedOrders + Number(row.completed_orders ?? 0),
          cancelledOrders: acc.cancelledOrders + Number(row.cancelled_orders ?? 0),
          grossSales:      acc.grossSales      + Number(row.gross_sales ?? 0),
          netSales:        acc.netSales        + Number(row.net_sales ?? 0),
          totalVat:        acc.totalVat        + Number(row.vat_collected ?? 0),
          totalDiscounts:  acc.totalDiscounts  + Number(row.total_discounts ?? 0),
        }),
        { completedOrders: 0, cancelledOrders: 0, grossSales: 0, netSales: 0, totalVat: 0, totalDiscounts: 0 }
      );

      // ── Top items (all tiers) — lifetime per tenant ────────
      // Note: top_items_summary has no date column; it covers all time
      // Columns: tenant_id, item_name, total_qty, total_revenue
      const { data: topItemsRaw } = await db
        .from('top_items_summary')
        .select('item_name, total_qty, total_revenue')
        .eq('tenant_id', ctx.tenantId)
        .order('total_revenue', { ascending: false })
        .limit(10);

      // Normalise column name for frontend (total_qty → totalQtySold)
      const topItems = (topItemsRaw ?? []).map(i => ({
        itemName:    i.item_name,
        totalQty:    i.total_qty,
        totalRevenue: i.total_revenue,
      }));

      const result: Record<string, unknown> = {
        range,
        totals,
        dailySummary: dailySummary ?? [],
        topItems,
      };

      // ── Hourly heatmap (BUSINESS+) ─────────────────────────
      if (!requirePlan(ctx.planTier, 'BUSINESS')) {
        const { data: heatmap } = await db
          .from('hourly_sales_summary')
          .select('day_of_week, hour_of_day, order_count, total_revenue')
          .eq('tenant_id', ctx.tenantId);
        result['heatmap'] = heatmap ?? [];
      } else {
        result['heatmap'] = null;
        result['heatmapUpgradeRequired'] = true;
      }

      // ── Live: today's completed orders (from orders table — matview may lag) ──
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayOrders } = await db
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', ctx.tenantId)
        .eq('status', 'COMPLETED')
        .eq('is_test', false)
        .gte('created_at', todayStart.toISOString());

      result['todayCompletedOrders'] = todayOrders?.length ?? 0;
      result['todayRevenue'] = (todayOrders ?? []).reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

      return apiSuccess(result);
    },
    ['OWNER', 'ADMIN', 'MANAGER']
  );
}
