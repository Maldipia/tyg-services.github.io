'use client';
export const dynamic = 'force-dynamic';
import React, { useState } from 'react';
const CRONS = [
  { name:'Trial Reminders', path:'/api/cron/trial-reminders', desc:'Day 3/10/14 emails to trial tenants', schedule:'Daily 10am PHT' },
  { name:'Health Refresh', path:'/api/cron/health-refresh', desc:'Recompute health scores for all tenants', schedule:'Every 6 hours' },
  { name:'Dead Alerts', path:'/api/cron/dead-alerts', desc:'Email Pia when tenants go dead / trials expire', schedule:'Daily midnight UTC' },
];
export default function CronPage() {
  const [results, setResults] = useState<Record<string,string>>({});
  const [running, setRunning] = useState<string|null>(null);
  const run = async (path:string, name:string) => {
    setRunning(name);
    try {
      const r = await fetch(path); const d = await r.json();
      setResults(prev => ({...prev, [name]: JSON.stringify(d, null, 2)}));
    } catch(e) { setResults(prev => ({...prev, [name]: String(e)})); }
    setRunning(null);
  };
  return (
    <div>
      <h1 style={{fontSize:20,fontWeight:800,color:'#f8fafc',marginBottom:4}}>Cron Jobs</h1>
      <p style={{fontSize:13,color:'#475569',marginBottom:24}}>Manually trigger or inspect scheduled automation</p>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {CRONS.map(c=>(
          <div key={c.name} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:'#f8fafc'}}>{c.name}</div>
                <div style={{fontSize:12,color:'#475569',marginTop:2}}>{c.desc}</div>
                <div style={{fontSize:10,color:'#334155',marginTop:4,fontFamily:'monospace'}}>{c.schedule} · {c.path}</div>
              </div>
              <button onClick={()=>run(c.path,c.name)} disabled={running===c.name}
                style={{padding:'8px 18px',borderRadius:9,border:'none',background:running===c.name?'rgba(99,102,241,0.3)':'rgba(99,102,241,0.15)',color:'#818cf8',fontWeight:700,fontSize:13,cursor:running===c.name?'wait':'pointer'}}>
                {running===c.name ? 'Running…' : '▶ Run Now'}
              </button>
            </div>
            {results[c.name] && (
              <pre style={{marginTop:12,padding:'10px 14px',background:'rgba(0,0,0,0.3)',borderRadius:8,fontSize:11,color:'#94a3b8',overflow:'auto',maxHeight:120}}>{results[c.name]}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
