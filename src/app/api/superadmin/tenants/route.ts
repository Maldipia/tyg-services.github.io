export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, superAdminUnauthorized } from '@/lib/auth/superadmin';
import { createServiceClient } from '@/lib/supabase/client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();

  const db = createServiceClient();

  // Fetch tenants with health data directly (bypass view which has RLS issues in some contexts)
  const { data: tenants, error } = await db
    .from('tenants')
    .select('id, name, slug, owner_email, phone, plan_tier, plan_status, trial_ends_at, created_at, address, health_label, onboarding_completed_at, last_active_at, max_products, max_staff, max_branches, pos_locked')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error || !tenants) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 });

  // Enrich with counts from related tables
  const enriched = await Promise.all(tenants.map(async (t) => {
    const [oRes, sRes, mRes] = await Promise.all([
      db.from('orders').select('total_amount, status').eq('tenant_id', t.id).eq('is_test', false),
      db.from('staff').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id).eq('is_active', true),
      db.from('menu_items').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
    ]);

    const revenue = (oRes.data ?? [])
      .filter((o) => o.status === 'COMPLETED')
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);

    const trialDaysLeft = t.plan_status === 'TRIAL' && t.trial_ends_at
      ? Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 86400000)
      : null;

    return {
      ...t,
      order_count: oRes.data?.length ?? 0,
      total_revenue: revenue,
      staff_count: sRes.count ?? 0,
      menu_item_count: mRes.count ?? 0,
      trial_days_left: trialDaysLeft,
    };
  }));

  return NextResponse.json({ data: enriched });
}
