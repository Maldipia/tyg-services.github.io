export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError, resolveTenant } from '@/lib/auth/middleware';

const CreateTableSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  capacity: z.number().int().min(1).max(50).optional().default(4),
  description: z.string().max(200).optional(),
});

export function OPTIONS() { return new Response(null,{status:204}); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('tenant');
  if (!slug) return apiError('tenant param required', 400);
  const db = createServiceClient();
  const tenant = await resolveTenant(slug);
  if (!tenant) return apiError('Tenant not found', 404);
  const { data, error } = await db
    .from('restaurant_tables')
    .select('id, name, capacity, description, is_active, qr_token, created_at')
    .eq('tenant_id', tenant.tenantId)
    .order('name');
  if (error) return apiError('Failed to fetch tables', 500);
  return apiSuccess(data ?? []);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (request, ctx) => {
    let body: unknown;
    try { body = await request.json(); } catch { return apiError('Invalid JSON', 400); }
    const parsed = CreateTableSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
    const db = createServiceClient();
    const { data: branch } = await db.from('branches').select('id').eq('tenant_id', ctx.tenantId).limit(1).single();
    const qrToken = `${ctx.tenantId.slice(0,8)}-${Date.now().toString(36)}`;
    const { data, error } = await db.from('restaurant_tables').insert({
      tenant_id: ctx.tenantId,
      branch_id: branch?.id ?? null,
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      description: parsed.data.description ?? null,
      is_active: true,
      qr_token: qrToken,
    }).select('id, name, capacity, description, is_active, qr_token').single();
    if (error) return apiError('Failed to create table', 500);
    return apiSuccess(data, 201);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}
