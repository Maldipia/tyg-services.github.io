'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, ShoppingBag, CheckCircle, XCircle,
  Clock, ArrowRight, RefreshCw, Banknote, AlertTriangle,
  ChevronDown, ChevronRight
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';

interface DashStats {
  todaySales: number; todayOrders: number; pendingOrders: number;
  completedOrders: number; cancelledOrders: number; avgOrderValue: number;
}
interface TableStatus { id: string; name: string; status: 'EMPTY' | 'OCCUPIED' | 'READY'; }
interface Alert { id: string; msg: string; time: string; color: string; }

const STATUS_COLOR: Record<string, string> = {
  PENDING:'#f59e0b', CONFIRMED:'#6366f1', PREPARING:'#f97316',
  READY:'#22c55e', COMPLETED:'#10b981', CANCELLED:'#ef4444',
};
const STATUS_BG: Record<string, string> = {
  PENDING:'rgba(245,158,11,0.12)', CONFIRMED:'rgba(99,102,241,0.12)',
  PREPARING:'rgba(249,115,22,0.12)', READY:'rgba(34,197,94,0.12)',
  COMPLETED:'rgba(16,185,129,0.12)', CANCELLED:'rgba(239,68,68,0.12)',
};
const STATUS_NEXT: Partial<Record<string, { label: string; next: string; color: string }>> = {
  PENDING:   { label: 'Confirm',       next: 'CONFIRMED', color: '#6366f1' },
  CONFIRMED: { label: 'Start Cooking', next: 'PREPARING', color: '#f97316' },
  PREPARING: { label: 'Mark Ready',    next: 'READY',     color: '#22c55e' },
  READY:     { label: 'Complete',      next: 'COMPLETED', color: '#10b981' },
};

function fmtTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms/60000)}m ago`;
  return new Date(iso).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats>({ todaySales:0, todayOrders:0, pendingOrders:0, completedOrders:0, cancelledOrders:0, avgOrderValue:0 });
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string|null>(null);
  const [bumping, setBumping] = useState<string|null>(null);

  useEffect(() => {
    let slug = '';
    try { const t = JSON.parse(localStorage.getItem('tyg_tenant')||'{}') as {slug?:string}; slug = t.slug ?? ''; } catch{/**/}
    if (!slug) try { const s = JSON.parse(localStorage.getItem('tyg_session')||'{}') as {tenantSlug?:string}; slug = s.tenantSlug ?? ''; } catch{/**/}
    setTenantSlug(slug);
  }, []);

  const loadOrders = useCallback(async (slug: string) => {
    if (!slug) return;
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/orders?tenantSlug=${slug}&status=active&limit=12`, { credentials:'include' }),
        fetch(`/api/orders?tenantSlug=${slug}&limit=200`, { credentials:'include' }),
      ]);
      const d1 = r1.ok ? await r1.json() as {data?:Order[]} : {data:[]};
      const d2 = r2.ok ? await r2.json() as {data?:Order[]} : {data:[]};
      const active = d1.data ?? [];
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayAll = (d2.data ?? []).filter((o:Order) => new Date(o.created_at) >= todayStart && !o.is_test);
      const completed = todayAll.filter((o:Order) => o.status === 'COMPLETED');
      const sales = completed.reduce((s:number,o:Order) => s + Number(o.total_amount), 0);
      setStats({
        todaySales: sales, todayOrders: todayAll.length, pendingOrders: active.length,
        completedOrders: completed.length,
        cancelledOrders: todayAll.filter((o:Order) => o.status === 'CANCELLED').length,
        avgOrderValue: completed.length > 0 ? sales / completed.length : 0,
      });
      setLiveOrders(active.slice(0,8));
      const newAlerts: Alert[] = [];
      active.forEach((o:Order) => {
        const mins = (Date.now() - new Date(o.created_at).getTime()) / 60000;
        if (mins > 20 && o.status === 'PENDING') newAlerts.push({
          id: o.id, color: '#ef4444', time: fmtTime(o.created_at),
          msg: `#${o.order_number} waiting ${Math.floor(mins)}min — needs confirmation`,
        });
      });
      setAlerts(newAlerts);
      setTables([
        { id:'t1', name:'Table 1', status:'EMPTY' },
        { id:'t2', name:'Table 2', status: active.some((o:Order)=>o.status==='PREPARING')?'OCCUPIED':'EMPTY' },
        { id:'t3', name:'Table 3', status:'EMPTY' },
        { id:'t4', name:'Table 4', status: active.length>0?'OCCUPIED':'EMPTY' },
        { id:'t5', name:'Garden',  status: active.some((o:Order)=>o.status==='READY')?'READY':'EMPTY' },
        { id:'t6', name:'Balcony', status: active.length>1?'OCCUPIED':'EMPTY' },
      ]);
    } catch{/**/} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { if (tenantSlug) void loadOrders(tenantSlug); }, [tenantSlug, loadOrders]);
  useEffect(() => {
    if (!tenantSlug) return;
    const id = setInterval(() => void loadOrders(tenantSlug), 20000);
    return () => clearInterval(id);
  }, [tenantSlug, loadOrders]);

  const bumpStatus = async (orderId: string, newStatus: string) => {
    setBumping(orderId);
    try {
      const body: Record<string,string> = { status: newStatus };
      if (newStatus === 'CANCELLED') body['cancelReason'] = 'Customer changed mind';
      const r = await fetch(`/api/orders/${orderId}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        credentials:'include', body: JSON.stringify(body),
      });
      if (r.ok) { await loadOrders(tenantSlug); setExpandedOrder(null); }
    } catch{/**/} finally { setBumping(null); }
  };

  const handleRefresh = () => { setRefreshing(true); void loadOrders(tenantSlug); };

  // ── Table colors
  const tColor  = { EMPTY:'rgba(255,255,255,0.03)', OCCUPIED:'rgba(245,158,11,0.1)', READY:'rgba(34,197,94,0.1)' };
  const tText   = { EMPTY:'#4b5563', OCCUPIED:'#f59e0b', READY:'#22c55e' };
  const tBorder = { EMPTY:'rgba(255,255,255,0.05)', OCCUPIED:'rgba(245,158,11,0.25)', READY:'rgba(34,197,94,0.25)' };

  const pct = stats.todayOrders > 0 ? Math.round((stats.completedOrders/stats.todayOrders)*100) : 0;

  return (
    <div style={{ color:'var(--text)', maxWidth:1200 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}`}</style>

      {/* ── Top bar ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <p style={{ color:'var(--text-muted)', fontSize:13 }}>
          {new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
        </p>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleRefresh}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8,
              background:'var(--surface-2)', border:'1px solid var(--border)', color:'var(--text-muted)',
              fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
            <RefreshCw size={11} style={{ animation:refreshing?'spin 0.8s linear infinite':'none' }}/>
            Refresh
          </button>
          <Link href="/admin/orders"
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8,
              background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'white',
              fontSize:12, fontWeight:700, textDecoration:'none' }}>
            All Orders <ArrowRight size={12}/>
          </Link>
        </div>
      </div>

      {/* ── KPI Row — compact ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:"Today's Revenue", value: loading?'—':`₱${stats.todaySales.toLocaleString('en-PH')}`, icon:Banknote, color:'#22c55e', bg:'rgba(34,197,94,0.07)', sub:`${stats.completedOrders} completed` },
          { label:'Active Orders',   value: loading?'—':String(stats.pendingOrders), icon:Clock, color:'#f59e0b', bg:'rgba(245,158,11,0.07)', sub:'Needs attention' },
          { label:'Total Today',     value: loading?'—':String(stats.todayOrders), icon:ShoppingBag, color:'#6366f1', bg:'rgba(99,102,241,0.07)', sub:'Since midnight' },
          { label:'Avg Order Value', value: loading?'—':`₱${Math.round(stats.avgOrderValue).toLocaleString('en-PH')}`, icon:TrendingUp, color:'#f97316', bg:'rgba(249,115,22,0.07)', sub:'Per completed order' },
        ].map(c => (
          <div key={c.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <c.icon size={16} style={{ color:c.color }}/>
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.02em', lineHeight:1.1, color:'var(--text)' }}>{c.value}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{c.label}</div>
              <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:1 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Alerts bar (only if any) ── */}
      {alerts.length > 0 && (
        <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
          <AlertTriangle size={14} color="#ef4444"/>
          <span style={{ fontSize:13, color:'#ef4444', fontWeight:600 }}>{alerts.length} alert{alerts.length>1?'s':''}</span>
          <span style={{ fontSize:12, color:'var(--text-muted)', flex:1 }}>{alerts[0]!.msg}</span>
        </div>
      )}

      {/* ── Main 2-col grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:12, alignItems:'start' }}>

        {/* Live Orders */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:14 }}>Live Orders</span>
              <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#22c55e' }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'blink 2s infinite' }}/>
                Realtime
              </span>
              {stats.pendingOrders > 0 && (
                <span style={{ minWidth:18, height:18, borderRadius:99, background:'#f59e0b', color:'white', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px' }}>
                  {stats.pendingOrders}
                </span>
              )}
            </div>
            <Link href="/admin/orders" style={{ fontSize:11, color:'var(--text-muted)', textDecoration:'none' }}>View all →</Link>
          </div>

          <div style={{ padding:6 }}>
            {loading ? (
              <div style={{ padding:'28px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Loading orders…</div>
            ) : liveOrders.length === 0 ? (
              <div style={{ padding:'32px 16px', textAlign:'center' }}>
                <CheckCircle size={26} style={{ color:'var(--text-dim)', margin:'0 auto 8px', display:'block' }}/>
                <p style={{ color:'var(--text-muted)', fontSize:13, fontWeight:600 }}>All caught up</p>
                <p style={{ color:'var(--text-dim)', fontSize:12, marginTop:4 }}>No active orders right now</p>
              </div>
            ) : (
              liveOrders.map((order:Order) => {
                const expanded = expandedOrder === order.id;
                const next = STATUS_NEXT[order.status as string];
                const isBumping = bumping === order.id;
                return (
                  <div key={order.id} style={{ borderRadius:10, marginBottom:3, overflow:'hidden',
                    border:`1px solid ${expanded?'rgba(255,255,255,0.08)':'transparent'}`,
                    background:expanded?'var(--surface-2)':'transparent', transition:'all 0.12s' }}>
                    <div onClick={()=>setExpandedOrder(expanded?null:order.id)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', cursor:'pointer' }}>
                      <div style={{ width:3, height:32, borderRadius:99, background:STATUS_COLOR[order.status as string]??'#888', flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                          <span style={{ fontWeight:700, fontSize:13 }}>#{order.order_number}</span>
                          <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:99, textTransform:'uppercase' as const, letterSpacing:'0.05em',
                            color:STATUS_COLOR[order.status as string], background:STATUS_BG[order.status as string] }}>
                            {order.status}
                          </span>
                          <span style={{ fontSize:11, color:'var(--text-dim)', marginLeft:'auto' }}>{fmtTime(order.created_at)}</span>
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                          {order.customer_name}{order.pax?` · ${order.pax} pax`:''}
                        </div>
                      </div>
                      <div style={{ fontWeight:800, fontSize:13, flexShrink:0, marginRight:4 }}>₱{Number(order.total_amount).toFixed(0)}</div>
                      {expanded ? <ChevronDown size={12} style={{color:'var(--text-dim)',flexShrink:0}}/> : <ChevronRight size={12} style={{color:'var(--text-dim)',flexShrink:0}}/>}
                    </div>
                    {expanded && (
                      <div style={{ padding:'0 12px 10px', display:'flex', gap:6, flexWrap:'wrap' as const }}>
                        {next && (
                          <button onClick={()=>void bumpStatus(order.id, next.next)} disabled={isBumping}
                            style={{ flex:1, fontSize:12, fontWeight:700, padding:'7px 10px', borderRadius:8, cursor:'pointer',
                              background:next.color+'18', color:next.color, border:`1px solid ${next.color}35`,
                              opacity:isBumping?0.5:1, fontFamily:'inherit' }}>
                            {isBumping?'…':`→ ${next.label}`}
                          </button>
                        )}
                        {!['COMPLETED','CANCELLED'].includes(order.status) && (
                          <button onClick={()=>void bumpStatus(order.id,'CANCELLED')} disabled={isBumping}
                            style={{ fontSize:12, fontWeight:600, padding:'7px 10px', borderRadius:8, cursor:'pointer',
                              background:'rgba(239,68,68,0.07)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.18)',
                              fontFamily:'inherit', opacity:isBumping?0.5:1 }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {liveOrders.length > 0 && !loading && (
              <p style={{ fontSize:10, color:'var(--text-dim)', textAlign:'center', padding:'4px 0 2px' }}>
                Tap any order to act inline
              </p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

          {/* Floor Plan */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', borderBottom:'1px solid var(--border)' }}>
              <div>
                <span style={{ fontWeight:700, fontSize:13 }}>Floor Plan</span>
                <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:8 }}>Main Garden</span>
              </div>
              <Link href="/admin/tables" style={{ fontSize:10, color:'var(--text-muted)', textDecoration:'none' }}>Manage →</Link>
            </div>
            <div style={{ padding:10, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
              {tables.map((t:TableStatus) => (
                <div key={t.id} style={{ background:tColor[t.status], border:`1px solid ${tBorder[t.status]}`,
                  borderRadius:8, padding:'8px 4px', textAlign:'center' as const }}>
                  <div style={{ fontSize:11, fontWeight:700, color:tText[t.status] }}>{t.name}</div>
                  <div style={{ fontSize:9, color:tText[t.status], marginTop:2, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.05em' }}>
                    {t.status==='OCCUPIED'?'Busy':t.status==='READY'?'Ready':'Free'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today Summary */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12 }}>
            <div style={{ padding:'11px 14px', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontWeight:700, fontSize:13 }}>Today&apos;s Summary</span>
            </div>
            <div style={{ padding:14 }}>
              {[
                { label:'Completed', value:stats.completedOrders, color:'#22c55e', icon:CheckCircle },
                { label:'Active',    value:stats.pendingOrders,   color:'#f59e0b', icon:Clock },
                { label:'Cancelled', value:stats.cancelledOrders, color:'#ef4444', icon:XCircle },
              ].map(item => (
                <div key={item.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <item.icon size={12} style={{ color:item.color }}/>
                    <span style={{ color:'var(--text-dim)', fontSize:12 }}>{item.label}</span>
                  </div>
                  <span style={{ fontWeight:800, fontSize:14, color:item.color }}>{item.value}</span>
                </div>
              ))}
              <div style={{ marginTop:4 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:11, color:'var(--text-dim)' }}>Completion</span>
                  <span style={{ fontSize:12, fontWeight:700 }}>{pct}%</span>
                </div>
                <div style={{ height:5, background:'var(--surface-3)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:99, width:`${pct}%`,
                    background:'linear-gradient(90deg,#22c55e,#16a34a)', transition:'width 0.6s ease' }}/>
                </div>
              </div>
            </div>
            <div style={{ padding:'8px 10px 12px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:6 }}>
              <Link href={`/kitchen${tenantSlug?`?tenant=${tenantSlug}`:''}`}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px',
                  borderRadius:9, textDecoration:'none', fontSize:12, fontWeight:700,
                  background:'rgba(249,115,22,0.08)', color:'#f97316', border:'1px solid rgba(249,115,22,0.2)' }}>
                Open Kitchen Display <ArrowRight size={12}/>
              </Link>
              <Link href="/admin/analytics"
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px',
                  borderRadius:9, textDecoration:'none', fontSize:12, fontWeight:600,
                  background:'var(--surface-2)', color:'var(--text-dim)', border:'1px solid var(--border)' }}>
                View Analytics <ArrowRight size={12}/>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
