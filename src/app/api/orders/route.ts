export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — POST /api/orders
// Creates an order. Server ALWAYS re-prices from DB.
// NEVER trusts prices from client request body.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { resolveTenant, apiSuccess, apiError, getClientIp, withStaffAuth } from '@/lib/auth/middleware';
import { orderRateLimit } from '@/lib/redis/ratelimit';
import { fireSheetsWebhook } from '@/lib/sheets/webhook';
import { logEvent } from '@/lib/logger';

// ── Request Validation Schema ────────────────────────────────
// Prices are intentionally NOT accepted from client — server re-fetches
const CartItemSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  sizeId: z.string().uuid().nullable().optional(),
  qty: z.number().int().min(1).max(20),
  addonIds: z.array(z.string().uuid()).max(10).optional().default([]),
  notes: z.string().max(200).optional().default(''),
});

const CreateOrderSchema = z.object({
  tenantSlug: z.string().min(3).max(50),
  tableToken: z.string().min(8).max(36).optional(),
  customerName: z.string().min(1).max(100).trim(),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().optional(),
  pax: z.number().int().min(1).max(50).default(1),
  items: z.array(CartItemSchema).min(1).max(30),
  notes: z.string().max(500).optional(),
  isTest: z.boolean().optional().default(false),
  discountType: z.enum(['PWD', 'SENIOR', 'PROMO', 'CUSTOM']).optional(),
});

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Rate limiting (Upstash Redis — never in-memory) ──────
  const ip = getClientIp(req);
  const { success: rateLimitOk, remaining } = await orderRateLimit.limit(ip);
  if (!rateLimitOk) {
    return apiError('Too many orders. Please wait a few minutes.', 429, 'RATE_LIMIT_EXCEEDED');
  }

  // ── 2. Parse & validate request body ────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const parseResult = CreateOrderSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.errors[0]?.message ?? 'Validation error',
      400,
      'VALIDATION_ERROR'
    );
  }

  const input = parseResult.data;

  // isTest guard: only staff sessions may create test orders
  if (input.isTest) {
    const staffCookie = req.cookies.get('tyg-staff-session')?.value;
    if (!staffCookie) {
      return apiError('Test orders require staff authentication', 403, 'TEST_ORDER_FORBIDDEN');
    }
  }

  const db = createServiceClient();

  // ── 3. Resolve tenant ────────────────────────────────────────
  const tenant = await resolveTenant(input.tenantSlug);
  if (!tenant) return apiError('Tenant not found', 404, 'TENANT_NOT_FOUND');

  // ── 4. Check ordering enabled & trial status ─────────────────
  if (!tenant.isOrderingEnabled) {
    return apiError('Online ordering is currently disabled for this café', 503, 'ORDERING_DISABLED');
  }

  if (tenant.planStatus === 'SUSPENDED' || tenant.planStatus === 'CANCELLED') {
    return apiError('This café\'s system is currently unavailable', 503, 'ACCOUNT_SUSPENDED');
  }

  if (tenant.planStatus === 'TRIAL' && !tenant.isTrialActive) {
    return apiError('Trial period has ended', 402, 'TRIAL_EXPIRED');
  }

  // ── 5. Resolve table (if QR token provided) ──────────────────
  let tableId: string | null = null;
  let branchId: string | null = null;

  if (input.tableToken) {
    const { data: table } = await db
      .from('restaurant_tables')
      .select('id, branch_id, is_active, tenant_id')
      .eq('qr_token', input.tableToken)
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (!table || !table.is_active) {
      return apiError('Invalid or inactive table QR code', 400, 'INVALID_TABLE');
    }

    tableId = table.id as string;
    branchId = table.branch_id as string | null;
  }

  // ── 6. SERVER RE-PRICES ALL ITEMS FROM DB ────────────────────
  // ARCHITECTURE RULE: NEVER trust prices from client. Always fetch from DB.
  const itemIds = input.items.map((i) => i.itemId);
  const sizeIds = input.items
    .filter((i) => i.sizeId != null)
    .map((i) => i.sizeId as string);
  const addonIds = input.items.flatMap((i) => i.addonIds ?? []);

  const [itemsResult, sizesResult, addonsResult] = await Promise.all([
    db
      .from('menu_items')
      .select('id, name, base_price, status, tenant_id')
      .in('id', itemIds)
      .eq('tenant_id', tenant.tenantId),
    sizeIds.length > 0
      ? db
          .from('menu_item_sizes')
          .select('id, item_id, label, price, is_available, tenant_id')
          .in('id', sizeIds)
          .eq('tenant_id', tenant.tenantId)
      : { data: [], error: null },
    addonIds.length > 0
      ? db
          .from('menu_item_addons')
          .select('id, item_id, label, price, is_available, tenant_id')
          .in('id', addonIds)
          .eq('tenant_id', tenant.tenantId)
      : { data: [], error: null },
  ]);

  if (itemsResult.error) return apiError('Failed to fetch menu items', 500);

  const itemMap = new Map((itemsResult.data ?? []).map((i) => [i.id as string, i]));
  const sizeMap = new Map((sizesResult.data ?? []).map((s) => [s.id as string, s]));
  const addonMap = new Map((addonsResult.data ?? []).map((a) => [a.id as string, a]));

  // Build priced order items
  let subtotal = 0;
  const pricedItems: Array<{
    tenant_id: string;
    item_id: string;
    size_id: string | null;
    item_name: string;
    size_label: string | null;
    unit_price: number;
    qty: number;
    addons: Array<{ label: string; price: number }>;
    addon_total: number;
    notes: string;
  }> = [];

  for (const cartItem of input.items) {
    const dbItem = itemMap.get(cartItem.itemId);
    if (!dbItem) return apiError(`Item not found: ${cartItem.itemId}`, 400, 'ITEM_NOT_FOUND');
    if (dbItem.status !== 'AVAILABLE') {
      return apiError(`"${dbItem.name}" is currently unavailable`, 400, 'ITEM_UNAVAILABLE');
    }

    // Determine unit price: use size price if provided, else base_price
    let unitPrice: number = dbItem.base_price as number;
    let sizeLabel: string | null = null;
    let sizeId: string | null = null;

    if (cartItem.sizeId) {
      const dbSize = sizeMap.get(cartItem.sizeId);
      if (!dbSize || dbSize.item_id !== cartItem.itemId) {
        return apiError(`Invalid size for item "${dbItem.name}"`, 400, 'INVALID_SIZE');
      }
      if (!dbSize.is_available) {
        return apiError(`Size "${dbSize.label}" is unavailable`, 400, 'SIZE_UNAVAILABLE');
      }
      unitPrice = dbSize.price as number;
      sizeLabel = dbSize.label as string;
      sizeId = dbSize.id as string;
    }

    // Price addons from DB
    const pricedAddons: Array<{ label: string; price: number }> = [];
    let addonTotal = 0;

    for (const addonId of cartItem.addonIds ?? []) {
      const dbAddon = addonMap.get(addonId);
      if (!dbAddon || dbAddon.item_id !== cartItem.itemId) {
        return apiError(`Invalid addon: ${addonId}`, 400, 'INVALID_ADDON');
      }
      if (!dbAddon.is_available) continue; // silently skip unavailable addons
      pricedAddons.push({ label: dbAddon.label as string, price: dbAddon.price as number });
      addonTotal += dbAddon.price as number;
    }

    const lineTotal = (unitPrice * cartItem.qty) + (addonTotal * cartItem.qty);
    subtotal += lineTotal;

    pricedItems.push({
      tenant_id: tenant.tenantId,
      item_id: cartItem.itemId,
      size_id: sizeId,
      item_name: dbItem.name as string,
      size_label: sizeLabel,
      unit_price: unitPrice,
      qty: cartItem.qty,
      addons: pricedAddons,
      addon_total: addonTotal,
      notes: cartItem.notes ?? '',
    });
  }

  // ── 7. Fetch tenant settings for VAT calculation ─────────────
  const { data: tenantData } = await db
    .from('tenants')
    .select('settings, slug')
    .eq('id', tenant.tenantId)
    .single();

  const settings = tenantData?.settings as {
    vatEnabled: boolean;
    vatRate: number;
    pwdSeniorDiscountEnabled: boolean;
  } | null;

  const vatRate = settings?.vatEnabled ? (settings.vatRate ?? 0.12) : 0;

  // ── PWD / Senior discount (PH: 20% off + VAT exempt on discounted amount) ──
  // Per TRAIN Law: PWD/Senior discount = 20% off VATable base, then exempt from VAT
  let discountPct = 0;
  let discountAmount = 0;
  const discountType = input.discountType ?? null;

  // ── PH pricing: menu prices are VAT-inclusive. Extract VAT for BIR reporting only.
  // TRAIN Law PWD/Senior: 20% off pre-VAT base price, then VAT-exempt.
  // The DB trigger `order_items_recalc` is the authoritative calculator — it runs AFTER
  // items insert and overwrites totals. We pass placeholder values here; always re-fetch.
  if ((discountType === 'PWD' || discountType === 'SENIOR') && settings?.pwdSeniorDiscountEnabled !== false) {
    discountPct = 20;
    // Pre-VAT base (TRAIN Law basis for the 20% discount)
    const preVatBase = Math.round(subtotal / (1 + vatRate) * 100) / 100;
    discountAmount = Math.round(preVatBase * 0.20 * 100) / 100;
  }

  const prefix = ((tenantData?.slug as string | undefined) ?? 'ORD').toUpperCase().slice(0, 6);

  // ── 8. Insert order + items atomically ──────────────────────
  const { data: orderNumber, error: seqError } = await db
    .rpc('next_order_number', { p_tenant_id: tenant.tenantId, p_prefix: prefix });
  if (seqError || !orderNumber) return apiError('Failed to generate order number', 500);

  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      table_id: tableId,
      order_number: orderNumber,
      customer_name: input.customerName,
      customer_phone: input.customerPhone ?? null,
      customer_email: input.customerEmail ?? null,
      pax: input.pax,
      subtotal_override: subtotal,
      vat_amount: 0,       // trigger will correct after items insert
      total_amount: subtotal,
      notes: input.notes ?? null,
      is_test: input.isTest,
      status: 'PENDING',
      payment_status: 'UNPAID',
      discount_type: discountType,
      discount_pct: discountPct,
      discount_amount: discountAmount,
    })
    .select('id, order_number, status, payment_status, created_at')
    .single();

  if (orderError || !order) {
    console.error('Order insert error:', orderError);
    return apiError('Failed to create order', 500);
  }

  // Insert order items (line_total is GENERATED — do NOT insert it)
  // The order_items_recalc trigger fires AFTER this insert and corrects order totals.
  const itemInserts = pricedItems.map((item) => ({
    tenant_id: item.tenant_id,
    order_id: order.id,
    item_id: item.item_id,
    size_id: item.size_id,
    item_name: item.item_name,
    size_label: item.size_label,
    unit_price: item.unit_price,
    qty: item.qty,
    addons: item.addons,
    addon_total: item.addon_total,
    notes: item.notes || null,
  }));

  const { error: itemsError } = await db.from('order_items').insert(itemInserts);

  if (itemsError) {
    await db.from('orders').delete().eq('id', order.id);
    return apiError('Failed to save order items', 500);
  }

  // Re-fetch corrected totals from DB (trigger has run by now)
  const { data: correctedOrder } = await db
    .from('orders')
    .select('total_amount, vat_amount, subtotal_override, discount_amount')
    .eq('id', order.id)
    .single();

  const finalTotal = Number(correctedOrder?.total_amount ?? subtotal);
  const finalVat   = Number(correctedOrder?.vat_amount ?? 0);
  const finalDiscount = Number(correctedOrder?.discount_amount ?? discountAmount);

  // Log order creation event
  await db.from('order_events').insert({
    tenant_id: tenant.tenantId,
    order_id: order.id,
    event_type: 'order_created',
    to_status: 'PENDING',
    metadata: { ip, itemCount: pricedItems.length },
  });

  void logEvent({
    eventType: 'ORDER_CREATED',
    entityType: 'ORDER',
    entityId: order.id,
    tenantId: tenant.tenantId,
    source: 'POS',
    details: {
      orderNumber: order.order_number,
      customerName: input.customerName,
      pax: input.pax,
      totalAmount: finalTotal,
      itemCount: pricedItems.length,
      isTest: input.isTest ?? false,
      discountType,
      discountAmount: finalDiscount,
    },
  });

  fireSheetsWebhook('LOG_ORDER', {
    orderNumber: order.order_number,
    createdAt: new Date().toISOString(),
    customerName: input.customerName,
    pax: input.pax,
    subtotal,
    vatAmount: finalVat,
    totalAmount: finalTotal,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    notes: input.notes ?? '',
    isTest: input.isTest ?? false,
    items: pricedItems.map(i => ({
      itemName: i.item_name,
      sizeLabel: i.size_label,
      qty: i.qty,
      unitPrice: i.unit_price,
    })),
  }).catch(() => {}); // fire-and-forget

  // Resolve table name for response
  const tableName = tableId
    ? ((await db.from('restaurant_tables').select('name').eq('id', tableId).single()).data?.name as string | undefined) ?? null
    : null;

  return apiSuccess(
    {
      orderId: order.id,
      trackUrl: `/orders/track?id=${order.id}`,
      orderNumber: order.order_number,
      totalAmount: finalTotal,
      status: order.status,
      paymentStatus: order.payment_status,
      tableName,
    },
    201
  );
}

