'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShoppingCart, Plus, Minus, X, ChevronRight, Star, Bike } from 'lucide-react';
import { CartItem, cartTotal, cartCount, saveCart, loadCart, generateIdempotencyKey } from '@/lib/online-order/cart';

const BG = '#0f1117'; const CARD = '#161b27'; const BORDER = 'rgba(255,255,255,0.07)';
const TEXT = '#e8eaf0'; const MUTED = '#6b7280'; const GREEN = '#16a34a';
const ACCENT = '#f59e0b';

const SUGAR_LABELS: Record<string, string> = { GROUNDED:'25%', YANI:'50%', COMFORT:'75%', FULL_SWEET:'100%' };
const SUGAR_OPTS = [
  { v:'GROUNDED', l:'Grounded', d:'25% — Light' },
  { v:'YANI', l:'YANI', d:'50% — Signature' },
  { v:'COMFORT', l:'Comfort', d:'75% — Rich' },
  { v:'FULL_SWEET', l:'Full Sweet', d:'100% — Max' },
];

interface MenuSize { id:string; label:string; price:number; is_default:boolean; sort_order:number; }
interface MenuItem { id:string; name:string; description?:string; base_price:number; image_url?:string; status:string; tags:string[]; has_sugar_level:boolean; is_featured:boolean; stock_count:number|null; sizes?:MenuSize[]; }
interface Category { id:string; name:string; emoji?:string; items:MenuItem[]; }
interface Tenant { slug:string; name:string; primaryColor:string; logoUrl?:string; settings:Record<string,unknown>; }

