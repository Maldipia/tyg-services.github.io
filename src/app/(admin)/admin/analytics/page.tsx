'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, ShoppingBag, BarChart3, RefreshCw, ChevronUp, ChevronDown, Minus } from 'lucide-react';

type Range = '1d' | '7d' | '30d' | '90d';

interface DailySummary {
  sale_date: string;
  completed_orders: number;
  cancelled_orders: number;
  gross_sales: number;
  net_sales: number;
}
interface TopItem { item_name: string; total_qty_sold: number; total_revenue: number; }
interface Totals {
  completedOrders: number; cancelledOrders: number;
  grossSales: number; netSales: number; totalVat: number;
}

const RANGE_LABELS: Record<Range, string> = { '1d':'Today', '7d':'7 Days', '30d':'30 Days', '90d':'90 Days' };

function fmt(n: number) {
  return '₱' + Math.round(n).toLocaleString('en-PH');
}
function pct(a: number, b: number) {
  if (!b) return null;
  const p = ((a - b) / b) * 100;
  return p;
}

export default function AnalyticsPage() {
  const [range, setRange]           = useState<Range>('7d');
  const [loading, setLoading]       = useState(true);
  const [totals, setTotals]         = useState<Totals|null>(null);
  const [daily, setDaily]           = useState<DailySummary[]>([]);
  const [topItems, setTopItems]     = useState<TopItem[]>([]);
  const [tenantSlug, setTenantSlug] = useState('');
  const [today, setToday]           = useState(0); // today completed orders

  useEffect(() => {
    let slug = '';
    try { const t = JSON.parse(localStorage.getItem('tyg_tenant')||'{}') as {slug?:string}; slug = t.slug??''; } catch{/**/}
    if (!slug) try { const s = JSON.parse(localStorage.getItem('tyg_session')||'{}') as {tenantSlug?:string}; slug = s.tenantSlug??''; } catch{/**/}
    setTenantSlug(slug);
  }, []);

  const load = useCallback(async (slug: string, r: Range) => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/summary?tenantSlug=${slug}&range=${r}`, { credentials:'include' });
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json() as {
        data?: {
          totals?: Totals;
          dailySummary?: DailySummary[];
          topItems?: TopItem[];
          todayCompletedOrders?: number;
        }
      };
      const data = d.data;
      if (data) {
        setTotals(data.totals ?? null);
        setDaily(data.dailySummary ?? []);
        setTopItems(data.topItems ?? []);
        setToday(data.todayCompletedOrders ?? 0);
      }
    } catch{/**/} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tenantSlug) void load(tenantSlug, range); }, [tenantSlug, range, load]);

  const maxRevenue = Math.max(...daily.map(d => Number(d.gross_sales)), 1);
  const maxBar = Math.max(...topItems.map(i => Number(i.total_revenue)), 1);

  // Compare last half vs first half of period for trend
  const mid = Math.floor(daily.length / 2);
  const firstHalf = daily.slice(0, mid).reduce((s,d) => s + Number(d.gross_sales), 0);
  const secondHalf = daily.slice(mid).reduce((s,d) => s + Number(d.gross_sales), 0);
  const trend = pct(secondHalf, firstHalf);

  return (
    <div style={{ color:'var(--text)', maxWidth:900 }}>
      <style>{`
        .analytics-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:12px;flex-wrap:wrap}
        .analytics-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
        @media(max-width:700px){
          .analytics-kpi{grid-template-columns:repeat(2,1fr)!important}
          .analytics-header{flex-direction:column;align-items:flex-start!important}
          .analytics-range-btns{width:100%;display:flex}
          .analytics-range-btns button{flex:1}
        }
      `}</style>
      {/* Header */}
      <div className="analytics-header">
        <div>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>
            {today} orders completed today
          </p>
        </div>
        <div className="analytics-range-btns" style={{ display:'flex', gap:4, padding:4, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10 }}>
          {(['1d','7d','30d','90d'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{ padding:'6px 14px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
                background: range === r ? '#22c55e' : 'transparent',
                color: range === r ? 'white' : 'var(--text-muted)',
                fontFamily:'inherit' }}>
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <button onClick={() => void load(tenantSlug, range)}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8,
            background:'var(--surface-2)', border:'1px solid var(--border)', color:'var(--text-muted)',
            fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          <RefreshCw size={11}/> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'var(--text-muted)' }}>Loading analytics…</div>
      ) : (
        <>
          {/* KPI row */}
          <div className="analytics-kpi">
            {[
              { label:'Gross Sales', value: fmt(totals?.grossSales??0), icon:TrendingUp, color:'#22c55e', bg:'rgba(34,197,94,0.07)' },
              { label:'Net Sales', value: fmt(totals?.netSales??0), icon:TrendingUp, color:'#6366f1', bg:'rgba(99,102,241,0.07)' },
              { label:'Completed', value: String(totals?.completedOrders??0), icon:ShoppingBag, color:'#10b981', bg:'rgba(16,185,129,0.07)' },
              { label:'VAT Collected', value: fmt(totals?.totalVat??0), icon:BarChart3, color:'#f59e0b', bg:'rgba(245,158,11,0.07)' },
            ].map(c => (
              <div key={c.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <c.icon size={15} style={{ color:c.color }}/>
                </div>
                <div>
                  <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.02em', lineHeight:1.1 }}>{c.value}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{c.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:20, marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ fontWeight:700, fontSize:14 }}>Revenue — {RANGE_LABELS[range]}</h3>
              {trend !== null && (
                <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600,
                  color: trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : '#6b7280' }}>
                  {trend > 0 ? <ChevronUp size={13}/> : trend < 0 ? <ChevronDown size={13}/> : <Minus size={13}/>}
                  {Math.abs(trend).toFixed(1)}% vs prior period
                </span>
              )}
            </div>
            {daily.length === 0 ? (
              <div style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No data for this period</div>
            ) : (
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:120 }}>
                {daily.map((d, i) => {
                  const h = Math.max((Number(d.gross_sales) / maxRevenue) * 100, 2);
                  return (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                      <div style={{ width:'100%', height:`${h}%`, borderRadius:'4px 4px 0 0',
                        background: 'linear-gradient(180deg,#22c55e,#16a34a)',
                        minHeight:4, position:'relative' as const }} title={`${d.sale_date}: ${fmt(Number(d.gross_sales))}`}/>
                      {daily.length <= 14 && (
                        <div style={{ fontSize:9, color:'var(--text-dim)', whiteSpace:'nowrap' as const }}>
                          {new Date(d.sale_date + 'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Items */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:20 }}>
            <h3 style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Top Selling Items</h3>
            {topItems.length === 0 ? (
              <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13, padding:'16px 0' }}>No sales data yet</div>
            ) : (
              topItems.slice(0,8).map((item, i) => (
                <div key={i} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:18, height:18, borderRadius:99, background:'rgba(34,197,94,0.1)', color:'#22c55e',
                        fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {i+1}
                      </span>
                      <span style={{ fontSize:13, fontWeight:600 }}>{item.item_name}</span>
                    </div>
                    <div style={{ textAlign:'right' as const }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>{fmt(Number(item.total_revenue))}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{item.total_qty_sold} sold</div>
                    </div>
                  </div>
                  <div style={{ height:4, background:'var(--surface-3)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:99, background:'linear-gradient(90deg,#22c55e,#16a34a)',
                      width:`${(Number(item.total_revenue)/maxBar)*100}%`, transition:'width 0.5s ease' }}/>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
