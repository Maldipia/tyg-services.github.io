export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { discoveryRateLimit } from '@/lib/redis/ratelimit';
import { getClientIp } from '@/lib/auth/middleware';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}
function cap(v: unknown, max=300): string { return String(v ?? '').trim().slice(0, max); }
function arr(v: unknown, maxItems=12, maxEach=150): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, maxItems).map((x: unknown) => cap(x, maxEach)).filter(Boolean);
}

// ─── internal risk scoring ──────────────────────────────────────────────────
function scoreSubmission(d: Record<string, unknown>) {
  let score = 0;
  const flags: string[] = [];

  const feats = Array.isArray(d.features_needed) ? d.features_needed.length : 0;
  const ints  = Array.isArray(d.integrations_needed) ? d.integrations_needed.length : 0;
  score += feats * 6;
  score += ints * 8;

  const loc = String(d.location_count ?? '');
  if (loc.includes('4') || loc.includes('10+')) { score += 20; flags.push('multi_location'); }

  const mig = String(d.has_migration ?? '');
  if (mig.includes('large')) { score += 25; flags.push('complex_migration'); }
  else if (mig.includes('small')) score += 10;

  const tl = String(d.timeline ?? '');
  if (tl.includes('2 weeks')) { score += 30; flags.push('rush_timeline'); }
  else if (tl.includes('1 month')) score += 12;

  const dm = String(d.decision_maker ?? '');
  if (dm.includes('Committee') || dm.includes('board')) { score += 15; flags.push('committee_approval'); }

  const pl = String(d.post_launch ?? '');
  if (pl.includes('myself')) { score += 8; flags.push('self_managed_risk'); }
  if (pl.includes('Not sure')) { score += 5; }

  const br = String(d.has_branding ?? '');
  if (br.includes('No')) { score += 10; flags.push('no_branding'); }

  const dev = String(d.dev_experience ?? '');
  if (dev.includes('first time')) { score += 10; flags.push('first_time_client'); }
  if (dev.includes('bad experience')) { score += 15; flags.push('past_bad_exp'); }

  const budget = String(d.budget_range ?? '');
  const budgetNum = budget.includes('Under') ? 1 : budget.includes('15,000–30') ? 2 : budget.includes('30,000–80') ? 3 : budget.includes('80,000–200') ? 4 : budget.includes('200,000+') ? 5 : 0;
  if (score > 60 && budgetNum <= 2) { flags.push('budget_mismatch'); }
  if (score > 90 && budgetNum <= 3) { flags.push('budget_mismatch'); }

  const tier = score <= 30 ? 'Starter' : score <= 60 ? 'Growth' : score <= 90 ? 'Pro' : 'Enterprise';
  const budgetFit = budgetNum === 0 ? 'unknown' : (score > 60 && budgetNum <= 2) || (score > 90 && budgetNum <= 3) ? 'under' : budgetNum >= 4 ? 'healthy' : 'match';

  return { complexity_score: score, risk_flags: flags, estimated_tier: tier, budget_fit: budgetFit };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { success: ok } = await discoveryRateLimit.limit(ip);
  if (!ok) return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });

  try {
    const body = await req.json();

    const system_type      = cap(body.system_type, 50);
    const business_name    = cap(body.business_name, 200);
    const location         = cap(body.location, 200);
    const years_operating  = cap(body.years_operating, 50);
    const contact_name     = cap(body.contact_name, 150);
    const contact_email    = cap(body.contact_email, 200).toLowerCase();
    const contact_phone    = cap(body.contact_phone, 30);
    const best_time_to_call = cap(body.best_time_to_call, 100);
    const notes            = cap(body.notes, 2000);
    const budget_range     = cap(body.budget_range, 100);
    const timeline         = cap(body.timeline, 100);
    const features_needed  = arr(body.features_needed);
    const integrations_needed = arr(body.integrations_needed);
    const pain_points      = features_needed; // reuse column

    // extra fields stored in metadata JSONB
    const metadata = {
      team_size:       cap(body.team_size, 50),
      current_system:  cap(body.current_system, 300),
      pain_point:      cap(body.pain_point, 1000),
      user_count:      cap(body.user_count, 50),
      location_count:  cap(body.location_count, 20),
      has_migration:   cap(body.has_migration, 100),
      decision_maker:  cap(body.decision_maker, 100),
      post_launch_plan:cap(body.post_launch_plan, 100),
      has_branding:    cap(body.has_branding, 100),
      dev_experience:  cap(body.dev_experience, 100),
      integrations_needed,
    };

    if (!business_name || !contact_name || !contact_phone)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    if (!contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });

    const scoring = scoreSubmission({ ...body, budget_range });

    const { data, error } = await supabase.from('discovery_responses').insert({
      business_name, business_type: system_type, location,
      years_operating, contact_name, contact_email, contact_phone,
      best_time_to_call, notes, budget_range, timeline,
      pain_points, primary_goal: cap(body.primary_goal, 200),
      current_ordering: cap(body.current_ordering, 150),
      monthly_transaction_volume: cap(body.monthly_transaction_volume, 100),
      status: 'new',
      // scoring fields
      internal_assessment: JSON.stringify({ scoring, metadata }),
    }).select('id').single();

    if (error) { console.error('[discovery]', error); return NextResponse.json({ error: 'Failed to save' }, { status: 500 }); }

    // email notification
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const NOTIFY = process.env.NOTIFY_EMAIL || 'pia@tyg-services.com';
    if (RESEND_KEY) {
      const tierColor = scoring.estimated_tier === 'Starter' ? '#3b82f6' : scoring.estimated_tier === 'Growth' ? '#f59e0b' : scoring.estimated_tier === 'Pro' ? '#8b5cf6' : '#ef4444';
      const html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
        <div style="background:#16a34a;padding:20px 28px;color:#fff">
          <strong style="font-size:18px">🆕 ${esc(business_name)}</strong>
          <div style="font-size:13px;margin-top:4px;opacity:0.85">${esc(system_type)} · ${esc(location)}</div>
        </div>
        <div style="padding:24px 28px;background:#fff">
          <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
            <span style="background:${tierColor}22;color:${tierColor};border-radius:99px;padding:4px 12px;font-size:12px;font-weight:700">${scoring.estimated_tier}</span>
            <span style="background:#f1f5f9;color:#475569;border-radius:99px;padding:4px 12px;font-size:12px">Score: ${scoring.complexity_score}</span>
            <span style="background:${scoring.budget_fit==='under'?'#fef2f2':'#f0fdf4'};color:${scoring.budget_fit==='under'?'#dc2626':'#16a34a'};border-radius:99px;padding:4px 12px;font-size:12px">Budget: ${esc(scoring.budget_fit)}</span>
            ${scoring.risk_flags.map(f=>`<span style="background:#fef3c7;color:#92400e;border-radius:99px;padding:4px 10px;font-size:11px">⚠ ${esc(f)}</span>`).join('')}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            ${[
              ['Budget', budget_range], ['Timeline', timeline],
              ['Features', features_needed.join(', ')], ['Integrations', integrations_needed.join(', ')],
              ['Contact', contact_name], ['Email', contact_email], ['Phone', contact_phone],
              ['Best Time', best_time_to_call], ['Decision Maker', metadata.decision_maker],
              ['Post-Launch', metadata.post_launch_plan], ['Branding', metadata.has_branding],
              ['Dev Experience', metadata.dev_experience], ['Migration', metadata.has_migration],
            ].map(([k,v])=>`<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:7px 0;color:#64748b;width:140px;font-weight:600">${esc(k)}</td><td style="padding:7px 0;color:#0f172a">${esc(v)||'—'}</td></tr>`).join('')}
          </table>
          ${metadata.pain_point ? `<div style="margin-top:14px;background:#f8fafc;border-radius:9px;padding:12px;font-size:13px;color:#475569;border-left:3px solid #16a34a"><strong style="color:#0f172a">Pain point:</strong> ${esc(metadata.pain_point)}</div>` : ''}
          ${notes ? `<div style="margin-top:10px;background:#f8fafc;border-radius:9px;padding:12px;font-size:13px;color:#475569"><strong style="color:#0f172a">Notes:</strong> ${esc(notes)}</div>` : ''}
          <div style="margin-top:16px;text-align:center"><a href="${esc(process.env.NEXT_PUBLIC_SITE_URL||'https://www.tyg-services.com')}/superadmin/discovery" style="display:inline-block;background:#16a34a;color:#fff;border-radius:9px;padding:10px 22px;text-decoration:none;font-weight:700;font-size:14px">View in Admin →</a></div>
        </div>
      </div>`;

      await fetch('https://api.resend.com/emails', {
        method:'POST',
        headers:{ 'Authorization':`Bearer ${RESEND_KEY}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ from:'TYG Services <hello@tyg-services.com>', to:[NOTIFY], subject:`🆕 ${scoring.estimated_tier} lead: ${business_name} (${system_type})`, html }),
      }).catch(e => console.error('[discovery] Resend:', e));
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (e) {
    console.error('[discovery] error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