// GET /api/orders?tenantSlug=yani&status=active&limit=8
// Returns active orders for the dashboard. Requires staff auth.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'active' | specific status | null
    const limit        = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
    const dateFrom     = searchParams.get('dateFrom');   // YYYY-MM-DD PH date filter
    const dateTo       = searchParams.get('dateTo');     // YYYY-MM-DD
    const search       = searchParams.get('search');     // order number or customer name

    const db = createServiceClient();

    // Default: today (PH time = UTC+8)
    const phOffset = 8 * 60 * 60 * 1000;
    const nowPH    = new Date(Date.now() + phOffset);
    const todayPH  = nowPH.toISOString().slice(0, 10);

    // Validate YYYY-MM-DD format to prevent invalid Date errors
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const safeFrom = dateFrom && DATE_RE.test(dateFrom) ? dateFrom : null;
    const safeTo   = dateTo   && DATE_RE.test(dateTo)   ? dateTo   : null;

    const fromDate = safeFrom ?? todayPH;
    const toDate   = safeTo   ?? todayPH;

    // Convert PH date range to UTC timestamps
    const fromUTC = new Date(`${fromDate}T00:00:00+08:00`).toISOString();
    const toUTC   = new Date(`${toDate}T23:59:59+08:00`).toISOString();

    let query = db.from('orders')
      .select(`
        id, order_number, status, payment_status, total_amount, discount_type, discount_amount,
        customer_name, customer_phone, created_at, pax, notes, table_id, branch_id, cancel_reason,
        table:restaurant_tables(name),
        items:order_items(id, item_name, size_label, qty, line_total, addon_total)
      `)
      .eq('tenant_id', ctx.tenantId)
      .eq('is_test', false)
      .gte('created_at', fromUTC)
      .lte('created_at', toUTC)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusFilter === 'active') {
      query = query.in('status', ['PENDING', 'CONFIRMED', 'PREPARING', 'READY']);
    } else if (statusFilter && statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) return apiError('Failed to fetch orders', 500);

    // Cast away Supabase inferred type — we reshape the object
    type FlatOrder = Record<string, unknown>;
    let orders: FlatOrder[] = ((data ?? []) as unknown as FlatOrder[]).map(o => ({
      ...o,
      table_name: (o['table'] as { name?: string } | null)?.name ?? null,
      table: undefined,
    }));

    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(o =>
        String(o['order_number']).includes(q) ||
        (typeof o['customer_name'] === 'string' && (o['customer_name'] as string).toLowerCase().includes(q)) ||
        (typeof o['customer_phone'] === 'string' && (o['customer_phone'] as string).includes(q))
      );
    }

    return apiSuccess(orders);
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN']);
}
