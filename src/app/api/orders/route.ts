export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { resolveTenant, apiSuccess, apiError, getClientIp, withStaffAuth } from '@/lib/auth/middleware';
import { orderRateLimit } from '@/lib/redis/ratelimit';
import { sendSMS, orderCreatedSMS } from '@/lib/semaphore/sms';
import { logEvent } from '@/lib/logger';
import { fireSheetsWebhook } from '@/lib/sheets/webhook';
import type { AuthContext } from '@/types';

const CartItemSchema = z.object({
  itemId:     z.string().uuid('Invalid item ID'),
  itemName:   z.string().max(200).optional(),
  sizeId:     z.string().uuid().nullable().optional(),
  addonIds:   z.array(z.string().uuid()).max(10).optional().default([]),
  qty:        z.number().int().min(1).max(20),
  notes:      z.string().max(200).optional().default(''),
  sugarLevel: z.enum(['GROUNDED','YANI','COMFORT','FULL_SWEET']).optional(),
  addonTotal: z.number().min(0).optional(),
});

const CreateOrderSchema = z.object({
  tenantSlug:      z.string().min(1).max(50),
  customerName:    z.string().min(1).max(100).trim(),
  customerPhone:   z.string().max(20).optional(),
  customerEmail:   z.string().email().optional().or(z.literal('')),
  pax:             z.number().int().min(1).max(50).default(1),
  items:           z.array(CartItemSchema).min(1).max(50),
  notes:           z.string().max(500).optional(),
  orderType:       z.enum(['DINE_IN','TAKEOUT','DELIVERY']).default('DINE_IN'),
  tableToken:      z.string().min(8).max(36).optional(),
  tableName:       z.string().max(100).nullable().optional(),
  tableId:         z.string().uuid().nullable().optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryZone:    z.string().max(200).optional(),
  deliveryFee:     z.number().min(0).max(9999).optional(),
  discountType:    z.enum(['PWD','SENIOR','PROMO','CUSTOM']).optional(),
  pwdCount:        z.number().int().min(0).max(50).default(0),
  seniorCount:     z.number().int().min(0).max(50).default(0),
  promoCode:       z.string().max(50).trim().toUpperCase().optional(),
  idempotencyKey:  z.string().min(1).max(100).optional(),
  isTest:          z.boolean().optional().default(false),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const { success: rateLimitOk } = await orderRateLimit.limit(ip);
  if (!rateLimitOk) return apiError('Too many orders. Please wait a few minutes.', 429, 'RATE_LIMIT_EXCEEDED');

  let body: unknown;
  try { body = await req.json(); } catch { return apiError('Invalid JSON body', 400); }

  const parseResult = CreateOrderSchema.safeParse(body);
  if (!parseResult.success) return apiError(parseResult.error.errors[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR');

  const input = parseResult.data;

  if (input.isTest) {
    const staffCookie = req.cookies.get('tyg-staff-session')?.value;
    if (!staffCookie) return apiError('Test orders require staff authentication', 403, 'TEST_ORDER_FORBIDDEN');
  }

  const idempotencyKey = input.idempotencyKey ?? null;
  const db = createServiceClient();

  const tenant = await resolveTenant(input.tenantSlug);
  if (!tenant) return apiError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  if (!tenant.isOrderingEnabled) return apiError('Ordering is currently disabled', 503, 'ORDERING_DISABLED');
  if (tenant.planStatus === 'SUSPENDED' || tenant.planStatus === 'CANCELLED') {
    return apiError("This caf\u00e9's system is currently unavailable", 503, 'ACCOUNT_SUSPENDED');
  }
  if (tenant.planStatus === 'TRIAL' && !tenant.isTrialActive) return apiError('Trial period has ended', 402, 'TRIAL_EXPIRED');
  if (input.orderType === 'DELIVERY' && !input.deliveryAddress?.trim()) return apiError('Delivery address required', 400, 'DELIVERY_ADDRESS_REQUIRED');

  let tableId:   string | null = input.tableId   ?? null;
  let tableName: string | null = input.tableName ?? null;

  if (input.tableToken) {
    const { data: table } = await db.from('restaurant_tables')
      .select('id, branch_id, name, is_active, tenant_id')
      .eq('qr_token', input.tableToken).eq('tenant_id', tenant.tenantId).single();
    if (!table || !table.is_active) return apiError('Invalid or inactive table QR code', 400, 'INVALID_TABLE');
    tableId   = table.id as string;
    tableName = table.name as string;
  }

  const itemIds  = input.items.map(i => i.itemId);
  const sizeIds  = input.items.filter(i => i.sizeId).map(i => i.sizeId as string);
  const addonIds = input.items.flatMap(i => i.addonIds ?? []);

  const [itemsRes, sizesRes, addonsRes] = await Promise.all([
    db.from('menu_items').select('id, name, base_price, status, tenant_id').in('id', itemIds).eq('tenant_id', tenant.tenantId),
    // No tenant_id column on sizes/addons — isolation via item_id cross-check below
    sizeIds.length  > 0 ? db.from('menu_item_sizes').select('id, item_id, label, price, is_available').in('id', sizeIds)   : { data: [], error: null },
    addonIds.length > 0 ? db.from('menu_item_addons').select('id, item_id, label, price, is_available').in('id', addonIds) : { data: [], error: null },
  ]);

  if (itemsRes.error) return apiError('Failed to fetch menu items', 500);

  const itemMap  = new Map((itemsRes.data  ?? []).map(i => [i.id  as string, i]));
  const sizeMap  = new Map((sizesRes.data  ?? []).map(s => [s.id  as string, s]));
  const addonMap = new Map((addonsRes.data ?? []).map(a => [a.id  as string, a]));

  let subtotal = 0;
  const pricedItems: Array<{
    item_id: string; item_name: string; size_id: string | null; size_label: string | null;
    unit_price: number; qty: number; addon_total: number; notes: string; sugar_level: string | null;
  }> = [];

  for (const cartItem of input.items) {
    const dbItem = itemMap.get(cartItem.itemId);
    if (!dbItem) return apiError(`Item not found: ${cartItem.itemId}`, 404, 'ITEM_NOT_FOUND');
    if (dbItem.status !== 'AVAILABLE') return apiError(`"${dbItem.name}" is currently unavailable`, 400, 'ITEM_UNAVAILABLE');

    let unitPrice: number = dbItem.base_price as number;
    let sizeLabel: string | null = null;
    let sizeId:    string | null = null;

    if (cartItem.sizeId) {
      const dbSize = sizeMap.get(cartItem.sizeId);
      if (!dbSize || dbSize.item_id !== cartItem.itemId) return apiError(`Invalid size for "${dbItem.name}"`, 400, 'INVALID_SIZE');
      if (!dbSize.is_available) return apiError(`Size "${dbSize.label}" is unavailable`, 400, 'SIZE_UNAVAILABLE');
      unitPrice = dbSize.price as number;
      sizeLabel = dbSize.label as string;
      sizeId    = dbSize.id   as string;
    }

    let addonTotal = 0;
    for (const addonId of cartItem.addonIds ?? []) {
      const dbAddon = addonMap.get(addonId);
      if (!dbAddon || dbAddon.item_id !== cartItem.itemId) return apiError(`Invalid addon: ${addonId}`, 400, 'INVALID_ADDON');
      if (dbAddon.is_available) addonTotal += dbAddon.price as number;
    }

    subtotal += (unitPrice + addonTotal) * cartItem.qty;
    pricedItems.push({ item_id: cartItem.itemId, item_name: dbItem.name as string, size_id: sizeId, size_label: sizeLabel, unit_price: unitPrice, qty: cartItem.qty, addon_total: addonTotal, notes: cartItem.notes ?? '', sugar_level: cartItem.sugarLevel ?? null });
  }

  const { data: tenantData } = await db.from('tenants').select('settings, slug').eq('id', tenant.tenantId).single();
  const settings  = tenantData?.settings as Record<string, unknown> | null;
  const vatRate   = settings?.vatEnabled ? ((settings.vatRate as number) ?? 0.12) : 0;

  const discountType  = input.discountType ?? null;
  const pwdCount      = input.pwdCount    ?? 0;
  const seniorCount   = input.seniorCount ?? 0;
  const qualifyingPax = Math.min(pwdCount + seniorCount, input.pax);
  let discountPct    = 0;
  let discountAmount = 0;

  if ((discountType === 'PWD' || discountType === 'SENIOR') && settings?.pwdSeniorDiscountEnabled !== false && qualifyingPax > 0) {
    discountPct   = 20;
    const preVat   = Math.round(subtotal / (1 + vatRate) * 100) / 100;
    const perPerson = Math.round(preVat / input.pax * 100) / 100;
    discountAmount  = Math.round(perPerson * qualifyingPax * 0.20 * 100) / 100;
  }

  let promoCodeId:  string | null = null;
  let promoCodeStr: string | null = input.promoCode ?? null;

  if (promoCodeStr && !discountType) {
    const { data: promo } = await db.from('promo_codes')
      .select('id, discount_type, discount_value, usage_limit, usage_count, expires_at, min_order_amount, is_active')
      .eq('tenant_id', tenant.tenantId).eq('code', promoCodeStr).eq('is_active', true).maybeSingle();
    if (promo) {
      const valid = (!promo.expires_at || new Date(promo.expires_at as string) > new Date())
        && (promo.usage_limit === null || (promo.usage_count as number) < (promo.usage_limit as number))
        && subtotal >= ((promo.min_order_amount as number) ?? 0);
      if (valid) {
        const disc = promo.discount_type === 'PERCENT' ? Math.round(subtotal * ((promo.discount_value as number) / 100) * 100) / 100 : Math.min(promo.discount_value as number, subtotal);
        discountAmount += disc;
        discountPct     = promo.discount_type === 'PERCENT' ? (promo.discount_value as number) : 0;
        promoCodeId     = promo.id as string;
      } else { promoCodeStr = null; }
    } else { promoCodeStr = null; }
  }

  let deliveryFee = 0;
  if (input.orderType === 'DELIVERY' && input.deliveryZone) {
    const { data: zone } = await db.from('delivery_zones').select('fee, min_order').eq('tenant_id', tenant.tenantId).eq('name', input.deliveryZone).single();
    if (zone) {
      deliveryFee = Number(zone.fee);
      if (subtotal < Number(zone.min_order)) return apiError(`Min order for this zone: \u20b1${zone.min_order}`, 400, 'BELOW_MIN_ORDER');
    }
  }

  const prefix = ((tenantData?.slug as string | undefined) ?? 'ORD').toUpperCase().slice(0, 6);
  const { data: orderNumber, error: seqError } = await db.rpc('next_order_number', { p_tenant_id: tenant.tenantId, p_prefix: prefix });
  if (seqError || !orderNumber) return apiError('Failed to generate order number', 500);

  const { data: result, error: rpcErr } = await db.rpc('create_order_atomic', {
    p_tenant_id: tenant.tenantId, p_order_number: orderNumber,
    p_customer_name: input.customerName.trim(), p_customer_phone: input.customerPhone?.trim() ?? null, p_customer_email: input.customerEmail?.trim() ?? null,
    p_pax: input.pax, p_order_type: input.orderType,
    p_table_id: tableId, p_table_name: tableName,
    p_delivery_address: input.deliveryAddress?.trim() ?? null, p_delivery_fee: deliveryFee, p_delivery_zone: input.deliveryZone ?? null,
    p_notes: input.notes?.trim() ?? null,
    p_discount_type: discountType, p_discount_pct: discountPct, p_discount_amount: discountAmount,
    p_promo_code_id: promoCodeId, p_promo_code: promoCodeStr,
    p_pwd_count: pwdCount, p_senior_count: seniorCount,
    p_idempotency_key: idempotencyKey, p_items: pricedItems,
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? '';
    if (msg.includes('ITEM_SOLD_OUT'))        return apiError(msg.split(':').slice(1).join(':').trim() || 'Item sold out', 400, 'ITEM_SOLD_OUT');
    if (msg.includes('INSUFFICIENT_STOCK'))   return apiError(msg.split(':').slice(1).join(':').trim() || 'Insufficient stock', 400, 'INSUFFICIENT_STOCK');
    if (msg.includes('PROMO_EXHAUSTED'))      return apiError('Promo code limit reached', 400, 'PROMO_EXHAUSTED');
    if (msg.includes('PRICE_MANIPULATION'))   return apiError('Price validation failed', 400, 'PRICE_MANIPULATION');
    if (msg.includes('INVALID_DELIVERY_FEE')) return apiError('Delivery fee mismatch', 400, 'INVALID_DELIVERY_FEE');
    if (msg.includes('idempotency') || msg.includes('unique')) {
      if (idempotencyKey) {
        const { data: existing } = await db.from('orders').select('id, order_number, total_amount, status, payment_status').eq('tenant_id', tenant.tenantId).eq('idempotency_key', idempotencyKey).single();
        if (existing) return apiSuccess({ orderId: existing.id, orderNumber: existing.order_number, totalAmount: Number(existing.total_amount), status: existing.status }, 200);
      }
    }
    console.error('[POST /api/orders] RPC error:', rpcErr);
    return apiError('Order creation failed. Please try again.', 500);
  }

  const o           = Array.isArray(result) ? result[0] : result;
  const orderId     = o?.order_id     as string;
  const finalNumber = o?.order_number as string;
  const finalTotal  = Number(o?.total_amount ?? 0) + deliveryFee;

  void db.from('order_events').insert({ tenant_id: tenant.tenantId, order_id: orderId, event_type: 'order_created', to_status: 'PENDING', metadata: { ip, itemCount: pricedItems.length, orderType: input.orderType } });
  void logEvent({ eventType: 'ORDER_CREATED', entityType: 'ORDER', entityId: orderId, tenantId: tenant.tenantId, source: 'POS', details: { orderNumber: finalNumber, customerName: input.customerName, totalAmount: finalTotal, itemCount: pricedItems.length, orderType: input.orderType, isTest: input.isTest } });

  const smsEnabled = settings?.smsEnabled === true;
  if (smsEnabled && input.customerPhone) {
    void (async () => {
      try {
        const { count } = await db.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.tenantId).in('status', ['PENDING','CONFIRMED','PREPARING']).eq('is_test', false);
        const eta = count && count > 1 ? (8 + (count - 1) * 3) : 8;
        const businessName = (settings?.businessName as string | undefined) ?? (tenantData?.slug as string) ?? 'TYG POS';
        await sendSMS(input.customerPhone!, orderCreatedSMS(finalNumber, businessName, eta));
      } catch { /* non-fatal */ }
    })();
  }


  // Sheets: explicit business event for order tab (logEvent is DB-only now)
  fireSheetsWebhook('LOG_ORDER', {
    orderNumber: finalNumber, createdAt: new Date().toISOString(),
    customerName: input.customerName, pax: input.pax,
    subtotal, vatAmount: 0, totalAmount: finalTotal,
    orderType: input.orderType,
    deliveryAddress: input.deliveryAddress ?? null, deliveryFee,
    status: 'PENDING', paymentStatus: 'UNPAID',
    notes: input.notes ?? '', isTest: input.isTest ?? false,
    items: pricedItems.map(i => ({ itemName: i.item_name, sizeLabel: i.size_label, qty: i.qty, unitPrice: i.unit_price })),
  }).catch(() => {});

  return apiSuccess({ orderId, orderNumber: finalNumber, totalAmount: finalTotal, deliveryFee, status: 'PENDING', paymentStatus: 'UNPAID', trackUrl: `/orders/track?id=${orderId}` }, 201);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx: AuthContext) => {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const limit        = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
    const dateFrom     = searchParams.get('dateFrom');
    const dateTo       = searchParams.get('dateTo');
    const search       = searchParams.get('search');
    const db = createServiceClient();
    const phOffset = 8 * 60 * 60 * 1000;
    const todayPH  = new Date(Date.now() + phOffset).toISOString().slice(0, 10);
    const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;
    const fromDate = (dateFrom && DATE_RE.test(dateFrom)) ? dateFrom : todayPH;
    const toDate   = (dateTo   && DATE_RE.test(dateTo))   ? dateTo   : todayPH;
    const fromUTC  = new Date(`${fromDate}T00:00:00+08:00`).toISOString();
    const toUTC    = new Date(`${toDate}T23:59:59+08:00`).toISOString();

    let query = db.from('orders')
      .select(`id, order_number, status, payment_status, total_amount, discount_type, discount_amount, customer_name, customer_phone, created_at, pax, notes, table_id, branch_id, cancel_reason, rating, order_type, promo_code, delivery_address, delivery_fee, delivery_zone, table:restaurant_tables(name), items:order_items(id, item_name, size_label, qty, line_total, addon_total, sugar_level, notes)`)
      .eq('tenant_id', ctx.tenantId).eq('is_test', false)
      .gte('created_at', fromUTC).lte('created_at', toUTC)
      .order('created_at', { ascending: false }).limit(limit);

    if (statusFilter === 'active') {
      query = query.in('status', ['PENDING','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY']);
    } else if (statusFilter && statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) return apiError('Failed to fetch orders', 500);

    type FlatOrder = Record<string, unknown>;
    let orders: FlatOrder[] = ((data ?? []) as unknown as FlatOrder[]).map(o => ({ ...o, table_name: (o['table'] as { name?: string } | null)?.name ?? null, table: undefined }));
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(o => String(o['order_number']).includes(q) || (typeof o['customer_name'] === 'string' && o['customer_name'].toLowerCase().includes(q)) || (typeof o['customer_phone'] === 'string' && o['customer_phone'].includes(q)));
    }
    return apiSuccess(orders);
  }, ['OWNER','ADMIN','MANAGER','CASHIER','KITCHEN']);
}
