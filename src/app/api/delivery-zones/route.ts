export const dynamic = 'force-dynamic';
// GET /api/delivery-zones?tenant=yani

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

export function OPTIONS() { return new Response(null, { status: 204 }); }

export async function GET(req: NextRequest): Promise<NextResponse> {
  const slug = new URL(req.url).searchParams.get('tenant');
  if (!slug) return NextResponse.json({ data: null, error: 'tenant required' }, { status: 400 });

  const db = createServiceClient();
  const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).single();
  if (!tenant) return NextResponse.json({ data: [], error: null });

  const { data, error } = await db.from('delivery_zones')
    .select('id, name, fee, min_order')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('sort_order');

  if (error) return NextResponse.json({ data: [], error: null });
  return NextResponse.json({ data: data ?? [], error: null });
}
