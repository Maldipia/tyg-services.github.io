'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, Banknote,
  UtensilsCrossed, MapPin, Users,
  BarChart3, Settings, CreditCard,
  ChefHat, Menu, X, LogOut,
  HelpCircle, Bell, ChevronDown
} from 'lucide-react';

const NAV_GROUPS = [
  {
    group: null,
    items: [{ href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    group: 'OPERATIONS',
    items: [
      { href: '/admin/orders',   icon: ShoppingBag, label: 'Orders',       badge: true },
      { href: '/admin/payments', icon: Banknote,    label: 'Payments' },
    ],
  },
  {
    group: 'MANAGEMENT',
    items: [
      { href: '/admin/menu',   icon: UtensilsCrossed, label: 'Menu & Pricing' },
      { href: '/admin/tables', icon: MapPin,          label: 'Tables & QR' },
      { href: '/admin/staff',  icon: Users,           label: 'Staff & Roles' },
    ],
  },
  {
    group: 'INSIGHTS',
    items: [
      { href: '/admin/analytics', icon: BarChart3,  label: 'Analytics' },
      { href: '/admin/settings',  icon: Settings,   label: 'Settings' },
      { href: '/admin/billing',   icon: CreditCard, label: 'Billing', billing: true },
    ],
  },
];

type StaffRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN';
const ROLE_ACCESS: Record<StaffRole, string[]> = {
  OWNER:   ['OPERATIONS','MANAGEMENT','INSIGHTS'],
  MANAGER: ['OPERATIONS','MANAGEMENT'],
  CASHIER: ['OPERATIONS'],
  KITCHEN: [],
};

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantName, setTenantName] = useState('Your Café');
  const [tenantSlug, setTenantSlug] = useState('');
  const [planTier, setPlanTier] = useState('TRIAL');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [activeOrders, setActiveOrders] = useState(0);
  const [staffRole, setStaffRole] = useState<StaffRole>('OWNER');
  const [staffName, setStaffName] = useState('');
  const [showBanner, setShowBanner] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('tyg_tenant') || '{}') as { name?: string; slug?: string; plan?: string; trial_ends_at?: string; role?: StaffRole };
      setTenantName(t.name ?? 'Your Café');
      setTenantSlug(t.slug ?? '');
      setPlanTier(t.plan ?? 'TRIAL');
      if (t.role) setStaffRole(t.role);
      if (t.trial_ends_at) {
        const days = Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 86_400_000);
        setTrialDaysLeft(days > 0 ? days : 0);
      }
    } catch {/**/}
    try {
      const s = JSON.parse(localStorage.getItem('tyg_session') || '{}') as { role?: StaffRole; displayName?: string };
      if (s.role) setStaffRole(s.role);
      if (s.displayName) setStaffName(s.displayName);
    } catch {/**/}
  }, []);

  useEffect(() => {
    if (!tenantSlug) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/orders?tenantSlug=${tenantSlug}&status=active&limit=50`, { credentials: 'include' });
        if (r.ok) { const d = await r.json() as { data?: unknown[] }; setActiveOrders(d.data?.length ?? 0); }
      } catch {/**/}
    };
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [tenantSlug]);

  const handleLogout = async () => {
    try { await fetch('/api/auth/staff/login', { method: 'DELETE' }); } catch {/**/}
    localStorage.removeItem('tyg_session');
    localStorage.removeItem('tyg_tenant');
    router.push('/login');
  };

  const allItems = NAV_GROUPS.flatMap(g => g.items as Array<{ href: string; label: string }>);
  const currentLabel = allItems.find(n => pathname.startsWith(n.href))?.label ?? 'Dashboard';
  const roleGroups = ROLE_ACCESS[staffRole] ?? ROLE_ACCESS.OWNER;
  const visibleGroups = NAV_GROUPS.filter(g => g.group === null || roleGroups.includes(g.group));
  const showTrialBanner = showBanner && planTier === 'TRIAL' && trialDaysLeft !== null && trialDaysLeft <= 7;
  const displayName = staffName || tenantName.split(' ')[0] || 'Staff';

  const planStyle: Record<string, { color: string; bg: string }> = {
    TRIAL:      { color: '#92400e', bg: '#fef3c7' },
    STARTER:    { color: '#3730a3', bg: '#eef2ff' },
    BUSINESS:   { color: '#14532d', bg: '#dcfce7' },
    PRO:        { color: '#581c87', bg: '#f3e8ff' },
    ENTERPRISE: { color: '#78350f', bg: '#fffbeb' },
  };
  const ps = planStyle[planTier] ?? { color: '#92400e', bg: '#fef3c7' };

  return (
    <div style={{ height: '100vh', background: '#f1f5f9', display: 'flex', fontFamily: "'Inter','DM Sans',system-ui,sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        :root{
          --brand:#16a34a;--brand-light:#f0fdf4;--brand-border:#bbf7d0;
          --bg:#f1f5f9;--sidebar:#ffffff;
          --surface:#ffffff;--surface-2:#f8fafc;--surface-3:#f1f5f9;
          --border:#e2e8f0;--border-2:#cbd5e1;
          --text:#0f172a;--text-muted:#64748b;--text-dim:#94a3b8;
        }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes fadeup{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        .page-enter{animation:fadeup .18s ease forwards}

        .nav-item{
          display:flex;align-items:center;gap:9px;
          padding:8px 10px;border-radius:8px;
          color:#64748b;font-size:13px;font-weight:500;
          transition:all 0.1s;cursor:pointer;text-decoration:none;
          white-space:nowrap;margin-bottom:1px;
        }
        .nav-item:hover{background:#f1f5f9;color:#0f172a}
        .nav-item.active{
          background:#f0fdf4;color:#16a34a;font-weight:600;
        }
        .nav-group-label{
          font-size:10px;font-weight:700;letter-spacing:0.1em;
          text-transform:uppercase;color:#94a3b8;
          padding:12px 10px 4px;
        }
        .topbar-btn{
          display:flex;align-items:center;justify-content:center;
          width:34px;height:34px;border-radius:8px;
          background:#f8fafc;border:1px solid #e2e8f0;
          color:#64748b;cursor:pointer;transition:all 0.1s;
          position:relative;flex-shrink:0;
        }
        .topbar-btn:hover{background:#f1f5f9;color:#0f172a}
        .help-dropdown{
          position:absolute;right:0;top:40px;
          background:#ffffff;border:1px solid #e2e8f0;
          border-radius:10px;padding:6px;min-width:200px;z-index:999;
          box-shadow:0 8px 32px rgba(0,0,0,0.12);
        }
        .help-item{
          display:flex;align-items:center;gap:10px;
          padding:9px 12px;border-radius:7px;
          color:#64748b;font-size:13px;font-weight:500;
          text-decoration:none;cursor:pointer;transition:all 0.1s;
        }
        .help-item:hover{background:#f8fafc;color:#0f172a}
        .show-mobile{display:none}
        .kds-btn{
          display:flex;align-items:center;justify-content:space-between;
          padding:10px 12px;border-radius:9px;text-decoration:none;
          font-size:13px;font-weight:600;
          background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;
          transition:opacity 0.1s;margin-bottom:12px;
        }
        .kds-btn:hover{opacity:0.85}
        @media(max-width:1024px){
          .show-mobile{display:flex}
          .main-sidebar{position:fixed!important;top:0;left:0;height:100%!important;width:240px;transform:translateX(-100%);transition:transform 0.25s ease;z-index:50;box-shadow:4px 0 24px rgba(0,0,0,0.1)}
          .main-sidebar.open{transform:translateX(0)!important}
        }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 40 }} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`main-sidebar${sidebarOpen ? ' open' : ''}`}
        style={{ width: 240, background: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0, zIndex: 20 }}>

        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>☕</div>
            <div>
              <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>TYG POS</div>
              <div style={{ color: '#94a3b8', fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>v2.0</div>
            </div>
          </div>
          <button className="topbar-btn show-mobile" onClick={() => setSidebarOpen(false)} style={{ width: 28, height: 28 }}>
            <X size={13} />
          </button>
        </div>

        {/* Tenant pill */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'blink 2s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{tenantName}</span>
            </div>
            <ChevronDown size={11} style={{ color: '#16a34a', opacity: 0.7 }} />
          </div>
        </div>

        {/* KDS button */}
        <div style={{ padding: '10px 12px 0' }}>
          <Link href={`/kitchen${tenantSlug ? `?tenant=${tenantSlug}` : ''}`}
            className="kds-btn" onClick={() => setSidebarOpen(false)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChefHat size={14} /> Kitchen Display
            </span>
            <span style={{ fontSize: 9, background: '#fed7aa', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>LIVE</span>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 8px' }}>
          {visibleGroups.map(({ group, items }) => (
            <div key={group ?? 'root'}>
              {group && <div className="nav-group-label">{group}</div>}
              {(items as Array<{ href: string; icon: React.ComponentType<{ size: number }>; label: string; badge?: boolean; billing?: boolean }>).map(({ href, icon: Icon, label, badge, billing }) => {
                const active = pathname.startsWith(href);
                const billingUrgent = billing && planTier === 'TRIAL' && trialDaysLeft !== null && trialDaysLeft <= 5;
                return (
                  <Link key={href} href={href} className={`nav-item${active ? ' active' : ''}`} onClick={() => setSidebarOpen(false)}>
                    <Icon size={14} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {badge && activeOrders > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 800, minWidth: 20, textAlign: 'center', padding: '2px 6px', borderRadius: 99, background: '#ef4444', color: 'white' }}>
                        {activeOrders}
                      </span>
                    )}
                    {billingUrgent && !active && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: 99 }}>!</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User card + logout */}
        <div style={{ padding: '10px 12px 14px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0 }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{staffRole}</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: ps.bg, color: ps.color }}>{planTier}</span>
          </div>
          <button onClick={handleLogout} className="nav-item" style={{ width: '100%', color: '#ef4444', background: 'none', border: 'none' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>

        {/* Trial banner */}
        {showTrialBanner && (
          <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '9px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#92400e' }}>
              ⚠️ <strong>Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}.</strong>
              {' '}Upgrade to keep your orders, data & QR menus.
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Link href="/admin/billing" style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#f59e0b', padding: '5px 14px', borderRadius: 7, textDecoration: 'none' }}>Upgrade Now</Link>
              <button onClick={() => setShowBanner(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          </div>
        )}

        {/* Topbar */}
        <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="topbar-btn show-mobile" onClick={() => setSidebarOpen(true)}>
              <Menu size={15} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{tenantName}</span>
              <span style={{ color: '#cbd5e1' }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{currentLabel}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeOrders > 0 && (
              <Link href="/admin/orders" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '5px 12px', borderRadius: 99, textDecoration: 'none' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'blink 2s infinite' }} />
                {activeOrders} active
              </Link>
            )}

            <button className="topbar-btn" style={{ position: 'relative' }}>
              <Bell size={14} />
              {activeOrders > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', fontSize: 8, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeOrders > 9 ? '9+' : activeOrders}
                </span>
              )}
            </button>

            <div style={{ position: 'relative' }}>
              <button className="topbar-btn" onClick={() => setHelpOpen(h => !h)}>
                <HelpCircle size={14} />
              </button>
              {helpOpen && (
                <div className="help-dropdown" onClick={() => setHelpOpen(false)}>
                  <Link href="/admin/guide" className="help-item"><ChefHat size={13} /> Staff Training Guide</Link>
                  <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
                  <a href="mailto:support@tyg-services.com" className="help-item"><Bell size={13} /> Contact Support</a>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px 5px 6px', cursor: 'pointer' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'white' }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{displayName}</span>
              <ChevronDown size={10} style={{ color: '#94a3b8' }} />
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="page-enter" style={{ flex: 1, padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
