export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, superAdminUnauthorized } from '@/lib/auth/superadmin';
import { createServiceClient } from '@/lib/supabase/client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();
  const db = createServiceClient();

  const [tenantsRes, ordersRes, plansRes] = await Promise.all([
    db.from('tenants').select('id,plan_tier,plan_status,created_at,trial_ends_at,health_label,onboarding_completed_at').limit(1000),
    db.from('orders').select('total_amount,status,created_at,tenant_id').eq('is_test', false).limit(5000),
    db.from('plans').select('id,price_monthly'),
  ]);

  const tenants = tenantsRes.data ?? [];
  const orders  = ordersRes.data ?? [];
  const planMap = Object.fromEntries((plansRes.data ?? []).map(p => [p.id, Number(p.price_monthly)]));

  const paying = tenants.filter(t => t.plan_status === 'ACTIVE');
  const trial  = tenants.filter(t => t.plan_status === 'TRIAL');
  const mrr    = paying.reduce((s, t) => s + (planMap[t.plan_tier?.toLowerCase()] ?? 0), 0);
  const arpu   = paying.length > 0 ? mrr / paying.length : 0;
  const conversionRate = tenants.length > 0 ? Math.round(paying.length / tenants.length * 100) : 0;

  // Orders this month
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const ordersThisMonth = orders.filter(o => new Date(o.created_at) >= monthStart).length;
  const revenueThisMonth = orders
    .filter(o => o.status === 'COMPLETED' && new Date(o.created_at) >= monthStart)
    .reduce((s, o) => s + Number(o.total_amount), 0);

  // Health breakdown
  const health = {
    healthy: tenants.filter(t => t.health_label === 'healthy').length,
    at_risk: tenants.filter(t => t.health_label === 'at_risk').length,
    dead: tenants.filter(t => t.health_label === 'dead' || !t.health_label).length,
  };

  // Onboarding completion
  const onboardingDone = tenants.filter(t => t.onboarding_completed_at).length;

  return NextResponse.json({
    data: {
      total_tenants: tenants.length,
      paying_tenants: paying.length,
      trial_tenants: trial.length,
      mrr, arpu, conversion_rate: conversionRate,
      orders_this_month: ordersThisMonth,
      revenue_this_month: revenueThisMonth,
      health,
      onboarding_completion_rate: tenants.length > 0
        ? Math.round(onboardingDone / tenants.length * 100) : 0,
    }
  });
}
