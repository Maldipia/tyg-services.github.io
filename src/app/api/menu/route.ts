export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — GET /api/menu?tenant=slug&branch=id
// Public endpoint — customers fetch menu when they scan QR.
// Rate limited to 100/min per tenant to prevent scraping.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { resolveTenant, apiSuccess, apiError } from '@/lib/auth/middleware';
import { menuFetchRateLimit } from '@/lib/redis/ratelimit';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get('tenant');
  const branchId = searchParams.get('branch') ?? null;

  if (!tenantSlug) return apiError('tenant parameter required', 400);

  // Rate limit per tenant slug (not IP — high-traffic shared QR scanning)
  const { success } = await menuFetchRateLimit.limit(`tenant:${tenantSlug}`);
  if (!success) return apiError('Rate limit exceeded', 429);

  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return apiError('Tenant not found', 404);

  if (!tenant.isOrderingEnabled) {
    return apiError('Ordering is currently paused', 503, 'ORDERING_DISABLED');
  }

  const db = createServiceClient();

  // Fetch categories
  const catQuery = db
    .from('menu_categories')
    .select('id, name, description, image_url, sort_order')
    .eq('tenant_id', tenant.tenantId)
    .eq('is_active', true)
    .order('sort_order');

  if (branchId) {
    catQuery.or(`branch_id.eq.${branchId},branch_id.is.null`);
  }

  const { data: categories, error: catError } = await catQuery;
  if (catError) return apiError('Failed to fetch menu', 500);

  // Fetch items with sizes and addons in one query
  const itemQuery = db
    .from('menu_items')
    .select(`
      id, category_id, name, description, image_url, base_price,
      status, sort_order, is_featured, tags,
      sizes:menu_item_sizes(id, label, price, sort_order, is_default, is_available),
      addons:menu_item_addons(id, label, price, sort_order, is_available)
    `)
    .eq('tenant_id', tenant.tenantId)
    .neq('status', 'HIDDEN')
    .order('sort_order');

  if (branchId) {
    itemQuery.or(`branch_id.eq.${branchId},branch_id.is.null`);
  }

  const { data: items, error: itemError } = await itemQuery;
  if (itemError) return apiError('Failed to fetch menu items', 500);

  // Fetch tenant branding
  const { data: tenantData } = await db
    .from('tenants')
    .select('name, logo_url, primary_color, accent_color, settings')
    .eq('id', tenant.tenantId)
    .single();

  // Deduplicate by ID (defensive — should not be needed but guards against SDK quirks)
  const uniqueCats = (categories ?? []).filter(
    (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
  );
  const uniqueItems = (items ?? []).filter(
    (item, i, arr) => arr.findIndex((x) => x.id === item.id) === i
  );

  // Debug: log DB project being used (first 30 chars of URL)
  const dbUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING').slice(0, 40);
  console.log(`[menu] tenant=${tenant.tenantId} cats=${uniqueCats.length} items=${uniqueItems.length} db=${dbUrl}`);

  // Build response: group items under categories
  const categoriesWithItems = uniqueCats.map((cat) => ({
    ...cat,
    items: uniqueItems.filter((item) => item.category_id === cat.id),
  }));

  return apiSuccess({
    tenant: {
      name: tenantData?.name,
      logoUrl: tenantData?.logo_url,
      primaryColor: tenantData?.primary_color,
      accentColor: tenantData?.accent_color,
      receiptFooter: (tenantData?.settings as { receiptFooter?: string })?.receiptFooter,
    },
    categories: categoriesWithItems,
    updatedAt: new Date().toISOString(),
  });
}

// force-rebuild-1773389498
