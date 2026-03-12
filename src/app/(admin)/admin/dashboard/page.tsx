'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, ShoppingBag, CheckCircle, XCircle,
  Clock, ArrowRight, RefreshCw, Banknote, AlertTriangle,
  ChevronDown, ChevronRight, MapPin
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';

// ─── Types ──────────────────────────────────────────────────
interface DashStats {
  todaySales: number; todayOrders: number; pendingOrders: number;
  completedOrders: number; cancelledOrders: number; avgOrderValue: number;
}
interface TableStatus { id: string; name: string; status: 'EMPTY' | 'OCCUPIED' | 'READY'; }
interface Alert       { id: string; msg: string; time: string; color: string; }

// ─── Status maps ─────────────────────────────────────────────
const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING:'#f59e0b', CONFIRMED:'#6366f1', PREPARING:'#f97316',
  READY:'#22c55e',   COMPLETED:'#10b981', CANCELLED:'#ef4444',
};
const STATUS_BG: Record<OrderStatus, string> = {
  PENDING:'rgba(245,158,11,0.12)',   CONFIRMED:'rgba(99,102,241,0.12)',
  PREPARING:'rgba(249,115,22,0.12)', READY:'rgba(34,197,94,0.12)',
  COMPLETED:'rgba(16,185,129,0.12)', CANCELLED:'rgba(239,68,68,0.12)',
};
const STATUS_NEXT: Partial<Record<OrderStatus, { label: string; next: OrderStatus; color: string }>> = {
  PENDING:   { label: 'Confirm',       next: 'CONFIRMED',  color: '#6366f1' },
  CONFIRMED: { label: 'Start Cooking', next: 'PREPARING',  color: '#f97316' },
  PREPARING: { label: 'Mark Ready',    next: 'READY',      color: '#22c55e' },
  READY:     { label: 'Complete',      next: 'COMPLETED',  color: '#10b981' },
};
// Default cancel reason used from dashboard quick-cancel
const DASHBOARD_CANCEL_REASON = 'Customer changed mind';

function fmtTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return new Date(iso).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
}

