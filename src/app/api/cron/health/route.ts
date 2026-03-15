export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Require CRON_SECRET — same pattern as other cron routes
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prune expired staff sessions (keeps table lean, runs every 5 min via cron)
  let prunedSessions = 0;
  try {
    const { createServiceClient } = await import('@/lib/supabase/client');
    const db = createServiceClient();
    const { data } = await db.rpc('prune_expired_sessions');
    prunedSessions = (data as number) ?? 0;
  } catch {
    // Non-fatal — session cleanup failure should not break health check
  }

  return NextResponse.json({
    ok: true,
    service: 'TYG POS',
    timestamp: new Date().toISOString(),
    prunedSessions,
  });
}
