import { NextRequest } from 'next/server';
import { withOwnerAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createCheckoutSession } from '@/lib/paymongo/billing';
import type { AuthContext } from '@/types';

export function POST(req: NextRequest) {
  return withOwnerAuth(req, handleCheckout);
}

async function handleCheckout(req: NextRequest, ctx: AuthContext): Promise<Response> {
  const { tier, cycle } = await req.json() as { tier: string; cycle: 'monthly' | 'annual' };
  if (!tier || !cycle) return apiError('tier and cycle are required', 400);

  try {
    const session = await createCheckoutSession({
      tenantId: ctx.tenantId,
      tenantSlug: ctx.tenantSlug,
      tier: tier as never,
      cycle,
      email: ctx.email ?? '',
    });
    return apiSuccess({ checkoutUrl: session.attributes.checkout_url });
  } catch (err) {
    console.error('Billing checkout error:', err);
    return apiError('Failed to create checkout session', 500);
  }
}
