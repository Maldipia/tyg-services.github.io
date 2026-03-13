'use client';
import React from 'react';

import { useState, useEffect } from 'react';
import { Printer, QrCode, Clock, ChefHat, CreditCard, AlertTriangle, CheckCircle, Users, LogIn } from 'lucide-react';

type Section = 'login' | 'orders' | 'kitchen' | 'payment' | 'tips';

const SECTIONS = [
  { id: 'login' as Section, label: 'Logging In', icon: LogIn, color: '#6366f1' },
  { id: 'orders' as Section, label: 'Managing Orders', icon: Clock, color: '#22c55e' },
  { id: 'kitchen' as Section, label: 'Kitchen Display', icon: ChefHat, color: '#f59e0b' },
  { id: 'payment' as Section, label: 'Payments', icon: CreditCard, color: '#ec4899' },
  { id: 'tips' as Section, label: 'Tips & Shortcuts', icon: CheckCircle, color: '#14b8a6' },
];

const ROLE_TIPS = [
  { role: 'Cashier 💳', color: '#6366f1', bg: 'rgba(99,102,241,0.1)', tasks: [
    'Verify payment proofs from customers',
    'Mark orders as CONFIRMED after payment',
    'Handle customer questions about orders',
    'Print receipts when needed',
  ]},
  { role: 'Kitchen Staff 👨‍🍳', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', tasks: [
    'Watch Kitchen Display Screen (KDS)',
    'Tap order to mark as PREPARING',
    'Tap again when food is READY',
    'Never close the KDS browser tab',
  ]},
  { role: 'Owner / Admin 🌟', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', tasks: [
    'Full access to all features',
    'Can add/edit/delete menu items',
    'Can manage staff and tables',
    'Can view analytics and reports',
  ]},
];

function makeSteps(slug: string, tenantName: string): Record<Section, { title: string; steps: { num: number; title: string; desc: string; tip?: string }[] }> {
  return {
    login: {
      title: 'How to Log In',
      steps: [
        { num: 1, title: 'Open the App', desc: 'Go to www.tyg-services.com on your phone or tablet. Use Chrome or Safari for best results.' },
        { num: 2, title: 'Enter Your Display Name', desc: 'Type your name exactly as it was set up (e.g. "Pia", "Cashier", "Kitchen").' },
        { num: 3, title: 'Enter Your PIN', desc: 'Type your 4-digit PIN. Ask the owner if you don\'t know your PIN.', tip: 'Never share your PIN with customers.' },
        { num: 4, title: 'You\'re In!', desc: 'You\'ll see your dashboard based on your role. Cashiers see orders; Kitchen sees the KDS.' },
      ],
    },
    orders: {
      title: 'Managing Orders',
      steps: [
        { num: 1, title: 'New Order Arrives', desc: 'When a customer places an order via QR code, it appears in PENDING status. A sound may play.' },
        { num: 2, title: 'Confirm the Order', desc: 'Click the order card → click "Confirm". This tells the customer their order was received.', tip: 'Always confirm within 2 minutes.' },
        { num: 3, title: 'Preparing', desc: 'Kitchen taps the order on the KDS to mark it as PREPARING. The customer\'s tracking page updates automatically.' },
        { num: 4, title: 'Ready for Pickup', desc: 'Kitchen marks order as READY. Cashier can then call the customer\'s name.' },
        { num: 5, title: 'Complete the Order', desc: 'After the customer receives their food and payment is verified, mark as COMPLETED.' },
      ],
    },
    kitchen: {
      title: 'Using the Kitchen Display (KDS)',
      steps: [
        { num: 1, title: 'Open KDS', desc: `Go to www.tyg-services.com/kitchen?tenant=${slug} — bookmark this! Keep it open all day on a tablet.`, tip: 'Use a dedicated tablet mounted near the kitchen.' },
        { num: 2, title: 'Read the Order Card', desc: 'Each card shows: customer name, table, items with quantities, and any special notes.' },
        { num: 3, title: 'Start Cooking', desc: 'Tap the card to change status to PREPARING. The card turns yellow.' },
        { num: 4, title: 'Food is Ready', desc: 'Tap again to mark as READY. The card turns green and a notification is sent.' },
        { num: 5, title: 'Card Disappears', desc: 'Completed orders are removed from KDS automatically. Done!' },
      ],
    },
    payment: {
      title: 'Handling Payments',
      steps: [
        { num: 1, title: 'Customer Sees Total', desc: 'After placing order, the customer\'s tracking page shows the total with GCash/Maya QR code.' },
        { num: 2, title: 'Customer Sends Payment', desc: 'Customer pays and uploads a screenshot of their payment confirmation.' },
        { num: 3, title: 'Cashier Gets Alert', desc: 'An alert appears in the admin dashboard showing the payment proof.', tip: 'Check for payment proofs regularly, especially during busy hours.' },
        { num: 4, title: 'Verify the Payment', desc: 'Click "Verify" to approve the payment. The order status and customer\'s page updates instantly.' },
        { num: 5, title: 'If Suspicious', desc: 'Click "Reject" and add a note. The customer will be asked to re-submit.' },
      ],
    },
    tips: {
      title: 'Tips & Shortcuts',
      steps: [
        { num: 1, title: 'Bookmark Your Page', desc: `Cashier: bookmark /admin/dashboard. Kitchen: bookmark /kitchen?tenant=${slug}. Customer: scan QR on table.` },
        { num: 2, title: 'Realtime Updates', desc: 'Orders update in real time — no need to refresh! If orders stop updating, check your internet connection.' },
        { num: 3, title: 'Order Numbers', desc: `Orders are numbered ${slug.toUpperCase().slice(0,4)}-0001, ${slug.toUpperCase().slice(0,4)}-0002, etc. Use this number when talking to customers.`, tip: 'Write the order number on receipt or call slip.' },
        { num: 4, title: 'Handling Complaints', desc: 'If there\'s a problem with an order, mark it as CANCELLED with a reason. This helps track issues.' },
        { num: 5, title: 'End of Day', desc: 'The owner dashboard shows daily summary. All orders are saved in Google Sheets automatically.' },
      ],
    },
  };
}

