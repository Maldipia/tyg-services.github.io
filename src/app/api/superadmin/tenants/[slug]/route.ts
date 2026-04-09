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

  const { data: tenant, error } = await db.from('tenants').select('*').eq('slug', slug).single();
  if (error || !tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  const tenantId = tenant.id as string;

  const [orders, staff, menuItems, branches, recentOrders, features, tenantFeatures, auditLog] = await Promise.all([
    db.from('orders').select('id, total_amount, status, created_at, is_test').eq('tenant_id', tenantId).eq('is_test', false),
    db.from('staff').select('id, display_name, role, is_active, created_at').eq('tenant_id', tenantId),
    db.from('menu_items').select('id, name, base_price, status').eq('tenant_id', tenantId),
    db.from('branches').select('id, name, is_active').eq('tenant_id', tenantId),
    db.from('orders').select('id, order_number, total_amount, status, created_at, customer_name, order_type').eq('tenant_id', tenantId).eq('is_test', false).order('created_at', { ascending: false }).limit(10),
    db.from('features').select('key, name, description, category').order('category').order('name'),
    db.from('tenant_features').select('feature_key, enabled, source, note, updated_at').eq('tenant_id', tenantId),
    db.from('superadmin_audit').select('action, field, old_value, new_value, note, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
  ]);

  const revenue = (orders.data ?? []).filter(o => (o as {status:string}).status === 'COMPLETED')
    .reduce((s, o) => s + Number((o as {total_amount:number}).total_amount || 0), 0);

  const byStatus: Record<string, number> = {};
  for (const o of orders.data ?? []) {
    const s = (o as {status:string}).status;
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  // Map features with tenant overrides
  const featureMap = new Map((tenantFeatures.data ?? []).map(f => [f.feature_key, f]));
  const featureList = (features.data ?? []).map(f => ({
    ...f,
    enabled: featureMap.has(f.key) ? featureMap.get(f.key)!.enabled : false,
    source: featureMap.get(f.key)?.source ?? 'none',
    note: featureMap.get(f.key)?.note ?? null,
  }));

  return NextResponse.json({
    data: {
      tenant,
      stats: { order_count: (orders.data ?? []).length, total_revenue: revenue, staff_count: (staff.data ?? []).length, menu_item_count: (menuItems.data ?? []).length, orders_by_status: byStatus },
      staff: staff.data ?? [],
      menu_items: menuItems.data ?? [],
      branches: branches.data ?? [],
      recent_orders: recentOrders.data ?? [],
      features: featureList,
      audit_log: auditLog.data ?? [],
    },
  });
}

// PATCH /api/superadmin/tenants/[slug]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();
  const db = createServiceClient();
  const { slug } = params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

  const body = await req.json() as {
    plan_tier?: string; plan_status?: string; trial_ends_at?: string | null;
    billing_notes?: string; note?: string;
    // Feature flag update
    feature_key?: string; feature_enabled?: boolean;
  };

  const { data: tenant } = await db.from('tenants').select('id, plan_tier, plan_status').eq('slug', slug).single();
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  const tenantId = tenant.id as string;

  // Feature flag toggle
  if (body.feature_key !== undefined && body.feature_enabled !== undefined) {
    const { error } = await db.from('tenant_features').upsert({
      tenant_id: tenantId, feature_key: body.feature_key,
      enabled: body.feature_enabled, source: 'override',
      note: body.note ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,feature_key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await db.from('superadmin_audit').insert({
      action: 'FEATURE_TOGGLE', tenant_id: tenantId, tenant_slug: slug,
      field: body.feature_key, old_value: String(!body.feature_enabled),
      new_value: String(body.feature_enabled), note: body.note ?? null, ip,
    });
    return NextResponse.json({ ok: true, feature: body.feature_key, enabled: body.feature_enabled });
  }

  // Tenant field updates
  const allowed = ['plan_tier', 'plan_status', 'trial_ends_at', 'billing_notes'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key as keyof typeof body] !== undefined) updates[key] = body[key as keyof typeof body];
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  updates.updated_at = new Date().toISOString();
  const { data, error } = await db.from('tenants').update(updates).eq('slug', slug).select('id, slug, plan_tier, plan_status, trial_ends_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit each changed field
  for (const [field, newVal] of Object.entries(updates)) {
    if (field === 'updated_at') continue;
    await db.from('superadmin_audit').insert({
      action: 'TENANT_UPDATE', tenant_id: tenantId, tenant_slug: slug,
      field, old_value: String((tenant as Record<string,unknown>)[field] ?? ''),
      new_value: String(newVal), note: body.note ?? null, ip,
    });
  }

  return NextResponse.json({ data });
}
