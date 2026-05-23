'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

// ─── palette ─────────────────────────────────────────────────────────────────
const G     = '#16a34a';
const GL    = '#dcfce7';
const BG    = '#f8fafc';
const WHITE = '#ffffff';
const TEXT  = '#0f172a';
const MUT   = '#64748b';
const BOR   = '#e2e8f0';
const ERR   = '#dc2626';
const ERRBG = '#fef2f2';
const SH    = '0 1px 3px rgba(0,0,0,0.08)';

// ─── system types ────────────────────────────────────────────────────────────
const SYSTEM_TYPES = [
  { id:'restaurant',    icon:'🍽️',  label:'Restaurant / Café',     desc:'QR ordering, kitchen display, POS, reservations' },
  { id:'hospitality',   icon:'🏨',  label:'Hospitality / Resort',   desc:'Booking, check-in, rooms, Airbnb integration' },
  { id:'retail',        icon:'🛍️',  label:'Retail / E-commerce',    desc:'Online store, inventory, orders, payments' },
  { id:'distributor',   icon:'📦',  label:'Distributor / Delivery', desc:'Order routing, delivery tracking, collections' },
  { id:'concierge',     icon:'👔',  label:'Concierge / Services',   desc:'Scheduling, staff dispatch, customer profiles' },
  { id:'membership',    icon:'💳',  label:'Membership / Loyalty',   desc:'Points, tiers, digital cards, perks' },
  { id:'booking',       icon:'📅',  label:'Booking System',         desc:'Appointments, calendar, reminders, payments' },
  { id:'inventory',     icon:'🗃️',  label:'Inventory / POS',        desc:'Stock management, purchase orders, multi-branch' },
  { id:'crm',           icon:'🤝',  label:'CRM / Automation',       desc:'Leads, pipeline, email/SMS automation, reporting' },
  { id:'enterprise',    icon:'🏢',  label:'Enterprise / Custom',    desc:'Multi-department, APIs, compliance, complex workflows' },
];

// ─── features by type ────────────────────────────────────────────────────────
const FEATURES: Record<string, string[]> = {
  restaurant:   ['QR table ordering','Kitchen display system','Table management','Reservations','Delivery integration (GrabFood, etc.)','Staff & PIN management','Sales analytics','Loyalty / promo codes','Online menu page','Receipt & BIR compliance'],
  hospitality:  ['Online booking engine','Room / unit management','Guest check-in/check-out','Housekeeping tracking','Guest messaging (SMS/Viber)','Channel sync (Airbnb, Booking.com)','Payment processing','Reviews & feedback','Multi-property support','Revenue reporting'],
  retail:       ['Product catalog','Shopping cart & checkout','Inventory tracking','Order management','Customer accounts','Promo & discount codes','Shipping integration','Sales analytics','Barcode / SKU scanning','Supplier management'],
  distributor:  ['Customer order portal','Delivery route management','Driver tracking','Invoice & collection tracking','Inventory / stock levels','Price list management','SMS/email notifications','Territory management','Returns & adjustments','Daily summary reports'],
  concierge:    ['Service catalog','Online booking','Staff / technician assignment','Job tracking & updates','Customer profiles','SMS/email notifications','Payment & invoicing','Feedback & reviews','Recurring bookings','Dashboard & reports'],
  membership:   ['Member registration portal','Digital ID / QR card','Points & rewards engine','Tier management','Redemption system','SMS/push notifications','Member portal (self-service)','Event / promo management','Expiry & renewal reminders','Analytics dashboard'],
  booking:      ['Calendar management','Online booking page','Payment at booking','Staff scheduling','Resource / room booking','Automated reminders','Waitlist management','Cancellation & rescheduling','Client profiles','Reporting'],
  inventory:    ['POS terminal','Stock-in / stock-out','Purchase orders','Multi-branch stock sync','Barcode scanning','Reorder alerts','Supplier management','Inventory valuation','Audit trail','Reporting'],
  crm:          ['Contact & company profiles','Lead pipeline','Task & follow-up reminders','Email automation','SMS automation','Facebook lead capture','Quote / proposal builder','Document management','Team assignments','Analytics & forecasting'],
  enterprise:   ['Custom workflow builder','Multi-department access','Role-based permissions','API integrations','Data warehouse / reporting','Audit logs & compliance','SSO / authentication','Training & onboarding module','SLA management','Dedicated support'],
};

