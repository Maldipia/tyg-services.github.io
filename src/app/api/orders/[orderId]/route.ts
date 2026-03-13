export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — GET /api/orders/[orderId]
// Public endpoint — returns order status by ID + tenant slug
// Used by: /orders/track page, customer receipt links
// No auth required — order ID is unguessable UUID
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

type Params = { params: { orderId: string } };

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { orderId } = params;

  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ data: null, error: 'Invalid order ID' }, { status: 400 });
  }

  const tenantSlug = req.nextUrl.searchParams.get('tenant');
  const db = createServiceClient();

  // Build query
  let query = db
    .from('orders')
    .select(`
      id,
      order_number,
      customer_name,
      customer_phone,
      customer_email,
      status,
      payment_status,
      total_amount,
      subtotal_override,
      vat_amount,
      discount_amount,
      pax,
      notes,
      created_at,
      updated_at,
      tenant_id,
      order_items (
        id,
        item_name,
        qty,
        unit_price,
        line_total,
        size_label,
        addon_total,
        notes
      ),
      tenants!inner (
        slug,
        name,
        primary_color
      )
    `)
    .eq('id', orderId);

  // If tenant slug provided, filter to that tenant for extra safety
  if (tenantSlug) {
    query = query.eq('tenants.slug', tenantSlug);
  }

  const { data: order, error } = await query.maybeSingle();

  if (error) {
    console.error('GET /api/orders/[orderId] error:', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch order' }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
  }

  // Strip sensitive fields before returning to public
  const safeOrder = {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    status: order.status,
    paymentStatus: order.payment_status,
    totalAmount: order.total_amount,
    subtotal: order.subtotal_override,
    vatAmount: order.vat_amount,
    discountAmount: order.discount_amount,
    pax: order.pax,
    notes: order.notes,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: order.order_items ?? [],
    tenant: (() => {
      const t = Array.isArray(order.tenants) ? order.tenants[0] : order.tenants;
      const tenant = t as { slug: string; name: string; primary_color: string } | null;
      return {
        slug: tenant?.slug ?? '',
        name: tenant?.name ?? '',
        primaryColor: tenant?.primary_color ?? '#22c55e',
      };
    })(),
  };

  return NextResponse.json({ data: safeOrder, error: null });
}
