'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Lock } from 'lucide-react';

interface DayData {
  sale_date: string;
  gross_sales: number;
  completed_orders: number;
  cancelled_orders: number;
}

const RANGES = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

// Mock data for preview
const MOCK_DAILY: DayData[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return {
    sale_date: d.toISOString().split('T')[0]!,
    gross_sales: Math.floor(Math.random() * 8000) + 2000,
    completed_orders: Math.floor(Math.random() * 40) + 10,
    cancelled_orders: Math.floor(Math.random() * 5),
  };
});

const MOCK_TOP = [
  { item_name: 'Iced Caramel Latte', total_qty_sold: 187, total_revenue: 22440 },
  { item_name: 'Classic Milk Tea',   total_qty_sold: 154, total_revenue: 15400 },
  { item_name: 'Garden Pasta',       total_qty_sold: 98,  total_revenue: 29400 },
  { item_name: 'Matcha Latte',       total_qty_sold: 89,  total_revenue: 13350 },
  { item_name: 'Cheese Sticks',      total_qty_sold: 76,  total_revenue: 7600  },
];

const PLAN_TIER: string = 'BUSINESS'; // In production: from session

export default function AnalyticsPage() {
  const [range, setRange] = useState('7d');
  const [data, setData] = useState<DayData[]>(MOCK_DAILY);
  const [loading, setLoading] = useState(false);

  const maxSales = Math.max(...data.map(d => d.gross_sales));
  const totalSales = data.reduce((s, d) => s + d.gross_sales, 0);
  const totalOrders = data.reduce((s, d) => s + d.completed_orders, 0);
  const avgDaily = totalSales / data.length;

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Range picker */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={range === r.value
                ? { background: '#22c55e', color: 'white' }
                : { color: 'var(--text-muted)' }
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Sales', value: `₱${totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, trend: '+12.4%', up: true },
          { label: 'Orders',      value: totalOrders,  trend: '+8.1%', up: true },
          { label: 'Avg Daily',   value: `₱${avgDaily.toFixed(0)}`, trend: '+5.2%', up: true },
          { label: 'Cancellations', value: data.reduce((s, d) => s + d.cancelled_orders, 0), trend: '-2.1%', up: false },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {card.value}
            </div>
            <div className="flex items-center gap-1 mt-2">
              {card.up
                ? <TrendingUp size={12} style={{ color: '#22c55e' }} />
                : <TrendingDown size={12} style={{ color: '#ef4444' }} />
              }
              <span style={{ fontSize: 11, color: card.up ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {card.trend} vs prev period
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Sales chart */}
      <div className="rounded-2xl p-6 mb-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>Daily Sales</h3>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-2" style={{ height: 180 }}>
          {data.map((day, i) => {
            const heightPct = maxSales > 0 ? (day.gross_sales / maxSales) * 100 : 0;
            const isToday = i === data.length - 1;
            const d = new Date(day.sale_date + 'T00:00:00');
            return (
              <div key={day.sale_date} className="flex-1 flex flex-col items-center gap-2 group relative">
                {/* Tooltip */}
                <div
                  className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-all text-center pointer-events-none z-10"
                  style={{
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    whiteSpace: 'nowrap',
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>₱{day.gross_sales.toLocaleString()}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{day.completed_orders} orders</div>
                </div>

                <div className="relative w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${heightPct}%`,
                      minHeight: 4,
                      background: isToday
                        ? 'linear-gradient(180deg, #22c55e, #16a34a)'
                        : 'rgba(34,197,94,0.25)',
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                  {d.toLocaleDateString('en-PH', { weekday: 'short' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top items */}
        <div className="rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>Top Items</h3>
          </div>
          <div className="p-4 space-y-3">
            {MOCK_TOP.map((item, i) => {
              const maxRev = MOCK_TOP[0]?.total_revenue ?? 1;
              return (
                <div key={item.item_name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: i === 0 ? 'rgba(251,191,36,0.2)' : 'var(--surface-2)',
                        color: i === 0 ? '#fbbf24' : 'var(--text-muted)',
                        fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{item.item_name}</span>
                    </div>
                    <div className="text-right">
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
                        ₱{item.total_revenue.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                        ×{item.total_qty_sold}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'var(--surface-3)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${(item.total_revenue / maxRev) * 100}%`, background: i === 0 ? '#22c55e' : 'rgba(34,197,94,0.4)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hourly Heatmap — BUSINESS+ */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>Hourly Heatmap</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
              BUSINESS+
            </span>
          </div>

          {PLAN_TIER === 'STARTER' ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--surface-2)' }}>
                <Lock size={20} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Upgrade to Business</p>
              <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>See your busiest hours by day</p>
            </div>
          ) : (
            <div className="p-4">
              {/* Mini heatmap grid */}
              <div className="flex gap-0.5">
                {Array.from({ length: 7 }, (_, day) => (
                  <div key={day} className="flex-1 space-y-0.5">
                    {Array.from({ length: 14 }, (_, hour) => {
                      const intensity = Math.random();
                      return (
                        <div
                          key={hour}
                          title={`${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]} ${hour + 8}:00`}
                          style={{
                            height: 10,
                            borderRadius: 2,
                            background: intensity > 0.7 ? '#22c55e'
                              : intensity > 0.4 ? 'rgba(34,197,94,0.4)'
                              : intensity > 0.2 ? 'rgba(34,197,94,0.15)'
                              : 'var(--surface-2)',
                          }}
                        />
                      );
                    })}
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                      {['S','M','T','W','T','F','S'][day]}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Low</span>
                {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
                  <div key={v} style={{ width: 12, height: 12, borderRadius: 2, background: `rgba(34,197,94,${v})` }} />
                ))}
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>High</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
