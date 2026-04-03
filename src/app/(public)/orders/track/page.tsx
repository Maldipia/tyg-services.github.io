'use client';
import React from 'react';
// ============================================================
// TYG POS — /orders/track
// Public order status page — no login required
// URL: /orders/track?id=ORDER_UUID&tenant=yani
// ============================================================

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface OrderItem {
  id: string;
  item_name: string;
  qty: number;
  line_total: number;
  size_label?: string;
  addon_total?: number;
  notes?: string;
}

interface OrderData {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  subtotal: number;
  vatAmount: number;
  discountAmount: number;
  discountType?: string | null;
  pax: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  tenant: { slug: string; name: string; primaryColor: string };
  rating?: number | null;
  feedbackText?: string | null;
  orderType?: string;
  sugarLevel?: string | null;
}

const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];

const STATUS_INFO: Record<string, { label: string; emoji: string; desc: string; color: string }> = {
  PENDING:   { label: 'Order Received',   emoji: '📋', desc: 'Your order is in the queue', color: '#f59e0b' },
  CONFIRMED: { label: 'Order Confirmed',  emoji: '✅', desc: 'Confirmed! Kitchen is notified', color: '#3b82f6' },
  PREPARING: { label: 'Being Prepared',   emoji: '🍳', desc: 'Our kitchen is preparing your order', color: '#8b5cf6' },
  READY:     { label: 'Ready for Pickup', emoji: '🔔', desc: 'Your order is ready! Please proceed to the counter', color: '#22c55e' },
  COMPLETED: { label: 'Completed',        emoji: '🎉', desc: 'Thanks for dining with us!', color: '#6b7280' },
  CANCELLED: { label: 'Cancelled',        emoji: '❌', desc: 'This order has been cancelled', color: '#ef4444' },
};

