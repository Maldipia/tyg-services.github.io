export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { verifySuperAdmin } from '@/lib/auth/superadmin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET ?? '';
  const authHeader = req.headers.get('authorization')?.replace('Bearer ','') ?? '';
  const querySecret = new URL(req.url).searchParams.get('secret') ?? '';
  const isCronCall = cronSecret && (authHeader === cronSecret || querySecret === cronSecret);
  const isSuperAdmin = !cronSecret || isCronCall || await verifySuperAdmin(req);
  if (!isSuperAdmin) return NextResponse.json({error:'Unauthorized'},{status:401});

  const db = createServiceClient();
  const {error} = await db.rpc('refresh_all_health_scores' as never);
  if (error) console.error('[health-refresh]', error);
  
  const {data:tenants} = await db.from('tenants').select('id').limit(1);
  const updated = tenants?.length ?? 0;

  await db.from('scheduled_jobs').update({last_run_at:new Date().toISOString(),status:'ok',result:{updated}}).eq('job_name','health_score_refresh');
  return NextResponse.json({ok:true,updated,refreshed_at:new Date().toISOString()});
}
