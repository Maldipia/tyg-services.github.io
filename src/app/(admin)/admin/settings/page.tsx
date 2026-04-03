'use client';
import React from 'react';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Store, QrCode, Palette, ToggleRight,
  Upload, Save, Check, AlertCircle, Globe, Phone
} from 'lucide-react';

type SettingsTab = 'general' | 'payments' | 'branding' | 'operations';

const TAB_CONFIG: Array<{ id: SettingsTab; label: string; icon: typeof Store; desc: string }> = [
  { id: 'general',    icon: Store,       label: 'General',    desc: 'Business info' },
  { id: 'payments',   icon: QrCode,      label: 'Payment QR', desc: 'GCash, Maya, Bank' },
  { id: 'branding',   icon: Palette,     label: 'Branding',   desc: 'Colors & logo' },
  { id: 'operations', icon: ToggleRight, label: 'Operations', desc: 'Ordering settings' },
];

const PAYMENT_METHODS = [
  { key: 'GCASH',    label: 'GCash',     color: '#007DFC', emoji: '💙' },
  { key: 'MAYA',     label: 'Maya',      color: '#38A169', emoji: '💚' },
  { key: 'BPI',      label: 'BPI',       color: '#CC0000', emoji: '❤️' },
  { key: 'BDO',      label: 'BDO',       color: '#003087', emoji: '🔵' },
  { key: 'UNIONBANK',label: 'UnionBank', color: '#F6911E', emoji: '🟠' },
] as const;

const inputStyle = {
  width: '100%',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '11px 14px',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  color: 'var(--text-muted)',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
};

const sectionStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 16,
};

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (searchParams.get('tab') as SettingsTab) ?? 'general'
  );
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // General
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for dining with us! 🌿');

  // Operations
  const [orderingEnabled, setOrderingEnabled] = useState(true);
  const [requireName, setRequireName] = useState(true);
  const [requirePhone, setRequirePhone] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState('12');
  const [serviceChargeRate, setServiceChargeRate] = useState('0');
  const [avgPrepMins, setAvgPrepMins] = useState('8');
  const [logoUrl, setLogoUrl] = useState('');
  const [pwdDiscount, setPwdDiscount] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  // BIR (PRO tier)
  const [birTin, setBirTin] = useState('');
  const [birAtpSeries, setBirAtpSeries] = useState('');
  const [planTier, setPlanTier] = useState('TRIAL');

  // Branding
  const [primaryColor, setPrimaryColor] = useState('#16a34a');
  const [accentColor, setAccentColor] = useState('#f59e0b');

  // Payment QR uploads (simulated)
  const [qrUploads, setQrUploads] = useState<Record<string, string | null>>({
    GCASH: null, MAYA: null, BPI: null, BDO: null, UNIONBANK: null,
  });

  // Load real settings from API on mount
  useEffect(() => {
    fetch('/api/settings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((d: { data?: { name?: string; slug?: string; phone?: string; address?: string; primary_color?: string; accent_color?: string; plan_tier?: string; bir_tin?: string; bir_atp_series?: string; settings?: Record<string, unknown> } } | null) => {
        if (!d?.data) return;
        const t = d.data;
        if (t.name) setBusinessName(t.name);
        if (t.slug) setSlug(t.slug);
        if (t.phone) setPhone(t.phone);
        if (t.address) setAddress(t.address);
        if (t.primary_color) setPrimaryColor(t.primary_color);
        if (t.accent_color) setAccentColor(t.accent_color);
        if (t.plan_tier) setPlanTier(t.plan_tier);
        if (t.bir_tin) setBirTin(t.bir_tin);
        if (t.bir_atp_series) setBirAtpSeries(t.bir_atp_series);
        const s = t.settings ?? {};
        if (typeof s['orderingEnabled'] === 'boolean') setOrderingEnabled(s['orderingEnabled']);
        if (typeof s['requireCustomerName'] === 'boolean') setRequireName(s['requireCustomerName']);
        if (typeof s['requireCustomerPhone'] === 'boolean') setRequirePhone(s['requireCustomerPhone']);
        if (typeof s['vatEnabled'] === 'boolean') setVatEnabled(s['vatEnabled']);
        if (typeof s['vatRate'] === 'number') setVatRate(String(s['vatRate']));
        if (typeof s['serviceChargeRate'] === 'number') setServiceChargeRate(String((s['serviceChargeRate'] as number) * 100));
        if (typeof s['avgPrepMins'] === 'number') setAvgPrepMins(String(s['avgPrepMins']));
        if (typeof s['pwdSeniorDiscountEnabled'] === 'boolean') setPwdDiscount(s['pwdSeniorDiscountEnabled']);
        if (typeof s['smsEnabled'] === 'boolean') setSmsEnabled(s['smsEnabled']);
        if (typeof s['receiptFooter'] === 'string') setReceiptFooter(s['receiptFooter']);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaved(false); setError(null);
    try {
      const r = await fetch('/api/settings', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: businessName, phone, address,
          primaryColor, accentColor,
          birTin: birTin.trim() || null,
          birAtpSeries: birAtpSeries.trim() || null,
          settings: {
            orderingEnabled, requireCustomerName: requireName,
            requireCustomerPhone: requirePhone, vatEnabled,
            vatRate: parseFloat(vatRate) || 12,
            serviceChargeRate: (parseFloat(serviceChargeRate) || 0) / 100,
            avgPrepMins: parseInt(avgPrepMins) || 8,
            pwdSeniorDiscountEnabled: pwdDiscount, smsEnabled, receiptFooter,
          },
        }),
      });
      const d = await r.json() as { error?: string };
      if (!r.ok) { setError(d.error ?? 'Failed to save'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError('Network error'); }
  };

  const handleQrUpload = (method: string, file: File) => {
    const url = URL.createObjectURL(file);
    setQrUploads(prev => ({ ...prev, [method]: url }));
  };

  return (
    <div style={{ color: 'var(--text)' }}>
      <style>{`
        .settings-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .settings-tabs{display:flex;gap:4px;padding:4px;border-radius:20px;margin-bottom:24px;overflow-x:auto;flex-wrap:nowrap;background:var(--surface);border:1px solid var(--border)}
        .settings-tab-btn{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:500;flex-shrink:0;cursor:pointer;border:none;font-family:inherit}
        @media(max-width:540px){
          .settings-2col{grid-template-columns:1fr!important}
          .settings-tab-btn span{display:none}
          .settings-tab-btn{padding:10px 14px}
          .settings-tabs{gap:2px}
        }
      `}</style>
      {/* Tab nav */}
      <div className="settings-tabs">
        {TAB_CONFIG.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="settings-tab-btn"
            style={{ ...(activeTab===t.id ? { background:'#22c55e', color:'white' } : { background:'transparent', color:'var(--text-muted)' }) }}
          >
            <t.icon size={15} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── General ─────────────────────────────────────── */}
      {activeTab === 'general' && (
        <div style={{ maxWidth: 640 }}>
          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Business Information</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <label style={labelStyle}>Business Name</label>
                <input style={inputStyle} value={businessName} onChange={e => setBusinessName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>
                  URL Slug
                  <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8, textTransform: 'none' }}>
                    tygpos.com/order?tenant=<strong>{slug}</strong>
                  </span>
                </label>
                <div style={{ display:"flex" }}>
                  <div style={{ display:"flex", alignItems:"center", padding:"0 12px", borderRadius:"10px 0 0 10px", background:"var(--surface-3)", border:"1px solid var(--border)", borderRight:"none", color:"var(--text-muted)" }}>
                    <Globe size={13} />
                  </div>
                  <input
                    style={{ ...inputStyle, borderRadius: '0 10px 10px 0' }}
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  />
                </div>
              </div>
              <div className="settings-2col">
                <div>
                  <label style={labelStyle}>Contact Number</label>
                  <div style={{ display:"flex" }}>
                    <div style={{ display:"flex", alignItems:"center", padding:"0 12px", borderRadius:"10px 0 0 10px", background:"var(--surface-3)", border:"1px solid var(--border)", borderRight:"none", color:"var(--text-muted)" }}>
                      <Phone size={13} />
                    </div>
                    <input style={{ ...inputStyle, borderRadius: '0 10px 10px 0' }}
                      value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Address</label>
                  <input style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Receipt Footer Message</label>
                <input style={inputStyle} value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)}
                  placeholder="Thank you for dining with us!" />
                <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                  Appears at the bottom of every receipt
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment QR ──────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ ...sectionStyle, background: 'rgba(34, 197, 94, 0.04)', borderColor: 'rgba(34, 197, 94, 0.2)' }}>
            <div style={{ display:"flex", gap:12 }}>
              <AlertCircle size={16} style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
                Upload your personal QR codes for each payment channel. Customers will scan these to pay.
                Stored securely in <strong style={{ color: 'var(--text)' }}>Supabase Storage</strong> under your tenant folder.
              </p>
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Payment QR Codes</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {PAYMENT_METHODS.map(method => (
                <PaymentQRRow
                  key={method.key}
                  method={method}
                  currentUrl={qrUploads[method.key] ?? null}
                  onUpload={(file) => handleQrUpload(method.key, file)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Branding ────────────────────────────────────── */}
      {activeTab === 'branding' && (
        <div style={{ maxWidth: 640 }}>
          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Brand Colors</h3>
            <div className="settings-2col" style={{ gap:24 }}>
              <div>
                <label style={labelStyle}>Primary Color</label>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
                  Header, buttons, active elements
                </p>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    style={{ width: 48, height: 48, borderRadius: 10, border: '2px solid var(--border)', cursor: 'pointer', background: 'none' }}
                  />
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    placeholder="#16a34a"
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Accent Color</label>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
                  Tags, highlights, secondary buttons
                </p>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    style={{ width: 48, height: 48, borderRadius: 10, border: '2px solid var(--border)', cursor: 'pointer', background: 'none' }}
                  />
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    placeholder="#f59e0b"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div style={{ marginTop:24, padding:16, borderRadius:12, background:"var(--surface-2)" }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preview</p>
              <div style={{ borderRadius:12, padding:16, color:"white", fontSize:13, fontWeight:600, background:primaryColor }}>
                {businessName}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:12 }}>
                <button style={{ padding:"8px 16px", borderRadius:8, color:"white", fontSize:13, fontWeight:600, background:primaryColor, border:"none", cursor:"pointer" }}>Add to Order</button>
                <button style={{ padding:"8px 16px", borderRadius:8, color:"white", fontSize:13, fontWeight:600, background:accentColor, border:"none", cursor:"pointer" }}>Bestseller</button>
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Logo</h3>
            <div
              style={{ border:"2px dashed rgba(255, 255, 255, 0.1)", borderRadius:12, padding:32, textAlign:"center", cursor:"pointer" }}
            >
              <Upload size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Upload logo — PNG or SVG, max 2MB
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>
                Appears in the header of your customer menu
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Operations ──────────────────────────────────── */}
      {activeTab === 'operations' && (
        <div style={{ maxWidth: 640 }}>
          {/* Ordering */}
          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Ordering</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <ToggleRow
                label="Online Ordering Enabled"
                desc="When off, customers see your menu but cannot place orders"
                value={orderingEnabled}
                onChange={setOrderingEnabled}
                highlight={!orderingEnabled}
              />
              <ToggleRow
                label="Require Customer Name"
                desc="Customer must enter their name when placing an order"
                value={requireName}
                onChange={setRequireName}
              />
              <ToggleRow
                label="Require Phone Number"
                desc="Collect customer phone for SMS notifications"
                value={requirePhone}
                onChange={setRequirePhone}
              />
            </div>
          </div>

          {/* Tax */}
          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Tax & Discounts</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <ToggleRow
                label="VAT Enabled"
                desc="Automatically add VAT to all orders"
                value={vatEnabled}
                onChange={setVatEnabled}
              />
              {vatEnabled && (
                <div>
                  <label style={labelStyle}>VAT Rate (%)</label>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <input
                      type="number" min="0" max="100" step="0.01"
                      style={{ ...inputStyle, maxWidth: 120 }}
                      value={vatRate}
                      onChange={e => setVatRate(e.target.value)}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      Standard PH VAT is 12%
                    </span>
                  </div>
                </div>
              )}
              <ToggleRow
                label="PWD / Senior Citizen Discount"
                desc="Enable 20% discount (RA 9994 / RA 7277) — staff verifies ID"
                value={pwdDiscount}
                onChange={setPwdDiscount}
              />
              <div>
                <label style={labelStyle}>Service Charge (%)</label>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <input
                    type="number" min="0" max="50" step="0.5"
                    style={{ ...inputStyle, maxWidth: 120 }}
                    value={serviceChargeRate}
                    onChange={e => setServiceChargeRate(e.target.value)}
                    placeholder="0"
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    % added to dine-in orders (not applied on PWD/Senior)
                  </span>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Average Prep Time (minutes)</label>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <input
                    type="number" min="1" max="60"
                    style={{ ...inputStyle, maxWidth: 120 }}
                    value={avgPrepMins}
                    onChange={e => setAvgPrepMins(e.target.value)}
                    placeholder="8"
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Used to estimate wait time on order tracking page
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Notifications</h3>
            <ToggleRow
              label="SMS Order Notifications"
              desc="Send SMS when order is READY (Semaphore API — BUSINESS+ only)"
              value={smsEnabled}
              onChange={setSmsEnabled}
              badge="BUSINESS+"
            />
          </div>

          {/* BIR Compliance */}
          <div style={{ ...sectionStyle, background: planTier === 'PRO' || planTier === 'ENTERPRISE' ? 'rgba(245,158,11,0.03)' : 'var(--surface)', borderColor: planTier === 'PRO' || planTier === 'ENTERPRISE' ? 'rgba(245,158,11,0.25)' : 'var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>BIR Official Receipts</h3>
              {planTier !== 'PRO' && planTier !== 'ENTERPRISE' ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' }}>PRO</span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' }}>✓ Active</span>
              )}
            </div>
            {planTier !== 'PRO' && planTier !== 'ENTERPRISE' ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                BIR-compliant Official Receipt generation is available on the PRO plan. Upgrade to issue numbered ORs with VAT breakdown for your completed orders.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  Configure your BIR TIN and ATP Series to enable official receipt generation for completed orders.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>BIR TIN</label>
                    <input
                      style={inputStyle}
                      value={birTin}
                      onChange={e => setBirTin(e.target.value)}
                      placeholder="e.g. 123-456-789-000"
                      maxLength={20}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ATP Series</label>
                    <input
                      style={inputStyle}
                      value={birAtpSeries}
                      onChange={e => setBirAtpSeries(e.target.value)}
                      placeholder="e.g. OR-2024"
                      maxLength={30}
                    />
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  OR numbers will be formatted as <code style={{ background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4 }}>{birAtpSeries || 'OR-2024'}-00000001</code> and increment automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save button */}
      <div style={{ position:"fixed", bottom:24, right:24, zIndex:100 }}>
        <button
          onClick={handleSave}
          style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 24px", borderRadius:20, fontWeight:600, cursor:"pointer", boxShadow:"0 8px 32px rgba(0,0,0,0.4)", border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none', background: saved ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: saved ? '#22c55e' : 'white' }}
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ── Payment QR Row ────────────────────────────────────────────
function PaymentQRRow({
  method, currentUrl, onUpload,
}: {
  method: { key: string; label: string; color: string; emoji: string };
  currentUrl: string | null;
  onUpload: (file: File) => void;
}) {
  return (
    <div
      style={{ display:"flex", alignItems:"center", gap:16, padding:16, borderRadius:12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      {/* Method info */}
      <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0 }}>
        <div
          style={{ width:40, height:40, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0, background: `${method.color}20` }}
        >
          {method.emoji}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{method.label}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 1 }}>
            {currentUrl ? '✅ QR uploaded' : 'No QR uploaded yet'}
          </div>
        </div>
      </div>

      {/* Preview */}
      {currentUrl && (
        <div style={{ width:48, height:48, borderRadius:8, overflow:"hidden", flexShrink:0, background:"white", padding:2 }}>
          <img src={currentUrl} alt="QR" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
        </div>
      )}

      {/* Upload */}
      <label style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", flexShrink:0, background: currentUrl ? 'var(--surface-3)' : `${method.color}15`, color: currentUrl ? 'var(--text-muted)' : method.color, border: `1px solid ${currentUrl ? 'var(--border)' : method.color + '30'}` }}>
        <Upload size={13} />
        {currentUrl ? 'Replace' : 'Upload QR'}
        <input
          type="file" accept="image/*" style={{ display:"none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
        />
      </label>
    </div>
  );
}

// ── Toggle Row ────────────────────────────────────────────────
function ToggleRow({
  label, desc, value, onChange, highlight, badge,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div
      style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, padding:16, borderRadius:12, background: highlight ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface-2)', border: `1px solid ${highlight ? 'rgba(239,68,68,0.2)' : 'var(--border)'}` }}
    >
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: highlight ? '#ef4444' : 'var(--text)' }}>
            {label}
          </span>
          {badge && (
            <span style={{ padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:700, background:"rgba(99, 102, 241, 0.15)", color:"#818cf8" }}>
              {badge}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{ width:48, height:24, borderRadius:999, position:"relative", flexShrink:0, cursor:"pointer", border:"none", marginTop:2, background: value ? (highlight ? '#ef4444' : '#22c55e') : 'var(--surface-3)' }}
      >
        <div
          style={{ position:"absolute", top:4, width:16, height:16, borderRadius:"50%", background:"white", boxShadow:"0 1px 4px rgba(0, 0, 0, 0.3)", transition:"left 0.2s", left: value ? 26 : 4 }}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f1117' }}>
        <div style={{ color: '#16a34a', fontSize: 18 }}>Loading settings...</div>
      </div>
    }>
      <SettingsPageInner />
    </Suspense>
  );
}
