export const dynamic = 'force-dynamic';
// POST /api/signup-and-onboard
// Single call: create Supabase auth user (admin, no email confirm needed)
// + seed full tenant. No email redirect URL required.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/client';
import { hashPin } from '@/lib/auth/staff-auth';
import { apiError, apiSuccess, getClientIp } from '@/lib/auth/middleware';
import { ownerLoginRateLimit } from '@/lib/redis/ratelimit';

const Schema = z.object({
  email:        z.string().email(),
  password:     z.string().min(8).max(72),
  businessName: z.string().min(2).max(100).trim(),
  slug:         z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  ownerPin:     z.string().regex(/^\d{4,8}$/),
  ownerName:    z.string().min(2).max(80).trim(),
  phone:        z.string().max(20).optional(),
  address:      z.string().min(5).max(500).trim(),
  timezone:     z.string().default('Asia/Manila'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const { success: rlOk } = await ownerLoginRateLimit.limit(`signup:${ip}`);
  if (!rlOk) return apiError('Too many requests. Please wait.', 429);

  let body: unknown;
  try { body = await req.json(); } catch { return apiError('Invalid JSON', 400); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

  const { email, password, businessName, slug, ownerPin, ownerName, phone, address, timezone } = parsed.data;
  const db = createServiceClient();

  // Slug uniqueness
  const { data: slugCheck } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
  if (slugCheck) return apiError(`"${slug}" is already taken. Try a different one.`, 409, 'SLUG_TAKEN');

  // Create Supabase auth user via admin API — email_confirm: true skips confirmation email
  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: ownerName },
  });

  if (authErr || !authData?.user) {
    const msg = authErr?.message ?? '';
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return apiError('This email is already registered. Please log in instead.', 409, 'EMAIL_TAKEN');
    }
    return apiError(msg || 'Failed to create account', 500);
  }

  const user = authData.user;
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const prefix = slug.toUpperCase().replace(/-/g, '').slice(0, 6);
  let tenantId = '';

  try {
    // 1. Tenant
    const { data: tenant, error: tErr } = await db.from('tenants').insert({
      name: businessName, slug,
      owner_email: email, owner_user_id: user.id,
      phone: phone ?? null, address, timezone,
      plan_tier: 'TRIAL', plan_status: 'TRIAL', trial_ends_at: trialEndsAt,
      settings: {
        orderingEnabled: true, vatEnabled: true, vatRate: 0.12,
        pwdSeniorDiscountEnabled: true, requireCustomerName: true,
        requireCustomerPhone: false, smsEnabled: false,
        receiptFooter: `Thank you for visiting ${businessName}!`,
      },
    }).select('id').single();
    if (tErr || !tenant) throw new Error(`tenant: ${tErr?.message}`);
    tenantId = tenant.id as string;

    // 2. Branch
    const { error: bErr } = await db.from('branches')
      .insert({ tenant_id: tenantId, name: 'Main Branch', is_active: true });
    if (bErr) throw new Error(`branch: ${bErr.message}`);

    // 3. Staff OWNER
    const pinHash = await hashPin(ownerPin);
    const { error: sErr } = await db.from('staff').insert({
      tenant_id: tenantId, name: `${businessName} Owner`,
      display_name: 'Owner', pin_hash: pinHash, role: 'OWNER', is_active: true,
    });
    if (sErr) throw new Error(`staff: ${sErr.message}`);

    // 4. Default categories
    const { error: cErr } = await db.from('menu_categories').insert([
      { tenant_id: tenantId, name: 'Food',    sort_order: 0, is_active: true },
      { tenant_id: tenantId, name: 'Drinks',  sort_order: 1, is_active: true },
      { tenant_id: tenantId, name: 'Add-ons', sort_order: 2, is_active: true },
    ]);
    if (cErr) throw new Error(`categories: ${cErr.message}`);

    // 5. Order sequence + delivery zone
    await db.from('order_sequences').insert({ tenant_id: tenantId, prefix, last_number: 0 });
    await db.from('delivery_zones').insert({
      tenant_id: tenantId, name: 'Pickup (No Delivery Fee)', fee: 0, min_order: 0, is_active: true, sort_order: 0,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[signup-and-onboard] failed:', msg);
    if (tenantId) await db.from('tenants').delete().eq('id', tenantId);
    await db.auth.admin.deleteUser(user.id);
    return apiError(`Setup failed: ${msg}`, 500);
  }

  return apiSuccess({ tenantId, slug, loginUrl: `/login/${slug}`, orderUrl: `/order/${slug}` }, 201);
}
