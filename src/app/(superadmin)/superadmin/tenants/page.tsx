'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronRight, Users, ShoppingBag, TrendingUp } from 'lucide-react';

interface Tenant {
  id: string; name: string; slug: string; owner_email: string;
  plan_tier: string; plan_status: string; trial_ends_at: string | null;
  trial_days_left: number | null; created_at: string;
  order_count: number; staff_count: number; menu_item_count: number;
  total_revenue: number; last_order_at: string | null;
  health_label?: string; onboarding_completed_at?: string | null;
}

const PLAN_C: Record<string, { bg: string; color: string }> = {
  TRIAL:      { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  STARTER:    { bg: 'rgba(99,102,241,0.12)',   color: '#818cf8' },
  BUSINESS:   { bg: 'rgba(34,197,94,0.12)',    color: '#22c55e' },
  PRO:        { bg: 'rgba(168,85,247,0.12)',   color: '#c084fc' },
  ENTERPRISE: { bg: 'rgba(251,191,36,0.12)',   color: '#fbbf24' },
  SUSPENDED:  { bg: 'rgba(239,68,68,0.12)',    color: '#f87171' },
};
const HEALTH_C: Record<string, { color: string; emoji: string }> = {
  healthy: { color: '#22c55e', emoji: '🟢' },
  at_risk: { color: '#f59e0b', emoji: '🟡' },
  dead:    { color: '#64748b', emoji: '🔴' },
};
const fmt = (n: number) => '₱' + Math.round(n).toLocaleString();
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

export default function TenantsListPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterPlan, setFilterPlan] = useState('ALL');

  useEffect(() => {
    fetch('/api/superadmin/tenants')
      .then(r => { if (r.status === 401) { router.push('/superadmin/login'); return null; } return r.json(); })
      .then((d: { data?: Tenant[] } | null) => { if (d?.data) setTenants(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  const filtered = tenants.filter(t => {
    const matchSearch = !search || [t.name, t.slug, t.owner_email].some(v => v.toLowerCase().includes(search.toLowerCase()));
    const matchPlan = filterPlan === 'ALL' || t.plan_tier === filterPlan;
    return matchSearch && matchPlan;
  });

  const plans = ['ALL', ...Array.from(new Set(tenants.map(t => t.plan_tier)))];

  return (
    <div style={{ color: '#e2e8f0', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', marginBottom: 4 }}>Tenants</h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>{tenants.length} total businesses on the platform</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, slug, or email…"
            style={{ width: '100%', paddingLeft: 34, paddingRight: 14, height: 38, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#e2e8f0', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {plans.map(p => (
            <button key={p} onClick={() => setFilterPlan(p)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: filterPlan === p ? '#6366f1' : 'rgba(255,255,255,0.08)', background: filterPlan === p ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)', color: filterPlan === p ? '#818cf8' : '#64748b' }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>Loading tenants…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filtered.map(t => {
            const pc = PLAN_C[t.plan_status] ?? { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
            const hc = HEALTH_C[t.health_label ?? 'dead'] ?? { color: '#64748b', emoji: '🔴' };
            const trialDays = t.trial_ends_at ? daysUntil(t.trial_ends_at) : null;
            const onboardingDone = !!t.onboarding_completed_at;
            return (
              <div key={t.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#f8fafc', marginBottom: 2 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>/{t.slug}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{t.owner_email}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: pc.bg, color: pc.color }}>{t.plan_tier}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: hc.color }}>{hc.emoji} {(t.health_label ?? 'unknown').replace('_', ' ')}</span>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  {[
                    { icon: <ShoppingBag size={11} />, val: t.order_count, label: 'Orders' },
                    { icon: <Users size={11} />, val: t.staff_count, label: 'Staff' },
                    { icon: <TrendingUp size={11} />, val: t.menu_item_count, label: 'Items' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', flex: 1, textAlign: 'center' }}>
                      <div style={{ color: '#475569', marginBottom: 3 }}>{s.icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>{s.val}</div>
                      <div style={{ fontSize: 9, color: '#475569' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Revenue + trial */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>{fmt(t.total_revenue)}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {t.plan_status === 'TRIAL' && trialDays !== null && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: trialDays <= 3 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)', color: trialDays <= 3 ? '#f87171' : '#f59e0b' }}>
                        {trialDays <= 0 ? 'Expired' : `${trialDays}d trial`}
                      </span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: onboardingDone ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)', color: onboardingDone ? '#22c55e' : '#6366f1' }}>
                      {onboardingDone ? '✅ Onboarded' : '⏳ Setup pending'}
                    </span>
                  </div>
                </div>

                {/* Manage button */}
                <Link href={`/superadmin/tenants/${t.slug}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', textDecoration: 'none', fontSize: 13, fontWeight: 700, transition: 'all 0.12s' }}>
                  Tenant 360 View <ChevronRight size={13} />
                </Link>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#475569' }}>No tenants match your filter.</div>
          )}
        </div>
      )}
    </div>
  );
}
