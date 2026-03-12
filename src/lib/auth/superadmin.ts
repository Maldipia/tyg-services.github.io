import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'tyg_superadmin';
const SECRET = process.env.SUPERADMIN_SECRET ?? 'tyg-super-2025';

export function verifySuperAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie === SECRET;
}

export function setSuperAdminCookie(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE_NAME, SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  });
  return res;
}

export function clearSuperAdminCookie(res: NextResponse): NextResponse {
  res.cookies.delete(COOKIE_NAME);
  return res;
}

export function superAdminUnauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
