'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useCallback, memo } from 'react';
import Link from 'next/link';

// ─── constants (module-level — never recreated) ────────────────────────────
const BRAND  = '#22c55e';
const BG     = '#0f1117';
const SURFACE  = '#161b27';
const SURFACE2 = '#1e2535';
const TEXT  = '#e8eaf0';
const MUTED = '#6b7280';
const BORDER = 'rgba(255,255,255,0.07)';
const ERROR  = '#f87171';

const INPUT_SX: React.CSSProperties = {
  width: '100%', background: SURFACE2, border: `1px solid ${BORDER}`,
  borderRadius: 10, padding: '11px 14px', color: TEXT, fontSize: 14,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};
const INPUT_ERR_SX: React.CSSProperties = { ...INPUT_SX, borderColor: ERROR };
const LABEL_SX: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 };
const ERR_SX:   React.CSSProperties = { fontSize: 12, color: ERROR, marginTop: 4 };
const FIELD_SX: React.CSSProperties = { marginBottom: 18 };
const SELECT_SX: React.CSSProperties = { ...INPUT_SX, appearance: 'none' as const, cursor: 'pointer' };
const SELECT_ERR_SX: React.CSSProperties = { ...SELECT_SX, borderColor: ERROR };

const PAIN_OPTIONS = [
  'Slow manual order-taking', 'Lost / missing orders',
  'No real-time kitchen visibility', 'Manual sales reporting',
  'Cash handling errors', 'No payment QR option',
  'Staff inefficiency', 'No data on top-selling items',
];
const STEPS = ['Business Info', 'Current Ops', 'Goals', 'Contact'];

interface FormData {
  business_name: string; business_type: string; branch_count: string;
  location: string; years_operating: string; current_pos: string;
  current_ordering: string; pain_points: string[]; primary_goal: string;
  monthly_transaction_volume: string; budget_range: string; timeline: string;
  contact_name: string; contact_email: string; contact_phone: string;
  best_time_to_call: string; notes: string;
}
const EMPTY: FormData = {
  business_name: '', business_type: '', branch_count: '1', location: '',
  years_operating: '', current_pos: '', current_ordering: '', pain_points: [],
  primary_goal: '', monthly_transaction_volume: '', budget_range: '',
  timeline: '', contact_name: '', contact_email: '', contact_phone: '',
  best_time_to_call: '', notes: '',
};

// ─── sub-components outside parent — no remount on re-render ───────────────
interface FieldProps {
  label: string; k: keyof FormData; value: string; error?: string;
  type?: string; placeholder?: string;
  onChange: (k: keyof FormData, v: string) => void;
}
const Field = memo(({ label, k, value, error, type = 'text', placeholder = '', onChange }: FieldProps) => (
  <div style={FIELD_SX}>
    <label style={LABEL_SX}>{label}</label>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(k, e.target.value)}
      style={error ? INPUT_ERR_SX : INPUT_SX}
    />
    {error && <div style={ERR_SX}>{error}</div>}
  </div>
));
Field.displayName = 'Field';

interface SelectProps {
  label: string; k: keyof FormData; value: string; error?: string;
  options: string[];
  onChange: (k: keyof FormData, v: string) => void;
}
const SelectField = memo(({ label, k, value, error, options, onChange }: SelectProps) => (
  <div style={FIELD_SX}>
    <label style={LABEL_SX}>{label}</label>
    <select value={value} onChange={e => onChange(k, e.target.value)} style={error ? SELECT_ERR_SX : SELECT_SX}>
      <option value="">Select...</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    {error && <div style={ERR_SX}>{error}</div>}
  </div>
));
SelectField.displayName = 'SelectField';

