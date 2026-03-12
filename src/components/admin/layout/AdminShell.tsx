'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, Banknote, UtensilsCrossed,
  QrCode, Users, BarChart3, Settings, CreditCard,
  LogOut, Menu, X, ChefHat, HelpCircle, Bell,
  ChevronRight, AlertTriangle, Zap,
} from 'lucide-react';

// ─── Role-gated navigation groups ─────────────────────────────
// Each item specifies which roles can see it.
// KITCHEN gets no sidebar — they go straight to KDS.
const NAV_GROUPS = [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard',    roles: ['OWNER','ADMIN','MANAGER','CASHIER','KITCHEN'] },
      { href: '/admin/orders',    icon: ShoppingBag,     label: 'Live Orders',  roles: ['OWNER','ADMIN','MANAGER','CASHIER'], badgeKey: 'pendingOrders' },
      { href: '/admin/payments',  icon: Banknote,        label: 'Payments',     roles: ['OWNER','ADMIN','MANAGER','CASHIER'] },
    ],
  },
  {
    id: 'setup',
    label: 'Setup',
    items: [
      { href: '/admin/menu',     icon: UtensilsCrossed, label: 'Menu & Pricing', roles: ['OWNER','ADMIN','MANAGER'] },
      { href: '/admin/tables',   icon: QrCode,          label: 'Tables',         roles: ['OWNER','ADMIN','MANAGER'] },
      { href: '/admin/staff',    icon: Users,           label: 'Staff & Roles',  roles: ['OWNER','ADMIN'] },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    items: [
      { href: '/admin/analytics', icon: BarChart3,  label: 'Analytics',    roles: ['OWNER','ADMIN','MANAGER'] },
      { href: '/admin/settings',  icon: Settings,   label: 'Settings',     roles: ['OWNER','ADMIN'] },
      { href: '/admin/billing',   icon: CreditCard, label: 'Plan & Billing', roles: ['OWNER'], planWarning: true },
    ],
  },
];

const PLAN_DAYS_MAP: Record<string, number | null> = {
  TRIAL: null, // computed dynamically
};

const C = {
  bg:       '#0c1018',
  surface:  '#111722',
  surface2: '#171f2e',
  surface3: '#1d2538',
  border:   'rgba(255,255,255,0.06)',
  border2:  'rgba(255,255,255,0.10)',
  text:     '#e8eaf0',
  muted:    '#5a6a82',
  dim:      '#8494a8',
  brand:    '#22c55e',
  amber:    '#f59e0b',
  red:      '#ef4444',
  violet:   '#7c3aed',
};

