'use client';

// /signup/confirm — Supabase calls this after email confirmation.
// Reads pending onboarding data from URL, creates the tenant, then redirects to login.

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

type State = 'loading' | 'creating' | 'done' | 'error';

function ConfirmContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<State>('loading');
  const [error, setError] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    const run = async () => {
      const sb = createBrowserClient();

      // Wait for Supabase to process the email confirmation token (it's in the URL hash)
      await new Promise(r => setTimeout(r, 1500));

      const { data: { session }, error: sessErr } = await sb.auth.getSession();
      if (sessErr || !session) {
        setError('Could not verify your email. Please try signing up again or contact support.');
        setState('error');
        return;
      }

      // Decode pending onboarding data from URL
      const pendingParam = params.get('pending');
      if (!pendingParam) {
        // No pending data — tenant may already exist, just go to login
        router.push('/login');
        return;
      }

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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(pending),
      });

      const json = await r.json() as { data?: { slug: string }; error?: string };

      if (json.error) {
        if (json.error.includes('already have') || json.error.includes('already exists')) {
          // Tenant already created (duplicate callback) — just go to login
          router.push('/login');
          return;
        }
        setError(json.error);
        setState('error');
        return;
      }

      setSlug(json.data?.slug ?? pending.slug ?? '');
      setState('done');

      // Auto-redirect after 3 seconds
      setTimeout(() => router.push('/login'), 3000);
    };

    void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'loading' || state === 'creating') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <Loader2 size={28} style={{ color: '#22c55e' }} className="animate-spin" />
        </div>
        <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          {state === 'loading' ? 'Verifying your email...' : 'Setting up your café...'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          {state === 'creating' ? 'Creating your account, menus, and tables.' : 'Just a moment.'}
        </p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={28} style={{ color: '#ef4444' }} />
        </div>
        <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Setup Failed</h2>
        <p style={{ color: 'rgba(239,68,68,0.8)', fontSize: 14, marginBottom: 20 }}>{error}</p>
        <button onClick={() => router.push('/signup')}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
          Back to Sign Up
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="relative inline-flex items-center justify-center mb-6">
        <div className="absolute w-24 h-24 rounded-full bg-green-500 opacity-10 animate-ping" />
        <div className="w-18 h-18 w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}>
          <CheckCircle size={32} style={{ color: '#22c55e' }} />
        </div>
      </div>
      <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        You&apos;re all set! 🎉
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        Your café <strong style={{ color: 'white' }}>{slug}</strong> is ready.<br />
        Redirecting to login in 3 seconds...
      </p>
      <button onClick={() => router.push('/login')}
        className="w-full py-3 rounded-xl text-sm font-bold"
        style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white' }}>
        Go to Login Now
      </button>
    </div>
  );
}

export default function SignupConfirmPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #0f1117 0%, #111827 100%)' }}>
      <div className="w-full max-w-sm rounded-3xl p-8"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <span style={{ fontSize: 16 }}>☕</span>
          </div>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>TYG POS</span>
        </div>
        <Suspense fallback={
          <div className="text-center">
            <Loader2 size={24} className="animate-spin mx-auto mb-4" style={{ color: '#22c55e' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading...</p>
          </div>
        }>
          <ConfirmContent />
        </Suspense>
      </div>
    </div>
  );
}
