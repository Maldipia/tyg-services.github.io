'use client';
import React from 'react';
// ============================================================
// TYG POS — /kitchen page
// Staff-facing Kitchen Display System (KDS)
// Accessed via: /kitchen?tenant=yani
// Auth: PIN login required (session stored in localStorage)
// ============================================================

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import KitchenDisplay from '@/components/kitchen/KitchenDisplay';

interface Session {
  staffId: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  branchId: string | null;
}

function KitchenPageInner() {
  const router     = useRouter();
  const params     = useSearchParams();
  const slugParam  = params.get('tenant');

  const [session, setSession]   = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('tyg_session');
    if (!raw) {
      // Redirect to login preserving tenant param
      const dest = slugParam ? `/login?tenant=${slugParam}&redirect=/kitchen` : '/login';
      router.replace(dest);
      return;
    }

    try {
      const s = JSON.parse(raw) as Session;

      // Kitchen page is accessible to all staff roles — KITCHEN, CASHIER, OWNER, etc.
      // If a tenant slug param is present, match it
      if (slugParam && s.tenantSlug !== slugParam) {
        router.replace(`/login?tenant=${slugParam}&redirect=/kitchen`);
        return;
      }

      setSession(s);
    } catch {
      router.replace('/login');
      return;
    } finally {
      setChecking(false);
    }
  }, [router, slugParam]);

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid #22c55e', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 14 }}>Loading Kitchen Display…</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117' }}>
      <style>{`
        .kds-topbar{background:#161b27;border-bottom:1px solid rgba(255,255,255,0.07);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .kds-topbar-title{font-size:16px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:480px){
          .kds-topbar{padding:10px 14px}
          .kds-topbar-title{font-size:13px}
          .kds-staff-label{display:none}
        }
      `}</style>
      {/* Top bar */}
      <div className="kds-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 8px #22c55e',
            animation: 'pulse 2s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <span className="kds-topbar-title" style={{ color: '#e8eaf0', fontWeight: 700 }}>
            🍳 Kitchen Display — {session.tenantName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="kds-staff-label" style={{ color: '#6b7280', fontSize: 13 }}>
            Staff: <strong style={{ color: '#9ca3af' }}>{session.staffId}</strong>
          </span>
          <button
            onClick={() => {
              fetch('/api/auth/staff/login', { method: 'DELETE' }).finally(() => {
                localStorage.removeItem('tyg_session');
                localStorage.removeItem('tyg_tenant');
                router.push(slugParam ? `/login?tenant=${slugParam}` : '/login');
              });
            }}
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Exit KDS
          </button>
        </div>
      </div>

      {/* KDS Component */}
      <KitchenDisplay
        tenantId={session.tenantId}
        branchId={session.branchId}
        tenantName={session.tenantName}
      />
    </div>
  );
}

export default function KitchenPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6b7280' }}>Loading…</span>
      </div>
    }>
      <KitchenPageInner />
    </Suspense>
  );
}
