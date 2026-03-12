'use client';
import React from 'react';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!secret.trim()) return;
    setLoading(true);
    setError('');

    const r = await fetch('/api/superadmin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    });
    const json = await r.json() as { ok?: boolean; error?: string };
    setLoading(false);

    if (!json.ok) {
      setError(json.error ?? 'Invalid password');
      return;
    }

    router.push('/superadmin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg,#090c14 0%,#0f1520 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 0 40px rgba(124,58,237,0.3)' }}>
            <ShieldCheck size={28} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
            TYG Super Admin
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            Internal platform management
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-5"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={14} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: 13, color: '#ef4444' }}>{error}</span>
            </div>
          )}

          <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Admin Password
          </label>
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <Lock size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Enter password"
              autoFocus
              style={{
                width: '100%', paddingLeft: 40, paddingRight: 16, paddingTop: 13, paddingBottom: 13,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: 'white', fontSize: 15, outline: 'none',
              }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={!secret.trim() || loading}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 10, fontWeight: 700,
              fontSize: 14, color: 'white', border: 'none', cursor: secret.trim() && !loading ? 'pointer' : 'not-allowed',
              background: secret.trim() && !loading
                ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Authenticating...</> : 'Access Super Admin'}
          </button>
        </div>

        <p className="text-center mt-5" style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          Restricted access. Unauthorized entry is logged.
        </p>
      </div>
    </div>
  );
}
