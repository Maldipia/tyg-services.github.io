export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, superAdminUnauthorized } from '@/lib/auth/superadmin';
import { createServiceClient } from '@/lib/supabase/client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();

  const db = createServiceClient();

  // Use tenant_overview view — always current, includes all tenants
  const { data: tenants, error } = await db
    .from('tenant_overview')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    // Fallback: plain tenants table if view fails
    const { data: plain, error: plainErr } = await db
      .from('tenants')
      .select('id, name, slug, owner_email, phone, plan_tier, plan_status, trial_ends_at, created_at, address, billing_notes')
      .order('created_at', { ascending: false });

    if (plainErr) return NextResponse.json({ error: plainErr.message }, { status: 500 });

    const enriched = await Promise.all((plain ?? []).map(async (t) => {
      const [oRes, sRes, mRes] = await Promise.all([
        db.from('orders').select('id, total_amount, status').eq('tenant_id', t.id).eq('is_test', false),
        db.from('staff').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
        db.from('menu_items').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
      ]);
      const revenue = (oRes.data ?? [])
        .filter((o: Record<string,unknown>) => o.status === 'COMPLETED')
        .reduce((s: number, o: Record<string,unknown>) => s + Number(o.total_amount || 0), 0);
      const trialDaysLeft = t.plan_status === 'TRIAL' && t.trial_ends_at
        ? Math.floor((new Date(t.trial_ends_at).getTime() - Date.now()) / 86400000)
        : null;
      return {
        ...t,
        order_count: (oRes.data ?? []).length,
        total_revenue: revenue,
        staff_count: sRes.count ?? 0,
        menu_item_count: mRes.count ?? 0,
        trial_days_left: trialDaysLeft,
        last_order_at: null,
      };
    }));

    return NextResponse.json({ data: enriched });
  }

  return NextResponse.json({ data: tenants ?? [] });
}
