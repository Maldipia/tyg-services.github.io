import { NextRequest } from 'next/server';
import { withOwnerAuth, apiSuccess, apiError } from '@/lib/auth/middleware';
import { createCheckoutSession } from '@/lib/paymongo/billing';

export function POST(req: NextRequest) {
  return withOwnerAuth(req, handleCheckout);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCheckout(req: NextRequest, ctx: any): Promise<Response> {
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
