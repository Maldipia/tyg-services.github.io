export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { sendOrderReceipt } from '@/lib/resend/email';

const Schema = z.object({
  email: z.string().email(),
});

type Params = { params: { orderId: string } };

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { orderId } = params;
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return apiError('Invalid order ID', 400);

    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Invalid email', 400);

    const db = createServiceClient();

    // Fetch full order with items
    const { data: order, error } = await db.from('orders')
      .select(`id, order_number, customer_name, customer_phone, total_amount, subtotal_override,
               vat_amount, discount_type, discount_amount, or_number, created_at,
               items:order_items(id, item_name, size_label, qty, line_total, addon_total, notes)`)
      .eq('id', orderId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (error || !order) return apiError('Order not found', 404);

    // Fetch tenant info
    const { data: tenant } = await db.from('tenants')
      .select('name, settings')
      .eq('id', ctx.tenantId)
      .single();

    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const receiptFooter = (settings.receiptFooter as string) ?? 'Thank you for dining with us!';

    try {
      await sendOrderReceipt(
        {
          ...order,
          customer_email: parsed.data.email,
          total_amount: Number(order.total_amount),
          subtotal_override: Number(order.subtotal_override ?? order.total_amount),
          vat_amount: Number(order.vat_amount ?? 0),
          discount_amount: Number(order.discount_amount ?? 0),
          discount_type: order.discount_type ?? null,
          or_number: order.or_number ?? null,
          items: (order.items ?? []).map((i: Record<string,unknown>) => ({
            id: i.id as string,
            item_name: i.item_name as string,
            size_label: (i.size_label as string | null) ?? null,
            qty: Number(i.qty),
            line_total: Number(i.line_total),
            addon_total: Number(i.addon_total ?? 0),
            notes: (i.notes as string | null) ?? null,
          })),
        } as never,
        tenant?.name ?? 'Restaurant',
        receiptFooter
      );

      // Save email on order for future reference
      await db.from('orders').update({ customer_email: parsed.data.email }).eq('id', orderId);

      return apiSuccess({ sent: true, to: parsed.data.email });
    } catch (err) {
      console.error('[email-receipt]', err);
      return apiError('Failed to send email. Check RESEND_API_KEY configuration.', 500);
    }
  }, ['OWNER', 'ADMIN', 'CASHIER']);
}
