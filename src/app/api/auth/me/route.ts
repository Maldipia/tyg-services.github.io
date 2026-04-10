export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    const db = createServiceClient();
    const { data: tenant } = await db.from('tenants')
      .select('id, name, slug, plan_tier, plan_status, trial_ends_at, settings')
      .eq('id', ctx.tenantId)
      .single();

    if (!tenant) return apiError('Tenant not found', 404);

    const trialDaysLeft = tenant.plan_status === 'TRIAL' && tenant.trial_ends_at
      ? Math.max(0, Math.floor((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000))
      : null;

    return apiSuccess({
      staffId:      ctx.staffId,
      role:         ctx.role,
      displayName:  ctx.displayName,
      tenantId:     ctx.tenantId,
      tenantName:   tenant.name,
      tenantSlug:   tenant.slug,
      planTier:     tenant.plan_tier,
      planStatus:   tenant.plan_status,
      trialEndsAt:  tenant.trial_ends_at,
      trialDaysLeft,
    });
  });
}
