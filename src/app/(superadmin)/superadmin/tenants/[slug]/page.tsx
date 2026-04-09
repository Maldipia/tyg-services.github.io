'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle,
  RefreshCw, ExternalLink, Shield, Zap, BarChart2,
  Users, ShoppingBag, TrendingUp, Activity, Lock, Unlock,
  FileText, ToggleLeft, ToggleRight, ChevronDown, ChevronRight
} from 'lucide-react';

interface Feature { key:string; name:string; description:string; category:string; enabled:boolean; source:string; note:string|null; }
interface Staff { id:string; display_name:string; role:string; is_active:boolean; created_at:string; }
interface Order { id:string; order_number:string; total_amount:number; status:string; created_at:string; customer_name:string; order_type:string; }
interface AuditEntry { action:string; field:string|null; old_value:string|null; new_value:string|null; note:string|null; created_at:string; }
interface TenantDetail {
  tenant: Record<string,unknown>;
  stats: { order_count:number; total_revenue:number; staff_count:number; menu_item_count:number; orders_by_status:Record<string,number> };
  staff: Staff[];
  recent_orders: Order[];
  features: Feature[];
  audit_log: AuditEntry[];
}

const C = {
  bg:'#0c0f16', card:'rgba(255,255,255,0.03)', border:'rgba(255,255,255,0.07)',
  text:'#e8eaf0', muted:'#6b7280', green:'#22c55e', red:'#ef4444',
  yellow:'#f59e0b', blue:'#38bdf8', purple:'#a78bfa',
};
const STATUS_COLOR:Record<string,string> = { TRIAL:'#f59e0b',ACTIVE:'#22c55e',GRACE:'#f97316',SUSPENDED:'#ef4444',CANCELLED:'#6b7280' };
const fmt = (n:number) => n>=1000 ? `₱${(n/1000).toFixed(1)}k` : `₱${n.toFixed(0)}`;
const fmtDate = (s:string|null|undefined) => s ? new Date(s).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—';
const fmtTime = (s:string) => new Date(s).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const CAT_ORDER = ['core','advanced','beta'];

