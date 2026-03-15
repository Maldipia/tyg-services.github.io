export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { logEvent } from '@/lib/logger';

const UpdateItemSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  description: z.string().max(500).optional(),
  basePrice: z.number().min(0).max(99999).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['AVAILABLE', 'SOLD_OUT', 'HIDDEN']).optional(),
  isFeatured: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().optional(),
  stockCount: z.number().int().min(0).nullable().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
});

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) return apiError('Invalid ID', 400);
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = UpdateItemSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
    const db = createServiceClient();
    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updatePayload['name'] = parsed.data.name;
    if (parsed.data.description !== undefined) updatePayload['description'] = parsed.data.description;
    if (parsed.data.basePrice !== undefined) updatePayload['base_price'] = parsed.data.basePrice;
    if (parsed.data.categoryId !== undefined) updatePayload['category_id'] = parsed.data.categoryId;
    if (parsed.data.status !== undefined) updatePayload['status'] = parsed.data.status;
    if (parsed.data.isFeatured !== undefined) updatePayload['is_featured'] = parsed.data.isFeatured;
    if (parsed.data.imageUrl !== undefined) updatePayload['image_url'] = parsed.data.imageUrl;
    if (parsed.data.sortOrder !== undefined) updatePayload['sort_order'] = parsed.data.sortOrder;
    if (parsed.data.stockCount !== undefined) updatePayload['stock_count'] = parsed.data.stockCount;
    if (parsed.data.lowStockThreshold !== undefined) updatePayload['low_stock_threshold'] = parsed.data.lowStockThreshold;
    const { data, error } = await db.from('menu_items')
      .update(updatePayload)
      .eq('id', params.id).eq('tenant_id', ctx.tenantId)
      .select('id, name, base_price, status, is_featured, image_url, category_id').single();
    if (error) return apiError(`Failed to update item: ${error.message}`, 500);
    void logEvent({ eventType: 'MENU_ITEM_UPDATED', entityType: 'MENU_ITEM', entityId: params.id, tenantId: ctx.tenantId, userId: ctx.staffId, userName: ctx.displayName ?? undefined, source: 'ADMIN', details: { updatedFields: Object.keys(updatePayload) } });
    return apiSuccess(data);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    if (!params.id || !/^[0-9a-f-]{36}$/i.test(params.id)) return apiError('Invalid ID', 400);
    const db = createServiceClient();
    // Soft delete — set status to HIDDEN
    const { error } = await db.from('menu_items')
      .update({ status: 'HIDDEN' })
      .eq('id', params.id).eq('tenant_id', ctx.tenantId);
    if (error) return apiError('Failed to delete item', 500);
    void logEvent({ eventType: 'MENU_ITEM_DELETED', entityType: 'MENU_ITEM', entityId: params.id, tenantId: ctx.tenantId, userId: ctx.staffId, userName: ctx.displayName ?? undefined, source: 'ADMIN', details: { softDelete: true } });
    return apiSuccess({ deleted: true });
  }, ['OWNER', 'ADMIN']);
}
