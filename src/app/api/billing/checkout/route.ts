import { NextRequest, NextResponse } from 'next/server';
import { withOwnerAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createCheckoutSession } from '@/lib/paymongo/billing';
import type { TenantContext } from '@/types';

type OwnerCtx = TenantContext & { ownerUserId: string };

export function POST(req: NextRequest) {
  return withOwnerAuth(req, handleCheckout);
}

async function handleCheckout(req: NextRequest, ctx: OwnerCtx): Promise<NextResponse> {
  const body = await req.json() as { tier?: string; cycle?: 'monthly' | 'annual' };
  const { tier, cycle } = body;
  if (!tier || !cycle) return apiError('tier and cycle are required', 400);

  try {
    const session = await createCheckoutSession({
      tenantId: ctx.tenantId,
      tenantSlug: ctx.tenantSlug,
      tier: tier as never,
      cycle,
      email: '',
    });
    return apiSuccess({ checkoutUrl: session.attributes.checkout_url });
  } catch (err) {
    console.error('Billing checkout error:', err);
    return apiError('Failed to create checkout session', 500);
  }
}
