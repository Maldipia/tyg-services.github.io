import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      business_name, business_type, branch_count, location, years_operating,
      current_pos, current_ordering, pain_points,
      primary_goal, monthly_transaction_volume, budget_range, timeline,
      contact_name, contact_email, contact_phone, best_time_to_call, notes,
    } = body;

    // Basic validation
    if (!business_name || !contact_email || !contact_name || !contact_phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Save to Supabase ────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('discovery_responses')
      .insert({
        business_name: String(business_name).trim(),
        business_type: String(business_type || ''),
        branch_count: String(branch_count || '1'),
        location: String(location || '').trim(),
        years_operating: String(years_operating || ''),
        current_pos: String(current_pos || ''),
        current_ordering: String(current_ordering || ''),
        pain_points: Array.isArray(pain_points) ? pain_points : [],
        primary_goal: String(primary_goal || ''),
        monthly_transaction_volume: String(monthly_transaction_volume || ''),
        budget_range: String(budget_range || ''),
        timeline: String(timeline || ''),
        contact_name: String(contact_name).trim(),
        contact_email: String(contact_email).trim().toLowerCase(),
        contact_phone: String(contact_phone).trim(),
        best_time_to_call: String(best_time_to_call || ''),
        notes: String(notes || '').trim(),
        status: 'new',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[discovery] Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
    }

    // ── Email notification via Resend (silent fail) ─────────────────────────
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const NOTIFY = process.env.NOTIFY_EMAIL || 'pia@tygservices.com';

    if (RESEND_KEY) {
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0f1117;color:#e8eaf0;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
          <div style="background:#161b27;padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.07)">
            <div style="display:inline-block;background:#22c55e;width:36px;height:36px;border-radius:8px;text-align:center;line-height:36px;font-weight:900;color:#000;margin-right:10px">T</div>
            <strong style="font-size:18px">New Discovery Form Submission</strong>
          </div>
          <div style="padding:28px 32px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              ${[
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
                ['Pain Points', Array.isArray(pain_points) ? pain_points.join(', ') : ''],
                ['Primary Goal', primary_goal],
                ['Volume', monthly_transaction_volume],
                ['Budget', budget_range],
                ['Timeline', timeline],
              ].map(([k, v]) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                  <td style="padding:8px 0;color:#6b7280;width:160px;font-weight:600">${k}</td>
                  <td style="padding:8px 0;color:#e8eaf0">${v || '—'}</td>
                </tr>
              `).join('')}
              ${notes ? `
                <tr>
                  <td style="padding:12px 0 4px;color:#6b7280;font-weight:600" colspan="2">Notes</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:0 0 8px;color:#e8eaf0;line-height:1.6">${notes}</td>
                </tr>
              ` : ''}
            </table>
            <div style="margin-top:24px;padding:16px;background:#1e2535;border-radius:12px;border:1px solid rgba(34,197,94,0.2);font-size:13px;color:#6b7280">
              Response ID: <strong style="color:#e8eaf0">${data?.id || 'N/A'}</strong><br/>
              Submitted: <strong style="color:#e8eaf0">${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</strong>
            </div>
            <div style="margin-top:20px;text-align:center">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tyg-services.com'}/superadmin/discovery"
                style="display:inline-block;background:#22c55e;color:#000;border-radius:10px;padding:10px 24px;text-decoration:none;font-weight:700;font-size:14px">
                View in Admin →
              </a>
            </div>
          </div>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'TYG POS <hello@tyg-services.com>',
          to: [NOTIFY],
          subject: `🆕 Discovery Form: ${business_name} — ${budget_range}`,
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