export default function TenantGodPanel() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string|null>(null);
  const [tab, setTab] = useState<'overview'|'features'|'staff'|'orders'|'audit'>('overview');
  const [expandedCats, setExpandedCats] = useState<Record<string,boolean>>({ core:true, advanced:true, beta:false });
  const [note, setNote] = useState('');
  const [editTrialDays, setEditTrialDays] = useState('');
  const [billingNotes, setBillingNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/superadmin/tenants/${slug}`, { credentials:'include' });
    if (r.status === 401) { router.push('/superadmin/login'); return; }
    const d = await r.json() as { data?: TenantDetail };
    if (d.data) {
      setData(d.data);
      setBillingNotes(String(d.data.tenant.billing_notes ?? ''));
    }
    setLoading(false);
  }, [slug, router]);

  useEffect(() => { load(); }, [load]);

  const patch = async (body: Record<string,unknown>, label: string) => {
    setSaving(label);
    await fetch(`/api/superadmin/tenants/${slug}`, {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...body, note: note || undefined }),
    });
    await load();
    setSaving(null);
    setNote('');
  };

  const toggleFeature = async (key: string, current: boolean) => {
    await patch({ feature_key: key, feature_enabled: !current }, `feat:${key}`);
  };

  const t = data?.tenant;
  const status = String(t?.plan_status ?? '');
  const planTier = String(t?.plan_tier ?? '');
  const trialEndsAt = t?.trial_ends_at ? String(t.trial_ends_at) : null;

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(34,197,94,0.2)', borderTopColor:'#22c55e', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const featuresByCategory = CAT_ORDER.map(cat => ({
    cat, features: (data?.features ?? []).filter(f => f.category === cat)
  })).filter(g => g.features.length > 0);

  const TABS = [
    { id:'overview', label:'Overview', icon:<Activity size={14}/> },
    { id:'features', label:'Feature Flags', icon:<Zap size={14}/> },
    { id:'staff',    label:'Staff',    icon:<Users size={14}/> },
    { id:'orders',   label:'Orders',   icon:<ShoppingBag size={14}/> },
    { id:'audit',    label:'Audit Log', icon:<FileText size={14}/> },
  ] as const;

  return (
    <div style={{ padding:'24px 28px', fontFamily:"'Inter',system-ui,sans-serif", background:C.bg, minHeight:'100vh', color:C.text }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .tog:hover{opacity:0.8}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:28 }}>
        <button onClick={() => router.push('/superadmin')}
          style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', color:C.muted, cursor:'pointer', fontSize:13 }}>
          <ArrowLeft size={14}/> Back
        </button>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, margin:0 }}>{String(t?.name ?? slug)}</h1>
          <div style={{ color:C.muted, fontSize:13, display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
            <span style={{ color:C.green }}>{slug}</span>
            <span>·</span>
            <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:20, background:`${STATUS_COLOR[status]||C.muted}18`, color:STATUS_COLOR[status]||C.muted, fontSize:11, fontWeight:700 }}>
              {status}
            </div>
            <span>·</span>
            <span>{planTier}</span>
          </div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={load} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', color:C.muted, cursor:'pointer', fontSize:13 }}>
            <RefreshCw size={13}/> Refresh
          </button>
          <a href={`/login/${slug}`} target="_blank" rel="noreferrer"
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:8, padding:'8px 12px', color:C.green, textDecoration:'none', fontSize:13, fontWeight:600 }}>
            <ExternalLink size={13}/> Open Tenant
          </a>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Orders',     val:(data?.stats.order_count??0).toLocaleString(), icon:<ShoppingBag size={16}/>, color:'#22c55e' },
          { label:'Revenue',    val:fmt(data?.stats.total_revenue??0),             icon:<TrendingUp size={16}/>,  color:'#f59e0b' },
          { label:'Staff',      val:String(data?.stats.staff_count??0),            icon:<Users size={16}/>,       color:'#818cf8' },
          { label:'Menu Items', val:String(data?.stats.menu_item_count??0),        icon:<BarChart2 size={16}/>,   color:'#38bdf8' },
        ].map(k => (
          <div key={k.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:`${k.color}18`, display:'flex', alignItems:'center', justifyContent:'center', color:k.color }}>{k.icon}</div>
            <div>
              <div style={{ color:C.text, fontSize:20, fontWeight:800 }}>{k.val}</div>
              <div style={{ color:C.muted, fontSize:11 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, borderBottom:`1px solid ${C.border}`, marginBottom:24 }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', background:'none', border:'none', borderBottom: tab===tb.id ? '2px solid #22c55e' : '2px solid transparent', color: tab===tb.id ? C.green : C.muted, fontWeight:600, fontSize:13, cursor:'pointer', marginBottom:-1 }}>
            {tb.icon}{tb.label}
          </button>
        ))}
      </div>

      {/* ── TAB: OVERVIEW ─────────────────────────────────────── */}
      {tab === 'overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

          {/* Plan Controls */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}><Shield size={15} color={C.purple}/>Plan & Status</div>
            <div style={{ display:'grid', gap:10 }}>
              {[
                { label:'Activate',     action:() => patch({plan_status:'ACTIVE',trial_ends_at:null},'activate'),    color:'#22c55e', show: status!=='ACTIVE' },
                { label:'+14 Days',     action:() => patch({trial_ends_at:new Date(Date.now()+14*86400000).toISOString()},'extend14'), color:'#38bdf8', show: status==='TRIAL' },
                { label:'+30 Days',     action:() => patch({trial_ends_at:new Date(Date.now()+30*86400000).toISOString()},'extend30'), color:'#38bdf8', show: status==='TRIAL' },
                { label:'Set Grace',    action:() => patch({plan_status:'GRACE'},'grace'),                            color:'#f97316', show: status==='ACTIVE' },
                { label:'Suspend',      action:() => patch({plan_status:'SUSPENDED'},'suspend'),                      color:'#ef4444', show: !['SUSPENDED','CANCELLED'].includes(status) },
                { label:'Unsuspend',    action:() => patch({plan_status:'TRIAL',trial_ends_at:new Date(Date.now()+7*86400000).toISOString()},'unsuspend'), color:'#22c55e', show: status==='SUSPENDED' },
              ].filter(b => b.show).map(b => (
                <button key={b.label} onClick={b.action} disabled={!!saving}
                  style={{ padding:'10px 14px', borderRadius:9, border:`1px solid ${b.color}33`, background:`${b.color}12`, color:b.color, fontWeight:700, fontSize:13, cursor:'pointer', textAlign:'left' }}>
                  {saving===b.label.toLowerCase().replace(/ /g,'') ? '…' : b.label}
                </button>
              ))}

              {/* Custom trial extension */}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <input value={editTrialDays} onChange={e=>setEditTrialDays(e.target.value.replace(/\D/g,''))}
                  placeholder="Custom days"
                  style={{ flex:1, background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', color:C.text, fontSize:13, outline:'none' }}/>
                <button onClick={() => { if(editTrialDays) patch({trial_ends_at:new Date(Date.now()+parseInt(editTrialDays)*86400000).toISOString()},'custom'); setEditTrialDays(''); }}
                  disabled={!editTrialDays||!!saving}
                  style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(56,189,248,0.3)', background:'rgba(56,189,248,0.1)', color:'#38bdf8', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  Set
                </button>
              </div>
            </div>

            {/* Plan tier selector */}
            <div style={{ marginTop:16 }}>
              <div style={{ color:C.muted, fontSize:11, fontWeight:700, marginBottom:8 }}>CHANGE PLAN</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {['STARTER','BUSINESS','PRO','ENTERPRISE'].map(p => (
                  <button key={p} onClick={() => patch({plan_tier:p},'plan')} disabled={!!saving||planTier===p}
                    style={{ padding:'8px', borderRadius:8, border:`1px solid ${planTier===p?'#22c55e33':C.border}`, background: planTier===p?'rgba(34,197,94,0.1)':'transparent', color: planTier===p?C.green:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tenant Info + Billing Notes */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Tenant Details</div>
              {[
                ['Owner Email', String(t?.owner_email??'')],
                ['Phone', String(t?.phone??'—')],
                ['Address', String(t?.address??'—')],
                ['Trial Ends', fmtDate(trialEndsAt)],
                ['Created', fmtDate(String(t?.created_at??''))],
              ].map(([label,val]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}>
                  <span style={{ color:C.muted }}>{label}</span>
                  <span style={{ color:C.text, fontWeight:600 }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Billing Notes</div>
              <textarea value={billingNotes} onChange={e=>setBillingNotes(e.target.value)} rows={3}
                placeholder="Payment method, contract notes, special terms…"
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', color:C.text, fontSize:13, resize:'vertical', outline:'none', boxSizing:'border-box' }}/>
              <button onClick={() => patch({billing_notes:billingNotes},'notes')} disabled={!!saving}
                style={{ marginTop:10, padding:'8px 16px', borderRadius:8, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', color:C.green, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                {saving==='notes' ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          </div>

          {/* Action Note */}
          <div style={{ gridColumn:'1/-1', background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:16 }}>
            <div style={{ color:C.muted, fontSize:12, fontWeight:700, marginBottom:8 }}>NOTE FOR NEXT ACTION (optional — added to audit log)</div>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Reason for change, e.g. 'Client paid ₱499 via GCash'"
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', color:C.text, fontSize:13, outline:'none', boxSizing:'border-box' }}/>
          </div>
        </div>
      )}

      {/* ── TAB: FEATURE FLAGS ────────────────────────────────── */}
      {tab === 'features' && (
        <div>
          <div style={{ color:C.muted, fontSize:13, marginBottom:20 }}>
            Override individual features for this tenant regardless of plan.
            Toggles are instant and logged.
          </div>
          {featuresByCategory.map(({ cat, features }) => (
            <div key={cat} style={{ marginBottom:16 }}>
              <button onClick={() => setExpandedCats(e => ({...e, [cat]:!e[cat]}))}
                style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:C.text, fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:8, padding:0 }}>
                {expandedCats[cat] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                {cat.toUpperCase()}
                <span style={{ background:cat==='beta'?'rgba(167,139,250,0.15)':cat==='advanced'?'rgba(56,189,248,0.15)':'rgba(34,197,94,0.15)', color:cat==='beta'?C.purple:cat==='advanced'?C.blue:C.green, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>
                  {features.filter(f=>f.enabled).length}/{features.length} ON
                </span>
              </button>
              {expandedCats[cat] && (
                <div style={{ display:'grid', gap:8 }}>
                  {features.map(f => (
                    <div key={f.key} style={{ display:'flex', alignItems:'center', gap:12, background:C.card, border:`1px solid ${f.enabled?'rgba(34,197,94,0.2)':C.border}`, borderRadius:10, padding:'12px 16px' }}>
                      <button className="tog" onClick={() => toggleFeature(f.key, f.enabled)} disabled={saving===`feat:${f.key}`}
                        style={{ background:'none', border:'none', cursor:'pointer', color: f.enabled ? C.green : C.muted, flexShrink:0 }}>
                        {saving===`feat:${f.key}` ? <RefreshCw size={22} style={{animation:'spin 0.8s linear infinite'}}/> : f.enabled ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
                      </button>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:14, color:f.enabled?C.text:C.muted }}>{f.name}</div>
                        <div style={{ fontSize:12, color:C.muted }}>{f.description}</div>
                      </div>
                      <div style={{ fontSize:11, color:C.muted, padding:'2px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)' }}>{f.source}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: STAFF ────────────────────────────────────────── */}
      {tab === 'staff' && (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                {['Display Name','Role','Status','Created'].map(h => (
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', color:C.muted, fontSize:11, fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.staff??[]).map((s,i) => (
                <tr key={s.id} style={{ borderBottom:i<(data?.staff??[]).length-1?`1px solid ${C.border}`:'none' }}>
                  <td style={{ padding:'12px 16px', fontWeight:600 }}>{s.display_name}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ padding:'3px 8px', borderRadius:6, background:'rgba(99,102,241,0.12)', color:'#818cf8', fontSize:11, fontWeight:700 }}>{s.role}</span>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    {s.is_active ? <span style={{ color:C.green, display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={12}/>Active</span> : <span style={{ color:C.red }}>Inactive</span>}
                  </td>
                  <td style={{ padding:'12px 16px', color:C.muted }}>{fmtDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: ORDERS ───────────────────────────────────────── */}
      {tab === 'orders' && (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                {['Order #','Customer','Type','Amount','Status','Time'].map(h => (
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', color:C.muted, fontSize:11, fontWeight:700, textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.recent_orders??[]).map((o,i) => (
                <tr key={o.id} style={{ borderBottom:i<(data?.recent_orders??[]).length-1?`1px solid ${C.border}`:'none' }}>
                  <td style={{ padding:'12px 16px', color:C.green, fontWeight:700 }}>{o.order_number}</td>
                  <td style={{ padding:'12px 16px' }}>{o.customer_name}</td>
                  <td style={{ padding:'12px 16px', color:C.muted }}>{o.order_type}</td>
                  <td style={{ padding:'12px 16px', fontWeight:700 }}>₱{Number(o.total_amount).toFixed(2)}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ padding:'3px 8px', borderRadius:6, background:`${o.status==='COMPLETED'?'rgba(34,197,94,0.12)':'rgba(245,158,11,0.12)'}`, color:o.status==='COMPLETED'?C.green:C.yellow, fontSize:11, fontWeight:700 }}>{o.status}</span>
                  </td>
                  <td style={{ padding:'12px 16px', color:C.muted }}>{fmtTime(o.created_at)}</td>
                </tr>
              ))}
              {(data?.recent_orders??[]).length===0 && (
                <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:C.muted }}>No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: AUDIT LOG ────────────────────────────────────── */}
      {tab === 'audit' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {(data?.audit_log??[]).length === 0 && (
            <div style={{ textAlign:'center', color:C.muted, padding:40 }}>No audit entries yet</div>
          )}
          {(data?.audit_log??[]).map((e,i) => (
            <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 16px', display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: e.action.includes('TOGGLE')?C.blue:e.action.includes('SUSPEND')?C.red:C.green, marginTop:5, flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>{e.action}</span>
                  <span style={{ color:C.muted, fontSize:12 }}>{fmtTime(e.created_at)}</span>
                </div>
                {e.field && (
                  <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                    <span style={{ color:C.text }}>{e.field}</span>: {e.old_value??'—'} → <span style={{ color:C.green }}>{e.new_value??'—'}</span>
                  </div>
                )}
                {e.note && <div style={{ fontSize:12, color:C.yellow, marginTop:4, fontStyle:'italic' }}>"{e.note}"</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
