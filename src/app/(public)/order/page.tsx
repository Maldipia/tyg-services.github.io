// Canonical customer order URL is /order/[tenant]
// This redirect handles legacy QR codes that point to /order?tenant=yani
export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';

export default function LegacyOrderPage({
  searchParams,
}: {
  searchParams: { tenant?: string; table?: string; t?: string; addToOrder?: string };
}) {
  const tenant = searchParams.tenant;
  if (!tenant) redirect('/');

  const params = new URLSearchParams();
  if (searchParams.table) params.set('table', searchParams.table);
  if (searchParams.t)     params.set('t', searchParams.t);
  if (searchParams.addToOrder) params.set('addToOrder', searchParams.addToOrder);

  const qs = params.toString();
  redirect(`/order/${tenant}${qs ? `?${qs}` : ''}`);
}
