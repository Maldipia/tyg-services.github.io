'use client';
import React from 'react';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { MenuItem, MenuCategory, CartItem } from '@/types';
import MenuItemCard from '@/components/menu/MenuItemCard';
import CartDrawer from '@/components/order/CartDrawer';
import CustomerInfoForm from '@/components/order/CustomerInfoForm';
import OrderConfirmation from '@/components/order/OrderConfirmation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

type Step = 'menu' | 'info' | 'payment' | 'confirmation';

interface PaymentSettings {
  acceptCash:  boolean;
  acceptGcash: boolean;
  acceptMaya:  boolean;
  gcashNumber: string | null;
  gcashName:   string | null;
  mayaNumber:  string | null;
  mayaName:    string | null;
  paymentNote: string | null;
}

interface MenuData {
  tenant: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    accentColor: string;
    receiptFooter: string | null;
    payment: PaymentSettings;
  };
  categories: Array<MenuCategory & { items: MenuItem[] }>;
}

interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
}

function OrderPageInner() {
  const searchParams = useSearchParams();
  const tableToken   = searchParams.get('t');
  const addToOrderId = searchParams.get('addToOrder');
  const tenantSlug = searchParams.get('tenant') ?? '';

  const [step, setStep] = useState<Step>('menu');
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [pax, setPax] = useState(1);
  const [pwdCount, setPwdCount] = useState(0);
  const [seniorCount, setSeniorCount] = useState(0);
  const [orderType, setOrderType] = useState<'DINE_IN'|'TAKEOUT'>('DINE_IN');
  const [notes, setNotes] = useState('');
  const [discountType, setDiscountType] = useState<'PWD' | 'SENIOR' | null>(null);
  const [tableName,  setTableName]      = useState<string | null>(null);
  const [proofFile, setProofFile]       = useState<File | null>(null);
  const [proofMethod, setProofMethod]   = useState<'GCASH' | 'MAYA' | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadDone, setUploadDone]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    if (!tenantSlug) {
      setError('Invalid QR code — missing tenant information.');
      setLoading(false);
      return;
    }
    fetch(`/api/menu?tenant=${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        const raw = res.data as MenuData;
        // Ensure payment field always has defaults (safe against stale API cache)
        setMenuData({
          ...raw,
          tenant: {
            ...raw.tenant,
            payment: raw.tenant.payment ?? {
              acceptCash: true, acceptGcash: false, acceptMaya: false,
              gcashNumber: null, gcashName: null, mayaNumber: null, mayaName: null, paymentNote: null,
            },
          },
        });
        setActiveCategory(res.data.categories?.[0]?.id ?? null);
        // Resolve table name from token if present — use single-token endpoint (no enumeration)
        if (tableToken) {
          fetch(`/api/tables?tenant=${encodeURIComponent(tenantSlug)}&token=${encodeURIComponent(tableToken)}`)
            .then(r => r.json())
            .then((tr: { data?: {name:string} }) => {
              if (tr.data?.name) setTableName(tr.data.name);
            })
            .catch(() => {/**/});
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load menu'))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const key = `${item.itemId}-${item.sizeId ?? 'no-size'}`;
      const existing = prev.find((c) => `${c.itemId}-${c.sizeId ?? 'no-size'}` === key && c.notes === item.notes);
      if (existing) return prev.map((c) => c === existing ? { ...c, qty: c.qty + item.qty } : c);
      return [...prev, item];
    });
    setCartOpen(true);
  }, []);

  const removeFromCart = useCallback((index: number) => setCart((prev) => prev.filter((_, i) => i !== index)), []);
  const updateQty = useCallback((index: number, delta: number) => {
    setCart((prev) => prev.map((item, i) => i === index ? { ...item, qty: item.qty + delta } : item).filter((item) => item.qty > 0));
  }, []);

  const cartTotal = cart.reduce((sum, item) => sum + (item.unitPrice + item.addonTotal) * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const placeOrder = async () => {
    if (!customerName.trim()) return;
    setSubmitting(true);
    try {
      const isAddFlow = !!addToOrderId;
      const endpoint  = isAddFlow ? `/api/orders/${addToOrderId}/items` : '/api/orders';
      const method    = isAddFlow ? 'PATCH' : 'POST';
      const addBody   = { items: cart.map((item) => ({ itemId: item.itemId, sizeId: item.sizeId ?? undefined, qty: item.qty, addonIds: ([] as string[]), notes: item.notes, ...(item.sugarLevel ? { sugarLevel: item.sugarLevel } : {} as Record<string,string>) })) };
      const postBody = {
        tenantSlug,
        tableToken: tableToken ?? undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        pax,
        notes: notes.trim() || undefined,
        discountType: discountType ?? undefined,
        items: cart.map((item) => ({
          itemId: item.itemId,
          sizeId: item.sizeId ?? undefined,
          qty: item.qty,
          addonIds: [] as string[],
          notes: item.notes,
          ...(item.sugarLevel ? { sugarLevel: item.sugarLevel } : {}),
        })),
        pwdCount: discountType === 'PWD' ? pwdCount || 1 : 0,
        seniorCount: discountType === 'SENIOR' ? seniorCount || 1 : 0,
        orderType,
      };
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isAddFlow ? addBody : postBody),
      });
      const data = await res.json() as { data: PlacedOrder | null; error: string | null };
      if (data.error || !data.data) throw new Error(data.error ?? 'Failed to place order');
      setPlacedOrder(data.data);
      setStep('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadProof = async () => {
    if (!placedOrder || !proofFile || !proofMethod) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('tenantSlug', tenantSlug);
      fd.append('orderId', placedOrder.orderId);
      fd.append('method', proofMethod);
      fd.append('proof', proofFile);
      const res = await fetch('/api/payment/proof', { method: 'POST', body: fd });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setUploadDone(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed — please try again');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading menu..." />;

  if (error) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'#f9fafb' }}>
      <div style={{ textAlign:'center', maxWidth:384 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>{error.includes('disabled') ? '🔒' : '😕'}</div>
        <h2 style={{ fontSize:20, fontWeight:700, color:'#1f2937', marginBottom:8 }}>
          {error.includes('disabled') ? 'Ordering is currently closed' : 'Oops'}
        </h2>
        <p style={{ color:'#4b5563' }}>{error}</p>
      </div>
    </div>
  );

  if (!menuData) return null;
  const { tenant, categories } = menuData;

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb' }}>
      {/* ── Header ─────────────────────────────── */}
      <header style={{ position:'sticky', top:0, zIndex:20, boxShadow:'0 1px 4px rgba(0,0,0,0.1)', backgroundColor: tenant.primaryColor }}>
        <div style={{ maxWidth:672, margin:'0 auto', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {tenant.logoUrl && (
              <img src={tenant.logoUrl} alt={tenant.name}
                style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', background:'white' }} />
            )}
            <div>
              <h1 style={{ color:'white', fontWeight:700, fontSize:18, lineHeight:1 }}>{tenant.name}</h1>
              {tableToken && <p style={{ color:'rgba(255,255,255,0.7)', fontSize:12 }}>{tableName ? `🪑 ${tableName}` : (categories.length > 0 ? 'Scan & Order' : 'Menu')}</p>}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        {step === 'menu' && (
          <nav style={{ display:'flex', gap:4, padding:'0 16px 8px', overflowX:'auto' }}>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                style={{
                  flexShrink:0, padding:'6px 16px', borderRadius:99, fontSize:14, fontWeight:500,
                  border:'none', cursor:'pointer',
                  background: activeCategory === cat.id ? 'white' : 'rgba(255,255,255,0.15)',
                  color: activeCategory === cat.id ? '#15803d' : 'rgba(255,255,255,0.85)',
                }}>
                {cat.name}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* ── Menu Step ──────────────────────────── */}
      {step === 'menu' && (
        <main style={{ maxWidth:672, margin:'0 auto', padding:'16px 16px 128px' }}>
          {categories
            .filter((cat) => activeCategory === null || cat.id === activeCategory)
            .map((cat) => (
              <section key={cat.id} style={{ marginBottom:32 }}>
                <h2 style={{ fontSize:18, fontWeight:700, color:'#1f2937', marginBottom:12 }}>{cat.name}</h2>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {cat.items
                  .filter(item => !tagFilter || item.tags.includes(tagFilter))
                  .map((item) => <MenuItemCard key={item.id} item={item} onAdd={addToCart} />)}
                  {cat.items.length === 0 && <p style={{ color:'#9ca3af', fontSize:14 }}>No items in this category</p>}
                </div>
              </section>
            ))}
        </main>
      )}

      {/* ── Customer Info Step ─────────────────── */}
      {step === 'info' && (
        <CustomerInfoForm
          customerName={customerName} customerPhone={customerPhone} customerEmail={customerEmail}
          onChangeEmail={setCustomerEmail} pax={pax} notes={notes}
          discountType={discountType} onChangeDiscount={setDiscountType}
          orderType={orderType} pwdCount={pwdCount} seniorCount={seniorCount}
          onChangeOrderType={setOrderType} onChangePwdCount={setPwdCount} onChangeSeniorCount={setSeniorCount}
          onChangeName={setCustomerName} onChangePhone={setCustomerPhone}
          onChangePax={setPax} onChangeNotes={setNotes}
          onBack={() => setStep('menu')} onSubmit={() => placeOrder()}
          submitting={submitting} cartTotal={cartTotal}
        />
      )}

      {/* ── Payment Step ───────────────────────── */}
      {step === 'payment' && placedOrder && (() => {
        const pay = tenant.payment;
        const col = tenant.primaryColor;
        const hasDigital = pay.acceptGcash || pay.acceptMaya;
        return (
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
            {/* Order summary bar */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', margin: 0 }}>Order #{placedOrder.orderNumber}</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>Please complete payment below</p>
              </div>
              <p style={{ fontWeight: 800, fontSize: 22, color: '#16a34a', margin: 0 }}>
                ₱{placedOrder.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Cash option */}
            {pay.acceptCash && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 24 }}>💵</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Pay at Counter (Cash)</span>
                </div>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>Hand cash to staff when you receive your order. Please have the exact amount ready.</p>
                {!uploadDone && (
                  <button onClick={() => setStep('confirmation')} style={{ width: '100%', padding: '11px 0', borderRadius: 12, fontWeight: 600, fontSize: 14, color: '#fff', border: 'none', cursor: 'pointer', background: '#16a34a' }}>
                    I'll Pay Cash — Show Confirmation
                  </button>
                )}
              </div>
            )}

            {/* GCash */}
            {pay.acceptGcash && pay.gcashNumber && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 24 }}>📱</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>GCash</span>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                  {/* QR from qrserver */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`+63${pay.gcashNumber.replace(/^0/, '')}`)}&bgcolor=ffffff&color=0056a3&qzone=2`}
                    alt="GCash QR" width={100} height={100}
                    style={{ borderRadius: 10, border: '1px solid #e5e7eb', flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>Send to:</p>
                    <p style={{ fontWeight: 800, fontSize: 18, color: '#0056a3', margin: '0 0 2px', letterSpacing: '0.04em' }}>{pay.gcashNumber}</p>
                    {pay.gcashName && <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{pay.gcashName}</p>}
                    <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Reference: {placedOrder.orderNumber}</p>
                  </div>
                </div>
                {/* Proof upload */}
                {!uploadDone ? (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Upload Screenshot</label>
                    <input type="file" accept="image/*" capture="environment"
                      onChange={e => { setProofFile(e.target.files?.[0] ?? null); setProofMethod('GCASH'); }}
                      style={{ fontSize: 13, color: '#374151', width: '100%', marginBottom: 8 }} />
                    {proofFile && proofMethod === 'GCASH' && (
                      <button onClick={() => void uploadProof()} disabled={uploading}
                        style={{ width: '100%', padding: '10px 0', borderRadius: 10, fontWeight: 600, fontSize: 14, color: '#fff', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', background: '#0056a3', opacity: uploading ? 0.7 : 1 }}>
                        {uploading ? 'Sending…' : '📤 Submit GCash Proof'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                    ✅ Proof submitted — staff will verify shortly
                  </div>
                )}
              </div>
            )}

            {/* Maya */}
            {pay.acceptMaya && pay.mayaNumber && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 24 }}>💚</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Maya</span>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`+63${pay.mayaNumber.replace(/^0/, '')}`)}&bgcolor=ffffff&color=00a651&qzone=2`}
                    alt="Maya QR" width={100} height={100}
                    style={{ borderRadius: 10, border: '1px solid #e5e7eb', flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>Send to:</p>
                    <p style={{ fontWeight: 800, fontSize: 18, color: '#00a651', margin: '0 0 2px', letterSpacing: '0.04em' }}>{pay.mayaNumber}</p>
                    {pay.mayaName && <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{pay.mayaName}</p>}
                    <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Reference: {placedOrder.orderNumber}</p>
                  </div>
                </div>
                {!uploadDone ? (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Upload Screenshot</label>
                    <input type="file" accept="image/*" capture="environment"
                      onChange={e => { setProofFile(e.target.files?.[0] ?? null); setProofMethod('MAYA'); }}
                      style={{ fontSize: 13, color: '#374151', width: '100%', marginBottom: 8 }} />
                    {proofFile && proofMethod === 'MAYA' && (
                      <button onClick={() => void uploadProof()} disabled={uploading}
                        style={{ width: '100%', padding: '10px 0', borderRadius: 10, fontWeight: 600, fontSize: 14, color: '#fff', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', background: '#00a651', opacity: uploading ? 0.7 : 1 }}>
                        {uploading ? 'Sending…' : '📤 Submit Maya Proof'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                    ✅ Proof submitted — staff will verify shortly
                  </div>
                )}
              </div>
            )}

            {/* Payment note */}
            {pay.paymentNote && (
              <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 16 }}>{pay.paymentNote}</p>
            )}

            {/* After digital upload, show continue button */}
            {uploadDone && (
              <button onClick={() => setStep('confirmation')} style={{ width: '100%', padding: '13px 0', borderRadius: 14, fontWeight: 700, fontSize: 15, color: '#fff', border: 'none', cursor: 'pointer', background: col, boxShadow: `0 4px 20px ${col}55` }}>
                View My Order Status →
              </button>
            )}

            {/* Skip if no digital methods configured */}
            {!hasDigital && (
              <button onClick={() => setStep('confirmation')} style={{ width: '100%', padding: '13px 0', borderRadius: 14, fontWeight: 700, fontSize: 15, color: '#fff', border: 'none', cursor: 'pointer', background: col }}>
                Done — Show Confirmation
              </button>
            )}
          </div>
        );
      })()}

      {/* ── Confirmation Step ──────────────────── */}
      {step === 'confirmation' && placedOrder && (
        <OrderConfirmation order={placedOrder} tenantName={tenant.name} receiptFooter={tenant.receiptFooter ?? ''} />
      )}

      {/* ── Floating Cart Button ───────────────── */}
      {step === 'menu' && cartCount > 0 && (
        <div style={{ position:'fixed', bottom:24, left:0, right:0, display:'flex', justifyContent:'center', padding:'0 16px', zIndex:30 }}>
          <button onClick={() => setCartOpen(true)}
            style={{
              display:'flex', alignItems:'center', gap:12, color:'white', padding:'12px 24px',
              borderRadius:20, boxShadow:'0 8px 32px rgba(0,0,0,0.2)', fontWeight:600, fontSize:15,
              maxWidth:384, width:'100%', justifyContent:'space-between', border:'none', cursor:'pointer',
              backgroundColor: tenant.primaryColor,
            }}>
            <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:'50%', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 }}>
              {cartCount}
            </span>
            <span>View Order</span>
            <span>₱{cartTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </button>
        </div>
      )}

      {/* ── Cart Drawer ────────────────────────── */}
      <CartDrawer
        open={cartOpen} cart={cart} onClose={() => setCartOpen(false)}
        onRemove={removeFromCart} onUpdateQty={updateQty}
        onCheckout={() => { setCartOpen(false); setStep('info'); }}
        total={cartTotal} primaryColor={tenant.primaryColor}
      />
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f9fafb' }}>
        <div style={{ color:'#16a34a', fontSize:18 }}>Loading menu...</div>
      </div>
    }>
      <OrderPageInner />
    </Suspense>
  );
}
