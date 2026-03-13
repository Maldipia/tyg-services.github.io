'use client';
import React from 'react';

// /signup/confirm — Supabase calls this after email confirmation.
// Reads pending onboarding data from URL, creates the tenant, then redirects to login.

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

type State = 'loading' | 'creating' | 'done' | 'error';

const iconBox = (bg: string, border: string) => ({
  width:64, height:64, borderRadius:16, display:'flex' as const, alignItems:'center' as const,
  justifyContent:'center' as const, margin:'0 auto 24px', background: bg, border: `1px solid ${border}`,
});

function ConfirmContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<State>('loading');
  const [error, setError] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    const run = async () => {
      const sb = createBrowserClient();
      await new Promise(r => setTimeout(r, 1500));

      const { data: { session }, error: sessErr } = await sb.auth.getSession();
      if (sessErr || !session) {
        setError('Could not verify your email. Please try signing up again or contact support.');
        setState('error');
        return;
      }

      const pendingParam = params.get('pending');
      if (!pendingParam) { router.push('/login'); return; }

      let pending: Record<string, string>;
      try {
        pending = JSON.parse(atob(decodeURIComponent(pendingParam))) as Record<string, string>;
      } catch {
        setError('Invalid confirmation link. Please sign up again.');
        setState('error');
        return;
      }

      setState('creating');

      const r = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(pending),
      });

      const json = await r.json() as { data?: { slug: string }; error?: string };
      if (json.error) {
        if (json.error.includes('already have') || json.error.includes('already exists')) {
          router.push('/login'); return;
        }
        setError(json.error); setState('error'); return;
      }

      setSlug(json.data?.slug ?? pending.slug ?? '');
      setState('done');
      setTimeout(() => router.push('/login'), 3000);
    };
    void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'loading' || state === 'creating') {
    return (
      <div style={{ textAlign:'center' }}>
        <div style={iconBox('rgba(34,197,94,0.1)', 'rgba(34,197,94,0.2)')}>
          <Loader2 size={28} style={{ color:'#22c55e', animation:'spin 0.8s linear infinite' }} />
        </div>
        <h2 style={{ color:'white', fontSize:20, fontWeight:700, marginBottom:8 }}>
          {state === 'loading' ? 'Verifying your email...' : 'Setting up your café...'}
        </h2>
        <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>
          {state === 'creating' ? 'Creating your account, menus, and tables.' : 'Just a moment.'}
        </p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{ textAlign:'center' }}>
        <div style={iconBox('rgba(239,68,68,0.1)', 'rgba(239,68,68,0.2)')}>
          <AlertCircle size={28} style={{ color:'#ef4444' }} />
        </div>
        <h2 style={{ color:'white', fontSize:20, fontWeight:700, marginBottom:8 }}>Setup Failed</h2>
        <p style={{ color:'rgba(239,68,68,0.8)', fontSize:14, marginBottom:20 }}>{error}</p>
        <button onClick={() => router.push('/signup')}
          style={{ padding:'10px 24px', borderRadius:12, fontSize:13, fontWeight:600, cursor:'pointer', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.1)' }}>
          Back to Sign Up
        </button>
      </div>
    );
  }

  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:24 }}>
        <div style={{ position:'absolute', width:96, height:96, borderRadius:'50%', background:'#22c55e', opacity:0.1, animation:'ping 1.5s ease-out infinite' }} />
        <div style={{ width:64, height:64, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(34,197,94,0.15)', border:'2px solid rgba(34,197,94,0.4)' }}>
          <CheckCircle size={32} style={{ color:'#22c55e' }} />
        </div>
      </div>
      <h2 style={{ color:'white', fontSize:22, fontWeight:800, marginBottom:8 }}>You&apos;re all set! 🎉</h2>
      <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, marginBottom:24, lineHeight:1.6 }}>
        Your café <strong style={{ color:'white' }}>{slug}</strong> is ready.<br />
        Redirecting to login in 3 seconds...
      </p>
      <button onClick={() => router.push('/login')}
        style={{ width:'100%', padding:'12px 0', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer', border:'none', background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'white' }}>
        Go to Login Now
      </button>
    </div>
  );
}

export default function SignupConfirmPage() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'linear-gradient(135deg, #0f1117 0%, #111827 100%)' }}>
      <div style={{ width:'100%', maxWidth:384, borderRadius:24, padding:32, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:32 }}>
          <div style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <span style={{ fontSize:16 }}>☕</span>
          </div>
          <span style={{ color:'white', fontWeight:800, fontSize:18 }}>TYG POS</span>
        </div>
        <Suspense fallback={
          <div style={{ textAlign:'center' }}>
            <Loader2 size={24} style={{ color:'#22c55e', animation:'spin 0.8s linear infinite', margin:'0 auto 16px', display:'block' }} />
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>Loading...</p>
          </div>
        }>
          <ConfirmContent />
        </Suspense>
      </div>
    </div>
  );
}
