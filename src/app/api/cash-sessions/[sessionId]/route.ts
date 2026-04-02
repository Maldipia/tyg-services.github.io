export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { logEvent } from '@/lib/logger';

const CloseSchema = z.object({
  closingCount:  z.number().min(0).max(9999999),
  denominations: z.record(z.string(), z.number().int().min(0)).optional(),
  notes:         z.string().max(500).optional(),
});

type Params = { params: { sessionId: string } };

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { sessionId } = params;
    const db = createServiceClient();

    const { data: session } = await db
      .from('cash_sessions')
      .select('id, tenant_id, status, opening_float')
      .eq('id', sessionId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (!session) return apiError('Session not found', 404);
    if (session.status === 'CLOSED') return apiError('Session already closed', 409);

    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = CloseSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

    // Calculate cash sales for this session from VERIFIED/CASH orders
    const { data: cashOrders } = await db
      .from('payments')
      .select('amount')
      .eq('tenant_id', ctx.tenantId)
      .eq('method', 'CASH')
      .eq('status', 'VERIFIED')
      .gte('created_at', (await db.from('cash_sessions').select('opened_at').eq('id', sessionId).single()).data?.opened_at ?? '');

    const cashSales = (cashOrders ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const expectedCash = Number(session.opening_float) + cashSales;
    const variance = parsed.data.closingCount - expectedCash;

    const { data, error } = await db
      .from('cash_sessions')
      .update({
        status:         'CLOSED',
        closed_by:      ctx.staffId,
        closed_at:      new Date().toISOString(),
        closing_count:  parsed.data.closingCount,
        denominations:  parsed.data.denominations ?? null,
        cash_sales:     cashSales,
        expected_cash:  expectedCash,
        variance,
        notes:          parsed.data.notes ?? null,
      })
      .eq('id', sessionId)
      .eq('tenant_id', ctx.tenantId)
      .select()
      .single();

    if (error || !data) return apiError('Failed to close session', 500);

    void logEvent({ eventType: 'CASH_SESSION_CLOSED', entityType: 'CASH_SESSION', entityId: sessionId, tenantId: ctx.tenantId, source: 'ADMIN', details: { closingCount: parsed.data.closingCount, cashSales, variance } });
    return apiSuccess(data);
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}
