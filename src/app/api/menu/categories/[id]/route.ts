export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { logEvent } from '@/lib/logger';

const UpdateCatSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  description: z.string().max(300).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) return apiError('Invalid ID', 400);
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = UpdateCatSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
    const db = createServiceClient();
    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updatePayload['name'] = parsed.data.name;
    if (parsed.data.description !== undefined) updatePayload['description'] = parsed.data.description;
    if (parsed.data.sortOrder !== undefined) updatePayload['sort_order'] = parsed.data.sortOrder;
    if (parsed.data.isActive !== undefined) updatePayload['is_active'] = parsed.data.isActive;
    const { data, error } = await db.from('menu_categories')
      .update(updatePayload)
      .eq('id', params.id).eq('tenant_id', ctx.tenantId)
      .select('id, name, description, sort_order, is_active').single();
    if (error) return apiError('Failed to update category', 500);
    void logEvent({ eventType: 'MENU_CATEGORY_UPDATED', entityType: 'MENU_CATEGORY', entityId: params.id, tenantId: ctx.tenantId, userId: ctx.staffId, userName: ctx.displayName ?? undefined, source: 'ADMIN', details: { updatedFields: Object.keys(updatePayload) } });
    return apiSuccess(data);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) return apiError('Invalid ID', 400);
    const db = createServiceClient();
    const { error } = await db.from('menu_categories')
      .update({ is_active: false })
      .eq('id', params.id).eq('tenant_id', ctx.tenantId);
    if (error) return apiError('Failed to delete category', 500);
    return apiSuccess({ deleted: true });
  }, ['OWNER', 'ADMIN']);
}
