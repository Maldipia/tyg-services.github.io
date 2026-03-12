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
  tableToken: z.string().min(8).max(32).optional(),
  customerName: z.string().min(1).max(100).trim(),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().optional(),
  pax: z.number().int().min(1).max(50).default(1),
  items: z.array(CartItemSchema).min(1).max(30),
  notes: z.string().max(500).optional(),
  isTest: z.boolean().optional().default(false),
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
  } | null;

  const vatRate = settings?.vatEnabled ? (settings.vatRate ?? 0.12) : 0;
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;
  const prefix = ((tenantData?.slug as string | undefined) ?? 'ORD').toUpperCase().slice(0, 6);

  // ── 8. Insert order + items atomically ──────────────────────
  // Postgres function handles the sequential order number
  const { data: orderNumber, error: seqError } = await db
    .rpc('next_order_number', { p_tenant_id: tenant.tenantId, p_prefix: prefix });

  if (seqError || !orderNumber) {
    return apiError('Failed to generate order number', 500);
  }

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
      vat_amount: vatAmount,
      total_amount: totalAmount,
      notes: input.notes ?? null,
      is_test: input.isTest,
      status: 'PENDING',
      payment_status: 'UNPAID',
    })
    .select('id, order_number, total_amount, status, payment_status, created_at')
    .single();

  if (orderError || !order) {
    console.error('Order insert error:', orderError);
    return apiError('Failed to create order', 500);
  }

  // Insert order items (line_total is GENERATED — do NOT insert it)
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
    // Rollback order if items fail
    await db.from('orders').delete().eq('id', order.id);
    return apiError('Failed to save order items', 500);
  }

  // Log order creation event
  await db.from('order_events').insert({
    tenant_id: tenant.tenantId,
    order_id: order.id,
    event_type: 'order_created',
    to_status: 'PENDING',
    metadata: { ip, itemCount: pricedItems.length },
  });


  // Fire-and-forget webhook to Google Sheets (never blocks response)
  // Central event log
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
      totalAmount,
      itemCount: pricedItems.length,
      isTest: input.isTest ?? false,
    },
  });

  fireSheetsWebhook('LOG_ORDER', {
    orderNumber: order.order_number,
    createdAt: new Date().toISOString(),
    customerName: input.customerName,
    pax: input.pax,
    subtotal,
    vatAmount,
    totalAmount,
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

  return apiSuccess(
    {
      orderId: order.id,
      orderNumber: order.order_number,
      totalAmount: order.total_amount,
      status: order.status,
      paymentStatus: order.payment_status,
    },
    201
  );
}

// GET /api/orders?tenantSlug=yani&status=active&limit=8
// Returns active orders for the dashboard. Requires staff auth.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'active' | null
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);

    const db = createServiceClient();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    let query = db.from('orders')
      .select('id, order_number, status, payment_status, total_amount, customer_name, created_at, pax')
      .eq('tenant_id', ctx.tenantId)
      .eq('is_test', false)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusFilter === 'active') {
      query = query.in('status', ['PENDING', 'CONFIRMED', 'PREPARING', 'READY']);
    }

    const { data, error } = await query;
    if (error) return apiError('Failed to fetch orders', 500);
    return apiSuccess(data ?? []);
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN']);
}
