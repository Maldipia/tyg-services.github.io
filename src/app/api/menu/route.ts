export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — GET /api/menu?tenant=slug&branch=id
// Public endpoint — customers fetch menu when they scan QR.
// Rate limited to 100/min per tenant to prevent scraping.
//
// Uses raw fetch() to PostgREST instead of Supabase JS SDK
// to avoid SDK connection-pooling duplication bug.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenant, apiSuccess, apiError } from '@/lib/auth/middleware';
import { menuFetchRateLimit } from '@/lib/redis/ratelimit';

function pgHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function pgUrl(path: string) {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/rest/v1/${path}`;
}

async function pgGet<T>(path: string): Promise<T[]> {
  const res = await fetch(pgUrl(path), { headers: pgHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`PostgREST error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T[]>;
}

interface RawCategory {
  id: string; name: string; description: string | null;
  image_url: string | null; sort_order: number;
}
interface RawSize {
  id: string; item_id: string; label: string; price: number;
  sort_order: number; is_default: boolean; is_available: boolean;
}
interface RawAddon {
  id: string; item_id: string; label: string; price: number;
  sort_order: number; is_available: boolean;
}
interface RawItem {
  id: string; category_id: string; name: string; description: string | null;
  image_url: string | null; base_price: number; status: string;
  sort_order: number; is_featured: boolean; tags: string[];
}
interface RawTenant {
  name: string; logo_url: string | null; primary_color: string | null;
  accent_color: string | null; settings: Record<string, unknown> | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get('tenant');
  const branchId   = searchParams.get('branch') ?? null;

  if (!tenantSlug) return apiError('tenant parameter required', 400);

  // Rate limit per tenant slug
  const { success } = await menuFetchRateLimit.limit(`tenant:${tenantSlug}`);
  if (!success) return apiError('Rate limit exceeded', 429);

  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return apiError('Tenant not found', 404);

  if (!tenant.isOrderingEnabled) {
    return apiError('Ordering is currently paused', 503, 'ORDERING_DISABLED');
  }

  const tid = tenant.tenantId;

  try {
    // ── 1. Categories ───────────────────────────────────────
    let catFilter = `tenant_id=eq.${tid}&is_active=eq.true&order=sort_order`;
    if (branchId) {
      catFilter += `&or=(branch_id.eq.${branchId},branch_id.is.null)`;
    }
    const categories = await pgGet<RawCategory>(`menu_categories?${catFilter}&select=id,name,description,image_url,sort_order`);

    // ── 2. Items ────────────────────────────────────────────
    let itemFilter = `tenant_id=eq.${tid}&status=neq.HIDDEN&order=sort_order`;
    if (branchId) {
      itemFilter += `&or=(branch_id.eq.${branchId},branch_id.is.null)`;
    }
    const items = await pgGet<RawItem>(`menu_items?${itemFilter}&select=id,category_id,name,description,image_url,base_price,status,sort_order,is_featured,tags`);

    // ── 3. Sizes & Addons (batch by item IDs) ───────────────
    let sizes:  RawSize[]  = [];
    let addons: RawAddon[] = [];

    if (items.length > 0) {
      const ids = items.map(i => i.id).join(',');
      [sizes, addons] = await Promise.all([
        pgGet<RawSize>(`menu_item_sizes?item_id=in.(${ids})&is_available=eq.true&order=sort_order&select=id,item_id,label,price,sort_order,is_default,is_available`),
        pgGet<RawAddon>(`menu_item_addons?item_id=in.(${ids})&is_available=eq.true&order=sort_order&select=id,item_id,label,price,sort_order,is_available`),
      ]);
    }

    // ── 4. Tenant branding ──────────────────────────────────
    const [tenantData] = await pgGet<RawTenant>(`tenants?id=eq.${tid}&select=name,logo_url,primary_color,accent_color,settings&limit=1`);

    // ── 5. Build response ───────────────────────────────────
    const sizeMap  = new Map<string, RawSize[]>();
    const addonMap = new Map<string, RawAddon[]>();
    for (const s of sizes)  { (sizeMap.get(s.item_id)  ?? (sizeMap.set(s.item_id, []),  sizeMap.get(s.item_id)!)).push(s); }
    for (const a of addons) { (addonMap.get(a.item_id) ?? (addonMap.set(a.item_id, []), addonMap.get(a.item_id)!)).push(a); }

    const categoriesWithItems = categories.map(cat => ({
      ...cat,
      items: items
        .filter(i => i.category_id === cat.id)
        .map(i => ({
          ...i,
          sizes:  sizeMap.get(i.id)  ?? [],
          addons: addonMap.get(i.id) ?? [],
        })),
    }));

    console.log(`[menu] tenant=${tid} cats=${categories.length} items=${items.length} db=${(process.env.SUPABASE_URL ?? '').slice(0,40)}`);

    return apiSuccess({
      _rawCats: categories.map(c => ({id: c.id, name: c.name})),
      tenant: {
        name:          tenantData?.name,
        logoUrl:       tenantData?.logo_url,
        primaryColor:  tenantData?.primary_color,
        accentColor:   tenantData?.accent_color,
        receiptFooter: (tenantData?.settings as { receiptFooter?: string })?.receiptFooter,
      },
      categories: categoriesWithItems,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[menu] fetch error:', err);
    return apiError('Failed to fetch menu', 500);
  }
}
