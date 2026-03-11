// ============================================================
// TYG POS — /api/staff/[staffId]
// PATCH: update staff (reset PIN, change role, toggle active)
// DELETE: deactivate (soft delete)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { hashPin, revokeAllStaffSessions } from '@/lib/auth/staff-auth';

const UpdateStaffSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  displayName: z.string().min(1).max(50).trim().optional(),
  newPin: z.string().regex(/^\d{4,8}$/).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN']).optional(),
  branchId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: { staffId: string } };

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(
    req,
    async (request, ctx) => {
      const { staffId } = params;

      let body: unknown;
      try { body = await request.json(); }
      catch { return apiError('Invalid JSON', 400); }

      const parsed = UpdateStaffSchema.safeParse(body);
      if (!parsed.success) {
        return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
      }

      const db = createServiceClient();

      // Verify target staff belongs to this tenant
      const { data: target } = await db
        .from('staff')
        .select('id, tenant_id, role')
        .eq('id', staffId)
        .eq('tenant_id', ctx.tenantId)
        .single();

      if (!target) return apiError('Staff member not found', 404);
      if (target.role === 'OWNER') {
        return apiError('Cannot modify OWNER account via this endpoint', 403);
      }

      const updates: Record<string, unknown> = {};

      if (parsed.data.name) updates['name'] = parsed.data.name;
      if (parsed.data.displayName) updates['display_name'] = parsed.data.displayName;
      if (parsed.data.role) updates['role'] = parsed.data.role;
      if (parsed.data.branchId !== undefined) updates['branch_id'] = parsed.data.branchId;
      if (parsed.data.isActive !== undefined) updates['is_active'] = parsed.data.isActive;

      if (parsed.data.newPin) {
        updates['pin_hash'] = await hashPin(parsed.data.newPin);
        // Revoke all sessions after PIN change (force re-login)
        await revokeAllStaffSessions(staffId);
      }

      if (parsed.data.isActive === false || parsed.data.role) {
        // Role changes and deactivation take effect on next login
        await revokeAllStaffSessions(staffId);
      }

      const { data, error } = await db
        .from('staff')
        .update(updates)
        .eq('id', staffId)
        .eq('tenant_id', ctx.tenantId)
        .select('id, name, display_name, role, branch_id, is_active')
        .single();

      if (error) return apiError('Failed to update staff', 500);
      return apiSuccess(data);
    },
    ['OWNER', 'ADMIN']
  );
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  return withStaffAuth(
    req,
    async (_, ctx) => {
      const { staffId } = params;
      const db = createServiceClient();

      const { data: target } = await db
        .from('staff')
        .select('id, role, tenant_id')
        .eq('id', staffId)
        .eq('tenant_id', ctx.tenantId)
        .single();

      if (!target) return apiError('Staff member not found', 404);
      if (target.role === 'OWNER') return apiError('Cannot delete OWNER', 403);

      // Soft delete — set inactive and revoke sessions
      await revokeAllStaffSessions(staffId);

      await db
        .from('staff')
        .update({ is_active: false })
        .eq('id', staffId)
        .eq('tenant_id', ctx.tenantId);

      return apiSuccess({ deleted: true });
    },
    ['OWNER', 'ADMIN']
  );
}
