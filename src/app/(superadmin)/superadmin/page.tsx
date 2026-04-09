'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, TrendingUp, Users, Clock, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, Search, ExternalLink,
  ShoppingBag, BarChart2
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  phone: string | null;
  plan_tier: string;
  plan_status: string;
  trial_ends_at: string | null;
  created_at: string;
  staff_count: number;
  menu_item_count: number;
  order_count: number;
  total_revenue: number;
  last_order_at: string | null;
  trial_days_left: number | null;
}

interface Totals { tenant_count:number; total_orders:number; total_revenue:number; active_trials:number; }

const STATUS_COLOR: Record<string,string> = {
  TRIAL: '#f59e0b', ACTIVE: '#22c55e', GRACE: '#f97316',
  SUSPENDED: '#ef4444', CANCELLED: '#6b7280',
};
const STATUS_ICON: Record<string,React.ReactNode> = {
  TRIAL: <Clock size={12}/>, ACTIVE: <CheckCircle size={12}/>,
  GRACE: <AlertTriangle size={12}/>, SUSPENDED: <XCircle size={12}/>,
  CANCELLED: <XCircle size={12}/>,
};

const fmt = (n:number) => n >= 1000 ? `₱${(n/1000).toFixed(1)}k` : `₱${n.toFixed(0)}`;
const fmtDate = (s:string|null) => s ? new Date(s).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—';
const fmtAgo = (s:string|null) => {
  if (!s) return 'Never';
  const ms = Date.now() - new Date(s).getTime();
  if (ms < 60000) return 'Just now';
  if (ms < 3600000) return `${Math.floor(ms/60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms/3600000)}h ago`;
  return `${Math.floor(ms/86400000)}d ago`;
};

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [tenants, setTenants]   = useState<Tenant[]>([]);
  const [totals, setTotals]     = useState<Totals>({ tenant_count:0, total_orders:0, total_revenue:0, active_trials:0 });
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<string>('ALL');
  const [actionState, setActionState] = useState<Record<string,string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/superadmin/tenants', { credentials:'include' });
    if (r.status === 401) { router.push('/superadmin/login'); return; }
    const d = await r.json() as { data?: Tenant[]; error?: string };
    const list = d.data ?? [];
    setTenants(list);
    setTotals({
      tenant_count: list.length,
      total_orders: list.reduce((s,t) => s + (t.order_count||0), 0),
      total_revenue: list.reduce((s,t) => s + (t.total_revenue||0), 0),
      active_trials: list.filter(t => t.plan_status === 'TRIAL').length,
    });
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const action = async (slug:string, act:string, body:Record<string,unknown>) => {
    setActionState(s => ({ ...s, [slug]: act }));
    await fetch(`/api/superadmin/tenants/${slug}`, {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body),
    });
    await load();
    setActionState(s => { const n={...s}; delete n[slug]; return n; });
  };

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.slug.includes(q) || (t.owner_email||'').includes(q);
    const matchFilter = filter==='ALL' || t.plan_status===filter;
    return matchSearch && matchFilter;
  });

  const C = {
    bg: '#0c0f16', card: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)',
    text: '#e8eaf0', muted: '#6b7280', green: '#22c55e',
  };

  const kpiCard = (icon:React.ReactNode, label:string, val:string|number, sub:string, color:string) => (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px', flex:1, minWidth:160 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', color }}>{icon}</div>
        <span style={{ color:C.muted, fontSize:12, fontWeight:600 }}>{label}</span>
      </div>
      <div style={{ color:C.text, fontSize:26, fontWeight:800 }}>{val}</div>
      <div style={{ color:C.muted, fontSize:12, marginTop:4 }}>{sub}</div>
    </div>
  );

  return (
    <div style={{ padding:'24px 28px', fontFamily:"'Inter',system-ui,sans-serif", background:C.bg, minHeight:'100vh', color:C.text }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, margin:0, marginBottom:4 }}>Platform Dashboard</h1>
          <div style={{ color:C.muted, fontSize:14 }}>TYG POS SaaS — Operator View</div>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 16px', color:C.text, cursor:'pointer', fontSize:13 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/> Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div style={{ display:'flex', gap:16, marginBottom:28, flexWrap:'wrap' }}>
        {kpiCard(<Building2 size={18}/>, 'Total Tenants',  totals.tenant_count, 'registered cafés', '#818cf8')}
        {kpiCard(<ShoppingBag size={18}/>, 'Total Orders', totals.total_orders.toLocaleString(), 'all time, real orders', '#22c55e')}
        {kpiCard(<TrendingUp size={18}/>, 'Platform Revenue', fmt(totals.total_revenue), 'sum of completed orders', '#f59e0b')}
        {kpiCard(<Clock size={18}/>, 'Active Trials', totals.active_trials, `of ${totals.tenant_count} tenants`, '#38bdf8')}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:C.muted }}/>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search tenant, slug, email…"
            style={{ width:'100%', paddingLeft:36, paddingRight:16, paddingTop:10, paddingBottom:10, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:14, outline:'none', boxSizing:'border-box' }}
          />
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {['ALL','TRIAL','ACTIVE','GRACE','SUSPENDED'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${filter===s ? (STATUS_COLOR[s]||C.green) : C.border}`, background: filter===s ? `${STATUS_COLOR[s]||C.green}18` : 'transparent', color: filter===s ? (STATUS_COLOR[s]||C.green) : C.muted, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Tenant Table */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              {['Tenant','Status','Orders','Revenue','Last Order','Trial','Actions'].map(h => (
                <th key={h} style={{ padding:'14px 16px', textAlign:'left', color:C.muted, fontWeight:600, fontSize:11, letterSpacing:'0.06em', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:C.muted }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:C.muted }}>No tenants found</td></tr>
            ) : filtered.map((t, i) => (
              <tr key={t.id} style={{ borderBottom: i<filtered.length-1 ? `1px solid ${C.border}` : 'none', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                {/* Name */}
                <td style={{ padding:'14px 16px' }}>
                  <div style={{ fontWeight:700, color:C.text, marginBottom:2 }}>{t.name}</div>
                  <div style={{ color:C.muted, fontSize:11 }}>
                    <span style={{ color:'#22c55e' }}>{t.slug}</span> · {t.owner_email}
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <span style={{ color:C.muted, fontSize:11 }}>👤 {t.staff_count} staff</span>
                    <span style={{ color:C.muted, fontSize:11 }}>🍽 {t.menu_item_count} items</span>
                  </div>
                </td>
                {/* Status */}
                <td style={{ padding:'14px 16px' }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:`${STATUS_COLOR[t.plan_status]||C.muted}18`, color:STATUS_COLOR[t.plan_status]||C.muted, fontSize:11, fontWeight:700 }}>
                    {STATUS_ICON[t.plan_status]} {t.plan_status}
                  </div>
                  <div style={{ color:C.muted, fontSize:11, marginTop:4 }}>{t.plan_tier}</div>
                </td>
                {/* Orders */}
                <td style={{ padding:'14px 16px', color:C.text, fontWeight:600 }}>{(t.order_count||0).toLocaleString()}</td>
                {/* Revenue */}
                <td style={{ padding:'14px 16px', color:'#22c55e', fontWeight:700 }}>{fmt(t.total_revenue||0)}</td>
                {/* Last Order */}
                <td style={{ padding:'14px 16px', color:C.muted, fontSize:12 }}>{fmtAgo(t.last_order_at)}</td>
                {/* Trial */}
                <td style={{ padding:'14px 16px' }}>
                  {t.plan_status === 'TRIAL' && t.trial_days_left !== null ? (
                    <div style={{ color: t.trial_days_left <= 7 ? '#f87171' : t.trial_days_left <= 14 ? '#f59e0b' : '#22c55e', fontSize:12, fontWeight:700 }}>
                      {t.trial_days_left > 0 ? `${t.trial_days_left}d left` : 'Expired'}
                      <div style={{ color:C.muted, fontWeight:400 }}>{fmtDate(t.trial_ends_at)}</div>
                    </div>
                  ) : <span style={{ color:C.muted }}>—</span>}
                </td>
                {/* Actions */}
                <td style={{ padding:'14px 16px' }}>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {t.plan_status !== 'ACTIVE' && (
                      <button onClick={() => action(t.slug,'activate',{ plan_status:'ACTIVE', trial_ends_at:null })}
                        disabled={!!actionState[t.slug]}
                        style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #22c55e33', background:'#22c55e18', color:'#22c55e', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        {actionState[t.slug]==='activate' ? '…' : '✓ Activate'}
                      </button>
                    )}
                    {t.plan_status === 'TRIAL' && (
                      <button onClick={() => action(t.slug,'extend',{ trial_ends_at: new Date(Date.now()+14*86400000).toISOString() })}
                        disabled={!!actionState[t.slug]}
                        style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #38bdf833', background:'#38bdf818', color:'#38bdf8', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        {actionState[t.slug]==='extend' ? '…' : '+14d'}
                      </button>
                    )}
                    {t.plan_status !== 'SUSPENDED' && t.plan_status !== 'CANCELLED' && (
                      <button onClick={() => action(t.slug,'suspend',{ plan_status:'SUSPENDED' })}
                        disabled={!!actionState[t.slug]}
                        style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #ef444433', background:'#ef444418', color:'#ef4444', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        Suspend
                      </button>
                    )}
                    <a href={`/login/${t.slug}`} target="_blank" rel="noreferrer"
                      style={{ padding:'5px 10px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color:C.muted, fontSize:11, fontWeight:700, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4 }}>
                      <ExternalLink size={10}/> Login
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop:16, color:C.muted, fontSize:12, textAlign:'right' }}>
        {filtered.length} of {tenants.length} tenants · <BarChart2 size={10} style={{ display:'inline', marginRight:4 }}/>
        <a href="/superadmin/tenants" style={{ color:'#22c55e', textDecoration:'none' }}>Detailed view →</a>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
