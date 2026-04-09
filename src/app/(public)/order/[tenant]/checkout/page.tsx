'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Truck, ShoppingBag, UtensilsCrossed, AlertCircle } from 'lucide-react';
import { CartItem, cartTotal, loadCart, clearCart } from '@/lib/online-order/cart';

const BG = '#0f1117'; const CARD = '#161b27'; const BORDER = 'rgba(255,255,255,0.07)';
const TEXT = '#e8eaf0'; const MUTED = '#6b7280'; const GREEN = '#16a34a';

type OrderType = 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';

interface Zone { id: string; name: string; fee: number; min_order: number; }

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px',
  fontSize: 14, color: TEXT, outline: 'none', fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { color: MUTED, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'block' };

export default function CheckoutPage({ params }: { params: { tenant: string } }) {
  const { tenant: tenantSlug } = params;
  const router = useRouter();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [zone, setZone] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [tableName, setTableName] = useState('');
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableFromQR, setTableFromQR] = useState('');

  useEffect(() => {
    const saved = loadCart(tenantSlug);
    if (!saved.length) { router.replace(`/order/${tenantSlug}`); return; }
    setCart(saved);

    const t = sessionStorage.getItem('tyg_table') ?? '';
    if (t) { setTableFromQR(t); setTableName(t); setOrderType('DINE_IN'); }

    void fetch(`/api/delivery-zones?tenant=${encodeURIComponent(tenantSlug)}`)
      .then(r => r.json())
      .then((d: { data: Zone[] }) => setZones(d.data ?? []));
  }, [tenantSlug, router]);

  const selectedZone = zones.find(z => z.name === zone);
  const subtotal = cartTotal(cart);
  const deliveryFee = orderType === 'DELIVERY' && selectedZone ? selectedZone.fee : 0;
  const grandTotal = subtotal + deliveryFee;

  const validate = (): string | null => {
    if (!name.trim()) return 'Name is required';
    if (orderType === 'DELIVERY') {
      if (!address.trim()) return 'Delivery address required';
      if (!zone) return 'Please select a delivery zone';
      if (selectedZone && subtotal < selectedZone.min_order) return `Minimum order ₱${selectedZone.min_order} for this zone`;
    }
    if (phone.trim() && !/^(09|\+639)\d{9}$/.test(phone.replace(/\s/g, ''))) return 'Invalid Philippine mobile number';
    return null;
  };

  const handleSubmit = async () => {
    const validErr = validate();
    if (validErr) { setError(validErr); return; }
    setError(null); setSubmitting(true);

    const idKey = sessionStorage.getItem('tyg_idkey') ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          items: cart.map(c => ({
            itemId: c.itemId, itemName: c.itemName,
            sizeId: c.sizeId ?? null, sizeLabel: c.sizeLabel ?? null,
            qty: c.qty, addonTotal: c.addonTotal ?? 0,
            notes: c.notes ?? null, sugarLevel: c.sugarLevel ?? null,
          })),
          orderType,
          customerName: name.trim(),
          customerPhone: phone.trim() || null,
          customerEmail: email.trim() || null,
          pax: 1,
          tableName: orderType === 'DINE_IN' ? (tableName || tableFromQR || null) : null,
          deliveryAddress: orderType === 'DELIVERY' ? address.trim() : null,
          deliveryZone: orderType === 'DELIVERY' ? zone : null,
          notes: notes.trim() || null,
          promoCode: promoCode.trim() || null,
          idempotencyKey: idKey,
        }),
      });

      const d = await res.json() as { data: { orderId: string; orderNumber: string; totalAmount: number; status: string } | null; error: string | null };

      if (!res.ok || d.error || !d.data) {
        setError(d.error ?? 'Order failed. Please try again.');
        return;
      }

      clearCart(tenantSlug);
      sessionStorage.removeItem('tyg_idkey');
      sessionStorage.setItem('tyg_last_order', JSON.stringify(d.data));
      router.push(`/order/${tenantSlug}/success?order=${d.data.orderId}`);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart.length) return null;

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0D5A3D 0%, #16a34a 100%)', padding: '16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={16}/>
        </button>
        <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 18, margin: 0 }}>Checkout</h1>
      </div>

      <div style={{ padding: '16px 16px 120px' }}>
        {/* Order type */}
        <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 14 }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>How would you like your order?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {([
              { t: 'DINE_IN'  as OrderType, icon: UtensilsCrossed, label: 'Dine-In'  },
              { t: 'TAKEOUT'  as OrderType, icon: ShoppingBag,      label: 'Takeout'  },
              { t: 'DELIVERY' as OrderType, icon: Truck,            label: 'Delivery' },
            ]).map(({ t, icon: Icon, label }) => (
              <button key={t} onClick={() => setOrderType(t)} style={{
                padding: '12px 8px', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: orderType === t ? 'rgba(22,163,74,0.15)' : 'rgba(255,255,255,0.04)',
                outline: orderType === t ? `2px solid ${GREEN}` : `1px solid ${BORDER}`,
              }}>
                <Icon size={20} color={orderType === t ? GREEN : MUTED}/>
                <span style={{ fontSize: 12, fontWeight: 700, color: orderType === t ? GREEN : MUTED }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Customer info */}
        <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 14 }}>
          <p style={{ ...labelStyle, marginBottom: 14 }}>Your Details</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Juan dela Cruz"/>
            </div>
            <div>
              <label style={labelStyle}>Mobile Number</label>
              <input style={inputStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxxx"/>
            </div>
            <div>
              <label style={labelStyle}>Email (optional)</label>
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com"/>
            </div>
          </div>
        </div>

        {/* Dine-in fields */}
        {orderType === 'DINE_IN' && (
          <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 14 }}>
            <p style={{ ...labelStyle, marginBottom: 14 }}>Table Information</p>
            <label style={labelStyle}>Table Number or Name</label>
            <input style={inputStyle} value={tableName} onChange={e => setTableName(e.target.value)}
              placeholder={tableFromQR ? `Table ${tableFromQR} (from QR)` : 'e.g. Table 5, Window Seat'}/>
          </div>
        )}

        {/* Delivery fields */}
        {orderType === 'DELIVERY' && (
          <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 14 }}>
            <p style={{ ...labelStyle, marginBottom: 14 }}>Delivery Details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Delivery Address *</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' as const }} value={address} onChange={e => setAddress(e.target.value)} placeholder="House/Unit #, Street, Barangay, City"/>
              </div>
              <div>
                <label style={labelStyle}>Delivery Zone *</label>
                <select style={{ ...inputStyle, appearance: 'none' }} value={zone} onChange={e => setZone(e.target.value)}>
                  <option value="">Select zone…</option>
                  {zones.map(z => <option key={z.id} value={z.name}>{z.name} — ₱{z.fee} fee (min ₱{z.min_order})</option>)}
                </select>
              </div>
              {selectedZone && subtotal < selectedZone.min_order && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', color: '#ef4444', fontSize: 13 }}>
                  ⚠️ Min order ₱{selectedZone.min_order} for this zone (₱{(selectedZone.min_order - subtotal).toFixed(2)} more needed)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes & promo */}
        <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 14 }}>
          <p style={{ ...labelStyle, marginBottom: 14 }}>Additional Details</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Order Notes</label>
              <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special requests…" maxLength={500}/>
            </div>
            <div>
              <label style={labelStyle}>Promo Code</label>
              <input style={{ ...inputStyle, textTransform: 'uppercase' as const }} value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="YANIOPEN20"/>
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 16, marginBottom: 14 }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>Order Summary ({cart.length} item{cart.length !== 1 ? 's' : ''})</p>
          {cart.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
              <div>
                <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>{item.qty}× {item.itemName}</span>
                {item.sizeLabel && <span style={{ color: MUTED, fontSize: 11 }}> ({item.sizeLabel})</span>}
                {item.sugarLevel && <span style={{ color: '#7dd3fc', fontSize: 11 }}> 🧋{item.sugarLevel === 'GROUNDED' ? '25%' : item.sugarLevel === 'YANI' ? '50%' : item.sugarLevel === 'COMFORT' ? '75%' : '100%'}</span>}
              </div>
              <span style={{ color: TEXT, fontSize: 13 }}>₱{(item.unitPrice * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: MUTED, fontSize: 13 }}>Subtotal</span>
              <span style={{ color: TEXT, fontSize: 13 }}>₱{subtotal.toFixed(2)}</span>
            </div>
            {orderType === 'DELIVERY' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: MUTED, fontSize: 13 }}>Delivery fee</span>
                <span style={{ color: TEXT, fontSize: 13 }}>₱{deliveryFee.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
              <span style={{ color: TEXT, fontWeight: 800, fontSize: 15 }}>Total</span>
              <span style={{ color: GREEN, fontWeight: 800, fontSize: 16 }}>₱{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }}/>
            <span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span>
          </div>
        )}
      </div>

      {/* Submit */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '16px', background: BG, borderTop: `1px solid ${BORDER}` }}>
        <button onClick={handleSubmit} disabled={submitting} style={{
          width: '100%', padding: '15px 0', background: submitting ? 'rgba(22,163,74,0.5)' : GREEN,
          border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 16, cursor: submitting ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {submitting ? 'Placing Order…' : `Place Order — ₱${grandTotal.toFixed(2)}`}
          {!submitting && <ChevronRight size={18}/>}
        </button>
        <p style={{ color: MUTED, fontSize: 11, textAlign: 'center', marginTop: 8 }}>Payment at counter · Staff will confirm your order</p>
      </div>
    </div>
  );
}
