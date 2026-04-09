export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — POST /api/onboarding
// ============================================================
// CRITICAL: This must be fail-safe. Every step is awaited and
// verified. A partial tenant is worse than no tenant.
//
// Seeding order (fail on any error → cleanup):
//   1. slug uniqueness check
//   2. owner uniqueness check
//   3. INSERT tenants
//   4. INSERT branches (main)
//   5. INSERT staff (OWNER)
//   6. INSERT menu_categories (3 defaults)
//   7. INSERT order_sequences
//   8. INSERT delivery_zones (pickup)
//   9. Post-creation verification
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { hashPin } from '@/lib/auth/staff-auth';
import { apiSuccess, apiError, getClientIp } from '@/lib/auth/middleware';
import { ownerLoginRateLimit } from '@/lib/redis/ratelimit';

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

  const { success: rlOk } = await ownerLoginRateLimit.limit(`onboarding:${ip}`);
  if (!rlOk) return apiError('Too many requests. Please wait before trying again.', 429);

  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return apiError('Authentication required', 401);

  const db = createServiceClient();
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return apiError('Invalid or expired token', 401);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);
  }

  const { businessName, slug, ownerPin, phone, address, timezone } = parsed.data;

  // ── VALIDATION (slug first → better UX) ──────────────────
  const { data: slugCheck } = await db
    .from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (slugCheck) {
    return apiError(`"${slug}" is already taken. Try a different slug.`, 409, 'SLUG_TAKEN');
  }

  const { data: existingTenant } = await db
    .from('tenants').select('id').eq('owner_user_id', user.id).maybeSingle();
  if (existingTenant) {
    return apiError('You already have a TYG POS account. Log in at /login.', 409, 'TENANT_EXISTS');
  }

  // ── SEEDING — sequential, all awaited, rollback on failure ─
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const prefix = slug.toUpperCase().replace(/-/g, '').slice(0, 6);
  let tenantId = '';
  let branchId = '';

  try {
    // 1. Create tenant
    const { data: tenant, error: tenantErr } = await db
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
        settings: {
          orderingEnabled: true,
          vatEnabled: true,
          vatRate: 0.12,
          pwdSeniorDiscountEnabled: true,
          requireCustomerName: true,
          requireCustomerPhone: false,
          smsEnabled: false,
          kitchenPrintEnabled: false,
          maxTablesPerBranch: 20,
          receiptFooter: `Thank you for visiting ${businessName}!`,
        },
      })
      .select('id, slug')
      .single();

    if (tenantErr || !tenant) throw new Error(`tenant: ${tenantErr?.message ?? 'unknown'}`);
    tenantId = tenant.id as string;

    // 2. Create main branch
    const { data: branch, error: branchErr } = await db
      .from('branches')
      .insert({ tenant_id: tenantId, name: 'Main Branch', is_active: true })
      .select('id')
      .single();

    if (branchErr || !branch) throw new Error(`branch: ${branchErr?.message ?? 'unknown'}`);
    branchId = branch.id as string;

    // 3. Create OWNER staff
    const pinHash = await hashPin(ownerPin);
    const { error: staffErr } = await db.from('staff').insert({
      tenant_id: tenantId,
      branch_id: null, // OWNER sees all branches
      name: `${businessName} Owner`,
      display_name: 'Owner',
      pin_hash: pinHash,
      role: 'OWNER',
      is_active: true,
    });
    if (staffErr) throw new Error(`staff: ${staffErr.message}`);

    // 4. Seed menu categories (Food + Drinks + Add-ons)
    const { error: catErr } = await db.from('menu_categories').insert([
      { tenant_id: tenantId, branch_id: null, name: 'Food',     sort_order: 0, is_active: true },
      { tenant_id: tenantId, branch_id: null, name: 'Drinks',   sort_order: 1, is_active: true },
      { tenant_id: tenantId, branch_id: null, name: 'Add-ons',  sort_order: 2, is_active: true },
    ]);
    if (catErr) throw new Error(`categories: ${catErr.message}`);

    // 5. Seed order sequence
    const { error: seqErr } = await db.from('order_sequences').insert({
      tenant_id: tenantId,
      prefix,
      last_number: 0,
    });
    if (seqErr) throw new Error(`order_sequences: ${seqErr.message}`);

    // 6. Seed default delivery zone (pickup)
    const { error: zoneErr } = await db.from('delivery_zones').insert({
      tenant_id: tenantId,
      name: 'Pickup (No Delivery Fee)',
      fee: 0,
      min_order: 0,
      sort_order: 0,
      is_active: true,
    });
    if (zoneErr) throw new Error(`delivery_zones: ${zoneErr.message}`);

  } catch (seedErr) {
    const msg = seedErr instanceof Error ? seedErr.message : String(seedErr);
    console.error('[onboarding] Seed failed:', msg);

    // ── Rollback: delete tenant cascades branches + staff (FK ON DELETE CASCADE)
    if (tenantId) {
      const { error: rbErr } = await db.from('tenants').delete().eq('id', tenantId);
      if (rbErr) console.error('[onboarding] Rollback failed:', rbErr.message);
      else console.log('[onboarding] Rolled back tenant', tenantId);
    }

    return apiError(`Setup failed during ${msg}. Please try again.`, 500, 'ONBOARDING_FAILED');
  }

  // ── POST-CREATION VERIFICATION ───────────────────────────
  const [
    { count: staffCount },
    { count: zoneCount },
    { count: seqCount },
    { count: catCount },
  ] = await Promise.all([
    db.from('staff').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    db.from('delivery_zones').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    db.from('order_sequences').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    db.from('menu_categories').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ]);

  const checks = { staffCount, zoneCount, seqCount, catCount };
  const failed = Object.entries(checks).filter(([, v]) => !v || v < 1);

  if (failed.length > 0) {
    console.error('[onboarding] Verification failed:', checks);
    await db.from('tenants').delete().eq('id', tenantId);
    return apiError('Setup verification failed. Please try signing up again.', 500, 'VERIFICATION_FAILED');
  }

  return apiSuccess({
    tenantId,
    slug,
    branchId,
    trialEndsAt,
    orderUrl: `/order/${slug}`,
    loginUrl: `/login`,
    dashboardUrl: `/admin/dashboard`,
    seeded: {
      staff: staffCount,
      zones: zoneCount,
      sequences: seqCount,
      categories: catCount,
    },
  }, 201);
}
