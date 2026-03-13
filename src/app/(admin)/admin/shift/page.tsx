'use client';
import React, { useState, useEffect, useCallback } from 'react';

// ============================================================
// TYG POS — /admin/shift
// End-of-Day Shift Summary for cashier cash-out
// Shows: collections by method, order counts, discounts, VAT
// ============================================================

interface ShiftStats {
  date: string;
  totalRevenue: number;
  cashCollected: number;
  gcashCollected: number;
  mayaCollected: number;
  otherCollected: number;
  completedOrders: number;
  cancelledOrders: number;
  unpaidCompleted: number;
  totalDiscounts: number;
  vatCollected: number;
  pwdOrders: number;
  seniorOrders: number;
  topItems: { name: string; qty: number; revenue: number }[];
}

export default function ShiftPage() {
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    // Philippines time offset
    d.setHours(d.getHours() + 8);
    return d.toISOString().slice(0, 10);
  });
  const [tenantSlug, setTenantSlug] = useState('');

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('tyg_tenant') ?? '{}') as { slug?: string };
      setTenantSlug(s.slug ?? '');
    } catch {/**/}
  }, []);

  const load = useCallback(async (slug: string, date: string) => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shift/summary?tenantSlug=${slug}&date=${date}`, { credentials: 'include' });
      const json = await res.json() as { data?: ShiftStats };
      if (json.data) setStats(json.data);
    } catch {/**/} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tenantSlug) void load(tenantSlug, selectedDate); }, [tenantSlug, selectedDate, load]);

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
    padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  };

  const row = (label: string, value: string, color = '#0f172a', bold = false): React.ReactNode => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 14, color: '#475569' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color }}>{value}</span>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <style>{`@media print { .no-print { display: none !important } body { background: white } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>📊 Shift Summary</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>End-of-day cash-out report</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="date" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a' }}
          />
          <button
            onClick={() => window.print()}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>Loading shift data…</div>
      ) : !stats ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p>No data found for {selectedDate}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Alert: unpaid completed orders */}
          {stats.unpaidCompleted > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <span style={{ fontWeight: 700, color: '#dc2626', fontSize: 14 }}>
                  {stats.unpaidCompleted} completed order{stats.unpaidCompleted > 1 ? 's' : ''} with no payment recorded
                </span>
                <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>Go to Orders and record payment before closing shift.</p>
              </div>
            </div>
          )}

          {/* Collections by method */}
          <div style={card}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>💰 Collections by Payment Method</h3>
            {row('💵 Cash', fmt(stats.cashCollected), '#16a34a', stats.cashCollected > 0)}
            {row('📱 GCash', fmt(stats.gcashCollected), '#6366f1', stats.gcashCollected > 0)}
            {row('📲 Maya', fmt(stats.mayaCollected), '#0ea5e9', stats.mayaCollected > 0)}
            {stats.otherCollected > 0 && row('🏦 Other', fmt(stats.otherCollected))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Total Collected</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{fmt(stats.totalRevenue)}</span>
            </div>
          </div>

          {/* Order counts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Completed', value: stats.completedOrders, color: '#16a34a', bg: '#f0fdf4', emoji: '✅' },
              { label: 'Cancelled', value: stats.cancelledOrders, color: '#dc2626', bg: '#fef2f2', emoji: '❌' },
              { label: 'Unpaid ⚠️', value: stats.unpaidCompleted, color: stats.unpaidCompleted > 0 ? '#dc2626' : '#94a3b8', bg: stats.unpaidCompleted > 0 ? '#fef2f2' : '#f8fafc', emoji: '💳' },
            ].map(c => (
              <div key={c.label} style={{ ...card, textAlign: 'center', background: c.bg, padding: '16px 12px' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{c.emoji}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Discounts & VAT */}
          <div style={card}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>🧾 Deductions & Tax</h3>
            {row('♿ PWD Discounts Applied', String(stats.pwdOrders) + ' orders')}
            {row('👴 Senior Discounts Applied', String(stats.seniorOrders) + ' orders')}
            {row('Total Discounts Given', fmt(stats.totalDiscounts), '#d97706')}
            {row('VAT (12%) Collected', fmt(stats.vatCollected), '#6366f1')}
            {row('Net Sales (after discount)', fmt(stats.totalRevenue - stats.totalDiscounts), '#16a34a', true)}
          </div>

          {/* Top sellers */}
          {stats.topItems.length > 0 && (
            <div style={card}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>🏆 Top Items Today</h3>
              {stats.topItems.slice(0, 8).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', width: 20 }}>#{i + 1}</span>
                    <span style={{ fontSize: 14, color: '#0f172a' }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>×{item.qty}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{fmt(item.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Print footer */}
          <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', paddingTop: 8 }}>
            Report generated {new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} · TYG POS
          </div>
        </div>
      )}
    </div>
  );
}
