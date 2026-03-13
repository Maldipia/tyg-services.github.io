'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { OrderStatus } from '@/types';

interface KitchenItem {
  id: string;
  item_name: string;
  size_label?: string | null;
  qty: number;
  notes?: string | null;
  addon_total?: number;
}

interface KitchenOrder {
  id: string;
  order_number: number;
  status: OrderStatus;
  payment_status: string;
  created_at: string;
  updated_at?: string;
  customer_name: string;
  pax: number;
  notes?: string | null;
  table_id?: string | null;
  branch_id?: string | null;
  total_amount: number;
  items: KitchenItem[];
  minutesAgo: number;
}

interface Props {
  tenantId: string;
  branchId: string | null;
  tenantName: string;
}

const KITCHEN_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING'];

const NEXT_ACTION: Record<string, { label: string; status: string; bg: string }> = {
  PENDING:   { label: 'Confirm',       status: 'CONFIRMED', bg: '#7c3aed' },
  CONFIRMED: { label: 'Start Cooking', status: 'PREPARING', bg: '#d97706' },
  PREPARING: { label: 'Mark Ready 🔔', status: 'READY',     bg: '#16a34a' },
};

const LEFT_COLOR: Record<string, string> = {
  PENDING:   '#60a5fa',
  CONFIRMED: '#a78bfa',
  PREPARING: '#fbbf24',
};

function minsAgo(ts: string) {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
}

export default function KitchenDisplay({ branchId, tenantName }: Props) {
  const [orders,  setOrders]  = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?status=active&limit=100', { credentials: 'include' });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json() as { data?: KitchenOrder[] };
      const raw = json.data ?? [];
      const kitchen = raw
        .filter(o => KITCHEN_STATUSES.includes(o.status))
        .filter(o => !branchId || !o.branch_id || o.branch_id === branchId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(o => ({ ...o, minutesAgo: minsAgo(o.created_at), items: (o.items ?? []) as KitchenItem[] }));
      setOrders(kitchen);
    } catch {/**/ } finally { setLoading(false); }
  }, [branchId]);

  // Initial load
  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  // Poll every 10s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => void fetchOrders(), 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrders]);

  // Tick every 30s to update "minutes ago"
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 30_000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  useEffect(() => {
    if (tick === 0) return;
    setOrders(prev => prev.map(o => ({ ...o, minutesAgo: minsAgo(o.created_at) })));
  }, [tick]);

  const updateStatus = async (orderId: string, status: string) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      // Optimistic: remove from KDS if moving to READY/DONE
      if (['READY', 'COMPLETED', 'CANCELLED'].includes(status)) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        setOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, status: status as OrderStatus } : o
        ));
      }
      // Refetch in 1s to sync
      setTimeout(() => void fetchOrders(), 1000);
    } else {
      const err = await res.json() as { error: string };
      alert(err.error ?? 'Failed');
    }
  };

  // ── Styles ─────────────────────────────────────────────
  const s = {
    root:   { minHeight: '100vh', background: '#111827', padding: 16, fontFamily: 'system-ui, sans-serif' },
    hdr:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title:  { color: '#fff', fontSize: 24, fontWeight: 700, margin: 0 },
    sub:    { color: '#9ca3af', fontSize: 14, margin: '2px 0 0' },
    live:   { display: 'flex', alignItems: 'center', gap: 8, color: '#4ade80', fontSize: 13 },
    dot:    { width: 8, height: 8, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' },
    empty:  { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', height: 240, color: '#6b7280', fontSize: 18 },
    grid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  };

  if (loading) {
    return (
      <div style={{ ...s.root, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#fff', fontSize: 20 }}>Loading orders…</p>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes ping{75%,100%{transform:scale(2);opacity:0}}`}</style>

      {/* Header */}
      <div style={s.hdr}>
        <div>
          <h1 style={s.title}>🍳 Kitchen Display</h1>
          <p style={s.sub}>{tenantName} · {orders.length} active order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={s.live}>
          <span style={s.dot} />
          Live · 10s poll
        </div>
      </div>

      {/* Orders */}
      {orders.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <p>All caught up! No active orders.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {orders.map(order => <OrderCard key={order.id} order={order} onUpdate={updateStatus} />)}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, onUpdate }: { order: KitchenOrder; onUpdate: (id: string, status: string) => void }) {
  const urgent  = order.minutesAgo >= 15;
  const warning = order.minutesAgo >= 8;
  const action  = NEXT_ACTION[order.status];
  const lc      = LEFT_COLOR[order.status] ?? '#6b7280';

  const card: React.CSSProperties = {
    background: '#1f2937',
    borderRadius: 12,
    borderLeft: `4px solid ${lc}`,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    outline: urgent ? '2px solid #ef4444' : warning ? '1px solid #f59e0b' : 'none',
    animation: urgent ? 'pulse 2s infinite' : 'none',
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>#{order.order_number}</span>
          <p style={{ color: '#9ca3af', fontSize: 13, margin: '3px 0 0' }}>
            {order.customer_name} · {order.pax} pax
          </p>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: urgent ? '#f87171' : warning ? '#fbbf24' : '#6b7280',
        }}>
          {order.minutesAgo}m
        </span>
      </div>

      {/* Items */}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {order.items.map(item => (
          <li key={item.id} style={{ color: '#e5e7eb' }}>
            <span style={{ fontWeight: 700, color: '#fff' }}>×{item.qty}</span>{' '}
            {item.item_name}
            {item.size_label && <span style={{ color: '#6b7280', fontSize: 12 }}> ({item.size_label})</span>}
            {item.notes && (
              <p style={{ color: '#fcd34d', fontSize: 12, marginLeft: 16, marginTop: 2 }}>⚠ {item.notes}</p>
            )}
          </li>
        ))}
      </ul>

      {/* Order notes */}
      {order.notes && (
        <p style={{ color: '#fcd34d', fontSize: 12, background: 'rgba(120,53,15,0.3)', borderRadius: 6, padding: '4px 8px', margin: 0 }}>
          📝 {order.notes}
        </p>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 'auto' }}>
        <span style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {order.status}
        </span>
        {action && (
          <button
            onClick={() => onUpdate(order.id, action.status)}
            style={{ padding: '7px 14px', borderRadius: 8, background: action.bg, color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
