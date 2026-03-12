'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Order, OrderItem } from '@/types';

// KDS is staff-facing — loaded after PIN login
// Tenant + branch context passed as props from server component
interface Props {
  tenantId: string;
  branchId: string | null;
  tenantName: string;
}

interface KitchenOrder extends Order {
  items: OrderItem[];
  minutesAgo: number;
}

export default function KitchenDisplay({ tenantId, branchId, tenantName }: Props) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const supabase = createBrowserClient();

  // Re-calculate "minutes ago" every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const minutesAgo = (createdAt: string) =>
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);

  // ── Initial fetch ────────────────────────────────────────
  useEffect(() => {
    const fetchOrders = async () => {
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, status, created_at, updated_at,
          customer_name, pax, notes, table_id, branch_id,
          items:order_items(
            id, item_name, size_label, qty, notes, addons, addon_total, line_total
          )
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['PENDING', 'CONFIRMED', 'PREPARING'])
        .eq('is_test', false)
        .order('created_at', { ascending: true });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (!error && data) {
        setOrders(
          (data as Order[]).map((o) => ({
            ...o,
            minutesAgo: minutesAgo(o.created_at),
          })) as KitchenOrder[]
        );
      }
      setLoading(false);
    };

    void fetchOrders();
  }, [tenantId, branchId, supabase]);

  // Update minutesAgo on tick
  useEffect(() => {
    setOrders((prev) =>
      prev.map((o) => ({ ...o, minutesAgo: minutesAgo(o.created_at) }))
    );
  }, [tick]);

  // ── Supabase Realtime — LISTEN/NOTIFY (never polling) ────
  useEffect(() => {
    const channel = supabase
      .channel(`kds-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const updated = payload.new as Order;
          const isKitchenStatus = ['PENDING', 'CONFIRMED', 'PREPARING'].includes(
            updated.status
          );

          if (payload.eventType === 'INSERT' && isKitchenStatus) {
            // Fetch full order with items
            void supabase
              .from('orders')
              .select(`
                id, order_number, status, created_at, updated_at,
                customer_name, pax, notes, table_id, branch_id,
                items:order_items(
                  id, item_name, size_label, qty, notes, addons, addon_total, line_total
                )
              `)
              .eq('id', updated.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  setOrders((prev) => [
                    ...prev,
                    ({ ...(data as Order), minutesAgo: 0 } as KitchenOrder),
                  ]);
                }
              });
          } else if (payload.eventType === 'UPDATE') {
            if (!isKitchenStatus) {
              // Remove from KDS when READY/COMPLETED/CANCELLED
              setOrders((prev) => prev.filter((o) => o.id !== updated.id));
            } else {
              setOrders((prev) =>
                prev.map((o) =>
                  o.id === updated.id
                    ? { ...o, status: updated.status, updated_at: updated.updated_at }
                    : o
                )
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, supabase]);

  // ── Status update (CONFIRM / PREPARING / READY) ──────────
  const updateStatus = async (orderId: string, newStatus: string) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      alert(err.error ?? 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">🍳 Kitchen Display</h1>
          <p className="text-gray-400 text-sm">{tenantName}</p>
        </div>
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          Live
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-gray-400 text-xl">All orders caught up!</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onUpdateStatus={updateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onUpdateStatus,
}: {
  order: KitchenOrder;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const isUrgent = order.minutesAgo >= 15;
  const isWarning = order.minutesAgo >= 8;

  const statusColor = {
    PENDING:   'border-l-blue-400',
    CONFIRMED: 'border-l-purple-400',
    PREPARING: 'border-l-amber-400',
    READY:     'border-l-green-400',
    COMPLETED: 'border-l-gray-400',
    CANCELLED: 'border-l-red-400',
  }[order.status] ?? 'border-l-gray-400';

  const nextAction = {
    PENDING:   { label: 'Confirm', status: 'CONFIRMED', color: 'bg-purple-500 hover:bg-purple-600' },
    CONFIRMED: { label: 'Start Cooking', status: 'PREPARING', color: 'bg-amber-500 hover:bg-amber-600' },
    PREPARING: { label: 'Mark Ready 🔔', status: 'READY', color: 'bg-green-500 hover:bg-green-600' },
  }[order.status as 'PENDING' | 'CONFIRMED' | 'PREPARING'];

  return (
    <div
      className={`bg-gray-800 rounded-xl border-l-4 ${statusColor} p-4 flex flex-col gap-3 ${
        isUrgent ? 'ring-2 ring-red-500 animate-pulse' : isWarning ? 'ring-1 ring-amber-500' : ''
      }`}
    >
      {/* Order header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-white font-bold text-lg">#{order.order_number}</span>
          <p className="text-gray-400 text-sm">{order.customer_name} • {order.pax} pax</p>
        </div>
        <div className={`text-sm font-bold ${isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-gray-400'}`}>
          {order.minutesAgo}m ago
        </div>
      </div>

      {/* Items */}
      <ul className="space-y-1.5">
        {(order.items ?? []).map((item) => (
          <li key={item.id} className="text-gray-200">
            <span className="font-semibold text-white">×{item.qty}</span>{' '}
            {item.item_name}
            {item.size_label && (
              <span className="text-gray-400 text-xs"> ({item.size_label})</span>
            )}
            {item.notes && (
              <p className="text-amber-300 text-xs ml-4">⚠ {item.notes}</p>
            )}
          </li>
        ))}
      </ul>

      {/* Order notes */}
      {order.notes && (
        <p className="text-amber-300 text-xs bg-amber-900/30 rounded px-2 py-1">
          📝 {order.notes}
        </p>
      )}

      {/* Status badge */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-700">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{order.status}</span>
        {nextAction && (
          <button
            onClick={() => onUpdateStatus(order.id, nextAction.status)}
            className={`px-3 py-1.5 rounded-lg text-white text-sm font-semibold transition-colors ${nextAction.color}`}
          >
            {nextAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