export default function StaffGuidePage() {
  const [activeSection, setActiveSection] = useState<Section>('login');
  const [slug, setSlug] = useState('yani');
  const [tenantName, setTenantName] = useState('Your Café');

  useEffect(() => {
    try {
      const t = localStorage.getItem('tyg_tenant');
      if (t) { const p = JSON.parse(t) as { slug?: string; name?: string }; setSlug(p.slug ?? 'yani'); setTenantName(p.name ?? 'Your Café'); }
    } catch { /**/ }
  }, []);

  const STEPS = makeSteps(slug, tenantName);
  const section = STEPS[activeSection];
  const sectionMeta = SECTIONS.find(s => s.id === activeSection)!;

  return (
    <div style={{ color: 'var(--text)' }}>
      <style>{`
        .guide-roles{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
        .guide-links{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        @media(max-width:700px){.guide-roles{grid-template-columns:1fr}}
        @media(max-width:600px){.guide-links{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:360px){.guide-links{grid-template-columns:1fr}}
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>Staff Training Guide</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{tenantName} — TYG POS System</p>
        </div>
        <button
          onClick={() => window.print()}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:12, fontSize:13, fontWeight:600, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor:'pointer' }}
        >
          <Printer size={15} /> Print Guide
        </button>
      </div>

      {/* Role cards */}
      <div className="guide-roles">
        {ROLE_TIPS.map(r => (
          <div key={r.role} style={{ borderRadius:20, padding:16, background: r.bg, border: `1px solid ${r.color}30` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: r.color, marginBottom: 10 }}>{r.role}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {r.tasks.map((t, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', marginTop:6, flexShrink:0, background: r.color }} />
                  <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Section nav */}
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={activeSection === s.id
              ? { display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:12, fontSize:13, fontWeight:600, background: s.color, color: 'white', border:'none', cursor:'pointer' }
              : { display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:12, fontSize:13, fontWeight:600, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor:'pointer' }
            }
          >
            <s.icon size={14} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Steps */}
      <div style={{ borderRadius:20, overflow:'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ padding:'20px 24px', borderBottom: '1px solid var(--border)', background: `${sectionMeta.color}10` }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:32, height:32, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background: `${sectionMeta.color}20` }}>
              <sectionMeta.icon size={16} style={{ color: sectionMeta.color }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>{section.title}</h2>
          </div>
        </div>

        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
          {section.steps.map(step => (
            <div key={step.num} style={{ display:'flex', gap:16 }}>
              <div style={{ width:32, height:32, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontWeight:700, fontSize:13, background: `${sectionMeta.color}15`, color: sectionMeta.color }}>
                {step.num}
              </div>
              <div style={{ flex:1, paddingTop:4 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{step.title}</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>{step.desc}</p>
                {step.tip && (
                  <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginTop:8, padding:12, borderRadius:12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: '#f59e0b', fontSize: 12 }}>{step.tip}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick reference card */}
      <div style={{ marginTop:24, borderRadius:20, padding:20, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#22c55e', marginBottom: 12 }}>📌 Quick Reference</div>
        <div className="guide-links">
          {[
            { label: 'Customer Menu', url: `/order?tenant=${slug}`, icon: QrCode },
            { label: 'Admin Dashboard', url: '/admin/dashboard', icon: Users },
            { label: 'Kitchen Display', url: `/kitchen?tenant=${slug}`, icon: ChefHat },
            { label: 'Track Order', url: '/orders/track?id=ORDER_ID', icon: Clock },
          ].map(link => (
            <div key={link.label} style={{ borderRadius:12, padding:12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <link.icon size={14} style={{ color: '#22c55e', marginBottom: 6 }} />
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{link.label}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>{link.url}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
