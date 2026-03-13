'use client';
import React from 'react';
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { QrCode, Printer, Plus, Pencil, Trash2, Check, AlertCircle, Users, Download, Grid } from 'lucide-react';

interface Table { id: string; name: string; capacity: number; qr_token: string; is_active: boolean; }
interface SessionData { tenantId?: string; tenantSlug?: string; tenantName?: string; tenantAddress?: string; }
interface ActiveOrder { id: string; order_number: string; status: string; table_id: string | null; total_amount: number; }

const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:    { bg: 'rgba(234,179,8,0.12)',  color: '#ca8a04', label: '⏳ Pending' },
  CONFIRMED:  { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', label: '✅ Confirmed' },
  PREPARING:  { bg: 'rgba(249,115,22,0.12)', color: '#ea580c', label: '🍳 Preparing' },
  READY:      { bg: 'rgba(34,197,94,0.15)',  color: '#16a34a', label: '🔔 Ready' },
};

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };
const inp: CSSProperties = { width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none' };
const lbl: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' };
const APP_URL = 'https://www.tyg-services.com';

function QRCodeSVG({ value, size = 160 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const enc = encodeURIComponent(value);
    setSrc(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${enc}&color=000000&bgcolor=ffffff&qzone=2`);
  }, [value, size]);
  return src
    ? <img src={src} alt="QR Code" width={size} height={size} style={{ borderRadius: 12 }} /> // eslint-disable-line @next/next/no-img-element
    : <div style={{ width: size, height: size, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><QrCode size={40} style={{ color: '#ccc' }} /></div>;
}

export default function TablesPage() {
  const [tables, setTables]     = useState<Table[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTable, setEditTable]   = useState<Table | null>(null);
  const [printTable, setPrintTable] = useState<Table | null>(null);
  const [printAll, setPrintAll]     = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok'|'err' } | null>(null);
  const [name, setName]         = useState('');
  const [capacity, setCapacity] = useState('4');
  const [saving, setSaving]     = useState(false);
  const [session, setSession]   = useState<SessionData>({ tenantSlug: 'yani', tenantName: 'Your Café' });
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('tyg_session');
    if (stored) { try { setSession(s => ({ ...s, ...JSON.parse(stored) as SessionData })); } catch { /**/ } }
    const tenant = localStorage.getItem('tyg_tenant');
    if (tenant) {
      try {
        const t = JSON.parse(tenant) as { name?: string; slug?: string; address?: string };
        setSession(s => ({ ...s, tenantName: t.name ?? s.tenantName ?? '', tenantSlug: t.slug ?? s.tenantSlug ?? 'yani', tenantAddress: t.address ?? s.tenantAddress ?? '' }) as typeof s);
      } catch { /**/ }
    }
  }, []);

  const tenantSlug    = session.tenantSlug    ?? 'yani';
  const tenantName    = session.tenantName    ?? 'Your Café';
  const tenantAddress = session.tenantAddress ?? '';

  const showToast = (msg: string, type: 'ok'|'err' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadTables = async () => {
    const r = await fetch(`/api/tables?tenant=${tenantSlug}`);
    const json = await r.json() as { data?: Table[] };
    setTables(json.data ?? []); setLoading(false);
  };
  useEffect(() => { void loadTables(); }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadActiveOrders = async () => {
    try {
      const r = await fetch(`/api/orders?tenantSlug=${tenantSlug}&status=active&limit=100`);
      if (r.ok) {
        const json = await r.json() as { data?: ActiveOrder[] };
        setActiveOrders(json.data ?? []);
      }
    } catch { /**/ }
  };
  useEffect(() => {
    void loadActiveOrders();
    const interval = setInterval(() => void loadActiveOrders(), 30_000);
    return () => clearInterval(interval);
  }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const openForm = (t?: Table) => { setEditTable(t ?? null); setName(t?.name ?? ''); setCapacity(String(t?.capacity ?? 4)); setShowForm(true); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const r = await fetch(editTable ? `/api/tables/${editTable.id}` : '/api/tables', {
      method: editTable ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), capacity: parseInt(capacity) }),
      credentials: 'include',
    });
    const json = await r.json() as { error?: string };
    if (json.error) showToast(json.error, 'err');
    else { showToast(editTable ? 'Table updated' : `${name} added`); void loadTables(); }
    setSaving(false); setShowForm(false);
  };

  const handleDelete = async (t: Table) => {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    const r = await fetch(`/api/tables/${t.id}`, { method: 'DELETE', credentials: 'include' });
    const json = await r.json() as { error?: string };
    if (json.error) showToast(json.error, 'err');
    else { showToast(`${t.name} deleted`); void loadTables(); }
  };

  const printSingle = (t: Table) => { setPrintAll(false); setPrintTable(t); setTimeout(() => window.print(), 500); };
  const printAllQR  = ()         => { setPrintAll(true);  setPrintTable(null); setTimeout(() => window.print(), 600); };
  const orderUrl    = (t: Table) => `${APP_URL}/order?tenant=${tenantSlug}&t=${t.qr_token}`;

  const downloadQR = async (t: Table) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(orderUrl(t))}&color=000000&bgcolor=ffffff&qzone=3`;
    try {
      const res = await fetch(qrUrl); const blob = await res.blob();
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `QR-${t.name.replace(/\s+/g, '-')}.png`; a.click(); URL.revokeObjectURL(url);
    } catch { alert('Download failed — right-click the QR image and save manually.'); }
  };

  return (
    <div style={{ color: 'var(--text)' }} ref={printRef}>

      {/* Single print template */}
      {!printAll && printTable && (
        <div className="print-only" style={{ display: 'none' }}>
          <style>{`@media print { body * { visibility: hidden } .print-only { visibility: visible !important; display: block !important; } .print-only * { visibility: visible } .print-only { position: fixed; top: 0; left: 0; width: 100%; } }`}</style>
          <div style={{ textAlign: 'center', padding: '48px 40px', fontFamily: 'Georgia, serif' }}>
            <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>{tenantName}</div>
            {tenantAddress && <div style={{ fontSize: 13, color: '#666', marginBottom: 32 }}>{tenantAddress}</div>}
            <div style={{ fontSize: 52, fontWeight: 900, marginBottom: 6, fontFamily: 'sans-serif' }}>{printTable.name}</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 32 }}>Seats up to {printTable.capacity} guests</div>
            <div style={{ margin: '0 auto 24px', display: 'inline-block', padding: 12, border: '2px solid #000', borderRadius: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(orderUrl(printTable))}&color=000000&bgcolor=ffffff&qzone=3`} alt="QR" width={280} height={280} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, fontFamily: 'sans-serif' }}>📱 Scan to Order</div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>Scan the QR code to view the menu and place your order</div>
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 40 }}>Powered by TYG POS · tyg-services.com</div>
          </div>
        </div>
      )}

      {/* Bulk print template */}
      {printAll && (
        <div className="print-only" style={{ display: 'none' }}>
          <style>{`@media print { body * { visibility: hidden } .print-only { visibility: visible !important; display: block !important; } .print-only * { visibility: visible } .print-only { position: fixed; top: 0; left: 0; width: 100%; } .qr-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; padding: 24px; } .qr-card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; text-align: center; break-inside: avoid; } @page { margin: 10mm; } }`}</style>
          <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{tenantName} — QR Code Sheet</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Print and place on each table</div>
            </div>
            <div className="qr-grid">
              {tables.map(t => (
                <div key={t.id} className="qr-card">
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>{t.capacity} seats</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(orderUrl(t))}&color=000000&bgcolor=ffffff&qzone=2`} alt={t.name} width={160} height={160} style={{ borderRadius: 8, margin: '0 auto', display: 'block' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 8 }}>📱 Scan to Order</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: 10, color: '#ccc', marginTop: 16 }}>Powered by TYG POS · tyg-services.com</div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', background: toast.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type === 'ok' ? '#22c55e' : '#ef4444', backdropFilter: 'blur(8px)' }}>
          {toast.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18 }}>Tables & QR Codes</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{tables.length} tables · Click QR to print individual table tent</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tables.length > 0 && (
            <button onClick={printAllQR} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <Grid size={14} /> Print All
            </button>
          )}
          <button onClick={() => openForm()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white', border: 'none', cursor: 'pointer' }}>
            <Plus size={15} /> Add Table
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>Loading tables...</div>
      ) : tables.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '96px 0', color: 'var(--text-muted)' }}>
          <QrCode size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>No tables yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Add your first table to generate a QR code</p>
          <button onClick={() => openForm()} style={{ marginTop: 24, padding: '12px 24px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white', border: 'none', cursor: 'pointer' }}>Add First Table</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,280px), 1fr))', gap: 16 }}>
          {tables.map(t => {
            const tableOrder = activeOrders.find(o => o.table_id === t.id);
            const statusCfg = tableOrder ? (STATUS_COLOR[tableOrder.status] ?? null) : null;
            return (
            <div key={t.id} style={{ ...card, overflow: 'hidden', outline: tableOrder ? `2px solid ${statusCfg?.color ?? '#22c55e'}` : 'none' }}>
              {/* Active order banner */}
              {tableOrder && statusCfg && (
                <div style={{ background: statusCfg.bg, borderBottom: `1px solid ${statusCfg.color}22`, padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusCfg.color }}>{statusCfg.label}</span>
                  <span style={{ fontSize: 12, color: statusCfg.color, fontWeight: 600 }}>#{tableOrder.order_number} · ₱{Number(tableOrder.total_amount).toFixed(2)}</span>
                </div>
              )}
              <div onClick={() => printSingle(t)} title="Click to print" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'pointer', background: 'white' }}>
                <QRCodeSVG value={orderUrl(t)} size={150} />
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#999' }}><Printer size={11} /> Click to print</div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{t.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, color: 'var(--text-muted)', fontSize: 12 }}><Users size={11} /> {t.capacity} seats</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openForm(t)} style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(t)} style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={13} /></button>
                  </div>
                </div>
                <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orderUrl(t)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => printSingle(t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', cursor: 'pointer' }}><Printer size={14} /> Print</button>
                  <button onClick={() => void downloadQR(t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer' }}><Download size={14} /> Download</button>
                  <a href={orderUrl(t)} target="_blank" rel="noreferrer" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', textDecoration: 'none' }}><QrCode size={14} /> Preview Order Page</a>
                </div>
              </div>
            </div>
            );
          })}
          <button onClick={() => openForm()} style={{ borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, border: '2px dashed rgba(34,197,94,0.25)', background: 'transparent', color: 'var(--text-muted)', minHeight: 280, cursor: 'pointer' }}>
            <Plus size={28} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Add Table</span>
          </button>
        </div>
      )}

      {/* Print all footer */}
      {tables.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Print QR Sheet</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>All {tables.length} tables on one page (3-column grid)</div>
          </div>
          <button onClick={printAllQR} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white', border: 'none', cursor: 'pointer' }}>
            <Download size={14} /> Print All QR Codes
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: 400, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontWeight: 700, fontSize: 17 }}>{editTable ? 'Edit Table' : 'New Table'}</h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)', fontSize: 22, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><label style={lbl}>Table Name *</label><input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Table 1, Garden Nook, VIP Room" autoFocus /></div>
              <div><label style={lbl}>Seating Capacity</label><input style={inp} type="number" min="1" max="100" value={capacity} onChange={e => setCapacity(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={!name.trim() || saving} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, background: name.trim() ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--surface-3)', color: name.trim() ? 'white' : 'var(--text-muted)', border: 'none', cursor: name.trim() ? 'pointer' : 'default' }}>
                {saving ? 'Saving...' : editTable ? 'Save Changes' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
