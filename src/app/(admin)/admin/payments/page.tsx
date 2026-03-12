'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
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
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    const stored = localStorage.getItem('tyg_session');
    if (stored) {
      try {
        const s = JSON.parse(stored) as { tenantId?: string };
        setTenantId(s.tenantId ?? null);
      } catch { /* */ }
    }
  }, []);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadPayments = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    let query = supabase
      .from('payments')
      .select(`
        id, order_id, method, status, amount, reference_number, proof_url, notes, created_at,
        orders(order_number, customer_name, customer_phone, customer_email, total_amount, status)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter !== 'ALL') query = query.eq('status', filter);
    const { data } = await query;
    setPayments(((data as unknown) as Payment[]) ?? []);
    setLoading(false);
  }, [tenantId, filter, supabase]);

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
          action,
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
          style={{ background: toast.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type === 'ok' ? '#22c55e' : '#ef4444', backdropFilter: 'blur(8px)' }}>
          {toast.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18 }}>Payment Verification</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {pendingCount > 0
              ? <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠ {pendingCount} payment{pendingCount > 1 ? 's' : ''} pending verification</span>
              : 'All payments reviewed'}
          </p>
        </div>
        <button onClick={loadPayments} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['PENDING_VERIFICATION', 'VERIFIED', 'FAILED', 'ALL'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: filter === s ? (s === 'PENDING_VERIFICATION' ? '#f59e0b' : s === 'VERIFIED' ? '#22c55e' : s === 'FAILED' ? '#ef4444' : '#6366f1') : 'var(--surface-2)',
              color: filter === s ? 'white' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>
            {s === 'PENDING_VERIFICATION' ? '⏳ Pending' : s === 'VERIFIED' ? '✅ Verified' : s === 'FAILED' ? '❌ Rejected' : '📋 All'}
          </button>
        ))}
      </div>

      {/* Payments list */}
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>Loading payments...</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <CreditCard size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontWeight: 600, fontSize: 15 }}>No payments found</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {filter === 'PENDING_VERIFICATION' ? 'All caught up! No pending payments.' : 'No payments match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map(p => {
            const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG['PENDING_VERIFICATION']!;
            const order = p.orders;
            return (
              <div key={p.id} className="rounded-2xl p-4 flex items-center justify-between gap-4"
                style={{ background: 'var(--surface)', border: p.status === 'PENDING_VERIFICATION' ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{order?.order_number ?? 'Unknown Order'}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: cfg?.bg, color: cfg?.color }}>{cfg?.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{METHOD_LABEL[p.method] ?? p.method}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span style={{ fontWeight: 700, fontSize: 16 }}>₱{Number(p.amount).toFixed(2)}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{order?.customer_name}</span>
                    {p.reference_number && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ref: {p.reference_number}</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {p.proof_url && (
                    <a href={p.proof_url} target="_blank" rel="noreferrer"
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}
                      title="View proof">
                      <Eye size={15} />
                    </a>
                  )}
                  {p.status === 'PENDING_VERIFICATION' && (
                    <button onClick={() => { setSelected(p); setNotes(''); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
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
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontWeight: 700, fontSize: 17 }}>Review Payment</h3>
              <button onClick={() => setSelected(null)} style={{ color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Order info */}
              <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.orders?.order_number}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{selected.orders?.customer_name}</div>
                    {selected.orders?.customer_phone && (
                      <div className="flex items-center gap-1 mt-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <Phone size={11} /> {selected.orders.customer_phone}
                      </div>
                    )}
                    {selected.orders?.customer_email && (
                      <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>REFERENCE NUMBER</div>
                  <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)', fontSize: 14, fontWeight: 600 }}>
                    {selected.reference_number}
                  </div>
                </div>
              )}

              {/* Payment proof image */}
              {selected.proof_url && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>PAYMENT PROOF</div>
                  <a href={selected.proof_url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden hover:opacity-90 transition-opacity" style={{ border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selected.proof_url} alt="Payment proof" className="w-full" style={{ maxHeight: 280, objectFit: 'contain', background: '#fff' }} />
                    <div className="flex items-center justify-center gap-1 py-2" style={{ fontSize: 12, color: '#6366f1', background: 'rgba(99,102,241,0.05)' }}>
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

            {/* Actions */}
            <div className="flex gap-3 px-6 py-5" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => handleVerify('REJECT')}
                disabled={verifying}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <X size={16} /> {verifying ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={() => handleVerify('VERIFY')}
                disabled={verifying}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}
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
