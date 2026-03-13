'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, Banknote,
  UtensilsCrossed, MapPin, Users,
  BarChart3, Settings, CreditCard,
  ChefHat, Menu, X, LogOut,
  HelpCircle, Bell, ChevronDown, Building2
} from 'lucide-react';

const NAV_GROUPS = [
  {
    group: null,
    items: [
      { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
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

  const planStyle: Record<string, { color: string; bg: string }> = {
    TRIAL:      { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    STARTER:    { color: '#818cf8', bg: 'rgba(99,102,241,0.15)' },
    BUSINESS:   { color: '#22c55e', bg: 'rgba(34,197,94,0.15)'  },
    PRO:        { color: '#c084fc', bg: 'rgba(168,85,247,0.15)' },
    ENTERPRISE: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  };
  const ps = planStyle[planTier] ?? { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' };
  const displayName = staffName || tenantName.split(' ')[0] || 'Staff';

  return (
    <div style={{ height: '100vh', background: '#0f1117', display: 'flex', fontFamily: "'Sora','DM Sans',system-ui,sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box}
        :root{
          --brand:#22c55e;--brand-amber:#F59E0B;
          --bg:#0f1117;--sidebar:#111827;
          --surface:#161b27;--surface-2:#1e2535;--surface-3:#252d3d;
          --border:rgba(255,255,255,0.06);--border-2:rgba(255,255,255,0.10);
          --text:#e8eaf0;--text-muted:#9ca3af;--text-dim:#6b7280;
        }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#2d3748;border-radius:99px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes fadeup{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .page-enter{animation:fadeup .2s ease forwards}

        .nav-item{
          display:flex;align-items:center;gap:10px;
          padding:8px 12px;border-radius:9px;
          color:var(--text-muted);font-size:13px;font-weight:500;
          transition:all 0.12s;cursor:pointer;text-decoration:none;
          white-space:nowrap;border:1px solid transparent;margin-bottom:1px;
        }
        .nav-item:hover{background:var(--surface-3);color:var(--text)}
        .nav-item.active{
          background:rgba(34,197,94,0.1);
          color:#22c55e;
          border-color:rgba(34,197,94,0.2);
          font-weight:600;
        }
        .nav-group-label{
          font-size:9px;font-weight:700;letter-spacing:0.14em;
          text-transform:uppercase;color:var(--text-dim);
          padding:10px 12px 3px;
        }
        .topbar-btn{
          display:flex;align-items:center;justify-content:center;
          width:34px;height:34px;border-radius:8px;
          background:var(--surface-2);border:1px solid var(--border);
          color:var(--text-muted);cursor:pointer;transition:all 0.12s;
          position:relative;flex-shrink:0;
        }
        .topbar-btn:hover{background:var(--surface-3);color:var(--text)}
        .help-dropdown{
          position:absolute;right:0;top:40px;
          background:var(--surface-2);border:1px solid var(--border-2);
          border-radius:10px;padding:6px;min-width:200px;z-index:999;
          box-shadow:0 16px 48px rgba(0,0,0,0.5);
        }
        .help-item{
          display:flex;align-items:center;gap:10px;
          padding:9px 12px;border-radius:7px;
          color:var(--text-muted);font-size:13px;font-weight:500;
          text-decoration:none;cursor:pointer;transition:all 0.1s;
        }
        .help-item:hover{background:var(--surface-3);color:var(--text)}
        .show-mobile{display:none}
        @media(max-width:1024px){
          .show-mobile{display:flex}
          .main-sidebar{position:fixed!important;top:0;left:0;height:100%!important;width:240px;transform:translateX(-100%);transition:transform 0.25s ease;z-index:50}
          .main-sidebar.open{transform:translateX(0)!important}
        }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 40 }} />
      )}

      {/* ── Sidebar ───────────────────────────── */}
      <aside className={`main-sidebar${sidebarOpen ? ' open' : ''}`}
        style={{
          width: 240, background: '#111827', borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          height: '100vh', position: 'sticky', top: 0, zIndex: 50, overflow: 'hidden',
        }}>

        {/* Logo + close btn */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>☕</div>
            <div>
              <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 14 }}>TYG POS</div>
              <div style={{ color: '#6b7280', fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>v2.0</div>
            </div>
          </div>
          <button className="topbar-btn show-mobile" onClick={() => setSidebarOpen(false)} style={{ width: 28, height: 28 }}>
            <X size={13} />
          </button>
        </div>

        {/* Branch pill */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'blink 2s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>{tenantName}</span>
            </div>
            <ChevronDown size={11} style={{ color: '#22c55e', opacity: 0.7 }} />
          </div>
        </div>

        {/* KDS button */}
        <div style={{ padding: '10px 12px 6px' }}>
          <Link href={`/kitchen${tenantSlug ? `?tenant=${tenantSlug}` : ''}`}
            onClick={() => setSidebarOpen(false)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 9, textDecoration: 'none', background: 'linear-gradient(135deg,rgba(249,115,22,0.18),rgba(249,115,22,0.08))', border: '1px solid rgba(249,115,22,0.25)', color: '#f97316', fontSize: 13, fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChefHat size={14} />
              Kitchen Display
            </span>
            <span style={{ fontSize: 9, background: 'rgba(249,115,22,0.2)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>LIVE</span>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 8px' }}>
          {visibleGroups.map(({ group, items }) => (
            <div key={group ?? 'root'} style={{ marginBottom: 2 }}>
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
                      <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(239,68,68,0.18)', color: '#ef4444', padding: '2px 6px', borderRadius: 99 }}>!</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User + plan */}
        <div style={{ padding: '10px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: '#1e2535', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0 }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{staffRole}</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: ps.bg, color: ps.color }}>{planTier}</span>
          </div>
          <button onClick={handleLogout} className="nav-item" style={{ width: '100%', color: '#ef4444', background: 'none', border: 'none', padding: '8px 12px' }}>
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────── */}
      <div className="main-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>

        {/* Trial banner */}
        {showTrialBanner && (
          <div style={{ background: 'linear-gradient(90deg,rgba(245,158,11,0.1),rgba(239,68,68,0.06))', borderBottom: '1px solid rgba(245,158,11,0.2)', padding: '9px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#e8eaf0' }}>
              ⚠️ <strong style={{ color: '#F59E0B' }}>Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}.</strong>
              {' '}Upgrade to keep your orders, data & QR menus.
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Link href="/admin/billing" style={{ fontSize: 11, fontWeight: 700, color: '#000', background: '#F59E0B', padding: '5px 14px', borderRadius: 7, textDecoration: 'none' }}>
                Upgrade Now
              </Link>
              <button onClick={() => setShowBanner(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, fontSize: 14 }}>✕</button>
            </div>
          </div>
        )}

        {/* Topbar */}
        <header style={{ background: '#161b27', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="topbar-btn show-mobile" onClick={() => setSidebarOpen(true)}>
              <Menu size={15} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{tenantName}</span>
              <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 14 }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0' }}>{currentLabel}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeOrders > 0 && (
              <Link href="/admin/orders" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '5px 12px', borderRadius: 99, textDecoration: 'none' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'blink 2s infinite' }} />
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
                  <Link href="/admin/guide" className="help-item">
                    <ChefHat size={13} />Staff Training Guide
                  </Link>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                  <a href="mailto:support@tyg-services.com" className="help-item">
                    <Bell size={13} />Contact Support
                  </a>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1e2535', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 10px 5px 6px', cursor: 'pointer' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'white' }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0' }}>{displayName}</span>
              <ChevronDown size={10} style={{ color: '#6b7280' }} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-enter" style={{ flex: 1, padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
