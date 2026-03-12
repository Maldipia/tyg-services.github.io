'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck, LayoutDashboard, Building2,
  LogOut, Menu, X, Users, TrendingUp, ChevronRight
} from 'lucide-react';

const NAV = [
  { href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/superadmin/tenants', label: 'Tenants', icon: Building2, exact: false },
];

export default function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<{ tenant_count?: number; paying?: number } | null>(null);

  useEffect(() => {
    fetch('/api/superadmin/tenants')
      .then(r => r.ok ? r.json() : null)
      .then((d: { totals?: { tenant_count: number; paying: number } } | null) => {
        if (d?.totals) setStats(d.totals);
      })
      .catch(() => null);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/superadmin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/superadmin/login');
  };

  const isActive = (item: { href: string; exact: boolean }) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Sora','DM Sans',system-ui,sans-serif", background: '#090c14' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 99px; }
        .sa-nav { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; color:rgba(255,255,255,0.4); font-size:14px; font-weight:500; text-decoration:none; transition:all .15s; white-space:nowrap; }
        .sa-nav:hover { background:rgba(124,58,237,0.1); color:rgba(255,255,255,0.8); }
        .sa-nav.active { background:linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.1)); color:#a78bfa; border:1px solid rgba(124,58,237,0.3); }
        @keyframes fade-in { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none} }
        .page-in { animation: fade-in .2s ease forwards; }
      `}</style>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full z-50 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 228, background: '#0f1520', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
              <ShieldCheck size={15} color="white" />
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Super Admin</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>TYG Platform</div>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>

        {/* Quick stats */}
        {stats && (
          <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Tenants', value: stats.tenant_count ?? 0, icon: Building2, color: '#a78bfa' },
                { label: 'Paying', value: stats.paying ?? 0, icon: TrendingUp, color: '#22c55e' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: s.color, fontWeight: 800, fontSize: 20 }}>{s.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} className={`sa-nav ${isActive(item) ? 'active' : ''}`} onClick={() => setOpen(false)}>
              <item.icon size={15} />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Tenant admin link */}
        <div className="px-3 pb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
          <Link href="/admin/dashboard" target="_blank" className="sa-nav" style={{ fontSize: 12 }}>
            <Users size={13} />
            Open Tenant Admin
            <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
          </Link>
        </div>

        {/* Logout */}
        <div className="px-3 pb-4">
          <button onClick={handleLogout} className="sa-nav w-full" style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
          style={{ background: '#0f1520', borderBottom: '1px solid rgba(255,255,255,0.06)', height: 60 }}>
          <button className="lg:hidden" onClick={() => setOpen(true)} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Menu size={18} />
          </button>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 500 }}>
            TYG Super Admin
          </div>
          <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>/</div>
          <div style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600 }}>
            {NAV.find(n => isActive(n))?.label ?? 'Panel'}
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
            <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>SUPER ADMIN</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 page-in">
          {children}
        </main>
      </div>
    </div>
  );
}