const INTEGRATIONS = [
  'GCash / Maya','Credit / debit card (PayMongo)','SMS notifications (Semaphore)','Email (Resend / Mailchimp)',
  'Facebook / Meta','Google (Sheets, Calendar, Maps)','Shopify / WooCommerce','QuickBooks / accounting',
  'GrabFood / FoodPanda / Lalamove','WhatsApp / Viber','Xero / accounting','Custom API / webhook',
];

const STEPS = ['System Type','Business','Scope','Qualify','Contact'];

type ErrMap = Partial<Record<string,string>>;

// ─── static styles ───────────────────────────────────────────────────────────
const inp:  React.CSSProperties = { width:'100%', background:WHITE, border:`1.5px solid ${BOR}`, borderRadius:10, padding:'11px 14px', color:TEXT, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' };
const inpE: React.CSSProperties = { ...inp, borderColor:ERR, background:ERRBG };
const sel:  React.CSSProperties = { ...inp, appearance:'none', cursor:'pointer' };
const selE: React.CSSProperties = { ...sel, borderColor:ERR, background:ERRBG };
const lbl:  React.CSSProperties = { display:'block', fontSize:13, fontWeight:600, color:TEXT, marginBottom:6 };
const err:  React.CSSProperties = { fontSize:12, color:ERR, marginTop:4 };
const fld:  React.CSSProperties = { marginBottom:18 };

// ─── main component ───────────────────────────────────────────────────────────
export default function DiscoveryPage() {
  const [step, setStep]           = useState(0);
  const [systemType, setSystemType] = useState('');
  const [features, setFeatures]   = useState<string[]>([]);
  const [integrations, setInts]   = useState<string[]>([]);
  const [errors, setErrors]       = useState<ErrMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [success, setSuccess]     = useState({ name:'', biz:'' });

  // refs for text inputs
  const r = {
    biz_name:        useRef<HTMLInputElement>(null),
    biz_location:    useRef<HTMLInputElement>(null),
    years_op:        useRef<HTMLSelectElement>(null),
    team_size:       useRef<HTMLSelectElement>(null),
    current_system:  useRef<HTMLInputElement>(null),
    pain_point:      useRef<HTMLTextAreaElement>(null),
    user_count:      useRef<HTMLSelectElement>(null),
    location_count:  useRef<HTMLSelectElement>(null),
    has_migration:   useRef<HTMLSelectElement>(null),
    budget:          useRef<HTMLSelectElement>(null),
    timeline:        useRef<HTMLSelectElement>(null),
    decision_maker:  useRef<HTMLSelectElement>(null),
    post_launch:     useRef<HTMLSelectElement>(null),
    has_branding:    useRef<HTMLSelectElement>(null),
    dev_experience:  useRef<HTMLSelectElement>(null),
    contact_name:    useRef<HTMLInputElement>(null),
    contact_email:   useRef<HTMLInputElement>(null),
    contact_phone:   useRef<HTMLInputElement>(null),
    best_time:       useRef<HTMLSelectElement>(null),
    notes:           useRef<HTMLTextAreaElement>(null),
  };
  const v = (k: keyof typeof r) => r[k].current?.value.trim() ?? '';

  const clearE = useCallback((k: string) => {
    setErrors((e: ErrMap) => { if (!e[k]) return e; const n={...e}; delete n[k]; return n; });
  }, []);

  const toggleFeat = useCallback((f: string) =>
    setFeatures((p: string[]) => p.includes(f) ? p.filter((x: string)=>x!==f) : [...p,f]), []);
  const toggleInt  = useCallback((i: string) =>
    setInts((p: string[]) => p.includes(i) ? p.filter((x: string)=>x!==i) : [...p,i]), []);

  const validate = useCallback((): boolean => {
    const e: ErrMap = {};
    if (step === 0) { if (!systemType) e.system_type = 'Please select a system type'; }
    if (step === 1) {
      if (!v('biz_name'))     e.biz_name = 'Required';
      if (!v('biz_location')) e.biz_location = 'Required';
    }
    if (step === 3) {
      if (!v('budget'))   e.budget = 'Required';
      if (!v('timeline')) e.timeline = 'Required';
    }
    if (step === 4) {
      if (!v('contact_name'))  e.contact_name = 'Required';
      if (!v('contact_email')) e.contact_email = 'Required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('contact_email'))) e.contact_email = 'Invalid email';
      if (!v('contact_phone')) e.contact_phone = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, systemType]);

  const next = useCallback(() => { if (validate()) setStep((s: number) => s+1); }, [validate]);
  const back = useCallback(() => { setStep((s: number) => s-1); setErrors({}); }, []);

  const submit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true); setSubmitErr('');
    const body = {
      system_type: systemType,
      business_name: v('biz_name'),
      location: v('biz_location'),
      years_operating: v('years_op'),
      team_size: v('team_size'),
      current_system: v('current_system'),
      pain_point: r.pain_point.current?.value.trim() ?? '',
      features_needed: features,
      integrations_needed: integrations,
      user_count: v('user_count'),
      location_count: v('location_count'),
      has_migration: v('has_migration'),
      budget_range: v('budget'),
      timeline: v('timeline'),
      decision_maker: v('decision_maker'),
      post_launch_plan: v('post_launch'),
      has_branding: v('has_branding'),
      dev_experience: v('dev_experience'),
      contact_name: v('contact_name'),
      contact_email: v('contact_email'),
      contact_phone: v('contact_phone'),
      best_time_to_call: v('best_time'),
      notes: r.notes.current?.value.trim() ?? '',
    };
    try {
      const res = await fetch('/api/discovery', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      setSuccess({ name: body.contact_name, biz: body.business_name });
      setDone(true);
    } catch (e) {
      setSubmitErr((e as Error).message || 'Something went wrong. Please try again.');
    } finally { setSubmitting(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validate, systemType, features, integrations]);

  // ─── helpers ──────────────────────────────────────────────────────────────
  const F = (label: string, k: keyof typeof r, type='text', ph='') => (
    <div style={fld}>
      <label style={lbl}>{label}</label>
      <input ref={r[k] as React.RefObject<HTMLInputElement>} type={type} placeholder={ph}
        defaultValue="" onFocus={() => clearE(k)}
        style={errors[k] ? inpE : inp} />
      {errors[k] && <div style={err}>{errors[k]}</div>}
    </div>
  );
  const S = (label: string, k: keyof typeof r, opts: string[], hint='') => (
    <div style={fld}>
      <label style={lbl}>{label}{hint && <span style={{ color:MUT, fontWeight:400 }}> — {hint}</span>}</label>
      <select ref={r[k] as React.RefObject<HTMLSelectElement>} defaultValue=""
        onChange={() => clearE(k)} style={errors[k] ? selE : sel}>
        <option value="">Select...</option>
        {opts.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
      {errors[k] && <div style={err}>{errors[k]}</div>}
    </div>
  );
  const Chips = ({ items, selected, onToggle, cols='repeat(auto-fit,minmax(220px,1fr))' }: { items:string[], selected:string[], onToggle:(v:string)=>void, cols?:string }) => (
    <div style={{ display:'grid', gridTemplateColumns:cols, gap:8 }}>
      {items.map(item => {
        const on = selected.includes(item);
        return (
          <div key={item} onClick={() => onToggle(item)} style={{ padding:'9px 12px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:500, border:`1.5px solid ${on ? G : BOR}`, background: on ? GL : BG, color: on ? G : TEXT, display:'flex', alignItems:'center', gap:7, userSelect:'none' }}>
            <span style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${on ? G : BOR}`, background: on ? G : WHITE, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:10, color:'#fff', fontWeight:700 }}>{on?'✓':''}</span>
            {item}
          </div>
        );
      })}
    </div>
  );

  // ─── success ─────────────────────────────────────────────────────────────
  if (done) return (
    <div style={{ background:BG, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ maxWidth:500, width:'100%', textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:GL, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', fontSize:28, color:G }}>✓</div>
        <h1 style={{ color:TEXT, fontSize:26, fontWeight:800, marginBottom:10 }}>You&rsquo;re on the list!</h1>
        <p style={{ color:MUT, fontSize:15, lineHeight:1.7, marginBottom:28 }}>
          Received, <strong style={{ color:TEXT }}>{success.name}</strong>.<br/>
          Our team will review your submission for <strong style={{ color:TEXT }}>{success.biz}</strong> and reach out within <strong style={{ color:G }}>24–48 hours</strong>.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <Link href="/" style={{ background:G, color:'#fff', borderRadius:10, padding:'11px 22px', textDecoration:'none', fontWeight:700, fontSize:14 }}>Back to Home</Link>
        </div>
      </div>
    </div>
  );

  // ─── layout wrapper ───────────────────────────────────────────────────────
  const stepPct = (step / (STEPS.length-1)) * 100;

  return (
    <div style={{ background:BG, minHeight:'100vh', fontFamily:'system-ui,sans-serif', color:TEXT }}>

      {/* Nav */}
      <nav style={{ background:WHITE, padding:'14px 24px', borderBottom:`1px solid ${BOR}`, display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:9, textDecoration:'none' }}>
          <div style={{ width:32, height:32, background:G, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:15 }}>T</div>
          <span style={{ fontWeight:800, fontSize:17, color:TEXT }}>TYG<span style={{ color:G }}> Services</span></span>
        </Link>
        <span style={{ fontSize:13, color:MUT, fontWeight:500 }}>Free Discovery Call</span>
      </nav>

      <div style={{ maxWidth:700, margin:'0 auto', padding:'36px 20px 60px' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:GL, borderRadius:99, padding:'5px 14px', fontSize:13, color:G, fontWeight:600, marginBottom:14 }}>🇵🇭 Free Consultation</div>
          <h1 style={{ fontSize:'clamp(20px,4vw,28px)', fontWeight:800, margin:'0 0 8px', color:TEXT, lineHeight:1.25 }}>Tell us what you&rsquo;re building</h1>
          <p style={{ color:MUT, fontSize:14, margin:'0 auto', maxWidth:440, lineHeight:1.6 }}>We build digital systems for Philippine businesses. Takes 5 minutes — we review every submission personally.</p>
        </div>

        {/* Progress bar */}
        <div style={{ background:WHITE, borderRadius:14, padding:'14px 20px 10px', marginBottom:18, boxShadow:SH }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
            {STEPS.map((s,i) => (
              <React.Fragment key={s}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:0 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background: i<step ? G : i===step ? GL : BG, border:`2px solid ${i<=step ? G : BOR}`, color: i<step ? '#fff' : i===step ? G : MUT, transition:'all 0.2s' }}>
                    {i<step?'✓':i+1}
                  </div>
                  <span style={{ fontSize:10, color: i===step ? G : MUT, fontWeight: i===step ? 600 : 400, whiteSpace:'nowrap', maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', textAlign:'center' }}>{s}</span>
                </div>
                {i < STEPS.length-1 && <div style={{ flex:1, height:2, margin:'13px 4px 0', background: i<step ? G : BOR, transition:'background 0.3s' }} />}
              </React.Fragment>
            ))}
          </div>
          <div style={{ height:4, background:BOR, borderRadius:99 }}>
            <div style={{ height:'100%', width:`${stepPct}%`, background:G, borderRadius:99, transition:'width 0.4s ease' }} />
          </div>
        </div>

        {/* Card */}
        <div style={{ background:WHITE, borderRadius:16, padding:'26px 26px 22px', boxShadow:SH }}>

          {/* STEP 0 — System Type */}
          {step === 0 && <>
            <h2 style={{ fontSize:16, fontWeight:700, margin:'0 0 6px', color:TEXT }}>What type of system do you need?</h2>
            <p style={{ fontSize:13, color:MUT, margin:'0 0 18px' }}>Select the one that best describes your project.</p>
            {errors.system_type && <div style={{ ...err, marginBottom:12 }}>{errors.system_type}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
              {SYSTEM_TYPES.map(t => {
                const on = systemType === t.id;
                return (
                  <div key={t.id} onClick={() => { setSystemType(t.id); clearE('system_type'); setFeatures([]); }}
                    style={{ padding:'14px 14px 12px', borderRadius:11, cursor:'pointer', border:`1.5px solid ${on ? G : BOR}`, background: on ? GL : WHITE, transition:'all 0.15s', userSelect:'none' }}>
                    <div style={{ fontSize:22, marginBottom:5 }}>{t.icon}</div>
                    <div style={{ fontSize:13, fontWeight:700, color: on ? G : TEXT, marginBottom:3 }}>{t.label}</div>
                    <div style={{ fontSize:11, color:MUT, lineHeight:1.4 }}>{t.desc}</div>
                  </div>
                );
              })}
            </div>
          </>}

          {/* STEP 1 — Business Profile */}
          {step === 1 && <>
            <h2 style={{ fontSize:16, fontWeight:700, margin:'0 0 18px', color:TEXT }}>Tell us about your business</h2>
            {F('Business / Brand Name *','biz_name','text','e.g. Luntian Log Cabin')}
            {F('City / Location *','biz_location','text','e.g. Tagaytay, Cavite')}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {S('Years Operating','years_op',['Less than 1 year','1–2 years','3–5 years','6–10 years','10+ years'])}
              {S('Team Size','team_size',['Just me','2–5 people','6–15 people','16–50 people','50+ people'])}
            </div>
            <div style={fld}>
              <label style={lbl}>Current system / how you manage this today</label>
              <input ref={r.current_system} type="text" placeholder="e.g. Manual, Excel, pen & paper, another software..."
                defaultValue="" style={inp} />
            </div>
            <div style={fld}>
              <label style={lbl}>Biggest pain point right now <span style={{ color:MUT, fontWeight:400 }}>(optional)</span></label>
              <textarea ref={r.pain_point} rows={3} placeholder="What's breaking / what's slowing you down?"
                style={{ ...inp, resize:'vertical', lineHeight:1.6 }} />
            </div>
          </>}

          {/* STEP 2 — Scope */}
          {step === 2 && <>
            <h2 style={{ fontSize:16, fontWeight:700, margin:'0 0 6px', color:TEXT }}>What do you need built?</h2>
            <p style={{ fontSize:13, color:MUT, margin:'0 0 16px' }}>Select everything that applies — don&rsquo;t worry about being exact.</p>

            {systemType && FEATURES[systemType] && <>
              <label style={{ ...lbl, marginBottom:8 }}>Core features needed</label>
              <Chips items={FEATURES[systemType]} selected={features} onToggle={toggleFeat} />
            </>}

            <div style={{ marginTop:20, marginBottom:4 }}>
              <label style={{ ...lbl, marginBottom:8 }}>Integrations / connections needed</label>
              <Chips items={INTEGRATIONS} selected={integrations} onToggle={toggleInt} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:18 }}>
              {S('Number of users / staff','user_count',['1–3','4–10','11–30','31–100','100+'])}
              {S('Number of branches / locations','location_count',['1','2–3','4–10','10+'])}
            </div>
            {S('Existing data to migrate?','has_migration',['No — starting fresh','Yes — small amount (easy)','Yes — large amount (complex)','Not sure yet'], 'old records, products, customers')}
          </>}

          {/* STEP 3 — Qualify */}
          {step === 3 && <>
            <h2 style={{ fontSize:16, fontWeight:700, margin:'0 0 6px', color:TEXT }}>Let&rsquo;s make sure we&rsquo;re a fit</h2>
            <p style={{ fontSize:13, color:MUT, margin:'0 0 18px' }}>Honest answers help us give you an accurate scope & quote.</p>

            {S('Budget range (one-time build) *','budget',[
              'Under ₱15,000','₱15,000–₱30,000','₱30,000–₱80,000',
              '₱80,000–₱200,000','₱200,000+','Monthly retainer preferred','Not sure — need guidance'])}
            {S('Ideal go-live timeline *','timeline',['ASAP (under 2 weeks)','1 month','2–3 months','3–6 months','Flexible — quality over speed'])}
            {S('Who approves the final build?','decision_maker',['Me alone','Me + 1 partner','Committee / board (3+ people)','Will need to consult others','I am the decision maker'],'scope protection')}
            {S('Who maintains the system after launch?','post_launch',['TYG handles everything (retainer)','Our in-house IT / developer','I will manage it myself','Not sure yet'],'maintenance expectation')}
            {S('Do you have branding / design ready?','has_branding',['Yes — logo, colors, full brand guide','Yes — logo only','No — need design included','No — we\'ll use a template'])}
            {S('Have you worked with a developer or agency before?','dev_experience',['Yes — multiple times','Yes — once, mixed experience','No — this is our first time','We had a bad experience before'])}
          </>}

          {/* STEP 4 — Contact */}
          {step === 4 && <>
            <h2 style={{ fontSize:16, fontWeight:700, margin:'0 0 18px', color:TEXT }}>Last step — how do we reach you?</h2>
            {F('Your Name *','contact_name','text','e.g. Maria Santos')}
            {F('Email Address *','contact_email','email','maria@yourbusiness.com')}
            {F('Mobile Number *','contact_phone','tel','09XX-XXX-XXXX')}
            {S('Best time to call','best_time',['Morning (8AM–12PM)','Afternoon (12PM–5PM)','Evening (5PM–8PM)','Anytime is fine'])}
            <div style={fld}>
              <label style={lbl}>Anything else we should know? <span style={{ color:MUT, fontWeight:400 }}>(optional)</span></label>
              <textarea ref={r.notes} rows={3} placeholder="Deadline pressures, existing platforms, specific concerns..."
                style={{ ...inp, resize:'vertical', lineHeight:1.6 }} />
            </div>
            {submitErr && <div style={{ background:ERRBG, border:'1px solid #fca5a5', borderRadius:9, padding:'11px 14px', color:ERR, fontSize:13, marginBottom:14 }}>{submitErr}</div>}
          </>}

          {/* Buttons */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8, gap:10 }}>
            {step > 0
              ? <button onClick={back} style={{ background:'transparent', border:`1.5px solid ${BOR}`, color:MUT, borderRadius:10, padding:'10px 20px', fontSize:14, cursor:'pointer', fontWeight:600 }}>← Back</button>
              : <div/>}
            {step < STEPS.length-1
              ? <button onClick={next} style={{ background:G, color:'#fff', border:'none', borderRadius:10, padding:'11px 26px', fontSize:14, cursor:'pointer', fontWeight:700, boxShadow:'0 2px 8px rgba(22,163,74,0.3)' }}>Continue →</button>
              : <button onClick={submit} disabled={submitting} style={{ background: submitting ? '#86efac' : G, color:'#fff', border:'none', borderRadius:10, padding:'11px 24px', fontSize:14, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight:700, boxShadow:'0 2px 8px rgba(22,163,74,0.3)' }}>
                  {submitting ? 'Sending…' : 'Submit — Book Free Call 🚀'}
                </button>}
          </div>
        </div>

        {/* Trust */}
        <div style={{ display:'flex', justifyContent:'center', gap:20, marginTop:18, flexWrap:'wrap' }}>
          {['🔒 No spam, ever','⚡ Reply within 24–48hrs','🆓 100% Free consultation'].map(t => (
            <span key={t} style={{ fontSize:12, color:MUT }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
