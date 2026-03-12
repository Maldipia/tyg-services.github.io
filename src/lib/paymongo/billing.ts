// ============================================================
// TYG POS — PayMongo Checkout Billing
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
    body: body ? JSON.stringify(body) : null,
  });

  const json = await res.json() as T | { errors: PayMongoError['errors'] };

  if (!res.ok) {
    const errJson = json as { errors: PayMongoError['errors'] };
    const firstError = errJson.errors?.[0];
    throw new Error(firstError?.detail ?? `PayMongo error ${res.status}`);
  }

  return json as T;
}

// ── Plan Pricing (PHP, stored as centavos for PayMongo) ──────
// 1 PHP = 100 centavos
export const PLAN_PRICES = {
  STARTER:    { monthly: 59900,   annual: 599900   }, // ₱599/mo  | ₱5,999/yr
  BUSINESS:   { monthly: 129900,  annual: 1299900  }, // ₱1,299/mo | ₱12,999/yr
  PRO:        { monthly: 249900,  annual: 2499900  }, // ₱2,499/mo | ₱24,999/yr
  ENTERPRISE: { monthly: 499900,  annual: 4999900  }, // ₱4,999/mo | ₱49,999/yr
} as const;

export const PLAN_LABELS = {
  STARTER:    { name: 'TYG POS Starter',    desc: 'QR ordering, KDS, basic analytics' },
  BUSINESS:   { name: 'TYG POS Business',   desc: 'SMS alerts, hourly heatmap, priority support' },
  PRO:        { name: 'TYG POS Pro',        desc: 'Multi-branch, BIR OR generation' },
  ENTERPRISE: { name: 'TYG POS Enterprise', desc: 'White-label, API access, dedicated support' },
} as const;

// ── Create a checkout session for plan upgrade ───────────────
export async function createCheckoutSession(params: {
  tenantId: string;
  tenantSlug: string;
  planTier: keyof typeof PLAN_PRICES;
  billingCycle: 'monthly' | 'annual';
  ownerEmail: string;
  businessName: string;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const amount = PLAN_PRICES[params.planTier][params.billingCycle];
  const label = PLAN_LABELS[params.planTier];
  const cycleLabel = params.billingCycle === 'monthly' ? 'Monthly' : 'Annual';
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
            amount,
            description: `${label.desc} — ${cycleLabel} subscription`,
            name: `${label.name} (${cycleLabel})`,
            quantity: 1,
          },
        ],
        payment_method_types: ['gcash', 'card', 'dob', 'billease', 'grab_pay'],
        success_url: `${appUrl}/admin/billing/success?tenant=${params.tenantSlug}&plan=${params.planTier}&cycle=${params.billingCycle}`,
        cancel_url:  `${appUrl}/admin/billing`,
        metadata: {
          tenantId:     params.tenantId,
          tenantSlug:   params.tenantSlug,
          planTier:     params.planTier,
          billingCycle: params.billingCycle,
        },
        send_email_receipt: true,
        show_description:   true,
        show_line_items:    true,
      },
    },
  });

  return {
    checkoutUrl: data.data.attributes.checkout_url,
    sessionId:   data.data.id,
  };
}

// ── Verify PayMongo Webhook Signature ────────────────────────
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string
): Promise<boolean> {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  const crypto = await import('crypto');
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('=') as [string, string])
  );
  const ts  = parts['t'];
  const sig = parts['te'] ?? parts['li'];

  if (!ts || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${ts}.${rawBody}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
  } catch {
    return false;
  }
}
