export const dynamic = 'force-dynamic';
// ════════════════════════════════════════════════════════════════
// POST /api/orders  — create order
// GET  /api/orders  — list orders (staff-auth)
//
// API RESPONSIBILITY: rate-limit · shape (Zod) · auth · QR→tableId · call RPC
// ALL business logic in create_order_atomic RPC.
// ════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { resolveTenant, apiSuccess, apiError, getClientIp, withStaffAuth } from '@/lib/auth/middleware';
import { orderRateLimit } from '@/lib/redis/ratelimit';
import { sendSMS, orderCreatedSMS } from '@/lib/semaphore/sms';
import { logEvent } from '@/lib/logger';
import { writeSheetsAction } from '@/lib/sheets/direct';
import type { AuthContext } from '@/types';

const CartItemSchema = z.object({
  itemId:     z.string().uuid('Invalid item ID'),
  sizeId:     z.string().uuid().nullable().optional(),
  addonIds:   z.array(z.string().uuid()).max(10).optional().default([]),
  qty:        z.number().int().min(1).max(20),
  notes:      z.string().max(200).nullable().optional().default(''),
  sugarLevel: z.enum(['GROUNDED','YANI','COMFORT','FULL_SWEET']).optional(),
});

const CreateOrderSchema = z.object({
  tenantSlug:      z.string().min(1).max(50),
  customerName:    z.string().min(1).max(100).trim(),
  customerPhone:   z.string().max(20).nullable().optional(),
  customerEmail:   z.string().email().nullable().optional().or(z.literal('')),
  pax:             z.number().int().min(1).max(50).default(1),
  items:           z.array(CartItemSchema).min(1).max(50),
  notes:           z.string().max(500).nullable().optional(),
  orderType:       z.enum(['DINE_IN','TAKEOUT','DELIVERY']).default('DINE_IN'),
  tableToken:      z.string().min(8).max(36).optional(),
  tableId:         z.string().uuid().nullable().optional(),
  tableName:       z.string().max(100).nullable().optional(),
  deliveryAddress: z.string().max(500).nullable().optional(),
  deliveryZone:    z.string().max(200).nullable().optional(),
  discountType:    z.enum(['PWD','SENIOR','PROMO','CUSTOM']).optional(),
  pwdCount:        z.number().int().min(0).max(50).default(0),
  seniorCount:     z.number().int().min(0).max(50).default(0),
  promoCode:       z.string().max(50).trim().toUpperCase().nullable().optional(),
  idempotencyKey:  z.string().min(1).max(100).optional(),
  isTest:          z.boolean().optional().default(false),
  source:          z.enum(['QR','POS','PLATFORM']).optional().default('QR'),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const { success: rateLimitOk } = await orderRateLimit.limit(ip);
  if (!rateLimitOk) return apiError('Too many orders. Please wait a few minutes.', 429, 'RATE_LIMIT_EXCEEDED');

  let body: unknown;
  try { body = await req.json(); } catch { return apiError('Invalid JSON body', 400); }

  const parse = CreateOrderSchema.safeParse(body);
  if (!parse.success) return apiError(parse.error.errors[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR');

  const input = parse.data;

  if (input.isTest) {
    if (!req.cookies.get('tyg-staff-session')?.value)
      return apiError('Test orders require staff authentication', 403, 'TEST_ORDER_FORBIDDEN');
  }

  if (input.orderType === 'DELIVERY' && !input.deliveryAddress?.trim())
    return apiError('Delivery address required for DELIVERY orders', 400, 'DELIVERY_ADDRESS_REQUIRED');

  const db = createServiceClient();

  const tenant = await resolveTenant(input.tenantSlug);
  if (!tenant) return apiError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  if (!tenant.isOrderingEnabled) return apiError('Ordering is currently disabled', 503, 'ORDERING_DISABLED');
  if (tenant.planStatus === 'SUSPENDED' || tenant.planStatus === 'CANCELLED')
    return apiError("This café's system is currently unavailable", 503, 'ACCOUNT_SUSPENDED');
  if (tenant.planStatus === 'TRIAL' && !tenant.isTrialActive)
    return apiError('Trial period has ended', 402, 'TRIAL_EXPIRED');

  let tableId:   string | null = input.tableId   ?? null;
  let tableName: string | null = input.tableName ?? null;

  if (input.tableToken) {
    const { data: table } = await db.from('restaurant_tables')
      .select('id, name, is_active, tenant_id')
      .eq('qr_token', input.tableToken).eq('tenant_id', tenant.tenantId).single();
    if (!table || !table.is_active) return apiError('Invalid or inactive table QR code', 400, 'INVALID_TABLE');
    tableId   = table.id as string;
    tableName = table.name as string;
  }

  const rpcItems = input.items.map(item => ({
    item_id:     item.itemId,
    size_id:     item.sizeId ?? null,
    addon_ids:   item.addonIds ?? [],
    qty:         item.qty,
    notes:       item.notes ?? '',
    sugar_level: item.sugarLevel ?? null,
  }));

  const { data: result, error: rpcErr } = await db.rpc('create_order_atomic', {
    p_tenant_id:        tenant.tenantId,
    p_customer_name:    input.customerName.trim(),
    p_customer_phone:   input.customerPhone?.trim()   ?? null,
    p_customer_email:   input.customerEmail?.trim()   ?? null,
    p_pax:              input.pax,
    p_order_type:       input.orderType,
    p_table_id:         tableId,
    p_table_name:       tableName,
    p_delivery_address: input.deliveryAddress?.trim() ?? null,
    p_delivery_zone:    input.deliveryZone ?? null,
    p_notes:            input.notes?.trim() ?? null,
    p_discount_type:    input.discountType ?? null,
    p_pwd_count:        input.pwdCount  ?? 0,
    p_senior_count:     input.seniorCount ?? 0,
    p_promo_code:       input.promoCode ?? null,
    p_idempotency_key:  input.idempotencyKey ?? null,
    p_items:            rpcItems,
    p_source:           input.source ?? 'QR',
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? '';
    if (msg.includes('MISSING_IDEMPOTENCY_KEY')) return apiError('idempotency_key is required', 400, 'MISSING_IDEMPOTENCY_KEY');
    if (msg.includes('ITEM_SOLD_OUT'))            return apiError(msg.split(':').slice(1).join(':').trim() || 'Item sold out', 400, 'ITEM_SOLD_OUT');
    if (msg.includes('INSUFFICIENT_STOCK'))       return apiError(msg.split(':').slice(1).join(':').trim() || 'Insufficient stock', 400, 'INSUFFICIENT_STOCK');
    if (msg.includes('BELOW_MIN_ORDER'))          return apiError(msg.split(':').slice(1).join(':').trim() || 'Order below minimum', 400, 'BELOW_MIN_ORDER');
    if (msg.includes('INVALID_DELIVERY_ZONE'))    return apiError(msg.split(':').slice(1).join(':').trim() || 'Invalid delivery zone', 400, 'INVALID_DELIVERY_ZONE');
    if (msg.includes('ITEM_NOT_FOUND'))           return apiError('One or more items not found', 404, 'ITEM_NOT_FOUND');
    if (msg.includes('INVALID_SIZE'))             return apiError(msg.split(':').slice(1).join(':').trim() || 'Invalid size', 400, 'INVALID_SIZE');
    if (msg.includes('INVALID_ADDON'))            return apiError(msg.split(':').slice(1).join(':').trim() || 'Invalid addon', 400, 'INVALID_ADDON');
    if (msg.includes('idempotency') || msg.includes('unique')) {
      const { data: existing } = await db.from('orders')
        .select('id, order_number, total_amount, status')
        .eq('tenant_id', tenant.tenantId).eq('idempotency_key', input.idempotencyKey ?? '').single();
      if (existing) return apiSuccess({ orderId: existing.id, orderNumber: existing.order_number, totalAmount: Number(existing.total_amount), status: existing.status }, 200);
    }
    console.error('[POST /api/orders] RPC error:', rpcErr);
    return apiError('Order creation failed. Please try again.', 500);
  }

  const o           = Array.isArray(result) ? result[0] : result;
  const orderId       = o?.order_id      as string;
  const orderNumber   = o?.order_number  as string;
  const totalAmount   = Number(o?.total_amount   ?? 0); // INCLUSIVE of delivery_fee + service_charge
  const subtotal      = Number(o?.subtotal       ?? 0);
  const deliveryFee   = Number(o?.delivery_fee   ?? 0);
  const serviceCharge = Number(o?.service_charge ?? 0);

  void logEvent({
    eventType: 'ORDER_CREATED', entityType: 'ORDER', entityId: orderId,
    tenantId: tenant.tenantId, source: 'POS',
    details: { orderNumber, customerName: input.customerName, totalAmount, orderType: input.orderType, isTest: input.isTest },
  });

  const { data: tenantRow } = await db.from('tenants').select('settings, name').eq('id', tenant.tenantId).single();
  const settings = tenantRow?.settings as Record<string, unknown> | null;

  if (settings?.smsEnabled === true && input.customerPhone) {
    void (async () => {
      try {
        const { count } = await db.from('orders').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.tenantId).in('status', ['PENDING','CONFIRMED','PREPARING']).eq('is_test', false);
        const eta = count && count > 1 ? (8 + (count - 1) * 3) : 8;
        const biz = (settings?.businessName as string | undefined) ?? (tenantRow?.name as string) ?? 'TYG POS';
        await sendSMS(input.customerPhone!, orderCreatedSMS(orderNumber, biz, eta));
      } catch { /* non-fatal */ }
    })();
  }

  writeSheetsAction('LOG_ORDER', {
    orderNumber, createdAt: new Date().toISOString(),
    customerName: input.customerName, pax: input.pax,
    subtotal, totalAmount, deliveryFee, serviceCharge,
    orderType: input.orderType,
    deliveryAddress: input.deliveryAddress ?? null,
    status: 'PENDING', paymentStatus: 'UNPAID',
    notes: input.notes ?? '', isTest: input.isTest ?? false,
    items: input.items.map(i => ({ itemId: i.itemId, qty: i.qty })),
  }).catch(() => {});

  return apiSuccess({ orderId, orderNumber, totalAmount, subtotal, deliveryFee, serviceCharge, status: 'PENDING', paymentStatus: 'UNPAID', trackUrl: `/orders/track?id=${orderId}` }, 201);
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
      .select(`id, order_number, status, payment_status, total_amount, subtotal_override, vat_amount, discount_type, discount_amount, customer_name, customer_phone, created_at, pax, notes, table_id, branch_id, cancel_reason, rating, order_type, promo_code, delivery_address, delivery_fee, delivery_zone, table:restaurant_tables(name), items:order_items(id, item_name, size_label, qty, line_total, addon_total, sugar_level, notes)`)
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
    let orders: FlatOrder[] = ((data ?? []) as unknown as FlatOrder[]).map(o => ({
      ...o, table_name: (o['table'] as { name?: string } | null)?.name ?? null, table: undefined,
    }));
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(o =>
        String(o['order_number']).includes(q) ||
        (typeof o['customer_name'] === 'string' && o['customer_name'].toLowerCase().includes(q)) ||
        (typeof o['customer_phone'] === 'string' && o['customer_phone'].includes(q))
      );
    }
    return apiSuccess(orders);
  }, ['OWNER','ADMIN','MANAGER','CASHIER','KITCHEN']);
}
