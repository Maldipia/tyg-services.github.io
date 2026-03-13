'use client';
import React from 'react';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Users, ShoppingBag, UtensilsCrossed,
  Clock, CheckCircle, XCircle, ExternalLink, Edit3, Save,
  Loader2, AlertTriangle, TrendingUp, Mail
} from 'lucide-react';

interface TenantDetail {
  tenant: Record<string, unknown>;
  stats: {
    order_count: number;
    total_revenue: number;
    staff_count: number;
    menu_item_count: number;
    orders_by_status: Record<string, number>;
  };
  staff: Array<{ id: string; display_name: string; role: string; is_active: boolean; created_at: string }>;
  menu_items: Array<{ id: string; name: string; price: number; is_active: boolean }>;
  branches: Array<{ id: string; name: string; is_active: boolean }>;
  recent_orders: Array<{
    id: string; order_number: string; total_amount: number;
    status: string; created_at: string; customer_name: string;
  }>;
}

const PLANS = ['TRIAL', 'STARTER', 'BUSINESS', 'PRO', 'ENTERPRISE'];
const STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'];

const PLAN_C: Record<string, { bg: string; color: string }> = {
  TRIAL:      { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  STARTER:    { bg: 'rgba(99,102,241,0.12)',   color: '#818cf8' },
  BUSINESS:   { bg: 'rgba(34,197,94,0.12)',    color: '#22c55e' },
  PRO:        { bg: 'rgba(168,85,247,0.12)',   color: '#c084fc' },
  ENTERPRISE: { bg: 'rgba(251,191,36,0.12)',   color: '#fbbf24' },
  SUSPENDED:  { bg: 'rgba(239,68,68,0.12)',    color: '#f87171' },
};

const STATUS_C: Record<string, string> = {
  PENDING: '#94a3b8', CONFIRMED: '#38bdf8', PREPARING: '#f59e0b',
  READY: '#a78bfa', COMPLETED: '#22c55e', CANCELLED: '#f87171',
};

function fmtMoney(n: number) { return '₱' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 }); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); }
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Edit form state
  const [editPlan, setEditPlan] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editTrialEnd, setEditTrialEnd] = useState('');

  useEffect(() => {
    fetch(`/api/superadmin/tenants/${slug}`)
      .then(r => {
        if (r.status === 401) { router.push('/superadmin/login'); return null; }
        if (!r.ok) { router.push('/superadmin/tenants'); return null; }
        return r.json();
      })
      .then((d: { data?: TenantDetail } | null) => {
        if (!d?.data) return;
        setData(d.data);
        const t = d.data.tenant;
        setEditPlan(t.plan_tier as string);
        setEditStatus(t.plan_status as string);
        setEditTrialEnd((t.trial_ends_at as string)?.slice(0, 10) ?? '');
      })
      .finally(() => setLoading(false));
  }, [slug, router]);

  const handleSave = async () => {
    setSaving(true);
    const r = await fetch(`/api/superadmin/tenants/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_tier: editPlan,
        plan_status: editStatus,
        trial_ends_at: editTrialEnd ? new Date(editTrialEnd).toISOString() : undefined,
      }),
    });
    setSaving(false);
    if (r.ok) {
      setSaved(true);
      setEditing(false);
      // Refresh data
      const updated = await fetch(`/api/superadmin/tenants/${slug}`).then(r => r.json()) as { data?: TenantDetail };
      if (updated.data) setData(updated.data);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:256 }}>
        <div style={{ width:32, height:32, borderRadius:"50%", borderWidth:2, borderStyle:"solid", animation:"spin 1s linear infinite" ,  borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!data) return null;

  const { tenant, stats, staff, menu_items, branches, recent_orders } = data;
  const t = tenant;
  const days = daysUntil(t.trial_ends_at as string);
  const pc = PLAN_C[t.plan_tier as string] ?? { bg: 'rgba(255,255,255,0.05)', color: 'white' };

  const selectStyle = {
    background: '#161b27', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: 'white', fontSize: 13, padding: '8px 12px', outline: 'none', cursor: 'pointer',
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24, maxWidth:1024 }}>
      {/* Back + Header */}
      <div>
        <Link href="/superadmin/tenants" style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, marginBottom:16 ,  color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
          <ArrowLeft size={13} /> All Tenants
        </Link>
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
          <div>
            <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
              {t.name as string}
            </h1>
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:12 }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>/{t.slug as string}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: pc.bg, color: pc.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {t.plan_tier as string}
              </span>
              {(t.plan_status as string) === 'TRIAL' && (
                <span style={{ display:"flex", alignItems:"center", gap:4 ,  fontSize: 12, color: days <= 3 ? '#f87171' : '#f59e0b' }}>
                  <Clock size={11} />
                  {days <= 0 ? 'Trial expired' : `${days}d trial remaining`}
                </span>
              )}
              {saved && (
                <span style={{ display:"flex", alignItems:"center", gap:6 ,  fontSize: 12, color: '#22c55e' }}>
                  <CheckCircle size={12} /> Saved
                </span>
              )}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Link href={`/order?tenant=${t.slug as string}`} target="_blank"
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", borderRadius:12, fontSize:11, fontWeight:600 ,  background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.08)' }}>
              <ExternalLink size={11} /> Order Page
            </Link>
            {!editing ? (
              <button onClick={() => setEditing(true)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:12, fontSize:11, fontWeight:600 ,  background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)', cursor: 'pointer' }}>
                <Edit3 size={11} /> Edit Plan
              </button>
            ) : (
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setEditing(false)}
                  style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ display:"flex", alignItems:"center", gap:6 ,  padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: 'white', border: 'none', cursor: 'pointer' }}>
                  {saving ? <Loader2 size={11} style={{ animation:"spin 1s linear infinite" }} /> : <Save size={11} />}
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan editor */}
      {editing && (
        <div style={{ borderRadius:20, padding:20, display:"flex", flexDirection:"column", gap:16 ,  background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <Edit3 size={13} style={{ color: '#a78bfa' }} />
            <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13 }}>Edit Tenant Plan</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Plan Tier</label>
              <select value={editPlan} onChange={e => setEditPlan(e.target.value)} style={selectStyle}>
                {PLANS.map(p => <option key={p} value={p} style={{ background: '#161b27' }}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={selectStyle}>
                {STATUSES.map(s => <option key={s} value={s} style={{ background: '#161b27' }}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Trial End Date</label>
              <input type="date" value={editTrialEnd} onChange={e => setEditTrialEnd(e.target.value)}
                style={{ ...selectStyle, width: '100%' }} />
            </div>
          </div>
          {/* Quick actions */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, paddingTop:4 }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, alignSelf: 'center' }}>Quick:</span>
            {[
              { label: '+7d trial', action: () => { const d = new Date(); d.setDate(d.getDate() + 7); setEditTrialEnd(d.toISOString().slice(0, 10)); setEditStatus('TRIAL'); setEditPlan('TRIAL'); } },
              { label: '+30d trial', action: () => { const d = new Date(); d.setDate(d.getDate() + 30); setEditTrialEnd(d.toISOString().slice(0, 10)); setEditStatus('TRIAL'); setEditPlan('TRIAL'); } },
              { label: 'Activate Starter', action: () => { setEditPlan('STARTER'); setEditStatus('ACTIVE'); } },
              { label: 'Suspend', action: () => setEditStatus('SUSPENDED') },
            ].map(a => (
              <button key={a.label} onClick={a.action}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
        {[
          { label: 'Total Orders', value: stats.order_count, icon: ShoppingBag, color: '#38bdf8' },
          { label: 'Revenue (GMV)', value: fmtMoney(stats.total_revenue), icon: TrendingUp, color: '#22c55e', isStr: true },
          { label: 'Staff Members', value: stats.staff_count, icon: Users, color: '#a78bfa' },
          { label: 'Menu Items', value: stats.menu_item_count, icon: UtensilsCrossed, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ borderRadius:20, padding:16 ,  background: '#0f1520', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <s.icon size={13} style={{ color: s.color }} />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{s.label}</span>
            </div>
            <div style={{ color: 'white', fontSize: s.isStr ? 18 : 24, fontWeight: 800 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tenant info + Orders by status */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* Tenant info */}
        <div style={{ borderRadius:20, padding:20 ,  background: '#0f1520', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ color: 'white', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Tenant Info</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { label: 'Owner Email', value: t.owner_email as string, icon: Mail },
              { label: 'Address', value: (t.address as string) ?? '—' },
              { label: 'Timezone', value: (t.timezone as string) ?? 'Asia/Manila' },
              { label: 'Created', value: fmtDate(t.created_at as string) },
              { label: 'Trial Ends', value: fmtDate(t.trial_ends_at as string) },
              { label: 'Branches', value: `${branches.length} branch${branches.length !== 1 ? 'es' : ''}` },
            ].map(r => (
              <div key={r.label} style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, flexShrink: 0 }}>{r.label}</span>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, textAlign: 'right', wordBreak: 'break-all' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Orders by status */}
        <div style={{ borderRadius:20, padding:20 ,  background: '#0f1520', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ color: 'white', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Orders by Status</h3>
          {Object.keys(stats.orders_by_status).length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No orders yet.</p>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {Object.entries(stats.orders_by_status).map(([status, count]) => {
                const pct = Math.round((count / stats.order_count) * 100);
                const color = STATUS_C[status] ?? '#94a3b8';
                return (
                  <div key={status}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{status}</span>
                      <span style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>{count}</span>
                    </div>
                    <div style={{ height:6, borderRadius:99 ,  background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height:6, borderRadius:99, width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Staff */}
      <div style={{ borderRadius:20, overflow:"hidden" ,  background: '#0f1520', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"16px 20px" ,  borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Users size={14} style={{ color: '#a78bfa' }} />
          <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Staff ({staff.length})</span>
        </div>
        <div style={{}}>
          {staff.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, padding: '16px 20px' }}>No staff.</p>
          ) : staff.map(s => (
            <div key={s.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px" }}>
              <div>
                <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{s.display_name}</span>
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(99,102,241,0.12)', color: '#818cf8', textTransform: 'uppercase' }}>{s.role}</span>
              </div>
              {s.is_active
                ? <CheckCircle size={13} style={{ color: '#22c55e' }} />
                : <XCircle size={13} style={{ color: '#f87171' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div style={{ borderRadius:20, overflow:"hidden" ,  background: '#0f1520', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"16px 20px" ,  borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <ShoppingBag size={14} style={{ color: '#38bdf8' }} />
          <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Recent Orders</span>
        </div>
        {recent_orders.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, padding: '16px 20px' }}>No orders yet.</p>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Order #', 'Customer', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} style={{ padding: '9px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent_orders.map((o, i) => {
                  const color = STATUS_C[o.status] ?? '#94a3b8';
                  return (
                    <tr key={o.id} style={{ borderBottom: i < recent_orders.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td style={{ padding: '11px 16px', color: '#38bdf8', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{o.order_number}</td>
                      <td style={{ padding: '11px 16px', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{o.customer_name ?? '—'}</td>
                      <td style={{ padding: '11px 16px', color: '#22c55e', fontSize: 12, fontWeight: 700 }}>{fmtMoney(o.total_amount)}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: `${color}18`, color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{o.status}</span>
                      </td>
                      <td style={{ padding: '11px 16px', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{fmtDate(o.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div style={{ borderRadius:20, padding:20 ,  background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <AlertTriangle size={13} style={{ color: '#f87171' }} />
          <span style={{ color: '#f87171', fontWeight: 700, fontSize: 13 }}>Danger Zone</span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 12 }}>
          These actions are irreversible. Proceed with caution.
        </p>
        <button
          onClick={() => {
            if (window.confirm(`Suspend ${t.name as string}? Their staff will lose access immediately.`)) {
              setEditStatus('SUSPENDED');
              setEditing(true);
            }
          }}
          style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
          Suspend Tenant
        </button>
      </div>
    </div>
  );
}
