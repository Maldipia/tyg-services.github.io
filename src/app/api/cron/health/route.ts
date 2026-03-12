export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'TYG POS',
    timestamp: new Date().toISOString(),
    region: process.env.VERCEL_REGION ?? 'unknown',
  });
}
