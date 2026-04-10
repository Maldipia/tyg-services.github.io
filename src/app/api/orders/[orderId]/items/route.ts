export const dynamic = 'force-dynamic';
// PATCH /api/orders/[orderId]/items — add items to an existing PENDING order
// Only allowed within 5 minutes of order creation

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError, getClientIp, withStaffAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/types';
import { createServiceClient } from '@/lib/supabase/client';
import { orderRateLimit } from '@/lib/redis/ratelimit';

const AddItemsSchema = z.object({
  items: z.array(z.object({
    itemId:     z.string().uuid(),
    qty:        z.number().int().min(1).max(20),
    sizeId:     z.string().uuid().nullable().optional(),
    addonIds:   z.array(z.string().uuid()).max(10).default([]),
    notes:      z.string().max(200).optional().default(''),
    sugarLevel: z.enum(['GROUNDED','YANI','COMFORT','FULL_SWEET']).optional(),
  })).min(1).max(10),
});

const WINDOW_MINUTES = 5;

type Params = { params: { orderId: string } };

export function OPTIONS() { return new Response(null, { status: 204 }); }

export function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (request, _ctx: AuthContext) => {
  // Rate-limited — same limiter as order creation (10/10min per IP)
  const ip = getClientIp(req);
  const { success } = await orderRateLimit.limit(ip);
  if (!success) return apiError('Too many requests. Please wait.', 429, 'RATE_LIMIT_EXCEEDED');

  const { orderId } = params;
  if (!orderId || !/^[0-9a-f-]{36}$/.test(orderId)) return apiError('Invalid order ID', 400);

  let body: unknown;
  try { body = await req.json(); } catch { return apiError('Invalid JSON', 400); }
  const parsed = AddItemsSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

  const db = createServiceClient();

  // Fetch the order
  const { data: order } = await db.from('orders')
    .select('id, tenant_id, status, created_at, is_test')
    .eq('id', orderId).single();

  if (!order) return apiError('Order not found', 404);
  if (order.status !== 'PENDING') return apiError('Items can only be added to PENDING orders', 400);

  // 5-minute window check
  const ageMs = Date.now() - new Date(order.created_at).getTime();
  const ageMins = ageMs / 60000;
  if (ageMins > WINDOW_MINUTES) {
    return apiError(
      `Add-to-order window has closed (${WINDOW_MINUTES} minutes after placing). Please place a new order.`,
      403, 'WINDOW_CLOSED'
    );
  }

  // Validate items against live menu
  const itemIds = parsed.data.items.map(i => i.itemId);
  const { data: menuItems } = await db.from('menu_items')
    .select('id, name, base_price, status, stock_count')
    .eq('tenant_id', order.tenant_id)
    .in('id', itemIds);

  const itemMap = new Map((menuItems ?? []).map(m => [m.id, m]));
  const inserts = [];

  for (const cartItem of parsed.data.items) {
    const menu = itemMap.get(cartItem.itemId);
    if (!menu) return apiError(`Item not found: ${cartItem.itemId}`, 404);
    if (menu.status === 'SOLD_OUT') return apiError(`${menu.name} is sold out`, 400);
    if (menu.status === 'HIDDEN') return apiError(`Item not available`, 400);

    // Size price
    let unitPrice = Number(menu.base_price);
    if (cartItem.sizeId) {
      const { data: sz } = await db.from('menu_item_sizes')
        .select('price').eq('id', cartItem.sizeId).single();
      if (sz) unitPrice = Number(sz.price);
    }

    inserts.push({
      order_id:    orderId,
      tenant_id:   order.tenant_id,
      item_id:     menu.id,
      item_name:   menu.name,
      qty:         cartItem.qty,
      unit_price:  unitPrice,
      line_total:  Math.round(unitPrice * cartItem.qty * 100) / 100,
      addon_total: 0,
      notes:       cartItem.notes || null,
      sugar_level: cartItem.sugarLevel ?? null,
    });
  }

  const { error } = await db.from('order_items').insert(inserts);
  if (error) return apiError('Failed to add items', 500);

  // recompute_order_totals() is the single source of truth for final totals:
  // simplified trigger set subtotal_override; this fn applies VAT + discounts.
  const { data: recomputed } = await db.rpc('recompute_order_totals', { p_order_id: orderId });
  void recomputed; // result read back from orders below

  const { data: updated } = await db.from('orders')
    .select('id, order_number, total_amount, status')
    .eq('id', orderId).single();

    return apiSuccess({ added: inserts.length, order: updated, minutesLeft: Math.max(0, WINDOW_MINUTES - ageMins) });
  }, ['OWNER','ADMIN','MANAGER','CASHIER','KITCHEN']);
}

// ── PUT /api/orders/[orderId]/items — toggle item prepared status (kitchen)
export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (request, _ctx) => {
    const { orderId } = params;
    if (!orderId || !/^[0-9a-f-]{36}$/.test(orderId)) return apiError('Invalid order ID', 400);

    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }

    const b = body as { itemId?: string; prepared?: boolean };
    if (!b.itemId || typeof b.prepared !== 'boolean')
      return apiError('itemId and prepared (boolean) required', 400);

    const db = createServiceClient();
    const { error } = await db
      .from('order_items')
      .update({ prepared: b.prepared })
      .eq('id', b.itemId)
      .eq('order_id', orderId);

    if (error) return apiError('Failed to update item', 500);

    // Auto-advance: if marking prepared, check if ALL items are now prepared
    if (b.prepared) {
      const { data: order } = await db
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (order && ['CONFIRMED', 'PREPARING'].includes(order.status)) {
        // Check remaining unprepared items
        const { count } = await db
          .from('order_items')
          .select('*', { count: 'exact', head: true })
          .eq('order_id', orderId)
          .eq('prepared', false);

        if (count === 0) {
          // All items prepped — advance to READY
          await db.from('orders')
            .update({ status: 'READY' })
            .eq('id', orderId);
        }
      }
    }

    return apiSuccess({ updated: true, prepared: b.prepared });
  }, ['OWNER','ADMIN','MANAGER','CASHIER','KITCHEN']);
}
