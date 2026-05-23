export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { discoveryRateLimit } from '@/lib/redis/ratelimit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Field length caps ────────────────────────────────────────────────────────
const CAP = (s: unknown, max: number): string =>
  String(s ?? '').trim().slice(0, max);

// ── HTML-escape user content before inserting into email ─────────────────────
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

// ── Valid status values (mirrors DB CHECK constraint) ────────────────────────
const VALID_STATUS = new Set(['new', 'contacted', 'qualified', 'converted', 'not_a_fit']);

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit: 3 submissions / IP / hour ──────────────────────────────
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
             ?? req.headers.get('x-real-ip')
             ?? 'unknown';
    const rl = await discoveryRateLimit.limit(ip);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();

    // ── Sanitised + capped fields ──────────────────────────────────────────
    const business_name              = CAP(body.business_name, 200);
    const business_type              = CAP(body.business_type, 100);
    const branch_count               = CAP(body.branch_count, 20);
    const location                   = CAP(body.location, 200);
    const years_operating            = CAP(body.years_operating, 50);
    const current_pos                = CAP(body.current_pos, 200);
    const current_ordering           = CAP(body.current_ordering, 200);
    const primary_goal               = CAP(body.primary_goal, 300);
    const monthly_transaction_volume = CAP(body.monthly_transaction_volume, 100);
    const budget_range               = CAP(body.budget_range, 100);
    const timeline                   = CAP(body.timeline, 100);
    const contact_name               = CAP(body.contact_name, 150);
    const contact_email              = CAP(body.contact_email, 200).toLowerCase();
    const contact_phone              = CAP(body.contact_phone, 30);
    const best_time_to_call          = CAP(body.best_time_to_call, 100);
    const notes                      = CAP(body.notes, 2000);

    // pain_points: array, max 8 items, each max 100 chars, strings only
    const pain_points: string[] = Array.isArray(body.pain_points)
      ? body.pain_points.slice(0, 8).map((p: unknown) => CAP(p, 100)).filter(Boolean)
      : [];

    // Required fields
    if (!business_name || !contact_email || !contact_name || !contact_phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // ── Save to Supabase ───────────────────────────────────────────────────
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

    // ── Email notification via Resend (silent fail) ────────────────────────
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const NOTIFY     = process.env.NOTIFY_EMAIL ?? 'pia@tyg-services.com';

    if (RESEND_KEY) {
      const row = (k: string, v: string) => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
          <td style="padding:8px 0;color:#6b7280;width:160px;font-weight:600;vertical-align:top">${esc(k)}</td>
          <td style="padding:8px 0;color:#e8eaf0">${esc(v) || '—'}</td>
        </tr>`;

      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0f1117;color:#e8eaf0;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
          <div style="background:#161b27;padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.07)">
            <span style="display:inline-block;background:#22c55e;width:36px;height:36px;border-radius:8px;text-align:center;line-height:36px;font-weight:900;color:#000;margin-right:10px;vertical-align:middle">T</span>
            <strong style="font-size:18px;vertical-align:middle">New Discovery Form Submission</strong>
          </div>
          <div style="padding:28px 32px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              ${row('Business', business_name)}
              ${row('Type', business_type)}
              ${row('Location', location)}
              ${row('Branches', branch_count)}
              ${row('Years', years_operating)}
              ${row('Contact', contact_name)}
              ${row('Email', contact_email)}
              ${row('Phone', contact_phone)}
              ${row('Best Time', best_time_to_call)}
              ${row('Current POS', current_pos)}
              ${row('Current Ordering', current_ordering)}
              ${row('Pain Points', pain_points.join(', '))}
              ${row('Primary Goal', primary_goal)}
              ${row('Volume', monthly_transaction_volume)}
              ${row('Budget', budget_range)}
              ${row('Timeline', timeline)}
            </table>
            ${notes ? `
              <div style="margin-top:16px;padding:12px 16px;background:#1e2535;border-radius:10px;border-left:3px solid #22c55e;font-size:13px;color:#e8eaf0;line-height:1.6">
                <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Notes</div>
                ${esc(notes)}
              </div>` : ''}
            <div style="margin-top:20px;padding:14px;background:#1e2535;border-radius:10px;border:1px solid rgba(34,197,94,0.2);font-size:12px;color:#6b7280">
              ID: <strong style="color:#e8eaf0">${data?.id ?? 'N/A'}</strong> &nbsp;·&nbsp;
              ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
            </div>
            <div style="margin-top:18px;text-align:center">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.tyg-services.com'}/superadmin/discovery"
                style="display:inline-block;background:#22c55e;color:#000;border-radius:10px;padding:10px 24px;text-decoration:none;font-weight:700;font-size:14px">
                View in Admin →
              </a>
            </div>
          </div>
        </div>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
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
