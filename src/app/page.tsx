// src/app/page.tsx
// Root redirect — sends visitors to the staff login page.
// Customers always land via QR code: /order?tenant=slug

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/login');
}
