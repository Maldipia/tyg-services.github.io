'use client';
import React, { useState, useEffect, useRef } from 'react';
import type { OrderStatus } from '@/types';

interface Props {
  order: { orderId: string; orderNumber: string; totalAmount: number; status: string };
  tenantName: string;
  receiptFooter: string;
}

const STATUS: Record<OrderStatus, { label: string; emoji: string; color: string }> = {
  PENDING:          { label: 'Order Received',    emoji: '✅', color: '#2563eb' },
  CONFIRMED:        { label: 'Confirmed',          emoji: '👍', color: '#7c3aed' },
  PREPARING:        { label: 'Preparing',          emoji: '👨‍🍳', color: '#d97706' },
  READY:            { label: 'Ready for Pickup',   emoji: '🔔', color: '#16a34a' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery',   emoji: '🛵', color: '#0891b2' },
  DELIVERED:        { label: 'Delivered',          emoji: '📦', color: '#059669' },
  COMPLETED:        { label: 'Completed',          emoji: '🎉', color: '#059669' },
  CANCELLED:        { label: 'Cancelled',          emoji: '❌', color: '#dc2626' },
};
const STEPS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];

export default function OrderConfirmation({ order, tenantName, receiptFooter }: Props) {
  const [status, setStatus] = useState<OrderStatus>(order.status as OrderStatus);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll /api/orders/[id] every 15s for status updates
  // (Supabase realtime is RLS-blocked for anon customers)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${order.orderId}`);
        if (!res.ok) return;
        const json = await res.json() as { data?: { status: OrderStatus } };
        const s = json.data?.status;
        if (s && s !== status) {
          setStatus(s);
          if (s === 'READY' && 'vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        }
      } catch { /**/ }
    };

    pollRef.current = setInterval(poll, 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [order.orderId, status]);

  const cfg = STATUS[status] ?? STATUS.PENDING;
  const stepIdx = STEPS.indexOf(status);
  const active = status !== 'COMPLETED' && status !== 'CANCELLED';

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '32px 16px' }}>
      {/* Status card */}
      <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', padding: '36px 24px', textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>{cfg.emoji}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: cfg.color, margin: '0 0 4px' }}>{cfg.label}</h2>
        <p style={{ color: '#6b7280', margin: '0 0 20px' }}>Order #{order.orderNumber}</p>

        {/* Progress steps */}
        {status !== 'CANCELLED' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, margin: '20px 0' }}>
            {STEPS.slice(0, -1).map((s, idx) => (
              <React.Fragment key={s}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, transition: 'all 0.3s',
                  background: idx <= stepIdx ? '#16a34a' : '#f3f4f6',
                  color: idx <= stepIdx ? '#fff' : '#9ca3af',
                }}>{idx + 1}</div>
                {idx < STEPS.length - 2 && (
                  <div style={{ height: 3, width: 24, borderRadius: 2, transition: 'all 0.3s', background: idx < stepIdx ? '#16a34a' : '#f3f4f6' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div style={{ background: '#f9fafb', borderRadius: 16, padding: '16px 24px', marginTop: 12 }}>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 4px' }}>Total Amount</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: 0 }}>
            ₱{order.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Live indicator */}
      {active && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          Auto-updating every 15 seconds
        </div>
      )}

      {/* Track link */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <a href={`/orders/track?id=${order.orderId}`}
          style={{ color: '#16a34a', fontSize: 13, textDecoration: 'underline', fontWeight: 600 }}>
          📍 View order tracking page →
        </a>
      </div>

      <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '0 16px' }}>
        {receiptFooter || `Thank you for ordering at ${tenantName}!`}
      </p>
    </div>
  );
}
