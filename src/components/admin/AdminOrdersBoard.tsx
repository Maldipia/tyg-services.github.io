'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Order, OrderStatus, PaymentStatus } from '@/types';

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING:   '⏳ Pending',
  CONFIRMED: '👍 Confirmed',
  PREPARING: '👨‍🍳 Preparing',
  READY:     '🔔 Ready',
  COMPLETED: '✅ Done',
  CANCELLED: '❌ Cancelled',
};

const STATUS_STYLE: Record<OrderStatus, { bg: string; color: string; border: string }> = {
  PENDING:   { bg: 'rgba(245,158,11,0.12)', color: '#d97706', border: 'rgba(245,158,11,0.3)' },
  CONFIRMED: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', border: 'rgba(99,102,241,0.3)' },
  PREPARING: { bg: 'rgba(249,115,22,0.12)', color: '#ea580c', border: 'rgba(249,115,22,0.3)' },
  READY:     { bg: 'rgba(34,197,94,0.12)',  color: '#16a34a', border: 'rgba(34,197,94,0.3)'  },
  COMPLETED: { bg: 'rgba(16,185,129,0.12)', color: '#059669', border: 'rgba(16,185,129,0.3)' },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626', border: 'rgba(239,68,68,0.3)'  },
};

const NEXT_STATUS: Partial<Record<OrderStatus, { label: string; next: OrderStatus; color: string }>> = {
  PENDING:   { label: 'Confirm Order',  next: 'CONFIRMED', color: '#6366f1' },
  CONFIRMED: { label: 'Start Cooking',  next: 'PREPARING', color: '#f97316' },
  PREPARING: { label: 'Mark Ready 🔔', next: 'READY',     color: '#22c55e' },
  READY:     { label: 'Complete ✓',    next: 'COMPLETED', color: '#10b981' },
};

const PAY_BADGE: Record<PaymentStatus, string> = {
  UNPAID:               '⚪ Unpaid',
  PENDING_VERIFICATION: '🟡 Pending Verify',
  VERIFIED:             '🟢 Paid',
  FAILED:               '🔴 Failed',
  REFUNDED:             '🔵 Refunded',
};

interface OrderItem {
  id: string; item_name: string; size_label?: string | null;
  qty: number; line_total: number; addon_total?: number;
}

interface Props { tenantId: string; branchId: string | null; }

interface ORData {
  orNumber: string; series: string; dateIssued: string;
  tenantName: string; tenantAddress: string; birTin: string; customerName: string;
  items: { description: string; qty: number; unitPrice: number; amount: number }[];
  subtotal: number; vatableSales: number; vatAmount: number; total: number; cashierName: string;
}

const TABS: Array<OrderStatus | 'ALL'> = ['ALL','PENDING','CONFIRMED','PREPARING','READY','COMPLETED','CANCELLED'];

// ── Web Audio chime — no external files needed ─────────────────
function playNewOrderChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    // Two-tone chime: C5 then E5
    const notes = [523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch { /* audio not available */ }
}