// ─── main page ─────────────────────────────────────────────────────────────
export default function DiscoveryPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleChange = useCallback((k: keyof FormData, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }, []);

  const togglePain = useCallback((p: string) => {
    setForm(f => ({
      ...f,
      pain_points: f.pain_points.includes(p)
        ? f.pain_points.filter(x => x !== p)
        : [...f.pain_points, p],
    }));
  }, []);

  const validate = useCallback((): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (step === 0) {
      if (!form.business_name.trim()) e.business_name = 'Required';
      if (!form.business_type)        e.business_type = 'Required';
      if (!form.location.trim())      e.location = 'Required';
    }
    if (step === 1) { if (!form.current_ordering) e.current_ordering = 'Required'; }
    if (step === 2) {
      if (!form.primary_goal)  e.primary_goal = 'Required';
      if (!form.budget_range)  e.budget_range = 'Required';
    }
    if (step === 3) {
      if (!form.contact_name.trim())  e.contact_name = 'Required';
      if (!form.contact_email.trim()) e.contact_email = 'Required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) e.contact_email = 'Invalid email';
      if (!form.contact_phone.trim()) e.contact_phone = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [step, form]);

  const next = useCallback(() => { if (validate()) setStep(s => s + 1); }, [validate]);
  const back = useCallback(() => setStep(s => s - 1), []);

  const submit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch (err) {
      setSubmitError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [validate, form]);

  // ─── success ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
        <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', fontSize: 36 }}>✓</div>
          <h1 style={{ color: TEXT, fontSize: 32, fontWeight: 900, marginBottom: 12 }}>You&rsquo;re on the list!</h1>
          <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>
            We received your form, <strong style={{ color: TEXT }}>{form.contact_name}</strong>.<br />
            Our team will reach out within <strong style={{ color: BRAND }}>24–48 hours</strong> to discuss the best plan for <strong style={{ color: TEXT }}>{form.business_name}</strong>.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" style={{ background: BRAND, color: '#000', borderRadius: 12, padding: '12px 28px', textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>Back to Home</Link>
            <Link href="/order?tenant=yani" style={{ background: SURFACE, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 28px', textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>See Live Demo</Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── form ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: 'system-ui,sans-serif', color: TEXT }}>

      {/* Nav */}
      <nav style={{ padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, background: BRAND, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#000', fontSize: 16 }}>T</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: TEXT }}>TYG<span style={{ color: BRAND }}> POS</span></span>
        </Link>
        <span style={{ fontSize: 13, color: MUTED }}>Discovery Form</span>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-block', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 99, padding: '6px 18px', fontSize: 13, color: BRAND, fontWeight: 600, marginBottom: 20 }}>
            🇵🇭 Free Consultation
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 12px' }}>Let&rsquo;s find the right plan for your restaurant</h1>
          <p style={{ color: MUTED, fontSize: 15, margin: '0 auto', maxWidth: 480 }}>
            Takes 3 minutes. Our team personally reviews every submission and reaches out within 48 hours.
          </p>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < step ? BRAND : i === step ? 'rgba(34,197,94,0.15)' : SURFACE2,
                  border: i <= step ? `2px solid ${BRAND}` : `2px solid ${BORDER}`,
                  color: i < step ? '#000' : i === step ? BRAND : MUTED,
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i === step ? BRAND : MUTED, marginTop: 4, fontWeight: i === step ? 600 : 400 }}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 2, background: SURFACE2, borderRadius: 2, position: 'relative', marginTop: 8 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(step / (STEPS.length - 1)) * 100}%`, background: BRAND, borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Card */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '36px 40px' }}>

          {step === 0 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 24px' }}>Tell us about your business</h2>
              <Field label="Business Name *" k="business_name" value={form.business_name} error={errors.business_name} placeholder="e.g. Juan's Bakeshop" onChange={handleChange} />
              <SelectField label="Business Type *" k="business_type" value={form.business_type} error={errors.business_type} onChange={handleChange}
                options={['Restaurant / Café','Bakeshop / Pastry','Food Court / Kiosk','Bar / Resto-bar','Fast Food / QSR','Cloud Kitchen','Catering','Other F&B']} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                <div>
                  <label style={LABEL_SX}>Number of Branches</label>
                  <select value={form.branch_count} onChange={e => handleChange('branch_count', e.target.value)} style={SELECT_SX}>
                    {['1','2-3','4-5','6-10','10+'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL_SX}>Years Operating</label>
                  <select value={form.years_operating} onChange={e => handleChange('years_operating', e.target.value)} style={SELECT_SX}>
                    <option value="">Select...</option>
                    {['Less than 1 year','1-2 years','3-5 years','6-10 years','10+ years'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <Field label="City / Municipality *" k="location" value={form.location} error={errors.location} placeholder="e.g. Amadeo, Cavite" onChange={handleChange} />
            </>
          )}

          {step === 1 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 24px' }}>How are you operating today?</h2>
              <SelectField label="Current POS / Cashier System" k="current_pos" value={form.current_pos} onChange={handleChange}
                options={['Manual (pen & paper)','Cashier machine (no software)','Excel / Google Sheets','Other POS software','No system at all']} />
              <SelectField label="How do customers order now? *" k="current_ordering" value={form.current_ordering} error={errors.current_ordering} onChange={handleChange}
                options={['Verbal to staff','Paper menu + staff writes it down','Tablet/iPad handed to customer','Facebook Messenger / Viber','Third-party app (GrabFood, FoodPanda)','Already using a QR system']} />
              <div style={FIELD_SX}>
                <label style={LABEL_SX}>What are your biggest pain points? <span style={{ color: MUTED, fontWeight: 400 }}>(select all that apply)</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8, marginTop: 4 }}>
                  {PAIN_OPTIONS.map(p => (
                    <div key={p} onClick={() => togglePain(p)} style={{
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      border: `1.5px solid ${form.pain_points.includes(p) ? BRAND : BORDER}`,
                      background: form.pain_points.includes(p) ? 'rgba(34,197,94,0.08)' : SURFACE2,
                      color: form.pain_points.includes(p) ? BRAND : TEXT,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ opacity: form.pain_points.includes(p) ? 1 : 0.3 }}>✓</span> {p}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 24px' }}>What are you looking to achieve?</h2>
              <SelectField label="Primary Goal *" k="primary_goal" value={form.primary_goal} error={errors.primary_goal} onChange={handleChange}
                options={['Reduce order errors & missing items','Speed up service / reduce wait time','Accept GCash & card payments','Get real-time kitchen visibility','Automate daily sales reporting','Manage multiple branches centrally','Replace existing POS system','Complete digital transformation']} />
              <SelectField label="Monthly Transaction Volume" k="monthly_transaction_volume" value={form.monthly_transaction_volume} onChange={handleChange}
                options={['Under 500 orders','500–1,000 orders','1,000–3,000 orders','3,000–5,000 orders','5,000+ orders']} />
              <SelectField label="Budget Range (monthly) *" k="budget_range" value={form.budget_range} error={errors.budget_range} onChange={handleChange}
                options={['₱300–₱600 / mo','₱600–₱1,000 / mo','₱1,000–₱2,000 / mo','₱2,000+ / mo','Flexible, depends on features']} />
              <SelectField label="Ideal Start Timeline" k="timeline" value={form.timeline} onChange={handleChange}
                options={['As soon as possible','Within 2 weeks','Within a month','Just researching for now']} />
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 24px' }}>How can we reach you?</h2>
              <Field label="Your Name *" k="contact_name" value={form.contact_name} error={errors.contact_name} placeholder="e.g. Maria Santos" onChange={handleChange} />
              <Field label="Email Address *" k="contact_email" value={form.contact_email} error={errors.contact_email} type="email" placeholder="maria@yourbusiness.com" onChange={handleChange} />
              <Field label="Mobile Number *" k="contact_phone" value={form.contact_phone} error={errors.contact_phone} type="tel" placeholder="09XX-XXX-XXXX" onChange={handleChange} />
              <SelectField label="Best Time to Call" k="best_time_to_call" value={form.best_time_to_call} onChange={handleChange}
                options={['Morning (8AM–12PM)','Afternoon (12PM–5PM)','Evening (5PM–8PM)','Anytime is fine']} />
              <div style={FIELD_SX}>
                <label style={LABEL_SX}>Anything else? <span style={{ color: MUTED, fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  value={form.notes}
                  onChange={e => handleChange('notes', e.target.value)}
                  rows={4}
                  placeholder="Specific features, setup questions, or concerns..."
                  style={{ ...INPUT_SX, resize: 'vertical', lineHeight: 1.6 }}
                />
              </div>
              {submitError && (
                <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '12px 16px', color: ERROR, fontSize: 13, marginBottom: 16 }}>
                  {submitError}
                </div>
              )}
            </>
          )}

          {/* Nav buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 12 }}>
            {step > 0
              ? <button onClick={back} style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 12, padding: '12px 24px', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}>← Back</button>
              : <div />}
            {step < STEPS.length - 1
              ? <button onClick={next} style={{ background: BRAND, color: '#000', border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 15, cursor: 'pointer', fontWeight: 700, boxShadow: '0 0 20px rgba(34,197,94,0.25)' }}>Continue →</button>
              : <button onClick={submit} disabled={submitting} style={{ background: submitting ? '#1a3321' : BRAND, color: submitting ? BRAND : '#000', border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: submitting ? 0.8 : 1 }}>
                  {submitting ? 'Sending…' : 'Submit — Get My Free Consult 🚀'}
                </button>}
          </div>
        </div>

        {/* Trust */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 32, flexWrap: 'wrap' }}>
          {['🔒 Private — no spam', '⚡ Response in 24–48hrs', '🆓 100% Free consultation'].map(t => (
            <span key={t} style={{ fontSize: 13, color: MUTED }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