// ─── Component ───────────────────────────────────────────────
export default function DashboardPage() {
  const [stats,         setStats]         = useState<DashStats>({ todaySales:0, todayOrders:0, pendingOrders:0, completedOrders:0, cancelledOrders:0, avgOrderValue:0 });
  const [liveOrders,    setLiveOrders]    = useState<Order[]>([]);
  const [tables,        setTables]        = useState<TableStatus[]>([]);
  const [alerts,        setAlerts]        = useState<Alert[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [tenantSlug,    setTenantSlug]    = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [bumping,       setBumping]       = useState<string | null>(null);

  useEffect(() => {
    const stored  = localStorage.getItem('tyg_tenant');
    const session = localStorage.getItem('tyg_session');
    let slug = '';
    if (stored)  { try { const t = JSON.parse(stored)  as { slug?: string }; slug = t.slug ?? ''; } catch { /* */ } }
    if (session) { try { const s = JSON.parse(session) as { tenantSlug?: string }; if (s.tenantSlug) slug = s.tenantSlug; } catch { /* */ } }
    setTenantSlug(slug);
  }, []);

  // ── Fetch orders ── apiSuccess wraps as { data: T, error: null } ──────
  const loadOrders = useCallback(async (slug: string) => {
    if (!slug) return;
    try {
      // Active orders for the live board
      const r = await fetch(`/api/orders?tenantSlug=${slug}&status=active&limit=12`, { credentials: 'include' });
      if (!r.ok) { setLoading(false); setRefreshing(false); return; }
      const d = await r.json() as { data?: Order[] };
      const activeOrders = d.data ?? [];

      // All today's orders for stats
      const r2 = await fetch(`/api/orders?tenantSlug=${slug}&limit=200`, { credentials: 'include' });
      const d2 = r2.ok ? await r2.json() as { data?: Order[] } : { data: [] as Order[] };
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayAll   = (d2.data ?? []).filter((o: Order) => new Date(o.created_at) >= todayStart && !o.is_test);
      const completed  = todayAll.filter((o: Order) => o.status === 'COMPLETED');
      const totalSales = completed.reduce((s: number, o: Order) => s + Number(o.total_amount), 0);

      setStats({
        todaySales:      totalSales,
        todayOrders:     todayAll.length,
        pendingOrders:   activeOrders.length,
        completedOrders: completed.length,
        cancelledOrders: todayAll.filter((o: Order) => o.status === 'CANCELLED').length,
        avgOrderValue:   completed.length > 0 ? totalSales / completed.length : 0,
      });
      setLiveOrders(activeOrders.slice(0, 8));

      // Alerts: long-wait pending orders
      const newAlerts: Alert[] = [];
      activeOrders.forEach((o: Order) => {
        const mins = (Date.now() - new Date(o.created_at).getTime()) / 60_000;
        if (mins > 20 && o.status === 'PENDING') {
          newAlerts.push({
            id: o.id, color: '#ef4444', time: fmtTime(o.created_at),
            msg: `Order #${o.order_number} — waiting ${Math.floor(mins)}min with no update`,
          });
        }
      });
      setAlerts(newAlerts);

      // Update floor mock from active orders
      setTables([
        { id:'t1', name:'Table 1', status:'EMPTY' },
        { id:'t2', name:'Table 2', status: activeOrders.some((o: Order) => o.status === 'PREPARING') ? 'OCCUPIED' : 'EMPTY' },
        { id:'t3', name:'Table 3', status:'EMPTY' },
        { id:'t4', name:'Table 4', status: activeOrders.length > 0 ? 'OCCUPIED' : 'EMPTY' },
        { id:'t5', name:'Garden',  status: activeOrders.some((o: Order) => o.status === 'READY') ? 'READY' : 'EMPTY' },
        { id:'t6', name:'Balcony', status: activeOrders.length > 1 ? 'OCCUPIED' : 'EMPTY' },
      ]);
    } catch { /* silent fail */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (tenantSlug) void loadOrders(tenantSlug); }, [tenantSlug, loadOrders]);
  useEffect(() => {
    if (!tenantSlug) return;
    const id = setInterval(() => void loadOrders(tenantSlug), 20_000);
    return () => clearInterval(id);
  }, [tenantSlug, loadOrders]);

  // ── Bump status ── cancel requires a reason (API validation) ─────────
  const bumpStatus = async (orderId: string, newStatus: OrderStatus) => {
    setBumping(orderId);
    try {
      const body: Record<string, string> = { status: newStatus };
      // CANCELLED requires a cancelReason — API returns 400 without it
      if (newStatus === 'CANCELLED') body['cancelReason'] = DASHBOARD_CANCEL_REASON;

      const r = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (r.ok && tenantSlug) {
        await loadOrders(tenantSlug);
        setExpandedOrder(null);
      }
    } catch { /* */ } finally { setBumping(null); }
  };

  const handleRefresh = () => { setRefreshing(true); void loadOrders(tenantSlug); };

  // ─── Stat cards ──────────────────────────────────────────────────────
  const statCards = [
    { label:"Today's Revenue", value:`₱${stats.todaySales.toLocaleString('en-PH',{minimumFractionDigits:0})}`, icon:Banknote,    color:'#22c55e', bg:'rgba(34,197,94,0.08)',   sub:`${stats.completedOrders} orders completed` },
    { label:'Active Orders',   value:stats.pendingOrders,                                                        icon:Clock,      color:'#f59e0b', bg:'rgba(245,158,11,0.08)',  sub:'Needs attention now' },
    { label:'Total Today',     value:stats.todayOrders,                                                          icon:ShoppingBag,color:'#6366f1', bg:'rgba(99,102,241,0.08)', sub:'Since midnight' },
    { label:'Avg Order',       value:`₱${stats.avgOrderValue.toLocaleString('en-PH',{minimumFractionDigits:0})}`, icon:TrendingUp, color:'#f97316', bg:'rgba(249,115,22,0.08)', sub:'Per completed order' },
  ];

  const tableColor  = { EMPTY:'rgba(90,106,130,0.15)',   OCCUPIED:'rgba(245,158,11,0.12)',  READY:'rgba(34,197,94,0.12)'  };
  const tableText   = { EMPTY:'#5a6a82',                 OCCUPIED:'#f59e0b',                READY:'#22c55e'               };
  const tableBorder = { EMPTY:'rgba(255,255,255,0.06)',   OCCUPIED:'rgba(245,158,11,0.3)',   READY:'rgba(34,197,94,0.3)'   };

  return (
    <div style={{ color:'var(--text)' }}>
      {/* ── Header ── */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
        <p style={{ color:'var(--text-muted)',fontSize:13 }}>
          {new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
        </p>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <button onClick={handleRefresh}
            style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',
              borderRadius:9,background:'var(--surface-2)',border:'1px solid var(--border)',
              color:'var(--text-muted)',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit' }}>
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          <Link href="/admin/orders"
            style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 16px',
              borderRadius:9,background:'linear-gradient(135deg,#22c55e,#16a34a)',
              color:'white',fontSize:13,fontWeight:700,textDecoration:'none' }}>
            All Orders <ArrowRight size={13} />
          </Link>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
        {statCards.map(c => (
          <div key={c.label} style={{ background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'18px 20px' }}>
            <div style={{ width:38,height:38,borderRadius:11,background:c.bg,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14 }}>
              <c.icon size={17} style={{ color:c.color }} />
            </div>
            <div style={{ fontSize:26,fontWeight:800,letterSpacing:'-0.02em',lineHeight:1 }}>
              {loading ? <span style={{ color:'var(--text-muted)' }}>—</span> : c.value}
            </div>
            <div style={{ color:'var(--text-muted)',fontSize:12,marginTop:6 }}>{c.label}</div>
            <div style={{ color:'var(--text-dim)',fontSize:11,marginTop:2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main 2-col grid ── */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 300px',gap:16,alignItems:'start' }}>

        {/* ── Live Orders — command center ── */}
        <div style={{ background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'14px 18px',borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <h3 style={{ fontWeight:700,fontSize:15 }}>Live Orders</h3>
              <span style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#22c55e' }}>
                <span style={{ width:6,height:6,borderRadius:'50%',background:'#22c55e',
                  display:'inline-block',animation:'pulse-dot 2s infinite' }} />
                Realtime
              </span>
            </div>
            <Link href="/admin/orders" style={{ color:'var(--text-muted)',fontSize:12,textDecoration:'none' }}>
              View all →
            </Link>
          </div>
          <div style={{ padding:'8px' }}>
            {loading ? (
              <div style={{ padding:'32px',textAlign:'center',color:'var(--text-muted)' }}>Loading orders...</div>
            ) : liveOrders.length === 0 ? (
              <div style={{ padding:'48px 24px',textAlign:'center' }}>
                <CheckCircle size={28} style={{ color:'var(--text-muted)',margin:'0 auto 10px' }} />
                <p style={{ color:'var(--text-muted)',fontSize:14 }}>All caught up — no active orders</p>
              </div>
            ) : (
              liveOrders.map((order: Order) => {
                const isExpanded = expandedOrder === order.id;
                const next = STATUS_NEXT[order.status as OrderStatus];
                const isBumping = bumping === order.id;
                return (
                  <div key={order.id} style={{ borderRadius:12,marginBottom:4,overflow:'hidden',
                    border:`1px solid ${isExpanded ? 'var(--border2)' : 'transparent'}`,
                    background: isExpanded ? 'var(--surface-2)' : 'transparent',transition:'all 0.15s' }}>
                    <div onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer' }}>
                      <div style={{ width:3,height:36,borderRadius:99,background:STATUS_COLOR[order.status as OrderStatus],flexShrink:0 }} />
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3 }}>
                          <span style={{ fontWeight:700,fontSize:14 }}>#{order.order_number}</span>
                          <span style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:99,
                            letterSpacing:'0.05em',textTransform:'uppercase' as const,
                            color:STATUS_COLOR[order.status as OrderStatus],background:STATUS_BG[order.status as OrderStatus] }}>
                            {order.status}
                          </span>
                          <span style={{ fontSize:11,color:'var(--text-muted)',marginLeft:'auto' }}>{fmtTime(order.created_at)}</span>
                        </div>
                        <div style={{ fontSize:12,color:'var(--text-dim)' }}>
                          {order.customer_name}{order.pax ? ` · ${order.pax} pax` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign:'right',flexShrink:0,marginRight:4 }}>
                        <div style={{ fontWeight:800,fontSize:14 }}>₱{Number(order.total_amount).toFixed(0)}</div>
                      </div>
                      {isExpanded
                        ? <ChevronDown size={14} style={{ color:'var(--text-muted)',flexShrink:0 }} />
                        : <ChevronRight size={14} style={{ color:'var(--text-muted)',flexShrink:0 }} />
                      }
                    </div>
                    {/* Inline actions */}
                    {isExpanded && (
                      <div style={{ padding:'0 14px 12px',display:'flex',gap:6,flexWrap:'wrap' as const }}>
                        {next && (
                          <button onClick={() => void bumpStatus(order.id, next.next)} disabled={isBumping}
                            style={{ flex:1,fontSize:12,fontWeight:700,padding:'8px 10px',borderRadius:9,
                              cursor:'pointer',background:next.color+'20',color:next.color,
                              border:`1px solid ${next.color}40`,opacity:isBumping ? 0.5 : 1,
                              fontFamily:'inherit',transition:'all 0.1s' }}>
                            {isBumping ? '...' : `→ ${next.label}`}
                          </button>
                        )}
                        <Link href={`/admin/orders`}
                          style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:600,
                            padding:'8px 12px',borderRadius:9,background:'var(--surface-3)',
                            color:'var(--text-dim)',textDecoration:'none',border:'1px solid var(--border)' }}>
                          Details
                        </Link>
                        {!['COMPLETED','CANCELLED'].includes(order.status) && (
                          <button onClick={() => void bumpStatus(order.id, 'CANCELLED')} disabled={isBumping}
                            style={{ fontSize:12,fontWeight:600,padding:'8px 10px',borderRadius:9,
                              cursor:'pointer',background:'rgba(239,68,68,0.08)',color:'#ef4444',
                              border:'1px solid rgba(239,68,68,0.2)',fontFamily:'inherit',
                              opacity:isBumping ? 0.5 : 1 }}>
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
              <p style={{ fontSize:11,color:'var(--text-muted)',textAlign:'center',padding:'6px 0 2px' }}>
                Click any order to take action inline
              </p>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>

          {/* Floor Plan */}
          <div style={{ background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 16px',borderBottom:'1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontWeight:700,fontSize:14 }}>Floor Plan</h3>
                <p style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>Main Garden</p>
              </div>
              <Link href="/admin/tables" style={{ color:'var(--text-muted)',textDecoration:'none' }}>
                <MapPin size={14} />
              </Link>
            </div>
            <div style={{ padding:12,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8 }}>
              {tables.map((t: TableStatus) => (
                <div key={t.id} style={{ background:tableColor[t.status],border:`1px solid ${tableBorder[t.status]}`,
                  borderRadius:10,padding:'10px 6px',textAlign:'center' as const,cursor:'pointer',transition:'all 0.15s' }}>
                  <div style={{ fontSize:12,fontWeight:700,color:tableText[t.status] }}>{t.name}</div>
                  <div style={{ fontSize:9,color:tableText[t.status],marginTop:3,fontWeight:600,
                    textTransform:'uppercase' as const,letterSpacing:'0.06em' }}>
                    {t.status === 'OCCUPIED' ? '● Busy' : t.status === 'READY' ? '✓ Ready' : 'Empty'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div style={{ background:'var(--surface)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:14 }}>
              <div style={{ padding:'13px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8 }}>
                <AlertTriangle size={14} color="#f59e0b" />
                <h3 style={{ fontWeight:700,fontSize:14,color:'#fbbf24' }}>Alerts ({alerts.length})</h3>
              </div>
              <div style={{ padding:10,display:'flex',flexDirection:'column',gap:6 }}>
                {alerts.map((a: Alert) => (
                  <div key={a.id} style={{ padding:'9px 11px',background:a.color+'0d',
                    border:`1px solid ${a.color}28`,borderRadius:9,display:'flex',gap:8,alignItems:'flex-start' }}>
                    <div style={{ width:6,height:6,borderRadius:'50%',background:a.color,marginTop:4,flexShrink:0 }} />
                    <div>
                      <p style={{ fontSize:12,color:'var(--text)',lineHeight:1.4,margin:0 }}>{a.msg}</p>
                      <p style={{ fontSize:10,color:'var(--text-muted)',marginTop:3 }}>{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div style={{ background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14 }}>
            <div style={{ padding:'13px 16px',borderBottom:'1px solid var(--border)' }}>
              <h3 style={{ fontWeight:700,fontSize:14 }}>Today&apos;s Summary</h3>
            </div>
            <div style={{ padding:16,display:'flex',flexDirection:'column',gap:12 }}>
              {[
                { label:'Completed', value:stats.completedOrders, color:'#22c55e', icon:CheckCircle },
                { label:'Active',    value:stats.pendingOrders,   color:'#f59e0b', icon:Clock },
                { label:'Cancelled', value:stats.cancelledOrders, color:'#ef4444', icon:XCircle },
              ].map(item => (
                <div key={item.label} style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <item.icon size={14} style={{ color:item.color }} />
                    <span style={{ color:'var(--text-dim)',fontSize:13 }}>{item.label}</span>
                  </div>
                  <span style={{ fontWeight:700,fontSize:15,color:item.color }}>{item.value}</span>
                </div>
              ))}
              <div style={{ height:1,background:'var(--border)',margin:'2px 0' }} />
              <div>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:7 }}>
                  <span style={{ color:'var(--text-dim)',fontSize:12 }}>Completion Rate</span>
                  <span style={{ fontWeight:700,fontSize:13,color:'var(--text)' }}>
                    {stats.todayOrders > 0 ? Math.round((stats.completedOrders/stats.todayOrders)*100) : 0}%
                  </span>
                </div>
                <div style={{ height:6,background:'var(--surface-3)',borderRadius:99,overflow:'hidden' }}>
                  <div style={{ height:'100%',borderRadius:99,
                    width:`${stats.todayOrders > 0 ? (stats.completedOrders/stats.todayOrders)*100 : 0}%`,
                    background:'linear-gradient(90deg,#22c55e,#16a34a)',transition:'width 0.6s ease' }} />
                </div>
              </div>
            </div>
            <div style={{ padding:'10px 12px 14px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:6 }}>
              {[
                { href:`/kitchen${tenantSlug?`?tenant=${tenantSlug}`:''}`, label:'Open Kitchen Display', color:'#f97316', bg:'rgba(249,115,22,0.08)', border:'rgba(249,115,22,0.2)' },
                { href:'/admin/analytics', label:'View Analytics', color:'var(--text-dim)', bg:'var(--surface-2)', border:'var(--border)' },
              ].map(a => (
                <Link key={a.label} href={a.href}
                  style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
                    padding:'10px 12px',borderRadius:10,textDecoration:'none',fontSize:13,fontWeight:600,
                    background:a.bg,color:a.color,border:`1px solid ${a.border}` }}>
                  {a.label} <ArrowRight size={13} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
