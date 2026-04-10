'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Order, OrderStatus, PaymentStatus } from '@/types';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING:          '⏳ Pending',
  CONFIRMED:        '✅ Confirmed',
  PREPARING:        '👨‍🍳 Preparing',
  READY:            '🔔 Ready',
  OUT_FOR_DELIVERY: '🛵 Out for Delivery',
  DELIVERED:        '📦 Delivered',
  COMPLETED:        '✓ Completed',
  CANCELLED:        '✗ Cancelled',
};

const STATUS_STYLE: Record<OrderStatus, { bg: string; color: string; border: string }> = {
  PENDING:          { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1', border: '#6366f1' },
  CONFIRMED:        { bg: 'rgba(245,158,11,0.12)',  color: '#d97706', border: '#d97706' },
  PREPARING:        { bg: 'rgba(249,115,22,0.12)',  color: '#ea580c', border: '#ea580c' },
  READY:            { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a', border: '#16a34a' },
  OUT_FOR_DELIVERY: { bg: 'rgba(6,182,212,0.12)',   color: '#0891b2', border: '#0891b2' },
  DELIVERED:        { bg: 'rgba(16,185,129,0.12)',  color: '#059669', border: '#059669' },
  COMPLETED:        { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', border: '#6b7280' },
  CANCELLED:        { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', border: '#dc2626' },
};

const NEXT_STATUS: Partial<Record<OrderStatus, { label: string; next: OrderStatus; color: string }>> = {
  PENDING:          { label: 'Confirm Order',       next: 'CONFIRMED',        color: '#6366f1' },
  CONFIRMED:        { label: 'Start Cooking',        next: 'PREPARING',        color: '#f97316' },
  PREPARING:        { label: 'Mark Ready 🔔',        next: 'READY',            color: '#22c55e' },
  READY:            { label: 'Complete ✓',           next: 'COMPLETED',        color: '#10b981' },
  OUT_FOR_DELIVERY: { label: 'Mark Delivered 📦',    next: 'DELIVERED',        color: '#0891b2' },
  DELIVERED:        { label: 'Complete ✓',           next: 'COMPLETED',        color: '#059669' },
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
  qty: number; line_total: number; addon_total?: number; sugar_level?: string | null;
  notes?: string | null; prepared?: boolean;
}

interface Props { tenantId: string; branchId: string | null; }

interface ORData {
  orNumber: string; series: string; dateIssued: string;
  tenantName: string; tenantAddress: string; birTin: string; customerName: string;
  items: { description: string; qty: number; unitPrice: number; amount: number }[];
  subtotal: number; vatableSales: number; vatAmount: number; total: number; cashierName: string;
}

const TABS: Array<OrderStatus | 'ALL'> = ['ALL','PENDING','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','COMPLETED','CANCELLED'];

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

interface TenantInfo {
  name: string; address: string;
  receiptFooter: string; primaryColor: string;
}

interface ReceiptOrder {
  id: string; order_number: string; customer_name: string; table_name: string | null;
  pax: number; status?: string; payment_status: string;
  total_amount: number; subtotal_override?: number; vat_amount: number;
  discount_type?: string; discount_amount?: number;
  notes: string | null; created_at: string;
  items: OrderItem[];
}

export default function AdminOrdersBoard({ branchId }: Props) {
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [filter,      setFilter]      = useState<OrderStatus | 'ALL'>('ALL');
  const [loading,     setLoading]     = useState(true);
  const [bumping,     setBumping]     = useState<string | null>(null);
  const [tenantSlug,  setTenantSlug]  = useState('');
  const [tenantInfo,  setTenantInfo]  = useState<TenantInfo>({ name: '', address: '', receiptFooter: 'Thank you for dining with us! 🌿', primaryColor: '#16a34a' });
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [soundEnabled,setSoundEnabled]= useState(true);
  const [orModal,     setOrModal]     = useState<ORData | null>(null);
  const [orLoading,   setOrLoading]   = useState<string | null>(null);
  const [cashLoading, setCashLoading] = useState<string | null>(null);
  const [discountModal, setDiscountModal] = useState<{orderId:string;orderNumber:string;subtotal:number;pax:number;serviceCharge:number}|null>(null);
  const [discountType, setDiscountType] = useState<'PWD'|'SENIOR'|'BOTH'|'PROMO'|'CUSTOM'>('PWD');
  const [discountPaxInput, setDiscountPaxInput] = useState(1);
  const [discountTotalPax, setDiscountTotalPax] = useState(1);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [prepToggling, setPrepToggling] = useState<string|null>(null);
  const [emailModal, setEmailModal] = useState<{orderId:string;orderNumber:string}|null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cancelModal, setCancelModal] = useState<{orderId:string;orderNumber:string}|null>(null);
  const [cancelReason, setCancelReason] = useState('Customer changed mind');
  const [receiptOrder,setReceiptOrder]= useState<ReceiptOrder | null>(null);
  const [search,      setSearch]      = useState('');
  const [dateFrom,    setDateFrom]    = useState(() => new Date(Date.now() + 8*3600000).toISOString().slice(0,10));
  const [dateTo,      setDateTo]      = useState(() => new Date(Date.now() + 8*3600000).toISOString().slice(0,10));
  const knownIdsRef  = useRef<Set<string>>(new Set());
  const isFirstLoad  = useRef(true);

  useEffect(() => {
    let slug = '';
    try { slug = (JSON.parse(localStorage.getItem('tyg_tenant') ?? '{}') as { slug?: string }).slug ?? ''; } catch {/**/}
    if (!slug) try { slug = (JSON.parse(localStorage.getItem('tyg_session') ?? '{}') as { tenantSlug?: string }).tenantSlug ?? ''; } catch {/**/}
    setTenantSlug(slug);
    // Fetch tenant branding for receipts
    if (slug) {
      fetch('/api/settings', { credentials: 'include' })
        .then(r => r.json())
        .then((d: { data?: { name?: string; address?: string; primary_color?: string; settings?: { receiptFooter?: string } } }) => {
          if (d?.data) setTenantInfo({
            name:          d.data.name          ?? '',
            address:       d.data.address       ?? '',
            primaryColor:  d.data.primary_color ?? '#16a34a',
            receiptFooter: d.data.settings?.receiptFooter ?? 'Thank you for dining with us! 🌿',
          });
        })
        .catch(() => {/**/});
    }
  }, []);

  const fetchOrders = useCallback(async (slug: string) => {
    if (!slug) return;
    try {
      const p = new URLSearchParams({ tenantSlug: slug, limit: '200', dateFrom, dateTo });
      if (filter !== 'ALL') p.set('status', filter);
      if (search.trim()) p.set('search', search.trim());
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
  }, [filter, soundEnabled, dateFrom, dateTo, search]);

  useEffect(() => { if (tenantSlug) void fetchOrders(tenantSlug); }, [tenantSlug, filter, dateFrom, dateTo, search, fetchOrders]);

  // Realtime subscription — replaces 15s poll (falls back to 15s if disconnected)
  const rtTenantId = typeof window !== 'undefined'
    ? (() => { try { return (JSON.parse(localStorage.getItem('tyg_session') ?? '{}') as { tenantId?: string }).tenantId ?? ''; } catch { return ''; } })()
    : '';
  useRealtimeOrders({
    tenantId: rtTenantId,
    onOrderChange: () => { if (tenantSlug) void fetchOrders(tenantSlug); },
    fallbackPollMs: 15_000,
  });

  const bumpStatus = async (orderId: string, next: OrderStatus | 'CANCELLED', reason?: string, paymentStatus?: string) => {
    // Guard: warn if completing an unpaid order (cashier oversight prevention)
    if (next === 'COMPLETED' && paymentStatus && paymentStatus !== 'VERIFIED') {
      const proceed = confirm(
        '⚠️ This order is not yet marked as paid.\n\nProceed to complete without recording payment?\n(You can still mark it paid afterward via the 💵 Cash Paid button)'
      );
      if (!proceed) return;
    }
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

  const markCashPaid = async (orderId: string, total: number) => {
    if (!confirm(`Mark this order as paid in cash (₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })})?`)) return;
    setCashLoading(orderId);
    try {
      const res = await fetch('/api/payment/cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ orderId }),
      });
      const json = await res.json() as { data?: { alreadyPaid?: boolean }; error?: string };
      if (res.ok) {
        await fetchOrders(tenantSlug);
      } else {
        alert(json.error ?? 'Failed to record payment');
      }
    } catch { alert('Network error'); } finally { setCashLoading(null); }
  };

  const exportCSV = () => {
    const rows = [
      ['Order#','Status','Payment','Table','Customer','Pax','Amount','Date'],
      ...orders.map(o => {
        const raw = o as unknown as Record<string, unknown>;
        return [
          String(o.order_number),
          o.status,
          o.payment_status,
          String(raw['table_name'] ?? ''),
          o.customer_name,
          String(o.pax),
          String(Number(o.total_amount).toFixed(2)),
          new Date(o.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `orders-${dateFrom}${dateTo !== dateFrom ? '-to-' + dateTo : ''}.csv`;
    a.click();
  };

  const displayed = branchId
    ? orders.filter(o => !o.branch_id || o.branch_id === branchId)
    : orders;

  const counts = TABS.reduce((acc, t) => {
    acc[t] = t === 'ALL' ? orders.length : orders.filter(o => o.status === t).length;
    return acc;
  }, {} as Record<string, number>);

  const s = {
    wrap:    { padding: '24px 28px' },
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

      {/* Search + date controls */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' as const, alignItems:'center' }}>
        <input
          type="text" placeholder="Search order# or customer…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex:'1 1 180px', minWidth:140, padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13, fontFamily:'inherit', outline:'none' }}
        />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13, fontFamily:'inherit' }}
        />
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13, fontFamily:'inherit' }}
        />
        <button onClick={exportCSV}
          style={{ padding:'7px 14px', borderRadius:8, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text-muted)', fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' as const }}>
          ⬇ CSV
        </button>
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
      <style>{`
        .orders-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 460px)); gap: 16px; }
      `}</style>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 14 }}>Loading orders…</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No orders found</p>
        </div>
      ) : (
        <div className="orders-grid">
          {displayed.map(order => {
        const st = STATUS_STYLE[order.status] ?? STATUS_STYLE.CANCELLED;
        const nextAct = NEXT_STATUS[order.status];
        const isBumping = bumping === order.id;
        const paymentMethod = String((order as unknown as Record<string,unknown>)['payment_method'] ?? '');
        const proofUrl = String((order as unknown as Record<string,unknown>)['payment_proof_url'] ?? '');
        const serviceCharge = Number((order as unknown as Record<string,unknown>)['service_charge'] ?? 0);
        const discountAmount = Number((order as unknown as Record<string,unknown>)['discount_amount'] ?? 0);
        const discountType = String((order as unknown as Record<string,unknown>)['discount_type'] ?? '');

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
                  {(() => { const tn = (order as unknown as Record<string,unknown>)['table_name']; return tn ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: '#4f46e5' }}>🪑 {String(tn)}</span> : null; })()}
                  {isOverdue && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}>⚠ {minsAgo}m</span>}
                </div>
                <p style={s.meta}>{order.customer_name} · {order.pax} pax
                  {(order as unknown as Record<string,unknown>)['order_type'] === 'DELIVERY' && <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'rgba(6,182,212,0.12)', color: '#0891b2' }}>🛵 Delivery</span>}
                  {(order as unknown as Record<string,unknown>)['order_type'] === 'TAKEOUT' && <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.10)', color: '#d97706' }}>🛍 Takeout</span>}
                </p>
                {!!(order as unknown as Record<string,unknown>)['delivery_address'] && (
                  <p style={{ fontSize: 11, color: '#0891b2', marginTop: 2, fontStyle: 'italic' }}>📍 {String((order as unknown as Record<string,unknown>)['delivery_address'] ?? '')}</p>
                )}
                {order.status === 'CANCELLED' && (order as unknown as Record<string,unknown>)['cancel_reason'] ? (
                  <p style={{ fontSize:11, color:'#dc2626', marginTop:2, fontStyle:'italic' }}>
                    ↩ {String((order as unknown as Record<string,unknown>)['cancel_reason'])}
                  </p>
                ) : null}
                <p style={s.time}>{new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={s.amount}>₱{Number(order.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                {serviceCharge > 0 && <p style={{ fontSize:11, color:'var(--text-muted)', margin:'1px 0' }}>incl. ₱{serviceCharge.toFixed(1)} svc</p>}
                <span style={s.payBadge}>{PAY_BADGE[order.payment_status]}</span>
              </div>
            </div>

            {/* Items with prepared checkboxes */}
            {items.length > 0 && (() => {
              const preparedCount = items.filter(i => i.prepared).length;
              const allPrepped = preparedCount === items.length;
              return (
                <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:'1px dashed var(--border)' }}>
                      {/* Prepared checkbox — kitchen toggle */}
                      <button
                        title={item.prepared ? 'Tap to unmark' : 'Mark as prepared'}
                        disabled={prepToggling === item.id}
                        onClick={async () => {
                          setPrepToggling(item.id);
                          await fetch(`/api/orders/${order.id}/items`, {
                            method: 'PUT', credentials: 'include',
                            headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ itemId: item.id, prepared: !item.prepared }),
                          });
                          await fetchOrders(tenantSlug);
                          setPrepToggling(null);
                        }}
                        style={{ flexShrink:0, width:26, height:26, borderRadius:6, border: item.prepared ? 'none' : '2px solid #cbd5e1', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background: item.prepared ? '#16a34a' : '#ffffff', transition:'all 0.15s', boxShadow: item.prepared ? 'none' : 'inset 0 1px 3px rgba(0,0,0,0.08)' }}>
                        {prepToggling === item.id ? <span style={{ fontSize:10, color:'#94a3b8' }}>…</span> : item.prepared ? <span style={{ color:'#fff', fontSize:14, fontWeight:900 }}>✓</span> : null}
                      </button>
                      <span style={{ flex:1, textDecoration: item.prepared ? 'line-through' : 'none', color: item.prepared ? 'var(--text-dim)' : 'var(--text)', fontSize:13, fontWeight: item.prepared ? 400 : 500 }}>
                        ×{item.qty} {item.item_name}{item.size_label ? ` (${item.size_label})` : ''}
                        {item.sugar_level && <span style={{ marginLeft:6, fontSize:11, background:'rgba(3,105,161,0.15)', color:'#7dd3fc', borderRadius:4, padding:'1px 5px', fontWeight:600 }}>
                          {item.sugar_level==='GROUNDED'?'25%':item.sugar_level==='YANI'?'50%':item.sugar_level==='COMFORT'?'75%':'100%'}
                        </span>}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize:12 }}>₱{Number(item.line_total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  {/* Progress: only show when partially done. All checked = self-evident. Nothing = no clutter. */}
                  {!allPrepped && preparedCount > 0 && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ background:'#e2e8f0', borderRadius:4, height:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:4, background:'#f59e0b', width:`${(preparedCount/items.length)*100}%`, transition:'width 0.3s' }}/>
                      </div>
                      <div style={{ textAlign:'right', fontSize:11, color:'#f59e0b', marginTop:3, fontWeight:700 }}>
                        {preparedCount}/{items.length} prepped
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Notes */}
            {order.notes && <p style={s.notes}>📝 {order.notes}</p>}



            {/* Payment method + MOP badge */}
            {paymentMethod && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ flex:1, padding:'8px 12px', borderRadius:8, background: order.payment_status==='VERIFIED' ? '#f0fdf4' : 'var(--surface-2)', border:`1px solid ${order.payment_status==='VERIFIED'?'#bbf7d0':'var(--border)'}`, fontSize:13, fontWeight:700, color: order.payment_status==='VERIFIED' ? '#16a34a' : 'var(--text)' }}>
                  {paymentMethod==='CASH'?'💵':paymentMethod==='CARD'?'💳':'📲'} {paymentMethod}{order.payment_status==='VERIFIED' ? ' · Paid ✅' : ''}
                  {proofUrl && (
                    <span onClick={() => window.open(proofUrl,'_blank','width=480,height=700,scrollbars=yes')}
                      style={{ marginLeft:8, fontSize:11, color:'#38bdf8', fontWeight:600, cursor:'pointer', textDecoration:'underline' }}>
                      📎 View proof
                    </span>
                  )}
                </div>

                {!['CANCELLED'].includes(order.status) && order.payment_status!=='VERIFIED' && (
                  <button onClick={() => {
                    const methods = ['CASH','CARD','GCASH'];
                    const next = methods[(methods.indexOf(paymentMethod)+1)%methods.length];
                    void fetch(`/api/orders/${order.id}/status`, {
                      method:'PATCH', credentials:'include',
                      headers:{'Content-Type':'application/json'},
                      body:JSON.stringify({ paymentMethod: next }),
                    }).then(() => fetchOrders(tenantSlug));
                  }} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                    Change
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={s.actions}>
              {nextAct && !(order.status === 'READY' && (order as unknown as Record<string,unknown>)['order_type'] === 'DELIVERY') && (
                <button disabled={isBumping} onClick={() => void bumpStatus(order.id, nextAct.next, undefined, order.payment_status)}
                  style={{ padding: '8px 18px', borderRadius: 8, background: nextAct.color, color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: isBumping ? 'not-allowed' : 'pointer', opacity: isBumping ? 0.7 : 1 }}>
                  {isBumping ? '…' : nextAct.label}
                </button>
              )}
              {order.status === 'READY' && (order as unknown as Record<string,unknown>)['order_type'] === 'DELIVERY' && (
                <button disabled={isBumping} onClick={() => void bumpStatus(order.id, 'OUT_FOR_DELIVERY', undefined, order.payment_status)}
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#0891b2', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: isBumping ? 'not-allowed' : 'pointer', opacity: isBumping ? 0.7 : 1 }}>
                  {isBumping ? '…' : '🛵 Dispatch Delivery'}
                </button>
              )}
              {!['COMPLETED','CANCELLED'].includes(order.status) && (
                <button disabled={isBumping} onClick={() => {
                  setCancelReason('Customer changed mind');
                  setCancelModal({ orderId: order.id, orderNumber: order.order_number });
                }}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>

            {/* Secondary actions row — Apply Discount, Print, Email, Delete */}
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
              {/* Apply Discount */}
              {!['CANCELLED'].includes(order.status) && (
                <button onClick={() => {
                  setDiscountPaxInput(1);
                  setDiscountTotalPax(order.pax);
                  setDiscountType('PWD');
                  setDiscountModal({
                    orderId: order.id,
                    orderNumber: order.order_number,
                    subtotal: Number(order.total_amount) + (discountAmount || 0),
                    pax: order.pax,
                    serviceCharge,
                  });
                }} style={{ width:'100%', padding:'10px', borderRadius:10, border:'1px solid rgba(245,158,11,0.35)', background:'rgba(245,158,11,0.07)', color:'#d97706', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  🏷️ {discountAmount > 0 ? `Discount Applied (₱${discountAmount.toFixed(2)}) — Change` : 'Apply Discount'}
                </button>
              )}
              {/* Print Receipt */}
              <button onClick={() => {
                setReceiptOrder({
                  id: order.id, order_number: order.order_number,
                  customer_name: order.customer_name, pax: order.pax,
                  table_name: String((order as unknown as Record<string,unknown>)['table_name'] ?? ''),
                  notes: order.notes,
                  created_at: order.created_at,
                  payment_status: order.payment_status,
                  total_amount: Number(order.total_amount),
                  subtotal_override: Number(order.subtotal_override ?? order.total_amount),
                  vat_amount: Number(order.vat_amount ?? 0),
                  discount_type: String((order as unknown as Record<string,unknown>)['discount_type'] ?? ''),
                  discount_amount: Number((order as unknown as Record<string,unknown>)['discount_amount'] ?? 0),
                  items: (order.items ?? []) as OrderItem[],
                });
                setTimeout(() => window.print(), 300);
              }} style={{ width:'100%', padding:'10px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                🖨️ Print Receipt
              </button>
              {/* Email Receipt (show if customer phone available) */}
              <button onClick={() => { setEmailInput(''); setEmailSent(false); setEmailModal({orderId:order.id, orderNumber:order.order_number}); }}
                style={{ width:'100%', padding:'10px', borderRadius:10, border:'1px solid rgba(59,130,246,0.3)', background:'rgba(59,130,246,0.05)', color:'#2563eb', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                📧 Email Receipt
              </button>
              {/* Delete (soft-cancel completed/cancelled orders) */}
              {['COMPLETED','CANCELLED'].includes(order.status) && (
                <button onClick={async () => {
                  if (!confirm(`Delete order #${order.order_number}? This marks it as a test order.`)) return;
                  await fetch(`/api/orders/${order.id}/status`, {
                    method:'PATCH', credentials:'include',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({ status:'CANCELLED', cancelReason:'Test order / migration cleanup' }),
                  });
                  await fetchOrders(tenantSlug);
                }} style={{ width:'100%', padding:'10px', borderRadius:10, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#f87171', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
        </div>
      )}

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

    {/* ── Basic Receipt Modal (all tiers) ──────────────── */}
    {receiptOrder && (() => {
      const vat   = receiptOrder.vat_amount;
      const net   = receiptOrder.total_amount - vat;
      const date  = new Date(receiptOrder.created_at).toLocaleString('en-PH', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Manila' });
      return (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)' }}>
          <div style={{ width:'100%', maxWidth:460, background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.4)' }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid #e5e7eb' }}>
              <span style={{ fontWeight:700, fontSize:15, color:'#111827' }}>🖨️ Order Receipt</span>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => window.print()} style={{ padding:'6px 14px', borderRadius:8, background:'#16a34a', color:'#fff', border:'none', fontWeight:600, fontSize:13, cursor:'pointer' }}>Print</button>
                <button onClick={() => setReceiptOrder(null)} style={{ padding:'6px 14px', borderRadius:8, background:'#f3f4f6', color:'#374151', border:'none', fontWeight:600, fontSize:13, cursor:'pointer' }}>Close</button>
              </div>
            </div>

            {/* Printable receipt */}
            <div id="order-receipt" style={{ padding:'20px 24px', fontFamily:'monospace', fontSize:13, color:'#111827', background:'#fff', maxHeight:'70vh', overflowY:'auto' }}>
              <style>{`@media print { body * { visibility:hidden } #order-receipt, #order-receipt * { visibility:visible } #order-receipt { position:fixed; top:0; left:0; width:100%; padding:24px; } }`}</style>

              {/* Tenant header */}
              <div style={{ textAlign:'center', marginBottom:14 }}>
                <div style={{ fontWeight:900, fontSize:17, textTransform:'uppercase', letterSpacing:'0.06em' }}>{tenantInfo.name || 'YANI Garden Café'}</div>
                {tenantInfo.address && <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{tenantInfo.address}</div>}
                <div style={{ marginTop:6, fontSize:12, color:'#9ca3af' }}>——— ORDER RECEIPT ———</div>
              </div>

              {/* Order meta */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px 8px', fontSize:12, paddingBottom:10, marginBottom:10, borderBottom:'1px dashed #d1d5db' }}>
                <div><span style={{ color:'#6b7280' }}>Order: </span><strong>#{receiptOrder.order_number}</strong></div>
                <div><span style={{ color:'#6b7280' }}>Date: </span>{date}</div>
                <div><span style={{ color:'#6b7280' }}>Customer: </span>{receiptOrder.customer_name}</div>
                <div><span style={{ color:'#6b7280' }}>Pax: </span>{receiptOrder.pax}</div>
                {receiptOrder.table_name && <div style={{ gridColumn:'1/-1' }}><span style={{ color:'#6b7280' }}>Table: </span>{receiptOrder.table_name}</div>}
              </div>

              {/* Line items */}
              <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:10, fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #e5e7eb' }}>
                    <th style={{ textAlign:'left', paddingBottom:4, color:'#6b7280', fontWeight:600 }}>Item</th>
                    <th style={{ textAlign:'center', paddingBottom:4, color:'#6b7280', fontWeight:600, width:36 }}>Qty</th>
                    <th style={{ textAlign:'right', paddingBottom:4, color:'#6b7280', fontWeight:600 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptOrder.items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ padding:'3px 0' }}>{item.item_name}{item.size_label ? ` (${item.size_label})` : ''}</td>
                      <td style={{ padding:'3px 0', textAlign:'center' }}>{item.qty}</td>
                      <td style={{ padding:'3px 0', textAlign:'right' }}>₱{Number(item.line_total).toLocaleString('en-PH', { minimumFractionDigits:2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ borderTop:'1px dashed #d1d5db', paddingTop:8, display:'flex', flexDirection:'column', gap:3, fontSize:13 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'#6b7280' }}>Subtotal (ex. VAT)</span>
                  <span>₱{net.toLocaleString('en-PH', { minimumFractionDigits:2 })}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'#6b7280' }}>VAT (12%)</span>
                  <span>₱{vat.toLocaleString('en-PH', { minimumFractionDigits:2 })}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:15, borderTop:'1px solid #e5e7eb', paddingTop:6, marginTop:3 }}>
                  <span>TOTAL</span>
                  <span>₱{receiptOrder.total_amount.toLocaleString('en-PH', { minimumFractionDigits:2 })}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:12 }}>
                  <span style={{ color:'#6b7280' }}>Payment</span>
                  <span style={{ color: receiptOrder.payment_status === 'VERIFIED' ? '#16a34a' : '#d97706', fontWeight:600 }}>
                    {receiptOrder.payment_status === 'VERIFIED' ? '✓ Paid' : receiptOrder.payment_status === 'UNPAID' ? 'Unpaid / Cash' : receiptOrder.payment_status}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {receiptOrder.notes && <div style={{ marginTop:8, padding:'6px 10px', background:'#f9fafb', borderRadius:6, fontSize:12, color:'#4b5563' }}>📝 {receiptOrder.notes}</div>}

              {/* Footer */}
              <div style={{ marginTop:14, textAlign:'center', fontSize:11, color:'#9ca3af', borderTop:'1px dashed #d1d5db', paddingTop:10 }}>
                <div>{tenantInfo.receiptFooter}</div>
                <div style={{ marginTop:2, color:'#d1d5db' }}>— Powered by TYG POS —</div>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

      {/* ── Apply Discount Modal ─────────────────────────── */}
      {discountModal && (() => {
        const totalPax = discountTotalPax;
        const qualifying = Math.min(discountPaxInput, totalPax);
        const subtotal = discountModal.subtotal;
        const sc = discountModal.serviceCharge;
        const perPerson = subtotal / Math.max(totalPax, 1);

        let discAmt = 0;
        let discLabel = '';
        if (discountType === 'PWD' || discountType === 'SENIOR') {
          discAmt = Math.round(perPerson * qualifying * 0.20 * 100) / 100;
          discLabel = `₱${subtotal.toFixed(2)} × 20% × ${qualifying} ${discountType} = `;
        } else if (discountType === 'BOTH') {
          discAmt = Math.round(perPerson * qualifying * 0.20 * 100) / 100;
          discLabel = `₱${subtotal.toFixed(2)} × 20% × ${qualifying} qualifying = `;
        }
        const newTotal = Math.max(0, Math.round((subtotal + sc - discAmt) * 100) / 100);

        return (
          <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)' }}
            onClick={() => setDiscountModal(null)}>
            <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'24px 20px 32px', width:'100%', maxWidth:480, maxHeight:'92vh', overflowY:'auto' }}
              onClick={e => e.stopPropagation()}>

              <div style={{ fontWeight:800, fontSize:16, color:'#111', marginBottom:16 }}>Apply Discount</div>

              {/* Discount type grid */}
              <div style={{ marginBottom:6, fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em' }}>DISCOUNT TYPE</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                {([
                  { id:'PWD',    label:'♿ PWD (20%)'    },
                  { id:'SENIOR', label:'😶 Senior (20%)' },
                  { id:'BOTH',   label:'♿😶 Both (20%)'  },
                  { id:'PROMO',  label:'🎉 Promo %'       },
                  { id:'CUSTOM', label:'✍️ Custom ₱'      },
                ] as const).map(opt => (
                  <button key={opt.id} onClick={() => setDiscountType(opt.id as 'PWD'|'SENIOR')}
                    style={{ padding:'12px 8px', borderRadius:10, border:`1.5px solid ${discountType===opt.id?'#16a34a':'#e5e7eb'}`, background: discountType===opt.id ? '#16a34a' : '#fff', color: discountType===opt.id ? '#fff' : '#374151', fontWeight:700, fontSize:14, cursor:'pointer', textAlign:'center' }}>
                    {opt.label}
                  </button>
                ))}
                {/* Remove discount button */}
                <button onClick={async () => {
                  setDiscountLoading(true);
                  await fetch(`/api/orders/${discountModal.orderId}/discount`, {
                    method:'POST', credentials:'include',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({ discountType: null, pwdCount:0, seniorCount:0, pax: totalPax }),
                  });
                  await fetchOrders(tenantSlug);
                  setDiscountLoading(false); setDiscountModal(null);
                }} style={{ padding:'12px 8px', borderRadius:10, border:'1.5px solid #fca5a5', background:'#fff', color:'#ef4444', fontWeight:700, fontSize:14, cursor:'pointer', textAlign:'center' }}>
                  ✕ Remove
                </button>
              </div>

              {/* Pax inputs */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:12, color:'#374151', fontWeight:600, display:'block', marginBottom:6 }}>Total people in party</label>
                  <div style={{ display:'flex', alignItems:'center', border:'1.5px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                    <button onClick={() => { const n = Math.max(1, discountTotalPax-1); setDiscountTotalPax(n); setDiscountPaxInput(Math.min(discountPaxInput,n)); }}
                      style={{ padding:'10px 14px', border:'none', background:'#f3f4f6', cursor:'pointer', fontSize:18, fontWeight:700, color:'#374151' }}>−</button>
                    <input type="number" min={1} max={50} value={discountTotalPax}
                      onChange={e => { const n=Math.max(1,parseInt(e.target.value)||1); setDiscountTotalPax(n); setDiscountPaxInput(Math.min(discountPaxInput,n)); }}
                      style={{ flex:1, border:'none', padding:'10px 0', fontSize:15, fontWeight:700, color:'#111', outline:'none', textAlign:'center' }}/>
                    <button onClick={() => setDiscountTotalPax(discountTotalPax+1)}
                      style={{ padding:'10px 14px', border:'none', background:'#f3f4f6', cursor:'pointer', fontSize:18, fontWeight:700, color:'#374151' }}>+</button>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:12, color:'#374151', fontWeight:600, display:'block', marginBottom:6 }}>Qualifying (PWD/Senior)</label>
                  <div style={{ display:'flex', alignItems:'center', border:'1.5px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                    <button onClick={() => setDiscountPaxInput(Math.max(0, discountPaxInput-1))}
                      style={{ padding:'10px 14px', border:'none', background:'#f3f4f6', cursor:'pointer', fontSize:18, fontWeight:700, color:'#374151' }}>−</button>
                    <input type="number" min={0} max={totalPax} value={discountPaxInput}
                      onChange={e => setDiscountPaxInput(Math.min(totalPax, Math.max(0, parseInt(e.target.value)||0)))}
                      style={{ flex:1, border:'none', padding:'10px 0', fontSize:15, fontWeight:700, color:'#111', outline:'none', textAlign:'center' }}/>
                    <button onClick={() => setDiscountPaxInput(Math.min(totalPax, discountPaxInput+1))}
                      style={{ padding:'10px 14px', border:'none', background:'#f3f4f6', cursor:'pointer', fontSize:18, fontWeight:700, color:'#374151' }}>+</button>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12, color:'#374151', fontWeight:600, display:'block', marginBottom:6 }}>Note (optional)</label>
                <input placeholder="e.g. Promo code: SAVE10" style={{ width:'100%', boxSizing:'border-box', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'10px 12px', fontSize:14, color:'#111', outline:'none' }}/>
              </div>

              {/* Discount preview */}
              {qualifying > 0 && (discountType === 'PWD' || discountType === 'SENIOR' || discountType === 'BOTH') && (
                <div style={{ background:'rgba(22,163,74,0.07)', border:'1.5px solid rgba(22,163,74,0.25)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
                  <div style={{ fontWeight:800, color:'#15803d', marginBottom:8, fontSize:13 }}>DISCOUNT PREVIEW</div>
                  <div style={{ fontSize:13, color:'#166534', marginBottom:4 }}>
                    ₱{subtotal.toFixed(2)} ÷ {totalPax} pax = <strong>₱{perPerson.toFixed(2)}/person</strong>
                  </div>
                  <div style={{ fontSize:13, color:'#166534', marginBottom:8 }}>
                    ₱{perPerson.toFixed(2)} × 20% × {qualifying} {discountType === 'BOTH' ? 'qualifying' : discountType} = <strong style={{ color:'#dc2626' }}>−₱{discAmt.toFixed(2)}</strong>
                  </div>
                  <div style={{ borderTop:'1.5px dashed rgba(22,163,74,0.3)', paddingTop:8, fontSize:15, color:'#15803d' }}>
                    New total: <strong style={{ fontSize:18 }}>₱{newTotal.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              {/* Apply button */}
              <button disabled={discountLoading || qualifying === 0} onClick={async () => {
                setDiscountLoading(true);
                const dt = discountType === 'BOTH' ? 'PWD' : discountType as 'PWD'|'SENIOR';
                const pwd = discountType === 'BOTH' || discountType === 'PWD' ? qualifying : 0;
                const senior = discountType === 'SENIOR' ? qualifying : 0;
                await fetch(`/api/orders/${discountModal.orderId}/discount`, {
                  method:'POST', credentials:'include',
                  headers:{'Content-Type':'application/json'},
                  body:JSON.stringify({ discountType: dt, pwdCount: pwd, seniorCount: senior, pax: totalPax }),
                });
                await fetchOrders(tenantSlug);
                setDiscountLoading(false); setDiscountModal(null);
              }} style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background: discountLoading||qualifying===0 ? '#9ca3af' : '#16a34a', color:'#fff', fontWeight:800, fontSize:16, cursor: discountLoading||qualifying===0 ? 'not-allowed':'pointer', marginBottom:10 }}>
                {discountLoading ? 'Applying…' : '✅ Apply Discount'}
              </button>
              <button onClick={() => setDiscountModal(null)}
                style={{ width:'100%', padding:'10px', borderRadius:12, border:'none', background:'transparent', color:'#6b7280', fontWeight:600, fontSize:15, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Email Receipt Modal ───────────────────────────── */}
      {emailModal && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}
          onClick={() => setEmailModal(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:24, width:'100%', maxWidth:400, margin:16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:16, color:'#111', marginBottom:4 }}>📧 Email Receipt</div>
            <div style={{ color:'#6b7280', fontSize:13, marginBottom:20 }}>#{emailModal.orderNumber}</div>

            {emailSent ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
                <div style={{ fontWeight:700, color:'#16a34a', fontSize:16 }}>Receipt sent!</div>
                <div style={{ color:'#6b7280', fontSize:13, marginTop:4 }}>Check {emailInput}</div>
                <button onClick={() => setEmailModal(null)}
                  style={{ marginTop:16, padding:'10px 24px', borderRadius:10, border:'none', background:'#16a34a', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8 }}>
                  Customer Email *
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="customer@email.com"
                  style={{ width:'100%', boxSizing:'border-box', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'10px 12px', fontSize:14, color:'#111', outline:'none', marginBottom:16 }}
                />
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setEmailModal(null)}
                    style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid #e5e7eb', background:'#f9fafb', color:'#6b7280', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button disabled={emailSending || !emailInput.includes('@')} onClick={async () => {
                    setEmailSending(true);
                    const r = await fetch(`/api/orders/${emailModal.orderId}/email-receipt`, {
                      method:'POST', credentials:'include',
                      headers:{'Content-Type':'application/json'},
                      body:JSON.stringify({ email: emailInput }),
                    });
                    setEmailSending(false);
                    if (r.ok) setEmailSent(true);
                    else {
                      const d = await r.json() as {error?:string};
                      alert(d.error ?? 'Failed to send email');
                    }
                  }} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background: emailSending||!emailInput.includes('@')?'#9ca3af':'#2563eb', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    {emailSending ? 'Sending…' : '📧 Send Receipt'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {cancelModal && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}
          onClick={() => setCancelModal(null)}>
          <div style={{ background:'#1a1f2e', border:'1px solid rgba(239,68,68,0.3)', borderRadius:16, padding:24, width:'100%', maxWidth:380, margin:16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:16, color:'#e8eaf0', marginBottom:4 }}>Cancel Order</div>
            <div style={{ color:'#6b7280', fontSize:13, marginBottom:20 }}>#{cancelModal.orderNumber}</div>
            <label style={{ color:'#9ca3af', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:8 }}>Reason *</label>
            <select value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'10px 12px', color:'#e8eaf0', fontSize:14, outline:'none', marginBottom:20 }}>
              {['Customer changed mind','Item out of stock','Duplicate order','Payment not received','Test order / migration cleanup','Other'].map(r => (
                <option key={r} value={r} style={{ background:'#1a1f2e' }}>{r}</option>
              ))}
            </select>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setCancelModal(null)}
                style={{ padding:'9px 18px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#9ca3af', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                Dismiss
              </button>
              <button onClick={() => { void bumpStatus(cancelModal.orderId, 'CANCELLED', cancelReason); setCancelModal(null); }}
                style={{ padding:'9px 18px', borderRadius:8, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', color:'#f87171', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Email Receipt Modal ───────────────────────────── */}
      {emailModal && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}
          onClick={() => setEmailModal(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:24, width:'100%', maxWidth:400, margin:16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:16, color:'#111', marginBottom:4 }}>📧 Email Receipt</div>
            <div style={{ color:'#6b7280', fontSize:13, marginBottom:20 }}>#{emailModal.orderNumber}</div>

            {emailSent ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
                <div style={{ fontWeight:700, color:'#16a34a', fontSize:16 }}>Receipt sent!</div>
                <div style={{ color:'#6b7280', fontSize:13, marginTop:4 }}>Check {emailInput}</div>
                <button onClick={() => setEmailModal(null)}
                  style={{ marginTop:16, padding:'10px 24px', borderRadius:10, border:'none', background:'#16a34a', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8 }}>
                  Customer Email *
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="customer@email.com"
                  style={{ width:'100%', boxSizing:'border-box', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'10px 12px', fontSize:14, color:'#111', outline:'none', marginBottom:16 }}
                />
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setEmailModal(null)}
                    style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid #e5e7eb', background:'#f9fafb', color:'#6b7280', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button disabled={emailSending || !emailInput.includes('@')} onClick={async () => {
                    setEmailSending(true);
                    const r = await fetch(`/api/orders/${emailModal.orderId}/email-receipt`, {
                      method:'POST', credentials:'include',
                      headers:{'Content-Type':'application/json'},
                      body:JSON.stringify({ email: emailInput }),
                    });
                    setEmailSending(false);
                    if (r.ok) setEmailSent(true);
                    else {
                      const d = await r.json() as {error?:string};
                      alert(d.error ?? 'Failed to send email');
                    }
                  }} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background: emailSending||!emailInput.includes('@')?'#9ca3af':'#2563eb', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    {emailSending ? 'Sending…' : '📧 Send Receipt'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {cancelModal && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}
          onClick={() => setCancelModal(null)}>
          <div style={{ background:'#1a1f2e', border:'1px solid rgba(239,68,68,0.3)', borderRadius:16, padding:24, width:'100%', maxWidth:380, margin:16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:16, color:'#e8eaf0', marginBottom:4 }}>Cancel Order</div>
            <div style={{ color:'#6b7280', fontSize:13, marginBottom:20 }}>#{cancelModal.orderNumber}</div>
            <label style={{ color:'#9ca3af', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:8 }}>Reason *</label>
            <select value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'10px 12px', color:'#e8eaf0', fontSize:14, outline:'none', marginBottom:20 }}>
              {['Customer changed mind','Item out of stock','Duplicate order','Payment not received','Test order / migration cleanup','Other'].map(r => (
                <option key={r} value={r} style={{ background:'#1a1f2e' }}>{r}</option>
              ))}
            </select>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setCancelModal(null)}
                style={{ padding:'9px 18px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#9ca3af', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                Dismiss
              </button>
              <button onClick={() => { void bumpStatus(cancelModal.orderId, 'CANCELLED', cancelReason); setCancelModal(null); }}
                style={{ padding:'9px 18px', borderRadius:8, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', color:'#f87171', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}