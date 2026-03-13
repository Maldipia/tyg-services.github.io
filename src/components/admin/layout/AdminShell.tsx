'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, Banknote,
  UtensilsCrossed, MapPin, Users,
  BarChart3, Settings, CreditCard,
  ChefHat, Menu, X, LogOut,
  HelpCircle, AlertTriangle, Bell,
  ChevronDown, Building2
} from 'lucide-react';

const NAV_GROUPS = [
  {
    group: 'OPERATIONS',
    items: [
      { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/admin/orders',    icon: ShoppingBag,     label: 'Live Orders',   badge: true },
      { href: '/admin/payments',  icon: Banknote,        label: 'Payments' },
    ],
  },
  {
    group: 'SETUP',
    items: [
      { href: '/admin/menu',   icon: UtensilsCrossed, label: 'Menu & Pricing' },
      { href: '/admin/tables', icon: MapPin,          label: 'Tables' },
      { href: '/admin/staff',  icon: Users,           label: 'Staff & Roles' },
    ],
  },
  {
    group: 'BUSINESS',
    items: [
      { href: '/admin/analytics', icon: BarChart3,  label: 'Analytics' },
      { href: '/admin/settings',  icon: Settings,   label: 'Settings' },
      { href: '/admin/billing',   icon: CreditCard, label: 'Plan & Billing', billing: true },
    ],
  },
];

type StaffRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN';

const ROLE_ACCESS: Record<StaffRole, string[]> = {
  OWNER:   ['OPERATIONS','SETUP','BUSINESS'],
  MANAGER: ['OPERATIONS','SETUP'],
  CASHIER: ['OPERATIONS'],
  KITCHEN: [],
};

interface AdminShellProps { children: React.ReactNode; }

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [tenantName,      setTenantName]      = useState('Your Café');
  const [tenantSlug,      setTenantSlug]      = useState('');
  const [planTier,        setPlanTier]        = useState('TRIAL');
  const [trialDaysLeft,   setTrialDaysLeft]   = useState<number | null>(null);
  const [activeOrders,    setActiveOrders]    = useState(0);
  const [staffRole,       setStaffRole]       = useState<StaffRole>('OWNER');
  const [showBanner,      setShowBanner]      = useState(true);
  const [helpOpen,        setHelpOpen]        = useState(false);

  useEffect(() => {
    const stored  = localStorage.getItem('tyg_tenant');
    const session = localStorage.getItem('tyg_session');
    if (stored) {
      try {
        const t = JSON.parse(stored) as { name?: string; slug?: string; plan?: string; trial_ends_at?: string; role?: StaffRole };
        setTenantName(t.name ?? 'Your Café');
        setTenantSlug(t.slug ?? '');
        setPlanTier(t.plan ?? 'TRIAL');
        if (t.role) setStaffRole(t.role);
        if (t.trial_ends_at) {
          const days = Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 86_400_000);
          setTrialDaysLeft(days > 0 ? days : 0);
        }
      } catch { /* */ }
    }
    if (session) {
      try {
        const s = JSON.parse(session) as { role?: StaffRole };
        if (s.role) setStaffRole(s.role);
      } catch { /* */ }
    }
  }, []);

  useEffect(() => {
    if (!tenantSlug) return;
    const fetch_ = async () => {
      try {
        const r = await fetch(`/api/orders?tenantSlug=${tenantSlug}&status=active&limit=50`, { credentials: 'include' });
        if (r.ok) { const d = await r.json() as { data?: unknown[] }; setActiveOrders(d.data?.length ?? 0); }
      } catch { /* */ }
    };
    void fetch_();
    const id = setInterval(() => void fetch_(), 30_000);
    return () => clearInterval(id);
  }, [tenantSlug]);

  const handleLogout = async () => {
    try {
      // Revoke server-side session token
      await fetch('/api/auth/staff/login', { method: 'DELETE' });
    } catch {
      // Non-fatal — clear client state regardless
    }
    localStorage.removeItem('tyg_session');
    localStorage.removeItem('tyg_tenant');
    router.push('/login');
  };

  const allItems = NAV_GROUPS.flatMap(g => g.items as Array<{ href: string; label: string; icon: unknown; badge?: boolean; billing?: boolean }>);
  const currentLabel = allItems.find(n => pathname.startsWith(n.href))?.label ?? 'Admin';
  const roleGroups = ROLE_ACCESS[staffRole as StaffRole] ?? ROLE_ACCESS.OWNER;
  const visibleGroups = NAV_GROUPS.filter(g => roleGroups.includes(g.group));
  const showTrialBanner = showBanner && planTier === 'TRIAL' && trialDaysLeft !== null && trialDaysLeft <= 5;

  const planStyle: Record<string, { color: string; bg: string }> = {
    TRIAL:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
    STARTER:    { color: '#818cf8', bg: 'rgba(99,102,241,0.12)'  },
    BUSINESS:   { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
    PRO:        { color: '#c084fc', bg: 'rgba(168,85,247,0.12)'  },
    ENTERPRISE: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  };
  const ps = planStyle[planTier] ?? { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };

  return (
    <div style={{ minHeight:'100vh', background:'#0f1117', display:'flex', fontFamily:"'Sora','DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        :root{
          --brand:#22c55e;--brand-dim:#16a34a;
          --surface:#161b27;--surface-2:#1e2535;--surface-3:#252d3d;
          --border:rgba(255,255,255,0.07);--border2:rgba(255,255,255,0.11);
          --text:#e8eaf0;--text-muted:#6b7280;--text-dim:#9ca3af;
        }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#2d3748;border-radius:99px}
        .nav-item{
          display:flex;align-items:center;gap:11px;
          padding:9px 13px;border-radius:9px;
          color:var(--text-muted);font-size:13.5px;font-weight:500;
          transition:all 0.13s;cursor:pointer;text-decoration:none;
          white-space:nowrap;border:1px solid transparent;
        }
        .nav-item:hover{background:var(--surface-3);color:var(--text)}
        .nav-item.active{
          background:linear-gradient(135deg,rgba(34,197,94,0.14),rgba(34,197,94,0.05));
          color:var(--brand);border-color:rgba(34,197,94,0.22);
        }
        .nav-group-label{
          font-size:9.5px;font-weight:700;letter-spacing:0.12em;
          text-transform:uppercase;color:var(--text-muted);
          padding:6px 13px 4px;font-family:'DM Mono',monospace;
        }
        .topbar-btn{
          display:flex;align-items:center;justify-content:center;
          width:36px;height:36px;border-radius:9px;
          background:var(--surface-2);border:1px solid var(--border);
          color:var(--text-muted);cursor:pointer;transition:all 0.13s;
          position:relative;flex-shrink:0;
        }
        .topbar-btn:hover{background:var(--surface-3);color:var(--text)}
        .kds-btn{
          display:flex;align-items:center;justify-content:space-between;
          padding:11px 14px;border-radius:11px;cursor:pointer;
          text-decoration:none;border:none;width:100%;font-family:inherit;
          font-size:13.5px;font-weight:700;
          background:linear-gradient(135deg,#f97316,#ef4444);
          color:white;transition:opacity 0.13s;margin-bottom:14px;
        }
        .kds-btn:hover{opacity:0.9}
        .help-dropdown{
          position:absolute;top:calc(100% + 8px);right:0;
          background:var(--surface);border:1px solid var(--border2);
          border-radius:12px;padding:8px;min-width:200px;
          box-shadow:0 16px 40px rgba(0,0,0,0.4);z-index:100;
          animation:fadeUp 0.15s ease;
        }
        .help-item{
          display:flex;align-items:center;gap:9px;padding:9px 12px;
          border-radius:8px;color:var(--text-dim);font-size:13px;
          cursor:pointer;text-decoration:none;transition:all 0.1s;
        }
        .help-item:hover{background:var(--surface-3);color:var(--text)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes slide-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .page-enter{animation:slide-in 0.22s ease forwards}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.4}}
        .lg-sidebar{transform:none!important;position:relative!important}
        @media(max-width:1023px){.lg-sidebar{position:fixed!important}}
        .main-col{margin-left:0}
        @media(min-width:1024px){.main-col{margin-left:244px}}
        .hide-mobile{display:none}
        @media(min-width:1024px){.hide-mobile{display:flex}}
        .show-mobile{display:flex}
        @media(min-width:1024px){.show-mobile{display:none!important}}
      `}</style>

      {sidebarOpen && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:40 }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={sidebarOpen ? 'lg-sidebar' : ''}
        style={{
          position:'fixed',left:0,top:0,height:'100%',zIndex:50,
          width:244,background:'var(--surface)',
          borderRight:'1px solid var(--border)',
          display:'flex',flexDirection:'column',
          transform: sidebarOpen ? 'none' : 'translateX(-100%)',
          transition:'transform 0.28s ease',
        }}
      >
        {/* Logo */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'18px 16px 14px',borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:32,height:32,borderRadius:9,
              background:'linear-gradient(135deg,#22c55e,#16a34a)',
              display:'flex',alignItems:'center',justifyContent:'center' }}>
              <ChefHat size={16} color="white" />
            </div>
            <div>
              <div style={{ color:'var(--text)',fontWeight:800,fontSize:15,lineHeight:1 }}>TYG POS</div>
              <div style={{ color:'var(--text-muted)',fontSize:10,marginTop:2,fontFamily:"'DM Mono',monospace" }}>
                Admin Console
              </div>
            </div>
          </div>
          <button className="topbar-btn show-mobile" onClick={() => setSidebarOpen(false)}>
            <X size={14} />
          </button>
        </div>

        {/* Tenant card */}
        <div style={{ padding:'12px 12px 10px',borderBottom:'1px solid var(--border)' }}>
          <div style={{ background:'var(--surface-2)',borderRadius:11,
            padding:'10px 12px',border:'1px solid var(--border)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:7 }}>
              <Building2 size={13} style={{ color:'var(--text-muted)',flexShrink:0 }} />
              <span style={{ color:'var(--text)',fontWeight:600,fontSize:13,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                {tenantName}
              </span>
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
              <span style={{ fontSize:10,fontWeight:700,padding:'2px 8px',
                borderRadius:99,letterSpacing:'0.07em',color:ps.color,background:ps.bg }}>
                {planTier}
              </span>
              {trialDaysLeft !== null && trialDaysLeft <= 7 && (
                <span style={{ fontSize:10,color:'#ef4444',fontWeight:600 }}>
                  {trialDaysLeft}d left
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KDS Persistent Button */}
        <div style={{ padding:'12px 12px 0' }}>
          <Link href={`/kitchen${tenantSlug ? `?tenant=${tenantSlug}` : ''}`}
            className="kds-btn" onClick={() => setSidebarOpen(false)}>
            <span style={{ display:'flex',alignItems:'center',gap:9 }}>
              <ChefHat size={15} />
              Kitchen Display
            </span>
            <span style={{ fontSize:10,background:'rgba(255,255,255,0.22)',
              padding:'2px 7px',borderRadius:99,fontWeight:700 }}>LIVE</span>
          </Link>
        </div>

        {/* Grouped Nav */}
        <nav style={{ flex:1,overflowY:'auto',padding:'4px 10px 12px' }}>
          {visibleGroups.map(({ group, items }) => (
            <div key={group} style={{ marginBottom:16 }}>
              <div className="nav-group-label">{group}</div>
              {(items as Array<{ href: string; icon: React.ComponentType<{size: number}>; label: string; badge?: boolean; billing?: boolean }>).map(({ href, icon: NavIcon, label, badge, billing }) => {
                const isActive = pathname.startsWith(href);
                const billingUrgent = billing && planTier === 'TRIAL' && trialDaysLeft !== null && trialDaysLeft <= 5;
                return (
                  <Link key={href} href={href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}>
                    <NavIcon size={15} />
                    <span style={{ flex:1 }}>{label}</span>
                    {badge && activeOrders > 0 && (
                      <span style={{ fontSize:10,fontWeight:800,minWidth:20,textAlign:'center',
                        padding:'2px 6px',borderRadius:99,background:'#ef4444',color:'white' }}>
                        {activeOrders}
                      </span>
                    )}
                    {billingUrgent && !isActive && (
                      <span style={{ fontSize:9,fontWeight:700,
                        background:'rgba(239,68,68,0.18)',color:'#ef4444',
                        padding:'2px 6px',borderRadius:99 }}>!</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding:'10px 10px 16px',borderTop:'1px solid var(--border)' }}>
          <button onClick={handleLogout} className="nav-item"
            style={{ width:'100%',color:'#ef4444',background:'none',border:'none' }}>
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-col" style={{ flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden' }}>

        {/* Trial banner */}
        {showTrialBanner && (
          <div style={{ background:'linear-gradient(90deg,rgba(239,68,68,0.12),rgba(245,158,11,0.08))',
            borderBottom:'1px solid rgba(239,68,68,0.2)',padding:'10px 24px',
            display:'flex',alignItems:'center',justifyContent:'space-between',gap:12 }}>
            <div style={{ display:'flex',alignItems:'center',gap:9 }}>
              <AlertTriangle size={14} color="#f59e0b" />
              <span style={{ fontSize:13,color:'var(--text)' }}>
                <strong style={{ color:'#fbbf24' }}>Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}.</strong>
                {' '}Upgrade to keep orders, data, and QR menus.
              </span>
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0 }}>
              <Link href="/admin/billing" style={{ fontSize:12,fontWeight:700,color:'white',
                background:'#ef4444',padding:'5px 14px',borderRadius:8,textDecoration:'none' }}>
                Upgrade Now
              </Link>
              <button onClick={() => setShowBanner(false)}
                style={{ background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:4 }}>
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Topbar */}
        <header style={{ background:'var(--surface)',borderBottom:'1px solid var(--border)',
          padding:'0 24px',height:62,display:'flex',alignItems:'center',
          justifyContent:'space-between',flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <button className="topbar-btn show-mobile" onClick={() => setSidebarOpen(true)}>
              <Menu size={16} />
            </button>
            <div>
              <h1 style={{ color:'var(--text)',fontWeight:700,fontSize:17,lineHeight:1 }}>{currentLabel}</h1>
              <p style={{ color:'var(--text-muted)',fontSize:11,marginTop:2 }}>
                {new Date().toLocaleDateString('en-PH',{weekday:'long',month:'short',day:'numeric'})}
              </p>
            </div>
          </div>

          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {activeOrders > 0 && (
              <Link href="/admin/orders" style={{ display:'flex',alignItems:'center',gap:6,
                fontSize:12,fontWeight:600,color:'#f59e0b',
                background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)',
                padding:'5px 12px',borderRadius:99,textDecoration:'none' }}>
                <span style={{ width:7,height:7,borderRadius:'50%',background:'#f59e0b',
                  display:'inline-block',animation:'pulse-dot 2s infinite' }} />
                {activeOrders} active
              </Link>
            )}

            <button className="topbar-btn" style={{ position:'relative' }}>
              <Bell size={15} />
              {activeOrders > 0 && (
                <span style={{ position:'absolute',top:-3,right:-3,width:15,height:15,
                  borderRadius:'50%',background:'#ef4444',fontSize:8,fontWeight:800,
                  color:'white',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  {activeOrders > 9 ? '9+' : activeOrders}
                </span>
              )}
            </button>

            {/* Help dropdown — replaces Staff Guide in nav */}
            <div style={{ position:'relative' }}>
              <button className="topbar-btn" onClick={() => setHelpOpen((h: boolean) => !h)}>
                <HelpCircle size={15} />
              </button>
              {helpOpen && (
                <div className="help-dropdown" onClick={() => setHelpOpen(false)}>
                  <Link href="/admin/guide" className="help-item">
                    <ChefHat size={14} />
                    Staff Training Guide
                  </Link>
                  <div style={{ height:1,background:'var(--border)',margin:'4px 0' }} />
                  <a href="mailto:support@tyg-services.com" className="help-item">
                    <Bell size={14} />
                    Contact Support
                  </a>
                </div>
              )}
            </div>

            {/* Avatar */}
            <div style={{ display:'flex',alignItems:'center',gap:7,
              background:'var(--surface-2)',border:'1px solid var(--border)',
              borderRadius:9,padding:'5px 10px 5px 6px',cursor:'pointer' }}>
              <div style={{ width:26,height:26,borderRadius:7,
                background:'linear-gradient(135deg,#22c55e,#16a34a)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:11,fontWeight:800,color:'white' }}>
                {tenantName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:12,fontWeight:600,color:'var(--text)',lineHeight:1 }}>
                  {tenantName.split(' ')[0]}
                </div>
                <div style={{ fontSize:10,color:'var(--text-muted)',marginTop:1 }}>{staffRole}</div>
              </div>
              <ChevronDown size={11} color="var(--text-muted)" />
            </div>
          </div>
        </header>

        {/* Page */}
        <main style={{ flex:1,overflowY:'auto',padding:24 }} className="page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
