export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, superAdminUnauthorized } from '@/lib/auth/superadmin';
import { createServiceClient } from '@/lib/supabase/client';

// GET /api/superadmin/tenants/[slug]
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();

  const db = createServiceClient();
  const { slug } = params;

  const { data: tenant, error } = await db
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const tenantId = tenant.id as string;

  // Fetch all related data in parallel
  const [orders, staff, menuItems, branches, recentOrders] = await Promise.all([
    db.from('orders').select('id, total_amount, status, created_at', { count: 'exact' }).eq('tenant_id', tenantId),
    db.from('staff').select('id, display_name, role, is_active, created_at').eq('tenant_id', tenantId),
    db.from('menu_items').select('id, name, price, is_active').eq('tenant_id', tenantId),
    db.from('branches').select('id, name, is_active').eq('tenant_id', tenantId),
    db.from('orders')
      .select('id, order_number, total_amount, status, created_at, customer_name')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const revenue = (orders.data ?? []).reduce(
    (sum: number, o: { total_amount?: number | null }) => sum + (Number(o.total_amount) || 0), 0
  );

  // Orders by status
  const byStatus: Record<string, number> = {};
  for (const o of orders.data ?? []) {
    const s = (o as { status: string }).status;
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  return NextResponse.json({
    data: {
      tenant,
      stats: {
        order_count: (orders.data ?? []).length,
        total_revenue: revenue,
        staff_count: (staff.data ?? []).length,
        menu_item_count: (menuItems.data ?? []).length,
        orders_by_status: byStatus,
      },
      staff: staff.data ?? [],
      menu_items: menuItems.data ?? [],
      branches: branches.data ?? [],
      recent_orders: recentOrders.data ?? [],
    },
  });
}

// PATCH /api/superadmin/tenants/[slug] — update plan, extend trial, suspend
export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();

  const db = createServiceClient();
  const { slug } = params;
  const body = await req.json() as {
    plan_tier?: string;
    plan_status?: string;
    trial_ends_at?: string;
    note?: string;
  };

  const allowed = ['plan_tier', 'plan_status', 'trial_ends_at'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key as keyof typeof body] !== undefined) {
      updates[key] = body[key as keyof typeof body];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from('tenants')
    .update(updates)
    .eq('slug', slug)
    .select('id, slug, plan_tier, plan_status, trial_ends_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit via system_logs (single logging system — audit_log was dropped)
  const { logEvent } = await import('@/lib/logger');
  void logEvent({
    eventType: 'TENANT_PLAN_UPGRADED',
    entityType: 'TENANT',
    entityId: data.id as string,
    source: 'API',
    status: 'SUCCESS',
    details: { slug, updates, note: body.note ?? null, actor: 'superadmin' },
  });

  return NextResponse.json({ data });
}
