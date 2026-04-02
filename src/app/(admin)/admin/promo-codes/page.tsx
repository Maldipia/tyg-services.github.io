'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';

interface PromoCode {
  id: string; code: string; description: string | null;
  discount_type: 'PERCENT' | 'FIXED'; discount_value: number;
  min_order_amount: number; usage_limit: number | null; usage_count: number;
  starts_at: string | null; expires_at: string | null; is_active: boolean;
  created_at: string;
}

const inp = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box' as const };
const lbl = { display:'block', fontSize:12, fontWeight:600 as const, color:'var(--text-muted)', marginBottom:6, letterSpacing:'0.04em', textTransform:'uppercase' as const };

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [code, setCode]               = useState('');
  const [desc, setDesc]               = useState('');
  const [dtype, setDtype]             = useState<'PERCENT'|'FIXED'>('PERCENT');
  const [dvalue, setDvalue]           = useState('');
  const [minOrder, setMinOrder]       = useState('0');
  const [usageLimit, setUsageLimit]   = useState('');
  const [expiresAt, setExpiresAt]     = useState('');

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/promo-codes', { credentials: 'include' });
      const d = await r.json() as { data?: PromoCode[] };
      setCodes(d.data ?? []);
    } catch {/**/ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!code.trim() || !dvalue) return;
    setSaving(true);
    try {
      const r = await fetch('/api/promo-codes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), description: desc || undefined, discountType: dtype, discountValue: parseFloat(dvalue), minOrderAmount: parseFloat(minOrder) || 0, usageLimit: usageLimit ? parseInt(usageLimit) : null, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }) });
      const d = await r.json() as { error?: string };
      if (d.error) { showToast(d.error, false); return; }
      showToast('Promo code created ✅'); setShowForm(false); setCode(''); setDesc(''); setDvalue(''); setMinOrder('0'); setUsageLimit(''); setExpiresAt(''); void load();
    } finally { setSaving(false); }
  };

  const toggle = async (id: string, active: boolean) => {
    await fetch(`/api/promo-codes/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: active }) });
    void load();
  };

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <AdminShell>
      <style>{`*{box-sizing:border-box}`}</style>
      {toast && <div style={{ position:'fixed', top:80, right:24, background: toast.ok ? '#16a34a' : '#dc2626', color:'#fff', padding:'12px 20px', borderRadius:12, fontWeight:600, fontSize:14, zIndex:9999 }}>{toast.msg}</div>}

      <div style={{ padding:24, maxWidth:860, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)', margin:0 }}>🎟️ Promo Codes</h1>
            <p style={{ color:'var(--text-muted)', fontSize:13, margin:'4px 0 0' }}>Discount codes for orders</p>
          </div>
          <button onClick={() => setShowForm(true)} style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', padding:'10px 20px', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            + New Code
          </button>
        </div>

        {loading ? <p style={{ color:'var(--text-muted)', textAlign:'center', padding:40 }}>Loading…</p>
        : codes.length === 0 ? <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}><div style={{ fontSize:48, marginBottom:12 }}>🎟️</div><p>No promo codes yet</p></div>
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {codes.map(c => {
              const expired = c.expires_at && new Date(c.expires_at) < new Date();
              const exhausted = c.usage_limit !== null && c.usage_count >= c.usage_limit;
              return (
                <div key={c.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px', opacity: (!c.is_active || !!expired) ? 0.55 : 1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                        <code style={{ fontWeight:800, fontSize:17, color:'var(--text)', letterSpacing:'0.06em', background:'var(--surface-2)', padding:'2px 10px', borderRadius:6 }}>{c.code}</code>
                        <span style={{ fontWeight:700, color:'#16a34a', fontSize:15 }}>
                          {c.discount_type === 'PERCENT' ? `${c.discount_value}% off` : `₱${c.discount_value} off`}
                        </span>
                        {!c.is_active && <span style={{ fontSize:11, background:'rgba(107,114,128,0.15)', color:'#6b7280', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>INACTIVE</span>}
                        {expired && <span style={{ fontSize:11, background:'rgba(239,68,68,0.12)', color:'#dc2626', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>EXPIRED</span>}
                        {exhausted && <span style={{ fontSize:11, background:'rgba(245,158,11,0.12)', color:'#d97706', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>EXHAUSTED</span>}
                      </div>
                      {c.description && <div style={{ color:'var(--text-muted)', fontSize:13, marginBottom:2 }}>{c.description}</div>}
                      <div style={{ color:'var(--text-muted)', fontSize:12 }}>
                        Used: {c.usage_count}{c.usage_limit ? `/${c.usage_limit}` : ''}
                        {c.min_order_amount > 0 && ` · Min order ₱${c.min_order_amount}`}
                        {c.expires_at && ` · Expires ${fmt(c.expires_at)}`}
                      </div>
                    </div>
                    <button onClick={() => toggle(c.id, !c.is_active)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-muted)', fontWeight:600, fontSize:12, cursor:'pointer' }}>
                      {c.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ fontWeight:700, fontSize:16, color:'var(--text)', margin:0 }}>Create Promo Code</h3>
              <button onClick={() => setShowForm(false)} style={{ color:'var(--text-muted)', fontSize:22, background:'none', border:'none', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
              <div><label style={lbl}>Code *</label><input style={{ ...inp, textTransform:'uppercase', fontFamily:'monospace', letterSpacing:'0.06em' }} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/\s+/g,''))} placeholder="OPENING20" /></div>
              <div><label style={lbl}>Description</label><input style={inp} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Opening promo — 20% off" /></div>
              <div>
                <label style={lbl}>Discount Type *</label>
                <div style={{ display:'flex', gap:8 }}>
                  {(['PERCENT','FIXED'] as const).map(t => (
                    <button key={t} onClick={() => setDtype(t)} style={{ flex:1, padding:'8px 0', borderRadius:8, border:`1px solid ${dtype===t ? '#16a34a' : 'var(--border)'}`, background: dtype===t ? 'rgba(34,197,94,0.1)' : 'var(--surface-2)', color: dtype===t ? '#16a34a' : 'var(--text-muted)', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                      {t === 'PERCENT' ? '% Percent' : '₱ Fixed'}
                    </button>
                  ))}
                </div>
              </div>
              <div><label style={lbl}>{dtype === 'PERCENT' ? 'Discount %' : 'Fixed Amount (₱)'} *</label><input type="number" min="0.01" max={dtype==='PERCENT'?'100':undefined} step="0.01" style={inp} value={dvalue} onChange={e => setDvalue(e.target.value)} placeholder={dtype==='PERCENT'?'10':'50'} /></div>
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1 }}><label style={lbl}>Min Order (₱)</label><input type="number" min="0" style={inp} value={minOrder} onChange={e => setMinOrder(e.target.value)} placeholder="0" /></div>
                <div style={{ flex:1 }}><label style={lbl}>Usage Limit</label><input type="number" min="1" style={inp} value={usageLimit} onChange={e => setUsageLimit(e.target.value)} placeholder="Unlimited" /></div>
              </div>
              <div><label style={lbl}>Expires At</label><input type="datetime-local" style={inp} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></div>
            </div>
            <div style={{ padding:'0 24px 24px', display:'flex', gap:12 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:12, borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-muted)', fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={save} disabled={!code||!dvalue||saving} style={{ flex:2, padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', fontWeight:700, cursor:'pointer' }}>{saving ? 'Saving…' : 'Create Code'}</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
