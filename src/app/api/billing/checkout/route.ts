import { NextRequest, NextResponse } from 'next/server';
import { withOwnerAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createCheckoutSession } from '@/lib/paymongo/billing';
import type { TenantContext } from '@/types';

type OwnerCtx = TenantContext & { ownerUserId: string };

export function POST(req: NextRequest) {
  return withOwnerAuth(req, handleCheckout);
}

async function handleCheckout(req: NextRequest, ctx: OwnerCtx): Promise<NextResponse> {
  const body = await req.json() as { planTier?: string; billingCycle?: 'monthly' | 'annual' };
  const { planTier, billingCycle } = body;
  if (!planTier || !billingCycle) return apiError('planTier and billingCycle are required', 400);

  try {
    const result = await createCheckoutSession({
      tenantId: ctx.tenantId,
      tenantSlug: ctx.tenantSlug,
      planTier: planTier as 'STARTER' | 'BUSINESS' | 'PRO' | 'ENTERPRISE',
      billingCycle,
      ownerEmail: '',
      businessName: ctx.tenantSlug,
    });
    return apiSuccess({ checkoutUrl: result.checkoutUrl });
  } catch (err) {
    console.error('Billing checkout error:', err);
    return apiError('Failed to create checkout session', 500);
  }
}
