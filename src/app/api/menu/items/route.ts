export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';

// DB enum: AVAILABLE | SOLD_OUT | HIDDEN
const CreateItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(500).optional().default(''),
  basePrice: z.number().min(0).max(99999),
  status: z.enum(['AVAILABLE', 'SOLD_OUT', 'HIDDEN']).optional().default('AVAILABLE'),
  isFeatured: z.boolean().optional().default(false),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = CreateItemSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
    const db = createServiceClient();
    const { data: cat } = await db.from('menu_categories')
      .select('id').eq('id', parsed.data.categoryId).eq('tenant_id', ctx.tenantId).single();
    if (!cat) return apiError('Category not found', 404);
    const { data, error } = await db.from('menu_items').insert({
      tenant_id: ctx.tenantId,
      category_id: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description,
      base_price: parsed.data.basePrice,
      status: parsed.data.status,
      is_featured: parsed.data.isFeatured,
      image_url: parsed.data.imageUrl ?? null,
      sort_order: parsed.data.sortOrder,
    }).select('id, name, base_price, status, is_featured, image_url, category_id').single();
    if (error) return apiError(`Failed to create item: ${error.message}`, 500);
    return apiSuccess(data, 201);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}
