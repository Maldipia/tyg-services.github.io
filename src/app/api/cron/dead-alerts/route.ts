export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const ADMIN_EMAIL = 'tygfsb@gmail.com';

async function sendAdminAlert(subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log('[dead-alert] skip, no RESEND_API_KEY'); return true; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'TYG POS Alerts <alerts@tyg-services.com>', to: ADMIN_EMAIL, subject, html }),
  });
  return r.ok;
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const db = createServiceClient();
  const alerts: string[] = [];

  // Dead tenants: no orders in 7+ days AND plan is ACTIVE/TRIAL
  const { data: deadTenants } = await db.from('tenants')
    .select('id, name, slug, owner_email, plan_status, health_label, last_active_at, created_at')
    .in('plan_status', ['ACTIVE', 'TRIAL', 'GRACE'])
    .eq('health_label', 'dead')
    .limit(50);

  // New tenants (< 3 days old) with 0 products — stuck onboarding
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const { data: stuckTenants } = await db.from('tenant_overview')
    .select('id, name, slug, owner_email, menu_item_count, created_at')
    .gte('created_at', threeDaysAgo)
    .eq('menu_item_count', 0)
    .in('plan_status', ['TRIAL', 'ACTIVE'])
    .limit(20);

  // Trial expiring today
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { data: expiringToday } = await db.from('tenants')
    .select('name, slug, owner_email, trial_ends_at')
    .eq('plan_status', 'TRIAL')
    .gte('trial_ends_at', today)
    .lt('trial_ends_at', tomorrow)
    .limit(20);

  if ((deadTenants?.length ?? 0) > 0) {
    alerts.push(`🔴 ${deadTenants!.length} dead tenants (active/trial with no recent orders)`);
  }
  if ((stuckTenants?.length ?? 0) > 0) {
    alerts.push(`⚠️ ${stuckTenants!.length} new tenants stuck (0 products after 3+ days)`);
  }
  if ((expiringToday?.length ?? 0) > 0) {
    alerts.push(`⏰ ${expiringToday!.length} trial(s) expiring today`);
  }

  if (alerts.length === 0) {
    return NextResponse.json({ ok: true, message: 'All clear', alerts: [] });
  }

  const deadRows = (deadTenants ?? []).map((t: Record<string,unknown>) =>
    `<tr><td style="padding:6px 10px">${t.name as string}</td><td style="padding:6px 10px;color:#94a3b8">/${t.slug as string}</td><td style="padding:6px 10px">${t.plan_status as string}</td><td style="padding:6px 10px;color:#94a3b8">${t.last_active_at ? new Date(t.last_active_at as string).toLocaleDateString() : 'never'}</td><td style="padding:6px 10px"><a href="https://www.tyg-services.com/superadmin/tenants/${t.slug as string}" style="color:#6366f1">View</a></td></tr>`
  ).join('');

  const stuckRows = (stuckTenants ?? []).map((t: Record<string,unknown>) =>
    `<tr><td style="padding:6px 10px">${t.name as string}</td><td style="padding:6px 10px;color:#94a3b8">/${t.slug as string}</td><td style="padding:6px 10px;color:#f59e0b">0 items</td><td style="padding:6px 10px"><a href="https://www.tyg-services.com/superadmin/tenants/${t.slug as string}" style="color:#6366f1">View</a></td></tr>`
  ).join('');

  const expRows = (expiringToday ?? []).map((t: Record<string,unknown>) =>
    `<tr><td style="padding:6px 10px">${t.name as string}</td><td style="padding:6px 10px">${t.owner_email as string}</td><td style="padding:6px 10px;color:#ef4444">Expires today</td><td style="padding:6px 10px"><a href="https://www.tyg-services.com/superadmin/tenants/${t.slug as string}" style="color:#6366f1">Convert</a></td></tr>`
  ).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
      <h2 style="color:#f8fafc;margin-bottom:8px">TYG POS — Daily Alerts 🚨</h2>
      <p style="color:#64748b;margin-bottom:24px">${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}</p>
      ${alerts.map(a => `<div style="padding:10px 14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;margin-bottom:8px;color:#fca5a5">${a}</div>`).join('')}
      ${deadRows ? `<h3 style="margin:24px 0 8px;color:#f59e0b">Dead Tenants</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1)"><th style="text-align:left;padding:6px 10px;color:#64748b">Name</th><th style="text-align:left;padding:6px 10px;color:#64748b">Slug</th><th style="text-align:left;padding:6px 10px;color:#64748b">Plan</th><th style="text-align:left;padding:6px 10px;color:#64748b">Last Active</th><th></th></tr></thead><tbody>${deadRows}</tbody></table>` : ''}
      ${stuckRows ? `<h3 style="margin:24px 0 8px;color:#f59e0b">Stuck Onboarding (0 products)</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1)"><th style="text-align:left;padding:6px 10px;color:#64748b">Name</th><th style="text-align:left;padding:6px 10px;color:#64748b">Slug</th><th style="text-align:left;padding:6px 10px;color:#64748b">Products</th><th></th></tr></thead><tbody>${stuckRows}</tbody></table>` : ''}
      ${expRows ? `<h3 style="margin:24px 0 8px;color:#ef4444">Trials Expiring Today</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1)"><th style="text-align:left;padding:6px 10px;color:#64748b">Name</th><th style="text-align:left;padding:6px 10px;color:#64748b">Email</th><th style="text-align:left;padding:6px 10px;color:#64748b">Status</th><th></th></tr></thead><tbody>${expRows}</tbody></table>` : ''}
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08)">
        <a href="https://www.tyg-services.com/superadmin" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">Open Superadmin →</a>
      </div>
    </div>`;

  const ok = await sendAdminAlert(`TYG POS Alerts — ${alerts.length} issue${alerts.length > 1 ? 's' : ''}`, html);

  await db.from('scheduled_jobs').update({
    last_run_at: new Date().toISOString(),
    status: ok ? 'ok' : 'email_failed',
    result: { alerts, dead: deadTenants?.length ?? 0, stuck: stuckTenants?.length ?? 0, expiring: expiringToday?.length ?? 0 },
  }).eq('job_name', 'dead_tenant_alerts');

  return NextResponse.json({ ok: true, alerts, sent: ok });
}
