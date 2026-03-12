export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { logEvent } from '@/lib/logger';

const CreateCatSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  description: z.string().max(300).optional().default(''),
  sortOrder: z.number().int().optional().default(0),
});

export function OPTIONS() { return new Response(null,{status:204}); }

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = CreateCatSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
    const db = createServiceClient();
    const { data: branch } = await db.from('branches').select('id').eq('tenant_id', ctx.tenantId).limit(1).single();
    const { data, error } = await db.from('menu_categories').insert({
      tenant_id: ctx.tenantId,
      branch_id: branch?.id ?? null,
      name: parsed.data.name,
      description: parsed.data.description,
      sort_order: parsed.data.sortOrder,
      is_active: true,
    }).select('id, name, description, sort_order, is_active').single();
    if (error) return apiError('Failed to create category', 500);
    void logEvent({ eventType: 'MENU_CATEGORY_CREATED', entityType: 'MENU_CATEGORY', entityId: (data as {id:string}).id, tenantId: ctx.tenantId, userId: ctx.staffId, userName: ctx.displayName ?? undefined, source: 'ADMIN', details: { name: parsed.data.name } });
    return apiSuccess(data, 201);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}
