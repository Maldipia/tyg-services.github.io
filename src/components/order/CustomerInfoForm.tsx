'use client';
import React from 'react';

type DiscountType = 'PWD' | 'SENIOR' | null;

type OrderType = 'DINE_IN' | 'TAKEOUT';

interface Props {
  customerName: string; customerPhone: string; customerEmail: string;
  pax: number; notes: string;
  discountType: DiscountType;
  orderType: OrderType;
  pwdCount: number; seniorCount: number;
  onChangeName: (v: string) => void; onChangePhone: (v: string) => void;
  onChangeEmail: (v: string) => void; onChangePax: (v: number) => void;
  onChangeNotes: (v: string) => void; onChangeDiscount: (v: DiscountType) => void;
  onChangeOrderType: (v: OrderType) => void;
  onChangePwdCount: (v: number) => void; onChangeSeniorCount: (v: number) => void;
  onBack: () => void; onSubmit: () => void;
  submitting: boolean; cartTotal: number;
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 12,
  padding: '12px 16px', fontSize: 15, color: '#111827', outline: 'none', background: '#fff',
};

const DISCOUNT_PCT = 0.20; // PH law: 20% for PWD & Senior Citizens

export default function CustomerInfoForm({
  customerName, customerPhone, customerEmail, pax, notes, discountType,
  orderType, pwdCount, seniorCount,
  onChangeName, onChangePhone, onChangeEmail, onChangePax, onChangeNotes,
  onChangeDiscount, onChangeOrderType, onChangePwdCount, onChangeSeniorCount,
  onBack, onSubmit, submitting, cartTotal,
}: Props) {
  const canSubmit = customerName.trim().length > 0 && !submitting;
  // Per-pax TRAIN Law: qualifying pax proportion × 20%
  const qualifyingPax = Math.min(pwdCount + seniorCount, pax);
  const discountAmt = (discountType && qualifyingPax > 0)
    ? Math.round((cartTotal / 1.12) / pax * qualifyingPax * DISCOUNT_PCT * 100) / 100
    : 0;
  const finalTotal = cartTotal - discountAmt;

  const lbl = (text: string, opt?: string): React.ReactNode => (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
      {text}{' '}{opt && <span style={{ color: '#9ca3af', fontSize: 12, fontWeight: 400 }}>{opt}</span>}
    </label>
  );

  const DiscBtn = ({ type, emoji, label }: { type: 'PWD' | 'SENIOR'; emoji: string; label: string }) => {
    const active = discountType === type;
    return (
      <button
        onClick={() => onChangeDiscount(active ? null : type)}
        style={{
          flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 600, fontSize: 13,
          cursor: 'pointer', transition: 'all 0.15s',
          background: active ? '#fef3c7' : '#f9fafb',
          color: active ? '#92400e' : '#6b7280',
          border: `1.5px solid ${active ? '#f59e0b' : '#e5e7eb'}`,
        }}
      >
        {emoji} {label}
        {active && <span style={{ marginLeft: 4, fontSize: 11 }}>✓ 20% off</span>}
      </button>
    );
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ color: '#16a34a', fontSize: 14, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}>
        ← Back to Menu
      </button>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Your Information</h2>

      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: 24 }}>

        {/* Name */}
        <div style={{ marginBottom: 18 }}>
          {lbl('Name')}
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
            {([-1,1] as const).map(d => (
              <button key={d} onClick={() => onChangePax(Math.max(1, Math.min(50, pax + d)))} style={{
                width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', border: 'none',
                fontWeight: 700, color: '#374151', fontSize: 18, cursor: 'pointer',
              }}>{d < 0 ? '−' : '+'}</button>
            ))}
            <span style={{ fontSize: 20, fontWeight: 700, color: '#111827', width: 32, textAlign: 'center' }}>{pax}</span>
          </div>
        </div>

        {/* Discount — PWD / Senior */}
        <div style={{ marginBottom: 18 }}>
          {lbl('Discount', '(optional)')}
          <div style={{ display: 'flex', gap: 8 }}>
            <DiscBtn type="PWD" emoji="♿" label="PWD" />
            <DiscBtn type="SENIOR" emoji="👴" label="Senior" />
          </div>
          {discountType && (
            <p style={{ marginTop: 6, fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '6px 10px' }}>
              RA 10754 / RA 9994 — 20% discount applied. Please present your valid ID at the counter.
            </p>
          )}
        </div>

        {/* Order Type — Dine-In / Takeout */}
        <div style={{ marginBottom: 18 }}>
          {lbl('Order Type')}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['DINE_IN', 'TAKEOUT'] as const).map(t => (
              <button key={t} onClick={() => onChangeOrderType(t)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 600, fontSize: 13,
                cursor: 'pointer', transition: 'all 0.15s',
                background: orderType === t ? '#f0fdf4' : '#f9fafb',
                color: orderType === t ? '#16a34a' : '#6b7280',
                border: `1.5px solid ${orderType === t ? '#16a34a' : '#e5e7eb'}`,
              }}>
                {t === 'DINE_IN' ? '🪑 Dine-In' : '🥡 Takeout'}
              </button>
            ))}
          </div>
        </div>

        {/* Per-pax count when discount selected */}
        {discountType && (
          <div style={{ marginBottom: 18, background: '#fffbeb', borderRadius: 12, padding: '12px 16px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 10 }}>
              How many qualifying guests? (out of {pax})
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {discountType === 'PWD' && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#92400e', marginBottom: 6 }}>♿ PWD</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => onChangePwdCount(Math.max(0, pwdCount - 1))} style={{ width:32, height:32, borderRadius:'50%', background:'#fef3c7', border:'none', fontWeight:700, cursor:'pointer' }}>−</button>
                    <span style={{ fontWeight:700, fontSize:18, width:24, textAlign:'center' }}>{pwdCount}</span>
                    <button onClick={() => onChangePwdCount(Math.min(pax, pwdCount + 1))} style={{ width:32, height:32, borderRadius:'50%', background:'#fef3c7', border:'none', fontWeight:700, cursor:'pointer' }}>+</button>
                  </div>
                </div>
              )}
              {discountType === 'SENIOR' && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#92400e', marginBottom: 6 }}>👴 Senior</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => onChangeSeniorCount(Math.max(0, seniorCount - 1))} style={{ width:32, height:32, borderRadius:'50%', background:'#fef3c7', border:'none', fontWeight:700, cursor:'pointer' }}>−</button>
                    <span style={{ fontWeight:700, fontSize:18, width:24, textAlign:'center' }}>{seniorCount}</span>
                    <button onClick={() => onChangeSeniorCount(Math.min(pax, seniorCount + 1))} style={{ width:32, height:32, borderRadius:'50%', background:'#fef3c7', border:'none', fontWeight:700, cursor:'pointer' }}>+</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          {lbl('Order Notes', '(optional)')}
          <textarea value={notes} onChange={e => onChangeNotes(e.target.value)}
            placeholder="Allergies, special requests..." maxLength={500} rows={3}
            style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
        </div>

        {/* Total breakdown */}
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px', marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: discountType ? 6 : 0 }}>
            <span style={{ color: '#4b5563', fontSize: 14 }}>Subtotal</span>
            <span style={{ fontWeight: 600, color: '#374151' }}>₱{cartTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          {discountType && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#b45309', fontSize: 14 }}>
                {discountType === 'PWD' ? '♿ PWD' : '👴 Senior'} Discount (20%)
              </span>
              <span style={{ fontWeight: 600, color: '#b45309' }}>−₱{discountAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: discountType ? '1px dashed #e5e7eb' : 'none', paddingTop: discountType ? 8 : 0, marginTop: discountType ? 4 : 0 }}>
            <span style={{ color: '#4b5563', fontWeight: 600 }}>Total</span>
            <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 18 }}>
              ₱{finalTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>+ VAT included in total</p>

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
