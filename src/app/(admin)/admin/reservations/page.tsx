'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';

interface Reservation {
  id: string; reservation_ref: string; customer_name: string;
  customer_phone: string | null; pax: number; reserved_at: string;
  duration_mins: number; status: string; occasion: string | null;
  notes: string | null; table: { name: string } | null;
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  CONFIRMED:  { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  SEATED:     { bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
  COMPLETED:  { bg: 'rgba(34,197,94,0.12)',  color: '#16a34a' },
  CANCELLED:  { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626' },
  NO_SHOW:    { bg: 'rgba(107,114,128,0.12)',color: '#6b7280' },
};

const inp = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box' as const };
const lbl = { display:'block', fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:6, letterSpacing:'0.04em', textTransform:'uppercase' as const };

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('CONFIRMED');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [pax, setPax]             = useState('2');
  const [reservedAt, setReservedAt] = useState('');
  const [occasion, setOccasion]   = useState('');
  const [notes, setNotes]         = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({ status: statusFilter });
      if (date) p.set('date', date);
      const r = await fetch(`/api/reservations?${p}`, { credentials: 'include' });
      const d = await r.json() as { data?: Reservation[] };
      setReservations(d.data ?? []);
    } catch {/**/ } finally { setLoading(false); }
  }, [statusFilter, date]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!name.trim() || !reservedAt) return;
    setSaving(true);
    try {
      const r = await fetch('/api/reservations', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name.trim(), customerPhone: phone || undefined, pax: parseInt(pax), reservedAt: new Date(reservedAt).toISOString(), occasion: occasion || undefined, notes: notes || undefined }),
      });
      const d = await r.json() as { error?: string; data?: { reservation_ref: string } };
      if (d.error) { showToast('Error: ' + d.error); return; }
      showToast('Reservation ' + (d.data?.reservation_ref ?? '') + ' confirmed!');
      setShowForm(false); setName(''); setPhone(''); setPax('2'); setReservedAt(''); setOccasion(''); setNotes('');
      void load();
    } finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/reservations/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    void load();
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <AdminShell>
      <style>{`*{box-sizing:border-box}`}</style>
      {toast && <div style={{ position:'fixed', top:80, right:24, background:'#16a34a', color:'#fff', padding:'12px 20px', borderRadius:12, fontWeight:600, fontSize:14, zIndex:9999 }}>{toast}</div>}

      <div style={{ padding:'24px', maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)', margin:0 }}>📅 Reservations</h1>
            <p style={{ color:'var(--text-muted)', fontSize:13, margin:'4px 0 0' }}>Manage table bookings and guest reservations</p>
          </div>
          <button onClick={() => setShowForm(true)} style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', padding:'10px 20px', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            + New Reservation
          </button>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          {['CONFIRMED','SEATED','COMPLETED','CANCELLED','ALL'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid var(--border)', background: statusFilter===s ? '#16a34a' : 'var(--surface)', color: statusFilter===s ? '#fff' : 'var(--text-muted)', fontWeight:600, fontSize:13, cursor:'pointer' }}>{s}</button>
          ))}
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width:'auto', padding:'6px 12px' }} />
          {date && <button onClick={() => setDate('')} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>Clear date</button>}
        </div>

        {/* List */}
        {loading ? <p style={{ color:'var(--text-muted)', textAlign:'center', padding:40 }}>Loading…</p>
        : reservations.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📅</div>
            <p>No reservations found</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {reservations.map(r => {
              const sc = STATUS_COLOR[r.status] ?? { bg:'rgba(99,102,241,0.12)', color:'#6366f1' };
              return (
                <div key={r.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                      <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{r.customer_name}</span>
                      <span style={{ background: sc.bg, color: sc.color, padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:700 }}>{r.status}</span>
                      <span style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'monospace' }}>{r.reservation_ref}</span>
                    </div>
                    <div style={{ color:'var(--text-muted)', fontSize:13 }}>
                      {fmt(r.reserved_at)} · {r.pax} pax{r.table ? ` · ${r.table.name}` : ''}{r.occasion ? ` · 🎉 ${r.occasion}` : ''}{r.customer_phone ? ` · ${r.customer_phone}` : ''}
                    </div>
                    {r.notes && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4, fontStyle:'italic' }}>"{r.notes}"</div>}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    {r.status === 'CONFIRMED' && <button onClick={() => updateStatus(r.id, 'SEATED')} style={{ padding:'6px 14px', borderRadius:8, background:'#d97706', color:'#fff', border:'none', fontWeight:600, fontSize:12, cursor:'pointer' }}>Seat</button>}
                    {r.status === 'SEATED'    && <button onClick={() => updateStatus(r.id, 'COMPLETED')} style={{ padding:'6px 14px', borderRadius:8, background:'#16a34a', color:'#fff', border:'none', fontWeight:600, fontSize:12, cursor:'pointer' }}>Complete</button>}
                    {['CONFIRMED','SEATED'].includes(r.status) && (
                      <button onClick={() => updateStatus(r.id, 'NO_SHOW')} style={{ padding:'6px 14px', borderRadius:8, background:'var(--surface-2)', color:'var(--text-muted)', border:'1px solid var(--border)', fontWeight:600, fontSize:12, cursor:'pointer' }}>No Show</button>
                    )}
                    {['CONFIRMED','SEATED'].includes(r.status) && (
                      <button onClick={() => { if(confirm('Cancel this reservation?')) updateStatus(r.id, 'CANCELLED'); }} style={{ padding:'6px 14px', borderRadius:8, background:'rgba(239,68,68,0.1)', color:'#dc2626', border:'1px solid rgba(239,68,68,0.3)', fontWeight:600, fontSize:12, cursor:'pointer' }}>Cancel</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Reservation Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ fontWeight:700, fontSize:16, color:'var(--text)', margin:0 }}>New Reservation</h3>
              <button onClick={() => setShowForm(false)} style={{ color:'var(--text-muted)', fontSize:22, background:'none', border:'none', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
              <div><label style={lbl}>Guest Name *</label><input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Maria Santos" /></div>
              <div><label style={lbl}>Phone</label><input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="09171234567" /></div>
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1 }}><label style={lbl}>Pax *</label><input type="number" min="1" max="50" style={inp} value={pax} onChange={e => setPax(e.target.value)} /></div>
                <div style={{ flex:2 }}><label style={lbl}>Date & Time *</label><input type="datetime-local" style={inp} value={reservedAt} onChange={e => setReservedAt(e.target.value)} /></div>
              </div>
              <div><label style={lbl}>Occasion</label><input style={inp} value={occasion} onChange={e => setOccasion(e.target.value)} placeholder="Birthday, Anniversary…" /></div>
              <div><label style={lbl}>Notes</label><textarea style={{ ...inp, resize:'vertical', minHeight:72 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requests…" /></div>
            </div>
            <div style={{ padding:'0 24px 24px', display:'flex', gap:12 }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:12, borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-muted)', fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={save} disabled={!name.trim() || !reservedAt || saving} style={{ flex:2, padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', fontWeight:700, cursor:'pointer' }}>{saving ? 'Saving…' : 'Confirm Reservation'}</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
