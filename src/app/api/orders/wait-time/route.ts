export const dynamic = 'force-dynamic';
// GET /api/orders/wait-time?tenantSlug=yani
// Public — returns estimated wait based on active queue depth + avg prep from settings

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenant, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get('tenantSlug') ?? searchParams.get('tenant');
  if (!tenantSlug) return apiError('tenantSlug required', 400);

  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return apiError('Tenant not found', 404);

  const db = createServiceClient();

  // Count active orders ahead in queue
  const { count: queueDepth } = await db.from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.tenantId)
    .in('status', ['PENDING', 'CONFIRMED', 'PREPARING'])
    .eq('is_test', false);

  // Get avg prep time from settings (default 8 min per order)
  const { data: tenantData } = await db.from('tenants')
    .select('settings').eq('id', tenant.tenantId).single();
  const settings = tenantData?.settings as { avgPrepMins?: number } | null;
  const avgPrepMins = settings?.avgPrepMins ?? 8;

  const depth = queueDepth ?? 0;

  // Estimate: first order ≈ avgPrepMins, each additional +3min (parallel prep)
  const estimatedMins = depth === 0 ? 5
    : depth === 1 ? avgPrepMins
    : avgPrepMins + (depth - 1) * 3;

  const label = estimatedMins <= 5 ? 'Ready very soon'
    : estimatedMins <= 10 ? `About ${estimatedMins} minutes`
    : estimatedMins <= 20 ? `${Math.round(estimatedMins / 5) * 5}–${Math.round(estimatedMins / 5) * 5 + 5} minutes`
    : 'More than 20 minutes';

  return apiSuccess({ queueDepth: depth, estimatedMins, label, avgPrepMins });
}
