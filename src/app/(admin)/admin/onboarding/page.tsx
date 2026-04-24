'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight } from 'lucide-react';

type MenuItem = { name: string; price: string };
type Session = { tenantSlug: string; tenantName: string };

const INDUSTRIES = [
  { value: 'cafe',          label: 'Café',            icon: '☕', desc: 'Coffee shop, milk tea' },
  { value: 'restaurant',    label: 'Restaurant',      icon: '🍽️', desc: 'Full-service dining' },
  { value: 'bar',           label: 'Bar / Resto-bar', icon: '🍺', desc: 'Bar, pub, or restobar' },
  { value: 'bakery',        label: 'Bakery',          icon: '🥐', desc: 'Bread, pastries, cakes' },
  { value: 'retail',        label: 'Retail',          icon: '🛍️', desc: 'General merchandise' },
  { value: 'cloud_kitchen', label: 'Cloud Kitchen',   icon: '🔥', desc: 'Delivery-only kitchen' },
  { value: 'other',         label: 'Other',           icon: '📦', desc: 'Something else' },
];

const STEPS = ['Business Type', 'Basic Setup', 'Your Menu', 'Done!'];
const EMPTY_ITEM: MenuItem = { name: '', price: '' };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [session, setSession] = useState<Session>({ tenantSlug: '', tenantName: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [industry, setIndustry] = useState('cafe');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([
    { name: '', price: '' },
    { name: '', price: '' },
    { name: '', price: '' },
  ]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('tyg_session') ?? '{}') as Record<string, string>;
      const t = JSON.parse(localStorage.getItem('tyg_tenant') ?? '{}') as Record<string, string>;
      const slug = s['tenantSlug'] ?? t['slug'] ?? '';
      const name = s['tenantName'] ?? t['name'] ?? '';
      setSession({ tenantSlug: slug, tenantName: name });
      setBusinessName(name);
    } catch { /**/ }
  }, []);

  function updateItem(index: number, field: 'name' | 'price', value: string) {
    setMenuItems(prev => {
      const next: MenuItem[] = prev.map(x => ({ name: x.name, price: x.price }));
      if (next[index]) {
        next[index] = { name: field === 'name' ? value : next[index].name, price: field === 'price' ? value : next[index].price };
      }
      return next;
    });
  }

  function addItem() {
    setMenuItems(prev => [...prev, { name: '', price: '' }]);
  }

  async function handleNext() {
    setSaving(true); setError('');
    try {
      if (step === 0) {
        await fetch('/api/settings', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ industry }) });
        setStep(1);
      } else if (step === 1) {
        if (!businessName.trim()) { setError('Business name is required'); setSaving(false); return; }
        await fetch('/api/settings', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: businessName.trim(), address: address.trim(), phone: phone.trim() }) });
        setStep(2);
      } else if (step === 2) {
        const items = menuItems.filter(i => i.name.trim());
        if (items.length > 0) {
          const catR = await fetch(`/api/menu/categories?tenantSlug=${session.tenantSlug}`, { credentials: 'include' });
          const catD = await catR.json() as { data?: { id: string }[] };
          const catId = catD.data?.[0]?.id;
          if (catId) {
            for (const item of items) {
              await fetch('/api/menu/items', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryId: catId, name: item.name.trim(), basePrice: parseFloat(item.price) || 0 }) });
            }
          }
        }
        await fetch('/api/onboarding/complete', { method: 'POST', credentials: 'include' });
        setStep(3);
      } else {
        router.push('/admin/dashboard');
      }
    } catch { setError('Something went wrong. Please try again.'); }
    setSaving(false);
  }

  const G = '#22c55e';
  const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#e8eaf0', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const };
  const lbl: React.CSSProperties = { display: 'block', color: '#9ca3af', fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' as const };

  return (
    <div style={{ minHeight: '100vh', background: '#0c0f16', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 46, height: 46, background: G, borderRadius: 13, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#000', fontSize: 20 }}>T</div>
          <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 13 }}>TYG POS</div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ width: i < step ? 28 : i === step ? 28 : 8, height: 8, borderRadius: 99, background: i < step ? G : i === step ? '#fff' : 'rgba(255,255,255,0.12)', transition: 'all 0.3s' }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center' }}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</div>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 28px 24px' }}>

          {/* Step 0 */}
          {step === 0 && (
            <div>
              <h2 style={{ color: '#e8eaf0', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>What kind of business?</h2>
              <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>We'll customize your setup based on this.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {INDUSTRIES.map(ind => (
                  <button key={ind.value} onClick={() => setIndustry(ind.value)} style={{ padding: '12px 14px', borderRadius: 12, border: `2px solid ${industry === ind.value ? G : 'rgba(255,255,255,0.08)'}`, background: industry === ind.value ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 20, marginBottom: 2 }}>{ind.icon}</div>
                    <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 12 }}>{ind.label}</div>
                    <div style={{ color: '#6b7280', fontSize: 11, marginTop: 1 }}>{ind.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h2 style={{ color: '#e8eaf0', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Set up your business</h2>
              <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Appears on your receipts and customer menu.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={lbl}>Business Name *</label><input style={inp} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Kuya Ding Spot" autoFocus /></div>
                <div><label style={lbl}>Address</label><input style={inp} value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, Barangay, City" /></div>
                <div><label style={lbl}>Contact Number</label><input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxxx" type="tel" /></div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h2 style={{ color: '#e8eaf0', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Add your first items</h2>
              <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Quick-start your menu. Add more anytime.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {menuItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...inp, flex: 2 }} value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder={`Item ${i + 1} (e.g. Bulalo)`} />
                    <input style={{ ...inp, flex: 1, minWidth: 0 }} value={item.price} onChange={e => updateItem(i, 'price', e.target.value)} placeholder="₱0" type="number" min="0" />
                  </div>
                ))}
                <button onClick={addItem} style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}>
                  + Add more
                </button>
              </div>
              <p style={{ color: '#374151', fontSize: 11, marginTop: 10 }}>You can skip — add items from Menu Management later.</p>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ width: 64, height: 64, background: 'rgba(34,197,94,0.12)', borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎉</div>
              <h2 style={{ color: '#e8eaf0', fontWeight: 800, fontSize: 22, marginBottom: 8 }}>You're all set!</h2>
              <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                Your store is live at:<br/>
                <a href={`/order/${session.tenantSlug}`} target="_blank" rel="noreferrer" style={{ color: G, fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
                  tyg-services.com/order/{session.tenantSlug}
                </a>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, textAlign: 'left' }}>
                {[['🖨️','Print QR codes','Tables & QR → copy links'],['🍽️','Add more menu items','Menu Management'],['💳','Set up payment QR','Settings → Payment QR'],['👥','Add staff','Settings → Staff']].map(([icon, title, desc]) => (
                  <div key={title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
                    <div style={{ color: '#e8eaf0', fontWeight: 600, fontSize: 11 }}>{title}</div>
                    <div style={{ color: '#6b7280', fontSize: 10, marginTop: 1 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13 }}>{error}</div>}

          {/* Actions */}
          <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: step === 2 ? 'space-between' : 'flex-end' }}>
            {step === 2 && (
              <button onClick={() => void handleNext()} disabled={saving} style={{ padding: '10px 16px', borderRadius: 12, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
                Skip
              </button>
            )}
            <button onClick={() => void handleNext()} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 14, border: 'none', fontSize: 14, fontWeight: 700, background: saving ? 'rgba(34,197,94,0.5)' : G, color: '#fff', cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving…' : step === 3 ? 'Go to Dashboard' : 'Continue'}
              {!saving && step < 3 && <ChevronRight size={15} />}
            </button>
          </div>
        </div>
        <p style={{ textAlign: 'center', color: '#374151', fontSize: 11, marginTop: 14 }}>You can update everything in Settings later.</p>
      </div>
    </div>
  );
}