export default function AdminOrdersBoard({ branchId }: Props) {
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [filter,     setFilter]     = useState<OrderStatus | 'ALL'>('ALL');
  const [loading,    setLoading]    = useState(true);
  const [bumping,    setBumping]    = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [orModal, setOrModal]       = useState<ORData | null>(null);
  const [orLoading, setOrLoading]   = useState<string | null>(null);
  const knownIdsRef  = useRef<Set<string>>(new Set());
  const isFirstLoad  = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let slug = '';
    try { slug = (JSON.parse(localStorage.getItem('tyg_tenant') ?? '{}') as { slug?: string }).slug ?? ''; } catch {/**/}
    if (!slug) try { slug = (JSON.parse(localStorage.getItem('tyg_session') ?? '{}') as { tenantSlug?: string }).tenantSlug ?? ''; } catch {/**/}
    setTenantSlug(slug);
  }, []);

  const fetchOrders = useCallback(async (slug: string) => {
    if (!slug) return;
    try {
      const p = new URLSearchParams({ tenantSlug: slug, limit: '100' });
      if (filter !== 'ALL') p.set('status', filter);
      const res = await fetch(`/api/orders?${p}`, { credentials: 'include' });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json() as { data?: Order[] };
      const incoming = json.data ?? [];

      // Detect brand-new PENDING orders (not on first load)
      if (!isFirstLoad.current) {
        const freshIds = incoming
          .filter(o => o.status === 'PENDING' && !knownIdsRef.current.has(o.id))
          .map(o => o.id);
        if (freshIds.length > 0) {
          if (soundEnabled) playNewOrderChime();
          setNewOrderIds(prev => { const s = new Set(prev); freshIds.forEach(id => s.add(id)); return s; });
          // Clear the highlight after 6 seconds
          setTimeout(() => setNewOrderIds(prev => {
            const s = new Set(prev); freshIds.forEach(id => s.delete(id)); return s;
          }), 6000);
        }
      }
      // Always update the known IDs reference
      knownIdsRef.current = new Set(incoming.map(o => o.id));
      isFirstLoad.current = false;

      setOrders(incoming);
    } catch {/**/} finally { setLoading(false); }
  }, [filter, soundEnabled]);

  useEffect(() => { if (tenantSlug) void fetchOrders(tenantSlug); }, [tenantSlug, filter, fetchOrders]);

  // Poll every 15 s for live updates
  useEffect(() => {
    if (!tenantSlug) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => void fetchOrders(tenantSlug), 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tenantSlug, fetchOrders]);

  const bumpStatus = async (orderId: string, next: OrderStatus | 'CANCELLED', reason?: string) => {
    setBumping(orderId);
    try {
      const body: Record<string, string> = { status: next };
      if (reason) body['cancelReason'] = reason;
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      if (res.ok) await fetchOrders(tenantSlug);
      else { const e = await res.json() as { error: string }; alert(e.error ?? 'Failed'); }
    } catch {/**/} finally { setBumping(null); }
  };

  const issueOR = async (orderId: string) => {
    setOrLoading(orderId);
    try {
      const res = await fetch('/api/bir/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ orderId }),
      });
      const json = await res.json() as { data?: ORData; error?: string };
      if (res.ok && json.data) {
        setOrModal(json.data);
      } else {
        alert(json.error ?? 'Failed to generate OR');
      }
    } catch { alert('Network error'); } finally { setOrLoading(null); }
  };

  const displayed = branchId
    ? orders.filter(o => !o.branch_id || o.branch_id === branchId)
    : orders;

  const counts = TABS.reduce((acc, t) => {
    acc[t] = t === 'ALL' ? orders.length : orders.filter(o => o.status === t).length;
    return acc;
  }, {} as Record<string, number>);

  const s = {
    wrap:    { padding: 24 },
    hdr:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    title:   { fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 },
    refresh: { fontSize: 13, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 },
    tabs:    { display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' as const },
    card:    { background: 'var(--surface)', borderRadius: 14, padding: '16px 18px', border: '1px solid var(--border)', marginBottom: 12 },
    cardHdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    orderNo: { fontWeight: 700, fontSize: 16, color: 'var(--text)', marginRight: 10 },
    meta:    { margin: '3px 0 0', color: 'var(--text-dim)', fontSize: 13 },
    time:    { margin: '2px 0 0', color: 'var(--text-muted)', fontSize: 12 },
    amount:  { fontWeight: 700, color: '#22c55e', fontSize: 16, margin: 0 },
    payBadge:{ fontSize: 12, color: 'var(--text-muted)' },
    itemRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-dim)', lineHeight: '1.7' },
    notes:   { margin: '0 0 10px', padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#92400e', fontSize: 12 },
    actions: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 10 },
  };

  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes newOrderPulse {
          0%   { box-shadow: 0 0 0 0 rgba(245,158,11,0.5), 0 2px 8px rgba(0,0,0,0.08); }
          50%  { box-shadow: 0 0 0 8px rgba(245,158,11,0), 0 2px 8px rgba(0,0,0,0.08); }
          100% { box-shadow: 0 0 0 0 rgba(245,158,11,0), 0 2px 8px rgba(0,0,0,0.08); }
        }
        .new-order-card { animation: newOrderPulse 1s ease-out 3; border-color: rgba(245,158,11,0.5) !important; }
      `}</style>
      <div style={s.hdr}>
        <h1 style={s.title}>Orders</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setSoundEnabled(v => !v)}
            title={soundEnabled ? 'Mute new order alerts' : 'Enable new order alerts'}
            style={{ background: soundEnabled ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', border: `1px solid ${soundEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.2)'}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
          >
            {soundEnabled ? '🔔' : '🔕'}
          </button>
          <button onClick={() => void fetchOrders(tenantSlug)} style={s.refresh}>↻ Refresh</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={s.tabs}>
        {TABS.map(tab => {
          const active = filter === tab;
          const n = counts[tab] ?? 0;
          return (
            <button key={tab} onClick={() => setFilter(tab)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: active ? 'var(--brand)' : 'var(--surface-2)',
              color: active ? '#fff' : 'var(--text-muted)',
            }}>
              {tab === 'ALL' ? 'All' : STATUS_LABEL[tab as OrderStatus].split(' ')[1]}
              {n > 0 && <span style={{ marginLeft: 6, background: active ? 'rgba(255,255,255,0.25)' : 'var(--border)', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{n}</span>}
            </button>
          );
        })}
      </div>

      {/* Orders */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 14 }}>Loading orders…</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No orders found</p>
        </div>
      ) : displayed.map(order => {
        const st = STATUS_STYLE[order.status] ?? STATUS_STYLE.CANCELLED;
        const nextAct = NEXT_STATUS[order.status];
        const isBumping = bumping === order.id;
        const items = (order.items ?? []) as OrderItem[];
        const minsAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
        const isOverdue = minsAgo > 20 && ['PENDING', 'CONFIRMED'].includes(order.status);

        return (
          <div key={order.id}
            className={newOrderIds.has(order.id) ? 'new-order-card' : ''}
            style={{ ...s.card, borderLeft: `4px solid ${st.border}` }}>
            <div style={s.cardHdr}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  <span style={s.orderNo}>#{order.order_number}</span>
                  <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color }}>
                    {STATUS_LABEL[order.status]}
                  </span>
                  {isOverdue && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}>⚠ {minsAgo}m</span>}
                </div>
                <p style={s.meta}>{order.customer_name} · {order.pax} pax</p>
                <p style={s.time}>{new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={s.amount}>₱{Number(order.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                <span style={s.payBadge}>{PAY_BADGE[order.payment_status]}</span>
              </div>
            </div>

            {/* Items */}
            {items.length > 0 && (
              <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                {items.map(item => (
                  <div key={item.id} style={s.itemRow}>
                    <span>×{item.qty} {item.item_name}{item.size_label ? ` (${item.size_label})` : ''}</span>
                    <span style={{ color: 'var(--text-muted)' }}>₱{Number(item.line_total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            {order.notes && <p style={s.notes}>📝 {order.notes}</p>}

            {/* Actions */}
            <div style={s.actions}>
              {nextAct && (
                <button disabled={isBumping} onClick={() => void bumpStatus(order.id, nextAct.next)}
                  style={{ padding: '8px 18px', borderRadius: 8, background: nextAct.color, color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: isBumping ? 'not-allowed' : 'pointer', opacity: isBumping ? 0.7 : 1 }}>
                  {isBumping ? '…' : nextAct.label}
                </button>
              )}
              {!['COMPLETED','CANCELLED'].includes(order.status) && (
                <button disabled={isBumping} onClick={() => {
                  const reason = prompt('Cancel reason:');
                  if (reason?.trim()) void bumpStatus(order.id, 'CANCELLED', reason.trim());
                }}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
              {order.payment_status === 'PENDING_VERIFICATION' && (
                <button onClick={() => alert('Go to Payments page to view proof and verify.')}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  🧾 Verify Payment
                </button>
              )}
              {order.status === 'COMPLETED' && order.payment_status === 'VERIFIED' && (
                <button
                  disabled={orLoading === order.id}
                  onClick={() => void issueOR(order.id)}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', color: '#b45309', border: '1px solid rgba(245,158,11,0.25)', fontWeight: 600, fontSize: 13, cursor: orLoading === order.id ? 'not-allowed' : 'pointer', opacity: orLoading === order.id ? 0.6 : 1 }}
                >
                  {orLoading === order.id ? '…' : '🧾 BIR OR'}
                </button>
              )}
            </div>
          </div>
        );
      })}

    {/* ── BIR OR Print Modal ─────────────────────────────── */}
    {orModal && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
        <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
          {/* Modal header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>🧾 BIR Official Receipt</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()} style={{ padding: '6px 14px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Print</button>
              <button onClick={() => setOrModal(null)} style={{ padding: '6px 14px', borderRadius: 8, background: '#f3f4f6', color: '#374151', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Close</button>
            </div>
          </div>

          {/* Receipt — printable area */}
          <div id="bir-receipt" style={{ padding: '24px 28px', fontFamily: 'monospace', fontSize: 13, color: '#111827', background: '#fff' }}>
            <style>{`@media print { body * { visibility: hidden } #bir-receipt, #bir-receipt * { visibility: visible } #bir-receipt { position: fixed; top: 0; left: 0; width: 100%; } }`}</style>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 16, textTransform: 'uppercase' }}>{orModal.tenantName}</div>
              {orModal.tenantAddress && <div style={{ fontSize: 12, color: '#6b7280' }}>{orModal.tenantAddress}</div>}
              <div style={{ fontSize: 12, color: '#6b7280' }}>TIN: {orModal.birTin}</div>
              <div style={{ marginTop: 8, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Official Receipt</div>
            </div>

            <div style={{ borderTop: '1px dashed #d1d5db', borderBottom: '1px dashed #d1d5db', padding: '8px 0', marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
              <div><span style={{ color: '#6b7280' }}>OR No: </span><strong>{orModal.orNumber}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Date: </span>{orModal.dateIssued}</div>
              <div><span style={{ color: '#6b7280' }}>Customer: </span>{orModal.customerName}</div>
              <div><span style={{ color: '#6b7280' }}>Cashier: </span>{orModal.cashierName}</div>
            </div>

            {/* Line items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', color: '#6b7280', fontWeight: 600 }}>Description</th>
                  <th style={{ textAlign: 'center', padding: '4px 0', color: '#6b7280', fontWeight: 600 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', color: '#6b7280', fontWeight: 600 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {orModal.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 0' }}>{item.description}</td>
                    <td style={{ padding: '3px 0', textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ padding: '3px 0', textAlign: 'right' }}>₱{item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>VATable Sales</span>
                <span>₱{orModal.vatableSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>VAT (12%)</span>
                <span>₱{orModal.vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, borderTop: '1px solid #e5e7eb', paddingTop: 6, marginTop: 4 }}>
                <span>TOTAL</span>
                <span>₱{orModal.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#9ca3af', borderTop: '1px dashed #d1d5db', paddingTop: 12 }}>
              <div>This is a system-generated BIR-compliant receipt.</div>
              <div style={{ marginTop: 2 }}>ATP Series: {orModal.series}</div>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}