const PLAN_BADGE: Record<string, { color: string; bg: string }> = {
  TRIAL:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  STARTER:    { color: '#818cf8', bg: 'rgba(99,102,241,0.15)' },
  BUSINESS:   { color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  PRO:        { color: '#c084fc', bg: 'rgba(168,85,247,0.15)' },
  ENTERPRISE: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
};

interface SessionData {
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  role?: string;
  displayName?: string;
  branchId?: string | null;
  planTier?: string;
  trialEndsAt?: string;
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [session, setSession] = useState<SessionData>({});
  const [pendingOrders, setPendingOrders] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  // Load session
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tyg_session');
      const tenant = localStorage.getItem('tyg_tenant');
      const s = raw ? (JSON.parse(raw) as SessionData) : {};
      const t = tenant ? (JSON.parse(tenant) as { plan?: string; trialEndsAt?: string }) : {};
      setSession({ ...s, planTier: t.plan ?? 'TRIAL', trialEndsAt: t.trialEndsAt });
    } catch { /* */ }
  }, []);

  // Poll pending order count every 30s
  useEffect(() => {
    if (!session.tenantSlug) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/orders?tenantSlug=${session.tenantSlug}&status=active&limit=1`, { credentials: 'include' });
        if (!res.ok) return;
        const j = await res.json() as { data?: unknown[] };
        setPendingOrders(j.data?.length ?? 0);
      } catch { /* */ }
    };
    void load();
    const iv = setInterval(() => void load(), 30_000);
    return () => clearInterval(iv);
  }, [session.tenantSlug]);

  // Close help dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/staff/login', { method: 'DELETE' }).catch(() => null);
    localStorage.removeItem('tyg_session');
    localStorage.removeItem('tyg_tenant');
    router.push('/login');
  };

  const role = session.role ?? 'CASHIER';
  const planTier = session.planTier ?? 'TRIAL';
  const planBadge = PLAN_BADGE[planTier] ?? PLAN_BADGE.TRIAL;

  // Trial days remaining
  const trialDaysLeft = (() => {
    if (planTier !== 'TRIAL' || !session.trialEndsAt) return null;
    const diff = new Date(session.trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(diff / 86_400_000);
    return days > 0 ? days : 0;
  })();

  const showTrialWarning = planTier === 'TRIAL' && trialDaysLeft !== null && trialDaysLeft <= 5;

  // Current page label
  const allItems = NAV_GROUPS.flatMap(g => g.items);
  const currentLabel = allItems.find(n => pathname.startsWith(n.href))?.label ?? 'Admin';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: C.bg, fontFamily: "'Sora','Inter',system-ui,sans-serif", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #2a3547; border-radius: 99px; }
        a { text-decoration: none; color: inherit; }
        button { font-family: inherit; cursor: pointer; }

        /* Nav item base */
        .nav-link {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 9px; font-size: 13px; font-weight: 500;
          color: ${C.muted}; border: 1px solid transparent;
          transition: color 0.12s, background 0.12s, border-color 0.12s;
          white-space: nowrap; position: relative;
        }
        .nav-link:hover { background: ${C.surface3}; color: ${C.text}; }
        .nav-link.active {
          background: linear-gradient(135deg, rgba(34,197,94,0.14), rgba(34,197,94,0.04));
          color: ${C.brand}; border-color: rgba(34,197,94,0.22);
          font-weight: 600;
        }
        /* Group label */
        .nav-group-label {
          font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          color: ${C.muted}; padding: 4px 12px 5px; margin-top: 4px;
          opacity: 0.6;
        }
        /* KDS button */
        .kds-btn {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 11px 14px; border-radius: 10px; border: none;
          background: linear-gradient(135deg, #f97316, #ef4444);
          color: white; font-size: 13px; font-weight: 700;
          box-shadow: 0 4px 20px rgba(249,115,22,0.3);
          transition: transform 0.12s, box-shadow 0.12s;
          cursor: pointer; font-family: inherit;
        }
        .kds-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(249,115,22,0.4); }
        .kds-btn:active { transform: translateY(0); }

        @keyframes page-in { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
        .page-in { animation: page-in 0.18s ease forwards; }
        @keyframes badge-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .badge-pulse { animation: badge-pulse 2s ease infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 40, backdropFilter: 'blur(2px)' }} />
      )}

      {/* ══════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════ */}
      <aside style={{
        position: 'fixed', left: 0, top: 0, height: '100%', zIndex: 50,
        width: 244, display: 'flex', flexDirection: 'column',
        background: C.surface, borderRight: `1px solid ${C.border}`,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Logo + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(34,197,94,0.35)' }}>
              <ChefHat size={17} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: '-0.01em' }}>TYG POS</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>Admin Console</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)}
            style={{ background: 'none', border: 'none', color: C.muted, display: 'flex', padding: 4 }}>
            <X size={14} />
          </button>
        </div>

        {/* ── KDS: persistent orange CTA ── */}
        <div style={{ padding: '12px 12px 0' }}>
          <Link href="/kitchen" onClick={() => setSidebarOpen(false)}>
            <button className="kds-btn">
              <ChefHat size={16} />
              <span style={{ flex: 1, textAlign: 'left' }}>Kitchen Display</span>
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.25)',
                padding: '2px 7px', borderRadius: 99, fontWeight: 800, letterSpacing: '0.06em' }}>
                LIVE
              </span>
            </button>
          </Link>
        </div>

        {/* ── Tenant card ── */}
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                {session.tenantName ?? 'Your Café'}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                {session.displayName ?? ''} · {role}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: planBadge.color, background: planBadge.bg }}>
                {planTier}
              </span>
              {showTrialWarning && (
                <span style={{ fontSize: 9, fontWeight: 700, color: C.red,
                  background: 'rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: 99 }}>
                  {trialDaysLeft}d left
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Grouped nav ── */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {NAV_GROUPS.map(group => {
            // Filter items by role
            const visible = group.items.filter(item => item.roles.includes(role));
            if (visible.length === 0) return null;
            return (
              <div key={group.id} style={{ marginBottom: 6 }}>
                <div className="nav-group-label">{group.label}</div>
                {visible.map(item => {
                  const isActive = pathname.startsWith(item.href);
                  const badge = item.badgeKey === 'pendingOrders' ? pendingOrders : 0;
                  const hasWarn = item.planWarning && showTrialWarning;
                  return (
                    <Link key={item.href} href={item.href}
                      className={`nav-link ${isActive ? 'active' : ''}`}
                      onClick={() => setSidebarOpen(false)}
                      style={{ display: 'flex', marginBottom: 2 }}>
                      <item.icon size={15} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {badge > 0 && (
                        <span className="badge-pulse" style={{ fontSize: 10, fontWeight: 800,
                          background: C.amber, color: '#000',
                          padding: '1px 7px', borderRadius: 99, minWidth: 20, textAlign: 'center' }}>
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                      {hasWarn && (
                        <AlertTriangle size={12} style={{ color: C.amber }} />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ── Sign out ── */}
        <div style={{ padding: '10px 10px 14px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={handleSignOut}
            className="nav-link"
            style={{ width: '100%', border: 'none', background: 'none',
              color: '#ef4444', display: 'flex' }}>
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          MAIN CONTENT AREA
      ══════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* ── Topbar ── */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', height: 60, flexShrink: 0,
          background: C.surface, borderBottom: `1px solid ${C.border}`,
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setSidebarOpen(true)}
              style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.muted }}>
              <Menu size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: C.muted, fontSize: 12 }}>TYG POS</span>
              <span style={{ color: C.border, fontSize: 12 }}>/</span>
              <h1 style={{ color: C.text, fontWeight: 700, fontSize: 16, margin: 0 }}>{currentLabel}</h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Trial warning pill in topbar */}
            {showTrialWarning && (
              <Link href="/admin/billing"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                  borderRadius: 99, background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, fontWeight: 700, color: C.red }}>
                <Zap size={11} />
                Trial: {trialDaysLeft}d left
              </Link>
            )}

            {/* Help dropdown — replaces "Staff Guide" in nav */}
            <div ref={helpRef} style={{ position: 'relative' }}>
              <button onClick={() => setHelpOpen(p => !p)}
                style={{ background: helpOpen ? C.surface3 : C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: helpOpen ? C.text : C.muted }}>
                <HelpCircle size={15} />
              </button>
              {helpOpen && (
                <div style={{ position: 'absolute', right: 0, top: 44, width: 200,
                  background: C.surface2, border: `1px solid ${C.border2}`,
                  borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 100 }}>
                  <div style={{ padding: '10px 14px 6px', fontSize: 10, color: C.muted,
                    fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Help & Resources
                  </div>
                  {[
                    { label: 'Staff Training Guide', href: '/admin/guide' },
                    { label: 'Order Workflow', href: '/admin/guide#orders' },
                    { label: 'Kitchen Display Guide', href: '/admin/guide#kitchen' },
                    { label: 'View Platform Status', href: 'https://status.tyg-services.com', ext: true },
                  ].map(({ label, href, ext }) => (
                    <Link key={label} href={href} target={ext ? '_blank' : undefined}
                      onClick={() => setHelpOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 14px', fontSize: 13, color: C.dim, borderTop: `1px solid ${C.border}` }}
                      className="nav-link" >
                      {label}
                      <ChevronRight size={12} style={{ color: C.muted }} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications */}
            <button style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.muted, position: 'relative' }}>
              <Bell size={15} />
              {pendingOrders > 0 && (
                <span className="badge-pulse" style={{ position: 'absolute', top: 6, right: 6,
                  width: 8, height: 8, borderRadius: '50%', background: C.amber,
                  border: `2px solid ${C.surface}` }} />
              )}
            </button>

            {/* Avatar */}
            <div style={{ width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14, color: 'white',
              boxShadow: '0 2px 10px rgba(34,197,94,0.3)' }}>
              {(session.displayName ?? session.tenantName ?? 'A').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* ── Trial banner (urgent ≤3 days) ── */}
        {planTier === 'TRIAL' && trialDaysLeft !== null && trialDaysLeft <= 3 && (
          <div style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
            borderBottom: `1px solid rgba(239,68,68,0.2)`,
            padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} style={{ color: C.red, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: C.text }}>
                <strong style={{ color: C.red }}>Trial expires {trialDaysLeft === 0 ? 'today' : `in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}`}.</strong>
                {' '}Upgrade now to keep orders, menu, and staff data.
              </span>
            </div>
            <Link href="/admin/billing"
              style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'white',
                background: C.red, padding: '6px 14px', borderRadius: 8 }}>
              Upgrade Now →
            </Link>
          </div>
        )}

        {/* ── Page content ── */}
        <main className="page-in" style={{ flex: 1, overflowY: 'auto', padding: 22, background: C.bg }}>
          {children}
        </main>
      </div>
    </div>
  );
}
