// src/app/api/cron/retry-webhooks/route.ts
// Runs every 15 min — retries failed Apps Script webhook calls
// Reads from pending_webhook_syncs table in Supabase

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { fireSheetsWebhook } from '@/lib/sheets/webhook';

const MAX_RETRIES = 5;

export async function GET(req: NextRequest) {
  // Auth: Vercel Cron sends Authorization: Bearer CRON_SECRET
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Fetch pending retries that are due
  const { data: pending, error } = await supabase
    .from('pending_webhook_syncs')
    .select('*')
    .lte('next_retry_at', now)
    .lt('retry_count', MAX_RETRIES)
    .order('next_retry_at', { ascending: true })
    .limit(20);

  if (error || !pending?.length) {
    return NextResponse.json({ retried: 0, message: 'Nothing to retry' });
  }

  let success = 0;
  let failed  = 0;

  for (const item of pending) {
    try {
      await fireSheetsWebhook(item.action, item.payload as Record<string, unknown>);

      // Mark as done
      await supabase
        .from('pending_webhook_syncs')
        .delete()
        .eq('id', item.id);

      success++;
    } catch {
      failed++;
      const newRetryCount = item.retry_count + 1;
      const backoffMs     = Math.min(15 * 60 * 1000 * Math.pow(2, newRetryCount), 4 * 60 * 60 * 1000); // max 4hr

      await supabase
        .from('pending_webhook_syncs')
        .update({
          retry_count:  newRetryCount,
          next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
          last_error:   'Retry attempt failed',
        })
        .eq('id', item.id);
    }
  }

  // Purge permanently failed (exceeded max retries)
  await supabase
    .from('pending_webhook_syncs')
    .delete()
    .gte('retry_count', MAX_RETRIES);

  return NextResponse.json({ retried: success + failed, success, failed });
}
