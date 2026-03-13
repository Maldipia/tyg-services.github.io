'use client';
import React from 'react';
import type { CartItem } from '@/types';

interface Props {
  open: boolean; cart: CartItem[]; onClose: () => void;
  onRemove: (i: number) => void; onUpdateQty: (i: number, delta: number) => void;
  onCheckout: () => void; total: number; primaryColor: string;
}

export default function CartDrawer({ open, cart, onClose, onRemove, onUpdateQty, onCheckout, total, primaryColor }: Props) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: '#fff', borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ fontWeight: 700, color: '#111827', fontSize: 18, margin: 0 }}>Your Order</h2>
          <button onClick={onClose} style={{ color: '#9ca3af', fontSize: 26, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>

        {/* Items */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 20px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
              <p style={{ margin: 0 }}>Your cart is empty</p>
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {cart.map((item, idx) => (
                <li key={idx} style={{ padding: '12px 0', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid #f9fafb' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 500, color: '#111827', fontSize: 14, margin: '0 0 2px' }}>{item.itemName}</p>
                    {item.sizeLabel && <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 2px' }}>{item.sizeLabel}</p>}
                    {item.notes && <p style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic', margin: '0 0 2px' }}>{item.notes}</p>}
                    <p style={{ fontWeight: 600, color: '#16a34a', fontSize: 14, margin: 0 }}>
                      ₱{((item.unitPrice + item.addonTotal) * item.qty).toFixed(2)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {[[-1,'−'],[1,'+']].map(([d, label]) => (
                      <button key={String(d)} onClick={() => onUpdateQty(idx, d as number)} style={{
                        width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6',
                        color: '#374151', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{label}</button>
                    ))}
                    <span style={{ width: 20, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>{item.qty}</span>
                    <button onClick={() => onRemove(idx)} style={{ color: '#f87171', fontSize: 22, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>×</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div style={{ padding: '16px 20px 20px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#4b5563', fontWeight: 500 }}>Subtotal</span>
              <span style={{ fontWeight: 700, color: '#111827' }}>₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
            <p style={{ color: '#9ca3af', fontSize: 12, margin: '0 0 12px' }}>VAT and final total shown at checkout</p>
            <button onClick={onCheckout} style={{
              width: '100%', padding: '14px 0', borderRadius: 16, fontWeight: 700,
              color: '#fff', fontSize: 16, border: 'none', cursor: 'pointer',
              background: primaryColor || '#16a34a',
            }}>Place Order</button>
          </div>
        )}
      </div>
    </>
  );
}
