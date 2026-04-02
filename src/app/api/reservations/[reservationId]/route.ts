export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

const UpdateSchema = z.object({
  status:       z.enum(['CONFIRMED','SEATED','COMPLETED','CANCELLED','NO_SHOW']).optional(),
  tableId:      z.string().uuid().nullable().optional(),
  cancelReason: z.string().max(300).optional(),
  notes:        z.string().max(500).optional(),
  pax:          z.number().int().min(1).max(50).optional(),
  reservedAt:   z.string().datetime({ offset: true }).optional(),
});

type Params = { params: { reservationId: string } };

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    const db = createServiceClient();

    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

    const updates: Record<string, unknown> = {};
    if (parsed.data.status)    updates['status']     = parsed.data.status;
    if (parsed.data.tableId !== undefined) updates['table_id'] = parsed.data.tableId;
    if (parsed.data.notes)     updates['notes']      = parsed.data.notes;
    if (parsed.data.pax)       updates['pax']        = parsed.data.pax;
    if (parsed.data.reservedAt) updates['reserved_at'] = parsed.data.reservedAt;
    if (parsed.data.status === 'CANCELLED') {
      updates['cancelled_at'] = new Date().toISOString();
      updates['cancel_reason'] = parsed.data.cancelReason ?? null;
    }

    const { data, error } = await db
      .from('reservations')
      .update(updates)
      .eq('id', params.reservationId)
      .eq('tenant_id', ctx.tenantId)
      .select()
      .single();

    if (error || !data) return apiError('Reservation not found or update failed', 404);
    return apiSuccess(data);
  }, ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER']);
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    const db = createServiceClient();
    const { error } = await db
      .from('reservations')
      .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
      .eq('id', params.reservationId)
      .eq('tenant_id', ctx.tenantId);

    if (error) return apiError('Failed to cancel reservation', 500);
    return apiSuccess({ cancelled: true });
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}
