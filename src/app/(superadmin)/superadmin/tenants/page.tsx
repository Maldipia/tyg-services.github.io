'use client';
import React from 'react';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Search, ChevronRight, Clock, Users, ShoppingBag } from 'lucide-react';

interface Tenant {
  id: string; name: string; slug: string; owner_email: string;
  plan_tier: string; plan_status: string; trial_ends_at: string;
  created_at: string; order_count: number; staff_count: number;
  menu_item_count: number; total_revenue: number;
}

const PLAN_C: Record<string, { bg: string; color: string }> = {
  TRIAL:      { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  STARTER:    { bg: 'rgba(99,102,241,0.12)',   color: '#818cf8' },
  BUSINESS:   { bg: 'rgba(34,197,94,0.12)',    color: '#22c55e' },
  PRO:        { bg: 'rgba(168,85,247,0.12)',   color: '#c084fc' },
  ENTERPRISE: { bg: 'rgba(251,191,36,0.12)',   color: '#fbbf24' },
  SUSPENDED:  { bg: 'rgba(239,68,68,0.12)',    color: '#f87171' },
};

function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }
function fmtMoney(n: number) { return '₱' + n.toLocaleString('en-PH', { maximumFractionDigits: 0 }); }

export default function TenantsListPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('ALL');

  useEffect(() => {
    fetch('/api/superadmin/tenants')
      .then(r => {
        if (r.status === 401) { router.push('/superadmin/login'); return null; }
        return r.json();
      })
      .then((d: { data?: Tenant[] } | null) => { if (d) setTenants(d.data ?? []); })
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = tenants.filter(t => {
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      t.owner_email.toLowerCase().includes(search.toLowerCase());
    const matchPlan = filterPlan === 'ALL' || t.plan_tier === filterPlan;
    return matchSearch && matchPlan;
  });

  const plans = ['ALL', ...Array.from(new Set(tenants.map(t => t.plan_tier)))];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24, maxWidth:1152 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Tenants</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>{tenants.length} total businesses on the platform</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, slug, or email..."
            style={{
              width: '100%', paddingLeft: 34, paddingRight: 14, paddingTop: 10, paddingBottom: 10,
              background: '#0f1520', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, color: 'white', fontSize: 13, outline: 'none',
            }}
          />
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {plans.map(p => (
            <button key={p} onClick={() => setFilterPlan(p)}
              style={{
                padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: filterPlan === p ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                color: filterPlan === p ? '#a78bfa' : 'rgba(255,255,255,0.4)',
              }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:"64px 0" }}>
          <div style={{ width:32, height:32, borderRadius:"50%", borderWidth:2, borderStyle:"solid", animation:"spin 1s linear infinite" ,  borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
          {filtered.map(t => {
            const days = daysUntil(t.trial_ends_at);
            const pc = PLAN_C[t.plan_tier] ?? { bg: 'rgba(255,255,255,0.05)', color: 'white' };
            const isTrial = t.plan_status === 'TRIAL';
            return (
              <div key={t.id} style={{ borderRadius:20, padding:20, display:"flex", flexDirection:"column", gap:16 ,  background: '#0f1520', border: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Header */}
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>/{t.slug}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: pc.bg, color: pc.color, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                    {t.plan_tier}
                  </span>
                </div>

                {/* Email */}
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.owner_email}
                </div>

                {/* Stats */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                  {[
                    { icon: ShoppingBag, val: t.order_count, label: 'Orders' },
                    { icon: Users, val: t.staff_count, label: 'Staff' },
                    { icon: Building2, val: t.menu_item_count, label: 'Items' },
                  ].map(s => (
                    <div key={s.label} style={{ borderRadius:12, padding:10, textAlign:"center" ,  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{s.val}</div>
                      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 1 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Revenue + trial */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 16 }}>
                      {fmtMoney(t.total_revenue)}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>total revenue</div>
                  </div>
                  {isTrial && (
                    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:12, background: days <= 3 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${days <= 3 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                      <Clock size={10} style={{ color: days <= 3 ? '#f87171' : '#f59e0b' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: days <= 3 ? '#f87171' : '#f59e0b' }}>
                        {days <= 0 ? 'Expired' : `${days}d trial`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Manage button */}
                <Link href={`/superadmin/tenants/${t.slug}`}
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 0", borderRadius:12, fontSize:13, fontWeight:600 ,  background: 'rgba(124,58,237,0.12)', color: '#a78bfa', textDecoration: 'none', border: '1px solid rgba(124,58,237,0.2)' }}>
                  Manage Tenant <ChevronRight size={13} />
                </Link>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ gridColumn:"span 3", textAlign:"center", padding:"64px 0" ,  color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              No tenants match your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
