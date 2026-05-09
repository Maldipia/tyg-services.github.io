'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MapPin, Phone, User, ChevronRight, Package, Bike } from 'lucide-react';

const BG='#0f1117'; const CARD='#161b27'; const BORDER='rgba(255,255,255,0.07)';
const TEXT='#e8eaf0'; const MUTED='#6b7280'; const GREEN='#16a34a';

interface Zone { id:string; name:string; fee:number; min_order:number; is_active:boolean; }
interface Tenant { name:string; slug:string; settings:Record<string,unknown>; }
interface CartItem { itemId:string; itemName:string; unitPrice:number; qty:number; sizeLabel?:string|null; notes?:string; }

function DeliveryInner() {
  const { tenant: slug } = useParams<{ tenant: string }>();
  const router = useRouter();

  const [step, setStep] = useState<'address'|'review'>('address');
  const [tenant, setTenant] = useState<Tenant|null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone|null>(null);
  const [form, setForm] = useState({ customerName:'', phone:'', address:'', notes:'' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load cart from localStorage
    try {
      const raw = localStorage.getItem(`tyg_cart_${slug}`);
      if (raw) setCart(JSON.parse(raw) as CartItem[]);
    } catch {/**/}

    // Load tenant + zones
    const load = async () => {
      const [mr, zr] = await Promise.all([
        fetch(`/api/menu?tenant=${slug}`),
        fetch(`/api/delivery-zones?tenant=${slug}`),
      ]);
      if (mr.ok) { const d = await mr.json() as { data?:{ tenant?:Tenant } }; if (d.data?.tenant) setTenant(d.data.tenant); }
      if (zr.ok) { const d = await zr.json() as { data?:Zone[] }; setZones((d.data??[]).filter(z=>z.is_active)); }
    };
    void load();
  }, [slug]);

  const subtotal = cart.reduce((s,i) => s + i.unitPrice * i.qty, 0);
  const deliveryFee = selectedZone?.fee ?? 0;
  const total = subtotal + deliveryFee;
  const meetsMinOrder = !selectedZone || subtotal >= selectedZone.min_order;

  const handleSubmit = async () => {
    if (!form.customerName.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Please fill in all required fields'); return;
    }
    if (!selectedZone) { setError('Please select a delivery zone'); return; }
    if (!meetsMinOrder) { setError(`Minimum order for this zone is ₱${selectedZone.min_order}`); return; }
    if (cart.length === 0) { setError('Your cart is empty'); return; }

    setSubmitting(true); setError('');
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: slug,
          orderType: 'DELIVERY',
          customerName: form.customerName.trim(),
          customerPhone: form.phone.trim(),
          deliveryAddress: form.address.trim(),
          deliveryZone: selectedZone.name,
          deliveryFee: selectedZone.fee,
          notes: form.notes.trim() || undefined,
          pax: 1,
          idempotencyKey: `del-${slug}-${Date.now()}`,
          items: cart.map(i => ({ itemId: i.itemId, qty: i.qty, addonIds: [], notes: i.notes })),
        }),
      });
      const d = await r.json() as { data?:{ orderId?:string } };
      if (d.data?.orderId) {
        localStorage.removeItem(`tyg_cart_${slug}`);
        router.push(`/order/${slug}/success?orderId=${d.data.orderId}&type=delivery`);
      } else { setError('Failed to place order. Please try again.'); }
    } catch { setError('Network error. Please try again.'); }
    setSubmitting(false);
  };

  const inp: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,0.05)', border:`1px solid ${BORDER}`, borderRadius:10, padding:'12px 14px', fontSize:14, color:TEXT, outline:'none', fontFamily:'inherit' };
  const lbl: React.CSSProperties = { display:'block', color:MUTED, fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:6 };

  return (
    <div style={{ minHeight:'100vh', background:BG, color:TEXT, fontFamily:"'Inter',system-ui,sans-serif", padding:'0 0 80px' }}>
      {/* Header */}
      <div style={{ background:CARD, borderBottom:`1px solid ${BORDER}`, padding:'16px 20px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10 }}>
        <button onClick={() => router.push(`/order/${slug}`)}
          style={{ background:'none', border:'none', color:MUTED, cursor:'pointer', fontSize:20, lineHeight:1 }}>←</button>
        <div>
          <div style={{ fontWeight:700, fontSize:15, color:TEXT }}>{tenant?.name ?? 'Delivery Order'}</div>
          <div style={{ fontSize:12, color:MUTED, display:'flex', alignItems:'center', gap:4 }}><Bike size={11}/> Delivery</div>
        </div>
      </div>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'20px 16px' }}>
        {/* Cart summary */}
        {cart.length > 0 && (
          <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:MUTED, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Your Order ({cart.length} items)</div>
            {cart.map((item,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:TEXT, marginBottom:6 }}>
                <span>{item.qty}× {item.itemName}{item.sizeLabel ? ` (${item.sizeLabel})` : ''}</span>
                <span style={{ color:GREEN, fontWeight:600 }}>₱{(item.unitPrice * item.qty).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Delivery Zone */}
        <div style={{ marginBottom:20 }}>
          <label style={lbl}><MapPin size={11} style={{ display:'inline', marginRight:4 }}/>Delivery Zone</label>
          {zones.length === 0 ? (
            <div style={{ padding:'12px 14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, color:'#f87171', fontSize:13 }}>
              Delivery not available right now
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {zones.map(z => (
                <button key={z.id} onClick={() => setSelectedZone(z)}
                  style={{ padding:'12px 14px', borderRadius:10, cursor:'pointer', textAlign:'left', background: selectedZone?.id===z.id ? 'rgba(22,163,74,0.08)' : 'rgba(255,255,255,0.03)', border:`1px solid ${selectedZone?.id===z.id ? GREEN : BORDER}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:600, color:TEXT, fontSize:14 }}>{z.name}</div>
                    {z.min_order > 0 && <div style={{ fontSize:11, color:MUTED }}>Min order: ₱{z.min_order}</div>}
                  </div>
                  <div style={{ fontWeight:700, color:GREEN, fontSize:14 }}>{z.fee === 0 ? 'FREE' : `₱${z.fee}`}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:20 }}>
          <div>
            <label style={lbl}><User size={11} style={{ display:'inline', marginRight:4 }}/>Name *</label>
            <input style={inp} placeholder="Your full name" value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}><Phone size={11} style={{ display:'inline', marginRight:4 }}/>Phone *</label>
            <input style={inp} type="tel" placeholder="09xxxxxxxxx" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}><MapPin size={11} style={{ display:'inline', marginRight:4 }}/>Delivery Address *</label>
            <textarea style={{ ...inp, minHeight:80, resize:'vertical' }} placeholder="House/Unit No., Street, Barangay, City"
              value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Order Notes (optional)</label>
            <input style={inp} placeholder="e.g. Leave at gate, no bell" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        {/* Total */}
        {selectedZone && (
          <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
            {[['Subtotal', `₱${subtotal.toFixed(2)}`], ['Delivery Fee', selectedZone.fee===0?'FREE':`₱${selectedZone.fee.toFixed(2)}`], ['Total', `₱${total.toFixed(2)}`]].map(([l,v],i) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize: i===2 ? 15 : 13, fontWeight: i===2 ? 800 : 400, color: i===2 ? TEXT : MUTED, marginBottom: i===2 ? 0 : 6 }}>
                <span>{l}</span><span style={{ color: i===2 ? GREEN : MUTED }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', fontSize:13 }}>{error}</div>}

        {!meetsMinOrder && selectedZone && (
          <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:10, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', color:'#f59e0b', fontSize:13 }}>
            Add ₱{(selectedZone.min_order - subtotal).toFixed(2)} more to meet minimum order
          </div>
        )}

        <button onClick={handleSubmit} disabled={submitting || cart.length===0 || !selectedZone || !meetsMinOrder}
          style={{ width:'100%', padding:'16px', background: (submitting||cart.length===0||!selectedZone||!meetsMinOrder) ? 'rgba(22,163,74,0.3)' : GREEN, color:'#fff', border:'none', borderRadius:14, fontWeight:800, fontSize:16, cursor:(submitting||cart.length===0||!selectedZone||!meetsMinOrder)?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          {submitting ? 'Placing Order…' : <><Package size={18}/>Place Delivery Order — ₱{total.toFixed(2)}</>}
        </button>

        <p style={{ textAlign:'center', color:MUTED, fontSize:12, marginTop:12 }}>
          Payment on delivery. We'll call {form.phone || 'you'} to confirm.
        </p>
      </div>
    </div>
  );
}

export default function DeliveryPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'#0f1117', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}>Loading…</div>}>
      <DeliveryInner />
    </Suspense>
  );
}
