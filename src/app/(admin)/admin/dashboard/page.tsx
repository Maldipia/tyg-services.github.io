'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, ShoppingBag, CheckCircle, XCircle, Clock,
  ArrowRight, RefreshCw, Banknote, AlertTriangle,
  ChevronDown, ChevronRight, BarChart2
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';

interface DashStats {
  todaySales: number; todayOrders: number; pendingOrders: number;
  completedOrders: number; cancelledOrders: number; avgOrderValue: number;
}
interface TableStatus { id: string; name: string; status: 'EMPTY' | 'OCCUPIED' | 'READY'; }

const SC: Record<string, string> = {
  PENDING:'#F59E0B', CONFIRMED:'#6366f1', PREPARING:'#f97316',
  READY:'#22c55e', COMPLETED:'#10b981', CANCELLED:'#ef4444',
};
const SB: Record<string, string> = {
  PENDING:'rgba(245,158,11,0.12)', CONFIRMED:'rgba(99,102,241,0.12)',
  PREPARING:'rgba(249,115,22,0.12)', READY:'rgba(34,197,94,0.12)',
  COMPLETED:'rgba(16,185,129,0.12)', CANCELLED:'rgba(239,68,68,0.12)',
};
const STATUS_NEXT: Partial<Record<string, { label: string; next: string; color: string }>> = {
  PENDING:   { label:'Confirm',       next:'CONFIRMED', color:'#6366f1' },
  CONFIRMED: { label:'Start Cooking', next:'PREPARING', color:'#f97316' },
  PREPARING: { label:'Mark Ready',    next:'READY',     color:'#22c55e' },
  READY:     { label:'Complete',      next:'COMPLETED', color:'#10b981' },
};

function fmtTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

