'use client';
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Delete } from 'lucide-react';

const KEYPAD = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

function LoginForm() {
  const router  = useRouter();
  const params  = useParams();
  const searchParams = useSearchParams();
  const tenantSlug = (params.tenant as string).toLowerCase();
  const isOnboarding = searchParams.get('onboarding') === '1';

  const [step, setStep]             = useState<'name'|'pin'>('name');
  const [tenantName, setTenantName] = useState('');
  const [notFound, setNotFound]     = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin]               = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [shake, setShake]           = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Verify tenant on mount — lock to URL slug, no fallback
  useEffect(() => {
    if (!tenantSlug) { setNotFound(true); return; }
    fetch(`/api/menu?tenant=${tenantSlug}`)
      .then(r => r.json())
      .then((d: { data?: { tenantName?: string }; error?: string }) => {
        if (!d?.data) { setNotFound(true); return; }
        setTenantName(d.data.tenantName ?? tenantSlug);
      })
      .catch(() => setNotFound(true));
  }, [tenantSlug]);

  useEffect(() => {
    if (step === 'name') setTimeout(() => nameRef.current?.focus(), 100);
  }, [step]);

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const handleKeyPress = (key: string) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); setError(''); return; }
    if (pin.length >= 8) return;
    const next = pin + key;
    setPin(next); setError('');
    if (next.length >= 4) setTimeout(() => handleLogin(next), 80);
  };

  const handleLogin = async (pinVal: string) => {
    if (!displayName.trim() || pinVal.length < 4) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, displayName: displayName.trim(), pin: pinVal }),
      });
      const data = await res.json() as {
        data?: { staffId:string; displayName:string; role:string; branchId:string|null;
                  tenantId:string; tenantSlug:string; tenantName:string; tenantAddress:string|null;
                  planTier:string; planStatus:string; trialEndsAt:string|null };
        error?: string|null;
      };
      if (!res.ok || data.error) {
        setError(data.error ?? 'Invalid PIN'); setPin(''); triggerShake(); setLoading(false); return;
      }
      if (data.data) {
        const d = data.data;
        localStorage.setItem('tyg_tenant', JSON.stringify({ id:d.tenantId, slug:d.tenantSlug, name:d.tenantName, address:d.tenantAddress, plan:d.planTier, trialEndsAt:d.trialEndsAt }));
        localStorage.setItem('tyg_session', JSON.stringify({ tenantId:d.tenantId, tenantSlug:d.tenantSlug, tenantName:d.tenantName, tenantAddress:d.tenantAddress, staffId:d.staffId, displayName:d.displayName, role:d.role, branchId:d.branchId }));
      }
      router.push(isOnboarding ? '/admin/onboarding' : '/admin/dashboard');
    } catch {
      setError('Network error — try again'); setPin(''); triggerShake(); setLoading(false);
    }
  };

  const bg = '#0c0f16';
  const card: React.CSSProperties = { width: '100%', maxWidth: 360 };
  const logoBox: React.CSSProperties = { width:64, height:64, borderRadius:20, margin:'0 auto 16px', background:'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow:'0 8px 40px rgba(34,197,94,0.35)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 };

  if (notFound) return (
    <div style={{ minHeight:'100vh', background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ textAlign:'center', color:'#e8eaf0' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🏪</div>
        <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Café not found</div>
        <div style={{ color:'#6b7280', fontSize:14 }}>No café registered as <code style={{ color:'#22c55e' }}>{tenantSlug}</code></div>
      </div>
    </div>
  );

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
        .tyg-key-row{display:flex;gap:18px;justify-content:center}
        .tyg-key-grid{display:flex;flex-direction:column;gap:14px;align-items:center}
        .tyg-input{width:100%;background:transparent;border:none;outline:none;color:#e8eaf0;font-size:20px;font-weight:600;font-family:inherit}
        .tyg-input::placeholder{color:rgba(255,255,255,0.2)}
        .tyg-field{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:18px 20px;margin-bottom:16px}
        .tyg-label{color:#6b7280;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px}
        .tyg-btn{width:100%;padding:16px;border-radius:16px;border:none;font-size:16px;font-weight:700;cursor:pointer;transition:background 0.2s}
        .tyg-btn-primary{background:linear-gradient(135deg,#22c55e,#16a34a);color:white}
        .tyg-btn-disabled{background:rgba(255,255,255,0.05);color:#4b5563;cursor:not-allowed}
        .tyg-back{background:none;border:none;cursor:pointer;color:#22c55e;font-size:14px;display:block;margin:0 auto 6px}
      `}</style>
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:bg, fontFamily:"'Inter',system-ui,sans-serif" }}>
        <div style={card} className="tyg-fadeup">
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={logoBox}>☕</div>
            <div style={{ color:'#e8eaf0', fontWeight:800, fontSize:22, marginBottom:4 }}>Staff Login</div>
            <div style={{ color:'#22c55e', fontSize:14, fontWeight:600 }}>{tenantName || '…'}</div>
          </div>

          {/* Step 1: Name */}
          {step === 'name' && (
            <div>
              <div className="tyg-field">
                <div className="tyg-label">Your Name</div>
                <input
                  ref={nameRef}
                  className="tyg-input"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && displayName.trim() && setStep('pin')}
                  placeholder="Enter your display name"
                />
              </div>
              <button
                className={`tyg-btn ${displayName.trim() ? 'tyg-btn-primary' : 'tyg-btn-disabled'}`}
                onClick={() => displayName.trim() && setStep('pin')}
                disabled={!displayName.trim()}
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: PIN */}
          {step === 'pin' && (
            <div>
              <div style={{ textAlign:'center', marginBottom:28 }}>
                <button className="tyg-back" onClick={() => { setStep('name'); setPin(''); setError(''); }}>← {displayName}</button>
                <div style={{ color:'#9ca3af', fontSize:15 }}>Enter your PIN</div>
              </div>
              <div className={shake ? 'tyg-shake' : ''} style={{ display:'flex', justifyContent:'center', gap:16, marginBottom:32 }}>
                {Array.from({ length: Math.max(4, pin.length) }, (_,i) => (
                  <div key={i} className={pin.length===i+1 ? 'tyg-pop' : ''} style={{ width:14, height:14, borderRadius:'50%', background: pin.length>i ? (error ? '#ef4444' : '#22c55e') : 'rgba(255,255,255,0.12)', transition:'background 0.15s' }} />
                ))}
              </div>
              {error && <div style={{ textAlign:'center', color:'#f87171', fontSize:14, marginBottom:20 }}>{error}</div>}
              <div className="tyg-key-grid">
                {KEYPAD.map((row,ri) => (
                  <div key={ri} className="tyg-key-row">
                    {row.map((key,ki) =>
                      key==='' ? <div key={ki} style={{ width:76, height:76 }} /> :
                      key==='⌫' ? <button key={ki} className="tyg-key" onClick={() => handleKeyPress('⌫')}><Delete size={22}/></button> :
                      <button key={ki} className="tyg-key" onClick={() => handleKeyPress(key)}>{key}</button>
                    )}
                  </div>
                ))}
              </div>
              {loading && <div style={{ textAlign:'center', color:'#6b7280', fontSize:14, marginTop:20 }}>Verifying…</div>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function TenantLoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', background:'#0c0f16', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid rgba(34,197,94,0.2)', borderTopColor:'#22c55e', animation:'sp 0.8s linear infinite' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
