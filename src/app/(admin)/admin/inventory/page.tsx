'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/admin/layout/AdminShell';

interface StockItem { id: string; name: string; status: string; stock_count: number | null; low_stock_threshold: number; }
interface LogEntry {
  id: string; change_type: string; qty_before: number | null; qty_change: number; qty_after: number | null;
  notes: string | null; created_at: string;
  item: { name: string; stock_count: number | null } | null;
  staff: { display_name: string } | null;
  order: { order_number: string } | null;
}

const TYPE_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  SALE:           { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626', label: '🛒 Sale' },
  RESTOCK:        { bg: 'rgba(34,197,94,0.1)',    color: '#16a34a', label: '📦 Restock' },
  ADJUSTMENT:     { bg: 'rgba(99,102,241,0.1)',   color: '#6366f1', label: '✏️ Adjustment' },
  WASTE:          { bg: 'rgba(245,158,11,0.1)',   color: '#d97706', label: '🗑️ Waste' },
  CANCEL_RESTORE: { bg: 'rgba(16,185,129,0.1)',   color: '#059669', label: '↩️ Restored' },
  AUTO_SOLDOUT:   { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', label: '⛔ Auto Sold-Out' },
};

const inp = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box' as const };
const lbl = { display:'block', fontSize:12, fontWeight:600 as const, color:'var(--text-muted)', marginBottom:6, letterSpacing:'0.04em', textTransform:'uppercase' as const };

export default function InventoryPage() {
  const [items, setItems]           = useState<StockItem[]>([]);
  const [log, setLog]               = useState<LogEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [selectedItem, setSelectedItem] = useState('');
  const [changeType, setChangeType] = useState<'RESTOCK'|'ADJUSTMENT'|'WASTE'>('RESTOCK');
  const [qty, setQty]               = useState('');
  const [adjNotes, setAdjNotes]     = useState('');
  const [saving, setSaving]         = useState(false);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    try {
      const [stockRes, logRes] = await Promise.all([
        fetch('/api/menu/stock', { credentials: 'include' }),
        fetch('/api/inventory-log?limit=80', { credentials: 'include' }),
      ]);
      const sd = await stockRes.json() as { data?: { outOfStock: StockItem[]; lowStock: StockItem[]; inStock: StockItem[] } };
      const ld = await logRes.json() as { data?: LogEntry[] };
      const all = [
        ...(sd.data?.outOfStock ?? []),
        ...(sd.data?.lowStock ?? []),
        ...(sd.data?.inStock ?? []),
      ];
      setItems(all);
      setLog(ld.data ?? []);
    } catch {/**/ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const adjust = async () => {
    if (!selectedItem || !qty) return;
    setSaving(true);
    try {
      const change = changeType === 'RESTOCK' ? parseInt(qty) : -Math.abs(parseInt(qty));
      const r = await fetch('/api/inventory-log', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId: selectedItem, changeType, qtyChange: change, notes: adjNotes || undefined }),
      });
      const d = await r.json() as { error?: string; data?: { newStock: number } };
      if (d.error) { showToast(d.error, false); return; }
      showToast(`Stock updated → ${d.data?.newStock ?? '?'} remaining ✅`);
      setShowAdjust(false); setQty(''); setAdjNotes(''); void load();
    } finally { setSaving(false); }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-PH', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
  const peso = (n: number | null) => n == null ? '∞' : String(n);

  const outOfStock = items.filter(i => i.stock_count === 0);
  const lowStock   = items.filter(i => i.stock_count !== null && i.stock_count > 0 && i.stock_count <= (i.low_stock_threshold ?? 5));
  const inStock    = items.filter(i => i.stock_count !== null && i.stock_count > (i.low_stock_threshold ?? 5));

  return (
    <AdminShell>
      <style>{`*{box-sizing:border-box}`}</style>
      {toast && <div style={{ position:'fixed', top:80, right:24, background: toast.ok ? '#16a34a' : '#dc2626', color:'#fff', padding:'12px 20px', borderRadius:12, fontWeight:600, fontSize:14, zIndex:9999 }}>{toast.msg}</div>}

      <div style={{ padding:24, maxWidth:960, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)', margin:0 }}>📦 Inventory</h1>
            <p style={{ color:'var(--text-muted)', fontSize:13, margin:'4px 0 0' }}>Stock levels and adjustment history</p>
          </div>
          <button onClick={() => setShowAdjust(true)} style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', padding:'10px 20px', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            + Adjust Stock
          </button>
        </div>

        {loading ? <p style={{ color:'var(--text-muted)', textAlign:'center', padding:40 }}>Loading…</p> : (
          <>
            {/* Stock status cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12, marginBottom:24 }}>
              {[
                { label:'Out of Stock', count: outOfStock.length, color:'#dc2626', bg:'rgba(239,68,68,0.08)', icon:'⛔' },
                { label:'Low Stock',    count: lowStock.length,   color:'#d97706', bg:'rgba(245,158,11,0.08)', icon:'🔶' },
                { label:'In Stock',     count: inStock.length,    color:'#16a34a', bg:'rgba(34,197,94,0.08)',  icon:'✅' },
              ].map(c => (
                <div key={c.label} style={{ background: c.bg, border:`1px solid ${c.color}33`, borderRadius:14, padding:'16px 20px' }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{c.icon}</div>
                  <div style={{ fontSize:28, fontWeight:800, color: c.color }}>{c.count}</div>
                  <div style={{ fontSize:13, color: c.color, fontWeight:600 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Stock items list */}
            {items.length > 0 && (
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, marginBottom:24, overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)' }}>Tracked Items</div>
                {[...outOfStock, ...lowStock, ...inStock].map(item => (
                  <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--text)', fontSize:14 }}>{item.name}</span>
                    <span style={{ fontWeight:700, fontSize:14,
                      color: item.stock_count === 0 ? '#ef4444'
                           : item.stock_count !== null && item.stock_count <= item.low_stock_threshold ? '#f97316'
                           : '#16a34a'
                    }}>
                      {item.stock_count === 0 ? '⛔ Out of stock'
                       : item.stock_count !== null && item.stock_count <= item.low_stock_threshold ? `🔶 ${item.stock_count} left`
                       : `✅ ${item.stock_count}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Audit log */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)' }}>
                Stock History ({log.length} entries)
              </div>
              {log.length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>No stock movements yet</div>
              ) : log.map(entry => {
                const tc = TYPE_COLOR[entry.change_type] ?? { bg:'rgba(107,114,128,0.1)', color:'#6b7280', label: entry.change_type };
                return (
                  <div key={entry.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid var(--border)', flexWrap:'wrap', gap:8 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                        <span style={{ background: tc.bg, color: tc.color, padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700 }}>{tc.label}</span>
                        <span style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{entry.item?.name ?? '—'}</span>
                        {entry.order && <span style={{ fontSize:12, color:'var(--text-muted)' }}>Order #{entry.order.order_number}</span>}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                        {fmt(entry.created_at)}{entry.staff ? ` · ${entry.staff.display_name}` : ''}
                        {entry.notes ? ` · ${entry.notes}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontWeight:700, fontSize:15, color: entry.qty_change > 0 ? '#16a34a' : '#ef4444' }}>
                        {entry.qty_change > 0 ? '+' : ''}{entry.qty_change}
                      </div>
                      {entry.qty_before !== null && entry.qty_after !== null && (
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{entry.qty_before} → {entry.qty_after}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {showAdjust && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:420 }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ fontWeight:700, fontSize:16, color:'var(--text)', margin:0 }}>Adjust Stock</h3>
              <button onClick={() => setShowAdjust(false)} style={{ color:'var(--text-muted)', fontSize:22, background:'none', border:'none', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={lbl}>Item *</label>
                <select style={inp} value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                  <option value="">Select item…</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} (current: {i.stock_count ?? '∞'})</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Type *</label>
                <div style={{ display:'flex', gap:8 }}>
                  {(['RESTOCK','ADJUSTMENT','WASTE'] as const).map(t => (
                    <button key={t} onClick={() => setChangeType(t)} style={{ flex:1, padding:'8px 0', borderRadius:8, border:`1px solid ${changeType===t ? '#16a34a' : 'var(--border)'}`, background: changeType===t ? 'rgba(34,197,94,0.1)' : 'var(--surface-2)', color: changeType===t ? '#16a34a' : 'var(--text-muted)', fontWeight:600, fontSize:12, cursor:'pointer' }}>
                      {t === 'RESTOCK' ? '📦 Restock' : t === 'WASTE' ? '🗑️ Waste' : '✏️ Adjust'}
                    </button>
                  ))}
                </div>
              </div>
              <div><label style={lbl}>Quantity *</label><input type="number" min="1" style={inp} value={qty} onChange={e => setQty(e.target.value)} placeholder={changeType === 'RESTOCK' ? 'Units to add' : 'Units to remove'} /></div>
              <div><label style={lbl}>Notes</label><input style={inp} value={adjNotes} onChange={e => setAdjNotes(e.target.value)} placeholder="Reason…" /></div>
            </div>
            <div style={{ padding:'0 24px 24px', display:'flex', gap:12 }}>
              <button onClick={() => setShowAdjust(false)} style={{ flex:1, padding:12, borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-muted)', fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={adjust} disabled={!selectedItem||!qty||saving} style={{ flex:2, padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', fontWeight:700, cursor:'pointer' }}>{saving ? 'Saving…' : 'Apply Adjustment'}</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
