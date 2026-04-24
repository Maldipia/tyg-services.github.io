'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Coffee, UtensilsCrossed, ShoppingBag, Cake, Flame, Package } from 'lucide-react';

const INDUSTRIES = [
  { value: 'cafe',          label: 'Café',            icon: '☕', desc: 'Coffee shop, milk tea, etc.' },
  { value: 'restaurant',    label: 'Restaurant',      icon: '🍽️', desc: 'Full-service dining' },
  { value: 'bar',           label: 'Bar / Resto-bar', icon: '🍺', desc: 'Bar, pub, or restobar' },
  { value: 'bakery',        label: 'Bakery',          icon: '🥐', desc: 'Bread, pastries, cakes' },
  { value: 'retail',        label: 'Retail',          icon: '🛍️', desc: 'General merchandise' },
  { value: 'cloud_kitchen', label: 'Cloud Kitchen',   icon: '🔥', desc: 'Delivery-only kitchen' },
  { value: 'other',         label: 'Other',           icon: '📦', desc: 'Something else' },
];

const STEPS = ['Business Type', 'Basic Setup', 'Your Menu', 'You\'re Live!'];

interface Session { tenantSlug?: string | undefined; tenantId?: string | undefined; tenantName?: string | undefined; displayName?: string | undefined; }

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [session, setSession] = useState<Session>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [industry, setIndustry] = useState('cafe');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [menuItems, setMenuItems] = useState<{ name: string; price: string }[]>([
    { name: '', price: '' },
    { name: '', price: '' },
    { name: '', price: '' },
  ]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('tyg_session') || '{}') as Session;
      const t = JSON.parse(localStorage.getItem('tyg_tenant')  || '{}') as { name?: string; slug?: string };
      const merged: Session = {};
      if (s.tenantSlug || t.slug) merged.tenantSlug = s.tenantSlug || t.slug;
      if (s.tenantName || t.name) merged.tenantName = s.tenantName || t.name;
      if (s.tenantId) merged.tenantId = s.tenantId;
      if (s.displayName) merged.displayName = s.displayName;
      setSession(merged);
      setBusinessName(s.tenantName || t.name || '');
    } catch {/**/}
  }, []);

  const tenantSlug = session.tenantSlug ?? '';

  async function saveIndustry() {
    setSaving(true); setError('');
    const r = await fetch('/api/settings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry }),
    });
    const d = await r.json() as { error?: string };
    setSaving(false);
    if (!r.ok) { setError(d.error ?? 'Failed to save'); return false; }
    return true;
  }

  async function saveBusinessInfo() {
    setSaving(true); setError('');
    const r = await fetch('/api/settings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: businessName, address, phone }),
    });
    const d = await r.json() as { error?: string };
    setSaving(false);
    if (!r.ok) { setError(d.error ?? 'Failed to save'); return false; }
    return true;
  }

  async function saveMenuItems() {
    setSaving(true); setError('');
    const items = menuItems.filter(i => i.name.trim() && i.price.trim());
    if (items.length > 0) {
      // Get first category
      const catR = await fetch(`/api/menu/categories?tenantSlug=${tenantSlug}`, { credentials: 'include' });
      const catD = await catR.json() as { data?: { id: string }[] };
      const catId = catD.data?.[0]?.id;
      if (catId) {
        for (const item of items) {
          await fetch('/api/menu/items', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryId: catId, name: item.name.trim(),
              basePrice: parseFloat(item.price) || 0,
            }),
          });
        }
      }
    }
    // Mark onboarding complete
    await fetch('/api/onboarding/complete', { method: 'POST', credentials: 'include' });
    setSaving(false);
    return true;
  }

  async function handleNext() {
    if (step === 0) {
      const ok = await saveIndustry();
      if (ok) setStep(1);
    } else if (step === 1) {
      if (!businessName.trim()) { setError('Business name is required'); return; }
      const ok = await saveBusinessInfo();
      if (ok) setStep(2);
    } else if (step === 2) {
      const ok = await saveMenuItems();
      if (ok) setStep(3);
    } else if (step === 3) {
      router.push('/admin/dashboard');
    }
  }

  const G = '#22c55e';
  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '11px 14px', color: '#e8eaf0', fontSize: 14, outline: 'none', fontFamily: 'inherit',
  };
  const lbl: React.CSSProperties = { display: 'block', color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' };

  return (
    <div style={{ minHeight: '100vh', background: '#0c0f16', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: G, borderRadius: 14, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#000', fontSize: 22 }}>T</div>
          <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 13 }}>TYG POS</div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                  background: i < step ? G : i === step ? '#fff' : 'rgba(255,255,255,0.07)',
                  color: i < step ? '#fff' : i === step ? '#0c0f16' : '#6b7280',
                  border: i === step ? 'none' : 'none',
                }}>
                  {i < step ? <Check size={14}/> : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i === step ? '#e8eaf0' : '#4b5563', whiteSpace: 'nowrap', display: 'none' }}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: G, borderRadius: 4, width: `${(step / (STEPS.length - 1)) * 100}%`, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</div>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 32 }}>

          {/* STEP 0 — Business Type */}
          {step === 0 && (
            <div>
              <h2 style={{ color: '#e8eaf0', fontWeight: 800, fontSize: 22, marginBottom: 6 }}>What kind of business?</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>We'll customize your setup for you.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {INDUSTRIES.map(ind => (
                  <button key={ind.value} onClick={() => setIndustry(ind.value)}
                    style={{ padding: '14px 16px', borderRadius: 14, border: `2px solid ${industry === ind.value ? G : 'rgba(255,255,255,0.08)'}`,
                      background: industry === ind.value ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{ind.icon}</div>
                    <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 13 }}>{ind.label}</div>
                    <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>{ind.desc}</div>
                    {industry === ind.value && <div style={{ color: G, fontSize: 10, fontWeight: 700, marginTop: 4 }}>✓ Selected</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1 — Basic Setup */}
          {step === 1 && (
            <div>
              <h2 style={{ color: '#e8eaf0', fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Set up your business</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>This appears on your receipts and customer menu.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={lbl}>Business Name *</label>
                  <input style={inp} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Kuya Ding Spot"/>
                </div>
                <div>
                  <label style={lbl}>Address</label>
                  <input style={inp} value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, Barangay, City"/>
                </div>
                <div>
                  <label style={lbl}>Contact Number</label>
                  <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxxx" type="tel"/>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — Add Menu Items */}
          {step === 2 && (
            <div>
              <h2 style={{ color: '#e8eaf0', fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Add your first items</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>Add a few menu items to get started. You can always add more later.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {menuItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10 }}>
                    <input style={{ ...inp, flex: 2 }} value={item.name} onChange={e => {
                      const n = [...menuItems]; n[i] = { ...n[i], name: e.target.value }; setMenuItems(n);
                    }} placeholder={`Item ${i + 1} name (e.g. Bulalo)`} />
                    <input style={{ ...inp, flex: 1 }} value={item.price} onChange={e => {
                      const n = [...menuItems]; n[i] = { ...n[i], price: e.target.value }; setMenuItems(n);
                    }} placeholder="Price" type="number" min="0" />
                  </div>
                ))}
                <button onClick={() => setMenuItems(m => [...m, { name: '', price: '' }])}
                  style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>
                  + Add another item
                </button>
              </div>
              <p style={{ color: '#4b5563', fontSize: 12, marginTop: 12 }}>You can skip this and add items later from Menu Management.</p>
            </div>
          )}

          {/* STEP 3 — Done */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 72, height: 72, background: 'rgba(34,197,94,0.15)', borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🎉</div>
              <h2 style={{ color: '#e8eaf0', fontWeight: 800, fontSize: 24, marginBottom: 8 }}>You're all set!</h2>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                Your store is live at:<br/>
                <a href={`/order/${tenantSlug}`} target="_blank" rel="noreferrer"
                  style={{ color: G, fontWeight: 700, fontFamily: 'monospace' }}>
                  tyg-services.com/order/{tenantSlug}
                </a>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24, textAlign: 'left' }}>
                {[
                  { icon: '🖨️', title: 'Print QR codes', desc: 'Go to Tables & QR → copy links' },
                  { icon: '🍽️', title: 'Add more menu items', desc: 'Menu Management → Add Item' },
                  { icon: '💳', title: 'Set up payment QR', desc: 'Settings → Payment QR' },
                  { icon: '👥', title: 'Add staff', desc: 'Settings → Staff Accounts' },
                ].map(tip => (
                  <div key={tip.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{tip.icon}</div>
                    <div style={{ color: '#e8eaf0', fontWeight: 600, fontSize: 12 }}>{tip.title}</div>
                    <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>{tip.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13 }}>{error}</div>}

          {/* Actions */}
          <div style={{ marginTop: 28, display: 'flex', gap: 10, justifyContent: step === 2 ? 'space-between' : 'flex-end' }}>
            {step === 2 && (
              <button onClick={handleNext} disabled={saving}
                style={{ padding: '10px 18px', borderRadius: 12, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
                Skip for now
              </button>
            )}
            <button onClick={handleNext} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 700,
                background: saving ? 'rgba(34,197,94,0.5)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: '#fff', cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving…' : step === 3 ? 'Go to Dashboard' : 'Continue'}
              {!saving && step < 3 && <ChevronRight size={16}/>}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#374151', fontSize: 12, marginTop: 16 }}>
          You can always update these settings later.
        </p>
      </div>
    </div>
  );
}
