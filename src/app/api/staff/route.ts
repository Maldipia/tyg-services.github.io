export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — /api/staff
// GET: list staff (OWNER/ADMIN)
// POST: create staff (OWNER/ADMIN)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { hashPin } from '@/lib/auth/staff-auth';
import type { StaffRole } from '@/types';

const STAFF_ROLES: StaffRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN'];

const CreateStaffSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  displayName: z.string().min(1).max(50).trim(),
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4–8 digits'),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN']),
  branchId: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(
    req,
    async (_, ctx) => {
      const db = createServiceClient();

      const { data, error } = await db
        .from('staff')
        .select('id, name, display_name, role, branch_id, is_active, last_login, created_at')
        .eq('tenant_id', ctx.tenantId)
        .order('role')
        .order('name');

      if (error) return apiError('Failed to fetch staff', 500);
      return apiSuccess(data);
    },
    ['OWNER', 'ADMIN']
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(
    req,
    async (request, ctx) => {
      let body: unknown;
      try { body = await request.json(); }
      catch { return apiError('Invalid JSON', 400); }

      const parsed = CreateStaffSchema.safeParse(body);
      if (!parsed.success) {
        return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
      }

      const { name, displayName, pin, role, branchId } = parsed.data;

      // Prevent creating OWNER role (there can only be one)
      if (role === 'OWNER' as StaffRole) {
        return apiError('Cannot create additional OWNER accounts', 403);
      }

      const db = createServiceClient();

      // Check display name uniqueness within tenant
      const { data: existing } = await db
        .from('staff')
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .eq('display_name', displayName)
        .single();

      if (existing) {
        return apiError(`Display name "${displayName}" is already taken`, 409, 'DISPLAY_NAME_TAKEN');
      }

      // Hash PIN with bcrypt cost 12 (per-user random salt)
      const pinHash = await hashPin(pin);

      const { data: staff, error } = await db
        .from('staff')
        .insert({
          tenant_id: ctx.tenantId,
          name,
          display_name: displayName,
          pin_hash: pinHash,
          role,
          branch_id: branchId ?? null,
          is_active: true,
        })
        .select('id, name, display_name, role, branch_id, is_active, created_at')
        .single();

      if (error || !staff) {
        return apiError('Failed to create staff member', 500);
      }

      return apiSuccess(staff, 201);
    },
    ['OWNER', 'ADMIN']
  );
}
