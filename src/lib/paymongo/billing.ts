// ============================================================
// TYG POS — PayMongo Subscription Billing
// PH-native: GCash, credit card, bank transfer
// ============================================================

const PAYMONGO_BASE = 'https://api.paymongo.com/v1';

interface PayMongoError {
  errors: Array<{ code: string; detail: string; source?: { attribute: string } }>;
}

async function paymongoRequest<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown
): Promise<T> {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) throw new Error('PAYMONGO_SECRET_KEY not set');

  const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

  const res = await fetch(`${PAYMONGO_BASE}${path}`, {
    method,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as T | { errors: PayMongoError['errors'] };

  if (!res.ok) {
    const errJson = json as { errors: PayMongoError['errors'] };
    const firstError = errJson.errors?.[0];
    throw new Error(firstError?.detail ?? `PayMongo error ${res.status}`);
  }

  return json as T;
}

// ── Plan Prices (PayMongo Price IDs — set in Dashboard) ──────
// These come from your PayMongo dashboard product configuration
export const PLAN_PRICES = {
  STARTER:    { monthly: 'pri_starter_monthly',    annual: 'pri_starter_annual' },
  BUSINESS:   { monthly: 'pri_business_monthly',   annual: 'pri_business_annual' },
  PRO:        { monthly: 'pri_pro_monthly',         annual: 'pri_pro_annual' },
  ENTERPRISE: { monthly: 'pri_enterprise_monthly',  annual: 'pri_enterprise_annual' },
} as const;

// ── Create a checkout session for subscription upgrade ───────
export async function createCheckoutSession(params: {
  tenantId: string;
  tenantSlug: string;
  planTier: keyof typeof PLAN_PRICES;
  billingCycle: 'monthly' | 'annual';
  ownerEmail: string;
  businessName: string;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const priceId = PLAN_PRICES[params.planTier][params.billingCycle];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const data = await paymongoRequest<{
    data: { id: string; attributes: { checkout_url: string } };
  }>('POST', '/checkout_sessions', {
    data: {
      attributes: {
        billing: {
          name: params.businessName,
          email: params.ownerEmail,
        },
        line_items: [
          {
            currency: 'PHP',
            amount: 0, // determined by price ID
            description: `TYG POS ${params.planTier} — ${params.billingCycle}`,
            name: `TYG POS ${params.planTier}`,
            quantity: 1,
          },
        ],
        payment_method_types: ['gcash', 'card', 'dob', 'billease'],
        success_url: `${appUrl}/admin/billing/success?tenant=${params.tenantSlug}&plan=${params.planTier}`,
        cancel_url: `${appUrl}/admin/billing?tenant=${params.tenantSlug}`,
        metadata: {
          tenantId: params.tenantId,
          planTier: params.planTier,
          billingCycle: params.billingCycle,
        },
      },
    },
  });

  return {
    checkoutUrl: data.data.attributes.checkout_url,
    sessionId: data.data.id,
  };
}

// ── Handle PayMongo Webhook ───────────────────────────────────
// Called from /api/webhooks/paymongo
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string
): Promise<boolean> {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  const crypto = await import('crypto');
  const [timestamp, signature] = signatureHeader.split(',');
  const ts = timestamp?.replace('t=', '');
  const sig = signature?.replace('te=', '') ?? signature?.replace('li=', '');

  if (!ts || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${ts}.${rawBody}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(sig, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
}
