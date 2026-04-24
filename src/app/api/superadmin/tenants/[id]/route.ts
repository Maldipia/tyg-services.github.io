export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, superAdminUnauthorized } from '@/lib/auth/superadmin';
import { createServiceClient } from '@/lib/supabase/client';
import { apiError } from '@/lib/auth/middleware';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();
  const db = createServiceClient();
  const { id } = params;

  const [tenantRes, staffRes, menuRes, ordersRes, featuresRes, auditRes, tablesRes] = await Promise.all([
    db.from('tenants').select('*').eq('id', id).single(),
    db.from('staff').select('id,display_name,role,is_active,last_login').eq('tenant_id', id),
    db.from('menu_items').select('id,name,base_price,status').eq('tenant_id', id).limit(50),
    db.from('orders').select('id,order_number,status,total_amount,created_at,customer_name')
      .eq('tenant_id', id).eq('is_test', false).order('created_at', { ascending: false }).limit(20),
    db.from('tenant_features').select('feature_key,enabled,note,updated_at').eq('tenant_id', id),
    db.from('superadmin_audit').select('action,field,old_value,new_value,created_at,note')
      .eq('tenant_id', id).order('created_at', { ascending: false }).limit(30),
    db.from('restaurant_tables').select('id,name,capacity,is_active').eq('tenant_id', id),
  ]);

  if (!tenantRes.data) return apiError('Tenant not found', 404);

  // Compute health & onboarding progress via SQL functions
  const [healthRes, progressRes] = await Promise.all([
    db.rpc('compute_tenant_health', { t_id: id }),
    db.rpc('tenant_onboarding_progress', { t_id: id }),
  ]);

  // Revenue chart (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: chartOrders } = await db.from('orders')
    .select('created_at,total_amount,status')
    .eq('tenant_id', id).eq('is_test', false)
    .gte('created_at', thirtyDaysAgo);

  // Group by day
  const revenueByDay: Record<string, number> = {};
  (chartOrders ?? []).forEach(o => {
    if (o.status === 'COMPLETED') {
      const day = o.created_at.slice(0, 10);
      revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(o.total_amount);
    }
  });

  const healthData = (healthRes.data as Array<{ score: number; label: string }> | null)?.[0];

  return NextResponse.json({
    data: {
      tenant: tenantRes.data,
      staff: staffRes.data ?? [],
      menu: menuRes.data ?? [],
      orders: ordersRes.data ?? [],
      features: featuresRes.data ?? [],
      audit: auditRes.data ?? [],
      tables: tablesRes.data ?? [],
      health: healthData ?? { score: 0, label: 'dead' },
      onboarding_progress: progressRes.data ?? 0,
      revenue_chart: Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)),
    }
  });
}
