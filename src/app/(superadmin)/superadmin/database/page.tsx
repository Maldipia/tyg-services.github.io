'use client';
export const dynamic = 'force-dynamic';
import React from 'react';
const tables = ['tenants','orders','staff','menu_items','menu_categories','restaurant_tables','order_items','order_events','tenant_features','trial_reminders','superadmin_audit','scheduled_jobs','plans','features'];
export default function DatabasePage() {
  return (
    <div>
      <h1 style={{fontSize:20,fontWeight:800,color:'#f8fafc',marginBottom:4}}>Database</h1>
      <p style={{fontSize:13,color:'#475569',marginBottom:24}}>Supabase project: <code style={{fontFamily:'monospace',color:'#818cf8'}}>srgimbdbyrrijlppvkrn</code> · ap-south-1</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {tables.map(t=>(
          <a key={t} href={`https://supabase.com/dashboard/project/srgimbdbyrrijlppvkrn/editor?table=${t}`} target="_blank" rel="noreferrer"
            style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,textDecoration:'none',color:'#94a3b8',fontSize:13,fontWeight:500}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',flexShrink:0}} />
            {t}
          </a>
        ))}
      </div>
      <div style={{marginTop:24,display:'flex',gap:12}}>
        <a href="https://supabase.com/dashboard/project/srgimbdbyrrijlppvkrn" target="_blank" rel="noreferrer"
          style={{padding:'10px 18px',borderRadius:9,background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.25)',color:'#818cf8',textDecoration:'none',fontSize:13,fontWeight:700}}>
          Open Supabase Dashboard →
        </a>
        <a href="https://supabase.com/dashboard/project/srgimbdbyrrijlppvkrn/sql/new" target="_blank" rel="noreferrer"
          style={{padding:'10px 18px',borderRadius:9,background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',color:'#22c55e',textDecoration:'none',fontSize:13,fontWeight:700}}>
          SQL Editor →
        </a>
      </div>
    </div>
  );
}
