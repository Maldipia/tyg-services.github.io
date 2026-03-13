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

  // ── 5. Daily sales report email to active tenant owners ──
  try {
    // "Yesterday" in Asia/Manila (UTC+8)
    const now = new Date();
    // Manila midnight = UTC 16:00 previous day
    const manilaNow = new Date(now.getTime() + 8 * 3600 * 1000);
    const yesterdayManila = new Date(manilaNow);
    yesterdayManila.setUTCDate(yesterdayManila.getUTCDate() - 1);
    const dayLabel = yesterdayManila.toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila'
    });
    // UTC range for "yesterday Manila" = UTC 16:00 two days ago → UTC 16:00 yesterday
    const rangeStart = new Date(yesterdayManila);
    rangeStart.setUTCHours(16, 0, 0, 0);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

    // Get all non-suspended tenants
    const { data: activeTenants } = await db
      .from('tenants')
      .select('id, name, slug, owner_email')
      .not('plan_status', 'eq', 'SUSPENDED')
      .not('owner_email', 'is', null);

    let reportsSent = 0;
    for (const tenant of (activeTenants ?? [])) {
      try {
        // Orders for this tenant yesterday
        const { data: orders } = await db
          .from('orders')
          .select('id, status, payment_status, total_amount')
          .eq('tenant_id', tenant.id)
          .eq('is_test', false)
          .gte('created_at', rangeStart.toISOString())
          .lt('created_at', rangeEnd.toISOString());

        const allOrders = orders ?? [];
        const completed = allOrders.filter(o => o.status === 'COMPLETED');
        const cancelled = allOrders.filter(o => o.status === 'CANCELLED');
        const revenue = completed.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);

        // Top items — get order_items for completed orders
        const completedIds = completed.map(o => o.id);
        let topItems: { name: string; qty: number }[] = [];
        if (completedIds.length > 0) {
          const { data: itemRows } = await db
            .from('order_items')
            .select('quantity, menu_items(name)')
            .in('order_id', completedIds);

          const tally: Record<string, number> = {};
          for (const row of (itemRows ?? []) as unknown as Array<{ quantity: number; menu_items: { name: string } | null }>) {
            const n = row.menu_items?.name ?? 'Unknown';
            tally[n] = (tally[n] ?? 0) + row.quantity;
          }
          topItems = Object.entries(tally)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, qty]) => ({ name, qty }));
        }

        // Compose and send email
        await sendDailyReport({
          email: tenant.owner_email as string,
          businessName: tenant.name as string,
          slug: tenant.slug as string,
          dayLabel,
          totalOrders: allOrders.length,
          completedOrders: completed.length,
          cancelledOrders: cancelled.length,
          revenue,
          topItems,
        });
        reportsSent++;
      } catch (tenantErr) {
        console.error(`Daily report failed for tenant ${tenant.slug}:`, tenantErr);
      }
    }
    results['daily_reports_sent'] = reportsSent;
  } catch (err) {
    results['daily_reports'] = `error: ${String(err)}`;
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
interface DailyReportArgs {
  email: string;
  businessName: string;
  slug: string;
  dayLabel: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
  topItems: { name: string; qty: number }[];
}

async function sendDailyReport(args: DailyReportArgs): Promise<void> {
  const { email, businessName, slug, dayLabel, totalOrders, completedOrders, cancelledOrders, revenue, topItems } = args;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.tyg-services.com';
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const noActivity = totalOrders === 0;

  const topItemsHtml = topItems.length > 0
    ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">
        <tr style="border-bottom:1px solid #e5e7eb">
          <th style="text-align:left;padding:6px 0;font-size:13px;color:#6b7280;font-weight:500">Item</th>
          <th style="text-align:right;padding:6px 0;font-size:13px;color:#6b7280;font-weight:500">Qty Sold</th>
        </tr>
        ${topItems.map(item => `
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 0;font-size:14px;color:#111827">${item.name}</td>
            <td style="padding:8px 0;font-size:14px;color:#111827;text-align:right;font-weight:600">${item.qty}</td>
          </tr>
        `).join('')}
      </table>`
    : '<p style="color:#9ca3af;font-size:14px;margin:8px 0 0">No completed orders yesterday.</p>';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#16a34a;padding:24px 32px;text-align:center">
      <div style="font-size:28px;margin-bottom:4px">📊</div>
      <h1 style="color:white;margin:0;font-size:20px;font-weight:700">Daily Sales Report</h1>
      <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:14px">${businessName} · ${dayLabel}</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">

      ${noActivity ? `
        <div style="text-align:center;padding:24px 0">
          <div style="font-size:40px;margin-bottom:8px">😴</div>
          <p style="color:#6b7280;font-size:15px;margin:0">No orders yesterday. Rest day or soft open?</p>
        </div>
      ` : `
        <!-- KPIs -->
        <div style="display:flex;gap:12px;margin-bottom:24px">
          <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:26px;font-weight:800;color:#16a34a">₱${revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            <div style="font-size:12px;color:#15803d;font-weight:600;margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Revenue</div>
          </div>
          <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:26px;font-weight:800;color:#2563eb">${completedOrders}</div>
            <div style="font-size:12px;color:#1d4ed8;font-weight:600;margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Completed</div>
          </div>
          <div style="flex:1;background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:26px;font-weight:800;color:#374151">${totalOrders}</div>
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-top:2px;text-transform:uppercase;letter-spacing:.05em">Total Orders</div>
          </div>
        </div>

        ${cancelledOrders > 0 ? `<p style="font-size:13px;color:#ef4444;margin:-12px 0 20px">⚠ ${cancelledOrders} order${cancelledOrders > 1 ? 's' : ''} cancelled yesterday</p>` : ''}

        <!-- Top Items -->
        <div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:24px">
          <h3 style="margin:0 0 4px;font-size:15px;color:#111827;font-weight:700">🏆 Top Selling Items</h3>
          ${topItemsHtml}
        </div>
      `}

      <!-- CTA -->
      <div style="text-align:center;margin-top:8px">
        <a href="${appUrl}/admin/analytics?tenant=${slug}" style="display:inline-block;background:#16a34a;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          View Full Analytics →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f3f4f6;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af">TYG POS · Built for Philippine F&amp;B businesses</p>
      <p style="margin:4px 0 0;font-size:12px;color:#d1d5db">You're receiving this because you're the owner of ${businessName} on TYG POS.</p>
    </div>

  </div>
</body>
</html>`;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: noActivity
      ? `📊 ${businessName} — No orders yesterday`
      : `📊 ${businessName} — ₱${revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })} revenue yesterday`,
    html,
  });
}
