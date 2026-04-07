'use client';
import React, { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Clock, ExternalLink, RotateCcw } from 'lucide-react';

const BG = '#0f1117'; const CARD = '#161b27'; const BORDER = 'rgba(255,255,255,0.07)';
const TEXT = '#e8eaf0'; const MUTED = '#6b7280'; const GREEN = '#16a34a';

interface PlacedOrder { orderId: string; orderNumber: string; totalAmount: number; status: string; deliveryFee?: number; }

export default function SuccessPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('order');
  const [order, setOrder] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('tyg_last_order');
    if (saved) {
      try { setOrder(JSON.parse(saved) as PlacedOrder); } catch { /**/ }
    }
  }, []);

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 100px' }}>
      {/* Success animation */}
      <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(22,163,74,0.12)', border: '2px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <CheckCircle size={40} color={GREEN}/>
        </div>
        <h1 style={{ color: TEXT, fontSize: 24, fontWeight: 900, margin: 0, textAlign: 'center' }}>Order Placed!</h1>
        <p style={{ color: MUTED, fontSize: 14, margin: '8px 0 0', textAlign: 'center' }}>Your order has been received</p>
      </div>

      {order && (
        <div style={{ width: '100%', background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: MUTED, fontSize: 13 }}>Order Number</span>
            <span style={{ color: TEXT, fontWeight: 800, fontSize: 18 }}>#{order.orderNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: MUTED, fontSize: 13 }}>Total</span>
            <span style={{ color: GREEN, fontWeight: 800, fontSize: 16 }}>₱{Number(order.totalAmount).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
            <Clock size={14} color="#f59e0b"/>
            <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>Waiting for staff to confirm</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orderId && (
          <button onClick={() => router.push(`/orders/track?id=${orderId}`)} style={{
            width: '100%', padding: '14px 0', background: GREEN, border: 'none', borderRadius: 12,
            color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <ExternalLink size={16}/> Track My Order
          </button>
        )}
        <button onClick={() => router.push(`/order/${tenantSlug}`)} style={{
          width: '100%', padding: '14px 0', background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${BORDER}`, borderRadius: 12, color: TEXT, fontWeight: 700, fontSize: 15, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <RotateCcw size={16}/> Order Again
        </button>
      </div>

      <p style={{ color: MUTED, fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
        You'll be notified when your order is confirmed.<br/>Payment will be collected at the counter.
      </p>
    </div>
  );
}
