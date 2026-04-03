export const dynamic = 'force-dynamic';
// POST /api/webhooks/grabfood
// Stub webhook receiver for GrabFood / FoodPanda order events.
// Currently logs inbound requests and returns 200 — ready for platform credential wiring.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signature  = req.headers.get('x-grab-signature') ?? req.headers.get('x-foodpanda-signature') ?? '';
  const platform   = req.headers.get('x-grab-signature') ? 'GRAB' : 'FOODPANDA';
  const tenantSlug = req.nextUrl.searchParams.get('tenant') ?? 'unknown';

  let payload: unknown;
  try { payload = await req.json(); } catch { payload = null; }

  // Log the inbound event for visibility
  const db = createServiceClient();
  const { data: tenant } = await db.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();

  if (tenant) {
    await db.from('system_logs').insert({
      tenant_id:    tenant.id,
      event_type:   'SYSTEM_ERROR' as const,
      entity_type:  'ORDER' as const,
      action_source:'WEBHOOK' as const,
      status:       'WARNING' as const,
      details: {
        platform,
        signature: signature ? '[present]' : '[missing]',
        payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload as object) : null,
        note: 'GrabFood/FoodPanda webhook received — platform credentials not yet configured',
      },
    });
  }

  // Return 200 so platform doesn't retry aggressively
  return NextResponse.json({ received: true, platform, note: 'Integration pending configuration' });
}
