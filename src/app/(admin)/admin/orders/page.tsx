'use client';

import AdminOrdersBoard from '@/components/admin/AdminOrdersBoard';

export default function AdminOrdersPage() {
  // In production: get from session/cookie
  const tenantId = 'demo';
  const branchId = null;

  return (
    <div>
      <AdminOrdersBoard tenantId={tenantId} branchId={branchId} />
    </div>
  );
}
