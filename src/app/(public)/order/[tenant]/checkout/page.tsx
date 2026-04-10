'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Truck, ShoppingBag, UtensilsCrossed, AlertCircle, QrCode, Banknote, CreditCard } from 'lucide-react';
import { CartItem, cartTotal, loadCart, clearCart } from '@/lib/online-order/cart';

const BG = '#0f1117'; const CARD = '#161b27'; const BORDER = 'rgba(255,255,255,0.07)';
const TEXT = '#e8eaf0'; const MUTED = '#6b7280'; const GREEN = '#16a34a';

type OrderType = 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';
type MOP = 'QR_BANK' | 'CASH' | 'CARD';

interface Zone { id: string; name: string; fee: number; min_order: number; }
interface TenantSettings {
  acceptCash?: boolean;
  acceptCard?: boolean;
  acceptGcash?: boolean;
  acceptMaya?: boolean;
  acceptInstaPay?: boolean;
  acceptBDO?: boolean;
  acceptBPI?: boolean;
  acceptUnionBank?: boolean;
  gcashName?: string;
  gcashNumber?: string;
  mayaName?: string;
  mayaNumber?: string;
  bdoAccount?: string;
  bpiAccount?: string;
  unionbankAccount?: string;
  paymentNote?: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px',
  fontSize: 14, color: TEXT, outline: 'none', fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { color: MUTED, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'block' };

export default function CheckoutPage({ params }: { params: { tenant: string } }) {
  const { tenant: tenantSlug } = params;
  const router = useRouter();

  const [cart, setCart]           = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [mop, setMop]             = useState<MOP | null>(null);
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [address, setAddress]     = useState('');
  const [zone, setZone]           = useState('');
  const [zones, setZones]         = useState<Zone[]>([]);
  const [tableName, setTableName] = useState('');
  const [notes, setNotes]         = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [proofFile, setProofFile] = useState<File|null>(null);
  const [proofPreview, setProofPreview] = useState<string|null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(false);

  const [proofUrl, setProofUrl]         = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [tableFromQR, setTableFromQR] = useState('');
  const [settings, setSettings]   = useState<TenantSettings>({});
  const [paymentQrUrl, setPaymentQrUrl] = useState<string|null>(null);

  useEffect(() => {
    const saved = loadCart(tenantSlug);
    if (!saved.length) { router.replace(`/order/${tenantSlug}`); return; }
    setCart(saved);

    const t = sessionStorage.getItem('tyg_table') ?? '';
    if (t) { setTableFromQR(t); setTableName(t); setOrderType('DINE_IN'); }

    // Load zones + tenant settings in parallel
    void Promise.all([
      fetch(`/api/delivery-zones?tenant=${encodeURIComponent(tenantSlug)}`)
        .then(r => r.json()).then((d: { data: Zone[] }) => setZones(d.data ?? [])),
      fetch(`/api/menu?tenant=${encodeURIComponent(tenantSlug)}`)
        .then(r => r.json()).then((d: { data?: { tenant?: { payment?: TenantSettings } } }) => {
          if (d.data?.tenant?.payment) setSettings(d.data.tenant.payment);
          const td = d.data?.tenant as Record<string,unknown>|undefined; if (td?.paymentQrUrl) setPaymentQrUrl(String(td.paymentQrUrl));
        }),
    ]);
  }, [tenantSlug, router]);

  // Which payment methods does this tenant accept?
  const hasQR   = settings.acceptGcash || settings.acceptMaya || settings.acceptInstaPay
                || settings.acceptBDO  || settings.acceptBPI  || settings.acceptUnionBank;
  const hasCash = settings.acceptCash !== false;   // default true
  const hasCard = settings.acceptCard === true;

  // Available MOP options for this tenant
  type MopOption = { id: MOP; label: string; sub: string; icon: React.ReactNode; show: boolean };
  const mopOptions: MopOption[] = ([
    { id: 'QR_BANK' as MOP, label: 'QR / Bank Transfer', sub: 'GCash, Maya, BDO, BPI, UnionBank', icon: <QrCode size={22}/>, show: !!hasQR },
    { id: 'CASH'    as MOP, label: 'Cash',               sub: 'Pay at the counter',                icon: <Banknote size={22}/>, show: hasCash },
    { id: 'CARD'    as MOP, label: 'Card',               sub: 'Card terminal brought to you',       icon: <CreditCard size={22}/>, show: hasCard },
  ] as MopOption[]).filter(o => o.show);

  const selectedZone = zones.find(z => z.name === zone);
  const subtotal     = cartTotal(cart);
  const deliveryFee  = orderType === 'DELIVERY' && selectedZone ? selectedZone.fee : 0;
  const grandTotal   = subtotal + deliveryFee;

  // Map MOP → payment_method string the API/DB stores
  const mopToPaymentMethod = (m: MOP | null): string | null => {
    if (!m) return null;
    if (m === 'QR_BANK') return 'GCASH'; // generic — staff records exact method
    if (m === 'CASH')    return 'CASH';
    if (m === 'CARD')    return 'CARD';
    if (mop === 'QR_BANK' && !proofUploaded) return 'Please upload your payment screenshot before placing the order.';
    return null;
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Name is required';
    if (!mop) return 'Please select a payment method';
    if (orderType === 'DELIVERY') {
      if (!phone.trim()) return 'Mobile number is required for delivery';
      if (!/^(09|\+639)\d{9}$/.test(phone.replace(/\s/g, ''))) return 'Invalid Philippine mobile number (e.g. 09xxxxxxxxx)';
      if (!address.trim()) return 'Delivery address required';
      if (!zone) return 'Please select a delivery zone';
      if (selectedZone && subtotal < selectedZone.min_order) return `Minimum order ₱${selectedZone.min_order} for this zone`;
    }
    if (mop === 'QR_BANK' && !proofUploaded) return 'Please upload your payment screenshot before placing the order.';
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
            itemId: c.itemId,
            sizeId: c.sizeId ?? null,
            addonIds: c.addonIds ?? [],
            qty: c.qty,
            notes: c.notes ?? null,
            sugarLevel: c.sugarLevel ?? null,
          })),
          orderType,
          customerName: name.trim(),
          customerPhone: phone.trim() || null,
          customerEmail: null,
          pax: 1,
          tableName: orderType === 'DINE_IN' ? (tableName || tableFromQR || null) : null,
          deliveryAddress: orderType === 'DELIVERY' ? address.trim() : null,
          deliveryZone: orderType === 'DELIVERY' ? zone : null,
          notes: notes.trim() || null,
          promoCode: promoCode.trim() || null,
          paymentMethod: mopToPaymentMethod(mop),
          idempotencyKey: idKey,
        }),
      });

      const d = await res.json() as { data: { orderId: string; orderNumber: string; totalAmount: number; status: string } | null; error: string | null };

      if (!res.ok || d.error || !d.data) {
        setError(d.error ?? 'Order failed. Please try again.');
        return;
      }

      // Upload payment proof if provided (QR orders)
      if (proofFile && d.data.orderId) {
        setProofUploading(true);
        const fd = new FormData();
        fd.append('file', proofFile);
        fd.append('orderId', d.data.orderId);
        await fetch('/api/upload/payment-proof', { method: 'POST', body: fd });
        setProofUploading(false);
      }

      // Upload payment proof if QR was selected
      if (mop === 'QR_BANK' && proofFile && d.data?.orderId) {
        try {
          const fd = new FormData();
          fd.append('file', proofFile);
          fd.append('orderId', d.data.orderId);
          fd.append('tenantSlug', tenantSlug);
          await fetch('/api/payments/upload-proof', { method: 'POST', body: fd });
        } catch { /* non-blocking — order already created */ }
      }

      clearCart(tenantSlug);
      sessionStorage.removeItem('tyg_idkey');
      sessionStorage.setItem('tyg_last_order', JSON.stringify({ ...d.data, mop }));
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
              <label style={labelStyle}>Name *</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Juan dela Cruz"/>
            </div>
            {orderType === 'DELIVERY' && (
              <div>
                <label style={labelStyle}>Mobile Number *</label>
                <input style={inputStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxxx"/>
              </div>
            )}
          </div>
        </div>

        {/* Dine-in table */}
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

        {/* ── MODE OF PAYMENT ──────────────────────────────────── */}
        <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${mop ? 'rgba(22,163,74,0.4)' : BORDER}`, padding: 16, marginBottom: 14 }}>
          <p style={{ ...labelStyle, marginBottom: 14 }}>Mode of Payment *</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mopOptions.map(opt => (
              <button key={opt.id} onClick={() => setMop(opt.id)} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderRadius: 12, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: mop === opt.id ? 'rgba(22,163,74,0.12)' : 'rgba(255,255,255,0.04)',
                outline: mop === opt.id ? `2px solid ${GREEN}` : `1px solid ${BORDER}`,
              }}>
                {/* Radio dot */}
                <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: mop === opt.id ? `6px solid ${GREEN}` : `2px solid ${MUTED}`,
                  background: 'transparent', transition: 'border 0.15s' }}/>
                {/* Icon */}
                <div style={{ color: mop === opt.id ? GREEN : MUTED, flexShrink: 0 }}>{opt.icon}</div>
                {/* Label */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: mop === opt.id ? TEXT : '#9ca3af', fontWeight: 700, fontSize: 14 }}>{opt.label}</div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{opt.sub}</div>
                </div>
              </button>
            ))}

            {/* QR bank info (shows when QR selected) */}
            {mop === 'QR_BANK' && (
              <div style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
                <div style={{ color: GREEN, fontWeight: 700, marginBottom: 6 }}>📲 Payment instructions</div>
                {settings.gcashName && (
                  <div style={{ color: TEXT, marginBottom: 3 }}>
                    <span style={{ color: MUTED }}>GCash / Maya: </span>
                    <strong>{settings.gcashName}</strong> · {settings.gcashNumber ?? settings.mayaNumber}
                  </div>
                )}
                {settings.bdoAccount && (
                  <div style={{ color: TEXT, marginBottom: 3 }}>
                    <span style={{ color: MUTED }}>BDO: </span>{settings.bdoAccount}
                  </div>
                )}
                {settings.bpiAccount && (
                  <div style={{ color: TEXT, marginBottom: 3 }}>
                    <span style={{ color: MUTED }}>BPI: </span>{settings.bpiAccount}
                  </div>
                )}
                {settings.unionbankAccount && (
                  <div style={{ color: TEXT, marginBottom: 3 }}>
                    <span style={{ color: MUTED }}>UnionBank: </span>{settings.unionbankAccount}
                  </div>
                )}
                {settings.paymentNote && (
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>{settings.paymentNote}</div>
                )}
                {paymentQrUrl && (
                  <div style={{ textAlign:'center', margin:'12px 0 8px' }}>
                    <p style={{ color:GREEN, fontSize:12, fontWeight:700, marginBottom:8 }}>Scan to pay:</p>
                    <img src={paymentQrUrl} alt="Payment QR Code"
                      style={{ width:'100%', maxWidth:220, height:'auto', borderRadius:12, border:'3px solid rgba(22,163,74,0.3)', display:'block', margin:'0 auto' }}/>
                  </div>
                )}
                <div style={{ color: '#fbbf24', fontSize: 12, marginTop: 6 }}>
                  ⚠️ Screenshot your payment and upload it below.
                </div>

                {/* Payment proof upload */}
                <div style={{ marginTop: 12, borderTop: '1px solid rgba(34,197,94,0.15)', paddingTop: 12 }}>
                  <div style={{ ...labelStyle, marginBottom: 8, color: GREEN }}>📎 Upload Payment Screenshot</div>
                  {proofPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img src={proofPreview} alt="Payment proof"
                        style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', border: '2px solid rgba(34,197,94,0.4)' }}/>
                      <button onClick={() => { setProofFile(null); setProofPreview(null); setProofUrl(null); }}
                        style={{ position:'absolute', top:6, right:6, width:28, height:28, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.6)', color:'#fff', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>✕</button>
                      <div style={{ color: GREEN, fontSize: 12, marginTop: 6, fontWeight: 600 }}>✅ Screenshot ready to submit</div>
                    </div>
                  ) : (
                    <label style={{ display:'block', cursor:'pointer' }}>
                      <input type="file" accept="image/*" style={{ display:'none' }}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setProofFile(f);
                          const reader = new FileReader();
                          reader.onload = ev => setProofPreview(ev.target?.result as string);
                          reader.readAsDataURL(f);
                        }}/>
                      <div style={{ border: '2px dashed rgba(34,197,94,0.4)', borderRadius: 10, padding: '20px', textAlign: 'center', background: 'rgba(34,197,94,0.04)' }}>
                        <div style={{ fontSize: 28, marginBottom: 6 }}>📸</div>
                        <div style={{ color: GREEN, fontWeight: 700, fontSize: 14 }}>Tap to upload screenshot</div>
                        <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>JPG, PNG, WebP · Max 5MB</div>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            )}

                {/* Payment proof upload — required for QR/Bank Transfer */}
                {mop === 'QR_BANK' && (
                  <div style={{ marginTop:12, border:`2px dashed ${proofUploaded?'#16a34a':'rgba(22,163,74,0.4)'}`, borderRadius:12, padding:16, textAlign:'center', background:'rgba(22,163,74,0.03)' }}>
                    {proofPreview ? (
                      <div>
                        <img src={proofPreview} alt="Payment proof" style={{ maxWidth:'100%', maxHeight:180, borderRadius:8, marginBottom:10, objectFit:'contain' }}/>
                        <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                          {!proofUploaded ? (
                            <button disabled={proofUploading} onClick={() => setProofUploaded(true)}
                              style={{ padding:'8px 20px', borderRadius:8, background:'#16a34a', border:'none', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                              ✓ Use This Screenshot
                            </button>
                          ) : (
                            <div style={{ color:'#16a34a', fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:6 }}>✅ Screenshot confirmed</div>
                          )}
                          <label style={{ padding:'8px 16px', borderRadius:8, background:'rgba(255,255,255,0.08)', border:`1px solid ${BORDER}`, color:MUTED, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                            Change
                            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const f=e.target.files?.[0]; if(f){setProofFile(f);setProofPreview(URL.createObjectURL(f));setProofUploaded(false);} }}/>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label style={{ cursor:'pointer', display:'block' }}>
                        <div style={{ fontSize:32, marginBottom:8 }}>📸</div>
                        <div style={{ color:TEXT, fontWeight:700, fontSize:15, marginBottom:4 }}>Upload Payment Screenshot</div>
                        <div style={{ color:MUTED, fontSize:12, marginBottom:12 }}>Screenshot of your GCash / Maya / bank transfer confirmation</div>
                        <div style={{ display:'inline-block', padding:'10px 24px', borderRadius:10, background:'rgba(22,163,74,0.15)', border:'1px solid rgba(22,163,74,0.3)', color:'#16a34a', fontWeight:700, fontSize:14 }}>📷 Choose Photo</div>
                        <input type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => { const f=e.target.files?.[0]; if(f){setProofFile(f);setProofPreview(URL.createObjectURL(f));} }}/>
                      </label>
                    )}
                  </div>
                )}

            {mop === 'CASH' && (
              <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
                <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>💵 Pay at the counter</div>
                <div style={{ color: MUTED }}>Staff will come to you or you can pay at the cashier.</div>
              </div>
            )}

            {mop === 'CARD' && (
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
                <div style={{ color: '#818cf8', fontWeight: 700, marginBottom: 4 }}>💳 Card terminal</div>
                <div style={{ color: MUTED }}>A card terminal will be brought to your table.</div>
              </div>
            )}
          </div>
        </div>

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
              <input style={{ ...inputStyle, textTransform: 'uppercase' as const }} value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Enter promo code…"/>
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
            {mop && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: MUTED, fontSize: 13 }}>Payment</span>
                <span style={{ color: GREEN, fontSize: 13, fontWeight: 600 }}>
                  {mop === 'QR_BANK' ? '📲 QR / Bank' : mop === 'CASH' ? '💵 Cash' : '💳 Card'}
                </span>
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
        <button onClick={handleSubmit} disabled={submitting || !mop} style={{
          width: '100%', padding: '15px 0',
          background: !mop ? 'rgba(22,163,74,0.25)' : submitting ? 'rgba(22,163,74,0.5)' : GREEN,
          border: 'none', borderRadius: 12, color: !mop ? 'rgba(255,255,255,0.4)' : '#fff',
          fontWeight: 800, fontSize: 16, cursor: (!mop || submitting) ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {submitting ? 'Placing Order…' : !mop ? 'Select Payment Method' : `Place Order — ₱${grandTotal.toFixed(2)}`}
          {!submitting && mop && <ChevronRight size={18}/>}
        </button>
        {!mop && <p style={{ color: '#ef4444', fontSize: 11, textAlign: 'center', marginTop: 6 }}>Please choose a payment method above</p>}
      </div>
    </div>
  );
}
