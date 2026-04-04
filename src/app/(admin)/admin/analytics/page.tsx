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
interface TopItem { itemName: string; totalQty: number; totalRevenue: number; }
interface Totals {
  completedOrders: number; cancelledOrders: number;
  grossSales: number; netSales: number; totalVat: number;
}

const RANGE_LABELS: Record<Range, string> = { '1d':'Today', '7d':'7 Days', '30d':'30 Days', '90d':'90 Days' };
interface StaffPerfItem { staffId:string; displayName:string; role:string; ordersCompleted:number; totalRevenue:number; paymentsVerified:number; }
interface HourlyCell { day_of_week: number; hour_of_day: number; order_count: number; total_revenue: number; }
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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
  const [hourly, setHourly]           = useState<HourlyCell[]>([]);
  const [staffPerf, setStaffPerf]     = useState<StaffPerfItem[]>([]);
  const [cancelReasons, setCancelReasons] = useState<Array<{reason:string;count:number}>>([]);
  const [activeTab, setActiveTab]     = useState<'overview'|'staff'|'cancels'>('overview');

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
        setHourly((data as Record<string,unknown>)['heatmap'] as HourlyCell[] ?? []);
      }
      // Parallel: staff performance + cancellations
      const [spRes, crRes] = await Promise.all([
        fetch('/api/analytics/staff-performance?tenantSlug=' + slug + '&range=' + r, { credentials:'include' }),
        fetch('/api/orders?tenantSlug=' + slug + '&status=CANCELLED&limit=200', { credentials:'include' }),
      ]);
      if (spRes.ok) {
        const sp = (await spRes.json()) as { data?: { staff: StaffPerfItem[] } };
        setStaffPerf(sp.data?.staff ?? []);
      }
      if (crRes.ok) {
        const cr = (await crRes.json()) as { data?: Array<{ cancel_reason?: string }> };
        const counts: Record<string, number> = {};
        for (const o of (cr.data ?? [])) {
          const key = o.cancel_reason ?? 'No reason given';
          counts[key] = (counts[key] ?? 0) + 1;
        }
        setCancelReasons(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })));
      }
    } catch{/**/} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tenantSlug) void load(tenantSlug, range); }, [tenantSlug, range, load]);

  const maxRevenue = Math.max(...daily.map(d => Number(d.gross_sales)), 1);
  const maxBar = Math.max(...topItems.map(i => Number(i.totalRevenue)), 1);

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

      {/* Tab selector */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {['overview','staff','cancels'].map(tab => {
          const labels: Record<string, string> = { overview:'📊 Overview', staff:'👥 Staff', cancels:'❌ Cancels' };
          return (
            <button key={tab}
              onClick={() => setActiveTab(tab as 'overview'|'staff'|'cancels')}
              style={{ padding:'6px 16px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer',
                background: activeTab===tab ? '#16a34a' : 'var(--surface)',
                color: activeTab===tab ? '#fff' : 'var(--text-muted)',
                fontWeight:600, fontSize:13, fontFamily:'inherit' }}>
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Staff performance panel */}
      {!loading && activeTab === 'staff' && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)' }}>
            👥 Staff Performance — {range}
          </div>
          {staffPerf.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>No staff activity data for this period</div>
          ) : staffPerf.map(s => (
            <div key={s.staffId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight:600, color:'var(--text)', fontSize:14 }}>
                  {s.displayName} <span style={{ color:'var(--text-muted)', fontSize:12, fontWeight:400 }}>· {s.role}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{s.paymentsVerified} payments verified</div>
              </div>
              <div style={{ textAlign:'right' as const }}>
                <div style={{ fontWeight:700, color:'#16a34a', fontSize:15 }}>{s.ordersCompleted} orders</div>
                {s.totalRevenue > 0 && <div style={{ fontSize:12, color:'var(--text-muted)' }}>₱{Math.round(s.totalRevenue).toLocaleString('en-PH')}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel reasons panel */}
      {!loading && activeTab === 'cancels' && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, color:'var(--text)' }}>
            ❌ Cancellation Reasons — {range}
          </div>
          {cancelReasons.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>No cancellations in this period</div>
          ) : cancelReasons.map(({ reason, count }) => (
            <div key={reason} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
              <span style={{ color:'var(--text)', fontSize:14 }}>{reason}</span>
              <span style={{ fontWeight:700, color:'#ef4444', fontSize:14 }}>{count}×</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ padding:60, textAlign:'center', color:'var(--text-muted)' }}>Loading analytics…</div>
      ) : activeTab !== 'overview' ? null : (
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
                      <span style={{ fontSize:13, fontWeight:600 }}>{item.itemName}</span>
                    </div>
                    <div style={{ textAlign:'right' as const }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>{fmt(Number(item.totalRevenue))}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{item.totalQty} sold</div>
                    </div>
                  </div>
                  <div style={{ height:4, background:'var(--surface-3)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:99, background:'linear-gradient(90deg,#22c55e,#16a34a)',
                      width:`${(Number(item.totalRevenue)/maxBar)*100}%`, transition:'width 0.5s ease' }}/>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Hourly Heatmap */}
          {hourly.length > 0 && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:20, marginTop:14 }}>
              <h3 style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Busiest Hours</h3>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:14 }}>Order volume by day & hour (darker = busier)</p>
              {/* Hour axis labels */}
              <div style={{ display:'grid', gridTemplateColumns:'36px repeat(24,1fr)', gap:2, marginBottom:2 }}>
                <div/>
                {Array.from({length:24},(_,h)=>(
                  <div key={h} style={{ fontSize:9, color:'var(--text-muted)', textAlign:'center' as const }}>
                    {h===0?'12a':h<12?`${h}a`:h===12?'12p':`${h-12}p`}
                  </div>
                ))}
              </div>
              {DAYS.map((day, d) => {
                const maxCount = Math.max(...hourly.map(h=>h.order_count), 1);
                return (
                  <div key={d} style={{ display:'grid', gridTemplateColumns:'36px repeat(24,1fr)', gap:2, marginBottom:2 }}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', display:'flex', alignItems:'center' }}>{day}</div>
                    {Array.from({length:24},(_,h)=>{
                      const cell = hourly.find(x=>x.day_of_week===d && x.hour_of_day===h);
                      const intensity = cell ? cell.order_count / maxCount : 0;
                      const bg = intensity === 0 ? 'var(--surface-2)' :
                        intensity < 0.25 ? 'rgba(34,197,94,0.2)' :
                        intensity < 0.5  ? 'rgba(34,197,94,0.45)' :
                        intensity < 0.75 ? 'rgba(34,197,94,0.7)' : '#16a34a';
                      return (
                        <div key={h} title={cell ? `${cell.order_count} orders` : ''}
                          style={{ height:18, borderRadius:3, background:bg, cursor:cell?'default':'auto' }}/>
                      );
                    })}
                  </div>
                );
              })}
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, fontSize:11, color:'var(--text-muted)' }}>
                <span>Low</span>
                {['rgba(34,197,94,0.2)','rgba(34,197,94,0.45)','rgba(34,197,94,0.7)','#16a34a'].map((bg,i)=>(
                  <div key={i} style={{ width:14, height:14, borderRadius:3, background:bg }}/>
                ))}
                <span>High</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
