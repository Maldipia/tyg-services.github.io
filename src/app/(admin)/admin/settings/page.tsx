'use client';

import { useState, useEffect } from 'react';
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

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (searchParams.get('tab') as SettingsTab) ?? 'general'
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // General
  const [businessName, setBusinessName] = useState('YANI Garden Café');
  const [slug, setSlug] = useState('yani');
  const [phone, setPhone] = useState('09171234567');
  const [address, setAddress] = useState('Amadeo, Cavite');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for dining with us! 🌿');

  // Operations
  const [orderingEnabled, setOrderingEnabled] = useState(true);
  const [requireName, setRequireName] = useState(true);
  const [requirePhone, setRequirePhone] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState('12');
  const [pwdDiscount, setPwdDiscount] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  // Branding
  const [primaryColor, setPrimaryColor] = useState('#16a34a');
  const [accentColor, setAccentColor] = useState('#f59e0b');

  // Payment QR uploads (simulated)
  const [qrUploads, setQrUploads] = useState<Record<string, string | null>>({
    GCASH: null, MAYA: null, BPI: null, BDO: null, UNIONBANK: null,
  });

  const handleSave = async () => {
    setSaved(false);
    // In production: PATCH /api/admin/settings
    await new Promise(r => setTimeout(r, 700));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleQrUpload = (method: string, file: File) => {
    const url = URL.createObjectURL(file);
    setQrUploads(prev => ({ ...prev, [method]: url }));
  };

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Tab nav */}
      <div
        className="flex gap-1 p-1 rounded-2xl mb-6 overflow-x-auto"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {TAB_CONFIG.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0"
            style={activeTab === t.id
              ? { background: '#22c55e', color: 'white' }
              : { color: 'var(--text-muted)' }
            }
          >
            <t.icon size={15} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── General ─────────────────────────────────────── */}
      {activeTab === 'general' && (
        <div className="space-y-4 max-w-2xl">
          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Business Information</h3>
            <div className="space-y-4">
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
                <div className="flex">
                  <div className="flex items-center px-3 rounded-l-xl text-sm"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRight: 'none', color: 'var(--text-muted)' }}>
                    <Globe size={13} />
                  </div>
                  <input
                    style={{ ...inputStyle, borderRadius: '0 10px 10px 0' }}
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Contact Number</label>
                  <div className="flex">
                    <div className="flex items-center px-3 rounded-l-xl text-sm"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRight: 'none', color: 'var(--text-muted)' }}>
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
        <div className="space-y-4 max-w-2xl">
          <div style={{ ...sectionStyle, background: 'rgba(34,197,94,0.04)', borderColor: 'rgba(34,197,94,0.2)' }}>
            <div className="flex gap-3">
              <AlertCircle size={16} style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
                Upload your personal QR codes for each payment channel. Customers will scan these to pay.
                Stored securely in <strong style={{ color: 'var(--text)' }}>Supabase Storage</strong> under your tenant folder.
              </p>
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Payment QR Codes</h3>
            <div className="grid gap-4">
              {PAYMENT_METHODS.map(method => (
                <PaymentQRRow
                  key={method.key}
                  method={method}
                  currentUrl={qrUploads[method.key]}
                  onUpload={(file) => handleQrUpload(method.key, file)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Branding ────────────────────────────────────── */}
      {activeTab === 'branding' && (
        <div className="space-y-4 max-w-2xl">
          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Brand Colors</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label style={labelStyle}>Primary Color</label>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
                  Header, buttons, active elements
                </p>
                <div className="flex items-center gap-3">
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
                <div className="flex items-center gap-3">
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
            <div className="mt-6 p-4 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preview</p>
              <div
                className="rounded-xl p-4 text-white text-sm font-semibold"
                style={{ background: primaryColor }}
              >
                {businessName}
              </div>
              <div className="flex gap-2 mt-3">
                <button className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                  style={{ background: primaryColor }}>Add to Order</button>
                <button className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                  style={{ background: accentColor }}>Bestseller</button>
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Logo</h3>
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
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
        <div className="space-y-4 max-w-2xl">
          {/* Ordering */}
          <div style={sectionStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Ordering</h3>
            <div className="space-y-4">
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
            <div className="space-y-4">
              <ToggleRow
                label="VAT Enabled"
                desc="Automatically add VAT to all orders"
                value={vatEnabled}
                onChange={setVatEnabled}
              />
              {vatEnabled && (
                <div>
                  <label style={labelStyle}>VAT Rate (%)</label>
                  <div className="flex items-center gap-3">
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
        </div>
      )}

      {/* Save button */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold shadow-2xl transition-all"
          style={{
            background: saved ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: saved ? '#22c55e' : 'white',
            border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none',
          }}
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
      className="flex items-center gap-4 p-4 rounded-xl"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      {/* Method info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${method.color}20` }}
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
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'white', padding: 2 }}>
          <img src={currentUrl} alt="QR" className="w-full h-full object-contain" />
        </div>
      )}

      {/* Upload */}
      <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all flex-shrink-0"
        style={{
          background: currentUrl ? 'var(--surface-3)' : `${method.color}15`,
          color: currentUrl ? 'var(--text-muted)' : method.color,
          border: `1px solid ${currentUrl ? 'var(--border)' : method.color + '30'}`,
        }}>
        <Upload size={13} />
        {currentUrl ? 'Replace' : 'Upload QR'}
        <input
          type="file" accept="image/*" className="hidden"
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
      className="flex items-start justify-between gap-4 p-4 rounded-xl transition-all"
      style={{
        background: highlight ? 'rgba(239,68,68,0.05)' : 'var(--surface-2)',
        border: `1px solid ${highlight ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 600, fontSize: 13, color: highlight ? '#ef4444' : 'var(--text)' }}>
            {label}
          </span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              {badge}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="w-12 h-6 rounded-full relative flex-shrink-0 transition-all"
        style={{ background: value ? (highlight ? '#ef4444' : '#22c55e') : 'var(--surface-3)', marginTop: 2 }}
      >
        <div
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
          style={{ left: value ? 26 : 4 }}
        />
      </button>
    </div>
  );
}
