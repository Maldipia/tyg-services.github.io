'use client';
export const dynamic = 'force-dynamic';
import React from 'react';
const ENV = [
  {k:'SUPERADMIN_SECRET', v:'2026pia', status:'set', note:'Superadmin login password'},
  {k:'RESEND_API_KEY', v:'', status:'NOT SET', note:'Email sending — add in Vercel env vars'},
  {k:'CRON_SECRET', v:'(auto)', status:'auto', note:'Set automatically by Vercel for cron jobs'},
  {k:'NEXT_PUBLIC_SUPABASE_URL', v:'https://srgimbdbyrrijlppvkrn.supabase.co', status:'set', note:'Supabase project URL'},
];
export default function SettingsPage() {
  return (
    <div>
      <h1 style={{fontSize:20,fontWeight:800,color:'#f8fafc',marginBottom:4}}>Settings</h1>
      <p style={{fontSize:13,color:'#475569',marginBottom:24}}>Environment variables and platform config</p>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {ENV.map(e=>(
          <div key={e.k} style={{display:'flex',alignItems:'center',gap:16,padding:'14px 18px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:'monospace',fontSize:12,color:'#94a3b8',marginBottom:3}}>{e.k}</div>
              <div style={{fontSize:11,color:'#475569'}}>{e.note}</div>
            </div>
            <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,background:e.status==='set'?'rgba(34,197,94,0.1)':e.status==='auto'?'rgba(99,102,241,0.1)':'rgba(239,68,68,0.1)',color:e.status==='set'?'#22c55e':e.status==='auto'?'#818cf8':'#ef4444'}}>
              {e.status.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
      <div style={{marginTop:20}}>
        <a href="https://vercel.com/maldipias-projects/tyg-pos-saas/settings/environment-variables" target="_blank" rel="noreferrer"
          style={{display:'inline-block',padding:'10px 18px',borderRadius:9,background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.25)',color:'#818cf8',textDecoration:'none',fontSize:13,fontWeight:700}}>
          Manage Env Vars in Vercel →
        </a>
      </div>
    </div>
  );
}
