'use client';
import React from 'react';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, ShoppingBag, TrendingUp, Users,
  Clock, ChevronRight, AlertTriangle, CheckCircle,
  ArrowUpRight
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  plan_tier: string;
  plan_status: string;
  trial_ends_at: string;
  created_at: string;
  order_count: number;
  staff_count: number;
  menu_item_count: number;
  total_revenue: number;
}

interface Totals {
  tenant_count: number;
  total_orders: number;
  total_revenue: number;
  active_trials: number;
  paying: number;
}

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  TRIAL:      { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  STARTER:    { bg: 'rgba(99,102,241,0.12)',   color: '#818cf8' },
  BUSINESS:   { bg: 'rgba(34,197,94,0.12)',    color: '#22c55e' },
  PRO:        { bg: 'rgba(168,85,247,0.12)',   color: '#c084fc' },
  ENTERPRISE: { bg: 'rgba(251,191,36,0.12)',   color: '#fbbf24' },
  SUSPENDED:  { bg: 'rgba(239,68,68,0.12)',    color: '#f87171' },
};

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function fmtMoney(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function PlanBadge({ tier }: { tier: string }) {
  const c = PLAN_COLORS[tier] ?? { bg: 'rgba(255,255,255,0.08)', color: 'white' };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: c.bg, color: c.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {tier}
    </span>
  );
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/superadmin/tenants')
      .then(r => {
        if (r.status === 401) { router.push('/superadmin/login'); return null; }
        return r.json();
      })
      .then((d: { data?: Tenant[]; totals?: Totals } | null) => {
        if (!d) return;
        setTenants(d.data ?? []);
        setTotals(d.totals ?? null);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const expiringTrials = tenants.filter(t => t.plan_status === 'TRIAL' && daysUntil(t.trial_ends_at) <= 5);

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:256 }}>
        <div style={{ width:32, height:32, borderRadius:"50%", borderWidth:2, borderStyle:"solid", animation:"spin 1s linear infinite" ,  borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Tenants',  value: totals?.tenant_count ?? 0, icon: Building2,   color: '#a78bfa', sub: `${totals?.active_trials ?? 0} on trial` },
    { label: 'Paying Tenants', value: totals?.paying ?? 0,        icon: CheckCircle,  color: '#22c55e', sub: 'Active subscriptions' },
    { label: 'Total Orders',   value: totals?.total_orders ?? 0,  icon: ShoppingBag,  color: '#38bdf8', sub: 'Across all tenants' },
    { label: 'Platform GMV',   value: fmtMoney(totals?.total_revenue ?? 0), icon: TrendingUp, color: '#f59e0b', sub: 'Gross merchandise value', isStr: true },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:32, maxWidth:1152 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Platform Overview</h1>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ borderRadius:20, padding:20, background: '#0f1520', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
              <div style={{ width:36, height:36, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", background: `${s.color}18` }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
            </div>
            <div style={{ color: 'white', fontSize: s.isStr ? 20 : 28, fontWeight: 800, marginBottom: 2 }}>
              {s.value}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{s.label}</div>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Expiring trials alert */}
      {expiringTrials.length > 0 && (
        <div style={{ borderRadius:20, padding:20 ,  background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <AlertTriangle size={15} style={{ color: '#f59e0b' }} />
            <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13 }}>Trials Expiring Soon</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {expiringTrials.map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginLeft: 8 }}>{t.owner_email}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ color: '#f87171', fontSize: 12, fontWeight: 600 }}>
                    {daysUntil(t.trial_ends_at) <= 0 ? 'Expired' : `${daysUntil(t.trial_ends_at)}d left`}
                  </span>
                  <Link href={`/superadmin/tenants/${t.slug}`} style={{ color: '#f59e0b', fontSize: 12, textDecoration: 'none' }}>
                    Manage →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tenant table */}
      <div style={{ borderRadius:20, overflow:"hidden" ,  background: '#0f1520', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px" ,  borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Building2 size={15} style={{ color: '#a78bfa' }} />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>All Tenants</span>
          </div>
          <Link href="/superadmin/tenants"
            style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, color: '#a78bfa', textDecoration: 'none' }}>
            View All <ArrowUpRight size={12} />
          </Link>
        </div>

        <div style={{ overflowX:"auto" }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Business', 'Plan', 'Trial / Expires', 'Orders', 'Revenue', 'Staff', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => {
                const days = daysUntil(t.trial_ends_at);
                return (
                  <tr key={t.id} style={{ borderBottom: i < tenants.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{t.slug} · {t.owner_email}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <PlanBadge tier={t.plan_tier} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {t.plan_status === 'TRIAL' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={11} style={{ color: days <= 3 ? '#f87171' : days <= 7 ? '#f59e0b' : 'rgba(255,255,255,0.4)' }} />
                          <span style={{ fontSize: 12, color: days <= 3 ? '#f87171' : days <= 7 ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>
                            {days <= 0 ? 'Expired' : `${days}d left`}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#22c55e' }}>Active</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      {t.order_count}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
                      {fmtMoney(t.total_revenue)}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <Users size={11} />
                        {t.staff_count}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Link href={`/superadmin/tenants/${t.slug}`}
                        style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, padding:"6px 12px", borderRadius:8, background: 'rgba(124,58,237,0.1)', color: '#a78bfa', textDecoration: 'none', border: '1px solid rgba(124,58,237,0.2)', whiteSpace: 'nowrap' }}>
                        Manage <ChevronRight size={11} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
