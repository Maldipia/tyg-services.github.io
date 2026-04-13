'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginRedirectPage() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [checking, setChecking] = useState(false);
  const [autoChecking, setAutoChecking] = useState(true);
  const [error, setError] = useState('');
  const [savedName, setSavedName] = useState('');

  // On load: check if we have a remembered café → go straight there
  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('tyg_session') || '{}') as { tenantSlug?: string; tenantName?: string };
      const tenant  = JSON.parse(localStorage.getItem('tyg_tenant')  || '{}') as { slug?: string; name?: string };
      const saved = session.tenantSlug || tenant.slug || '';
      const name  = session.tenantName || tenant.name || '';
      if (saved) {
        setSavedName(name || saved);
        // Auto-redirect to saved slug
        router.replace(`/login/${saved}`);
        return;
      }
    } catch {/**/}
    setAutoChecking(false);
  }, [router]);

  const go = async () => {
    const s = slug.trim().toLowerCase();
    if (!s) return;
    setChecking(true); setError('');
    try {
      const res = await fetch(`/api/menu?tenant=${s}`);
      const d = await res.json() as { data?: { tenant?: { name?: string } }; error?: string };
      if (!res.ok || !d?.data) {
        setError(`No café found for "${s}". Check your login URL or contact your manager.`);
        setChecking(false); return;
      }
      router.push(`/login/${s}`);
    } catch {
      setError('Network error — try again'); setChecking(false);
    }
  };

  // Show a brief loading state while checking localStorage
  if (autoChecking) {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0f16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(34,197,94,0.2)', borderTopColor: '#22c55e', animation: 'sp 0.8s linear infinite', margin: '0 auto 16px' }} />
          {savedName && <div style={{ color: '#6b7280', fontSize: 14 }}>Opening {savedName}…</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp 0.25s ease forwards}
        .inp{width:100%;background:transparent;border:none;outline:none;color:#e8eaf0;font-size:17px;font-weight:600;font-family:inherit}
        .inp::placeholder{color:rgba(255,255,255,0.18)}
      `}</style>
      <div style={{ minHeight: '100vh', background: '#0c0f16', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div className="fu" style={{ width: '100%', maxWidth: 340 }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 14px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 8px 32px rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>☕</div>
            <div style={{ color: '#e8eaf0', fontWeight: 800, fontSize: 21, marginBottom: 4 }}>Staff Login</div>
            <div style={{ color: '#6b7280', fontSize: 13 }}>Enter your café login code to continue</div>
          </div>

          {/* Input */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.09)'}`, borderRadius: 14, padding: '16px 18px', marginBottom: 12, transition: 'border 0.2s' }}>
            <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Café Login Code</div>
            <input
              className="inp"
              autoFocus
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && void go()}
              placeholder="e.g. ding-spot, yani"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
            />
          </div>

          {error && (
            <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <button
            onClick={() => void go()}
            disabled={!slug.trim() || checking}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 700, cursor: slug.trim() && !checking ? 'pointer' : 'not-allowed', background: slug.trim() && !checking ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.05)', color: slug.trim() && !checking ? 'white' : '#4b5563', transition: 'all 0.15s' }}>
            {checking ? 'Checking…' : 'Continue →'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 20, color: '#374151', fontSize: 12, lineHeight: 1.6 }}>
            Your login code is the part after<br/>
            <code style={{ color: '#22c55e', fontSize: 12 }}>tyg-services.com/login/<strong>your-code</strong></code>
          </div>
        </div>
      </div>
    </>
  );
}
