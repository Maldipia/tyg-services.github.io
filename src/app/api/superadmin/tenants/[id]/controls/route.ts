export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin, superAdminUnauthorized, logSuperAdminAction } from '@/lib/auth/superadmin';
import { createServiceClient } from '@/lib/supabase/client';
import { apiSuccess, apiError } from '@/lib/auth/middleware';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  if (!await verifySuperAdmin(req)) return superAdminUnauthorized();
  const db = createServiceClient();
  const { id } = params;

  const body = await req.json() as {
    features?: Record<string, boolean>;
    max_products?: number;
    max_staff?: number;
    max_branches?: number;
    pos_locked?: boolean;
    force_action?: 'force_logout' | 'reset_onboarding' | 'lock_pos' | 'unlock_pos';
  };

  // Feature toggles
  if (body.features) {
    for (const [key, enabled] of Object.entries(body.features)) {
      await db.from('tenant_features').upsert({
        tenant_id: id, feature_key: key, enabled,
        source: 'superadmin', updated_at: new Date().toISOString(), updated_by: 'superadmin',
      }, { onConflict: 'tenant_id,feature_key' });
    }
    await logSuperAdminAction('FEATURE_TOGGLE', id, 'features', '', JSON.stringify(body.features), 'Superadmin toggled features');
  }

  // Limits
  const limitUpdates: Record<string, unknown> = {};
  if (body.max_products !== undefined) limitUpdates.max_products = body.max_products;
  if (body.max_staff    !== undefined) limitUpdates.max_staff    = body.max_staff;
  if (body.max_branches !== undefined) limitUpdates.max_branches = body.max_branches;
  if (body.pos_locked   !== undefined) limitUpdates.pos_locked   = body.pos_locked;

  if (Object.keys(limitUpdates).length > 0) {
    await db.from('tenants').update(limitUpdates).eq('id', id);
    await logSuperAdminAction('TENANT_LIMITS', id, 'limits', '', JSON.stringify(limitUpdates), 'Superadmin updated limits');
  }

  // Force actions
  if (body.force_action) {
    if (body.force_action === 'force_logout') {
      await db.from('staff_sessions').update({ is_revoked: true }).eq('tenant_id', id);
      await logSuperAdminAction('FORCE_LOGOUT', id, 'sessions', '', 'revoked', 'Superadmin force-logged out all staff');
    }
    if (body.force_action === 'reset_onboarding') {
      await db.from('tenants').update({ onboarding_completed_at: null, onboarding_step: 0 }).eq('id', id);
      await logSuperAdminAction('RESET_ONBOARDING', id, 'onboarding', 'completed', 'reset', 'Superadmin reset onboarding');
    }
    if (body.force_action === 'lock_pos') {
      await db.from('tenants').update({ pos_locked: true }).eq('id', id);
      await logSuperAdminAction('LOCK_POS', id, 'pos_locked', 'false', 'true', 'Superadmin locked POS');
    }
    if (body.force_action === 'unlock_pos') {
      await db.from('tenants').update({ pos_locked: false }).eq('id', id);
      await logSuperAdminAction('UNLOCK_POS', id, 'pos_locked', 'true', 'false', 'Superadmin unlocked POS');
    }
  }

  return apiSuccess({ updated: true });
}
