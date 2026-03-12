'use client';
import React from 'react';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Delete } from 'lucide-react';

const KEYPAD = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['','0','⌫'],
];

function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenantSlug] = useState(() => searchParams.get('tenant') ?? 'yani');
  const [tenantName, setTenantName] = useState('TYG POS');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'name' | 'pin'>('name');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/menu?tenant=${tenantSlug}`)
      .then(r => r.json())
      .then((d: { data?: { tenantName?: string } }) => {
        if (d?.data?.tenantName) setTenantName(d.data.tenantName);
      })
      .catch(() => null);
  }, [tenantSlug]);

  useEffect(() => {
    if (step === 'name') setTimeout(() => nameRef.current?.focus(), 100);
  }, [step]);

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const handleKeyPress = (key: string) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); setError(''); return; }
    if (pin.length >= 8) return;
    setPin(p => p + key); setError('');
  };

  const handleLogin = async () => {
    if (!displayName.trim() || pin.length < 4) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, displayName: displayName.trim(), pin }),
      });
      const data = await res.json() as { data?: { staffId: string; displayName: string; role: string; branchId: string | null; tenantId: string; tenantSlug: string; tenantName: string; tenantAddress: string | null; planTier: string; planStatus: string; }; error: string | null; };
      if (!res.ok || data.error) {
        setError(data.error ?? 'Incorrect PIN'); setPin(''); triggerShake(); setLoading(false); return;
      }
      if (data.data) {
        const d = data.data;
        localStorage.setItem('tyg_tenant', JSON.stringify({ id: d.tenantId, slug: d.tenantSlug, name: d.tenantName, address: d.tenantAddress, plan: d.planTier, trialEndsAt: d.trialEndsAt }));
        localStorage.setItem('tyg_session', JSON.stringify({ tenantId: d.tenantId, tenantSlug: d.tenantSlug, tenantName: d.tenantName, tenantAddress: d.tenantAddress, staffId: d.staffId, displayName: d.displayName, role: d.role, branchId: d.branchId }));
      }
      router.push(searchParams.get('redirect') ?? '/admin/dashboard');
    } catch {
      setError('Network error — try again'); setPin(''); triggerShake(); setLoading(false);
    }
  };

  const S = {
    page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#0c0f16', fontFamily: "'Inter',system-ui,sans-serif" } as React.CSSProperties,
    card: { width: '100%', maxWidth: 360 } as React.CSSProperties,
    logoWrap: { textAlign: 'center' as const, marginBottom: 40 },
    logo: { width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 8px 40px rgba(34,197,94,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 } as React.CSSProperties,
    title: { color: '#e8eaf0', fontWeight: 800, fontSize: 22, marginBottom: 4 },
    sub: { color: '#6b7280', fontSize: 14 },
    nameBox: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 22px', marginBottom: 16 } as React.CSSProperties,
    nameLabel: { color: '#6b7280', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 },
    nameInput: { width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#e8eaf0', fontSize: 20, fontWeight: 600, fontFamily: 'inherit' } as React.CSSProperties,
    keyRow: { display: 'flex', gap: 18 },
    keyGrid: { display: 'flex', flexDirection: 'column' as const, gap: 14, alignItems: 'center' },
    keyEmpty: { width: 76, height: 76 },
    errorText: { textAlign: 'center' as const, color: '#f87171', fontSize: 14, marginBottom: 20 },
  };

  return (
    <>
      <style>{`
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-10px)}75%{transform:translateX(10px)}}
        @keyframes pop{0%{transform:scale(0.6);opacity:0.4}60%{transform:scale(1.25)}100%{transform:scale(1);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        .tyg-shake{animation:shake 0.4s ease}
        .tyg-pop{animation:pop 0.18s ease forwards}
        .tyg-fadeup{animation:fadeUp 0.3s ease forwards}
        .tyg-key{display:flex;align-items:center;justify-content:center;width:76px;height:76px;border-radius:50%;font-size:26px;font-weight:700;cursor:pointer;background:rgba(255,255,255,0.06);color:#e8eaf0;border:1px solid rgba(255,255,255,0.09);transition:background .12s,transform .08s;user-select:none;-webkit-user-select:none}
        .tyg-key:hover{background:rgba(255,255,255,0.12)}
        .tyg-key:active{transform:scale(0.88);background:rgba(34,197,94,0.18);color:#22c55e}
        .tyg-nameinput::placeholder{color:rgba(255,255,255,0.2)}
      `}</style>

      <div style={S.page}>
        <div style={S.card} className="tyg-fadeup">
          {/* Logo */}
          <div style={S.logoWrap}>
            <div style={S.logo}>☕</div>
            <div style={S.title}>Staff Login</div>
            <div style={S.sub}>{tenantName}</div>
          </div>

          {step === 'name' && (
            <div>
              <div style={S.nameBox}>
                <div style={S.nameLabel}>Your Name</div>
                <input
                  ref={nameRef}
                  className="tyg-nameinput"
                  style={S.nameInput}
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && displayName.trim() && setStep('pin')}
                  placeholder="Enter your display name"
                />
              </div>
              <button
                onClick={() => displayName.trim() && setStep('pin')}
                disabled={!displayName.trim()}
                style={{
                  width: '100%', padding: '16px', borderRadius: 16, border: 'none',
                  fontSize: 16, fontWeight: 700, cursor: displayName.trim() ? 'pointer' : 'not-allowed',
                  background: displayName.trim() ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.05)',
                  color: displayName.trim() ? 'white' : '#4b5563',
                  transition: 'background 0.2s',
                }}
              >
                Continue →
              </button>
            </div>
          )}

          {step === 'pin' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <button
                  onClick={() => { setStep('name'); setPin(''); setError(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontSize: 14, marginBottom: 6, display: 'block', margin: '0 auto 6px' }}
                >
                  ← {displayName}
                </button>
                <div style={{ color: '#9ca3af', fontSize: 15 }}>Enter your PIN</div>
              </div>

              {/* PIN dots */}
              <div className={shake ? 'tyg-shake' : ''} style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
                {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
                  <div
                    key={i}
                    className={pin.length === i + 1 ? 'tyg-pop' : ''}
                    style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: pin.length > i ? (error ? '#ef4444' : '#22c55e') : 'rgba(255,255,255,0.12)',
                      transition: 'background 0.15s',
                    }}
                  />
                ))}
              </div>

              {error && <div style={S.errorText}>{error}</div>}

              {/* Keypad */}
              <div style={S.keyGrid}>
                {KEYPAD.map((row, ri) => (
                  <div key={ri} style={S.keyRow}>
                    {row.map((key, ki) =>
                      key === '' ? (
                        <div key={ki} style={S.keyEmpty} />
                      ) : key === '⌫' ? (
                        <button key={ki} className="tyg-key" onClick={() => handleKeyPress('⌫')}>
                          <Delete size={22} />
                        </button>
                      ) : (
                        <button key={ki} className="tyg-key" onClick={() => handleKeyPress(key)}>
                          {key}
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>

              {pin.length >= 4 && (
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '16px', borderRadius: 16, border: 'none',
                    fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                    color: loading ? '#6b7280' : 'white', marginTop: 24,
                  }}
                >
                  {loading ? 'Verifying…' : 'Sign In'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0c0f16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(34,197,94,0.2)', borderTopColor: '#22c55e', animation: 'sp 0.8s linear infinite' }} />
      </div>
    }>
      <StaffLoginForm />
    </Suspense>
  );
}
