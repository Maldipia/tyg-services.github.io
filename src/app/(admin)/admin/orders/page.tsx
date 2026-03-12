'use client';

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
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
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
