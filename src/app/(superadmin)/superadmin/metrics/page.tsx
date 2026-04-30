'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
interface M { mrr:number; arpu:number; conversion_rate:number; paying_tenants:number; trial_tenants:number; total_tenants:number; orders_this_month:number; revenue_this_month:number; health:{healthy:number;at_risk:number;dead:number}; onboarding_completion_rate:number; }
const fmt = (n:number) => '₱' + Math.round(n).toLocaleString();
export default function MetricsPage() {
  const router = useRouter();
  const [m, setM] = useState<M|null>(null);
  useEffect(() => {
    fetch('/api/superadmin/metrics').then(r => { if(r.status===401){router.push('/superadmin/login');return null;} return r.json(); }).then((d:{data?:M}|null) => { if(d?.data) setM(d.data); }).catch(()=>null);
  }, [router]);
  if(!m) return <div style={{color:'#475569',padding:60,textAlign:'center'}}>Loading metrics…</div>;
  const kpis = [
    {l:'MRR', v:fmt(m.mrr), s:'Monthly recurring', c:'#22c55e'},
    {l:'ARPU', v:fmt(m.arpu), s:'Avg per paying user', c:'#6366f1'},
    {l:'Conversion', v:`${m.conversion_rate}%`, s:`${m.paying_tenants}/${m.total_tenants} paying`, c:'#f59e0b'},
    {l:'This Month', v:fmt(m.revenue_this_month), s:`${m.orders_this_month} orders`, c:'#3b82f6'},
    {l:'Paying', v:String(m.paying_tenants), s:'active paid tenants', c:'#22c55e'},
    {l:'Trials', v:String(m.trial_tenants), s:'on free trial', c:'#f59e0b'},
    {l:'Onboarding', v:`${m.onboarding_completion_rate}%`, s:'completed setup', c:'#8b5cf6'},
    {l:'Healthy', v:String(m.health.healthy), s:'🟢 active + ordering', c:'#22c55e'},
  ];
  return (
    <div>
      <h1 style={{fontSize:20,fontWeight:800,color:'#f8fafc',marginBottom:4}}>Revenue & Metrics</h1>
      <p style={{fontSize:13,color:'#475569',marginBottom:24}}>Platform-wide SaaS metrics</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {kpis.map(k=>(
          <div key={k.l} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:'18px 20px'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>{k.l}</div>
            <div style={{fontSize:26,fontWeight:800,color:k.c,marginBottom:4}}>{k.v}</div>
            <div style={{fontSize:11,color:'#334155'}}>{k.s}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:24,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
        {[{l:'Healthy',n:m.health.healthy,c:'#22c55e',e:'🟢'},{l:'At Risk',n:m.health.at_risk,c:'#f59e0b',e:'🟡'},{l:'Dead',n:m.health.dead,c:'#ef4444',e:'🔴'}].map(h=>(
          <div key={h.l} style={{background:`${h.c}10`,border:`1px solid ${h.c}25`,borderRadius:12,padding:'16px 20px',textAlign:'center'}}>
            <div style={{fontSize:32,fontWeight:800,color:h.c}}>{h.n}</div>
            <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{h.e} {h.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
