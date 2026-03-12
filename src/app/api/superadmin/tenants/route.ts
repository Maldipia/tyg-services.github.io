export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, superAdminUnauthorized } from '@/lib/auth/superadmin';
import { createServiceClient } from '@/lib/supabase/client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifySuperAdmin(req)) return superAdminUnauthorized();

  const db = createServiceClient();

  // Aggregate all tenant stats in one query
  const { data, error } = await db.rpc('superadmin_tenant_stats' as never) as {
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  };

  if (error) {
    // Fallback: plain query if RPC doesn't exist yet
    const { data: tenants, error: tErr } = await db
      .from('tenants')
      .select(`
        id, name, slug, owner_email, phone, plan_tier, plan_status,
        trial_ends_at, created_at, address
      `)
      .order('created_at', { ascending: false });

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

    // Fetch per-tenant counts separately (no RPC)
    const enriched = await Promise.all((tenants ?? []).map(async (t) => {
      const [orders, staff, menuItems] = await Promise.all([
        db.from('orders').select('id, total_amount', { count: 'exact' }).eq('tenant_id', t.id),
        db.from('staff').select('id', { count: 'exact' }).eq('tenant_id', t.id),
        db.from('menu_items').select('id', { count: 'exact' }).eq('tenant_id', t.id),
      ]);

      const revenue = (orders.data ?? []).reduce(
        (sum: number, o: { total_amount?: number | null }) => sum + (Number(o.total_amount) || 0), 0
      );

      return {
        ...t,
        order_count: orders.count ?? 0,
        staff_count: staff.count ?? 0,
        menu_item_count: menuItems.count ?? 0,
        total_revenue: revenue,
      };
    }));

    // Platform totals
    const totals = {
      tenant_count: enriched.length,
      total_orders: enriched.reduce((s, t) => s + (t.order_count as number), 0),
      total_revenue: enriched.reduce((s, t) => s + (t.total_revenue as number), 0),
      active_trials: enriched.filter(t => t.plan_status === 'TRIAL').length,
      paying: enriched.filter(t => !['TRIAL', 'SUSPENDED'].includes(t.plan_status as string)).length,
    };

    return NextResponse.json({ data: enriched, totals });
  }

  return NextResponse.json({ data });
}
