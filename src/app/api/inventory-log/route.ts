export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

const AdjustSchema = z.object({
  menuItemId:  z.string().uuid(),
  changeType:  z.enum(['RESTOCK','ADJUSTMENT','WASTE']),
  qtyChange:   z.number().int().min(-9999).max(9999),
  notes:       z.string().max(300).optional(),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
    const db = createServiceClient();

    let query = db
      .from('inventory_log')
      .select(`
        id, change_type, qty_before, qty_change, qty_after, notes, created_at,
        item:menu_items!menu_item_id(name, stock_count),
        staff:staff!staff_id(display_name),
        order:orders!order_id(order_number)
      `)
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (itemId) query = query.eq('menu_item_id', itemId);

    const { data, error } = await query;
    if (error) return apiError('Failed to fetch inventory log', 500);
    return apiSuccess(data ?? []);
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = AdjustSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

    const db = createServiceClient();

    // Get current stock
    const { data: item } = await db.from('menu_items')
      .select('id, name, stock_count')
      .eq('id', parsed.data.menuItemId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (!item) return apiError('Menu item not found', 404);

    const before = item.stock_count ?? 0;
    const after  = Math.max(0, before + parsed.data.qtyChange);

    // Update stock
    await db.from('menu_items').update({ stock_count: after }).eq('id', item.id);

    // Write log entry
    const { data: log, error } = await db.from('inventory_log').insert({
      tenant_id:    ctx.tenantId,
      menu_item_id: parsed.data.menuItemId,
      change_type:  parsed.data.changeType,
      qty_before:   before,
      qty_change:   parsed.data.qtyChange,
      qty_after:    after,
      staff_id:     ctx.staffId,
      notes:        parsed.data.notes ?? null,
    }).select().single();

    if (error) return apiError('Failed to record adjustment', 500);
    return apiSuccess({ log, newStock: after }, 201);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}
