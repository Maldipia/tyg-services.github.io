import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

export async function GET(_req: NextRequest) {
  const db = createServiceClient();
  
  const { data: cats } = await db
    .from('menu_categories')
    .select('id, name')
    .eq('tenant_id', 'aaaaaaaa-0000-0000-0000-000000000001');
  
  const { data: items } = await db
    .from('menu_items')
    .select('id, name, category_id')
    .eq('tenant_id', 'aaaaaaaa-0000-0000-0000-000000000001');
  
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    keyPrefix: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').substring(0, 20),
    catCount: cats?.length,
    itemCount: items?.length,
    catIds: cats?.map((c: { id: string }) => c.id.substring(0, 12)),
  });
}
