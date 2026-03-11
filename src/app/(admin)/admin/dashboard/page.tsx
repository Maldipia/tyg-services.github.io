'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  TrendingUp, ShoppingBag, CheckCircle, XCircle,
  Clock, ArrowRight, RefreshCw, Banknote, Users
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';

interface DashStats {
  todaySales: number;
  todayOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING:   '#f59e0b',
  CONFIRMED: '#6366f1',
  PREPARING: '#f97316',
  READY:     '#22c55e',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

const STATUS_BG: Record<OrderStatus, string> = {
  PENDING:   'rgba(245,158,11,0.12)',
  CONFIRMED: 'rgba(99,102,241,0.12)',
  PREPARING: 'rgba(249,115,22,0.12)',
  READY:     'rgba(34,197,94,0.12)',
  COMPLETED: 'rgba(16,185,129,0.12)',
  CANCELLED: 'rgba(239,68,68,0.12)',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats>({
    todaySales: 0, todayOrders: 0, pendingOrders: 0,
    completedOrders: 0, cancelledOrders: 0, avgOrderValue: 0,
  });
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const supabase = createBrowserClient();

  const loadData = async (tid: string) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Fetch today's orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_status, total_amount, customer_name, created_at, pax')
      .eq('tenant_id', tid)
      .eq('is_test', false)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });

    if (orders) {
      const completed = orders.filter(o => o.status === 'COMPLETED');
      const totalSales = completed.reduce((s, o) => s + Number(o.total_amount), 0);
      setStats({
        todaySales: totalSales,
        todayOrders: orders.length,
        pendingOrders: orders.filter(o => ['PENDING', 'CONFIRMED', 'PREPARING'].includes(o.status as string)).length,
        completedOrders: completed.length,
        cancelledOrders: orders.filter(o => o.status === 'CANCELLED').length,
        avgOrderValue: completed.length > 0 ? totalSales / completed.length : 0,
      });
      setLiveOrders((orders as Order[]).filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status)).slice(0, 8));
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    // In real app: get tenantId from session/cookie
    const stored = localStorage.getItem('tyg_tenant');
    const tid = stored ? (JSON.parse(stored) as { id: string }).id : 'demo';
    setTenantId(tid);
    void loadData(tid);
  }, []);

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => { void loadData(tenantId); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tenantId]);

  const handleRefresh = () => {
    if (!tenantId) return;
    setRefreshing(true);
    void loadData(tenantId);
  };

  const statCards = [
    {
      label: "Today's Sales",
      value: `₱${stats.todaySales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      icon: Banknote,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.08)',
      sub: `${stats.completedOrders} completed orders`,
    },
    {
      label: 'Active Orders',
      value: stats.pendingOrders,
      icon: Clock,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.08)',
      sub: 'Pending + preparing',
    },
    {
      label: 'Total Orders',
      value: stats.todayOrders,
      icon: ShoppingBag,
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.08)',
      sub: 'Since midnight',
    },
    {
      label: 'Avg Order',
      value: `₱${stats.avgOrderValue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`,
      icon: TrendingUp,
      color: '#f97316',
      bg: 'rgba(249,115,22,0.08)',
      sub: 'Per completed order',
    },
  ];

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link
            href="/admin/orders"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}
          >
            View All Orders
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(card => (
          <div
            key={card.label}
            className="rounded-2xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: card.bg }}
              >
                <card.icon size={18} style={{ color: card.color }} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {loading ? <span style={{ color: 'var(--text-muted)' }}>—</span> : card.value}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>{card.label}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Live Orders + Summary row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Live Orders */}
        <div
          className="lg:col-span-2 rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <h3 style={{ fontWeight: 700, fontSize: 15 }}>Live Orders</h3>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: '#22c55e' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                Realtime
              </span>
            </div>
            <Link href="/admin/orders" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              View all →
            </Link>
          </div>

          <div className="p-2">
            {loading ? (
              <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>
            ) : liveOrders.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>All caught up — no active orders</p>
              </div>
            ) : (
              liveOrders.map(order => (
                <div
                  key={order.id}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all hover:opacity-80 cursor-pointer"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div
                    className="w-2 h-8 rounded-full flex-shrink-0"
                    style={{ background: STATUS_COLOR[order.status] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 700, fontSize: 14 }}>#{order.order_number}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: STATUS_BG[order.status], color: STATUS_COLOR[order.status] }}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>
                      {order.customer_name} · {order.pax} pax
                    </div>
                  </div>
                  <div className="text-right">
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      ₱{Number(order.total_amount).toFixed(2)}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Summary */}
        <div
          className="rounded-2xl flex flex-col"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>Today&apos;s Summary</h3>
          </div>

          <div className="p-5 flex-1 space-y-4">
            {/* Status breakdown */}
            {[
              { label: 'Completed', value: stats.completedOrders, color: '#22c55e', icon: CheckCircle },
              { label: 'Active',    value: stats.pendingOrders,   color: '#f59e0b', icon: Clock },
              { label: 'Cancelled', value: stats.cancelledOrders, color: '#ef4444', icon: XCircle },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon size={15} style={{ color: item.color }} />
                  <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{item.label}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: item.color }}>
                  {item.value}
                </span>
              </div>
            ))}

            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

            {/* Completion rate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Completion Rate</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                  {stats.todayOrders > 0
                    ? Math.round((stats.completedOrders / stats.todayOrders) * 100)
                    : 0}%
                </span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--surface-3)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${stats.todayOrders > 0 ? (stats.completedOrders / stats.todayOrders) * 100 : 0}%`,
                    background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="p-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
            <Link
              href="/kitchen"
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <span>Open Kitchen Display</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/admin/analytics"
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--surface-2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
            >
              <span>View Analytics</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