// ── Token shortcuts
const S = {
  card: { background:'#141820', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12 } as React.CSSProperties,
  text: '#F0F2F7', muted: '#8892A4', dim: '#4B5563',
  brand: '#22c55e', brandDim: 'rgba(34,197,94,0.10)', brandBorder: 'rgba(34,197,94,0.20)',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats>({ todaySales:0, todayOrders:0, pendingOrders:0, completedOrders:0, cancelledOrders:0, avgOrderValue:0 });
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [bumping, setBumping] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; msg: string }[]>([]);

  useEffect(() => {
    let slug = '';
    try { const t = JSON.parse(localStorage.getItem('tyg_tenant') || '{}') as { slug?: string; name?: string }; slug = t.slug ?? ''; setTenantName(t.name ?? ''); } catch {/**/}
    if (!slug) try { const s = JSON.parse(localStorage.getItem('tyg_session') || '{}') as { tenantSlug?: string }; slug = s.tenantSlug ?? ''; } catch {/**/}
    try { const s = JSON.parse(localStorage.getItem('tyg_session') || '{}') as { displayName?: string }; setStaffName(s.displayName ?? ''); } catch {/**/}
    setTenantSlug(slug);
  }, []);

  const loadOrders = useCallback(async (slug: string) => {
    if (!slug) return;
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/orders?tenantSlug=${slug}&status=active&limit=12`, { credentials: 'include' }),
        fetch(`/api/orders?tenantSlug=${slug}&limit=200`, { credentials: 'include' }),
      ]);
      const d1 = r1.ok ? await r1.json() as { data?: Order[] } : { data: [] };
      const d2 = r2.ok ? await r2.json() as { data?: Order[] } : { data: [] };
      const active = d1.data ?? [];
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayAll = (d2.data ?? []).filter((o: Order) => new Date(o.created_at) >= todayStart && !o.is_test);
      const completed = todayAll.filter((o: Order) => o.status === 'COMPLETED');
      const sales = completed.reduce((s: number, o: Order) => s + Number(o.total_amount), 0);
      setStats({
        todaySales: sales, todayOrders: todayAll.length, pendingOrders: active.length,
        completedOrders: completed.length,
        cancelledOrders: todayAll.filter((o: Order) => o.status === 'CANCELLED').length,
        avgOrderValue: completed.length > 0 ? sales / completed.length : 0,
      });
      setLiveOrders(active.slice(0, 8));
      const newAlerts: { id: string; msg: string }[] = [];
      active.forEach((o: Order) => {
        const mins = (Date.now() - new Date(o.created_at).getTime()) / 60000;
        if (mins > 20 && o.status === 'PENDING') newAlerts.push({ id: o.id, msg: `Order #${o.order_number} waiting ${Math.floor(mins)}min — needs confirmation` });
      });
      setAlerts(newAlerts);
      const tablesRes = await fetch(`/api/tables?tenant=${slug}`, { credentials: 'include' });
      if (tablesRes.ok) {
        const tj = await tablesRes.json() as { data?: Array<{ id: string; name: string }> };
        const allT = tj.data ?? [];
        const occupiedIds = new Set(active.filter((o: Order) => o.table_id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED').map((o: Order) => o.table_id));
        const readyIds = new Set(active.filter((o: Order) => o.table_id && o.status === 'READY').map((o: Order) => o.table_id));
        setTables(allT.slice(0, 14).map(t => ({ id: t.id, name: t.name, status: readyIds.has(t.id) ? 'READY' : occupiedIds.has(t.id) ? 'OCCUPIED' : 'EMPTY' })));
      }
    } catch {/**/} finally { setLoading(false); setRefreshing(false); }
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
      const body: Record<string, string> = { status: newStatus };
      if (newStatus === 'CANCELLED') body['cancelReason'] = 'Customer changed mind';
      const r = await fetch(`/api/orders/${orderId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (r.ok) { await loadOrders(tenantSlug); setExpandedOrder(null); }
    } catch {/**/} finally { setBumping(null); }
  };

  const handleRefresh = () => { setRefreshing(true); void loadOrders(tenantSlug); };

  const tBg: Record<string, string> = { EMPTY:'transparent', OCCUPIED:'rgba(245,158,11,0.08)', READY:'rgba(34,197,94,0.08)' };
  const tTxt: Record<string, string> = { EMPTY:'#4B5563', OCCUPIED:'#F59E0B', READY:'#22c55e' };
  const tBdr: Record<string, string> = { EMPTY:'rgba(255,255,255,0.05)', OCCUPIED:'rgba(245,158,11,0.2)', READY:'rgba(34,197,94,0.2)' };

  const pct = stats.todayOrders > 0 ? Math.round((stats.completedOrders / stats.todayOrders) * 100) : 0;
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; })();
  const greetName = staffName || tenantName.split(' ')[0] || 'there';

  return (
    <div style={{ color: S.text, maxWidth: 1280 }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes ping{0%{transform:scale(1);opacity:0.4}100%{transform:scale(1.6);opacity:0}}
      `}</style>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: S.text, margin: 0, lineHeight: 1.2 }}>
            Good {greeting}, {greetName} 👋
          </h1>
          <p style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRefresh}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#1A1F2C', border: '1px solid rgba(255,255,255,0.08)', color: S.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
          <Link href="/admin/orders"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            All Orders <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── Alert bar ── */}
      {alerts.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={14} color="#ef4444" />
          <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>{alerts.length} alert{alerts.length > 1 ? 's' : ''}</span>
          <span style={{ fontSize: 12, color: S.muted }}>{alerts[0]!.msg}</span>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: "Today's Revenue", value: loading ? '—' : `₱${stats.todaySales.toLocaleString('en-PH')}`, icon: Banknote, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', sub: `${stats.completedOrders} orders completed`, mono: true },
          { label: 'Active Orders',   value: loading ? '—' : String(stats.pendingOrders), icon: Clock, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', sub: stats.pendingOrders > 0 ? 'Needs attention' : 'All clear', mono: false },
          { label: 'Total Today',     value: loading ? '—' : String(stats.todayOrders), icon: ShoppingBag, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', sub: 'Since midnight', mono: false },
          { label: 'Avg Order Value', value: loading ? '—' : `₱${Math.round(stats.avgOrderValue).toLocaleString('en-PH')}`, icon: TrendingUp, color: '#f97316', bg: 'rgba(249,115,22,0.1)', sub: 'Per completed order', mono: true },
        ].map(c => (
          <div key={c.label} style={{ ...S.card, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <c.icon size={17} style={{ color: c.color }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: S.dim, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: S.text, lineHeight: 1.1, fontFamily: c.mono ? "'JetBrains Mono',monospace" : 'inherit', letterSpacing: '-0.02em' }}>{c.value}</div>
              <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid: Orders + Right Column ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 288px', gap: 12, alignItems: 'start' }}>

        {/* Live Orders */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: S.text }}>Live Orders</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#22c55e' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'blink 2s infinite' }} />
                Realtime
              </div>
              {stats.pendingOrders > 0 && (
                <span style={{ minWidth: 20, height: 20, borderRadius: 99, background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                  {stats.pendingOrders}
                </span>
              )}
            </div>
            <Link href="/admin/orders" style={{ fontSize: 11, color: S.muted, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={10} />
            </Link>
          </div>

          <div style={{ padding: 8 }}>
            {loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: S.muted, fontSize: 13 }}>Loading orders…</div>
            ) : liveOrders.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <CheckCircle size={20} style={{ color: '#22c55e' }} />
                </div>
                <p style={{ color: S.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>All caught up</p>
                <p style={{ color: S.muted, fontSize: 12 }}>No active orders right now</p>
              </div>
            ) : (
              liveOrders.map((order: Order) => {
                const expanded = expandedOrder === order.id;
                const next = STATUS_NEXT[order.status as string];
                const isBumping = bumping === order.id;
                const mins = (Date.now() - new Date(order.created_at).getTime()) / 60000;
                const urgent = mins > 15 && order.status === 'PENDING';
                return (
                  <div key={order.id}
                    style={{ borderRadius: 9, marginBottom: 2, overflow: 'hidden', border: `1px solid ${expanded ? 'rgba(255,255,255,0.09)' : urgent ? 'rgba(239,68,68,0.15)' : 'transparent'}`, background: expanded ? '#1A1F2C' : urgent ? 'rgba(239,68,68,0.04)' : 'transparent', transition: 'all 0.12s' }}>
                    <div onClick={() => setExpandedOrder(expanded ? null : order.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}>
                      {/* Status bar */}
                      <div style={{ width: 3, height: 36, borderRadius: 99, background: SC[order.status as string] ?? '#888', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: S.text, fontFamily: "'JetBrains Mono',monospace" }}>#{order.order_number}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.06em', color: SC[order.status as string], background: SB[order.status as string] }}>
                            {order.status}
                          </span>
                          {urgent && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>⚠ {Math.floor(mins)}m</span>}
                          <span style={{ fontSize: 11, color: S.dim, marginLeft: 'auto' }}>{fmtTime(order.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: S.muted }}>{order.customer_name}{order.pax ? ` · ${order.pax} pax` : ''}</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: S.text, flexShrink: 0, marginRight: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                        ₱{Number(order.total_amount).toFixed(0)}
                      </div>
                      {expanded ? <ChevronDown size={12} style={{ color: S.dim, flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: S.dim, flexShrink: 0 }} />}
                    </div>
                    {expanded && (
                      <div style={{ padding: '0 12px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {next && (
                          <button onClick={() => void bumpStatus(order.id, next.next)} disabled={isBumping}
                            style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: `${next.color}18`, color: next.color, border: `1px solid ${next.color}35`, opacity: isBumping ? 0.5 : 1, fontFamily: 'inherit' }}>
                            {isBumping ? '…' : `→ ${next.label}`}
                          </button>
                        )}
                        {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                          <button onClick={() => void bumpStatus(order.id, 'CANCELLED')} disabled={isBumping}
                            style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontFamily: 'inherit', opacity: isBumping ? 0.5 : 1 }}>
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
              <p style={{ fontSize: 10, color: S.dim, textAlign: 'center', padding: '6px 0 2px' }}>Tap any order to update status inline</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Floor Plan */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: S.text }}>Floor Plan</span>
                <span style={{ fontSize: 10, color: S.dim }}>Main Garden</span>
              </div>
              <Link href="/admin/tables" style={{ fontSize: 10, color: S.muted, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>Manage <ArrowRight size={9} /></Link>
            </div>
            <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {tables.length === 0 && !loading && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '16px 0', fontSize: 11, color: S.dim }}>No tables configured</div>
              )}
              {tables.map((t: TableStatus) => (
                <div key={t.id} style={{ background: tBg[t.status], border: `1px solid ${tBdr[t.status]}`, borderRadius: 8, padding: '8px 4px', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: tTxt[t.status] }}>{t.name}</div>
                  <div style={{ fontSize: 9, color: tTxt[t.status], marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>
                    {t.status === 'OCCUPIED' ? 'Busy' : t.status === 'READY' ? 'Ready' : 'Free'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today Summary */}
          <div style={S.card}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: S.text }}>Today&apos;s Summary</span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              {[
                { label: 'Completed', value: stats.completedOrders, color: '#22c55e', icon: CheckCircle },
                { label: 'Active',    value: stats.pendingOrders,   color: '#F59E0B', icon: Clock },
                { label: 'Cancelled', value: stats.cancelledOrders, color: '#ef4444', icon: XCircle },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <item.icon size={13} style={{ color: item.color }} />
                    <span style={{ color: S.muted, fontSize: 12 }}>{item.label}</span>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 15, color: item.color, fontFamily: "'JetBrains Mono',monospace" }}>{item.value}</span>
                </div>
              ))}
              {/* Completion bar */}
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: S.dim }}>Completion rate</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#F59E0B' : S.muted }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: '#1A1F2C', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: pct >= 80 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#F59E0B,#f97316)', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '10px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Link href={`/kitchen${tenantSlug ? `?tenant=${tenantSlug}` : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 9, textDecoration: 'none', fontSize: 12, fontWeight: 700, background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>🍳 Open Kitchen Display</span>
                <ArrowRight size={12} />
              </Link>
              <Link href="/admin/analytics"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 9, textDecoration: 'none', fontSize: 12, fontWeight: 600, background: '#1A1F2C', color: S.muted, border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChart2 size={13} /> View Analytics</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
