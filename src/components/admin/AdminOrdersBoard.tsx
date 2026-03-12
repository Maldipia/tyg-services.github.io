'use client';
import React from 'react';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Order, OrderStatus, PaymentStatus } from '@/types';

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:   '⏳ Pending',
  CONFIRMED: '👍 Confirmed',
  PREPARING: '👨‍🍳 Preparing',
  READY:     '🔔 Ready',
  COMPLETED: '✅ Done',
  CANCELLED: '❌ Cancelled',
};

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  UNPAID:                '⚪ Unpaid',
  PENDING_VERIFICATION:  '🟡 Verify',
  VERIFIED:              '🟢 Paid',
  FAILED:                '🔴 Failed',
  REFUNDED:              '🔵 Refunded',
};

interface Props {
  tenantId: string;
  branchId: string | null;
}

export default function AdminOrdersBoard({ tenantId, branchId }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  const fetchOrders = useCallback(async () => {
    let query = supabase
      .from('orders')
      .select(`
        id, order_number, status, payment_status, created_at,
        customer_name, pax, total_amount, notes, table_id, branch_id,
        items:order_items(id, item_name, size_label, qty, line_total, addon_total)
      `)
      .eq('tenant_id', tenantId)
      .eq('is_test', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter !== 'ALL') {
      query = query.eq('status', filter);
    }

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (!error && data) setOrders(data as Order[]);
    setLoading(false);
  }, [tenantId, branchId, filter, supabase]);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`admin-orders-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        () => { void fetchOrders(); }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [tenantId, supabase, fetchOrders]);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      alert(err.error);
    }
  };

  const verifyPayment = async (orderId: string) => {
    const res = await fetch(`/api/payment/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      alert(err.error);
    }
  };

  const FILTERS: Array<OrderStatus | 'ALL'> = ['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'ALL' ? 'All Orders' : ORDER_STATUS_LABELS[f]}
            {f !== 'ALL' && (
              <span className="ml-1 opacity-70">
                ({orders.filter((o) => o.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-400">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">#{order.order_number}</span>
                    <span className="text-sm text-gray-500">
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {order.customer_name} • {order.pax} pax
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleTimeString('en-PH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-700">
                    ₱{(order.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-xs text-gray-500">
                    {PAYMENT_BADGE[order.payment_status]}
                  </span>
                </div>
              </div>

              {/* Items summary */}
              {order.items && (
                <div className="text-sm text-gray-600 mb-3 space-y-0.5">
                  {order.items.map((item) => (
                    <div key={item.id}>
                      ×{item.qty} {item.item_name}
                      {item.size_label && <span className="text-gray-400"> ({item.size_label})</span>}
                    </div>
                  ))}
                </div>
              )}

              {order.notes && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mb-3">
                  📝 {order.notes}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {order.status === 'PENDING' && (
                  <button
                    onClick={() => void updateStatus(order.id, 'CONFIRMED')}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700"
                  >
                    Confirm
                  </button>
                )}
                {order.status === 'READY' && (
                  <button
                    onClick={() => void updateStatus(order.id, 'COMPLETED')}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700"
                  >
                    Complete ✓
                  </button>
                )}
                {order.payment_status === 'PENDING_VERIFICATION' && (
                  <button
                    onClick={() => void verifyPayment(order.id)}
                    className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg font-medium hover:bg-amber-600"
                  >
                    Verify Payment
                  </button>
                )}
                {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                  <button
                    onClick={() => {
                      const reason = prompt('Cancel reason?');
                      if (reason) void updateStatus(order.id, 'CANCELLED');
                    }}
                    className="px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg font-medium hover:bg-red-100 border border-red-200"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
