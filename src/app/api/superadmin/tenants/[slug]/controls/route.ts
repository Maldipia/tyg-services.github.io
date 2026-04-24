export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, superAdminUnauthorized, logSuperAdminAction } from '@/lib/auth/superadmin';
import { createServiceClient } from '@/lib/supabase/client';
import { apiSuccess, apiError } from '@/lib/auth/middleware';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();
  const db = createServiceClient();

  const { data: tenant } = await db.from('tenants').select('id,plan_status').eq('slug', params.slug).single();
  if (!tenant) return apiError('Tenant not found', 404);
  const id = tenant.id as string;

  const body = await req.json() as {
    features?: Record<string, boolean>;
    max_products?: number; max_staff?: number; max_branches?: number;
    pos_locked?: boolean; plan_status?: string;
    force_action?: 'force_logout'|'reset_onboarding'|'lock_pos'|'unlock_pos'|'suspend'|'activate'|'extend_trial';
    trial_days?: number; note?: string;
  };

  if (body.features) {
    for (const [key, enabled] of Object.entries(body.features)) {
      await db.from('tenant_features').upsert({
        tenant_id: id, feature_key: key, enabled,
        source: 'superadmin', updated_at: new Date().toISOString(), updated_by: 'superadmin',
      }, { onConflict: 'tenant_id,feature_key' });
    }
    await logSuperAdminAction('FEATURE_TOGGLE', id, 'features', '', JSON.stringify(body.features), body.note ?? 'Superadmin toggled features');
  }

  const lu: Record<string,unknown> = {};
  if (body.max_products !== undefined) lu.max_products = body.max_products;
  if (body.max_staff    !== undefined) lu.max_staff    = body.max_staff;
  if (body.max_branches !== undefined) lu.max_branches = body.max_branches;
  if (body.pos_locked   !== undefined) lu.pos_locked   = body.pos_locked;
  if (body.plan_status  !== undefined) lu.plan_status  = body.plan_status;
  if (Object.keys(lu).length > 0) {
    await db.from('tenants').update(lu).eq('id', id);
    await logSuperAdminAction('TENANT_UPDATE', id, 'limits', '', JSON.stringify(lu), body.note ?? 'Updated');
  }

  if (body.force_action) {
    const oldStatus = tenant.plan_status as string;
    switch (body.force_action) {
      case 'force_logout':
        await db.from('staff_sessions').update({ is_revoked: true }).eq('tenant_id', id);
        await logSuperAdminAction('FORCE_LOGOUT', id, 'sessions', '', 'revoked', 'Force logout all staff');
        break;
      case 'reset_onboarding':
        await db.from('tenants').update({ onboarding_completed_at: null, onboarding_step: 0 }).eq('id', id);
        await logSuperAdminAction('RESET_ONBOARDING', id, 'onboarding', 'done', 'reset', 'Reset onboarding');
        break;
      case 'lock_pos':
        await db.from('tenants').update({ pos_locked: true }).eq('id', id);
        await logSuperAdminAction('LOCK_POS', id, 'pos_locked', 'false', 'true', 'Locked POS');
        break;
      case 'unlock_pos':
        await db.from('tenants').update({ pos_locked: false }).eq('id', id);
        await logSuperAdminAction('UNLOCK_POS', id, 'pos_locked', 'true', 'false', 'Unlocked POS');
        break;
      case 'suspend':
        await db.from('tenants').update({ plan_status: 'SUSPENDED' }).eq('id', id);
        await logSuperAdminAction('SUSPEND', id, 'plan_status', oldStatus, 'SUSPENDED', body.note ?? 'Suspended');
        break;
      case 'activate':
        await db.from('tenants').update({ plan_status: 'ACTIVE' }).eq('id', id);
        await logSuperAdminAction('ACTIVATE', id, 'plan_status', oldStatus, 'ACTIVE', body.note ?? 'Activated');
        break;
      case 'extend_trial':
        const d = body.trial_days ?? 14;
        const end = new Date(Date.now() + d * 86400000).toISOString();
        await db.from('tenants').update({ trial_ends_at: end, plan_status: 'TRIAL' }).eq('id', id);
        await logSuperAdminAction('EXTEND_TRIAL', id, 'trial_ends_at', '', end, `Extended trial by ${d} days`);
        break;
    }
  }

  return apiSuccess({ updated: true });
}
