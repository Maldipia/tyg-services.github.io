export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('authorization')?.replace('Bearer ','') ?? new URL(req.url).searchParams.get('secret') ?? '';
  if (CRON_SECRET && secret !== CRON_SECRET) return NextResponse.json({error:'Unauthorized'},{status:401});

  const db = createServiceClient();
  // Refresh health scores for all tenants
  const {data:tenants} = await db.from('tenants').select('id').limit(200);
  let updated = 0;
  for (const t of tenants ?? []) {
    const {data:h} = await db.rpc('compute_tenant_health', {t_id: t.id});
    if (h?.[0]) {
      await db.from('tenants').update({
        health_label: (h[0] as {label:string}).label,
        last_active_at: new Date().toISOString(),
      }).eq('id', t.id);
      updated++;
    }
  }
  await db.from('scheduled_jobs').update({last_run_at:new Date().toISOString(),status:'ok',result:{updated}}).eq('job_name','health_score_refresh');
  return NextResponse.json({ok:true,updated});
}
