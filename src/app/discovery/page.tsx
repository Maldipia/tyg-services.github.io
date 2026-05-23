'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

const BRAND   = '#16a34a';
const BRAND_L = '#dcfce7';
const BG      = '#f8fafc';
const WHITE   = '#ffffff';
const TEXT    = '#0f172a';
const MUTED   = '#64748b';
const BORDER  = '#e2e8f0';
const BORDER_F = '#16a34a';
const ERR_C   = '#dc2626';
const ERR_BG  = '#fef2f2';
const CARD_SH = '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)';

const PAIN_OPTIONS = [
  'Slow manual order-taking','Lost / missing orders',
  'No real-time kitchen visibility','Manual sales reporting',
  'Cash handling errors','No payment QR option',
  'Staff inefficiency','No data on top-selling items',
];
const STEPS = ['Business Info','Current Ops','Goals','Contact'];

type ErrMap = Partial<Record<string,string>>;

export default function DiscoveryPage() {
  const [step, setStep]             = useState(0);
  const [errors, setErrors]         = useState<ErrMap>({});
  const [pains, setPains]           = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successData, setSuccessData] = useState({ name:'', biz:'' });

  const refs = {
    business_name:   useRef<HTMLInputElement>(null),
    business_type:   useRef<HTMLSelectElement>(null),
    branch_count:    useRef<HTMLSelectElement>(null),
    location:        useRef<HTMLInputElement>(null),
    years_operating: useRef<HTMLSelectElement>(null),
    current_pos:     useRef<HTMLSelectElement>(null),
    current_ordering:useRef<HTMLSelectElement>(null),
    primary_goal:    useRef<HTMLSelectElement>(null),
    monthly_volume:  useRef<HTMLSelectElement>(null),
    budget_range:    useRef<HTMLSelectElement>(null),
    timeline:        useRef<HTMLSelectElement>(null),
    contact_name:    useRef<HTMLInputElement>(null),
    contact_email:   useRef<HTMLInputElement>(null),
    contact_phone:   useRef<HTMLInputElement>(null),
    best_time:       useRef<HTMLSelectElement>(null),
    notes:           useRef<HTMLTextAreaElement>(null),
  };

  const val = (k: keyof typeof refs) => refs[k].current?.value.trim() ?? '';

  const validate = useCallback((): boolean => {
    const e: ErrMap = {};
    if (step === 0) {
      if (!val('business_name')) e.business_name = 'Required';
      if (!val('business_type')) e.business_type = 'Required';
      if (!val('location'))      e.location = 'Required';
    }
    if (step === 1) { if (!val('current_ordering')) e.current_ordering = 'Required'; }
    if (step === 2) {
      if (!val('primary_goal')) e.primary_goal = 'Required';
      if (!val('budget_range')) e.budget_range = 'Required';
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
    setSubmitting(true); setSubmitError('');
    const body = {
      business_name: val('business_name'), business_type: val('business_type'),
      branch_count: val('branch_count') || '1', location: val('location'),
      years_operating: val('years_operating'), current_pos: val('current_pos'),
      current_ordering: val('current_ordering'), pain_points: pains,
      primary_goal: val('primary_goal'), monthly_transaction_volume: val('monthly_volume'),
      budget_range: val('budget_range'), timeline: val('timeline'),
      contact_name: val('contact_name'), contact_email: val('contact_email'),
      contact_phone: val('contact_phone'), best_time_to_call: val('best_time'),
      notes: refs.notes.current?.value.trim() ?? '',
    };
    try {
      const res = await fetch('/api/discovery', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      setSuccessData({ name: body.contact_name, biz: body.business_name });
      setDone(true);
    } catch (err) {
      setSubmitError((err as Error).message || 'Something went wrong. Please try again.');
    } finally { setSubmitting(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validate, pains]);

  // ─── shared styles ───────────────────────────────────────────────────────
  const inputBase: React.CSSProperties = { width:'100%', background:WHITE, border:`1.5px solid ${BORDER}`, borderRadius:10, padding:'11px 14px', color:TEXT, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' };
  const inputErr:  React.CSSProperties = { ...inputBase, borderColor: ERR_C, background: ERR_BG };
  const selBase:   React.CSSProperties = { ...inputBase, appearance:'none', cursor:'pointer' };
  const selErr:    React.CSSProperties = { ...selBase, borderColor: ERR_C, background: ERR_BG };
  const labelSx:   React.CSSProperties = { display:'block', fontSize:13, fontWeight:600, color:TEXT, marginBottom:6 };
  const errSx:     React.CSSProperties = { fontSize:12, color:ERR_C, marginTop:4 };
  const fieldSx:   React.CSSProperties = { marginBottom:18 };

  const F = (label: string, k: keyof typeof refs, type='text', ph='') => (
    <div style={fieldSx}>
      <label style={labelSx}>{label}</label>
      <input ref={refs[k] as React.RefObject<HTMLInputElement>} type={type} placeholder={ph}
        defaultValue="" onFocus={() => clearErr(k)} style={errors[k] ? inputErr : inputBase} />
      {errors[k] && <div style={errSx}>{errors[k]}</div>}
    </div>
  );
  const S = (label: string, k: keyof typeof refs, opts: string[]) => (
    <div style={fieldSx}>
      <label style={labelSx}>{label}</label>
      <select ref={refs[k] as React.RefObject<HTMLSelectElement>} defaultValue="" onChange={() => clearErr(k)} style={errors[k] ? selErr : selBase}>
        <option value="">Select...</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {errors[k] && <div style={errSx}>{errors[k]}</div>}
    </div>
  );

  // ─── success ─────────────────────────────────────────────────────────────
  if (done) return (
    <div style={{ background:BG, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ maxWidth:520, width:'100%', textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:BRAND_L, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', fontSize:32, color:BRAND }}>✓</div>
        <h1 style={{ color:TEXT, fontSize:28, fontWeight:800, marginBottom:10 }}>You&rsquo;re on the list!</h1>
        <p style={{ color:MUTED, fontSize:15, lineHeight:1.7, marginBottom:28 }}>
          We received your form, <strong style={{ color:TEXT }}>{successData.name}</strong>.<br/>
          Our team will reach out within <strong style={{ color:BRAND }}>24–48 hours</strong> for <strong style={{ color:TEXT }}>{successData.biz}</strong>.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/" style={{ background:BRAND, color:'#fff', borderRadius:10, padding:'11px 24px', textDecoration:'none', fontWeight:700, fontSize:14 }}>Back to Home</Link>
          <Link href="/order?tenant=yani" style={{ background:WHITE, color:TEXT, border:`1.5px solid ${BORDER}`, borderRadius:10, padding:'11px 24px', textDecoration:'none', fontWeight:600, fontSize:14 }}>See Live Demo</Link>
        </div>
      </div>
    </div>
  );

  // ─── main ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background:BG, minHeight:'100vh', fontFamily:'system-ui,sans-serif', color:TEXT }}>

      {/* Nav */}
      <nav style={{ background:WHITE, padding:'14px 24px', borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:9, textDecoration:'none' }}>
          <div style={{ width:32, height:32, background:BRAND, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:15 }}>T</div>
          <span style={{ fontWeight:800, fontSize:17, color:TEXT }}>TYG<span style={{ color:BRAND }}> POS</span></span>
        </Link>
        <span style={{ fontSize:13, color:MUTED, fontWeight:500 }}>Free Consultation</span>
      </nav>

      <div style={{ maxWidth:640, margin:'0 auto', padding:'40px 20px 60px' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:BRAND_L, borderRadius:99, padding:'5px 14px', fontSize:13, color:BRAND, fontWeight:600, marginBottom:16 }}>
            🇵🇭 Free Consultation
          </div>
          <h1 style={{ fontSize:'clamp(22px,5vw,30px)', fontWeight:800, margin:'0 0 10px', color:TEXT, lineHeight:1.2 }}>Let&rsquo;s find the right plan<br/>for your restaurant</h1>
          <p style={{ color:MUTED, fontSize:14, margin:'0 auto', maxWidth:420, lineHeight:1.6 }}>Takes 3 minutes. We personally review every form and reach out within 48 hours.</p>
        </div>

        {/* Progress */}
        <div style={{ background:WHITE, borderRadius:14, padding:'16px 20px', marginBottom:20, boxShadow:CARD_SH }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', background: i < step ? BRAND : i === step ? BRAND_L : BG, border: `2px solid ${i <= step ? BRAND : BORDER}`, color: i < step ? '#fff' : i === step ? BRAND : MUTED, transition:'all 0.2s' }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize:10, color: i === step ? BRAND : MUTED, fontWeight: i === step ? 600 : 400, whiteSpace:'nowrap' }}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex:1, height:2, margin:'0 6px', marginBottom:14, background: i < step ? BRAND : BORDER, transition:'background 0.3s' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Card */}
        <div style={{ background:WHITE, borderRadius:16, padding:'28px 28px 24px', boxShadow:CARD_SH }}>

          {step === 0 && <>
            <h2 style={{ fontSize:17, fontWeight:700, margin:'0 0 20px', color:TEXT }}>Tell us about your business</h2>
            {F('Business Name *','business_name','text',"e.g. Juan's Bakeshop")}
            {S('Business Type *','business_type',['Restaurant / Café','Bakeshop / Pastry','Food Court / Kiosk','Bar / Resto-bar','Fast Food / QSR','Cloud Kitchen','Catering','Other F&B'])}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 }}>
              <div>
                <label style={labelSx}>No. of Branches</label>
                <select ref={refs.branch_count} defaultValue="1" style={selBase}>
                  {['1','2-3','4-5','6-10','10+'].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSx}>Years Operating</label>
                <select ref={refs.years_operating} defaultValue="" style={selBase}>
                  <option value="">Select...</option>
                  {['Less than 1 year','1-2 years','3-5 years','6-10 years','10+ years'].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            {F('City / Municipality *','location','text','e.g. Amadeo, Cavite')}
          </>}

          {step === 1 && <>
            <h2 style={{ fontSize:17, fontWeight:700, margin:'0 0 20px', color:TEXT }}>How are you operating today?</h2>
            {S('Current POS / Cashier System','current_pos',['Manual (pen & paper)','Cashier machine (no software)','Excel / Google Sheets','Other POS software','No system at all'])}
            {S('How do customers order now? *','current_ordering',['Verbal to staff','Paper menu + staff writes it down','Tablet/iPad handed to customer','Facebook Messenger / Viber','Third-party app (GrabFood, FoodPanda)','Already using a QR system'])}
            <div style={fieldSx}>
              <label style={labelSx}>Biggest pain points <span style={{ color:MUTED, fontWeight:400 }}>(select all that apply)</span></label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:8, marginTop:4 }}>
                {PAIN_OPTIONS.map(p => (
                  <div key={p} onClick={() => togglePain(p)} style={{ padding:'9px 12px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:500, border:`1.5px solid ${pains.includes(p) ? BRAND : BORDER}`, background: pains.includes(p) ? BRAND_L : BG, color: pains.includes(p) ? BRAND : TEXT, display:'flex', alignItems:'center', gap:7, transition:'all 0.15s', userSelect:'none' }}>
                    <span style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${pains.includes(p) ? BRAND : BORDER}`, background: pains.includes(p) ? BRAND : WHITE, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:10, color:'#fff' }}>{pains.includes(p) ? '✓' : ''}</span>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </>}

          {step === 2 && <>
            <h2 style={{ fontSize:17, fontWeight:700, margin:'0 0 20px', color:TEXT }}>What are you looking to achieve?</h2>
            {S('Primary Goal *','primary_goal',['Reduce order errors & missing items','Speed up service / reduce wait time','Accept GCash & card payments','Get real-time kitchen visibility','Automate daily sales reporting','Manage multiple branches centrally','Replace existing POS system','Complete digital transformation'])}
            {S('Monthly Transaction Volume','monthly_volume',['Under 500 orders','500–1,000 orders','1,000–3,000 orders','3,000–5,000 orders','5,000+ orders'])}
            {S('Budget Range (monthly) *','budget_range',['₱300–₱600 / mo','₱600–₱1,000 / mo','₱1,000–₱2,000 / mo','₱2,000+ / mo','Flexible, depends on features'])}
            {S('Ideal Start Timeline','timeline',['As soon as possible','Within 2 weeks','Within a month','Just researching for now'])}
          </>}

          {step === 3 && <>
            <h2 style={{ fontSize:17, fontWeight:700, margin:'0 0 20px', color:TEXT }}>How can we reach you?</h2>
            {F('Your Name *','contact_name','text','e.g. Maria Santos')}
            {F('Email Address *','contact_email','email','maria@yourbusiness.com')}
            {F('Mobile Number *','contact_phone','tel','09XX-XXX-XXXX')}
            {S('Best Time to Call','best_time',['Morning (8AM–12PM)','Afternoon (12PM–5PM)','Evening (5PM–8PM)','Anytime is fine'])}
            <div style={fieldSx}>
              <label style={labelSx}>Anything else? <span style={{ color:MUTED, fontWeight:400 }}>(optional)</span></label>
              <textarea ref={refs.notes} rows={3} placeholder="Specific features, setup questions, or concerns..."
                style={{ ...inputBase, resize:'vertical', lineHeight:1.6 }} />
            </div>
            {submitError && <div style={{ background:ERR_BG, border:`1px solid #fca5a5`, borderRadius:9, padding:'11px 14px', color:ERR_C, fontSize:13, marginBottom:14 }}>{submitError}</div>}
          </>}

          {/* Buttons */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4, gap:10 }}>
            {step > 0
              ? <button onClick={back} style={{ background:'transparent', border:`1.5px solid ${BORDER}`, color:MUTED, borderRadius:10, padding:'11px 22px', fontSize:14, cursor:'pointer', fontWeight:600 }}>← Back</button>
              : <div/>}
            {step < STEPS.length - 1
              ? <button onClick={next} style={{ background:BRAND, color:'#fff', border:'none', borderRadius:10, padding:'11px 28px', fontSize:14, cursor:'pointer', fontWeight:700, boxShadow:`0 2px 8px rgba(22,163,74,0.3)` }}>Continue →</button>
              : <button onClick={submit} disabled={submitting} style={{ background: submitting ? '#86efac' : BRAND, color:'#fff', border:'none', borderRadius:10, padding:'11px 24px', fontSize:14, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight:700, boxShadow:`0 2px 8px rgba(22,163,74,0.3)` }}>
                  {submitting ? 'Sending…' : 'Submit — Get Free Consult 🚀'}
                </button>}
          </div>
        </div>

        {/* Trust bar */}
        <div style={{ display:'flex', justifyContent:'center', gap:24, marginTop:20, flexWrap:'wrap' }}>
          {['🔒 No spam, ever','⚡ Reply in 24–48hrs','🆓 100% Free'].map(t => (
            <span key={t} style={{ fontSize:12, color:MUTED }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
