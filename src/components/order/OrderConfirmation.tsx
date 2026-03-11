'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { OrderStatus } from '@/types';

interface Props {
  order: { orderId: string; orderNumber: string; totalAmount: number; status: string };
  tenantName: string;
  receiptFooter: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; emoji: string; color: string }> = {
  PENDING:    { label: 'Order Received',     emoji: '✅', color: 'text-blue-600' },
  CONFIRMED:  { label: 'Confirmed by Staff', emoji: '👍', color: 'text-blue-700' },
  PREPARING:  { label: 'Being Prepared',     emoji: '👨‍🍳', color: 'text-amber-600' },
  READY:      { label: 'Ready to Serve!',    emoji: '🔔', color: 'text-green-600' },
  COMPLETED:  { label: 'Completed',          emoji: '🎉', color: 'text-green-700' },
  CANCELLED:  { label: 'Cancelled',          emoji: '❌', color: 'text-red-600' },
};

const STATUS_ORDER: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];

export default function OrderConfirmation({ order, tenantName, receiptFooter }: Props) {
  const [status, setStatus] = useState<OrderStatus>(order.status as OrderStatus);
  const supabase = createBrowserClient();

  // ── Supabase Realtime — never polling ───────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`order-status-${order.orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.orderId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: OrderStatus }).status;
          setStatus(newStatus);

          // Haptic feedback on mobile when order is ready
          if (newStatus === 'READY' && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [order.orderId, supabase]);

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const currentStepIdx = STATUS_ORDER.indexOf(status);

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      {/* Status Card */}
      <div className="bg-white rounded-3xl shadow-lg p-8 text-center mb-6">
        <div className="text-6xl mb-4">{config.emoji}</div>
        <h2 className={`text-2xl font-bold mb-1 ${config.color}`}>{config.label}</h2>
        <p className="text-gray-500 mb-4">Order #{order.orderNumber}</p>

        {/* Progress bar */}
        {status !== 'CANCELLED' && (
          <div className="flex items-center gap-1 justify-center my-6">
            {STATUS_ORDER.slice(0, -1).map((s, idx) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    idx <= currentStepIdx
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {idx + 1}
                </div>
                {idx < STATUS_ORDER.length - 2 && (
                  <div
                    className={`h-1 w-6 rounded transition-all ${
                      idx < currentStepIdx ? 'bg-green-600' : 'bg-gray-100'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-50 rounded-2xl px-6 py-4 mt-4">
          <p className="text-gray-500 text-sm">Total Amount</p>
          <p className="text-2xl font-bold text-gray-800">
            ₱{order.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Live indicator */}
      {status !== 'COMPLETED' && status !== 'CANCELLED' && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          Live status updates
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-gray-400 text-sm px-4">{receiptFooter || `Thank you for ordering at ${tenantName}!`}</p>
    </div>
  );
}
