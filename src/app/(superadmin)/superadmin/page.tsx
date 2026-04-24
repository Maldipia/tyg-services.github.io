'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, DollarSign, Activity, TrendingUp, ArrowUpRight, AlertTriangle, Building2, Clock, Zap } from 'lucide-react';

interface SaasMetrics {
  total_tenants: number; paying_tenants: number; trial_tenants: number;
  mrr: number; arpu: number; conversion_rate: number;
  orders_this_month: number; revenue_this_month: number;
  health: { healthy: number; at_risk: number; dead: number };
  onboarding_completion_rate: number;
}
interface Tenant {
  id: string; name: string; slug: string; plan_tier: string; plan_status: string;
  trial_days_left: number | null; total_revenue: number; order_count: number;
  health_label: string; last_order_at: string | null;
}
const fmt = (n: number) => '₱' + Math.round(n).toLocaleString();

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<SaasMetrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [mr, tr] = await Promise.all([fetch('/api/superadmin/metrics'), fetch('/api/superadmin/tenants')]);
      if (mr.status === 401) { router.push('/superadmin/login'); return; }
      const [md, td] = await Promise.all([mr.json(), tr.json()]) as [{ data: SaasMetrics }, { data: Tenant[] }];
      setMetrics(md.data); setTenants(td.data ?? []); setLoading(false);
    };
    void load();
  }, [router]);

  const KPI = ({ label, value, sub, icon, accent }: { label: string; value: string; sub: string; icon: React.ReactNode; accent: string }) => (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>{icon}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#475569' }}>{sub}</div>
    </div>
  );

  const atRisk  = tenants.filter(t => t.health_label === 'at_risk');
  const dead    = tenants.filter(t => !t.health_label || t.health_label === 'dead');
  const expiring = tenants.filter(t => t.plan_status === 'TRIAL' && (t.trial_days_left ?? 99) <= 3 && (t.trial_days_left ?? -1) >= 0);

  return (
    <div style={{ color: '#e2e8f0', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', marginBottom: 4 }}>Platform Overview</h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>{new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}</p>
        </div>
        <button onClick={() => window.location.reload()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '8px 14px', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>Loading…</div> : metrics && (<>
        {/* SaaS KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          <KPI label="MRR" value={fmt(metrics.mrr)} sub="Monthly recurring revenue" icon={<DollarSign size={13} />} accent="#22c55e" />
          <KPI label="ARPU" value={fmt(metrics.arpu)} sub="Avg revenue per paying user" icon={<TrendingUp size={13} />} accent="#6366f1" />
          <KPI label="Conversion" value={`${metrics.conversion_rate}%`} sub={`${metrics.paying_tenants} of ${metrics.total_tenants} paying`} icon={<ArrowUpRight size={13} />} accent="#f59e0b" />
          <KPI label="This Month" value={fmt(metrics.revenue_this_month)} sub={`${metrics.orders_this_month} orders`} icon={<Activity size={13} />} accent="#3b82f6" />
        </div>

        {/* Health + Mix + Onboarding */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Tenant Health</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ l:'Healthy', n: metrics.health.healthy, c:'#22c55e', e:'🟢' }, { l:'At Risk', n: metrics.health.at_risk, c:'#f59e0b', e:'🟡' }, { l:'Dead', n: metrics.health.dead, c:'#ef4444', e:'🔴' }].map(h=>(
                <div key={h.l} style={{ flex:1, background:`${h.c}10`, border:`1px solid ${h.c}30`, borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:800, color:h.c }}>{h.n}</div>
                  <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>{h.e} {h.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Onboarding Rate</div>
            <div style={{ fontSize:32, fontWeight:800, color:'#6366f1', marginBottom:10 }}>{metrics.onboarding_completion_rate}%</div>
            <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${metrics.onboarding_completion_rate}%`, background:'#6366f1', borderRadius:99 }} />
            </div>
            <div style={{ fontSize:11, color:'#475569', marginTop:8 }}>tenants who completed setup</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Tenant Mix</div>
            {[{ l:'Paying', n:metrics.paying_tenants, c:'#22c55e' }, { l:'Trial', n:metrics.trial_tenants, c:'#f59e0b' }, { l:'Total', n:metrics.total_tenants, c:'#6366f1' }].map(m=>(
              <div key={m.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:12, color:'#64748b' }}>{m.l}</span>
                <span style={{ fontSize:16, fontWeight:800, color:m.c }}>{m.n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {(expiring.length > 0 || dead.slice(0,3).length > 0) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>⚠️ Needs Attention</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {expiring.map(t=>(
                <Link key={t.id} href={`/superadmin/tenants/${t.slug}`} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:10, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', textDecoration:'none', color:'inherit' }}>
                  <AlertTriangle size={13} style={{ color:'#ef4444', flexShrink:0 }} />
                  <span style={{ flex:1, fontWeight:600, fontSize:13, color:'#f8fafc' }}>{t.name}</span>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>trial ends in {t.trial_days_left}d</span>
                  <span style={{ fontSize:11, color:'#ef4444', fontWeight:700 }}>Convert →</span>
                </Link>
              ))}
              {dead.slice(0,3).map(t=>(
                <Link key={t.id} href={`/superadmin/tenants/${t.slug}`} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:10, background:'rgba(100,116,139,0.04)', border:'1px solid rgba(100,116,139,0.12)', textDecoration:'none', color:'inherit' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'#475569', flexShrink:0 }} />
                  <span style={{ flex:1, fontWeight:600, fontSize:13, color:'#94a3b8' }}>{t.name}</span>
                  <span style={{ fontSize:11, color:'#475569' }}>🔴 dead — no activity</span>
                  <span style={{ fontSize:11, color:'#64748b' }}>View →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick nav */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            { href:'/superadmin/tenants', label:'All Tenants', sub:`${metrics.total_tenants} total`, icon:<Building2 size={15} />, color:'#6366f1' },
            { href:'/superadmin/tenants', label:'Trials', sub:`${metrics.trial_tenants} active`, icon:<Clock size={15} />, color:'#f59e0b' },
            { href:'/superadmin/tenants', label:'Health Board', sub:`${metrics.health.at_risk + metrics.health.dead} need attention`, icon:<Zap size={15} />, color:'#ef4444' },
          ].map(n=>(
            <Link key={n.label} href={n.href} style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 18px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, textDecoration:'none' }}>
              <div style={{ width:34, height:34, borderRadius:9, background:`${n.color}18`, display:'flex', alignItems:'center', justifyContent:'center', color:n.color, flexShrink:0 }}>{n.icon}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#f8fafc' }}>{n.label}</div>
                <div style={{ fontSize:11, color:'#475569' }}>{n.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </>)}
    </div>
  );
}
