'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChefHat, Delete } from 'lucide-react';

const KEYPAD = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['','0','⌫'],
];

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'white', opacity: 0.5 }}>Loading...</div></div>}>
      <StaffLoginForm />
    </Suspense>
  );
}

function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenantSlug] = useState(() => searchParams.get('tenant') ?? 'yani');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'name' | 'pin'>('name');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'name') nameRef.current?.focus();
  }, [step]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleKeyPress = (key: string) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      setError('');
      return;
    }
    if (pin.length >= 8) return;
    const newPin = pin + key;
    setPin(newPin);
    setError('');

    // Auto-submit at 4+ digits after short delay
    if (newPin.length >= 4) {
      // Wait a moment to allow backspace correction
    }
  };

  const handleLogin = async () => {
    if (!displayName.trim() || pin.length < 4) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, displayName: displayName.trim(), pin }),
      });
      const data = await res.json() as {
        data?: {
          staffId: string; displayName: string; role: string; branchId: string | null;
          tenantId: string; tenantSlug: string; tenantName: string; tenantAddress: string | null;
          planTier: string; planStatus: string;
        };
        error: string | null;
      };

      if (!res.ok || data.error) {
        setError(data.error ?? 'Invalid credentials');
        setPin('');
        triggerShake();
        setLoading(false);
        return;
      }

      // Save tenant & session info to localStorage for admin pages
      if (data.data) {
        const d = data.data;
        localStorage.setItem('tyg_tenant', JSON.stringify({
          id: d.tenantId,
          slug: d.tenantSlug,
          name: d.tenantName,
          address: d.tenantAddress,
          plan: d.planTier,
        }));
        localStorage.setItem('tyg_session', JSON.stringify({
          tenantId: d.tenantId,
          tenantSlug: d.tenantSlug,
          tenantName: d.tenantName,
          tenantAddress: d.tenantAddress,
          staffId: d.staffId,
          displayName: d.displayName,
          role: d.role,
          branchId: d.branchId,
        }));
      }

      const redirect = searchParams.get('redirect') ?? '/admin/dashboard';
      router.push(redirect);
    } catch {
      setError('Network error — please try again');
      setPin('');
      triggerShake();
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: '#0f1117',
        fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        @keyframes shake {
          0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 60%{transform:translateX(8px)}
        }
        .shake { animation: shake 0.4s ease; }
        @keyframes dot-pop {
          0%{transform:scale(0.5);opacity:0.5} 50%{transform:scale(1.3)} 100%{transform:scale(1);opacity:1}
        }
        .dot-filled { animation: dot-pop 0.15s ease; }
        .key-btn {
          display: flex; align-items: center; justify-content: center;
          width: 72px; height: 72px; border-radius: 50%; font-size: 24px; font-weight: 700;
          background: rgba(255,255,255,0.05); color: #e8eaf0; border: 1px solid rgba(255,255,255,0.08);
          cursor: pointer; transition: all 0.1s; user-select: none;
        }
        .key-btn:hover { background: rgba(255,255,255,0.1); }
        .key-btn:active { transform: scale(0.92); background: rgba(34,197,94,0.15); color: #22c55e; }
        .key-btn-empty { background: transparent; border: none; cursor: default; pointer-events: none; }
      `}</style>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 8px 32px rgba(34,197,94,0.3)' }}
          >
            <ChefHat size={28} color="white" />
          </div>
          <h1 style={{ color: '#e8eaf0', fontWeight: 800, fontSize: 22 }}>Staff Login</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>YANI Garden Café</p>
        </div>

        {/* Step 1: Name */}
        {step === 'name' && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Your Name
              </label>
              <input
                ref={nameRef}
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && displayName.trim() && setStep('pin')}
                placeholder="Enter your display name"
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  color: '#e8eaf0', fontSize: 18, fontWeight: 600, outline: 'none',
                  padding: 0,
                }}
              />
            </div>
            <button
              onClick={() => displayName.trim() && setStep('pin')}
              disabled={!displayName.trim()}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all"
              style={{
                background: displayName.trim() ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.05)',
                color: displayName.trim() ? 'white' : '#6b7280',
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: PIN */}
        {step === 'pin' && (
          <div>
            <div className="text-center mb-6">
              <button
                onClick={() => { setStep('name'); setPin(''); setError(''); }}
                style={{ color: '#22c55e', fontSize: 13, marginBottom: 8 }}
              >
                ← {displayName}
              </button>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>Enter your PIN</p>
            </div>

            {/* PIN dots */}
            <div className={`flex justify-center gap-4 mb-8 ${shake ? 'shake' : ''}`}>
              {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
                <div
                  key={i}
                  className={pin.length > i ? 'dot-filled' : ''}
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: pin.length > i
                      ? (error ? '#ef4444' : '#22c55e')
                      : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.2s',
                  }}
                />
              ))}
            </div>

            {error && (
              <div className="text-center mb-4">
                <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>
              </div>
            )}

            {/* Keypad */}
            <div className="space-y-3">
              {KEYPAD.map((row, ri) => (
                <div key={ri} className="flex justify-center gap-4">
                  {row.map((key, ki) => (
                    key === '' ? (
                      <div key={ki} className="key-btn key-btn-empty" />
                    ) : key === '⌫' ? (
                      <button
                        key={ki}
                        className="key-btn"
                        onClick={() => handleKeyPress('⌫')}
                      >
                        <Delete size={22} />
                      </button>
                    ) : (
                      <button
                        key={ki}
                        className="key-btn"
                        onClick={() => handleKeyPress(key)}
                      >
                        {key}
                      </button>
                    )
                  ))}
                </div>
              ))}
            </div>

            {/* Login button (shows when PIN is 4+ digits) */}
            {pin.length >= 4 && (
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-base mt-6 transition-all"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}
              >
                {loading ? 'Verifying...' : 'Sign In'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
