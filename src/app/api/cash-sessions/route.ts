export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { logEvent } from '@/lib/logger';

const OpenSchema = z.object({
  openingFloat: z.number().min(0).max(999999),
  notes: z.string().max(500).optional(),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? 'OPEN';
    const db = createServiceClient();

    const { data, error } = await db
      .from('cash_sessions')
      .select(`
        id, status, opening_float, closing_count, cash_sales,
        expected_cash, variance, notes, opened_at, closed_at, denominations,
        opened_by_staff:staff!opened_by(display_name),
        closed_by_staff:staff!closed_by(display_name)
      `)
      .eq('tenant_id', ctx.tenantId)
      .eq('status', status)
      .order('opened_at', { ascending: false })
      .limit(20);

    if (error) return apiError('Failed to fetch sessions', 500);
    return apiSuccess(data ?? []);
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const db = createServiceClient();

    // Check no session already open for this tenant/branch
    const { data: existing } = await db
      .from('cash_sessions')
      .select('id, opened_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('status', 'OPEN')
      .maybeSingle();

    if (existing) {
      return apiError('A cash session is already open. Close it before opening a new one.', 409, 'SESSION_ALREADY_OPEN');
    }

    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = OpenSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

    const { data, error } = await db
      .from('cash_sessions')
      .insert({
        tenant_id:      ctx.tenantId,
        branch_id:      ctx.branchId,
        opened_by:      ctx.staffId,
        opening_float:  parsed.data.openingFloat,
        notes:          parsed.data.notes ?? null,
        status:         'OPEN',
        opened_at:      new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) return apiError('Failed to open session', 500);

    void logEvent({ eventType: 'CASH_SESSION_OPENED', entityType: 'CASH_SESSION', entityId: data.id, tenantId: ctx.tenantId, source: 'ADMIN', details: { openingFloat: parsed.data.openingFloat } });
    return apiSuccess(data, 201);
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}
