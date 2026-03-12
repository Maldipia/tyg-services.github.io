'use client';
import React from 'react';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { TrendingUp, ShoppingBag, CheckCircle, XCircle, Clock, ArrowRight, RefreshCw, Banknote } from 'lucide-react';
import type { OrderStatus } from '@/types';

interface DashStats {
  todaySales: number; todayOrders: number; pendingOrders: number;
  completedOrders: number; cancelledOrders: number; avgOrderValue: number;
}
interface LiveOrder {
  id: string; order_number: string; status: OrderStatus;
  total_amount: number; customer_name: string; created_at: string; pax: number;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b', CONFIRMED: '#6366f1', PREPARING: '#f97316',
  READY: '#22c55e', COMPLETED: '#10b981', CANCELLED: '#ef4444',
};
const STATUS_BG: Record<string, string> = {
  PENDING: 'rgba(245,158,11,0.12)', CONFIRMED: 'rgba(99,102,241,0.12)', PREPARING: 'rgba(249,115,22,0.12)',
  READY: 'rgba(34,197,94,0.12)', COMPLETED: 'rgba(16,185,129,0.12)', CANCELLED: 'rgba(239,68,68,0.12)',
};
const C = {
  surface: '#161b27', surface2: '#1e2535', surface3: '#252d3d',
  border: 'rgba(255,255,255,0.07)', text: '#e8eaf0', muted: '#6b7280', dim: '#9ca3af',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats>({ todaySales: 0, todayOrders: 0, pendingOrders: 0, completedOrders: 0, cancelledOrders: 0, avgOrderValue: 0 });
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const supabase = createBrowserClient();

  // Load via API route — never direct Supabase from browser (security)
  const loadData = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/analytics/summary?range=1d&tenantSlug=${slug}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const json = await res.json() as { data?: { totals?: { completedOrders?: number; cancelledOrders?: number; grossSales?: number }; todayCompletedOrders?: number } };
      const d = json.data;

      // Also fetch live orders from orders API
      const ordRes = await fetch(`/api/orders?tenantSlug=${slug}&status=active&limit=8`, {
        credentials: 'include',
      });
      let liveOrdData: LiveOrder[] = [];
      if (ordRes.ok) {
        const ordJson = await ordRes.json() as { data?: LiveOrder[] };
        liveOrdData = ordJson.data ?? [];
      }

      if (d?.totals) {
        const completed = d.totals.completedOrders ?? 0;
        const cancelled = d.totals.cancelledOrders ?? 0;
        const sales = d.totals.grossSales ?? 0;
        const active = liveOrdData.length;
        const total = completed + cancelled + active;
        setStats({
          todaySales: sales, todayOrders: total, pendingOrders: active,
          completedOrders: completed, cancelledOrders: cancelled,
          avgOrderValue: completed > 0 ? sales / completed : 0,
        });
      }
      setLiveOrders(liveOrdData);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    let slug = '';
    let tid = '';
    try {
      const s = JSON.parse(localStorage.getItem('tyg_session') ?? '{}') as { tenantSlug?: string; tenantId?: string };
      slug = s.tenantSlug ?? '';
      tid = s.tenantId ?? '';
    } catch { /* */ }
    if (!slug) try {
      const t = JSON.parse(localStorage.getItem('tyg_tenant') ?? '{}') as { slug?: string; id?: string };
      slug = t.slug ?? '';
      tid = t.id ?? '';
    } catch { /* */ }
    if (slug) { setTenantSlug(slug); setTenantId(tid); void loadData(slug); }
    else setLoading(false);
  }, [loadData]);

  // Realtime: only triggers a refresh, doesn't read data directly (RLS blocks anon)
  useEffect(() => {
    if (!tenantId || !tenantSlug) return;
    const ch = supabase.channel('dash-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        () => { void loadData(tenantSlug); }
      ).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [tenantId, tenantSlug, loadData, supabase]);

  const statCards = [
    { label: "Today's Sales", value: `₱${stats.todaySales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, icon: Banknote, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', sub: `${stats.completedOrders} completed orders` },
    { label: 'Active Orders', value: String(stats.pendingOrders), icon: Clock, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', sub: 'Pending + preparing' },
    { label: 'Total Orders', value: String(stats.todayOrders), icon: ShoppingBag, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', sub: 'Since midnight' },
    { label: 'Avg Order', value: `₱${stats.avgOrderValue.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: '#f97316', bg: 'rgba(249,115,22,0.1)', sub: 'Per completed order' },
  ];

  return (
    <div style={{ color: C.text, fontFamily: "'Sora','Inter',system-ui,sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .spin { animation: spin 1s linear infinite; }
        .pulse { animation: pulse 2s ease infinite; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { if (tenantSlug) { setRefreshing(true); void loadData(tenantSlug); } }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Refresh
          </button>
          <Link href="/admin/orders" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white', fontSize: 13, fontWeight: 700 }}>
            View All Orders <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 24 }}>
        {statCards.map(card => (
          <div key={card.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <card.icon size={18} style={{ color: card.color }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, marginBottom: 4 }}>
              {loading ? <span style={{ color: C.muted }}>—</span> : card.value}
            </div>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 2 }}>{card.label}</div>
            <div style={{ color: C.dim, fontSize: 11 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Live Orders + Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        {/* Live Orders */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Live Orders</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#22c55e' }}>
                <span className="pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                Realtime
              </span>
            </div>
            <Link href="/admin/orders" style={{ color: C.muted, fontSize: 12 }}>View all →</Link>
          </div>
          <div style={{ padding: 12 }}>
            {loading ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: C.muted }}>Loading...</div>
            ) : liveOrders.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <CheckCircle size={32} style={{ color: C.muted, margin: '0 auto 10px', display: 'block' }} />
                <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>All caught up — no active orders</p>
              </div>
            ) : liveOrders.map(order => (
              <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, marginBottom: 6, background: C.surface2 }}>
                <div style={{ width: 4, height: 36, borderRadius: 99, background: STATUS_COLOR[order.status] ?? '#6b7280', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>#{order.order_number}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', background: STATUS_BG[order.status] ?? 'rgba(107,114,128,0.12)', color: STATUS_COLOR[order.status] ?? '#6b7280' }}>
                      {order.status}
                    </span>
                  </div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{order.customer_name} · {order.pax} pax</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>₱{Number(order.total_amount).toFixed(2)}</div>
                  <div style={{ color: C.muted, fontSize: 11 }}>{new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Today&apos;s Summary</span>
          </div>
          <div style={{ padding: 20 }}>
            {[
              { label: 'Completed', value: stats.completedOrders, color: '#22c55e', icon: CheckCircle },
              { label: 'Active',    value: stats.pendingOrders,   color: '#f59e0b', icon: Clock },
              { label: 'Cancelled', value: stats.cancelledOrders, color: '#ef4444', icon: XCircle },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <item.icon size={15} style={{ color: item.color }} />
                  <span style={{ color: C.dim, fontSize: 13 }}>{item.label}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 16, color: item.color }}>{item.value}</span>
              </div>
            ))}
            <div style={{ height: 1, background: C.border, margin: '8px 0 16px' }} />
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: C.dim, fontSize: 12 }}>Completion Rate</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  {stats.todayOrders > 0 ? Math.round((stats.completedOrders / stats.todayOrders) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: 6, background: C.surface3, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#22c55e,#16a34a)', width: `${stats.todayOrders > 0 ? (stats.completedOrders / stats.todayOrders) * 100 : 0}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/kitchen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>
                <span>Open Kitchen Display</span><ArrowRight size={14} />
              </Link>
              <Link href="/admin/analytics" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: C.surface2, border: `1px solid ${C.border}`, color: C.dim, fontSize: 13, fontWeight: 600 }}>
                <span>View Analytics</span><ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
