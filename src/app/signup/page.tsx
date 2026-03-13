'use client';
import React from 'react';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check, ChevronRight, ChevronLeft, Coffee, Loader2,
  AlertCircle, Eye, EyeOff, Lock
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

const STEPS = ['Your Cafe', 'Your Account', 'Set PIN', 'Location'];

interface FormData {
  businessName: string;
  slug: string;
  category: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  ownerPin: string;
  confirmPin: string;
  address: string;
  timezone: string;
}

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12, padding: '14px 16px', color: 'white', fontSize: 15, outline: 'none',
} as const;

const labelStyle = {
  display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 as const,
  marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' as const,
};

const CATEGORIES = [
  { value: 'cafe',       label: '\u2615 Cafe / Coffee Shop' },
  { value: 'restaurant', label: '\ud83c\udf7d\ufe0f Restaurant' },
  { value: 'bar',        label: '\ud83c\udf7a Bar / Resto-Bar' },
  { value: 'bakery',     label: '\ud83e\udd50 Bakery / Pastry' },
  { value: 'fastfood',   label: '\ud83c\udf54 Fast Food / QSR' },
  { value: 'foodcourt',  label: '\ud83c\udfea Food Stall / Court' },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
}

function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    businessName: '', slug: '', category: 'cafe',
    ownerName: '', email: '', password: '', phone: '',
    ownerPin: '', confirmPin: '',
    address: '', timezone: 'Asia/Manila',
  });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ slug: string; needsConfirmation?: boolean } | null>(null);

  const set = (key: keyof FormData, value: string) =>
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'businessName') next.slug = slugify(value);
      return next;
    });

  const canNext = () => {
    if (step === 0) return form.businessName.trim().length >= 2 && /^[a-z0-9-]{3,}$/.test(form.slug);
    if (step === 1) return form.ownerName.trim().length >= 2 && form.email.includes('@') && form.password.length >= 8;
    if (step === 2) return /^\d{4,8}$/.test(form.ownerPin) && form.ownerPin === form.confirmPin;
    if (step === 3) return form.address.trim().length >= 5;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    const sb = createBrowserClient();

    // Encode pending tenant data for the confirm callback
    const pendingData = {
      businessName: form.businessName,
      slug: form.slug,
      ownerPin: form.ownerPin,
      phone: form.phone || undefined,
      address: form.address,
      timezone: form.timezone,
    };
    const pendingParam = encodeURIComponent(btoa(JSON.stringify(pendingData)));
    const redirectTo = `${window.location.origin}/signup/confirm?pending=${pendingParam}`;

    // Step 1: Create Supabase Auth account
    const { data: authData, error: authErr } = await sb.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.ownerName },
        emailRedirectTo: redirectTo,
      },
    });

    if (authErr) {
      setError(authErr.message ?? 'Sign-up failed. Email may already be registered.');
      setSubmitting(false);
      return;
    }

    // If we got a session immediately (email confirmation disabled), create tenant now
    if (authData.session) {
      const token = authData.session.access_token;
      const r = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(pendingData),
      });
      const json = await r.json() as { data?: { slug: string }; error?: string };
      setSubmitting(false);
      if (json.error) {
        if (json.error.includes('already taken')) setStep(0);
        setError(json.error);
        return;
      }
      setDone({ slug: json.data?.slug ?? form.slug });
      return;
    }

    // Email confirmation required — tenant will be created after email confirm
    setSubmitting(false);
    setDone({ slug: form.slug, needsConfirmation: true });
  };

  if (done) {
    return (
      <div style={{ textAlign:"center", display:"flex", flexDirection:"column", gap:24 }}>
        <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:8 }}>
          <div style={{ position:"absolute", width:112, height:112, borderRadius:"50%", opacity:0.1, background: done.needsConfirmation ? '#6366f1' : '#22c55e' }} />
          <div style={{ width:80, height:80, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background: done.needsConfirmation ? 'rgba(99,102,241,0.15)' : 'rgba(34,197,94,0.15)', border: done.needsConfirmation ? '2px solid rgba(99,102,241,0.4)' : '2px solid rgba(34,197,94,0.4)' }}>
            <Check size={36} style={{ color: done.needsConfirmation ? '#6366f1' : '#22c55e' }} />
          </div>
        </div>
        <div>
          <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
            {done.needsConfirmation ? 'Check your email! 📬' : "You're all set! 🎉"}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.6 }}>
            {done.needsConfirmation
              ? `We sent a confirmation link to ${form.email}. Click it to activate, then log in.`
              : 'Your 14-day free trial has started. Welcome to TYG POS!'}
          </p>
        </div>
        {done.needsConfirmation ? (
          <div style={{ borderRadius:20, padding:20, textAlign:"left", display:"flex", flexDirection:"column", gap:12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <p style={{ fontWeight: 700, color: 'white', fontSize: 13, marginBottom: 8 }}>After confirming your email:</p>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2, fontSize:11, fontWeight:700, background: 'rgba(99,102,241,0.2)', color: '#6366f1' }}>1</div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Click the confirmation link in your inbox</span>
            </div>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2, fontSize:11, fontWeight:700, background: 'rgba(99,102,241,0.2)', color: '#6366f1' }}>2</div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Return here and log in at the PIN screen</span>
            </div>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2, fontSize:11, fontWeight:700, background: 'rgba(99,102,241,0.2)', color: '#6366f1' }}>3</div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                Display name: <strong style={{ color: 'white' }}>Owner</strong> &mdash; PIN: <strong style={{ color: 'white' }}>{form.ownerPin}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div style={{ borderRadius:20, padding:20, textAlign:"left", display:"flex", flexDirection:"column", gap:10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontWeight: 700, color: 'white', fontSize: 13, marginBottom: 10 }}>Your quick links:</p>
            {[
              { label: '📋 Customer Order Page', href: `/order?tenant=${done.slug}` },
              { label: '👨‍💼 Admin Dashboard',  href: `/admin/dashboard` },
              { label: '🍳 Kitchen Display',      href: `/kitchen?tenant=${done.slug}` },
            ].map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderRadius:12, textDecoration:"none", background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{l.label}</span>
                <ChevronRight size={14} style={{ color: '#22c55e' }} />
              </a>
            ))}
          </div>
        )}
        <button onClick={() => router.push('/login')}
          style={{ width:"100%", padding:"12px 0", borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", border:"none", background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white' }}>
          Go to Login
        </button>
      </div>
    );
  }


  return (
    <>
      {/* Step dots */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:32, flexWrap:"wrap" }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700,
                background: i < step ? '#22c55e' : i === step ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                color: i <= step ? '#22c55e' : 'rgba(255,255,255,0.3)',
                border: i === step ? '2px solid #22c55e' : '2px solid transparent',
              }}>
              {i < step ? <Check size={11} /> : i + 1}
            </div>
            <span style={{ fontSize: 11, color: i === step ? 'white' : 'rgba(255,255,255,0.3)', fontWeight: i === step ? 600 : 400 }}>{s}</span>
            {i < STEPS.length - 1 && <div style={{ width:16, height:1, background: i < step ? '#22c55e' : 'rgba(255,255,255,0.1)' }} />}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"12px 16px", borderRadius:12, marginBottom:20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: '#ef4444' }}>{error}</span>
        </div>
      )}

      {/* Step 0 */}
      {step === 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div>
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Tell us about your cafe</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Start your 14-day free trial. No credit card needed.</p>
          </div>
          <div>
            <label style={labelStyle}>Business Name *</label>
            <input style={inputStyle} value={form.businessName}
              onChange={e => set('businessName', e.target.value)} placeholder="e.g. YANI Garden Cafe" autoFocus />
          </div>
          <div>
            <label style={labelStyle}>URL Slug *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, whiteSpace: 'nowrap' }}>order?tenant=</span>
              <input style={{ ...inputStyle, flex: 1 }} value={form.slug}
                onChange={e => set('slug', slugify(e.target.value))} placeholder="yani-garden" />
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 5 }}>Letters, numbers, hyphens. Min 3 chars.</p>
          </div>
          <div>
            <label style={labelStyle}>Business Type</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => set('category', c.value)}
                  style={{ padding:"10px 12px", borderRadius:12, fontSize:13, textAlign:"left", cursor:"pointer",
                    background: form.category === c.value ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${form.category === c.value ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    color: form.category === c.value ? '#22c55e' : 'rgba(255,255,255,0.55)',
                  }}>{c.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div>
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Create your account</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Your dashboard login credentials.</p>
          </div>
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input style={inputStyle} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="Maria Santos" autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" />
          </div>
          <div>
            <label style={labelStyle}>Password * (min 8 chars)</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inputStyle, paddingRight: 48 }} type={showPw ? 'text' : 'password'}
                value={form.password} onChange={e => set('password', e.target.value)} placeholder="Create a strong password" />
              <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Mobile (Optional)</label>
            <input style={inputStyle} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+63 917 123 4567" />
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 5 }}>For SMS alerts on BUSINESS plan+</p>
          </div>
        </div>
      )}

      {/* Step 2 — PIN */}
      {step === 2 && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div>
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Set your staff PIN</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Staff use this PIN at the counter — no email needed.</p>
          </div>
          <div style={{ borderRadius:20, padding:16, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <Lock size={15} style={{ color: '#6366f1', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                You can create different PINs per staff member from your admin panel. This sets your Owner PIN.
              </p>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Owner PIN * (4-8 digits)</label>
            <input
              style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: 22, textAlign: 'center' }}
              type="password" inputMode="numeric" maxLength={8}
              value={form.ownerPin} onChange={e => set('ownerPin', e.target.value.replace(/\D/g, ''))}
              placeholder="••••" autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Confirm PIN *</label>
            <input
              style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: 22, textAlign: 'center' }}
              type="password" inputMode="numeric" maxLength={8}
              value={form.confirmPin} onChange={e => set('confirmPin', e.target.value.replace(/\D/g, ''))}
              placeholder="••••" />
            {form.confirmPin.length > 0 && form.ownerPin !== form.confirmPin && (
              <p style={{ fontSize: 12, color: '#ef4444', marginTop: 5 }}>PINs do not match</p>
            )}
            {form.confirmPin.length >= 4 && form.ownerPin === form.confirmPin && (
              <p style={{ fontSize: 12, color: '#22c55e', marginTop: 5 }}>Pins match</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3 — Location */}
      {step === 3 && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div>
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Where are you located?</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Used for tax, receipts, and timezone settings.</p>
          </div>
          <div>
            <label style={labelStyle}>Full Address *</label>
            <textarea style={{ ...inputStyle, resize: 'none' as const, minHeight: 80 }}
              value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="e.g. Brgy. Maymangga, Amadeo, Cavite, Philippines" rows={3} />
          </div>
          <div>
            <label style={labelStyle}>Timezone</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.timezone} onChange={e => set('timezone', e.target.value)}>
              {[
                ['Asia/Manila', 'Asia/Manila (PH, +08:00)'],
                ['Asia/Singapore', 'Asia/Singapore (+08:00)'],
                ['Asia/Hong_Kong', 'Asia/Hong Kong (+08:00)'],
                ['Asia/Tokyo', 'Asia/Tokyo (+09:00)'],
                ['UTC', 'UTC (+00:00)'],
              ].map(([v, l]) => <option key={v} value={v} style={{ background: '#1e2535' }}>{l}</option>)}
            </select>
          </div>
          <div style={{ borderRadius:20, padding:16, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p style={{ fontWeight: 700, color: '#22c55e', fontSize: 13, marginBottom: 8 }}>Free Trial Includes</p>
            {['QR ordering for all tables', 'Kitchen display screen (KDS)', 'Basic analytics', 'Google Sheets sync', 'GCash & bank payment tracking'].map(f => (
              <div key={f} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <Check size={10} style={{ color: '#22c55e', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{f}</span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>14-day free trial then P599/mo. Cancel anytime.</p>
          </div>
        </div>
      )}

      {/* Nav buttons */}
      <div style={{ display:"flex", gap:12, marginTop:32 }}>
        {step > 0 && (
          <button onClick={() => { setError(''); setStep(s => s - 1); }}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"12px 20px", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <ChevronLeft size={14} /> Back
          </button>
        )}
        {step < 3 ? (
          <button onClick={() => { setError(''); setStep(s => s + 1); }} disabled={!canNext()}
            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px 0", borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", border:"none", background: canNext() ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.05)', color: canNext() ? 'white' : 'rgba(255,255,255,0.3)' }}>
            Continue <ChevronRight size={14} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!canNext() || submitting}
            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px 0", borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", border:"none", background: canNext() && !submitting ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.05)', color: canNext() && !submitting ? 'white' : 'rgba(255,255,255,0.3)' }}>
            {submitting ? <><Loader2 size={14} style={{ animation:"spin 1s linear infinite" }} /> Creating cafe...</> : <>Start Free Trial <ChevronRight size={14} /></>}
          </button>
        )}
      </div>
    </>
  );
}

export default function SignupPage() {
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background: 'linear-gradient(135deg, #0f1117 0%, #111827 100%)' }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"32px 24px" }}>
        <a href="/" style={{ display:"flex", alignItems:"center", gap:12, textDecoration:"none" }}>
          <div style={{ width:40, height:40, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <Coffee size={20} color="white" />
          </div>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 20 }}>TYG POS</span>
        </a>
      </div>
      <div style={{ flex:1, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"8px 16px 64px" }}>
        <div style={{ width:"100%", maxWidth:448 }}>
          <div style={{ borderRadius:24, padding:32, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
            <Suspense fallback={<div style={{ color: 'white', textAlign: 'center', padding: 32 }}>Loading...</div>}>
              <SignupForm />
            </Suspense>
          </div>
          <p style={{ textAlign:"center", marginTop:24, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#22c55e', textDecoration: 'none' }}>Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
