export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — GET /api/orders/[orderId]
// Public — order status by ID. Used by /orders/track page.
// Raw PostgREST fetch (same fix as /api/menu) — avoids Supabase
// JS client !inner join unreliability on Vercel serverless.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

type Params = { params: { orderId: string } };

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function pgHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function pgOne<T>(path: string): Promise<T | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: pgHeaders(), cache: 'no-store',
  });
  if (!res.ok) return null;
  const d = await res.json() as T[];
  return Array.isArray(d) && d.length > 0 ? (d[0] ?? null) : null;
}

async function pgMany<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: pgHeaders(), cache: 'no-store',
  });
  if (!res.ok) return [];
  const d = await res.json() as T[];
  return Array.isArray(d) ? d : [];
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { orderId } = params;

  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ data: null, error: 'Invalid order ID' }, { status: 400 });
  }

  const tenantSlug = req.nextUrl.searchParams.get('tenant');

  // 1. Fetch order row
  const order = await pgOne<{
    id: string; order_number: string; customer_name: string;
    status: string; payment_status: string; total_amount: number;
    subtotal_override: number | null; vat_amount: number; pax: number;
    discount_amount: number; discount_type: string | null;
    notes: string | null; created_at: string; updated_at: string; tenant_id: string;
    rating: number | null; feedback_text: string | null; feedback_at: string | null;
    order_type: string | null; promo_code: string | null; cancel_reason: string | null;
  }>(`orders?id=eq.${orderId}&select=id,order_number,customer_name,status,payment_status,total_amount,subtotal_override,vat_amount,pax,notes,created_at,updated_at,tenant_id,discount_amount,discount_type,rating,feedback_text,feedback_at,order_type,promo_code,cancel_reason`);

  if (!order) {
    return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
  }

  // 2. Fetch tenant
  const tenant = await pgOne<{ id: string; slug: string; name: string; primary_color: string }>(
    `tenants?id=eq.${order.tenant_id}&select=id,slug,name,primary_color`
  );

  // 3. Optional: validate tenant slug matches
  if (tenantSlug && tenant?.slug !== tenantSlug) {
    return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
  }

  // 4. Fetch order items
  const items = await pgMany<{
    id: string; item_name: string; qty: number; unit_price: number;
    line_total: number; size_label: string | null; addon_total: number | null;
    notes: string | null; sugar_level: string | null;
  }>(`order_items?order_id=eq.${orderId}&select=id,item_name,qty,unit_price,line_total,size_label,addon_total,notes,sugar_level`);

  return NextResponse.json({
    data: {
      id: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      // customerPhone / customerEmail intentionally excluded (public endpoint)
      status: order.status,
      paymentStatus: order.payment_status,
      totalAmount: order.total_amount,
      subtotal: order.subtotal_override,
      vatAmount: order.vat_amount,
      discountAmount: order.discount_amount ?? 0,
      discountType: order.discount_type ?? null,
      pax: order.pax,
      notes: order.notes,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      rating: order.rating ?? null,
      feedbackText: order.feedback_text ?? null,
      orderType: order.order_type ?? null,
      promoCode: order.promo_code ?? null,
      cancelReason: order.cancel_reason ?? null,
      items,
      tenant: {
        slug: tenant?.slug ?? '',
        name: tenant?.name ?? '',
        primaryColor: tenant?.primary_color ?? '#22c55e',
      },
    },
    error: null,
  });
}