function ItemModal({ item, onClose, onAdd }: { item:MenuItem; onClose:()=>void; onAdd:(c:CartItem)=>void }) {
  const [qty, setQty] = useState(1);
  const [sugar, setSugar] = useState<string>('YANI');
  const [notes, setNotes] = useState('');
  const defaultSize = item.sizes?.find(s => s.is_default) ?? item.sizes?.[0] ?? null;
  const [selectedSize, setSelectedSize] = useState<MenuSize|null>(defaultSize);
  const unitPrice = selectedSize ? selectedSize.price : item.base_price;
  const price = unitPrice * qty;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:CARD, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, maxHeight:'85vh', overflow:'auto', padding:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <h2 style={{ color:TEXT, fontSize:18, fontWeight:800, margin:0 }}>{item.name}</h2>
            <p style={{ color:GREEN, fontWeight:700, fontSize:16, margin:'4px 0 0' }}>₱{item.base_price.toFixed(2)}</p>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, color:TEXT, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X size={16}/>
          </button>
        </div>
        {item.image_url && (
          <div style={{ position:'relative', width:'100%', height:180, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
            <Image src={item.image_url} alt={item.name} fill style={{ objectFit:'cover' }} sizes="480px"/>
          </div>
        )}
        {item.description && <p style={{ color:MUTED, fontSize:13, lineHeight:1.5, marginBottom:16 }}>{item.description}</p>}
        {item.stock_count !== null && item.stock_count <= 5 && item.stock_count > 0 && (
          <div style={{ background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', borderRadius:8, padding:'6px 12px', marginBottom:16, color:'#f97316', fontSize:13, fontWeight:600 }}>
            ⚠️ Only {item.stock_count} left
          </div>
        )}
        {item.sizes && item.sizes.length > 1 && (
          <div style={{ marginBottom:16 }}>
            <p style={{ color:MUTED, fontSize:12, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.04em', marginBottom:10 }}>Size</p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
              {item.sizes.map(size => (
                <button key={size.id} onClick={() => setSelectedSize(size)} style={{
                  padding:'9px 16px', borderRadius:10, cursor:'pointer',
                  border: selectedSize?.id===size.id ? '1.5px solid #16a34a' : `1px solid ${BORDER}`,
                  background: selectedSize?.id===size.id ? 'rgba(22,163,74,0.1)' : 'rgba(255,255,255,0.03)',
                  display:'flex', flexDirection:'column' as const, alignItems:'flex-start',
                }}>
                  <span style={{ fontSize:13, fontWeight:700, color: selectedSize?.id===size.id ? '#4ade80' : TEXT }}>{size.label}</span>
                  <span style={{ fontSize:12, color:GREEN, fontWeight:600 }}>₱{size.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {item.has_sugar_level && (
          <div style={{ marginBottom:16 }}>
            <p style={{ color:MUTED, fontSize:12, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.04em', marginBottom:10 }}>🧋 Sweetness Level</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {SUGAR_OPTS.map(opt => (
                <button key={opt.v} onClick={() => setSugar(opt.v)} style={{
                  padding:'10px 12px', borderRadius:10, cursor:'pointer', textAlign:'left' as const,
                  border: sugar===opt.v ? '1.5px solid #0369a1' : `1px solid ${BORDER}`,
                  background: sugar===opt.v ? 'rgba(3,105,161,0.12)' : 'rgba(255,255,255,0.03)',
                }}>
                  <div style={{ fontSize:13, fontWeight:700, color: sugar===opt.v ? '#7dd3fc' : TEXT }}>{opt.l}</div>
                  <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>{opt.d}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom:16 }}>
          <p style={{ color:MUTED, fontSize:12, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.04em', marginBottom:8 }}>Special Instructions</p>
          <input type="text" placeholder="e.g. Less ice, no straw…" value={notes} onChange={e => setNotes(e.target.value)} maxLength={200}
            style={{ width:'100%', boxSizing:'border-box' as const, background:'rgba(255,255,255,0.05)', border:`1px solid ${BORDER}`, borderRadius:10, padding:'10px 14px', fontSize:13, color:TEXT, outline:'none' }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <button onClick={() => setQty(q => Math.max(1, q-1))} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.08)', border:'none', color:TEXT, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Minus size={14}/></button>
          <span style={{ color:TEXT, fontWeight:700, fontSize:18, flex:1, textAlign:'center' as const }}>{qty}</span>
          <button onClick={() => setQty(q => Math.min(item.stock_count ?? 20, q+1))} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.08)', border:'none', color:TEXT, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Plus size={14}/></button>
        </div>
        <button onClick={() => {
          onAdd({ itemId:item.id, itemName:item.name, unitPrice, qty, addonIds:[], addonTotal:0, sizeId:selectedSize?.id??null, sizeLabel:selectedSize?.label??null, ...(notes?{notes}:{}), ...(item.has_sugar_level?{sugarLevel:sugar}:{}), hasSugarLevel:item.has_sugar_level });
          onClose();
        }} style={{ width:'100%', padding:'14px 0', background:GREEN, color:'#fff', border:'none', borderRadius:12, fontWeight:800, fontSize:15, cursor:'pointer' }}>
          Add {qty}× — ₱{price.toFixed(2)}
        </button>
      </div>
    </div>
  );
}

export default function TenantOrderPage({ params }: { params: { tenant: string } }) {
  const { tenant: tenantSlug } = params;
  const searchParams = useSearchParams();
  const router = useRouter();
  const tableParam = searchParams.get('table');
  const addToOrderId = searchParams.get('addToOrder');

  const [tenant, setTenant] = useState<Tenant|null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string|null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem|null>(null);
  const [tagFilter, setTagFilter] = useState<string|null>(null);
  const [showCart, setShowCart] = useState(false);
  const idKeyRef = useRef(generateIdempotencyKey());

  // All tags across menu
  const allTags = Array.from(new Set(categories.flatMap(c => c.items.flatMap(i => i.tags ?? [])).filter((t): t is string => !!t && t !== 'bestseller'))).slice(0, 8);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/menu?tenant=${encodeURIComponent(tenantSlug)}`);
        const d = await res.json() as { data: { tenant: Tenant; categories: Category[] } | null; error: string | null };
        if (d.error || !d.data) { setError(d.error ?? 'Menu not found'); return; }
        setTenant(d.data.tenant);
        setCategories(d.data.categories);
        if (d.data.categories.length > 0) setActiveCategory(d.data.categories[0]?.id ?? null);
        const saved = loadCart(tenantSlug);
        setCart(saved.length > 0 ? saved : []);
      } catch { setError('Failed to load menu'); }
      finally { setLoading(false); }
    })();
  }, [tenantSlug]);

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const key = `${item.itemId}-${item.sizeId ?? ''}-${item.sugarLevel ?? ''}`;
      const existing = prev.find(c => `${c.itemId}-${c.sizeId ?? ''}-${c.sugarLevel ?? ''}` === key);
      const next = existing
        ? prev.map(c => `${c.itemId}-${c.sizeId ?? ''}-${c.sugarLevel ?? ''}` === key ? { ...c, qty: c.qty + item.qty } : c)
        : [...prev, item];
      saveCart(tenantSlug, next);
      return next;
    });
  }, [tenantSlug]);

  const removeFromCart = useCallback((idx: number) => {
    setCart(prev => { const next = prev.filter((_, i) => i !== idx); saveCart(tenantSlug, next); return next; });
  }, [tenantSlug]);

  const updateQty = useCallback((idx: number, delta: number) => {
    setCart(prev => {
      const next = prev.map((c, i) => i === idx ? { ...c, qty: Math.max(1, c.qty + delta) } : c);
      saveCart(tenantSlug, next);
      return next;
    });
  }, [tenantSlug]);

  const goDelivery = useCallback(() => {
    router.push(`/order/${tenantSlug}/delivery`);
  }, [router, tenantSlug]);

  const goCheckout = useCallback(() => {
    sessionStorage.setItem('tyg_idkey', idKeyRef.current);
    sessionStorage.setItem('tyg_table', tableParam ?? '');
    router.push(`/order/${tenantSlug}/checkout`);
  }, [tenantSlug, tableParam, router]);

  if (loading) return (
    <div style={{ background:BG, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:MUTED, fontSize:14 }}>Loading menu…</div>
    </div>
  );

  if (error || !tenant) return (
    <div style={{ background:BG, minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
      <div style={{ fontSize:40 }}>😕</div>
      <div style={{ color:TEXT, fontWeight:700 }}>Menu unavailable</div>
      <div style={{ color:MUTED, fontSize:13 }}>{error}</div>
    </div>
  );

  const total = cartTotal(cart);
  const count = cartCount(cart);
  const activeCat = categories.find(c => c.id === activeCategory);
  const filteredItems = (activeCat?.items ?? []).filter(item => !tagFilter || item.tags.includes(tagFilter));
  const featuredItems = categories.flatMap(c => c.items).filter(i => i.is_featured && i.status === 'AVAILABLE').slice(0, 5);

  return (
    <div style={{ background:BG, minHeight:'100vh', maxWidth:480, margin:'0 auto', position:'relative', fontFamily:'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg, #0D5A3D 0%, #16a34a 100%)', padding:'20px 16px 16px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {tenant.logoUrl && <img src={tenant.logoUrl} alt="" style={{ width:40, height:40, borderRadius:10, objectFit:'cover', background:'#fff' }}/>}
          <div>
            <h1 style={{ color:'#fff', fontWeight:800, fontSize:18, margin:0 }}>{tenant.name}</h1>
            {tableParam && <p style={{ color:'rgba(255,255,255,0.7)', fontSize:12, margin:'2px 0 0' }}>🪑 Table {tableParam}</p>}
            {addToOrderId && <p style={{ color:'rgba(255,255,255,0.7)', fontSize:12, margin:'2px 0 0' }}>➕ Adding to existing order</p>}
          </div>
        </div>
      </div>

      {/* Featured */}
      {featuredItems.length > 0 && !tagFilter && (
        <div style={{ padding:'14px 16px 0' }}>
          <p style={{ color:ACCENT, fontSize:12, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:10 }}>⭐ Featured</p>
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
            {featuredItems.map(item => (
              <button key={item.id} onClick={() => setSelectedItem(item)} style={{ flexShrink:0, width:130, background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:0, cursor:'pointer', overflow:'hidden', textAlign:'left' as const }}>
                {item.image_url ? (
                  <div style={{ position:'relative', height:80, overflow:'hidden' }}>
                    <Image src={item.image_url} alt={item.name} fill style={{ objectFit:'cover' }} sizes="130px"/>
                  </div>
                ) : <div style={{ height:80, background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>🍽️</div>}
                <div style={{ padding:'8px 10px 10px' }}>
                  <div style={{ color:TEXT, fontSize:12, fontWeight:700, lineHeight:1.3 }}>{item.name}</div>
                  <div style={{ color:GREEN, fontWeight:700, fontSize:13, marginTop:3 }}>₱{Number(item.base_price).toFixed(0)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display:'flex', gap:8, overflowX:'auto', padding:'14px 16px 0', scrollbarWidth:'none', position:'sticky', top:70, zIndex:90, background:BG }}>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setTagFilter(null); }} style={{
            flexShrink:0, padding:'7px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
            background: activeCategory===cat.id ? GREEN : 'rgba(255,255,255,0.07)',
            color: activeCategory===cat.id ? '#fff' : MUTED,
          }}>{cat.emoji ?? ''} {cat.name}</button>
        ))}
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div style={{ display:'flex', gap:6, overflowX:'auto', padding:'10px 16px 0', scrollbarWidth:'none' }}>
          <button onClick={() => setTagFilter(null)} style={{ flexShrink:0, padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: tagFilter===null ? ACCENT : 'rgba(255,255,255,0.07)', color: tagFilter===null ? '#000' : MUTED }}>All</button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setTagFilter(tagFilter===tag ? null : tag)} style={{ flexShrink:0, padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: tagFilter===tag ? ACCENT : 'rgba(255,255,255,0.07)', color: tagFilter===tag ? '#000' : MUTED, textTransform:'capitalize' as const }}>{tag}</button>
          ))}
        </div>
      )}

      {/* Item grid */}
      <div style={{ padding:'14px 16px 120px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign:'center', color:MUTED, padding:40 }}>No items in this category</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filteredItems.map(item => {
              const unavail = item.status === 'SOLD_OUT' || (item.stock_count !== null && item.stock_count <= 0);
              return (
                <button key={item.id} onClick={() => !unavail && setSelectedItem(item)} style={{
                  display:'flex', gap:12, background:CARD, borderRadius:14, border:`1px solid ${BORDER}`,
                  padding:14, cursor: unavail ? 'default' : 'pointer', opacity: unavail ? 0.5 : 1,
                  textAlign:'left' as const, outline: item.is_featured ? `2px solid ${ACCENT}` : 'none',
                }}>
                  {item.image_url && (
                    <div style={{ position:'relative', width:80, height:80, flexShrink:0, borderRadius:10, overflow:'hidden' }}>
                      <Image src={item.image_url} alt={item.name} fill style={{ objectFit:'cover' }} sizes="80px"/>
                    </div>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                      <div style={{ flex:1 }}>
                        <h3 style={{ color:TEXT, fontWeight:700, fontSize:14, margin:0, lineHeight:1.3 }}>{item.name}</h3>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
                          {item.tags.includes('bestseller') && <span style={{ background:'rgba(245,158,11,0.15)', color:ACCENT, fontSize:11, padding:'2px 7px', borderRadius:20 }}>⭐ Bestseller</span>}
                          {item.has_sugar_level && <span style={{ background:'rgba(3,105,161,0.15)', color:'#7dd3fc', fontSize:11, padding:'2px 7px', borderRadius:20 }}>🧋 Sweetness</span>}
                        </div>
                      </div>
                      <div style={{ textAlign:'right' as const, flexShrink:0 }}>
                        {unavail
                          ? <span style={{ fontSize:11, color:'#ef4444', fontWeight:600 }}>Sold Out</span>
                          : <span style={{ color:GREEN, fontWeight:800, fontSize:15 }}>₱{Number(item.base_price).toFixed(0)}</span>
                        }
                      </div>
                    </div>
                    {item.description && (
                      <p style={{ color:MUTED, fontSize:12, marginTop:5, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>{item.description}</p>
                    )}
                  </div>
                  {!unavail && (
                    <div style={{ alignSelf:'center', flexShrink:0 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:GREEN, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Plus size={14} color="#fff"/>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart FAB */}
      {count > 0 && !showCart && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:200, width:'calc(100% - 32px)', maxWidth:448 }}>
          <button onClick={() => setShowCart(true)} style={{
            width:'100%', padding:'14px 20px', background:GREEN, border:'none', borderRadius:16, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 8px 30px rgba(22,163,74,0.4)',
          }}>
            <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:8, padding:'4px 10px', color:'#fff', fontWeight:800, fontSize:13 }}>{count}</div>
            <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>View Order</span>
            <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>₱{total.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:CARD, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, maxHeight:'80vh', overflow:'auto', padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ color:TEXT, fontWeight:800, fontSize:18, margin:0 }}>Your Order</h2>
              <button onClick={() => setShowCart(false)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, color:TEXT, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={16}/></button>
            </div>
            {cart.map((item, idx) => (
              <div key={idx} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:`1px solid ${BORDER}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ color:TEXT, fontWeight:600, fontSize:14 }}>{item.itemName}</div>
                  {item.sizeLabel && <div style={{ color:MUTED, fontSize:12 }}>{item.sizeLabel}</div>}
                  {item.sugarLevel && <div style={{ color:'#7dd3fc', fontSize:11 }}>🧋 {SUGAR_LABELS[item.sugarLevel]}</div>}
                  {item.notes && <div style={{ color:MUTED, fontSize:11, fontStyle:'italic' }}>{item.notes}</div>}
                  <div style={{ color:GREEN, fontWeight:700, fontSize:13, marginTop:3 }}>₱{(item.unitPrice * item.qty).toFixed(2)}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={() => item.qty <= 1 ? removeFromCart(idx) : updateQty(idx, -1)} style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.08)', border:'none', color:TEXT, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Minus size={12}/></button>
                  <span style={{ color:TEXT, fontWeight:700, width:20, textAlign:'center' as const }}>{item.qty}</span>
                  <button onClick={() => updateQty(idx, 1)} style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.08)', border:'none', color:TEXT, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Plus size={12}/></button>
                </div>
                <button onClick={() => removeFromCart(idx)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:4 }}><X size={14}/></button>
              </div>
            ))}
            <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:MUTED, fontSize:14 }}>Subtotal</span>
              <span style={{ color:TEXT, fontWeight:800, fontSize:16 }}>₱{total.toFixed(2)}</span>
            </div>
            <button onClick={() => { setShowCart(false); goCheckout(); }} style={{
              width:'100%', marginTop:16, padding:'14px 0', background:GREEN, border:'none', borderRadius:12, color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>Dine-in / Takeout <ChevronRight size={18}/></button>
            <button onClick={() => { setShowCart(false); goDelivery(); }} style={{
              width:'100%', marginTop:8, padding:'12px 0', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:12, color:'#60a5fa', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}><Bike size={15}/> Delivery Order</button>
          </div>
        </div>
      )}

      {selectedItem && <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} onAdd={item => { addToCart(item); setSelectedItem(null); }}/>}
    </div>
  );
}
