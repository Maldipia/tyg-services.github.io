export const dynamic = 'force-dynamic';
// POST /api/orders/create
// Public order submission — validates server-side, calls create_order_atomic RPC
// NEVER trusts frontend prices. Idempotency enforced at DB level.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { orderRateLimit } from '@/lib/redis/ratelimit';
import { getClientIp } from '@/lib/auth/middleware';

const ItemSchema = z.object({
  itemId:      z.string().uuid(),
  itemName:    z.string().max(200),
  sizeId:      z.string().uuid().nullable().optional(),
  sizeLabel:   z.string().max(100).nullable().optional(),
  qty:         z.number().int().min(1).max(20),
  addonTotal:  z.number().min(0).default(0),
  notes:       z.string().max(300).optional(),
  sugarLevel:  z.enum(['GROUNDED','YANI','COMFORT','FULL_SWEET']).optional(),
});

const CreateOrderSchema = z.object({
  tenantSlug:       z.string().min(1).max(50),
  items:            z.array(ItemSchema).min(1).max(50),
  orderType:        z.enum(['DINE_IN','TAKEOUT','DELIVERY']),
  customerName:     z.string().min(1).max(200).trim(),
  customerPhone:    z.string().max(20).optional(),
  customerEmail:    z.string().email().optional().or(z.literal('')),
  pax:              z.number().int().min(1).max(50).default(1),
  tableId:          z.string().uuid().nullable().optional(),
  tableName:        z.string().max(100).nullable().optional(),
  deliveryAddress:  z.string().max(500).optional(),
  deliveryZone:     z.string().max(200).optional(),
  notes:            z.string().max(500).optional(),
  promoCode:        z.string().max(50).optional(),
  idempotencyKey:   z.string().min(1).max(100),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  // Rate limit: 10 orders per 10 min per IP
  const { success: rateLimitOk } = await orderRateLimit.limit(ip);
  if (!rateLimitOk) {
    return NextResponse.json({ data: null, error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0]?.message ?? 'Validation error' }, { status: 400 });
  }

  const input = parsed.data;
  const db = createServiceClient();

  // ── Resolve tenant ────────────────────────────────────────
  const { data: tenant } = await db.from('tenants')
    .select('id, slug, plan_status, trial_ends_at, settings')
    .eq('slug', input.tenantSlug).single();

  if (!tenant) return NextResponse.json({ data: null, error: 'Tenant not found' }, { status: 404 });
  if (!['ACTIVE','TRIAL'].includes(tenant.plan_status as string)) {
    return NextResponse.json({ data: null, error: 'Store is currently unavailable' }, { status: 402 });
  }
  if (tenant.plan_status === 'TRIAL' && tenant.trial_ends_at &&
      new Date(tenant.trial_ends_at as string) < new Date()) {
    return NextResponse.json({ data: null, error: 'Store trial has expired' }, { status: 402 });
  }
  const settings = tenant.settings as Record<string, unknown>;
  if (settings?.orderingEnabled === false) {
    return NextResponse.json({ data: null, error: 'Online ordering is currently disabled' }, { status: 503 });
  }
  if (input.orderType === 'DELIVERY' && !input.deliveryAddress?.trim()) {
    return NextResponse.json({ data: null, error: 'Delivery address required' }, { status: 400 });
  }

  // ── Fetch server-side prices ──────────────────────────────
  const itemIds = input.items.map(i => i.itemId);
  const { data: menuItems } = await db.from('menu_items')
    .select('id, name, base_price, status, stock_count')
    .eq('tenant_id', tenant.id as string)
    .in('id', itemIds);

  const menuMap = new Map((menuItems ?? []).map(m => [m.id as string, m]));
  const pricedItems: Array<typeof input.items[0] & { unitPrice: number }> = [];
  let subtotal = 0;

  for (const cartItem of input.items) {
    const menu = menuMap.get(cartItem.itemId);
    if (!menu) return NextResponse.json({ data: null, error: 'Item not found' }, { status: 404 });
    if (menu.status === 'SOLD_OUT') return NextResponse.json({ data: null, error: `${menu.name} is sold out` }, { status: 400 });
    if (menu.status === 'HIDDEN')   return NextResponse.json({ data: null, error: 'Item unavailable' }, { status: 400 });
    if (menu.stock_count !== null && (menu.stock_count as number) < cartItem.qty) {
      return NextResponse.json({ data: null, error: `${menu.name}: only ${menu.stock_count} left` }, { status: 400 });
    }

    let unitPrice = Number(menu.base_price);
    if (cartItem.sizeId) {
      const { data: sz } = await db.from('menu_item_sizes').select('price').eq('id', cartItem.sizeId).single();
      if (sz) unitPrice = Number(sz.price);
    }
    subtotal += unitPrice * cartItem.qty;
    pricedItems.push({ ...cartItem, unitPrice });
  }

  // ── Promo validation ──────────────────────────────────────
  let promoCodeId: string | null = null;
  let discountAmount = 0;

  if (input.promoCode?.trim()) {
    const { data: promo } = await db.from('promo_codes')
      .select('id, discount_type, discount_value, usage_limit, usage_count, min_order_amount, expires_at, is_active')
      .eq('tenant_id', tenant.id as string)
      .eq('code', input.promoCode.trim().toUpperCase()).single();

    if (!promo || !promo.is_active) return NextResponse.json({ data: null, error: 'Invalid promo code' }, { status: 400 });
    if (promo.expires_at && new Date(promo.expires_at as string) < new Date()) {
      return NextResponse.json({ data: null, error: 'Promo code expired' }, { status: 400 });
    }
    if (promo.usage_limit !== null && (promo.usage_count as number) >= (promo.usage_limit as number)) {
      return NextResponse.json({ data: null, error: 'Promo code exhausted' }, { status: 400 });
    }
    if (promo.min_order_amount && subtotal < Number(promo.min_order_amount)) {
      return NextResponse.json({ data: null, error: `Min order ₱${promo.min_order_amount} required for this promo` }, { status: 400 });
    }
    promoCodeId = promo.id as string;
    discountAmount = promo.discount_type === 'PERCENT'
      ? Math.round(subtotal * (Number(promo.discount_value) / 100) * 100) / 100
      : Math.min(Number(promo.discount_value), subtotal);
  }

  // ── Delivery fee ──────────────────────────────────────────
  let deliveryFee = 0;
  if (input.orderType === 'DELIVERY' && input.deliveryZone) {
    const { data: zone } = await db.from('delivery_zones')
      .select('fee, min_order').eq('tenant_id', tenant.id as string).eq('name', input.deliveryZone).single();
    if (zone) {
      deliveryFee = Number(zone.fee);
      if (subtotal < Number(zone.min_order)) {
        return NextResponse.json({ data: null, error: `Min order for this zone: ₱${zone.min_order}` }, { status: 400 });
      }
    }
  }

  // ── Generate order number ─────────────────────────────────
  const prefix = (tenant.slug as string).toUpperCase().slice(0, 6);
  const { data: orderNumber, error: seqErr } = await db.rpc('next_order_number', {
    p_tenant_id: tenant.id, p_prefix: prefix,
  });
  if (seqErr || !orderNumber) return NextResponse.json({ data: null, error: 'Failed to generate order number' }, { status: 500 });

  // ── Atomic RPC ────────────────────────────────────────────
  const rpcItems = pricedItems.map(item => ({
    item_id:     item.itemId,
    item_name:   item.itemName,
    size_id:     item.sizeId ?? null,
    size_label:  item.sizeLabel ?? null,
    unit_price:  item.unitPrice,
    qty:         item.qty,
    addon_total: item.addonTotal ?? 0,
    notes:       item.notes ?? null,
    sugar_level: item.sugarLevel ?? null,
  }));

  const { data: result, error: rpcErr } = await db.rpc('create_order_atomic', {
    p_tenant_id:       tenant.id,
    p_order_number:    orderNumber,
    p_customer_name:   input.customerName.trim(),
    p_customer_phone:  input.customerPhone?.trim() ?? null,
    p_customer_email:  input.customerEmail?.trim() ?? null,
    p_pax:             input.pax ?? 1,
    p_order_type:      input.orderType,
    p_table_id:        input.tableId ?? null,
    p_table_name:      input.tableName ?? null,
    p_delivery_address:input.deliveryAddress?.trim() ?? null,
    p_delivery_fee:    deliveryFee,
    p_delivery_zone:   input.deliveryZone ?? null,
    p_notes:           input.notes?.trim() ?? null,
    p_discount_type:   promoCodeId ? 'PROMO' : null,
    p_discount_pct:    0,
    p_discount_amount: discountAmount,
    p_promo_code_id:   promoCodeId,
    p_promo_code:      promoCodeId ? input.promoCode!.trim().toUpperCase() : null,
    p_pwd_count:       0,
    p_senior_count:    0,
    p_idempotency_key: input.idempotencyKey,
    p_items:           rpcItems,
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? '';
    if (msg.includes('ITEM_SOLD_OUT'))       return NextResponse.json({ data: null, error: msg.split(':').slice(1).join(':').trim() || 'Item sold out' }, { status: 400 });
    if (msg.includes('INSUFFICIENT_STOCK'))  return NextResponse.json({ data: null, error: msg.split(':').slice(1).join(':').trim() || 'Insufficient stock' }, { status: 400 });
    if (msg.includes('PROMO_EXHAUSTED'))     return NextResponse.json({ data: null, error: 'Promo code limit reached' }, { status: 400 });
    if (msg.includes('unique') || msg.includes('idempotency')) {
      // Idempotent duplicate — return original order
      const { data: existing } = await db.from('orders')
        .select('id, order_number, total_amount')
        .eq('tenant_id', tenant.id as string)
        .eq('idempotency_key', input.idempotencyKey)
        .single();
      if (existing) {
        return NextResponse.json({ data: {
          orderId: existing.id, orderNumber: existing.order_number,
          totalAmount: Number(existing.total_amount), status: 'PENDING',
        }}, { status: 200 });
      }
    }
    console.error('[create-order]', rpcErr);
    return NextResponse.json({ data: null, error: 'Order creation failed. Please try again.' }, { status: 500 });
  }

  const o = Array.isArray(result) ? result[0] : result;
  return NextResponse.json({ data: {
    orderId: o.order_id,
    orderNumber: o.order_number,
    totalAmount: Number(o.total_amount) + deliveryFee,
    deliveryFee,
    status: 'PENDING',
  }}, { status: 201 });
}
