export const dynamic = 'force-dynamic';

// GET /api/menu/stock — returns low-stock and out-of-stock items for admin dashboard
import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    const db = createServiceClient();

    const { data, error } = await db
      .from('menu_items')
      .select('id, name, status, stock_count, low_stock_threshold')
      .eq('tenant_id', ctx.tenantId)
      .not('stock_count', 'is', null)
      .order('stock_count', { ascending: true })
      .limit(50);

    if (error) return apiError('Failed to fetch stock data', 500);

    type StockItem = { id: string; name: string; status: string; stock_count: number; low_stock_threshold: number };
    const items = (data ?? []) as StockItem[];

    const outOfStock = items.filter(i => i.stock_count === 0);
    const lowStock   = items.filter(i => i.stock_count > 0 && i.stock_count <= (i.low_stock_threshold ?? 5));
    const inStock    = items.filter(i => i.stock_count > (i.low_stock_threshold ?? 5));

    return apiSuccess({ outOfStock, lowStock, inStock, total: items.length });
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}
