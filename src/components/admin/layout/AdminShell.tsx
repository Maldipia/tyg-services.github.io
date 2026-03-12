'use client';
import React from 'react';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, UtensilsCrossed, ShoppingBag,
  Users, Settings, CreditCard, LogOut, Menu, X,
  ChefHat, BarChart3, QrCode, Bell, BookOpen, Banknote
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/orders',    icon: ShoppingBag,      label: 'Orders' },
  { href: '/admin/payments',  icon: Banknote,         label: 'Payments' },
  { href: '/admin/menu',      icon: UtensilsCrossed,  label: 'Menu' },
  { href: '/admin/tables',    icon: QrCode,           label: 'Tables & QR' },
  { href: '/admin/staff',     icon: Users,            label: 'Staff' },
  { href: '/admin/analytics', icon: BarChart3,        label: 'Analytics' },
  { href: '/admin/settings',  icon: Settings,         label: 'Settings' },
  { href: '/admin/billing',   icon: CreditCard,       label: 'Billing' },
  { href: '/admin/guide',     icon: BookOpen,         label: 'Staff Guide' },
];

const C = {
  bg:       '#0f1117',
  surface:  '#161b27',
  surface2: '#1e2535',
  surface3: '#252d3d',
  border:   'rgba(255,255,255,0.07)',
  text:     '#e8eaf0',
  muted:    '#6b7280',
  dim:      '#9ca3af',
  brand:    '#22c55e',
  gold:     '#f59e0b',
};

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantName, setTenantName] = useState('Your Café');
  const [planTier, setPlanTier] = useState('TRIAL');

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('tyg_tenant') ?? '{}') as { name?: string; plan?: string };
      if (t.name) setTenantName(t.name);
      if (t.plan) setPlanTier(t.plan);
    } catch { /* */ }
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/staff/login', { method: 'DELETE' }).catch(() => null);
    localStorage.removeItem('tyg_session');
    localStorage.removeItem('tyg_tenant');
    window.location.href = '/login';
  };

  const planBadgeStyle = () => {
    const map: Record<string, { bg: string; color: string }> = {
      TRIAL:      { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
      STARTER:    { bg: 'rgba(99,102,241,0.15)',   color: '#818cf8' },
      BUSINESS:   { bg: 'rgba(34,197,94,0.15)',    color: '#22c55e' },
      PRO:        { bg: 'rgba(168,85,247,0.15)',   color: '#c084fc' },
      ENTERPRISE: { bg: 'rgba(251,191,36,0.15)',   color: '#fbbf24' },
    };
    return map[planTier] ?? map.TRIAL;
  };

  const currentLabel = NAV_ITEMS.find(n => pathname.startsWith(n.href))?.label ?? 'Admin';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: C.bg, fontFamily: "'Sora','Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 99px; }
        a { text-decoration: none; }
        button { font-family: inherit; }
        .nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px; border-radius: 10px;
          color: ${C.muted}; font-size: 14px; font-weight: 500;
          transition: all 0.15s; cursor: pointer; text-decoration: none;
          white-space: nowrap; border: 1px solid transparent;
        }
        .nav-item:hover { background: ${C.surface3}; color: ${C.text}; }
        .nav-item.active {
          background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05));
          color: ${C.brand}; border-color: rgba(34,197,94,0.2);
        }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .pulse-dot { animation: pulse-dot 2s ease infinite; }
        @keyframes page-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .page-in { animation: page-in 0.2s ease forwards; }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        position: 'fixed', left: 0, top: 0, height: '100%', zIndex: 50,
        width: 240, display: 'flex', flexDirection: 'column',
        background: C.surface, borderRight: `1px solid ${C.border}`,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={16} color="white" />
            </div>
            <div>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 15, lineHeight: 1 }}>TYG POS</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Admin</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>

        {/* Tenant card */}
        <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ background: C.surface2, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ color: C.text, fontWeight: 600, fontSize: 13, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tenantName}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.07em', textTransform: 'uppercase', ...planBadgeStyle() }}>
              {planTier} Plan
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className={`nav-item ${pathname.startsWith(href) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)} style={{ display: 'flex', marginBottom: 2 }}>
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Kitchen */}
        <div style={{ padding: '12px', borderTop: `1px solid ${C.border}` }}>
          <Link href="/kitchen" className="nav-item" style={{ background: 'rgba(245,158,11,0.08)', color: C.gold, border: `1px solid rgba(245,158,11,0.15)`, display: 'flex' }}>
            <ChefHat size={16} />
            Kitchen Display
          </Link>
        </div>

        {/* Sign out */}
        <div style={{ padding: '0 12px 16px' }}>
          <button onClick={handleSignOut} className="nav-item" style={{ width: '100%', color: '#ef4444', background: 'none', border: 'none', display: 'flex' }}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: 64, flexShrink: 0,
          background: C.surface, borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted }}
            >
              <Menu size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ color: C.muted, fontSize: 13 }}>TYG POS</div>
              <div style={{ color: C.border, fontSize: 13 }}>/</div>
              <h1 style={{ color: C.text, fontWeight: 700, fontSize: 17, margin: 0 }}>{currentLabel}</h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted, position: 'relative' }}>
              <Bell size={15} />
            </button>
            <Link href="/admin/tables" style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted }}>
              <QrCode size={15} />
            </Link>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'white' }}>
              {tenantName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-in" style={{ flex: 1, overflowY: 'auto', padding: 24, background: C.bg }}>
          {children}
        </main>
      </div>
    </div>
  );
}
