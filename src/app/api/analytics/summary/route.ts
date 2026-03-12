// ============================================================
// TYG POS — GET /api/analytics/summary
// Owner/Admin only. Reads from materialized views (fast).
// STARTER: basic; BUSINESS+: hourly heatmap; PRO+: exports
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError, requirePlan } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(
    req,
    async (request, ctx) => {
      // Only OWNER/ADMIN can view analytics
      if (!['OWNER', 'ADMIN'].includes(ctx.role)) {
        return apiError('Analytics requires OWNER or ADMIN role', 403);
      }

      const { searchParams } = new URL(request.url);
      const range = searchParams.get('range') ?? '7d';
      const branchId = searchParams.get('branch') ?? ctx.branchId;

      const db = createServiceClient();
      const now = new Date();

      const daysMap: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[range] ?? 7;
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      // ── Basic analytics (all tiers) ──────────────────────
      let summaryQuery = db
        .from('daily_sales_summary')
        .select('sale_date, completed_orders, cancelled_orders, gross_sales, net_sales, total_vat, total_discounts')
        .eq('tenant_id', ctx.tenantId)
        .gte('sale_date', since)
        .order('sale_date', { ascending: true });

      if (branchId) summaryQuery = summaryQuery.eq('branch_id', branchId);

      const { data: dailySummary } = await summaryQuery;

      // Top items (basic)
      let topItemsQuery = db
        .from('top_items_summary')
        .select('item_name, total_qty_sold, total_revenue')
        .eq('tenant_id', ctx.tenantId)
        .gte('sale_date', since)
        .order('total_revenue', { ascending: false })
        .limit(10);

      const { data: topItems } = await topItemsQuery;

      // Aggregate totals
      const totals = (dailySummary ?? []).reduce(
        (acc, row) => ({
          completedOrders: acc.completedOrders + (row.completed_orders ?? 0),
          cancelledOrders: acc.cancelledOrders + (row.cancelled_orders ?? 0),
          grossSales: acc.grossSales + Number(row.gross_sales ?? 0),
          netSales: acc.netSales + Number(row.net_sales ?? 0),
          totalVat: acc.totalVat + Number(row.total_vat ?? 0),
          totalDiscounts: acc.totalDiscounts + Number(row.total_discounts ?? 0),
        }),
        { completedOrders: 0, cancelledOrders: 0, grossSales: 0, netSales: 0, totalVat: 0, totalDiscounts: 0 }
      );

      const result: Record<string, unknown> = {
        range,
        totals,
        dailySummary: dailySummary ?? [],
        topItems: topItems ?? [],
      };

      // ── Hourly heatmap (BUSINESS+) ───────────────────────
      const heatmapGate = requirePlan(ctx.planTier, 'BUSINESS');
      if (!heatmapGate) {
        const { data: heatmap } = await db
          .from('hourly_sales_summary')
          .select('day_of_week, hour_of_day, order_count, total_revenue')
          .eq('tenant_id', ctx.tenantId);
        result['heatmap'] = heatmap ?? [];
      } else {
        result['heatmap'] = null;
        result['heatmapUpgradeRequired'] = true;
      }

      // ── Live stats: orders today ─────────────────────────
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const { count: todayOrderCount } = await db
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', ctx.tenantId)
        .eq('status', 'COMPLETED')
        .eq('is_test', false)
        .gte('created_at', todayStart.toISOString());

      result['todayCompletedOrders'] = todayOrderCount ?? 0;

      return apiSuccess(result);
    },
    ['OWNER', 'ADMIN', 'MANAGER']
  );
}
