// ============================================================
// TYG POS — API Route Middleware
//
// ARCHITECTURE RULES:
// 1. Tenant context ALWAYS injected from validated session JWT.
//    Routes NEVER trust tenant_id from request body/params.
// 2. ALL auth guards live here — not just in the UI.
//    Missing an auth guard on an endpoint = critical security bug.
// 3. Service role is only used AFTER middleware validates context.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { validateStaffSession } from '@/lib/auth/staff-auth';
import type { TenantContext, AuthContext, StaffRole, PlanTier } from '@/types';

// ── Cookie names ─────────────────────────────────────────────
export const STAFF_SESSION_COOKIE = 'tyg-staff-session';
export const OWNER_SESSION_COOKIE = 'tyg-owner-session'; // Supabase Auth JWT

// ── Standard API Response Helpers ───────────────────────────
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data, error: null }, { status });
}

export function apiError(message: string, status = 400, code?: string): NextResponse {
  return NextResponse.json({ data: null, error: message, code }, { status });
}

// ── Resolve tenant by slug or ID ─────────────────────────────
export async function resolveTenant(slugOrId: string): Promise<TenantContext | null> {
  const db = createServiceClient();

  const isUUID = /^[0-9a-f-]{36}$/i.test(slugOrId);
  const query = db
    .from('tenants')
    .select('id, slug, plan_tier, plan_status, trial_ends_at, grace_ends_at, settings')
    .eq(isUUID ? 'id' : 'slug', slugOrId)
    .single();

  const { data, error } = await query;
  if (error || !data) return null;

  const now = new Date();
  const trialEnds = data.trial_ends_at ? new Date(data.trial_ends_at as string) : null;
  const isTrialActive = data.plan_status === 'TRIAL' && trialEnds !== null && trialEnds > now;

  const settings = data.settings as { orderingEnabled: boolean };

  return {
    tenantId: data.id as string,
    tenantSlug: data.slug as string,
    planTier: data.plan_tier as PlanTier,
    planStatus: data.plan_status as 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'CANCELLED',
    isTrialActive,
    isOrderingEnabled: settings.orderingEnabled,
  };
}

// ── Middleware: Require valid staff session ──────────────────
// Injects AuthContext into the handler; returns 401 if invalid.
export async function withStaffAuth(
  req: NextRequest,
  handler: (req: NextRequest, ctx: AuthContext) => Promise<NextResponse>,
  allowedRoles?: StaffRole[]
): Promise<NextResponse> {
  const token = req.cookies.get(STAFF_SESSION_COOKIE)?.value;

  if (!token) {
    return apiError('Authentication required', 401, 'UNAUTHENTICATED');
  }

  const session = await validateStaffSession(token);
  if (!session) {
    return apiError('Session expired or invalid', 401, 'SESSION_INVALID');
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return apiError('Insufficient permissions', 403, 'FORBIDDEN');
  }

  const tenant = await resolveTenant(session.tenantId);
  if (!tenant) {
    return apiError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  }

  // Check plan status — SUSPENDED tenants: staff cannot operate
  if (tenant.planStatus === 'SUSPENDED' || tenant.planStatus === 'CANCELLED') {
    return apiError('Account suspended — please contact support', 402, 'ACCOUNT_SUSPENDED');
  }
  // GRACE: allow staff to operate but flag it — owner must be notified
  if (tenant.planStatus === 'GRACE') {
    const graceEnds = (tenant as unknown as Record<string,unknown>).graceEndsAt;
    if (graceEnds && new Date(graceEnds as string) < new Date()) {
      // Grace period expired — now actually suspend
      return apiError('Account subscription has expired — please contact support', 402, 'GRACE_EXPIRED');
    }
    // Still within grace — allow operation, append header warning
  }

  const ctx: AuthContext = {
    ...tenant,
    staffId: session.staffId,
    role: session.role,
    branchId: session.branchId,
    displayName: session.displayName,
  };

  return handler(req, ctx);
}

// ── Middleware: Require Supabase owner login ─────────────────
export async function withOwnerAuth(
  req: NextRequest,
  handler: (req: NextRequest, ctx: TenantContext & { ownerUserId: string }) => Promise<NextResponse>
): Promise<NextResponse> {
  // Parse Supabase JWT from Authorization header or cookie
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') ??
    req.cookies.get(OWNER_SESSION_COOKIE)?.value;

  if (!token) {
    return apiError('Authentication required', 401, 'UNAUTHENTICATED');
  }

  // Verify with Supabase (service client validates the JWT)
  const db = createServiceClient();
  const { data: { user }, error } = await db.auth.getUser(token);

  if (error || !user) {
    return apiError('Invalid or expired token', 401, 'TOKEN_INVALID');
  }

  // Fetch tenant owned by this user
  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .select('id, slug, plan_tier, plan_status, trial_ends_at, grace_ends_at, settings')
    .eq('owner_user_id', user.id)
    .single();

  if (tenantError || !tenant) {
    return apiError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  }

  const now = new Date();
  const trialEnds = tenant.trial_ends_at ? new Date(tenant.trial_ends_at as string) : null;
  const settings = tenant.settings as { orderingEnabled: boolean };

  const ctx = {
    tenantId: tenant.id as string,
    tenantSlug: tenant.slug as string,
    planTier: tenant.plan_tier as PlanTier,
    planStatus: tenant.plan_status as 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'CANCELLED',
    isTrialActive: tenant.plan_status === 'TRIAL' && trialEnds !== null && trialEnds > now,
    isOrderingEnabled: settings.orderingEnabled,
    ownerUserId: user.id,
  };

  return handler(req, ctx);
}

// ── Plan Feature Gates ────────────────────────────────────────
const PLAN_HIERARCHY: Record<PlanTier, number> = {
  TRIAL: 0,
  STARTER: 1,
  BUSINESS: 2,
  PRO: 3,
  ENTERPRISE: 4,
};

export function meetsMinPlan(currentPlan: PlanTier, requiredPlan: PlanTier): boolean {
  return PLAN_HIERARCHY[currentPlan] >= PLAN_HIERARCHY[requiredPlan];
}

export function requirePlan(
  currentPlan: PlanTier,
  requiredPlan: PlanTier
): NextResponse | null {
  if (!meetsMinPlan(currentPlan, requiredPlan)) {
    return apiError(
      `This feature requires ${requiredPlan} plan or higher`,
      402,
      'PLAN_UPGRADE_REQUIRED'
    );
  }
  return null;
}

// ── Extract IP for rate limiting ─────────────────────────────
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

// ── CORS Preflight Response ───────────────────────────────────
export function apiOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://www.tyg-services.com',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-tyg-signature',
      'Access-Control-Max-Age': '86400',
    },
  });
}
