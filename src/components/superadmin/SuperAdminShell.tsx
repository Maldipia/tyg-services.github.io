'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck, LayoutDashboard, Building2, LogOut,
  TrendingUp, Activity, Bell, Settings, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Zap, Clock, Database,
  RefreshCw, Menu, X
} from 'lucide-react';

const NAV_GROUPS = [
  {
    group: null,
    items: [
      { href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    group: 'TENANTS',
    items: [
      { href: '/superadmin/tenants', label: 'All Tenants', icon: Building2, exact: false },
      { href: '/superadmin/tenants?filter=TRIAL', label: 'Trials', icon: Clock, exact: false, badge: 'trial' },
      { href: '/superadmin/tenants?filter=health', label: 'Health Board', icon: Activity, exact: false, badge: 'health' },
    ],
  },
  {
    group: 'ANALYTICS',
    items: [
      { href: '/superadmin/metrics', label: 'Revenue & MRR', icon: TrendingUp, exact: true },
    ],
  },
  {
    group: 'AUTOMATION',
    items: [
      { href: '/superadmin/cron', label: 'Cron Jobs', icon: RefreshCw, exact: true },
      { href: '/superadmin/alerts', label: 'Alerts', icon: Bell, exact: true },
    ],
  },
  {
    group: 'SYSTEM',
    items: [
      { href: '/superadmin/database', label: 'Database', icon: Database, exact: true },
      { href: '/superadmin/settings', label: 'Settings', icon: Settings, exact: true },
    ],
  },
];

interface SaMetrics {
  total_tenants: number;
  trial_tenants: number;
  health: { at_risk: number; dead: number };
}

export default function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [metrics, setMetrics]       = useState<SaMetrics | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('tyg_sa_sidebar');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('tyg_sa_sidebar', String(next));
  };

  useEffect(() => {
    fetch('/api/superadmin/metrics')
      .then(r => r.ok ? r.json() : null)
      .then((d: { data?: SaMetrics } | null) => { if (d?.data) setMetrics(d.data); })
      .catch(() => null);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/superadmin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }).catch(() => null);
    router.push('/superadmin/login');
  };

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href.split('?')[0]);

  const W = collapsed ? 64 : 220;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter',system-ui,sans-serif", background: '#090c14', color: '#e2e8f0' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 99px; }
        @keyframes fadein { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
        .sa-page { animation: fadein .18s ease; }
        .sa-nav { display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:9px; color:rgba(255,255,255,0.38); font-size:12.5px; font-weight:500; text-decoration:none; white-space:nowrap; transition:all 0.12s; cursor:pointer; border:1px solid transparent; }
        .sa-nav:hover { color:rgba(255,255,255,0.75); background:rgba(255,255,255,0.05); }
        .sa-nav.on { color:#a78bfa; background:rgba(124,58,237,0.12); border-color:rgba(124,58,237,0.25); font-weight:600; }
        .sa-grp { font-size:9.5px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#334155; padding:14px 10px 4px; }
        .sa-tip { position:relative; }
        .sa-tip:hover .tipbox { opacity:1; pointer-events:auto; }
        .tipbox { position:absolute; left:calc(100% + 8px); top:50%; transform:translateY(-50%); background:#1e293b; color:#e2e8f0; font-size:11px; font-weight:600; padding:5px 10px; border-radius:7px; white-space:nowrap; z-index:999; opacity:0; pointer-events:none; transition:opacity 0.12s; border:1px solid rgba(255,255,255,0.08); }
        .tipbox::before { content:''; position:absolute; right:100%; top:50%; transform:translateY(-50%); border:5px solid transparent; border-right-color:#1e293b; }
        .sa-sidebar { transition: width 0.2s cubic-bezier(.4,0,.2,1); overflow:hidden; }
        @media(max-width:1024px) { .mob-overlay { display:block!important; } .sa-sidebar { position:fixed!important; top:0; left:0; height:100%!important; z-index:50; width:220px!important; transform:translateX(-100%); transition:transform 0.22s ease; box-shadow:4px 0 32px rgba(0,0,0,0.4); } .sa-sidebar.mob-open { transform:translateX(0)!important; } .mob-btn { display:flex!important; } }
      `}</style>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, display: 'none' }}
          className="mob-overlay" />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`sa-sidebar${mobileOpen ? ' mob-open' : ''}`}
        style={{
          width: W, background: '#0d1117', borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          height: '100vh', position: 'sticky', top: 0, zIndex: 20,
        }}
      >
        {/* Logo */}
        <div style={{ padding: collapsed ? '18px 0 14px' : '18px 14px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={15} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 12.5, letterSpacing: '-0.01em' }}>Super Admin</div>
                <div style={{ color: '#334155', fontSize: 9, fontFamily: 'monospace' }}>TYG POS v2</div>
              </div>
            </div>
          )}
          {collapsed && (
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={14} style={{ color: '#fff' }} />
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'}
          style={{ position: 'absolute', right: -13, top: 22, width: 26, height: 26, borderRadius: '50%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 30, color: '#475569' }}>
          {collapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
        </button>

        {/* Metrics pills */}
        {!collapsed && metrics && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6, flexShrink: 0 }}>
            <div style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 7, padding: '5px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{metrics.total_tenants}</div>
              <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tenants</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 7, padding: '5px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>{metrics.trial_tenants}</div>
              <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trials</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 7, padding: '5px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444' }}>{(metrics.health?.at_risk ?? 0) + (metrics.health?.dead ?? 0)}</div>
              <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>At Risk</div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '4px 8px' : '2px 10px' }}>
          {NAV_GROUPS.map(({ group, items }) => (
            <div key={group ?? 'root'}>
              {group && !collapsed && <div className="sa-grp">{group}</div>}
              {group && collapsed && <div style={{ height: 10 }} />}
              {items.map(({ href, label, icon: Icon, exact }) => {
                const active = isActive(href, exact);
                if (collapsed) return (
                  <div key={href} className="sa-tip" style={{ marginBottom: 2 }}>
                    <Link href={href} className={`sa-nav${active ? ' on' : ''}`} style={{ justifyContent: 'center', padding: '9px 0', width: '100%' }}>
                      <Icon size={15} />
                    </Link>
                    <span className="tipbox">{label}</span>
                  </div>
                );
                return (
                  <Link key={href} href={href} className={`sa-nav${active ? ' on' : ''}`} style={{ marginBottom: 1 }}>
                    <Icon size={13} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {active && <ChevronRight size={11} style={{ opacity: 0.5 }} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: collapsed ? '8px' : '10px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>P</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#f8fafc' }}>Pia</div>
                <div style={{ fontSize: 9, color: '#334155' }}>SUPERADMIN</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout}
            className="sa-nav"
            style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <LogOut size={13} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ height: 52, background: '#0d1117', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          {/* Mobile hamburger */}
          <button className="mob-btn" style={{ display: 'none', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} onClick={() => setMobileOpen(true)}>
            <Menu size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: '#334155' }}>TYG Super Admin</span>
            <span style={{ color: '#1e293b' }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {NAV_GROUPS.flatMap(g => g.items).find(n => isActive(n.href, n.exact))?.label ?? 'Dashboard'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {metrics && (
              <div style={{ fontSize: 11, color: '#475569', display: 'flex', gap: 12 }}>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>MRR ₱{((metrics as unknown as Record<string,unknown>).mrr as number | undefined) ?? '—'}</span>
              </div>
            )}
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>P</div>
          </div>
        </header>

        {/* Page */}
        <main className="sa-page" style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
