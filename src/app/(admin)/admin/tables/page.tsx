'use client';
import React from 'react';

import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { QrCode, Printer, Plus, Pencil, Trash2, Check, AlertCircle, Users, Download, Grid } from 'lucide-react';

interface Table {
  id: string;
  name: string;
  capacity: number;
  qr_token: string;
  is_active: boolean;
}

interface SessionData {
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  tenantAddress?: string | undefined;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none',
};
const labelStyle: CSSProperties = {
  display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
  marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase',
};

const APP_URL = 'https://www.tyg-services.com';

function QRCodeSVG({ value, size = 160 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const encoded = encodeURIComponent(value);
    setSrc(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&color=000000&bgcolor=ffffff&qzone=2`);
  }, [value, size]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="QR Code" width={size} height={size} className="rounded-xl" />
  ) : (
    <div className="flex items-center justify-center rounded-xl" style={{ width: size, height: size, background: '#fff' }}>
      <QrCode size={40} style={{ color: '#ccc' }} />
    </div>
  );
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [printTable, setPrintTable] = useState<Table | null>(null);
  const [printAll, setPrintAll] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<SessionData>({ tenantSlug: 'yani', tenantName: 'Your Café' });
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('tyg_session');
    if (stored) {
      try { setSession(s => ({ ...s, ...JSON.parse(stored) as SessionData })); } catch { /* */ }
    }
    const tenant = localStorage.getItem('tyg_tenant');
    if (tenant) {
      try {
        const t = JSON.parse(tenant) as { name?: string; slug?: string; address?: string };
        setSession(s => ({
          ...s,
          tenantName: (s.tenantName === "Your Café" ? (t.name ?? s.tenantName) : s.tenantName) as string,
          tenantSlug: (s.tenantSlug ?? t.slug) as string,
          tenantAddress: (s.tenantAddress ?? t.address) as string | undefined,
        }));
      } catch { /* */ }
    }
  }, []);

  const tenantSlug = session.tenantSlug ?? 'yani';
  const tenantName = session.tenantName ?? 'Your Café';
  const tenantAddress = session.tenantAddress ?? '';

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTables = async () => {
    const r = await fetch(`/api/tables?tenant=${tenantSlug}`);
    const json = await r.json() as { data?: Table[] };
    setTables(json.data ?? []);
    setLoading(false);
  };

  useEffect(() => { void loadTables(); }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const openForm = (t?: Table) => {
    setEditTable(t ?? null);
    setName(t?.name ?? '');
    setCapacity(String(t?.capacity ?? 4));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const url = editTable ? `/api/tables/${editTable.id}` : '/api/tables';
    const method = editTable ? 'PATCH' : 'POST';
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), capacity: parseInt(capacity) }),
      credentials: 'include',
    });
    const json = await r.json() as { error?: string };
    if (json.error) showToast(json.error, 'err');
    else { showToast(editTable ? 'Table updated' : `${name} added`); void loadTables(); }
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (t: Table) => {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    const r = await fetch(`/api/tables/${t.id}`, { method: 'DELETE', credentials: 'include' });
    const json = await r.json() as { error?: string };
    if (json.error) showToast(json.error, 'err');
    else { showToast(`${t.name} deleted`); void loadTables(); }
  };

  const printSingle = (t: Table) => {
    setPrintAll(false);
    setPrintTable(t);
    setTimeout(() => window.print(), 500);
  };

  const printAllQR = () => {
    setPrintAll(true);
    setPrintTable(null);
    setTimeout(() => window.print(), 600);
  };

  const orderUrl = (t: Table) => `${APP_URL}/order?tenant=${tenantSlug}&table=${t.id}`;
  const trackUrl = (t: Table) => `${APP_URL}/orders/track?tenant=${tenantSlug}`;

  const downloadQR = async (t: Table) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(orderUrl(t))}&color=000000&bgcolor=ffffff&qzone=3`;
    try {
      const res  = await fetch(qrUrl);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `QR-${t.name.replace(/\s+/g, '-')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Download failed — right-click the QR image and save manually.');
    }
  };

  return (
    <div style={{ color: 'var(--text)' }} ref={printRef}>

      {/* Single-table print template */}
      {!printAll && printTable && (
        <div className="print-only" style={{ display: 'none' }}>
          <style>{`@media print { body * { visibility: hidden } .print-only { visibility: visible !important; display: block !important; } .print-only * { visibility: visible } .print-only { position: fixed; top: 0; left: 0; width: 100%; } }`}</style>
          <div style={{ textAlign: 'center', padding: '48px 40px', fontFamily: 'Georgia, serif' }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 4 }}>{tenantName}</div>
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
          <style>{`@media print { body * { visibility: hidden } .print-only { visibility: visible !important; display: block !important; } .print-only * { visibility: visible } .print-only { position: fixed; top: 0; left: 0; width: 100%; } .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 24px; } .qr-card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; text-align: center; break-inside: avoid; } @page { margin: 10mm; } }`}</style>
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
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl" style={{ background: toast.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type === 'ok' ? '#22c55e' : '#ef4444', backdropFilter: 'blur(8px)' }}>
          {toast.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18 }}>Tables & QR Codes</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{tables.length} tables · Click QR to print individual table tent</p>
        </div>
        <div className="flex gap-2">
          {tables.length > 0 && (
            <button onClick={printAllQR} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <Grid size={14} /> Print All
            </button>
          )}
          <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}>
            <Plus size={15} /> Add Table
          </button>
        </div>
      </div>

      {/* Table Grid */}
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>Loading tables...</div>
      ) : tables.length === 0 ? (
        <div className="text-center py-24" style={{ color: 'var(--text-muted)' }}>
          <QrCode size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>No tables yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Add your first table to generate a QR code</p>
          <button onClick={() => openForm()} className="mt-6 px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white' }}>
            Add First Table
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map(t => (
            <div key={t.id} className="rounded-2xl overflow-hidden" style={cardStyle}>
              <div className="flex flex-col items-center justify-center p-6 cursor-pointer transition-opacity hover:opacity-80" style={{ background: 'white' }} onClick={() => printSingle(t)} title="Click to print">
                <QRCodeSVG value={orderUrl(t)} size={150} />
                <div className="mt-2 flex items-center gap-1" style={{ fontSize: 11, color: '#999' }}>
                  <Printer size={11} /> Click to print
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{t.name}</div>
                    <div className="flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      <Users size={11} /> {t.capacity} seats
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openForm(t)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(t)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="px-3 py-2 rounded-lg mb-3 truncate" style={{ background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-muted)' }}>{orderUrl(t)}</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => printSingle(t)} className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <Printer size={14} /> Print
                  </button>
                  <button onClick={() => void downloadQR(t)} className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer', flex: 1 }}>
                    <Download size={14} /> Download PNG
                  </button>
                  <a href={orderUrl(t)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    <QrCode size={14} /> Preview
                  </a>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => openForm()} className="rounded-2xl flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed transition-all hover:opacity-80" style={{ borderColor: 'rgba(34,197,94,0.2)', color: 'var(--text-muted)', minHeight: 280 }}>
            <Plus size={28} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Add Table</span>
          </button>
        </div>
      )}

      {/* Bulk print footer */}
      {tables.length > 0 && (
        <div className="mt-6 p-4 rounded-2xl flex items-center justify-between" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Print QR Sheet</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>All {tables.length} tables on one page (3-column grid)</div>
          </div>
          <button onClick={printAllQR} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}>
            <Download size={14} /> Print All QR Codes
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontWeight: 700, fontSize: 17 }}>{editTable ? 'Edit Table' : 'New Table'}</h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)', fontSize: 22 }}>×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label style={labelStyle}>Table Name *</label>
                <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Table 1, Garden Nook, VIP Room" autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Seating Capacity</label>
                <input style={inputStyle} type="number" min="1" max="100" value={capacity} onChange={e => setCapacity(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-5" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: name.trim() ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--surface-3)', color: name.trim() ? 'white' : 'var(--text-muted)' }}>
                {saving ? 'Saving...' : editTable ? 'Save Changes' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
