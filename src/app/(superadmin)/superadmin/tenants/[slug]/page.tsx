'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, ToggleLeft, ToggleRight, AlertTriangle,
  ChevronDown, ChevronUp, TrendingUp, Zap, Users,
  ShoppingBag, Shield, Activity, Lock
} from 'lucide-react';

const FEATURES = [
  { key: 'qr_ordering',    label: 'QR Ordering',    cat: 'CORE' },
  { key: 'kitchen_display', label: 'Kitchen Display', cat: 'CORE' },
  { key: 'analytics',      label: 'Analytics',      cat: 'CORE' },
  { key: 'pos_enabled',    label: 'POS Enabled',    cat: 'CORE' },
  { key: 'discounts',      label: 'Discounts',      cat: 'CORE' },
  { key: 'payment_upload', label: 'Payment Upload', cat: 'CORE' },
  { key: 'delivery',       label: 'Delivery',       cat: 'ADV' },
  { key: 'inventory',      label: 'Inventory',      cat: 'ADV' },
  { key: 'reservations',   label: 'Reservations',   cat: 'ADV' },
  { key: 'sms_notify',     label: 'SMS Notify',     cat: 'ADV' },
  { key: 'multi_branch',   label: 'Multi-Branch',   cat: 'ADV' },
  { key: 'bir_receipts',   label: 'BIR Receipts',   cat: 'ADV' },
];

const HEALTH_C: Record<string,{color:string;bg:string;border:string;emoji:string}> = {
  healthy: { color:'#22c55e', bg:'rgba(34,197,94,0.1)',  border:'rgba(34,197,94,0.25)',  emoji:'🟢' },
  at_risk: { color:'#f59e0b', bg:'rgba(245,158,11,0.1)', border:'rgba(245,158,11,0.25)', emoji:'🟡' },
  dead:    { color:'#ef4444', bg:'rgba(239,68,68,0.1)',  border:'rgba(239,68,68,0.25)',  emoji:'🔴' },
};

interface TenantData {
  tenant: Record<string,unknown>;
  stats: { order_count:number; total_revenue:number; staff_count:number; menu_item_count:number };
  staff: Array<Record<string,unknown>>;
  recent_orders: Array<Record<string,unknown>>;
  features: Array<{ key:string; name:string; enabled:boolean; source:string }>;
  audit_log: Array<Record<string,unknown>>;
  health_score?: number; health_label?: string;
  onboarding_progress?: number;
}

