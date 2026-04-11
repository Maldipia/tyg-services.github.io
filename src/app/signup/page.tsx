'use client';
import React, { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, ChevronLeft, Coffee, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12, padding: '13px 16px', color: 'white', fontSize: 15, outline: 'none', fontFamily: 'inherit',
};
const lbl: React.CSSProperties = {
  display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600,
  marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase',
};
const GREEN = '#22c55e';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
}

interface Form {
  businessName: string; slug: string;
  ownerName: string; email: string; password: string; phone: string;
  address: string; ownerPin: string;
}

function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({
    businessName: '', slug: '', ownerName: '', email: '',
    password: '', phone: '', address: '', ownerPin: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ slug: string } | null>(null);

  const set = (key: keyof Form, val: string) =>
    setForm(prev => {
      const next = { ...prev, [key]: val };
      if (key === 'businessName') next.slug = slugify(val);
      return next;
    });

  const step0ok = form.businessName.trim().length >= 2 &&
    form.ownerName.trim().length >= 2 &&
    form.email.includes('@') &&
    form.password.length >= 8;

  const step1ok = form.address.trim().length >= 5 &&
    /^\d{4,8}$/.test(form.ownerPin);

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    const r = await fetch('/api/signup-and-onboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email, password: form.password,
        businessName: form.businessName, slug: form.slug,
        ownerPin: form.ownerPin, ownerName: form.ownerName,
        phone: form.phone || undefined, address: form.address,
        timezone: 'Asia/Manila',
      }),
    });
    const json = await r.json() as { data?: { slug: string }; error?: string; code?: string };
    setSubmitting(false);
    if (!r.ok || json.error) {
      if (json.code === 'SLUG_TAKEN' || json.code === 'EMAIL_TAKEN') setStep(0);
      setError(json.error ?? 'Sign-up failed. Please try again.');
      return;
    }
    setDone({ slug: json.data?.slug ?? form.slug });
  };

  // ── Success screen ───────────────────────────────────────
  if (done) return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <div style={{ position: 'absolute', width: 100, height: 100, borderRadius: '50%', opacity: 0.12, background: GREEN }} />
        <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.15)', border: `2px solid rgba(34,197,94,0.4)` }}>
          <Check size={32} style={{ color: GREEN }} />
        </div>
      </div>

      <div>
        <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 6 }}>You&apos;re all set! 🎉</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
          Your 14-day free trial has started. Welcome to TYG POS!
        </p>
      </div>

      {/* Login card */}
      <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, padding: 20, textAlign: 'left' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Your login details — save these!</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Login URL</span>
            <span style={{ color: GREEN, fontWeight: 700, fontSize: 13 }}>tyg-services.com/login/{done.slug}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Display name</span>
            <span style={{ color: 'white', fontWeight: 700 }}>Owner</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>PIN</span>
            <span style={{ color: 'white', fontWeight: 700, letterSpacing: '0.2em', fontSize: 16 }}>{form.ownerPin}</span>
          </div>
        </div>
      </div>

      <button onClick={() => router.push(`/login/${done.slug}`)}
        style={{ width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', border: 'none', background: `linear-gradient(135deg,${GREEN},#16a34a)`, color: 'white' }}>
        Go to Login →
      </button>

      <a href={`/order/${done.slug}`} target="_blank" rel="noreferrer"
        style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>
        View customer menu ↗
      </a>
    </div>
  );

  // ── Form steps ───────────────────────────────────────────
  return (
    <>
      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {['Business Info', 'Location & PIN'].map((label, i) => (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ height: 3, borderRadius: 99, background: i <= step ? GREEN : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
            <span style={{ fontSize: 11, color: i === step ? 'white' : 'rgba(255,255,255,0.3)', fontWeight: i === step ? 600 : 400 }}>{label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 14px', borderRadius: 10, marginBottom: 18, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: '#ef4444' }}>{error}</span>
        </div>
      )}

      {/* ── Step 0: Business Info ── */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <h2 style={{ color: 'white', fontSize: 21, fontWeight: 800, marginBottom: 4 }}>Tell us about your business</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>14-day free trial — no credit card needed.</p>
          </div>

          <div>
            <label style={lbl}>Business Name *</label>
            <input style={inp} value={form.businessName} autoFocus
              onChange={e => set('businessName', e.target.value)}
              placeholder="e.g. YANI Garden Cafe" />
          </div>

          <div>
            <label style={lbl}>Your Name *</label>
            <input style={inp} value={form.ownerName}
              onChange={e => set('ownerName', e.target.value)}
              placeholder="Maria Santos" />
          </div>

          <div>
            <label style={lbl}>Email *</label>
            <input style={inp} type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="you@email.com" />
          </div>

          <div>
            <label style={lbl}>Password * <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(min 8 characters)</span></label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: 48 }} type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Create a strong password" />
              <button onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={lbl}>Mobile <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input style={inp} type="tel" value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="09171234567" />
          </div>
        </div>
      )}

      {/* ── Step 1: Location & PIN ── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <h2 style={{ color: 'white', fontSize: 21, fontWeight: 800, marginBottom: 4 }}>Almost done!</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Just your address and a PIN for staff login.</p>
          </div>

          <div>
            <label style={lbl}>Business Address *</label>
            <textarea style={{ ...inp, resize: 'none', minHeight: 80 } as React.CSSProperties}
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="e.g. Brgy. Maymangga, Amadeo, Cavite"
              rows={3} />
          </div>

          <div>
            <label style={lbl}>
              Staff PIN * 
              <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (4–8 digits, used at the counter)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inp, fontSize: 22, letterSpacing: showPin ? '0.25em' : '0.1em', paddingRight: 50 }}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={8}
                autoFocus
                value={form.ownerPin}
                onChange={e => set('ownerPin', e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 1234"
              />
              <button onClick={() => setShowPin(p => !p)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.ownerPin.length > 0 && form.ownerPin.length < 4 && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 5 }}>At least 4 digits required</p>
            )}
            {/^\d{4,8}$/.test(form.ownerPin) && (
              <p style={{ fontSize: 12, color: GREEN, marginTop: 5 }}>✓ PIN looks good</p>
            )}
          </div>

          {/* Trial benefits reminder */}
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 12, padding: 14 }}>
            <p style={{ color: GREEN, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>✓ 14-day free trial includes</p>
            {['QR table ordering', 'Kitchen display (KDS)', 'Sales analytics', 'GCash & bank payment tracking', 'Staff management'].map(f => (
              <div key={f} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                <Check size={10} style={{ color: GREEN, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nav */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {step > 0 && (
          <button onClick={() => { setError(''); setStep(0); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <ChevronLeft size={14} /> Back
          </button>
        )}
        {step === 0 ? (
          <button onClick={() => { setError(''); setStep(1); }} disabled={!step0ok}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: step0ok ? 'pointer' : 'not-allowed', border: 'none', background: step0ok ? `linear-gradient(135deg,${GREEN},#16a34a)` : 'rgba(255,255,255,0.06)', color: step0ok ? 'white' : 'rgba(255,255,255,0.25)' }}>
            Continue <ChevronRight size={14} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!step1ok || submitting}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: step1ok && !submitting ? 'pointer' : 'not-allowed', border: 'none', background: step1ok && !submitting ? `linear-gradient(135deg,${GREEN},#16a34a)` : 'rgba(255,255,255,0.06)', color: step1ok && !submitting ? 'white' : 'rgba(255,255,255,0.25)' }}>
            {submitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creating your cafe...</> : <>Start Free Trial 🚀</>}
          </button>
        )}
      </div>
    </>
  );
}

export default function SignupPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0c0f16 0%, #111827 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 24px' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <Coffee size={19} color="white" />
          </div>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 19 }}>TYG POS</span>
        </a>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4px 16px 64px' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ borderRadius: 20, padding: '28px 28px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
            <Suspense fallback={<div style={{ color: 'white', textAlign: 'center', padding: 32 }}>Loading...</div>}>
              <SignupForm />
            </Suspense>
          </div>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#22c55e', textDecoration: 'none' }}>Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
