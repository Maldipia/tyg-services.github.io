'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

// ─── constants ───────────────────────────────────────────────────────────────
const BRAND   = '#22c55e';
const BG      = '#0f1117';
const SURFACE = '#161b27';
const S2      = '#1e2535';
const TEXT    = '#e8eaf0';
const MUTED   = '#6b7280';
const BORDER  = 'rgba(255,255,255,0.07)';
const ERR_C   = '#f87171';

const PAIN_OPTIONS = [
  'Slow manual order-taking','Lost / missing orders',
  'No real-time kitchen visibility','Manual sales reporting',
  'Cash handling errors','No payment QR option',
  'Staff inefficiency','No data on top-selling items',
];
const STEPS = ['Business Info','Current Ops','Goals','Contact'];

type ErrMap = Partial<Record<string,string>>;

// ─── page ────────────────────────────────────────────────────────────────────
export default function DiscoveryPage() {
  const [step, setStep]         = useState(0);
  const [errors, setErrors]     = useState<ErrMap>({});
  const [pains, setPains]       = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successData, setSuccessData] = useState({ name: '', biz: '' });

  // Uncontrolled refs — no re-render on every keystroke
  const refs = {
    business_name:  useRef<HTMLInputElement>(null),
    business_type:  useRef<HTMLSelectElement>(null),
    branch_count:   useRef<HTMLSelectElement>(null),
    location:       useRef<HTMLInputElement>(null),
    years_operating:useRef<HTMLSelectElement>(null),
    current_pos:    useRef<HTMLSelectElement>(null),
    current_ordering:useRef<HTMLSelectElement>(null),
    primary_goal:   useRef<HTMLSelectElement>(null),
    monthly_volume: useRef<HTMLSelectElement>(null),
    budget_range:   useRef<HTMLSelectElement>(null),
    timeline:       useRef<HTMLSelectElement>(null),
    contact_name:   useRef<HTMLInputElement>(null),
    contact_email:  useRef<HTMLInputElement>(null),
    contact_phone:  useRef<HTMLInputElement>(null),
    best_time:      useRef<HTMLSelectElement>(null),
    notes:          useRef<HTMLTextAreaElement>(null),
  };

  const val = (k: keyof typeof refs) => {
    const r = refs[k].current;
    return r ? r.value.trim() : '';
  };

  const validate = useCallback((): boolean => {
    const e: ErrMap = {};
    if (step === 0) {
      if (!val('business_name')) e.business_name = 'Required';
      if (!val('business_type')) e.business_type = 'Required';
      if (!val('location'))      e.location = 'Required';
    }
    if (step === 1) {
      if (!val('current_ordering')) e.current_ordering = 'Required';
    }
    if (step === 2) {
      if (!val('primary_goal'))  e.primary_goal = 'Required';
      if (!val('budget_range'))  e.budget_range = 'Required';
    }
    if (step === 3) {
      if (!val('contact_name'))  e.contact_name = 'Required';
      if (!val('contact_email')) e.contact_email = 'Required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('contact_email'))) e.contact_email = 'Invalid email';
      if (!val('contact_phone')) e.contact_phone = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const next = useCallback(() => { if (validate()) setStep(s => s + 1); }, [validate]);
  const back = useCallback(() => { setStep(s => s - 1); setErrors({}); }, []);

  const clearErr = useCallback((k: string) => {
    setErrors(e => { if (!e[k]) return e; const n = {...e}; delete n[k]; return n; });
  }, []);

  const togglePain = useCallback((p: string) => {
    setPains(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }, []);

  const submit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    const body = {
      business_name:  val('business_name'),
      business_type:  val('business_type'),
      branch_count:   val('branch_count') || '1',
      location:       val('location'),
      years_operating:val('years_operating'),
      current_pos:    val('current_pos'),
      current_ordering:val('current_ordering'),
      pain_points:    pains,
      primary_goal:   val('primary_goal'),
      monthly_transaction_volume: val('monthly_volume'),
      budget_range:   val('budget_range'),
      timeline:       val('timeline'),
      contact_name:   val('contact_name'),
      contact_email:  val('contact_email'),
      contact_phone:  val('contact_phone'),
      best_time_to_call: val('best_time'),
      notes:          refs.notes.current?.value.trim() ?? '',
    };
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccessData({ name: body.contact_name, biz: body.business_name });
      setDone(true);
    } catch (err) {
      setSubmitError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validate, pains]);

  // ─── styles (static objects, defined once) ────────────────────────────────
  const sx = {
    input: { width:'100%', background:S2, border:`1px solid ${BORDER}`, borderRadius:10, padding:'11px 14px', color:TEXT, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const },
    inputErr: { width:'100%', background:S2, border:`1px solid ${ERR_C}`, borderRadius:10, padding:'11px 14px', color:TEXT, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const },
    sel: { width:'100%', background:S2, border:`1px solid ${BORDER}`, borderRadius:10, padding:'11px 14px', color:TEXT, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const, appearance:'none' as const, cursor:'pointer' as const },
    selErr: { width:'100%', background:S2, border:`1px solid ${ERR_C}`, borderRadius:10, padding:'11px 14px', color:TEXT, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const, appearance:'none' as const, cursor:'pointer' as const },
    label: { display:'block', fontSize:13, fontWeight:600, color:TEXT, marginBottom:6 } as React.CSSProperties,
    errMsg: { fontSize:12, color:ERR_C, marginTop:4 } as React.CSSProperties,
    field: { marginBottom:18 } as React.CSSProperties,
  };

  // Helper: render labelled input
  const F = (label: string, k: keyof typeof refs, type='text', ph='') => (
    <div style={sx.field}>
      <label style={sx.label}>{label}</label>
      <input ref={refs[k] as React.RefObject<HTMLInputElement>} type={type} placeholder={ph}
        defaultValue="" onFocus={() => clearErr(k)}
        style={errors[k] ? sx.inputErr : sx.input} />
      {errors[k] && <div style={sx.errMsg}>{errors[k]}</div>}
    </div>
  );

  const S = (label: string, k: keyof typeof refs, opts: string[], required=false) => (
    <div style={sx.field}>
      <label style={sx.label}>{label}</label>
      <select ref={refs[k] as React.RefObject<HTMLSelectElement>}
        defaultValue="" onChange={() => clearErr(k)}
        style={errors[k] ? sx.selErr : sx.sel}>
        <option value="">Select...</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {errors[k] && <div style={sx.errMsg}>{errors[k]}</div>}
    </div>
  );

  // ─── success ──────────────────────────────────────────────────────────────
  if (done) return (
    <div style={{ background:BG, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ maxWidth:540, width:'100%', textAlign:'center' }}>
        <div style={{ width:80, height:80, borderRadius:'50%', background:'rgba(34,197,94,0.12)', border:'2px solid rgba(34,197,94,0.4)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 28px', fontSize:36 }}>✓</div>
        <h1 style={{ color:TEXT, fontSize:32, fontWeight:900, marginBottom:12 }}>You&rsquo;re on the list!</h1>
        <p style={{ color:MUTED, fontSize:16, lineHeight:1.7, marginBottom:32 }}>
          We received your form, <strong style={{ color:TEXT }}>{successData.name}</strong>.<br />
          Our team will reach out within <strong style={{ color:BRAND }}>24–48 hours</strong> to discuss the best plan for <strong style={{ color:TEXT }}>{successData.biz}</strong>.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/" style={{ background:BRAND, color:'#000', borderRadius:12, padding:'12px 28px', textDecoration:'none', fontWeight:700, fontSize:15 }}>Back to Home</Link>
          <Link href="/order?tenant=yani" style={{ background:SURFACE, color:TEXT, border:`1px solid ${BORDER}`, borderRadius:12, padding:'12px 28px', textDecoration:'none', fontWeight:600, fontSize:15 }}>See Live Demo</Link>
        </div>
      </div>
    </div>
  );

  // ─── main form ───────────────────────────────────────────────────────────
  return (
    <div style={{ background:BG, minHeight:'100vh', fontFamily:'system-ui,sans-serif', color:TEXT }}>
      <nav style={{ padding:'16px 24px', borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{ width:32, height:32, background:BRAND, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#000', fontSize:16 }}>T</div>
          <span style={{ fontWeight:800, fontSize:18, color:TEXT }}>TYG<span style={{ color:BRAND }}> POS</span></span>
        </Link>
        <span style={{ fontSize:13, color:MUTED }}>Discovery Form</span>
      </nav>

      <div style={{ maxWidth:680, margin:'0 auto', padding:'48px 24px' }}>
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div style={{ display:'inline-block', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:99, padding:'6px 18px', fontSize:13, color:BRAND, fontWeight:600, marginBottom:20 }}>🇵🇭 Free Consultation</div>
          <h1 style={{ fontSize:32, fontWeight:900, margin:'0 0 12px' }}>Let&rsquo;s find the right plan for your restaurant</h1>
          <p style={{ color:MUTED, fontSize:15, margin:'0 auto', maxWidth:480 }}>Takes 3 minutes. Our team personally reviews every submission and reaches out within 48 hours.</p>
        </div>

        {/* Progress */}
        <div style={{ marginBottom:40 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', background: i < step ? BRAND : i === step ? 'rgba(34,197,94,0.15)' : S2, border: i <= step ? `2px solid ${BRAND}` : `2px solid ${BORDER}`, color: i < step ? '#000' : i === step ? BRAND : MUTED }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize:11, color: i === step ? BRAND : MUTED, marginTop:4, fontWeight: i === step ? 600 : 400 }}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ height:2, background:S2, borderRadius:2, position:'relative', marginTop:8 }}>
            <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${(step/(STEPS.length-1))*100}%`, background:BRAND, borderRadius:2, transition:'width 0.4s ease' }} />
          </div>
        </div>

        {/* Card */}
        <div style={{ background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:20, padding:'36px 40px' }}>

          {step === 0 && <>
            <h2 style={{ fontSize:20, fontWeight:800, margin:'0 0 24px' }}>Tell us about your business</h2>
            {F('Business Name *','business_name','text',"e.g. Juan's Bakeshop")}
            {S('Business Type *','business_type',['Restaurant / Café','Bakeshop / Pastry','Food Court / Kiosk','Bar / Resto-bar','Fast Food / QSR','Cloud Kitchen','Catering','Other F&B'],true)}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:18 }}>
              <div>
                <label style={sx.label}>Number of Branches</label>
                <select ref={refs.branch_count} defaultValue="1" style={sx.sel}>
                  {['1','2-3','4-5','6-10','10+'].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={sx.label}>Years Operating</label>
                <select ref={refs.years_operating} defaultValue="" style={sx.sel}>
                  <option value="">Select...</option>
                  {['Less than 1 year','1-2 years','3-5 years','6-10 years','10+ years'].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            {F('City / Municipality *','location','text','e.g. Amadeo, Cavite')}
          </>}

          {step === 1 && <>
            <h2 style={{ fontSize:20, fontWeight:800, margin:'0 0 24px' }}>How are you operating today?</h2>
            {S('Current POS / Cashier System','current_pos',['Manual (pen & paper)','Cashier machine (no software)','Excel / Google Sheets','Other POS software','No system at all'])}
            {S('How do customers order now? *','current_ordering',['Verbal to staff','Paper menu + staff writes it down','Tablet/iPad handed to customer','Facebook Messenger / Viber','Third-party app (GrabFood, FoodPanda)','Already using a QR system'],true)}
            <div style={sx.field}>
              <label style={sx.label}>Biggest pain points? <span style={{ color:MUTED, fontWeight:400 }}>(select all that apply)</span></label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:8, marginTop:4 }}>
                {PAIN_OPTIONS.map(p => (
                  <div key={p} onClick={() => togglePain(p)} style={{ padding:'10px 14px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:500, border:`1.5px solid ${pains.includes(p) ? BRAND : BORDER}`, background: pains.includes(p) ? 'rgba(34,197,94,0.08)' : S2, color: pains.includes(p) ? BRAND : TEXT, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ opacity: pains.includes(p) ? 1 : 0.3 }}>✓</span> {p}
                  </div>
                ))}
              </div>
            </div>
          </>}

          {step === 2 && <>
            <h2 style={{ fontSize:20, fontWeight:800, margin:'0 0 24px' }}>What are you looking to achieve?</h2>
            {S('Primary Goal *','primary_goal',['Reduce order errors & missing items','Speed up service / reduce wait time','Accept GCash & card payments','Get real-time kitchen visibility','Automate daily sales reporting','Manage multiple branches centrally','Replace existing POS system','Complete digital transformation'],true)}
            {S('Monthly Transaction Volume','monthly_volume',['Under 500 orders','500–1,000 orders','1,000–3,000 orders','3,000–5,000 orders','5,000+ orders'])}
            {S('Budget Range (monthly) *','budget_range',['₱300–₱600 / mo','₱600–₱1,000 / mo','₱1,000–₱2,000 / mo','₱2,000+ / mo','Flexible, depends on features'],true)}
            {S('Ideal Start Timeline','timeline',['As soon as possible','Within 2 weeks','Within a month','Just researching for now'])}
          </>}

          {step === 3 && <>
            <h2 style={{ fontSize:20, fontWeight:800, margin:'0 0 24px' }}>How can we reach you?</h2>
            {F('Your Name *','contact_name','text','e.g. Maria Santos')}
            {F('Email Address *','contact_email','email','maria@yourbusiness.com')}
            {F('Mobile Number *','contact_phone','tel','09XX-XXX-XXXX')}
            {S('Best Time to Call','best_time',['Morning (8AM–12PM)','Afternoon (12PM–5PM)','Evening (5PM–8PM)','Anytime is fine'])}
            <div style={sx.field}>
              <label style={sx.label}>Anything else? <span style={{ color:MUTED, fontWeight:400 }}>(optional)</span></label>
              <textarea ref={refs.notes} rows={4} placeholder="Specific features, setup questions, or concerns..."
                style={{ width:'100%', background:S2, border:`1px solid ${BORDER}`, borderRadius:10, padding:'11px 14px', color:TEXT, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box', resize:'vertical', lineHeight:1.6 }} />
            </div>
            {submitError && <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:10, padding:'12px 16px', color:ERR_C, fontSize:13, marginBottom:16 }}>{submitError}</div>}
          </>}

          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, gap:12 }}>
            {step > 0
              ? <button onClick={back} style={{ background:'transparent', border:`1px solid ${BORDER}`, color:MUTED, borderRadius:12, padding:'12px 24px', fontSize:15, cursor:'pointer', fontWeight:600 }}>← Back</button>
              : <div />}
            {step < STEPS.length - 1
              ? <button onClick={next} style={{ background:BRAND, color:'#000', border:'none', borderRadius:12, padding:'12px 32px', fontSize:15, cursor:'pointer', fontWeight:700, boxShadow:'0 0 20px rgba(34,197,94,0.25)' }}>Continue →</button>
              : <button onClick={submit} disabled={submitting} style={{ background: submitting ? '#1a3321' : BRAND, color: submitting ? BRAND : '#000', border:'none', borderRadius:12, padding:'12px 32px', fontSize:15, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight:700 }}>
                  {submitting ? 'Sending…' : 'Submit — Get My Free Consult 🚀'}
                </button>}
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'center', gap:32, marginTop:32, flexWrap:'wrap' }}>
          {['🔒 Private — no spam','⚡ Response in 24–48hrs','🆓 100% Free consultation'].map(t => (
            <span key={t} style={{ fontSize:13, color:MUTED }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
