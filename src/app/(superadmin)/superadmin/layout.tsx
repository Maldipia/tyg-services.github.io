import SuperAdminShell from '@/components/superadmin/SuperAdminShell';

export const metadata = { title: 'TYG Super Admin' };

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminShell>{children}</SuperAdminShell>;
}
