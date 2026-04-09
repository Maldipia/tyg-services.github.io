'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// /login — redirects to /login/[tenant]
// No default tenant. No fallback. Tenant must be explicit.
export default function LoginRedirectPage() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    const s = slug.trim().toLowerCase();
    if (!s) return;
    setChecking(true); setError('');
    try {
      const res = await fetch(`/api/menu?tenant=${s}`);
      const d   = await res.json() as { data?: unknown; error?: string };
      if (!res.ok || !d?.data) {
        setError(`No café found for "${s}"`); setChecking(false); return;
      }
      router.push(`/login/${s}`);
    } catch {
      setError('Network error — try again'); setChecking(false);
    }
  };

  const bg = '#0c0f16';
  return (
    <>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp 0.3s ease forwards}
        .inp{width:100%;background:transparent;border:none;outline:none;color:#e8eaf0;font-size:18px;font-weight:600;font-family:inherit}
        .inp::placeholder{color:rgba(255,255,255,0.2)}
        .btn{width:100%;padding:16px;border-radius:16px;border:none;font-size:16px;font-weight:700;cursor:pointer}
      `}</style>
      <div style={{ minHeight:'100vh', background:bg, display:'flex', alignItems:'center', justifyContent:'center', padding:16, fontFamily:"'Inter',system-ui,sans-serif" }}>
        <div className="fu" style={{ width:'100%', maxWidth:360 }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ width:64, height:64, borderRadius:20, margin:'0 auto 16px', background:'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow:'0 8px 40px rgba(34,197,94,0.35)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>☕</div>
            <div style={{ color:'#e8eaf0', fontWeight:800, fontSize:22, marginBottom:4 }}>Staff Login</div>
            <div style={{ color:'#6b7280', fontSize:14 }}>Enter your café's URL slug</div>
          </div>
          <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:'18px 20px', marginBottom:16 }}>
            <div style={{ color:'#6b7280', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12 }}>Café Slug</div>
            <input
              className="inp"
              autoFocus
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')); setError(''); }}
              onKeyDown={e => e.key==='Enter' && go()}
              placeholder="e.g. yani"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          {error && <div style={{ color:'#f87171', fontSize:13, marginBottom:12, textAlign:'center' }}>{error}</div>}
          <button
            className="btn"
            style={{ background: slug.trim() && !checking ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.05)', color: slug.trim() && !checking ? 'white' : '#4b5563', cursor: slug.trim() && !checking ? 'pointer' : 'not-allowed' }}
            onClick={go}
            disabled={!slug.trim() || checking}
          >
            {checking ? 'Finding café…' : 'Continue →'}
          </button>
          <div style={{ textAlign:'center', marginTop:24, color:'#374151', fontSize:13 }}>
            Direct URL: <code style={{ color:'#22c55e' }}>/login/your-slug</code>
          </div>
        </div>
      </div>
    </>
  );
}