export default function TenantDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router   = useRouter();
  const [data, setData] = useState<TenantData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');
  const [expanded, setExpanded] = useState<string>('overview');
  const [limitEdits, setLimitEdits] = useState<Record<string,number>>({});

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    const r = await fetch(`/api/superadmin/tenants/${slug}`);
    if (r.status === 401) { router.push('/superadmin/login'); return; }
    const d = await r.json() as { data?: TenantData };
    if (d.data) {
      setData(d.data);
      setLimitEdits({
        max_products: (d.data.tenant.max_products as number) ?? 500,
        max_staff:    (d.data.tenant.max_staff    as number) ?? 20,
        max_branches: (d.data.tenant.max_branches as number) ?? 1,
      });
    }
    setLoading(false);
  }, [slug, router]);

  useEffect(() => { void load(); }, [load]);

  const ctrl = async (body: Record<string,unknown>) => {
    setSaving(true);
    const r = await fetch(`/api/superadmin/tenants/${slug}/controls`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const d = await r.json() as { data?: unknown };
    setSaving(false);
    if (d.data) { showToast('✅ Done'); void load(); }
    else showToast('❌ Failed');
  };

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'#64748b' }}>Loading…</div>;
  if (!data) return <div style={{ color:'#ef4444' }}>Tenant not found.</div>;

  const { tenant, stats, staff, recent_orders, features, audit_log } = data;
  const featureMap: Record<string,boolean> = {};
  features.forEach(f => { featureMap[f.key] = f.enabled; });
  const health = data.health_label ?? (tenant.health_label as string) ?? 'dead';
  const hc = HEALTH_C[health] ?? { color:'#ef4444', bg:'rgba(239,68,68,0.1)', border:'rgba(239,68,68,0.25)', emoji:'🔴' };
  const onboarding = data.onboarding_progress ?? 0;
  const posLocked = tenant.pos_locked === true;

  const Section = ({ id, title, icon, children }: { id:string; title:string; icon:React.ReactNode; children:React.ReactNode }) => (
    <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden', marginBottom:14 }}>
      <button onClick={() => setExpanded(s => s===id ? '' : id)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, fontWeight:700, fontSize:14, color:'#f8fafc' }}>{icon}{title}</div>
        {expanded===id ? <ChevronUp size={15} style={{ color:'#64748b' }} /> : <ChevronDown size={15} style={{ color:'#64748b' }} />}
      </button>
      {expanded===id && <div style={{ padding:'0 18px 18px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>{children}</div>}
    </div>
  );

  const Btn = ({ label, color, bg, border, onClick }: { label:string; color:string; bg:string; border:string; onClick:()=>void }) => (
    <button onClick={onClick} disabled={saving}
      style={{ padding:'9px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:saving?'wait':'pointer', color, background:bg, border:`1px solid ${border}` }}>
      {label}
    </button>
  );

  return (
    <div style={{ color:'#e2e8f0', fontFamily:"'Inter',system-ui,sans-serif", maxWidth:880 }}>
      {toast && (
        <div style={{ position:'fixed', top:16, right:16, zIndex:9999, padding:'10px 18px', borderRadius:10, background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e', fontWeight:600, fontSize:13 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={() => router.push('/superadmin/tenants')}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#94a3b8', cursor:'pointer', fontSize:12 }}>
          <ArrowLeft size={13} /> Back
        </button>
        <div>
          <h1 style={{ fontWeight:800, fontSize:20, color:'#f8fafc', marginBottom:2 }}>{tenant.name as string}</h1>
          <span style={{ fontSize:12, color:'#64748b' }}>/{tenant.slug as string} · {tenant.owner_email as string}</span>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background:hc.bg, border:`1px solid ${hc.border}`, color:hc.color }}>
            {hc.emoji} {health.replace('_',' ').toUpperCase()}
          </span>
          <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)', color:'#818cf8' }}>
            {tenant.plan_tier as string} · {tenant.plan_status as string}
          </span>
          {posLocked && <span style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'rgba(239,68,68,0.15)', color:'#f87171' }}>🔒 POS LOCKED</span>}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {[
          { label:'Revenue', value:`₱${Math.round(stats.total_revenue).toLocaleString()}`, icon:<TrendingUp size={13} />, color:'#22c55e' },
          { label:'Orders',  value:String(stats.order_count),   icon:<ShoppingBag size={13} />, color:'#3b82f6' },
          { label:'Staff',   value:String(stats.staff_count),   icon:<Users size={13} />,       color:'#6366f1' },
          { label:'Items',   value:String(stats.menu_item_count), icon:<Zap size={13} />,       color:'#f59e0b' },
        ].map(k => (
          <div key={k.label} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</span>
              <span style={{ color:k.color }}>{k.icon}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Onboarding progress */}
      <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:12, padding:'14px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13, fontWeight:600 }}>
            <span>Onboarding Progress</span>
            <span style={{ color:'#6366f1' }}>{onboarding}%</span>
          </div>
          <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${onboarding}%`, background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:99 }} />
          </div>
        </div>
        <button onClick={() => ctrl({ force_action:'reset_onboarding' })} disabled={saving}
          style={{ fontSize:11, fontWeight:700, color:'#6366f1', background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:7, padding:'6px 12px', cursor:'pointer', whiteSpace:'nowrap' }}>
          ↺ Reset
        </button>
      </div>

      {/* Force Actions */}
      <Section id="actions" title="Force Actions" icon={<Shield size={14} style={{ color:'#ef4444' }} />}>
        <div style={{ paddingTop:14, display:'flex', flexWrap:'wrap', gap:8 }}>
          <Btn label="⏏ Force Logout" color="#ef4444" bg="rgba(239,68,68,0.08)" border="rgba(239,68,68,0.25)" onClick={() => ctrl({ force_action:'force_logout' })} />
          <Btn label={posLocked ? '🔓 Unlock POS' : '🔒 Lock POS'} color="#f59e0b" bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.25)"
            onClick={() => ctrl({ force_action: posLocked ? 'unlock_pos' : 'lock_pos' })} />
          <Btn label="▶ Activate" color="#22c55e" bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.25)" onClick={() => ctrl({ force_action:'activate' })} />
          <Btn label="⏸ Suspend"  color="#ef4444" bg="rgba(239,68,68,0.08)" border="rgba(239,68,68,0.25)" onClick={() => ctrl({ force_action:'suspend' })} />
          <Btn label="+7d Trial"  color="#6366f1" bg="rgba(99,102,241,0.08)" border="rgba(99,102,241,0.25)" onClick={() => ctrl({ force_action:'extend_trial', trial_days:7 })} />
          <Btn label="+14d Trial" color="#6366f1" bg="rgba(99,102,241,0.08)" border="rgba(99,102,241,0.25)" onClick={() => ctrl({ force_action:'extend_trial', trial_days:14 })} />
          <Btn label="+30d Trial" color="#6366f1" bg="rgba(99,102,241,0.08)" border="rgba(99,102,241,0.25)" onClick={() => ctrl({ force_action:'extend_trial', trial_days:30 })} />
        </div>
      </Section>

      {/* Feature Toggles */}
      <Section id="features" title="Feature Toggles" icon={<Activity size={14} style={{ color:'#6366f1' }} />}>
        <div style={{ paddingTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {FEATURES.map(f => {
            const on = featureMap[f.key] !== false;
            return (
              <div key={f.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', borderRadius:9, background:on?'rgba(34,197,94,0.04)':'rgba(239,68,68,0.04)', border:`1px solid ${on?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'}` }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#f8fafc' }}>{f.label}</div>
                  <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>{f.cat}</div>
                </div>
                <button onClick={() => ctrl({ features:{ [f.key]: !on } })} disabled={saving}
                  style={{ background:'none', border:'none', cursor:'pointer', color:on?'#22c55e':'#475569' }}>
                  {on ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Limits */}
      <Section id="limits" title="Limit Controls" icon={<AlertTriangle size={14} style={{ color:'#f59e0b' }} />}>
        <div style={{ paddingTop:14, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            { field:'max_products', label:'Max Products' },
            { field:'max_staff',    label:'Max Staff' },
            { field:'max_branches', label:'Max Branches' },
          ].map(l => (
            <div key={l.field} style={{ background:'rgba(255,255,255,0.03)', borderRadius:9, padding:'12px' }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{l.label}</label>
              <input type="number" value={limitEdits[l.field] ?? 0} min={0} max={9999}
                onChange={e => setLimitEdits(prev => ({ ...prev, [l.field]: parseInt(e.target.value)||0 }))}
                onBlur={() => ctrl({ [l.field]: limitEdits[l.field] })}
                style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, padding:'8px 10px', fontSize:15, fontWeight:700, color:'#f8fafc', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>
          ))}
        </div>
      </Section>

      {/* Staff */}
      <Section id="staff" title={`Staff (${staff.length})`} icon={<Users size={14} />}>
        <div style={{ paddingTop:12 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                {['Name','Role','Active','Last Login'].map(h=><th key={h} style={{ textAlign:'left', padding:'6px 8px', color:'#64748b', fontWeight:700, fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(staff as Array<Record<string,unknown>>).map(s => (
                <tr key={s.id as string} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding:'8px 8px', fontWeight:600, color:'#f8fafc' }}>{s.display_name as string}</td>
                  <td style={{ padding:'8px 8px', color:'#64748b' }}>{s.role as string}</td>
                  <td style={{ padding:'8px 8px' }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99, background:s.is_active?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', color:s.is_active?'#22c55e':'#ef4444' }}>
                      {s.is_active ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td style={{ padding:'8px 8px', color:'#475569', fontSize:11 }}>
                    {s.last_login ? new Date(s.last_login as string).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Recent Orders */}
      <Section id="orders" title={`Recent Orders (${recent_orders.length})`} icon={<ShoppingBag size={14} />}>
        <div style={{ paddingTop:12 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                {['Order#','Customer','Status','Amount','Date'].map(h=><th key={h} style={{ textAlign:'left', padding:'6px 8px', color:'#64748b', fontWeight:700, fontSize:10, textTransform:'uppercase' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(recent_orders as Array<Record<string,unknown>>).map(o => (
                <tr key={o.id as string} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding:'7px 8px', fontFamily:'monospace', fontSize:11, fontWeight:600, color:'#94a3b8' }}>{o.order_number as string}</td>
                  <td style={{ padding:'7px 8px', color:'#e2e8f0' }}>{(o.customer_name as string)||'—'}</td>
                  <td style={{ padding:'7px 8px' }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99, background:'rgba(255,255,255,0.06)', color:'#94a3b8' }}>{o.status as string}</span>
                  </td>
                  <td style={{ padding:'7px 8px', fontWeight:700, color:'#22c55e' }}>₱{Number(o.total_amount).toLocaleString()}</td>
                  <td style={{ padding:'7px 8px', color:'#475569', fontSize:11 }}>{new Date(o.created_at as string).toLocaleDateString()}</td>
                </tr>
              ))}
              {recent_orders.length===0 && <tr><td colSpan={5} style={{ padding:'20px 8px', textAlign:'center', color:'#475569' }}>No orders yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Activity Log */}
      <Section id="audit" title="Activity Log" icon={<Activity size={14} />}>
        <div style={{ paddingTop:12, display:'flex', flexDirection:'column', gap:6 }}>
          {(audit_log as Array<Record<string,unknown>>).length === 0
            ? <p style={{ color:'#475569', fontSize:13, paddingTop:4 }}>No activity logged yet.</p>
            : (audit_log as Array<Record<string,unknown>>).map((a, i) => (
              <div key={i} style={{ display:'flex', gap:10, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', fontSize:12 }}>
                <span style={{ color:'#475569', whiteSpace:'nowrap' }}>{new Date(a.created_at as string).toLocaleDateString()}</span>
                <span style={{ fontWeight:700, color:'#94a3b8' }}>{a.action as string}</span>
                <span style={{ color:'#475569', flex:1 }}>{a.note as string}</span>
                {a.new_value ? <span style={{ color:'#22c55e', fontWeight:600, whiteSpace:'nowrap' }}>→ {String(a.new_value as string).slice(0, 30)}</span> : null}
              </div>
            ))
          }
        </div>
      </Section>
    </div>
  );
}
