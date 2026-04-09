export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { withStaffAuth, apiSuccess, apiError, resolveTenant } from '@/lib/auth/middleware';
import { logEvent } from '@/lib/logger';

const CreateTableSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  capacity: z.number().int().min(1).max(50).optional().default(4),
});

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('tenant');

  // Staff-auth path: no tenant slug needed — uses session context
  const sessionCookie = req.cookies.get('tyg-staff-session')?.value;
  if (!slug && sessionCookie) {
    return withStaffAuth(req, async (_req, ctx) => {
      const db = createServiceClient();
      const { data, error } = await db
        .from('restaurant_tables')
        .select('id, name, capacity, is_active, qr_token, branch_id')
        .eq('tenant_id', ctx.tenantId)
        .eq('is_active', true)
        .order('name');
      if (error) return apiError('Failed to fetch tables', 500);
      return apiSuccess(data ?? []);
    }, ['OWNER','ADMIN','MANAGER','CASHIER','KITCHEN']);
  }

  if (!slug) return apiError('tenant param required', 400);

  // ?token=QR_TOKEN — public single-table resolve for order page
  const tokenParam = searchParams.get('token');
  if (tokenParam) {
    const db = createServiceClient();
    const tenant = await resolveTenant(slug);
    if (!tenant) return apiError('Tenant not found', 404);
    const { data } = await db
      .from('restaurant_tables')
      .select('id, name, branch_id')
      .eq('tenant_id', tenant.tenantId)
      .eq('qr_token', tokenParam)
      .eq('is_active', true)
      .single();
    if (!data) return apiError('Table not found', 404);
    return apiSuccess(data); // Only id+name — no qr_token in response
  }

  const db = createServiceClient();
  const tenant = await resolveTenant(slug);
  if (!tenant) return apiError('Tenant not found', 404);

  // Check for staff session — staff get qr_tokens, public callers do not
  const { validateStaffSession } = await import('@/lib/auth/staff-auth');
  const sessionToken = req.cookies.get('tyg-staff-session')?.value;
  const session = sessionToken ? await validateStaffSession(sessionToken) : null;
  const isStaff = session !== null && session.tenantId === tenant.tenantId;

  const selectFields = isStaff
    ? 'id, name, capacity, is_active, qr_token, branch_id'
    : 'id, name, capacity, is_active, branch_id'; // qr_token withheld from public

  const { data, error } = await db
    .from('restaurant_tables')
    .select(selectFields)
    .eq('tenant_id', tenant.tenantId)
    .eq('is_active', true)
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
    // branch_id is required — get the tenant's primary branch
    const { data: branch } = await db
      .from('branches')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (!branch) return apiError('No active branch found for this tenant', 400);
    const { data, error } = await db.from('restaurant_tables').insert({
      tenant_id: ctx.tenantId,
      branch_id: branch.id,
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      is_active: true,
    }).select('id, name, capacity, is_active, qr_token').single();
    if (error) return apiError(`Failed to create table: ${error.message}`, 500);
    void logEvent({ eventType: 'TABLE_CREATED', entityType: 'TABLE', entityId: (data as {id:string}).id, tenantId: ctx.tenantId, userId: ctx.staffId, userName: ctx.displayName ?? undefined, source: 'ADMIN', details: { name: parsed.data.name, capacity: parsed.data.capacity } });
    return apiSuccess(data, 201);
  }, ['OWNER', 'ADMIN', 'MANAGER']);
}
