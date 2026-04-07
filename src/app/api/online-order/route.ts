export const dynamic = 'force-dynamic';
// POST /api/online-order
// Public endpoint — customer-facing order placement.
// NEVER trusts frontend prices. Always re-fetches from DB.
// Atomic insert via create_order_atomic RPC (inventory locked FOR UPDATE).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { orderRateLimit } from '@/lib/redis/ratelimit';

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? '127.0.0.1';
}

const ItemSchema = z.object({
  item_id:     z.string().uuid(),
  qty:         z.number().int().min(1).max(20),
  size_id:     z.string().uuid().optional().nullable(),
  sugar_level: z.enum(['GROUNDED','YANI','COMFORT','FULL_SWEET']).optional().nullable(),
  notes:       z.string().max(200).optional().default(''),
});

const OrderSchema = z.object({
  tenant_slug:       z.string().min(1).max(50),
  items:             z.array(ItemSchema).min(1).max(30),
  order_type:        z.enum(['DINE_IN','TAKEOUT','DELIVERY']).default('DINE_IN'),
  customer_name:     z.string().min(1).max(100),
  customer_phone:    z.string().max(20).optional().nullable(),
  table_number:      z.string().max(10).optional().nullable(),
  delivery_address:  z.string().max(500).optional().nullable(),
  delivery_zone_id:  z.string().uuid().optional().nullable(),
  pax:               z.number().int().min(1).max(50).default(1),
  notes:             z.string().max(300).optional().nullable(),
  idempotency_key:   z.string().uuid(),
  promo_code:        z.string().max(30).optional().nullable(),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Rate limit ────────────────────────────────────────────────
  const ip = getIp(req);
  const { success: rlOk } = await orderRateLimit.limit(ip);
  if (!rlOk) return NextResponse.json({ data: null, error: 'Too many requests. Please wait.' }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0]?.message ?? 'Validation error' }, { status: 400 });
  }

  const input = parsed.data;

  if (input.order_type === 'DELIVERY') {
    if (!input.delivery_address?.trim()) return NextResponse.json({ data: null, error: 'Delivery address required' }, { status: 400 });
    if (!input.customer_phone?.trim()) return NextResponse.json({ data: null, error: 'Phone number required for delivery' }, { status: 400 });
  }

  const db = createServiceClient();

  // ── Validate tenant ───────────────────────────────────────────
  const { data: tenant } = await db.from('tenants')
    .select('id, slug, plan_status, trial_ends_at, settings')
    .eq('slug', input.tenant_slug)
    .single();

  if (!tenant) return NextResponse.json({ data: null, error: 'Store not found' }, { status: 404 });
  if (!['ACTIVE','TRIAL'].includes(tenant.plan_status as string))
    return NextResponse.json({ data: null, error: 'This store is not accepting orders' }, { status: 402 });
  if (tenant.plan_status === 'TRIAL' && tenant.trial_ends_at && new Date(tenant.trial_ends_at as string) < new Date())
    return NextResponse.json({ data: null, error: 'Store trial has expired' }, { status: 402 });

  const settings = tenant.settings as { orderingEnabled?: boolean; vatRate?: number };
  if (settings?.orderingEnabled === false)
    return NextResponse.json({ data: null, error: 'Online ordering is currently disabled' }, { status: 403 });

  const tenantId = tenant.id as string;

  // ── Validate + price items from DB ────────────────────────────
  const itemIds = input.items.map(i => i.item_id);
  const { data: menuItems } = await db.from('menu_items')
    .select('id, name, base_price, status, stock_count, has_sugar_level')
    .eq('tenant_id', tenantId)
    .in('id', itemIds);

  if (!menuItems) return NextResponse.json({ data: null, error: 'Menu unavailable' }, { status: 500 });
  const menuMap = new Map(menuItems.map(m => [m.id as string, m]));

  const sizeIds = input.items.map(i => i.size_id).filter(Boolean) as string[];
  let sizeMap = new Map<string, number>();
  if (sizeIds.length > 0) {
    const { data: sizes } = await db.from('menu_item_sizes')
      .select('id, price').in('id', sizeIds);
    if (sizes) sizeMap = new Map(sizes.map(s => [s.id as string, Number(s.price)]));
  }

  const pricedItems: object[] = [];
  for (const ci of input.items) {
    const m = menuMap.get(ci.item_id);
    if (!m) return NextResponse.json({ data: null, error: `Item not available`, code: 'ITEM_NOT_FOUND' }, { status: 400 });
    if (m.status === 'SOLD_OUT') return NextResponse.json({ data: null, error: `${m.name} is sold out`, code: 'ITEM_SOLD_OUT' }, { status: 400 });
    if (m.status === 'HIDDEN') return NextResponse.json({ data: null, error: 'Item not available' }, { status: 400 });
    let price = Number(m.base_price);
    if (ci.size_id) { const sp = sizeMap.get(ci.size_id); if (sp !== undefined) price = sp; }
    pricedItems.push({
      item_id: ci.item_id, item_name: String(m.name),
      size_id: ci.size_id ?? '', size_label: '',
      unit_price: price, qty: ci.qty,
      sugar_level: ci.sugar_level ?? '', notes: ci.notes ?? '',
    });
  }

  // ── Validate promo ────────────────────────────────────────────
  let promoCodeId: string | null = null;
  let discountAmount = 0;
  let discountType: string | null = null;

  if (input.promo_code) {
    const { data: promo } = await db.from('promo_codes')
      .select('id, discount_type, discount_value, usage_limit, usage_count, expires_at, min_order_amount')
      .eq('tenant_id', tenantId)
      .eq('code', input.promo_code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (!promo) return NextResponse.json({ data: null, error: 'Promo code not found', code: 'PROMO_NOT_FOUND' }, { status: 404 });
    if (promo.expires_at && new Date(promo.expires_at as string) < new Date())
      return NextResponse.json({ data: null, error: 'Promo code has expired' }, { status: 400 });
    if (promo.usage_limit !== null && Number(promo.usage_count) >= Number(promo.usage_limit))
      return NextResponse.json({ data: null, error: 'Promo code is fully redeemed' }, { status: 400 });

    const sub = (pricedItems as {unit_price:number;qty:number}[]).reduce((s, i) => s + i.unit_price * i.qty, 0);
    if (promo.min_order_amount && sub < Number(promo.min_order_amount))
      return NextResponse.json({ data: null, error: `Minimum order ₱${promo.min_order_amount} for this promo` }, { status: 400 });

    promoCodeId = promo.id as string;
    discountType = 'PROMO';
    discountAmount = promo.discount_type === 'PERCENT'
      ? Math.round(sub * (Number(promo.discount_value) / 100) * 100) / 100
      : Math.min(Number(promo.discount_value), sub);
  }

  // ── Validate delivery zone ────────────────────────────────────
  let deliveryFee = 0;
  if (input.order_type === 'DELIVERY' && input.delivery_zone_id) {
    const { data: zone } = await db.from('delivery_zones')
      .select('fee, min_order')
      .eq('id', input.delivery_zone_id)
      .eq('tenant_id', tenantId)
      .single();
    if (zone) deliveryFee = Number(zone.fee);
  }

  // ── Generate order number ─────────────────────────────────────
  const prefix = String(tenant.slug).toUpperCase().slice(0, 6);
  const { data: orderNumber, error: seqErr } = await db.rpc('next_order_number', {
    p_tenant_id: tenantId, p_prefix: prefix,
  });
  if (seqErr || !orderNumber) return NextResponse.json({ data: null, error: 'Failed to generate order number' }, { status: 500 });

  // ── Atomic insert (inventory locked FOR UPDATE inside RPC) ────
  const { data: result, error: rpcErr } = await db.rpc('create_order_atomic', {
    p_tenant_id:        tenantId,
    p_idempotency_key:  input.idempotency_key,
    p_order_number:     orderNumber,
    p_customer_name:    input.customer_name.trim(),
    p_customer_phone:   input.customer_phone?.trim() ?? null,
    p_order_type:       input.order_type,
    p_table_number:     input.table_number ?? null,
    p_delivery_address: input.delivery_address?.trim() ?? null,
    p_delivery_fee:     deliveryFee,
    p_delivery_zone_id: input.delivery_zone_id ?? null,
    p_pax:              input.pax,
    p_notes:            input.notes?.trim() ?? null,
    p_promo_code_id:    promoCodeId,
    p_promo_code:       input.promo_code ? input.promo_code.toUpperCase() : null,
    p_discount_type:    discountType,
    p_discount_amount:  discountAmount,
    p_items:            pricedItems,
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? '';
    if (msg.includes('INSUFFICIENT_STOCK'))
      return NextResponse.json({ data: null, error: msg.split(':')[1]?.trim() ?? 'Insufficient stock', code: 'INSUFFICIENT_STOCK' }, { status: 400 });
    if (msg.includes('PROMO_EXHAUSTED'))
      return NextResponse.json({ data: null, error: 'Promo code just ran out', code: 'PROMO_EXHAUSTED' }, { status: 400 });
    console.error('[online-order] RPC error:', rpcErr);
    return NextResponse.json({ data: null, error: 'Failed to place order' }, { status: 500 });
  }

  return NextResponse.json({ data: result, error: null }, { status: 201 });
}
