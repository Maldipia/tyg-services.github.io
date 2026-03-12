// ============================================================
// TYG POS — POST /api/auth/staff/login
// PIN-based staff authentication. Rate limited via Upstash Redis.
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateStaff, createStaffSession } from '@/lib/auth/staff-auth';
import { pinLoginRateLimit } from '@/lib/redis/ratelimit';
import { resolveTenant, apiSuccess, apiError, getClientIp, STAFF_SESSION_COOKIE } from '@/lib/auth/middleware';

const LoginSchema = z.object({
  tenantSlug: z.string().min(3).max(50),
  displayName: z.string().min(1).max(100),
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4–8 digits'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  // Rate limit: 5 attempts per 15 minutes per IP
  const { success: rateLimitOk, reset } = await pinLoginRateLimit.limit(ip);
  if (!rateLimitOk) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return apiError(
      `Too many login attempts. Try again in ${retryAfter} seconds.`,
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON', 400);
  }

  const parseResult = LoginSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(parseResult.error.errors[0]?.message ?? 'Validation error', 400);
  }

  const { tenantSlug, displayName, pin } = parseResult.data;

  // Resolve tenant
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) {
    // Return generic error — don't leak whether tenant exists
    return apiError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  if (tenant.planStatus === 'SUSPENDED' || tenant.planStatus === 'CANCELLED') {
    return apiError('Account suspended', 402, 'ACCOUNT_SUSPENDED');
  }

  // Authenticate (bcrypt compare — timing-safe)
  const staff = await authenticateStaff(tenant.tenantId, displayName, pin);
  if (!staff) {
    return apiError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // Fetch tenant name for UI display
  const { createServiceClient } = await import('@/lib/supabase/client');
  const db = createServiceClient();
  const { data: tenantData } = await db
    .from('tenants')
    .select('id, name, slug, address, plan_tier, plan_status, trial_ends_at')
    .eq('id', tenant.tenantId)
    .single();

  // Create session
  const userAgent = req.headers.get('user-agent') ?? '';
  const rawToken = await createStaffSession(staff, ip, userAgent);

  // Set HttpOnly cookie
  const response = apiSuccess({
    staffId: staff.id,
    displayName: staff.display_name,
    role: staff.role,
    branchId: staff.branch_id,
    // Tenant context for frontend localStorage
    tenantId: tenant.tenantId,
    tenantSlug: tenant.tenantSlug,
    tenantName: tenantData?.name ?? tenantSlug,
    tenantAddress: tenantData?.address ?? null,
    planTier: tenant.planTier,
    planStatus: tenant.planStatus,
    trialEndsAt: tenantData?.trial_ends_at ?? null,
  });

  response.cookies.set(STAFF_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours
  });

  return response;
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { revokeStaffSession } = await import('@/lib/auth/staff-auth');
  const token = req.cookies.get(STAFF_SESSION_COOKIE)?.value;

  if (token) {
    await revokeStaffSession(token);
  }

  const response = apiSuccess({ message: 'Logged out' });
  response.cookies.delete(STAFF_SESSION_COOKIE);
  return response;
}
