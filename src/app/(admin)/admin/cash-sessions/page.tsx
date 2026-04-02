'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';

interface CashSession {
  id: string; status: string; opening_float: number; closing_count: number | null;
  cash_sales: number; expected_cash: number; variance: number | null;
  notes: string | null; opened_at: string; closed_at: string | null;
  denominations: Record<string, number> | null;
  opened_by_staff: { display_name: string } | null;
  closed_by_staff: { display_name: string } | null;
}

const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
const inp = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box' as const };
const lbl = { display:'block', fontSize:12, fontWeight:600 as const, color:'var(--text-muted)', marginBottom:6, letterSpacing:'0.04em', textTransform:'uppercase' as const };

export default function CashSessionsPage() {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [openSession, setOpenSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [float, setFloat] = useState('');
  const [notes, setNotes] = useState('');
  const [denomCounts, setDenomCounts] = useState<Record<number, string>>({});
  const [closeNotes, setCloseNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [open, closed] = await Promise.all([
        fetch('/api/cash-sessions?status=OPEN', { credentials: 'include' }).then(r => r.json()) as Promise<{ data?: CashSession[] }>,
        fetch('/api/cash-sessions?status=CLOSED', { credentials: 'include' }).then(r => r.json()) as Promise<{ data?: CashSession[] }>,
      ]);
      setOpenSession((open.data ?? [])[0] ?? null);
      setSessions(tab === 'OPEN' ? (open.data ?? []) : (closed.data ?? []));
    } catch {/**/ } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  const openNewSession = async () => {
    if (!float) return;
    setSaving(true);
    try {
      const r = await fetch('/api/cash-sessions', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openingFloat: parseFloat(float), notes: notes || undefined }) });
      const d = await r.json() as { error?: string };
      if (d.error) { showToast(d.error, false); return; }
      showToast('Cash session opened ✅'); setShowOpenModal(false); setFloat(''); setNotes(''); void load();
    } finally { setSaving(false); }
  };

  const closeSession = async () => {
    if (!openSession) return;
    const total = DENOMS.reduce((s, d) => s + d * (parseInt(denomCounts[d] ?? '0') || 0), 0);
    setSaving(true);
    try {
      const r = await fetch(`/api/cash-sessions/${openSession.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closingCount: total, denominations: Object.fromEntries(DENOMS.map(d => [String(d), parseInt(denomCounts[d] ?? '0') || 0])), notes: closeNotes || undefined }) });
      const d = await r.json() as { error?: string; data?: { variance: number } };
      if (d.error) { showToast(d.error, false); return; }
      const v = d.data?.variance ?? 0;
      showToast(`Session closed. Variance: ${v >= 0 ? '+' : ''}₱${v.toFixed(2)} ${Math.abs(v) < 10 ? '✅' : '⚠️'}`);
      setShowCloseModal(false); setDenomCounts({}); setCloseNotes(''); void load();
    } finally { setSaving(false); }
  };

  const denomTotal = DENOMS.reduce((s, d) => s + d * (parseInt(denomCounts[d] ?? '0') || 0), 0);
  const fmt = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  const peso = (n: number | null) => n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—';

  return (
    <AdminShell>
      <style>{`*{box-sizing:border-box}`}</style>
      {toast && <div style={{ position:'fixed', top:80, right:24, background: toast.ok ? '#16a34a' : '#dc2626', color:'#fff', padding:'12px 20px', borderRadius:12, fontWeight:600, fontSize:14, zIndex:9999 }}>{toast.msg}</div>}

      <div style={{ padding:24, maxWidth:860, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)', margin:0 }}>💵 Cash Sessions</h1>
            <p style={{ color:'var(--text-muted)', fontSize:13, margin:'4px 0 0' }}>Shift float management and reconciliation</p>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {openSession && <button onClick={() => setShowCloseModal(true)} style={{ padding:'10px 18px', borderRadius:10, background:'rgba(239,68,68,0.1)', color:'#dc2626', border:'1px solid rgba(239,68,68,0.3)', fontWeight:700, fontSize:14, cursor:'pointer' }}>Close Session</button>}
            {!openSession && <button onClick={() => setShowOpenModal(true)} style={{ padding:'10px 18px', borderRadius:10, background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>Open Session</button>}
          </div>
        </div>

        {/* Active session banner */}
        {openSession && (
          <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:14, padding:'16px 20px', marginBottom:24, display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#22c55e', animation:'pulse 2s infinite', flexShrink:0 }} />
            <div>
              <div style={{ fontWeight:700, color:'var(--text)', fontSize:15 }}>Session Open</div>
              <div style={{ color:'var(--text-muted)', fontSize:13 }}>Float: {peso(openSession.opening_float)} · Opened {fmt(openSession.opened_at)}{openSession.opened_by_staff ? ` by ${openSession.opened_by_staff.display_name}` : ''}</div>
            </div>
          </div>
        )}

        {/* Tab filter */}
        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          {(['OPEN','CLOSED'] as const).map(s => <button key={s} onClick={() => setTab(s)} style={{ padding:'6px 18px', borderRadius:8, border:'1px solid var(--border)', background: tab===s ? '#16a34a' : 'var(--surface)', color: tab===s ? '#fff' : 'var(--text-muted)', fontWeight:600, fontSize:13, cursor:'pointer' }}>{s}</button>)}
        </div>

        {loading ? <p style={{ color:'var(--text-muted)', textAlign:'center', padding:40 }}>Loading…</p>
        : sessions.length === 0 ? <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}><div style={{ fontSize:48, marginBottom:12 }}>💵</div><p>No {tab.toLowerCase()} sessions</p></div>
        : sessions.map(s => (
          <div key={s.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px', marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ fontWeight:700, color:'var(--text)', marginBottom:4 }}>{fmt(s.opened_at)}{s.closed_at ? ` → ${fmt(s.closed_at)}` : ' (Open)'}</div>
                <div style={{ color:'var(--text-muted)', fontSize:13 }}>Float: {peso(s.opening_float)} · Cash Sales: {peso(s.cash_sales)} · Expected: {peso(s.expected_cash)}</div>
                {s.closed_at && <div style={{ fontSize:13, fontWeight:700, color: Math.abs(s.variance ?? 0) < 10 ? '#16a34a' : '#f59e0b', marginTop:4 }}>Variance: {s.variance != null ? `${s.variance >= 0 ? '+' : ''}${peso(s.variance)}` : '—'}</div>}
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'right' }}>
                {s.opened_by_staff?.display_name ?? '—'}{s.closed_by_staff ? ` → ${s.closed_by_staff.display_name}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Open session modal */}
      {showOpenModal && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:400 }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ fontWeight:700, fontSize:16, color:'var(--text)', margin:0 }}>Open Cash Session</h3>
              <button onClick={() => setShowOpenModal(false)} style={{ color:'var(--text-muted)', fontSize:22, background:'none', border:'none', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
              <div><label style={lbl}>Opening Float (₱) *</label><input type="number" min="0" style={inp} value={float} onChange={e => setFloat(e.target.value)} placeholder="e.g. 2000" autoFocus /></div>
              <div><label style={lbl}>Notes</label><input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Shift start notes…" /></div>
            </div>
            <div style={{ padding:'0 24px 24px', display:'flex', gap:12 }}>
              <button onClick={() => setShowOpenModal(false)} style={{ flex:1, padding:12, borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-muted)', fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={openNewSession} disabled={!float || saving} style={{ flex:2, padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', fontWeight:700, cursor:'pointer' }}>{saving ? 'Opening…' : 'Open Session'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Close session modal — denomination count */}
      {showCloseModal && openSession && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ fontWeight:700, fontSize:16, color:'var(--text)', margin:0 }}>Close Session</h3>
              <button onClick={() => setShowCloseModal(false)} style={{ color:'var(--text-muted)', fontSize:22, background:'none', border:'none', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'var(--surface-2)', borderRadius:10, padding:14, fontSize:13, color:'var(--text-muted)' }}>
                Float: {peso(openSession.opening_float)} · Expected cash: {peso(openSession.expected_cash)}
              </div>
              <label style={lbl}>Count Bills & Coins</label>
              {DENOMS.map(d => (
                <div key={d} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ width:60, fontWeight:600, color:'var(--text)', fontSize:14 }}>₱{d}</span>
                  <input type="number" min="0" style={{ ...inp, flex:1 }} value={denomCounts[d] ?? ''} onChange={e => setDenomCounts(p => ({ ...p, [d]: e.target.value }))} placeholder="0" />
                  <span style={{ width:80, color:'var(--text-muted)', fontSize:13, textAlign:'right' }}>{peso(d * (parseInt(denomCounts[d] ?? '0') || 0))}</span>
                </div>
              ))}
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, display:'flex', justifyContent:'space-between', fontWeight:700 }}>
                <span>Total Count:</span>
                <span style={{ color: Math.abs(denomTotal - (openSession.expected_cash ?? 0)) < 10 ? '#16a34a' : '#f59e0b' }}>{peso(denomTotal)}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:600, color: Math.abs(denomTotal - (openSession.expected_cash ?? 0)) < 10 ? '#16a34a' : '#f59e0b' }}>
                Variance: {denomTotal - (openSession.expected_cash ?? 0) >= 0 ? '+' : ''}{peso(denomTotal - (openSession.expected_cash ?? 0))}
              </div>
              <div><label style={lbl}>Notes</label><input style={inp} value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="End-of-shift notes…" /></div>
            </div>
            <div style={{ padding:'0 24px 24px', display:'flex', gap:12 }}>
              <button onClick={() => setShowCloseModal(false)} style={{ flex:1, padding:12, borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-muted)', fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={closeSession} disabled={saving} style={{ flex:2, padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:700, cursor:'pointer' }}>{saving ? 'Closing…' : 'Close & Reconcile'}</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
