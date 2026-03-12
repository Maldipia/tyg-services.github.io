export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — POST /api/billing/checkout
// Creates a PayMongo checkout session for plan upgrades.
// Requires staff auth (OWNER only).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withStaffAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createServiceClient } from '@/lib/supabase/client';
import { createCheckoutSession } from '@/lib/paymongo/billing';

const CheckoutSchema = z.object({
  planTier: z.enum(['STARTER', 'BUSINESS', 'PRO', 'ENTERPRISE']),
  billingCycle: z.enum(['monthly', 'annual']),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  return withStaffAuth(req, async (_, ctx) => {
    const body = await req.json() as unknown;
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation error', 400);

    const { planTier, billingCycle } = parsed.data;
    const db = createServiceClient();

    // Load tenant details
    const { data: tenant } = await db
      .from('tenants')
      .select('id, name, slug, owner_email, plan_tier, plan_status')
      .eq('id', ctx.tenantId)
      .single();

    if (!tenant) return apiError('Tenant not found', 404);

    // Don't allow downgrading via this route
    const tierOrder = ['TRIAL', 'STARTER', 'BUSINESS', 'PRO', 'ENTERPRISE'];
    const currentIdx = tierOrder.indexOf(tenant.plan_tier);
    const targetIdx = tierOrder.indexOf(planTier);
    if (targetIdx < currentIdx) {
      return apiError('Cannot downgrade via checkout. Contact support.', 400);
    }

    // Create PayMongo checkout session
    try {
      const { checkoutUrl, sessionId } = await createCheckoutSession({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        planTier,
        billingCycle,
        ownerEmail: tenant.owner_email,
        businessName: tenant.name,
      });

      // Log the checkout attempt
      await db.from('tenants').update({
        updated_at: new Date().toISOString(),
      }).eq('id', tenant.id);

      return apiSuccess({ checkoutUrl, sessionId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout creation failed';
      console.error('[billing/checkout]', msg);

      // If PayMongo isn't configured, return a helpful message
      if (msg.includes('PAYMONGO_SECRET_KEY')) {
        return apiError('Payment gateway not configured. Contact support.', 503);
      }

      return apiError(msg, 500);
    }
  }, ['OWNER', 'ADMIN']);
}
