export const dynamic = 'force-dynamic';
// ============================================================
// GET /api/cron/refresh — Hourly analytics matview refresh
// Keeps analytics < 1 hour stale without full daily cron cost
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = createServiceClient();
  try {
    await db.rpc('refresh_analytics_views');
    return NextResponse.json({ ok: true, refreshed: new Date().toISOString() });
  } catch (err) {
    console.error('Matview refresh failed:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
