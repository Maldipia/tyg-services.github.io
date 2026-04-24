export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { verifySuperAdmin } from '@/lib/auth/superadmin';

interface Tenant { id:string; name:string; owner_email:string; slug:string; trial_ends_at:string; created_at:string; menu_item_count:number; }

async function sendEmail(to:string, subject:string, html:string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log('[trial-reminder] skip, no key'); return true; }
  const r = await fetch('https://api.resend.com/emails', { method:'POST',
    headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:'TYG POS <noreply@tyg-services.com>',to,subject,html}) });
  return r.ok;
}

function makeEmail(type:string, t:Tenant):{subject:string;html:string} {
  if (type==='day3_setup') return {
    subject:`${t.name} — finish setting up your store`,
    html:`<div style="font-family:sans-serif;padding:32px"><h2 style="color:#16a34a">Hi ${t.name}!</h2><p>Your trial started 3 days ago. You have ${t.menu_item_count} menu items so far.</p><ul><li>Add more menu items</li><li>Set up GCash/Maya QR for payments</li><li>Add staff and tables</li></ul><a href="https://www.tyg-services.com/login/${t.slug}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Continue Setup</a><p style="color:#6b7280;font-size:12px;margin-top:20px">Trial ends: ${new Date(t.trial_ends_at).toLocaleDateString('en-PH',{dateStyle:'long'})}</p></div>`};
  if (type==='day10_ending') return {
    subject:`${t.name} — trial ends in 4 days`,
    html:`<div style="font-family:sans-serif;padding:32px"><h2 style="color:#f59e0b">Trial ending soon</h2><p>Hi ${t.name}, your trial expires <strong>${new Date(t.trial_ends_at).toLocaleDateString('en-PH',{dateStyle:'long'})}</strong>.</p><a href="https://www.tyg-services.com/login/${t.slug}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Upgrade — P499/mo</a></div>`};
  return {
    subject:`${t.name} — trial expires today`,
    html:`<div style="font-family:sans-serif;padding:32px"><h2 style="color:#ef4444">Last chance!</h2><p>Hi ${t.name}, trial expires <strong>today</strong>.</p><a href="https://www.tyg-services.com/login/${t.slug}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Upgrade Now</a></div>`};
}

export async function GET(req:NextRequest): Promise<NextResponse> {
  // Auth: Vercel cron secret OR superadmin session
  const cronSecret = process.env.CRON_SECRET ?? '';
  const authHeader = req.headers.get('authorization')?.replace('Bearer ','') ?? '';
  const querySecret = new URL(req.url).searchParams.get('secret') ?? '';
  const isCronCall = cronSecret && (authHeader === cronSecret || querySecret === cronSecret);
  const isSuperAdmin = !cronSecret || isCronCall || await verifySuperAdmin(req);
  if (!isSuperAdmin) return NextResponse.json({error:'Unauthorized'},{status:401});

  const db = createServiceClient();
  let day3=0, day10=0, day14=0, skipped=0, errors=0;

  const {data:tenants} = await db.from('tenant_overview')
    .select('id,name,owner_email,slug,trial_ends_at,created_at,menu_item_count')
    .eq('plan_status','TRIAL').not('trial_ends_at','is',null).limit(200) as {data:Tenant[]|null};

  if (!tenants?.length) return NextResponse.json({ok:true,message:'no trial tenants',results:{day3,day10,day14,skipped,errors}});

  for (const t of tenants) {
    try {
      const daysSince = Math.floor((Date.now()-new Date(t.created_at).getTime())/86400000);
      const daysLeft  = Math.ceil((new Date(t.trial_ends_at).getTime()-Date.now())/86400000);
      const {data:sent} = await db.from('trial_reminders').select('reminder_type').eq('tenant_id',t.id);
      const sentSet = new Set((sent??[]).map((r:{reminder_type:string})=>r.reminder_type));

      let type = '';
      if (daysSince>=3 && !sentSet.has('day3_setup')) type='day3_setup';
      else if (daysLeft<=4 && daysLeft>1 && !sentSet.has('day10_ending')) type='day10_ending';
      else if (daysLeft<=1 && daysLeft>=0 && !sentSet.has('day14_last_chance')) type='day14_last_chance';

      if (type==='') { skipped++; continue; }

      const {subject,html} = makeEmail(type,t);
      const ok = await sendEmail(t.owner_email,subject,html);
      if (ok) {
        await db.from('trial_reminders').upsert({tenant_id:t.id,reminder_type:type,email:t.owner_email,sent_at:new Date().toISOString()},{onConflict:'tenant_id,reminder_type'});
        if (type==='day3_setup') day3++;
        else if (type==='day10_ending') day10++;
        else day14++;
      } else errors++;
    } catch(e) { console.error('[trial-reminder]',t.slug,e); errors++; }
  }

  await db.from('scheduled_jobs').update({last_run_at:new Date().toISOString(),next_run_at:new Date(Date.now()+86400000).toISOString(),status:'ok',result:{day3,day10,day14,skipped,errors}}).eq('job_name','trial_reminders');
  return NextResponse.json({ok:true,results:{day3,day10,day14,skipped,errors},checked:tenants.length});
}
