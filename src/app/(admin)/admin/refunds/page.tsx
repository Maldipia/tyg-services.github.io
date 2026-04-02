'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';

interface Refund {
  id: string; refund_type: string; amount: number; reason: string;
  reason_code: string | null; notes: string | null; created_at: string;
  staff: { display_name: string } | null;
  order: { order_number: string; total_amount: number } | null;
}

const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  FULL:    { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626' },
  PARTIAL: { bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
  VOID:    { bg: 'rgba(107,114,128,0.12)',color: '#6b7280' },
};

const inp = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box' as const };
const lbl = { display:'block', fontSize:12, fontWeight:600 as const, color:'var(--text-muted)', marginBottom:6, letterSpacing:'0.04em', textTransform:'uppercase' as const };

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Form
  const [orderId, setOrderId]     = useState('');
  const [refundType, setRefundType] = useState<'FULL'|'PARTIAL'|'VOID'>('FULL');
  const [amount, setAmount]       = useState('');
  const [reason, setReason]       = useState('');
  const [reasonCode, setReasonCode] = useState('CUSTOMER_REQUEST');
  const [formNotes, setFormNotes] = useState('');

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/refunds', { credentials: 'include' });
      const d = await r.json() as { data?: Refund[] };
      setRefunds(d.data ?? []);
    } catch {/**/ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!orderId.trim() || !amount || !reason.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/refunds', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: orderId.trim(), refundType, amount: parseFloat(amount), reason: reason.trim(), reasonCode, notes: formNotes || undefined }) });
      const d = await r.json() as { error?: string };
      if (d.error) { showToast(d.error, false); return; }
      showToast('Refund recorded ✅'); setShowForm(false); setOrderId(''); setAmount(''); setReason(''); setFormNotes(''); void load();
    } finally { setSaving(false); }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  const peso = (n: number) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  return (
    <AdminShell>
      <style>{`*{box-sizing:border-box}`}</style>
      {toast && <div style={{ position:'fixed', top:80, right:24, background: toast.ok ? '#16a34a' : '#dc2626', color:'#fff', padding:'12px 20px', borderRadius:12, fontWeight:600, fontSize:14, zIndex:9999 }}>{toast.msg}</div>}

      <div style={{ padding:24, maxWidth:860, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)', margin:0 }}>↩️ Refunds</h1>
            <p style={{ color:'var(--text-muted)', fontSize:13, margin:'4px 0 0' }}>Full, partial, and void refunds</p>
          </div>
          <button onClick={() => setShowForm(true)} style={{ background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', border:'none', padding:'10px 20px', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            + Issue Refund
          </button>
        </div>

        {loading ? <p style={{ color:'var(--text-muted)', textAlign:'center', padding:40 }}>Loading…</p>
        : refunds.length === 0 ? <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}><div style={{ fontSize:48, marginBottom:12 }}>↩️</div><p>No refunds recorded</p></div>
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {refunds.map(r => {
              const tc = TYPE_COLOR[r.refund_type] ?? { bg:'rgba(107,114,128,0.12)', color:'#6b7280' };
              return (
                <div key={r.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                  <div>
                    <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontWeight:700, color:'var(--text)' }}>Order #{r.order?.order_number ?? '—'}</span>
                      <span style={{ background: tc.bg, color: tc.color, padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:700 }}>{r.refund_type}</span>
                    </div>
                    <div style={{ color:'var(--text-muted)', fontSize:13 }}>{r.reason}{r.reason_code ? ` · ${r.reason_code.replace(/_/g,' ')}` : ''}</div>
                    {r.notes && <div style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic', marginTop:2 }}>{r.notes}</div>}
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{fmt(r.created_at)}{r.staff ? ` · ${r.staff.display_name}` : ''}</div>
                  </div>
                  <div style={{ fontWeight:800, fontSize:18, color:'#ef4444', alignSelf:'center' }}>-{peso(r.amount)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ fontWeight:700, fontSize:16, color:'var(--text)', margin:0 }}>Issue Refund</h3>
              <button onClick={() => setShowForm(false)} style={{ color:'var(--text-muted)', fontSize:22, background:'none', border:'none', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
              <div><label style={lbl}>Order ID (UUID) *</label><input style={inp} value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
              <div>
                <label style={lbl}>Refund Type *</label>
                <div style={{ display:'flex', gap:8 }}>
                  {(['FULL','PARTIAL','VOID'] as const).map(t => (
                    <button key={t} onClick={() => setRefundType(t)} style={{ flex:1, padding:'8px 0', borderRadius:8, border:`1px solid ${refundType===t ? '#dc2626' : 'var(--border)'}`, background: refundType===t ? 'rgba(239,68,68,0.12)' : 'var(--surface-2)', color: refundType===t ? '#dc2626' : 'var(--text-muted)', fontWeight:600, fontSize:13, cursor:'pointer' }}>{t}</button>
                  ))}
                </div>
              </div>
              <div><label style={lbl}>Amount (₱) *</label><input type="number" min="0.01" step="0.01" style={inp} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
              <div>
                <label style={lbl}>Reason Code *</label>
                <select style={inp} value={reasonCode} onChange={e => setReasonCode(e.target.value)}>
                  <option value="CUSTOMER_REQUEST">Customer Request</option>
                  <option value="WRONG_ORDER">Wrong Order</option>
                  <option value="QUALITY_ISSUE">Quality Issue</option>
                  <option value="DUPLICATE">Duplicate Payment</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div><label style={lbl}>Details *</label><textarea style={{ ...inp, resize:'vertical', minHeight:72 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the reason for refund…" /></div>
              <div><label style={lbl}>Internal Notes</label><input style={inp} value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes…" /></div>
            </div>
            <div style={{ padding:'0 24px 24px', display:'flex', gap:12 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:12, borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-muted)', fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={submit} disabled={!orderId||!amount||!reason||saving} style={{ flex:2, padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:700, cursor:'pointer' }}>{saving ? 'Processing…' : 'Issue Refund'}</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
