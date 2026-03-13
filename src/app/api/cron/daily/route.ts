export const dynamic = 'force-dynamic';

// ============================================================
// TYG POS — GET /api/cron/daily
// Vercel Cron: runs at midnight Asia/Manila (UTC+8 = 16:00 UTC)
// Schedule in vercel.json: "0 16 * * *"
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

// Vercel Cron auth — prevents unauthorized external triggers
function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();
  const results: Record<string, unknown> = {};

  // ── 1. Refresh materialized views ─────────────────────────
  try {
    await db.rpc('refresh_analytics_views');
    results['analytics_refresh'] = 'ok';
  } catch (err) {
    results['analytics_refresh'] = `error: ${String(err)}`;
    console.error('Analytics refresh failed:', err);
  }

  // ── 2. Expire trials ──────────────────────────────────────
  // Tenants whose trial ended → mark as TRIAL status blocked
  try {
    const { data: expiredTrials } = await db
      .from('tenants')
      .select('id, name, owner_email, trial_ends_at')
      .eq('plan_status', 'TRIAL')
      .lt('trial_ends_at', new Date().toISOString());

    if (expiredTrials && expiredTrials.length > 0) {
      for (const tenant of expiredTrials) {
        // Update plan_status → SUSPENDED
        await db.from('tenants')
          .update({ plan_status: 'SUSPENDED', updated_at: new Date().toISOString() })
          .eq('id', tenant.id);
        // Send trial expiry email
        await sendTrialExpiredEmail(tenant.owner_email as string, tenant.name as string);
      }
      results['trials_expired'] = expiredTrials.length;
    } else {
      results['trials_expired'] = 0;
    }

    // ── 2b. Trial reminder emails (3 days before expiry) ──
    const reminderWindow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: soonExpiring } = await db
      .from('tenants')
      .select('id, name, owner_email, trial_ends_at')
      .eq('plan_status', 'TRIAL')
      .gt('trial_ends_at', new Date().toISOString())
      .lt('trial_ends_at', reminderWindow);
    if (soonExpiring && soonExpiring.length > 0) {
      for (const tenant of soonExpiring) {
        const daysLeft = Math.ceil((new Date(tenant.trial_ends_at as string).getTime() - Date.now()) / 86400000);
        await sendTrialReminderEmail(tenant.owner_email as string, tenant.name as string, daysLeft);
      }
      results['trial_reminders_sent'] = soonExpiring.length;
    }
  } catch (err) {
    results['trial_expiry'] = `error: ${String(err)}`;
  }

  // ── 3. Grace period to SUSPENDED ─────────────────────────
  // Tenants in GRACE whose plan_period_end passed 3+ days ago
  try {
    const graceDeadline = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from('tenants')
      .update({ plan_status: 'SUSPENDED' })
      .eq('plan_status', 'GRACE')
      .lt('plan_period_end', graceDeadline);
    results['grace_to_suspended'] = count ?? 0;
  } catch (err) {
    results['grace_suspend'] = `error: ${String(err)}`;
  }

  // ── 4. Cleanup expired staff sessions ────────────────────
  try {
    const { count } = await db
      .from('staff_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());
    results['sessions_cleaned'] = count ?? 0;
  } catch (err) {
    results['session_cleanup'] = `error: ${String(err)}`;
  }

  console.log('Daily cron completed:', results);
  return NextResponse.json({ ok: true, results, timestamp: new Date().toISOString() });
}

async function sendTrialReminderEmail(email: string, businessName: string, daysLeft: number): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: `Your TYG POS trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — ${businessName}`,
    html: `
      <h2>Your free trial is ending soon</h2>
      <p>Hi! Your TYG POS trial for <strong>${businessName}</strong> ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
      <p>Upgrade now to keep your QR ordering, Kitchen Display, and analytics running without interruption.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/billing" style="
        background:#16a34a;color:white;padding:12px 24px;
        border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px
      ">
        Upgrade Now — Starting at ₱599/mo
      </a>
      <p style="color:#666;font-size:12px;margin-top:24px">TYG POS — Built for Philippine F&amp;B businesses</p>
    `,
  });
}

async function sendTrialExpiredEmail(email: string, businessName: string): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: `Your TYG POS trial for ${businessName} has ended`,
    html: `
      <h2>Your 14-day free trial has ended</h2>
      <p>Hi there! Your trial for <strong>${businessName}</strong> on TYG POS has expired.</p>
      <p>Your menu and order history are safe — just upgrade to keep your café running smoothly.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/billing" style="
        background:#16a34a;color:white;padding:12px 24px;
        border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px
      ">
        Upgrade Now — Starting at ₱599/mo
      </a>
      <p style="color:#666;font-size:12px;margin-top:24px">
        TYG POS — Built for Philippine F&B businesses
      </p>
    `,
  });
}
