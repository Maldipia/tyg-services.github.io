'use client';
import React from 'react';

import { useState } from 'react';
import { Printer, QrCode, Clock, ChefHat, CreditCard, AlertTriangle, CheckCircle, Users, LogIn, LogOut } from 'lucide-react';

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

const STEPS: Record<Section, { title: string; steps: { num: number; title: string; desc: string; tip?: string }[] }> = {
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
      { num: 1, title: 'Open KDS', desc: 'Go to www.tyg-services.com/kitchen?tenant=yani — bookmark this! Keep it open all day on a tablet.', tip: 'Use a dedicated tablet mounted near the kitchen.' },
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
      { num: 1, title: 'Bookmark Your Page', desc: 'Cashier: bookmark /admin/dashboard. Kitchen: bookmark /kitchen?tenant=yani. Customer: scan QR on table.' },
      { num: 2, title: 'Realtime Updates', desc: 'Orders update in real time — no need to refresh! If orders stop updating, check your internet connection.' },
      { num: 3, title: 'Order Numbers', desc: 'Orders are numbered YANI-0001, YANI-0002, etc. Use this number when talking to customers.', tip: 'Write the order number on receipt or call slip.' },
      { num: 4, title: 'Handling Complaints', desc: 'If there\'s a problem with an order, mark it as CANCELLED with a reason. This helps track issues.' },
      { num: 5, title: 'End of Day', desc: 'The owner dashboard shows daily summary. All orders are saved in Google Sheets automatically.' },
    ],
  },
};

export default function StaffGuidePage() {
  const [activeSection, setActiveSection] = useState<Section>('login');
  const section = STEPS[activeSection];
  const sectionMeta = SECTIONS.find(s => s.id === activeSection)!;

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>Staff Training Guide</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>YANI Garden Café — TYG POS System</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <Printer size={15} /> Print Guide
        </button>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {ROLE_TIPS.map(r => (
          <div key={r.role} className="rounded-2xl p-4" style={{ background: r.bg, border: `1px solid ${r.color}30` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: r.color, marginBottom: 10 }}>{r.role}</div>
            <ul className="space-y-2">
              {r.tasks.map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: r.color }} />
                  <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Section nav */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={activeSection === s.id
              ? { background: s.color, color: 'white' }
              : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
            }
          >
            <s.icon size={14} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Steps */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)', background: `${sectionMeta.color}10` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${sectionMeta.color}20` }}>
              <sectionMeta.icon size={16} style={{ color: sectionMeta.color }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>{section.title}</h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {section.steps.map(step => (
            <div key={step.num} className="flex gap-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                style={{ background: `${sectionMeta.color}15`, color: sectionMeta.color }}
              >
                {step.num}
              </div>
              <div className="flex-1 pt-1">
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{step.title}</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>{step.desc}</p>
                {step.tip && (
                  <div className="flex items-start gap-2 mt-2 p-3 rounded-xl"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
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
      <div className="mt-6 rounded-2xl p-5" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#22c55e', marginBottom: 12 }}>📌 Quick Reference</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Customer Menu', url: '/order?tenant=yani', icon: QrCode },
            { label: 'Admin Dashboard', url: '/admin/dashboard', icon: Users },
            { label: 'Kitchen Display', url: '/kitchen?tenant=yani', icon: ChefHat },
            { label: 'Track Order', url: '/track/YANI-XXXX', icon: Clock },
          ].map(link => (
            <div key={link.label} className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <link.icon size={14} style={{ color: '#22c55e', marginBottom: 6 }} />
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{link.label}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>{link.url}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