function TrackPageInner() {
  const params   = useSearchParams();
  const orderId  = params.get('id');
  const tenant   = params.get('tenant');

  const [order, setOrder]     = useState<OrderData | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [waitTime, setWaitTime]       = useState<{ estimatedMins: number; label: string } | null>(null);
  const [rating, setRating]           = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const url = `/api/orders/${orderId}${tenant ? `?tenant=${tenant}` : ''}`;
      const res = await fetch(url);
      const json = await res.json() as { data: OrderData | null; error: string | null };
      if (json.error || !json.data) {
        setError(json.error ?? 'Order not found');
      } else {
        setOrder(json.data);
        setError(null);
      }
    } catch {
      setError('Could not connect. Please check your connection.');
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, [orderId, tenant]);

  // Fetch wait time when order is PENDING/CONFIRMED/PREPARING
  useEffect(() => {
    if (!order || !['PENDING','CONFIRMED','PREPARING'].includes(order.status)) return;
    const tenantSlug = tenant ?? order.tenant?.slug;
    if (!tenantSlug) return;
    fetch(`/api/orders/wait-time?tenantSlug=${tenantSlug}`)
      .then(r => r.json())
      .then((d: { data?: { estimatedMins: number; label: string } }) => {
        if (d.data) setWaitTime(d.data);
      }).catch(() => null);
  }, [order, tenant]);

  const submitFeedback = async () => {
    if (!order || rating === 0) return;
    setFeedbackSaving(true);
    try {
      await fetch('/api/orders/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, rating, feedbackText: feedbackText || undefined }),
      });
      setFeedbackDone(true);
    } catch { /* non-fatal */ } finally { setFeedbackSaving(false); }
  };

  // Initial fetch
  useEffect(() => { void fetchOrder(); }, [fetchOrder]);

  // Auto-refresh every 20s while order is active
  useEffect(() => {
    if (!order || order.status === 'COMPLETED' || order.status === 'CANCELLED') return;
    const id = setInterval(() => void fetchOrder(), 20_000);
    return () => clearInterval(id);
  }, [order, fetchOrder]);

  const bg     = '#0f1117';
  const card   = '#161b27';
  const border = 'rgba(255,255,255,0.07)';
  const text   = '#e8eaf0';
  const muted  = '#6b7280';

  // ── No order ID ─────────────────────────────────────────
  if (!orderId) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: muted }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
          <h2 style={{ color: text, margin: '0 0 8px' }}>No Order ID</h2>
          <p style={{ margin: 0 }}>Scan your table QR code to place and track your order.</p>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: muted }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '3px solid #22c55e', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p>Finding your order…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: muted, maxWidth: 360 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>😕</div>
          <h2 style={{ color: text, margin: '0 0 8px' }}>Order Not Found</h2>
          <p style={{ margin: '0 0 24px' }}>{error ?? 'This order does not exist or may have expired.'}</p>
          <button onClick={() => { setLoading(true); setError(null); void fetchOrder(); }}
            style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const info      = STATUS_INFO[order.status] ?? { label: 'Unknown', emoji: '❓', desc: 'Status unknown', color: '#6b7280' };
  const stepIndex = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'CANCELLED';
  const isActive  = !['COMPLETED', 'CANCELLED'].includes(order.status);

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ background: card, borderBottom: `1px solid ${border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 24 }}>🍽️</div>
        <div>
          <div style={{ color: text, fontWeight: 700, fontSize: 16 }}>{order.tenant.name}</div>
          <div style={{ color: muted, fontSize: 12 }}>Order #{order.orderNumber}</div>
        </div>
        {isActive && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
            Live tracking
          </div>
        )}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>

        {/* Status hero */}
        <div style={{
          background: card, borderRadius: 16, padding: 28, marginBottom: 16,
          border: `1px solid ${border}`, textAlign: 'center',
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{info.emoji}</div>
          <h2 style={{ color: info.color, margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>{info.label}</h2>
          <p style={{ color: muted, margin: 0, fontSize: 14 }}>{info.desc}</p>
          {order.status === 'READY' && (
            <div style={{
              marginTop: 16, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 10, padding: '10px 16px', color: '#22c55e', fontWeight: 700, fontSize: 14,
              animation: 'glow 1.5s ease-in-out infinite',
            }}>
              🔔 Please proceed to the counter!
            </div>
          )}
          {['PENDING','CONFIRMED','PREPARING'].includes(order.status) && waitTime && (
            <div style={{ marginTop: 14, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 16px', color: '#6366f1', fontSize: 13, fontWeight: 600 }}>
              ⏱️ Estimated wait: {waitTime.label}
            </div>
          )}
          {order.status === 'COMPLETED' && !feedbackDone && order.rating === null && (
            <div style={{ marginTop: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 10 }}>How was your experience? ⭐</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => setRating(star)} style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer', opacity: rating >= star ? 1 : 0.3, transition: 'opacity 0.15s' }}>⭐</button>
                ))}
              </div>
              {rating > 0 && (
                <>
                  <input type="text" placeholder="Any comments? (optional)" value={feedbackText} onChange={e => setFeedbackText(e.target.value)} maxLength={300}
                    style={{ width: '100%', boxSizing: 'border-box' as const, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: muted, background: 'transparent', outline: 'none', marginBottom: 10 }} />
                  <button onClick={submitFeedback} disabled={feedbackSaving} style={{ width: '100%', padding: '10px 0', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {feedbackSaving ? 'Submitting…' : 'Submit Feedback'}
                  </button>
                </>
              )}
            </div>
          )}
          {(order.status === 'COMPLETED' && feedbackDone) && (
            <div style={{ marginTop: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 16px', color: '#16a34a', fontSize: 13, fontWeight: 600, textAlign: 'center' as const }}>
              ✅ Thank you for your feedback!
            </div>
          )}
          <style>{`@keyframes glow{0%,100%{box-shadow:0 0 8px rgba(34,197,94,0.3)}50%{box-shadow:0 0 20px rgba(34,197,94,0.6)}}`}</style>
        </div>

        {/* Progress bar (not for cancelled) */}
        {!isCancelled && (
          <div style={{ background: card, borderRadius: 14, padding: 20, marginBottom: 16, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Order Progress</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {STATUS_STEPS.map((step, i) => {
                const done    = i <= stepIndex;
                const current = i === stepIndex;
                const si      = STATUS_INFO[step];
                return (
                  <React.Fragment key={step}>
                    <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: done ? info.color : 'rgba(255,255,255,0.05)',
                        border: `2px solid ${done ? info.color : border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, margin: '0 auto 6px',
                        boxShadow: current ? `0 0 12px ${info.color}66` : 'none',
                        transition: 'all 0.3s',
                      }}>
                        {done ? '✓' : <span style={{ color: muted, fontSize: 12 }}>{i + 1}</span>}
                      </div>
                      <div style={{ fontSize: 10, color: done ? text : muted, width: 52, lineHeight: 1.2 }}>
                        {si?.label.split(' ')[0]}
                      </div>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div style={{
                        flex: 1, height: 2,
                        background: i < stepIndex ? info.color : border,
                        marginBottom: 20, transition: 'background 0.3s',
                      }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Order items */}
        <div style={{ background: card, borderRadius: 14, padding: 20, marginBottom: 16, border: `1px solid ${border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: muted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
            Your Order
          </div>
          {order.items.map((item) => (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '10px 0', borderBottom: `1px solid ${border}`,
            }}>
              <div>
                <div style={{ color: text, fontWeight: 600, fontSize: 14 }}>
                  ×{item.qty} {item.item_name}
                </div>
                {item.size_label && <div style={{ color: muted, fontSize: 12 }}>{item.size_label}</div>}
                {item.notes && <div style={{ color: muted, fontSize: 12, fontStyle: 'italic' }}>{item.notes}</div>}
              </div>
              <div style={{ color: text, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                ₱{(Number(item.line_total ?? 0) + Number(item.addon_total ?? 0) * item.qty).toFixed(2)}
              </div>
            </div>
          ))}
          {/* Totals */}
          <div style={{ marginTop: 12 }}>
            {order.vatAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: muted, fontSize: 13, marginBottom: 4 }}>
                <span>VAT (12%)</span><span>₱{order.vatAmount.toFixed(2)}</span>
              </div>
            )}
            {order.discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontSize: 13, marginBottom: 4 }}>
                <span>
                  {order.discountType === 'PWD' ? '♿ PWD Discount (20%)' :
                   order.discountType === 'SENIOR' ? '👴 Senior Discount (20%)' :
                   'Discount'}
                </span>
                <span>-₱{order.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: text, fontSize: 17, fontWeight: 800, marginTop: 8 }}>
              <span>Total</span>
              <span style={{ color: '#22c55e' }}>₱{order.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ background: card, borderRadius: 14, padding: 20, marginBottom: 16, border: `1px solid ${border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Order Details
          </div>
          {[
            ['Name', order.customerName],
            ['Order #', `#${order.orderNumber}`],
            ['Pax', String(order.pax)],
            ['Payment', order.paymentStatus],
            ['Placed', new Date(order.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour12: true })],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: muted, fontSize: 13 }}>{label}</span>
              <span style={{ color: text, fontSize: 13, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Refresh info */}
        <div style={{ textAlign: 'center', color: muted, fontSize: 12 }}>
          {isActive
            ? `Auto-refreshes every 20 seconds • Last updated ${Math.round((Date.now() - lastRefresh) / 1000)}s ago`
            : 'Order complete — no further updates'
          }
          {isActive && (
            <button onClick={() => { setLoading(true); void fetchOrder(); }}
              style={{ display: 'block', margin: '12px auto 0', background: 'transparent', border: `1px solid ${border}`, color: muted, borderRadius: 8, padding: '6px 20px', cursor: 'pointer', fontSize: 12 }}>
              Refresh now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6b7280' }}>Loading…</span>
      </div>
    }>
      <TrackPageInner />
    </Suspense>
  );
}
