'use client';
import React from 'react';

interface Props {
  customerName: string; customerPhone: string; customerEmail: string;
  pax: number; notes: string;
  onChangeName: (v: string) => void; onChangePhone: (v: string) => void;
  onChangeEmail: (v: string) => void; onChangePax: (v: number) => void;
  onChangeNotes: (v: string) => void; onBack: () => void;
  onSubmit: () => void; submitting: boolean; cartTotal: number;
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 12,
  padding: '12px 16px', fontSize: 15, color: '#111827', outline: 'none', background: '#fff',
};

export default function CustomerInfoForm({
  customerName, customerPhone, customerEmail, pax, notes,
  onChangeName, onChangePhone, onChangeEmail, onChangePax, onChangeNotes,
  onBack, onSubmit, submitting, cartTotal,
}: Props) {
  const canSubmit = customerName.trim().length > 0 && !submitting;
  const lbl = (text: string, opt?: string): React.ReactNode => (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
      {text}{' '}{opt && <span style={{ color: '#9ca3af', fontSize: 12, fontWeight: 400 }}>{opt}</span>}
    </label>
  );

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ color: '#16a34a', fontSize: 14, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}>
        ← Back to Menu
      </button>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Your Information</h2>

      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: 24 }}>
        {/* Name */}
        <div style={{ marginBottom: 18 }}>
          {lbl('Name', undefined)}
          <input type="text" value={customerName} onChange={e => onChangeName(e.target.value)}
            placeholder="e.g. Maria Santos" maxLength={100} style={inp} />
        </div>
        {/* Phone */}
        <div style={{ marginBottom: 18 }}>
          {lbl('Mobile Number', '(optional)')}
          <input type="tel" value={customerPhone} onChange={e => onChangePhone(e.target.value)}
            placeholder="09xxxxxxxxx" maxLength={20} style={inp} />
        </div>
        {/* Email */}
        <div style={{ marginBottom: 18 }}>
          {lbl('Email', '(optional — for digital receipt)')}
          <input type="email" value={customerEmail} onChange={e => onChangeEmail(e.target.value)}
            placeholder="you@email.com" maxLength={120} style={inp} />
        </div>
        {/* Pax */}
        <div style={{ marginBottom: 18 }}>
          {lbl('Number of Guests')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {[-1,1].map(d => (
              <button key={d} onClick={() => onChangePax(Math.max(1, Math.min(50, pax + d)))} style={{
                width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', border: 'none',
                fontWeight: 700, color: '#374151', fontSize: 18, cursor: 'pointer',
              }}>{d < 0 ? '−' : '+'}</button>
            ))}
            <span style={{ fontSize: 20, fontWeight: 700, color: '#111827', width: 32, textAlign: 'center' }}>{pax}</span>
          </div>
        </div>
        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          {lbl('Order Notes', '(optional)')}
          <textarea value={notes} onChange={e => onChangeNotes(e.target.value)}
            placeholder="Allergies, special requests..." maxLength={500} rows={3}
            style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
        </div>
        {/* Total */}
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: '#4b5563', fontWeight: 500 }}>Order Total</span>
          <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 18 }}>
            ₱{cartTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>+ VAT included in final total</p>
        <button onClick={onSubmit} disabled={!canSubmit} style={{
          width: '100%', padding: '16px 0', borderRadius: 16, fontWeight: 700, fontSize: 15,
          color: '#fff', border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
          background: canSubmit ? '#16a34a' : '#d1d5db',
        }}>
          {submitting ? 'Placing Order…' : 'Confirm Order →'}
        </button>
      </div>
    </div>
  );
}
