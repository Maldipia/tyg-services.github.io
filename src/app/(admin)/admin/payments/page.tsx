'use client';
import React from 'react';

import { useState, useEffect, useCallback } from 'react';
import { Check, X, Eye, Clock, RefreshCw, CreditCard, AlertCircle, Phone, Mail } from 'lucide-react';

interface Payment {
  id: string;
  order_id: string;
  method: string;
  status: string;
  amount: number;
  reference_number: string | null;
  proof_url: string | null;
  notes: string | null;
  created_at: string;
  orders: {
    order_number: string;
    customer_name: string;
    customer_phone: string | null;
    customer_email: string | null;
    total_amount: number;
    status: string;
  } | null;
}

const METHOD_LABEL: Record<string, string> = {
  GCASH: '📱 GCash',
  MAYA: '💙 Maya',
  BANK: '🏦 Bank Transfer',
  CASH: '💵 Cash',
  CARD: '💳 Card',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_VERIFICATION: { label: 'Needs Verification', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  VERIFIED:             { label: 'Verified',           color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  FAILED:               { label: 'Rejected',           color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  REFUNDED:             { label: 'Refunded',           color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('PENDING_VERIFICATION');
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  useEffect(() => {
    const tenant = localStorage.getItem('tyg_tenant');
    const session = localStorage.getItem('tyg_session');
    let slug = '';
    if (tenant)  { try { const t = JSON.parse(tenant)  as { slug?: string }; slug = t.slug ?? ''; } catch { /* */ } }
    if (session) { try { const s = JSON.parse(session) as { tenantSlug?: string }; if (s.tenantSlug) slug = s.tenantSlug; } catch { /* */ } }
    setTenantSlug(slug || null);
  }, []);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadPayments = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const statusParam = filter !== 'ALL' ? `&status=${filter}` : '';
      const r = await fetch(`/api/payments?tenantSlug=${tenantSlug}${statusParam}&limit=100`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json() as { data?: Payment[] };
        setPayments(d.data ?? []);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [tenantSlug, filter]);

  useEffect(() => { void loadPayments(); }, [loadPayments]);

  const handleVerify = async (action: 'VERIFY' | 'REJECT') => {
    if (!selected) return;
    setVerifying(true);
    try {
      const r = await fetch('/api/payment/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          paymentId: selected.id,
          orderId: selected.order_id,
          action: action === "VERIFY" ? "verify" : "reject",
          notes: notes.trim() || undefined,
        }),
      });
      const json = await r.json() as { error?: string };
      if (json.error) { showToast(json.error, 'err'); }
      else {
        showToast(action === 'VERIFY' ? '✅ Payment verified!' : '❌ Payment rejected');
        setSelected(null);
        setNotes('');
        void loadPayments();
      }
    } catch { showToast('Network error', 'err'); }
    setVerifying(false);
  };

  const pendingCount = payments.filter(p => p.status === 'PENDING_VERIFICATION').length;

  const inputStyle = {
    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none',
  };

  return (
    <div style={{ color: 'var(--text)' }}>
      <style>{`
        .pay-card{border-radius:20px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:16px}
        .pay-card-actions{display:flex;gap:8px;flex-shrink:0}
        @media(max-width:540px){
          .pay-card{flex-wrap:wrap;gap:10px}
          .pay-card-actions{width:100%;border-top:1px solid var(--border);padding-top:10px;justify-content:flex-end}
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:16, right:16, zIndex:9999, display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:14, boxShadow:"0 8px 32px rgba(0, 0, 0, 0.4)", background: toast.type === 'ok' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type === 'ok' ? '#22c55e' : '#ef4444', backdropFilter: 'blur(8px)' }}>
          {toast.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18 }}>Payment Verification</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {pendingCount > 0
              ? <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠ {pendingCount} payment{pendingCount > 1 ? 's' : ''} pending verification</span>
              : 'All payments reviewed'}
          </p>
        </div>         <button onClick={loadPayments} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", borderRadius:12, fontSize:13, cursor:"pointer", background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {['PENDING_VERIFICATION', 'VERIFIED', 'FAILED', 'ALL'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding:"6px 16px", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer", background: filter === s ? (s === 'PENDING_VERIFICATION' ? '#f59e0b' : s === 'VERIFIED' ? '#22c55e' : s === 'FAILED' ? '#ef4444' : '#6366f1') : 'var(--surface-2)', color: filter === s ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {s === 'PENDING_VERIFICATION' ? '⏳ Pending' : s === 'VERIFIED' ? '✅ Verified' : s === 'FAILED' ? '❌ Rejected' : '📋 All'}
          </button>
        ))}
      </div>

      {/* Payments list */}
      {loading ? (         <div style={{ textAlign:"center", padding:"64px 0", color: 'var(--text-muted)' }}>Loading payments...</div>
      ) : payments.length === 0 ? (         <div style={{ textAlign:"center", padding:"80px 24px", borderRadius:20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <CreditCard size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontWeight: 600, fontSize: 15 }}>No payments found</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {filter === 'PENDING_VERIFICATION' ? 'All caught up! No pending payments.' : 'No payments match this filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {payments.map(p => {
            const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG['PENDING_VERIFICATION']!;
            const order = p.orders;
            return (
              <div key={p.id} className="pay-card" style={{ background: 'var(--surface)', border: p.status === 'PENDING_VERIFICATION' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border)' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{order?.order_number ?? 'Unknown Order'}</span>                     <span style={{ padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:600, background: cfg?.bg, color: cfg?.color }}>{cfg?.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{METHOD_LABEL[p.method] ?? p.method}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:16, marginTop:4, flexWrap:"wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>₱{Number(p.amount).toFixed(2)}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{order?.customer_name}</span>
                    {p.reference_number && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ref: {p.reference_number}</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="pay-card-actions">
                  {p.proof_url && (
                    <a href={p.proof_url} target="_blank" rel="noreferrer"
                      style={{ width:36, height:36, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }}
                      title="View proof">
                      <Eye size={15} />
                    </a>
                  )}
                  {p.status === 'PENDING_VERIFICATION' && (
                    <button onClick={() => { setSelected(p); setNotes(''); }}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                      <Clock size={13} /> Review
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selected && (         <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)' }}>
          <div style={{ width:"100%", maxWidth:480, borderRadius:20, overflow:"hidden", background: 'var(--surface)', border: '1px solid var(--border)' }}>             <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontWeight: 700, fontSize: 17 }}>Review Payment</h3>
              <button onClick={() => setSelected(null)} style={{ color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding:24, display:"flex", flexDirection:"column", gap:16 }}>
              {/* Order info */}               <div style={{ padding:16, borderRadius:12, background: 'var(--surface-2)' }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.orders?.order_number}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{selected.orders?.customer_name}</div>
                    {selected.orders?.customer_phone && (                       <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4, fontSize: 12, color: 'var(--text-muted)' }}>
                        <Phone size={11} /> {selected.orders.customer_phone}
                      </div>
                    )}
                    {selected.orders?.customer_email && (                       <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2, fontSize: 12, color: 'var(--text-muted)' }}>
                        <Mail size={11} /> {selected.orders.customer_email}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 22, color: '#22c55e' }}>₱{Number(selected.amount).toFixed(2)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{METHOD_LABEL[selected.method] ?? selected.method}</div>
                  </div>
                </div>
              </div>

              {/* Payment details */}
              {selected.reference_number && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>REFERENCE NUMBER</div>                   <div style={{ padding:"8px 12px", borderRadius:8, background: 'var(--surface-2)', fontSize: 14, fontWeight: 600 }}>
                    {selected.reference_number}
                  </div>
                </div>
              )}

              {/* Payment proof image */}
              {selected.proof_url && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>PAYMENT PROOF</div>                   <a href={selected.proof_url} target="_blank" rel="noreferrer" style={{ display:"block", borderRadius:12, overflow:"hidden", border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}                     <img src={selected.proof_url} alt="Payment proof" style={{ width:"100%", display:"block", maxHeight: 280, objectFit: 'contain', background: '#fff' }} />
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4, padding:"8px 0", fontSize: 12, color: '#6366f1', background: 'rgba(99, 102, 241, 0.05)' }}>
                      <Eye size={12} /> Click to view full size
                    </div>
                  </a>
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Add a note for rejection or verification..."
                  style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Actions */}             <div style={{ display:"flex", gap:12, padding:"20px 24px", borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => handleVerify('REJECT')}
                disabled={verifying}
                style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px 0", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                <X size={16} /> {verifying ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={() => handleVerify('VERIFY')}
                disabled={verifying}
                style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px 0", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", border:"none", background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}
              >
                <Check size={16} /> {verifying ? 'Processing...' : 'Verify Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
