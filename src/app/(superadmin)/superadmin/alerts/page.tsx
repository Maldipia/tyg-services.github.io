'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
export default function AlertsPage() {
  const [data, setData] = useState<{alerts?:string[];sent?:boolean}|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/cron/dead-alerts').then(r=>r.json()).then((d:{alerts?:string[];sent?:boolean})=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));
  }, []);
  return (
    <div>
      <h1 style={{fontSize:20,fontWeight:800,color:'#f8fafc',marginBottom:4}}>Alerts</h1>
      <p style={{fontSize:13,color:'#475569',marginBottom:24}}>Daily health alerts — runs at midnight UTC</p>
      {loading ? <div style={{color:'#475569'}}>Checking alerts…</div> : (
        <div>
          {(data?.alerts?.length ?? 0) === 0 ? (
            <div style={{background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:12,padding:'20px 24px',color:'#22c55e',fontWeight:600}}>
              ✅ All clear — no critical issues right now
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {data?.alerts?.map((a,i)=>(
                <div key={i} style={{padding:'12px 16px',borderRadius:10,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',color:'#fca5a5',fontSize:13,fontWeight:600}}>{a}</div>
              ))}
            </div>
          )}
          <div style={{marginTop:16,fontSize:11,color:'#334155'}}>Email sent to tygfsb@gmail.com daily · RESEND_API_KEY {process.env.RESEND_API_KEY ? 'set' : 'NOT set (emails skipped)'}</div>
        </div>
      )}
    </div>
  );
}
