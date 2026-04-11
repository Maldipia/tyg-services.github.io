'use client';
import React from 'react';
import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Link2, Plus, Pencil, Trash2, Check, AlertCircle, Users, Copy, ExternalLink } from 'lucide-react';

interface Table { id: string; name: string; capacity: number; qr_token: string; is_active: boolean; }
interface SessionData { tenantSlug?: string; tenantName?: string; tenantAddress?: string; }
interface ActiveOrder { id: string; order_number: string; status: string; table_id: string | null; total_amount: number; }

const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:    { bg: 'rgba(234,179,8,0.12)',  color: '#ca8a04', label: '⏳ Pending' },
  CONFIRMED:  { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', label: '✅ Confirmed' },
  PREPARING:  { bg: 'rgba(249,115,22,0.12)', color: '#ea580c', label: '🍳 Preparing' },
  READY:      { bg: 'rgba(34,197,94,0.15)',  color: '#16a34a', label: '🔔 Ready' },
};

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };
const inp: CSSProperties  = { width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none' };
const lbl: CSSProperties  = { display: 'block', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' };
const APP_URL = 'https://www.tyg-services.com';

export default function TablesPage() {
  const [tables, setTables]     = useState<Table[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [toast, setToast]       = useState<{ msg: string; type: 'ok'|'err' } | null>(null);
  const [name, setName]         = useState('');
  const [capacity, setCapacity] = useState('4');
  const [saving, setSaving]     = useState(false);
  const [copied, setCopied]     = useState<string | null>(null);
  const [session, setSession]   = useState<SessionData>({ tenantSlug: 'yani', tenantName: 'Your Café' });
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);

  useEffect(() => {
    try { const t = JSON.parse(localStorage.getItem('tyg_tenant') || '{}') as { name?: string; slug?: string; address?: string };
      setSession(s => ({ ...s, tenantName: t.name ?? s.tenantName, tenantSlug: t.slug ?? s.tenantSlug, tenantAddress: t.address ?? s.tenantAddress }) as SessionData); } catch {/**/}
    try { const s = JSON.parse(localStorage.getItem('tyg_session') || '{}') as SessionData;
      setSession(p => ({ ...p, ...s })); } catch {/**/}
  }, []);

  const tenantSlug = session.tenantSlug ?? 'yani';

  const showToast = (msg: string, type: 'ok'|'err' = 'ok') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const loadTables = async () => {
    const r = await fetch(`/api/tables?tenant=${tenantSlug}`);
    const json = await r.json() as { data?: Table[] };
    setTables(json.data ?? []); setLoading(false);
  };
  useEffect(() => { void loadTables(); }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadActiveOrders = async () => {
    try {
      const r = await fetch(`/api/orders?tenantSlug=${tenantSlug}&status=active&limit=100`);
      if (r.ok) { const json = await r.json() as { data?: ActiveOrder[] }; setActiveOrders(json.data ?? []); }
    } catch {/**/}
  };
  useEffect(() => {
    void loadActiveOrders();
    const iv = setInterval(() => void loadActiveOrders(), 30_000);
    return () => clearInterval(iv);
  }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const orderUrl = (t: Table) =>
    `${APP_URL}/order/${tenantSlug}?table=${encodeURIComponent(t.name)}&token=${t.qr_token}`;

  const copyUrl = async (t: Table) => {
    try { await navigator.clipboard.writeText(orderUrl(t)); setCopied(t.id); setTimeout(() => setCopied(null), 2000); }
    catch { showToast('Copy failed — select the link and copy manually', 'err'); }
  };

  const openForm = (t?: Table) => {
    setEditTable(t ?? null); setName(t?.name ?? ''); setCapacity(String(t?.capacity ?? 4)); setShowForm(true);
  };

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

  return (
    <div style={{ color: 'var(--text)' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', background: toast.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.type === 'ok' ? '#22c55e' : '#ef4444', backdropFilter: 'blur(8px)' }}>
          {toast.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span style={{ fontSize: 13, fontWeight: 500 }}>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18 }}>Tables & Order Links</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {tables.length} tables — copy each link and create your own QR code using <strong>Canva</strong>, <strong>QRCode Monkey</strong>, or any QR generator
          </p>
        </div>
        <button onClick={() => openForm()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={15} /> Add Table
        </button>
      </div>

      {/* How-to hint */}
      <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20 }}>💡</span>
        <div>
          <strong style={{ color: 'var(--text)' }}>How to create your QR codes:</strong>
          <ol style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Copy the order link for a table below</li>
            <li>Go to <a href="https://www.qrcode-monkey.com" target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>qrcode-monkey.com</a> or open <strong>Canva</strong></li>
            <li>Paste the link → generate → download → print</li>
          </ol>
        </div>
      </div>

      {/* Table list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>Loading tables...</div>
      ) : tables.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
          <Link2 size={48} style={{ margin: '0 auto 16px', opacity: 0.25, display: 'block' }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>No tables yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Add a table to get its order link</p>
          <button onClick={() => openForm()} style={{ marginTop: 24, padding: '12px 24px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white', border: 'none', cursor: 'pointer' }}>
            Add First Table
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tables.map(t => {
            const tableOrder = activeOrders.find(o => o.table_id === t.id);
            const statusCfg  = tableOrder ? (STATUS_COLOR[tableOrder.status] ?? null) : null;
            const url        = orderUrl(t);
            const isCopied   = copied === t.id;

            return (
              <div key={t.id} style={{ ...card, overflow: 'hidden', outline: tableOrder ? `2px solid ${statusCfg?.color ?? '#22c55e'}` : 'none' }}>
                {/* Active order banner */}
                {tableOrder && statusCfg && (
                  <div style={{ background: statusCfg.bg, borderBottom: `1px solid ${statusCfg.color}33`, padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: statusCfg.color }}>{statusCfg.label}</span>
                    <span style={{ fontSize: 12, color: statusCfg.color, fontWeight: 600 }}>#{tableOrder.order_number} · ₱{Number(tableOrder.total_amount).toFixed(2)}</span>
                  </div>
                )}

                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  {/* Table info */}
                  <div style={{ minWidth: 120 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                      <Users size={11} /> {t.capacity} seats
                    </div>
                  </div>

                  {/* Order URL */}
                  <div style={{ flex: 1, minWidth: 200, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                    {url}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => void copyUrl(t)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: isCopied ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', color: isCopied ? '#16a34a' : '#22c55e', transition: 'all 0.2s' }}>
                      {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      {isCopied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', textDecoration: 'none' }}>
                      <ExternalLink size={13} /> Preview
                    </a>
                    <button onClick={() => openForm(t)} style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(t)} style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add button */}
          <button onClick={() => openForm()} style={{ borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '18px', border: '2px dashed rgba(34,197,94,0.25)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Plus size={18} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Add Table</span>
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
              <div>
                <label style={lbl}>Table Name *</label>
                <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Table 1, Garden Nook, VIP Room" autoFocus />
              </div>
              <div>
                <label style={lbl}>Seating Capacity</label>
                <input style={inp} type="number" min="1" max="100" value={capacity} onChange={e => setCapacity(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={!name.trim() || saving} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, background: name.trim() ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--surface-2)', color: name.trim() ? 'white' : 'var(--text-muted)', border: 'none', cursor: name.trim() ? 'pointer' : 'default' }}>
                {saving ? 'Saving...' : editTable ? 'Save Changes' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
