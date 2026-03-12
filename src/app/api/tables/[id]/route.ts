export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { logEvent } from '@/lib/logger';

const UpdateTableSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) return apiError('Invalid ID', 400);
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = UpdateTableSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
    const db = createServiceClient();
    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updatePayload['name'] = parsed.data.name;
    if (parsed.data.capacity !== undefined) updatePayload['capacity'] = parsed.data.capacity;
    if (parsed.data.isActive !== undefined) updatePayload['is_active'] = parsed.data.isActive;
    const { data, error } = await db.from('restaurant_tables')
      .update(updatePayload)
      .eq('id', params.id).eq('tenant_id', ctx.tenantId)
      .select('id, name, capacity, is_active, qr_token').single();
    if (error) return apiError(`Failed to update table: ${error.message}`, 500);
    void logEvent({ eventType: 'TABLE_UPDATED', entityType: 'TABLE', entityId: params.id, tenantId: ctx.tenantId, userId: ctx.staffId, userName: ctx.displayName ?? undefined, source: 'ADMIN', details: { updatedFields: Object.keys(updatePayload) } });
    return apiSuccess(data);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) return apiError('Invalid ID', 400);
    const db = createServiceClient();
    const { error } = await db.from('restaurant_tables')
      .update({ is_active: false })
      .eq('id', params.id).eq('tenant_id', ctx.tenantId);
    if (error) return apiError('Failed to delete table', 500);
    void logEvent({ eventType: 'TABLE_DELETED', entityType: 'TABLE', entityId: params.id, tenantId: ctx.tenantId, userId: ctx.staffId, userName: ctx.displayName ?? undefined, source: 'ADMIN', details: {} });
    return apiSuccess({ deleted: true });
  }, ['OWNER', 'ADMIN']);
}
