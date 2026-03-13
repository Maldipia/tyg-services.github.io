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

interface MenuData {
  tenant: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    accentColor: string;
    receiptFooter: string | null;
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
  const tableToken = searchParams.get('t');
  const tenantSlug = searchParams.get('tenant') ?? '';

  const [step, setStep] = useState<Step>('menu');
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [pax, setPax] = useState(1);
  const [notes, setNotes] = useState('');
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
        setMenuData(res.data as MenuData);
        setActiveCategory(res.data.categories?.[0]?.id ?? null);
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
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          tableToken: tableToken ?? undefined,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          pax,
          notes: notes.trim() || undefined,
          items: cart.map((item) => ({ itemId: item.itemId, sizeId: item.sizeId ?? undefined, qty: item.qty, addonIds: [], notes: item.notes })),
        }),
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

  if (loading) return <LoadingSpinner message="Loading menu..." />;

  if (error) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'#f9fafb' }}>
      <div style={{ textAlign:'center', maxWidth:384 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>😕</div>
        <h2 style={{ fontSize:20, fontWeight:700, color:'#1f2937', marginBottom:8 }}>Oops</h2>
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
              {tableToken && <p style={{ color:'rgba(255,255,255,0.7)', fontSize:12 }}>{categories.length > 0 ? 'Scan & Order' : 'Menu'}</p>}
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
                  {cat.items.map((item) => <MenuItemCard key={item.id} item={item} onAdd={addToCart} />)}
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
          onChangeName={setCustomerName} onChangePhone={setCustomerPhone}
          onChangePax={setPax} onChangeNotes={setNotes}
          onBack={() => setStep('menu')} onSubmit={() => placeOrder()}
          submitting={submitting} cartTotal={cartTotal}
        />
      )}

      {/* ── Payment Step ───────────────────────── */}
      {step === 'payment' && placedOrder && (
        <div style={{ maxWidth:672, margin:'0 auto', padding:'32px 16px', textAlign:'center' }}>
          <div style={{ background:'white', borderRadius:20, boxShadow:'0 4px 20px rgba(0,0,0,0.08)', padding:32 }}>
            <div style={{ fontSize:48, marginBottom:16 }}>💳</div>
            <h2 style={{ fontSize:24, fontWeight:700, color:'#1f2937', marginBottom:8 }}>
              Order #{placedOrder.orderNumber}
            </h2>
            <p style={{ fontSize:30, fontWeight:700, color:'#16a34a', marginBottom:24 }}>
              ₱{placedOrder.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
            <p style={{ color:'#6b7280', marginBottom:32 }}>
              Please pay using your preferred method below and show the confirmation to our staff.
            </p>
            <button onClick={() => setStep('confirmation')}
              style={{ width:'100%', padding:'12px 0', borderRadius:12, fontWeight:600, color:'white', border:'none', cursor:'pointer', fontSize:15, backgroundColor: tenant.primaryColor }}>
              I&apos;ve Paid — Show Confirmation
            </button>
          </div>
        </div>
      )}

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
