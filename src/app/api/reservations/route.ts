export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { logEvent } from '@/lib/logger';

const CreateReservationSchema = z.object({
  customerName:  z.string().min(1).max(120).trim(),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().optional(),
  pax:           z.number().int().min(1).max(50),
  reservedAt:    z.string().datetime({ offset: true }),
  tableId:       z.string().uuid().optional(),
  durationMins:  z.number().int().min(15).max(480).default(90),
  occasion:      z.string().max(100).optional(),
  notes:         z.string().max(500).optional(),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const date   = searchParams.get('date');   // YYYY-MM-DD
    const status = searchParams.get('status') ?? 'CONFIRMED';
    const db = createServiceClient();

    let query = db
      .from('reservations')
      .select(`id, reservation_ref, customer_name, customer_phone, customer_email,
        pax, reserved_at, duration_mins, status, occasion, notes, created_at,
        table:restaurant_tables!table_id(name)`)
      .eq('tenant_id', ctx.tenantId)
      .order('reserved_at', { ascending: true })
      .limit(200);

    if (status !== 'ALL') query = query.eq('status', status);

    if (date) {
      // filter to PH date
      const from = new Date(`${date}T00:00:00+08:00`).toISOString();
      const to   = new Date(`${date}T23:59:59+08:00`).toISOString();
      query = query.gte('reserved_at', from).lte('reserved_at', to);
    } else {
      // default: upcoming only
      query = query.gte('reserved_at', new Date().toISOString());
    }

    const { data, error } = await query;
    if (error) return apiError('Failed to fetch reservations', 500);
    return apiSuccess(data ?? []);
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

    const db = createServiceClient();

    // Generate ref
    const { data: ref } = await db.rpc('next_reservation_ref', { p_tenant_id: ctx.tenantId });

    const { data, error } = await db
      .from('reservations')
      .insert({
        tenant_id:       ctx.tenantId,
        branch_id:       ctx.branchId,
        reservation_ref: ref as string,
        customer_name:   parsed.data.customerName,
        customer_phone:  parsed.data.customerPhone ?? null,
        customer_email:  parsed.data.customerEmail ?? null,
        pax:             parsed.data.pax,
        reserved_at:     parsed.data.reservedAt,
        table_id:        parsed.data.tableId ?? null,
        duration_mins:   parsed.data.durationMins,
        occasion:        parsed.data.occasion ?? null,
        notes:           parsed.data.notes ?? null,
        status:          'CONFIRMED',
        created_by:      ctx.staffId,
      })
      .select()
      .single();

    if (error || !data) return apiError('Failed to create reservation', 500);

    void logEvent({ eventType: 'RESERVATION_CREATED', entityType: 'ORDER', entityId: data.id, tenantId: ctx.tenantId, source: 'ADMIN', details: { ref, customerName: parsed.data.customerName, pax: parsed.data.pax, reservedAt: parsed.data.reservedAt } });
    return apiSuccess(data, 201);
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}
