export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — POST /api/webhooks/paymongo
// Handles: payment.paid, payment.failed, checkout.session.completed
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paymongo/billing';
import { createServiceClient } from '@/lib/supabase/client';
import type { PlanTier } from '@/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get('paymongo-signature') ?? '';

  // Verify webhook authenticity
  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: {
    data: {
      attributes: {
        type: string;
        data: {
          attributes: {
            metadata?: { tenantId?: string; planTier?: string; billingCycle?: string };
            status?: string;
            payment_intent_id?: string;
          };
        };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event.data.attributes.type;
  const db = createServiceClient();

  switch (eventType) {
    case 'checkout_session.payment.paid': {
      const attrs = event.data.attributes.data.attributes;
      const tenantId = attrs.metadata?.tenantId;
      const planTier = attrs.metadata?.planTier as PlanTier | undefined;
      const billingCycle = attrs.metadata?.billingCycle;

      if (!tenantId || !planTier) break;

      const periodEnd = billingCycle === 'annual'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await db
        .from('tenants')
        .update({
          plan_tier: planTier,
          plan_status: 'ACTIVE',
          trial_ends_at: null,
          plan_period_end: periodEnd,
        })
        .eq('id', tenantId);

      console.log(`Tenant ${tenantId} upgraded to ${planTier}`);
      break;
    }

    case 'checkout_session.payment.failed': {
      const attrs = event.data.attributes.data.attributes;
      const tenantId = attrs.metadata?.tenantId;
      if (!tenantId) break;

      // Move to grace period (3 days before suspension)
      await db
        .from('tenants')
        .update({ plan_status: 'GRACE' })
        .eq('id', tenantId)
        .eq('plan_status', 'ACTIVE');

      console.log(`Tenant ${tenantId} moved to GRACE period`);
      break;
    }

    default:
      // Log unhandled events for debugging
      console.log('Unhandled PayMongo event:', eventType);
  }

  // Always return 200 — PayMongo retries on non-200
  return NextResponse.json({ received: true });
}
