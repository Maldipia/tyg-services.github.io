'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, UtensilsCrossed, ShoppingBag,
  Users, Settings, CreditCard, LogOut, Menu, X,
  ChefHat, BarChart3, QrCode, Bell
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/orders',    icon: ShoppingBag,      label: 'Orders' },
  { href: '/admin/menu',      icon: UtensilsCrossed,  label: 'Menu' },
  { href: '/admin/staff',     icon: Users,            label: 'Staff' },
  { href: '/admin/analytics', icon: BarChart3,        label: 'Analytics' },
  { href: '/admin/settings',  icon: Settings,         label: 'Settings' },
  { href: '/admin/billing',   icon: CreditCard,       label: 'Billing' },
];

interface AdminShellProps {
  children: React.ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantName, setTenantName] = useState('Your Café');
  const [planTier, setPlanTier] = useState('TRIAL');
  const [pendingOrders, setPendingOrders] = useState(0);

  // Fetch basic tenant info for the sidebar
  useEffect(() => {
    const stored = localStorage.getItem('tyg_tenant');
    if (stored) {
      try {
        const t = JSON.parse(stored) as { name: string; plan: string };
        setTenantName(t.name);
        setPlanTier(t.plan);
      } catch { /* ignore */ }
    }
  }, []);

  const currentPage = NAV_ITEMS.find(n => pathname.startsWith(n.href))?.label ?? 'Admin';

  return (
    <div className="min-h-screen bg-[#0f1117] flex" style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}>
      {/* ── Google Fonts ──────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        :root {
          --brand: #22c55e;
          --brand-dim: #16a34a;
          --gold: #f59e0b;
          --surface: #161b27;
          --surface-2: #1e2535;
          --surface-3: #252d3d;
          --border: rgba(255,255,255,0.07);
          --text: #e8eaf0;
          --text-muted: #6b7280;
          --text-dim: #9ca3af;
        }

        * { box-sizing: border-box; }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 99px; }

        .nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px; border-radius: 10px;
          color: var(--text-muted); font-size: 14px; font-weight: 500;
          transition: all 0.15s ease; cursor: pointer; text-decoration: none;
          white-space: nowrap;
        }
        .nav-item:hover { background: var(--surface-3); color: var(--text); }
        .nav-item.active {
          background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05));
          color: var(--brand); border: 1px solid rgba(34,197,94,0.2);
        }
        .nav-item.active svg { color: var(--brand); }

        .plan-badge {
          font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
          padding: 3px 8px; border-radius: 99px; text-transform: uppercase;
        }
        .plan-trial   { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .plan-starter { background: rgba(99,102,241,0.15); color: #818cf8; }
        .plan-business{ background: rgba(34,197,94,0.15);  color: #22c55e; }
        .plan-pro     { background: rgba(168,85,247,0.15); color: #c084fc; }
        .plan-enterprise { background: rgba(251,191,36,0.15); color: #fbbf24; }

        .topbar-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 8px;
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-muted); cursor: pointer; transition: all 0.15s;
        }
        .topbar-btn:hover { background: var(--surface-3); color: var(--text); }

        @keyframes slide-in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: none; } }
        .page-enter { animation: slide-in 0.25s ease forwards; }
      `}</style>

      {/* ── Sidebar ───────────────────────────────────────── */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-full z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          width: 240,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              <ChefHat size={16} color="white" />
            </div>
            <div>
              <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, lineHeight: 1 }}>TYG POS</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>Admin</div>
            </div>
          </div>
          <button className="lg:hidden topbar-btn" onClick={() => setSidebarOpen(false)}>
            <X size={14} />
          </button>
        </div>

        {/* Tenant Info */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tenantName}
            </div>
            <span className={`plan-badge plan-${planTier.toLowerCase()}`}>
              {planTier} Plan
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={16} />
                {label}
                {label === 'Orders' && pendingOrders > 0 && (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                    {pendingOrders}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Kitchen Link */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <Link href="/kitchen" className="nav-item" style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.15)' }}>
            <ChefHat size={16} />
            Kitchen Display
          </Link>
        </div>

        {/* Logout */}
        <div className="px-3 pb-4">
          <button className="nav-item w-full" style={{ color: '#ef4444' }}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            height: 64,
          }}
        >
          <div className="flex items-center gap-3">
            <button className="topbar-btn lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu size={16} />
            </button>
            <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18 }}>
              {currentPage}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button className="topbar-btn relative">
              <Bell size={15} />
              {pendingOrders > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center font-bold"
                  style={{ background: '#ef4444', fontSize: 9 }}>
                  {pendingOrders}
                </span>
              )}
            </button>

            {/* QR shortcut */}
            <Link href="/admin/settings?tab=qr" className="topbar-btn">
              <QrCode size={15} />
            </Link>

            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}
            >
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
