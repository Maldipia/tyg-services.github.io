export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { discoveryRateLimit } from '@/lib/redis/ratelimit';
import { getClientIp } from '@/lib/auth/middleware';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// HTML-escape user content before inserting into email HTML
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Sanitise a string field: trim, cast, cap length
function str(v: unknown, max = 300): string {
  return String(v ?? '').trim().slice(0, max);
}

const VALID_STATUS = ['new', 'contacted', 'qualified', 'converted', 'not_a_fit'] as const;

export async function POST(req: NextRequest) {
  // ── Rate limit: 3 submissions / IP / hour ──────────────────────────────
  const ip = getClientIp(req);
  const { success: ok } = await discoveryRateLimit.limit(ip);
  if (!ok) {
    return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });
  }

  try {
    const body = await req.json();

    const business_name  = str(body.business_name, 200);
    const business_type  = str(body.business_type, 100);
    const branch_count   = str(body.branch_count, 20);
    const location       = str(body.location, 200);
    const years_operating = str(body.years_operating, 50);
    const current_pos    = str(body.current_pos, 150);
    const current_ordering = str(body.current_ordering, 150);
    const primary_goal   = str(body.primary_goal, 200);
    const monthly_transaction_volume = str(body.monthly_transaction_volume, 100);
    const budget_range   = str(body.budget_range, 100);
    const timeline       = str(body.timeline, 100);
    const contact_name   = str(body.contact_name, 150);
    const contact_email  = str(body.contact_email, 200).toLowerCase();
    const contact_phone  = str(body.contact_phone, 30);
    const best_time_to_call = str(body.best_time_to_call, 100);
    const notes          = str(body.notes, 2000);

    // pain_points: array, capped at 10 items, each string capped at 100 chars
    const raw_pain = Array.isArray(body.pain_points) ? body.pain_points : [];
    const pain_points = raw_pain.slice(0, 10).map((p: unknown) => str(p, 100)).filter(Boolean);

    // Required field validation
    if (!business_name) return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
    if (!contact_name)  return NextResponse.json({ error: 'Contact name is required' }, { status: 400 });
    if (!contact_phone) return NextResponse.json({ error: 'Contact phone is required' }, { status: 400 });
    if (!contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // ── Save to Supabase ──────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('discovery_responses')
      .insert({
        business_name, business_type, branch_count, location, years_operating,
        current_pos, current_ordering, pain_points,
        primary_goal, monthly_transaction_volume, budget_range, timeline,
        contact_name, contact_email, contact_phone, best_time_to_call, notes,
        status: 'new',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[discovery] Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
    }

    // ── Email notification via Resend (silent fail) ───────────────────────
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const NOTIFY = process.env.NOTIFY_EMAIL || 'pia@tyg-services.com';

    if (RESEND_KEY) {
      const rows = [
        ['Business', business_name],
        ['Type', business_type],
        ['Location', location],
        ['Branches', branch_count],
        ['Years Operating', years_operating],
        ['Contact', contact_name],
        ['Email', contact_email],
        ['Phone', contact_phone],
        ['Best Time', best_time_to_call],
        ['Current POS', current_pos],
        ['Current Ordering', current_ordering],
        ['Pain Points', pain_points.join(', ')],
        ['Primary Goal', primary_goal],
        ['Volume', monthly_transaction_volume],
        ['Budget', budget_range],
        ['Timeline', timeline],
      ];

      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0f1117;color:#e8eaf0;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
          <div style="background:#161b27;padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.07)">
            <strong style="font-size:18px">🆕 New Discovery Form: ${esc(business_name)}</strong>
          </div>
          <div style="padding:28px 32px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              ${rows.map(([k, v]) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                  <td style="padding:8px 0;color:#6b7280;width:160px;font-weight:600">${esc(k)}</td>
                  <td style="padding:8px 0;color:#e8eaf0">${esc(v) || '—'}</td>
                </tr>`).join('')}
              ${notes ? `
                <tr><td colspan="2" style="padding:12px 0 4px;color:#6b7280;font-weight:600;font-size:12px">NOTES</td></tr>
                <tr><td colspan="2" style="padding:0 0 8px;color:#e8eaf0;line-height:1.6">${esc(notes)}</td></tr>` : ''}
            </table>
            <div style="margin-top:20px;padding:14px;background:#1e2535;border-radius:10px;font-size:12px;color:#6b7280">
              ID: <strong style="color:#e8eaf0">${esc(data?.id)}</strong> &nbsp;·&nbsp;
              ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
            </div>
            <div style="margin-top:16px;text-align:center">
              <a href="${esc(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tyg-services.com')}/superadmin/discovery"
                style="display:inline-block;background:#22c55e;color:#000;border-radius:10px;padding:10px 24px;text-decoration:none;font-weight:700;font-size:14px">
                View in Admin →
              </a>
            </div>
          </div>
        </div>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'TYG POS <hello@tyg-services.com>',
          to: [NOTIFY],
          subject: `🆕 Discovery: ${business_name} — ${budget_range}`,
          html,
        }),
      }).catch(err => console.error('[discovery] Resend error:', err));
    }

    return NextResponse.json({ success: true, id: data?.id });

  } catch (err) {
    console.error('[discovery] Unhandled error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
