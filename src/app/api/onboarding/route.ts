// ============================================================
// TYG POS — POST /api/onboarding
// Creates new tenant after Supabase Auth signup.
// Seeds: default branch, OWNER staff, sample category.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { hashPin } from '@/lib/auth/staff-auth';
import { apiSuccess, apiError, getClientIp } from "@/lib/auth/middleware";
import { ownerLoginRateLimit } from "@/lib/redis/ratelimit";

const OnboardingSchema = z.object({
  businessName: z.string().min(2).max(100).trim(),
  slug: z.string()
    .min(3).max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  ownerPin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4–8 digits'),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  timezone: z.string().default('Asia/Manila'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);

  // Rate limit onboarding — prevents abuse
  const { success } = await ownerLoginRateLimit.limit(`onboarding:${ip}`);
  if (!success) return apiError('Too many requests', 429);

  // Require authenticated Supabase user
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return apiError('Authentication required', 401);

  const db = createServiceClient();
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return apiError('Invalid token', 401);

  // Check if this user already has a tenant
  const { data: existingTenant } = await db
    .from('tenants')
    .select('id')
    .eq('owner_user_id', user.id)
    .single();

  if (existingTenant) {
    return apiError('You already have a TYG POS account', 409, 'TENANT_EXISTS');
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
  }

  const { businessName, slug, ownerPin, phone, address, timezone } = parsed.data;

  // Check slug uniqueness
  const { data: slugCheck } = await db
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();

  if (slugCheck) {
    return apiError(`"${slug}" is already taken. Try a different slug.`, 409, 'SLUG_TAKEN');
  }

  // ── Create tenant ────────────────────────────────────────
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .insert({
      name: businessName,
      slug,
      owner_email: user.email!,
      owner_user_id: user.id,
      phone: phone ?? null,
      address: address ?? null,
      timezone,
      plan_tier: 'TRIAL',
      plan_status: 'TRIAL',
      trial_ends_at: trialEndsAt,
    })
    .select('id, slug')
    .single();

  if (tenantError || !tenant) {
    console.error('Tenant creation error:', tenantError);
    return apiError('Failed to create tenant', 500);
  }

  const tenantId = tenant.id as string;

  // ── Create default branch ────────────────────────────────
  const { data: branch } = await db
    .from('branches')
    .insert({
      tenant_id: tenantId,
      name: 'Main Branch',
      is_active: true,
    })
    .select('id')
    .single();

  // ── Create OWNER staff account ───────────────────────────
  const pinHash = await hashPin(ownerPin);
  await db.from('staff').insert({
    tenant_id: tenantId,
    name: businessName + ' Owner',
    display_name: 'Owner',
    pin_hash: pinHash,
    role: 'OWNER',
    branch_id: null, // Owner sees all branches
    is_active: true,
  });

  // ── Seed default menu category ───────────────────────────
  await db.from('menu_categories').insert({
    tenant_id: tenantId,
    branch_id: null,
    name: 'All Items',
    sort_order: 0,
    is_active: true,
  });

  // ── Seed order sequence ──────────────────────────────────
  await db.from('order_sequences').insert({
    tenant_id: tenantId,
    last_seq: 0,
  });

  return apiSuccess(
    {
      tenantId,
      slug: tenant.slug,
      branchId: branch?.id ?? null,
      trialEndsAt,
      dashboardUrl: `/admin/dashboard`,
    },
    201
  );
}
