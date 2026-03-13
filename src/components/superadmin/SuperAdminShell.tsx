'use client';
import React from 'react';

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

  const navStyle = (active: boolean): React.CSSProperties => ({
    display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10,
    fontSize:14, fontWeight:500, textDecoration:'none', whiteSpace:'nowrap', cursor:'pointer',
    color: active ? '#a78bfa' : 'rgba(255,255,255,0.4)',
    background: active ? 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.1))' : 'transparent',
    border: active ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
  });

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:"'Sora','DM Sans',system-ui,sans-serif", background:'#090c14' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 99px; }
        @keyframes fade-in { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none} }
        .page-in { animation: fade-in .2s ease forwards; }
      `}</style>

      {/* Mobile overlay */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:40 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        position:'fixed', left:0, top:0, height:'100%', zIndex:50,
        display:'flex', flexDirection:'column', width:228,
        background:'#0f1520', borderRight:'1px solid rgba(255,255,255,0.06)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
              <ShieldCheck size={15} color="white" />
            </div>
            <div>
              <div style={{ color:'white', fontWeight:700, fontSize:14 }}>Super Admin</div>
              <div style={{ color:'rgba(255,255,255,0.3)', fontSize:11 }}>TYG Platform</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} style={{ color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <X size={14} />
          </button>
        </div>

        {/* Quick stats */}
        {stats && (
          <div style={{ padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label: 'Tenants', value: stats.tenant_count ?? 0, color: '#a78bfa' },
                { label: 'Paying', value: stats.paying ?? 0, color: '#22c55e' },
              ].map(s => (
                <div key={s.label} style={{ borderRadius:12, padding:12, textAlign:'center', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color:s.color, fontWeight:800, fontSize:20 }}>{s.value}</div>
                  <div style={{ color:'rgba(255,255,255,0.3)', fontSize:10, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex:1, padding:'16px 12px', display:'flex', flexDirection:'column', gap:4 }}>
          {NAV.map(item => (
            <Link key={item.href} href={item.href} style={navStyle(isActive(item))} onClick={() => setOpen(false)}>
              <item.icon size={15} />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Tenant admin link */}
        <div style={{ padding:'0 12px 12px', borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:12 }}>
          <Link href="/admin/dashboard" target="_blank" style={{ ...navStyle(false), fontSize:12 }}>
            <Users size={13} />
            Open Tenant Admin
            <ChevronRight size={11} style={{ marginLeft:'auto' }} />
          </Link>
        </div>

        {/* Logout */}
        <div style={{ padding:'0 12px 16px' }}>
          <button onClick={handleLogout} style={{ ...navStyle(false), color:'#f87171', width:'100%', background:'none', border:'none' }}>
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, marginLeft:open ? 228 : 0 }}>
        {/* Topbar */}
        <header style={{ display:'flex', alignItems:'center', gap:16, padding:'0 24px', flexShrink:0, background:'#0f1520', borderBottom:'1px solid rgba(255,255,255,0.06)', height:60 }}>
          <button onClick={() => setOpen(o => !o)} style={{ color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <Menu size={18} />
          </button>
          <div style={{ color:'rgba(255,255,255,0.3)', fontSize:12, fontWeight:500 }}>TYG Super Admin</div>
          <div style={{ color:'rgba(255,255,255,0.15)', fontSize:12 }}>/</div>
          <div style={{ color:'#a78bfa', fontSize:13, fontWeight:600 }}>
            {NAV.find(n => isActive(n))?.label ?? 'Panel'}
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:8, background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e' }} />
            <span style={{ fontSize:11, color:'#a78bfa', fontWeight:600 }}>SUPER ADMIN</span>
          </div>
        </header>

        <main className="page-in" style={{ flex:1, overflowY:'auto', padding:24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
