export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { setSuperAdminCookie, clearSuperAdminCookie } from '@/lib/auth/superadmin';

const SECRET = process.env.SUPERADMIN_SECRET ?? 'tyg-super-2025';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { secret, action } = await req.json() as { secret?: string; action?: string };

  if (action === 'logout') {
    return clearSuperAdminCookie(NextResponse.json({ ok: true }));
  }

  if (secret !== SECRET) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  return setSuperAdminCookie(NextResponse.json({ ok: true }));
}
