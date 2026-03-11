'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function OrderPage() {
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
  const [pax, setPax] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  // Fetch menu on load
  useEffect(() => {
    if (!tenantSlug) {
      setError('Invalid QR code — missing tenant information.');
      setLoading(false);
      return;
    }

    const url = `/api/menu?tenant=${encodeURIComponent(tenantSlug)}`;
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setMenuData(res.data as MenuData);
        const firstCat = res.data.categories?.[0]?.id ?? null;
        setActiveCategory(firstCat);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load menu');
      })
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  // Cart operations
  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const key = `${item.itemId}-${item.sizeId ?? 'no-size'}`;
      const existing = prev.find(
        (c) => `${c.itemId}-${c.sizeId ?? 'no-size'}` === key && c.notes === item.notes
      );
      if (existing) {
        return prev.map((c) =>
          c === existing ? { ...c, qty: c.qty + item.qty } : c
        );
      }
      return [...prev, item];
    });
    setCartOpen(true);
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateQty = useCallback((index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, i) => (i === index ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  }, []);

  const cartTotal = cart.reduce(
    (sum, item) => sum + (item.unitPrice + item.addonTotal) * item.qty,
    0
  );
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // Place order
  const placeOrder = async () => {
    if (!customerName.trim()) return;
    setSubmitting(true);

    try {
      const payload = {
        tenantSlug,
        tableToken: tableToken ?? undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        pax,
        notes: notes.trim() || undefined,
        items: cart.map((item) => ({
          itemId: item.itemId,
          sizeId: item.sizeId ?? undefined,
          qty: item.qty,
          addonIds: [], // TODO: pass addon IDs when addon selection is implemented
          notes: item.notes,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Oops</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!menuData) return null;

  const { tenant, categories } = menuData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────── */}
      <header
        className="sticky top-0 z-20 shadow-sm"
        style={{ backgroundColor: tenant.primaryColor }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tenant.logoUrl && (
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="h-9 w-9 rounded-full object-cover bg-white"
              />
            )}
            <div>
              <h1 className="text-white font-bold text-lg leading-none">{tenant.name}</h1>
              {tableToken && (
                <p className="text-white/70 text-xs">
                  {categories.length > 0 ? 'Scan & Order' : 'Menu'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        {step === 'menu' && (
          <nav className="flex gap-1 px-4 pb-2 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-white text-green-700'
                    : 'text-white/80 hover:text-white hover:bg-white/20'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* ── Menu Step ──────────────────────────── */}
      {step === 'menu' && (
        <main className="max-w-2xl mx-auto px-4 py-4 pb-32">
          {categories
            .filter((cat) => activeCategory === null || cat.id === activeCategory)
            .map((cat) => (
              <section key={cat.id} className="mb-8">
                <h2 className="text-lg font-bold text-gray-800 mb-3">{cat.name}</h2>
                <div className="space-y-3">
                  {cat.items.map((item) => (
                    <MenuItemCard key={item.id} item={item} onAdd={addToCart} />
                  ))}
                  {cat.items.length === 0 && (
                    <p className="text-gray-400 text-sm">No items in this category</p>
                  )}
                </div>
              </section>
            ))}
        </main>
      )}

      {/* ── Customer Info Step ─────────────────── */}
      {step === 'info' && (
        <CustomerInfoForm
          customerName={customerName}
          customerPhone={customerPhone}
          pax={pax}
          notes={notes}
          onChangeName={setCustomerName}
          onChangePhone={setCustomerPhone}
          onChangePax={setPax}
          onChangeNotes={setNotes}
          onBack={() => setStep('menu')}
          onSubmit={() => placeOrder()}
          submitting={submitting}
          cartTotal={cartTotal}
        />
      )}

      {/* ── Payment Step ───────────────────────── */}
      {step === 'payment' && placedOrder && (
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="bg-white rounded-2xl shadow p-8">
            <div className="text-5xl mb-4">💳</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Order #{placedOrder.orderNumber}
            </h2>
            <p className="text-3xl font-bold text-green-600 mb-6">
              ₱{placedOrder.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-gray-600 mb-8">
              Please pay using your preferred method below and show the confirmation to our staff.
            </p>
            <button
              onClick={() => setStep('confirmation')}
              className="w-full py-3 rounded-xl font-semibold text-white"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              I&apos;ve Paid — Show Confirmation
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmation Step ──────────────────── */}
      {step === 'confirmation' && placedOrder && (
        <OrderConfirmation
          order={placedOrder}
          tenantName={tenant.name}
          receiptFooter={tenant.receiptFooter ?? ''}
        />
      )}

      {/* ── Floating Cart Button ───────────────── */}
      {step === 'menu' && cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-3 text-white px-6 py-3 rounded-2xl shadow-xl font-semibold text-base max-w-sm w-full justify-between"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
              {cartCount}
            </span>
            <span>View Order</span>
            <span>
              ₱{cartTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </button>
        </div>
      )}

      {/* ── Cart Drawer ────────────────────────── */}
      <CartDrawer
        open={cartOpen}
        cart={cart}
        onClose={() => setCartOpen(false)}
        onRemove={removeFromCart}
        onUpdateQty={updateQty}
        onCheckout={() => {
          setCartOpen(false);
          setStep('info');
        }}
        total={cartTotal}
        primaryColor={tenant.primaryColor}
      />
    </div>
  );
}
