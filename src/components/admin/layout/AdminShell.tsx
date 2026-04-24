'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, Banknote,
  UtensilsCrossed, MapPin, Users,
  BarChart3, Settings, CreditCard,
  ChefHat, LogOut, Bell, ChevronDown,
  ClipboardList, CalendarDays, Wallet, RotateCcw,
  Tag, Package, HelpCircle, PanelLeftClose, PanelLeftOpen,
  Menu
} from 'lucide-react';

const NAV_GROUPS = [
  {
    group: null,
    items: [{ href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    group: 'OPERATIONS',
    items: [
      { href: '/admin/orders',        icon: ShoppingBag,   label: 'Orders',        badge: true },
      { href: '/admin/payments',      icon: Banknote,      label: 'Payments' },
      { href: '/admin/cash-sessions', icon: Wallet,        label: 'Cash Sessions' },
      { href: '/admin/refunds',       icon: RotateCcw,     label: 'Refunds' },
      { href: '/admin/reservations',  icon: CalendarDays,  label: 'Reservations' },
      { href: '/admin/shift',         icon: ClipboardList, label: 'Shift Summary' },
    ],
  },
  {
    group: 'MANAGEMENT',
    items: [
      { href: '/admin/menu',        icon: UtensilsCrossed, label: 'Menu & Pricing' },
      { href: '/admin/tables',      icon: MapPin,          label: 'Tables & QR' },
      { href: '/admin/staff',       icon: Users,           label: 'Staff & Roles' },
      { href: '/admin/promo-codes', icon: Tag,             label: 'Promo Codes' },
      { href: '/admin/inventory',   icon: Package,         label: 'Inventory' },
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
  const pathname  = usePathname();
  const router    = useRouter();

  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [tenantName, setTenantName]   = useState('Your Café');
  const [tenantSlug, setTenantSlug]   = useState('');
  const [planTier, setPlanTier]       = useState('TRIAL');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [activeOrders, setActiveOrders]   = useState(0);
  const [staffRole, setStaffRole]         = useState<StaffRole>('OWNER');
  const [staffName, setStaffName]         = useState('');
  const [showBanner, setShowBanner]       = useState(true);
  const [helpOpen, setHelpOpen]           = useState(false);

  // Persist sidebar collapse state
  useEffect(() => {
    const saved = localStorage.getItem('tyg_sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('tyg_sidebar_collapsed', String(next));
  };

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
    void fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((d: { data?: { planTier?: string; trialDaysLeft?: number; tenantName?: string } } | null) => {
        if (!d?.data) return;
        if (d.data.planTier) setPlanTier(d.data.planTier);
        if (d.data.trialDaysLeft !== undefined) setTrialDaysLeft(d.data.trialDaysLeft);
        if (d.data.tenantName) setTenantName(d.data.tenantName);
      }).catch(() => {});
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

  // Close mobile sidebar on navigation
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleLogout = async () => {
    try { await fetch('/api/auth/staff/login', { method: 'DELETE' }); } catch {/**/}
    localStorage.removeItem('tyg_session');
    localStorage.removeItem('tyg_tenant');
    const slug = tenantSlug || '';
    router.push(slug ? `/login/${slug}` : '/login');
  };

  const allItems = NAV_GROUPS.flatMap(g => g.items as Array<{ href: string; label: string }>);
  const currentLabel  = allItems.find(n => pathname.startsWith(n.href))?.label ?? 'Dashboard';
  const roleGroups    = ROLE_ACCESS[staffRole] ?? ROLE_ACCESS.OWNER;
  const visibleGroups = NAV_GROUPS.filter(g => g.group === null || roleGroups.includes(g.group));
  const showTrialBanner = showBanner && planTier === 'TRIAL' && trialDaysLeft !== null && trialDaysLeft <= 7;
  const displayName   = staffName || tenantName.split(' ')[0] || 'Staff';

  const planBadge: Record<string, { color: string; bg: string }> = {
    TRIAL:      { color: '#92400e', bg: '#fef3c7' },
    STARTER:    { color: '#3730a3', bg: '#eef2ff' },
    BUSINESS:   { color: '#14532d', bg: '#dcfce7' },
    PRO:        { color: '#581c87', bg: '#f3e8ff' },
    ENTERPRISE: { color: '#78350f', bg: '#fffbeb' },
  };
  const ps = planBadge[planTier] ?? planBadge.TRIAL;

  const W = collapsed ? 64 : 240;

  return (
    <div style={{ height: '100vh', background: '#f1f5f9', display: 'flex', fontFamily: "'Inter',system-ui,sans-serif", overflow: 'hidden' }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:99px}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes fadeup{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .page-in{animation:fadeup .2s ease}

        /* Nav items */
        .ni{
          display:flex;align-items:center;gap:9px;
          padding:8px 10px;border-radius:9px;
          color:#64748b;font-size:13px;font-weight:500;
          transition:all 0.12s;cursor:pointer;text-decoration:none;
          white-space:nowrap;
        }
        .ni:hover{background:#f1f5f9;color:#0f172a}
        .ni.on{background:#f0fdf4;color:#16a34a;font-weight:600}
        .ni.on svg{color:#16a34a}
        .ng{font-size:9.5px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;padding:14px 10px 4px}
        .ng.col{padding:14px 0 4px;text-align:center}

        /* Topbar buttons */
        .tb{
          display:flex;align-items:center;justify-content:center;
          width:34px;height:34px;border-radius:9px;
          background:#f8fafc;border:1px solid #e2e8f0;
          color:#64748b;cursor:pointer;transition:all 0.12s;
          position:relative;flex-shrink:0;
        }
        .tb:hover{background:#f1f5f9;color:#0f172a;border-color:#cbd5e1}

        /* Tooltip for collapsed icons */
        .tip{position:relative}
        .tip:hover .tipbox{opacity:1;transform:translateX(0);pointer-events:auto}
        .tipbox{
          position:absolute;left:calc(100% + 10px);top:50%;transform:translateX(-6px) translateY(-50%);
          background:#1e293b;color:#f8fafc;font-size:12px;font-weight:500;
          padding:5px 10px;border-radius:7px;white-space:nowrap;z-index:100;
          opacity:0;transition:all 0.15s;pointer-events:none;
        }
        .tipbox::before{content:'';position:absolute;right:100%;top:50%;transform:translateY(-50%);
          border:5px solid transparent;border-right-color:#1e293b}

        /* KDS button */
        .kds{
          display:flex;align-items:center;justify-content:space-between;
          padding:9px 12px;border-radius:9px;text-decoration:none;
          font-size:12px;font-weight:600;
          background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;
          transition:opacity 0.12s;
        }
        .kds:hover{opacity:.85}

        /* Help dropdown */
        .hdrop{
          position:absolute;right:0;top:42px;
          background:#fff;border:1px solid #e2e8f0;
          border-radius:10px;padding:6px;min-width:190px;z-index:999;
          box-shadow:0 8px 32px rgba(0,0,0,0.1);
        }
        .hitem{
          display:flex;align-items:center;gap:9px;
          padding:8px 12px;border-radius:7px;
          color:#64748b;font-size:13px;font-weight:500;
          text-decoration:none;cursor:pointer;transition:all 0.1s;
        }
        .hitem:hover{background:#f8fafc;color:#0f172a}

        /* Sidebar transition */
        .sidebar{
          transition:width 0.22s cubic-bezier(.4,0,.2,1);
          overflow:hidden;
        }

        /* Mobile */
        @media(max-width:1024px){
          .mob-overlay{display:block!important}
          .sidebar{position:fixed!important;top:0;left:0;height:100%!important;z-index:50;
            width:240px!important;transform:translateX(-100%);transition:transform 0.24s ease;
            box-shadow:4px 0 32px rgba(0,0,0,0.12)}
          .sidebar.mob-open{transform:translateX(0)!important}
          .mob-toggle{display:flex!important}
        }
        @media(max-width:640px){
          .mc-pad{padding:14px!important}
          .tb-inner{padding:0 12px!important}
          .tb-name{display:none!important}
        }
      `}</style>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 40, display: 'none' }}
          className="mob-overlay" />
      )}

      {/* ───── SIDEBAR ───── */}
      <aside
        className={`sidebar${mobileOpen ? ' mob-open' : ''}`}
        style={{
          width: W, background: '#fff', borderRight: '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          height: '100vh', position: 'sticky', top: 0, zIndex: 20,
        }}
      >
        {/* ── Header / Logo ── */}
        <div style={{ padding: collapsed ? '18px 0 14px' : '18px 14px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>☕</div>
              <div>
                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>TYG POS</div>
                <div style={{ color: '#94a3b8', fontSize: 9, fontFamily: 'monospace' }}>v2.0</div>
              </div>
            </div>
          )}
          {collapsed && (
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>☕</div>
          )}
        </div>

        {/* ── Collapse toggle (desktop only) ── */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute', right: -14, top: 22,
            width: 28, height: 28, borderRadius: '50%',
            background: '#fff', border: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 30, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            color: '#64748b', transition: 'all 0.12s',
          }}
          className="mob-hide"
        >
          {collapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
        </button>

        {/* ── Tenant pill ── */}
        {!collapsed && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '7px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'blink 2s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenantName}</span>
            </div>
          </div>
        )}

        {/* ── KDS button ── */}
        <div style={{ padding: collapsed ? '8px 8px 0' : '8px 10px 0', flexShrink: 0 }}>
          {collapsed ? (
            <div className="tip" style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
              <Link href={`/kitchen${tenantSlug ? `?tenant=${tenantSlug}` : ''}`}
                style={{ width: 42, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', textDecoration: 'none' }}>
                <ChefHat size={16} />
              </Link>
              <span className="tipbox">Kitchen Display</span>
            </div>
          ) : (
            <Link href={`/kitchen${tenantSlug ? `?tenant=${tenantSlug}` : ''}`} className="kds">
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><ChefHat size={13} /> Kitchen Display</span>
              <span style={{ fontSize: 9, background: '#fed7aa', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>LIVE</span>
            </Link>
          )}
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '4px 8px 8px' : '2px 10px 8px' }}>
          {visibleGroups.map(({ group, items }) => (
            <div key={group ?? 'root'}>
              {group && (
                <div className={`ng${collapsed ? ' col' : ''}`}>
                  {collapsed ? '·' : group}
                </div>
              )}
              {(items as Array<{ href: string; icon: React.ComponentType<{ size: number }>; label: string; badge?: boolean; billing?: boolean }>).map(({ href, icon: Icon, label, badge, billing }) => {
                const active = pathname.startsWith(href);
                const billingUrgent = billing && planTier === 'TRIAL' && trialDaysLeft !== null && trialDaysLeft <= 5;
                if (collapsed) {
                  return (
                    <div key={href} className="tip" style={{ marginBottom: 2 }}>
                      <Link href={href} className={`ni${active ? ' on' : ''}`}
                        style={{ justifyContent: 'center', padding: '9px 0', width: '100%', position: 'relative' }}>
                        <Icon size={16} />
                        {badge && activeOrders > 0 && (
                          <span style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', fontSize: 8, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {activeOrders > 9 ? '9+' : activeOrders}
                          </span>
                        )}
                      </Link>
                      <span className="tipbox">{label}</span>
                    </div>
                  );
                }
                return (
                  <Link key={href} href={href} className={`ni${active ? ' on' : ''}`} style={{ marginBottom: 1 }}>
                    <Icon size={14} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {badge && activeOrders > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 800, minWidth: 20, textAlign: 'center', padding: '2px 5px', borderRadius: 99, background: '#ef4444', color: '#fff' }}>
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

        {/* ── Footer: user + logout ── */}
        <div style={{ padding: collapsed ? '8px' : '10px 12px 14px', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 6 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{staffRole}</div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: ps.bg, color: ps.color, flexShrink: 0 }}>{planTier}</span>
            </div>
          )}
          {collapsed ? (
            <div className="tip" style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="tipbox">{displayName} · {staffRole}</span>
            </div>
          ) : null}
          <button onClick={handleLogout}
            className="ni"
            style={{ width: '100%', color: '#ef4444', background: 'none', border: 'none', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <LogOut size={14} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ───── MAIN ───── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>

        {/* Trial banner */}
        {showTrialBanner && (
          <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '9px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#92400e' }}>
              ⚠️ <strong>Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}.</strong>
              {' '}Upgrade to keep your data & QR menus.
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Link href="/admin/billing" style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#f59e0b', padding: '5px 14px', borderRadius: 7, textDecoration: 'none' }}>Upgrade Now</Link>
              <button onClick={() => setShowBanner(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          </div>
        )}

        {/* Topbar */}
        <header className="tb-inner" style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 20px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {/* Mobile hamburger */}
            <button className="tb mob-toggle" style={{ display: 'none' }} onClick={() => setMobileOpen(true)}>
              <Menu size={15} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <span className="tb-name" style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{tenantName}</span>
              <span className="tb-name" style={{ color: '#e2e8f0' }}>/</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentLabel}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {activeOrders > 0 && (
              <Link href="/admin/orders" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '5px 12px', borderRadius: 99, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'blink 2s infinite' }} />
                {activeOrders} active
              </Link>
            )}

            <button className="tb" style={{ position: 'relative' }}>
              <Bell size={14} />
              {activeOrders > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', fontSize: 8, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeOrders > 9 ? '9+' : activeOrders}
                </span>
              )}
            </button>

            <div style={{ position: 'relative' }}>
              <button className="tb" onClick={() => setHelpOpen(h => !h)}><HelpCircle size={14} /></button>
              {helpOpen && (
                <div className="hdrop" onClick={() => setHelpOpen(false)}>
                  <Link href="/admin/guide" className="hitem"><ChefHat size={13} /> Staff Training Guide</Link>
                  <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                  <a href="mailto:support@tyg-services.com" className="hitem"><Bell size={13} /> Contact Support</a>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: '5px 10px 5px 6px' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="tb-name" style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{displayName}</span>
              <ChevronDown size={10} style={{ color: '#94a3b8' }} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-in mc-pad" style={{ flex: 1, padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
