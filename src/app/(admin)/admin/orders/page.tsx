'use client';
import React from 'react';

import { useEffect, useState } from 'react';
import AdminOrdersBoard from '@/components/admin/AdminOrdersBoard';

export default function AdminOrdersPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('tyg_session');
    if (stored) {
      try {
        const s = JSON.parse(stored) as { tenantId?: string };
        setTenantId(s.tenantId ?? null);
      } catch { /* ignore */ }
    }
  }, []);

  if (!tenantId) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:256, color: 'var(--text-muted)' }}>
        Loading orders…
      </div>
    );
  }

  return (
    <div>
      <AdminOrdersBoard tenantId={tenantId} branchId={null} />
    </div>
  );
}
