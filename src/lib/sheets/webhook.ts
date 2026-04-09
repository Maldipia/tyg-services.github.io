// src/lib/sheets/webhook.ts
// Typed helper to fire webhooks from Next.js → Apps Script Web App
// Fire-and-forget (no await on response) — never blocks the API route

import { createServiceClient } from '@/lib/supabase/client';

type SheetsAction =
  | 'LOG_ORDER'
  | 'UPDATE_PAYMENT'
  | 'UPDATE_ORDER'
  | 'LOG_PAYMENT'
  | 'VERIFY_PAYMENT'
  | 'REJECT_PAYMENT'
  | 'SYNC_MENU_TO_SHEET'
  | 'DAILY_SUMMARY'
  | 'APPEND_SYSTEM_LOG';

interface SheetsWebhookPayload {
  action: SheetsAction;
  data: Record<string, unknown>;
}

/**
 * Fire a webhook to the Google Apps Script Web App.
 * Queues a retry in Supabase if the request fails.
 * Never throws — always resolves.
 */
export async function fireSheetsWebhook(
  action: SheetsAction,
  data: Record<string, unknown>
): Promise<void> {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const secret    = process.env.GOOGLE_SCRIPT_SECRET ?? '';

  if (!scriptUrl || scriptUrl.includes('YOUR_DEPLOYMENT_ID')) {
    console.warn('[SheetsWebhook] GOOGLE_SCRIPT_URL not configured — skipping');
    return;
  }

  const payload: SheetsWebhookPayload = { action, data };
  const body = JSON.stringify(payload);

  // HMAC signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(body);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const sigHex = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000); // 25s — Apps Script needs time to write

    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tyg-signature': sigHex,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const ct = res.headers.get('content-type') ?? '';
      // 4xx with HTML = Apps Script deleted/undeployed — don't queue retry, just warn
      if (res.status >= 400 && ct.includes('text/html')) {
        console.warn(`[SheetsWebhook] ${action} skipped — Apps Script endpoint returned ${res.status} (HTML). Script may be undeployed.`);
        return;
      }
      const text = await res.text();
      console.error(`[SheetsWebhook] ${action} failed: ${res.status} — ${text.slice(0,100)}`);
      await queueRetry(action, data, `HTTP ${res.status}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[SheetsWebhook] ${action} error:`, msg);
    await queueRetry(action, data, msg);
  }
}

/**
 * Queue a failed webhook for retry by the Vercel Cron job.
 * Writes to a `pending_webhook_syncs` table in Supabase.
 */
// NOTE: fireSheetsWebhook calls from API routes may be aborted when Vercel Lambda
// freezes after response is sent. This is expected — the retry cron (*/15 min)
// replays any aborted entries from pending_webhook_syncs automatically.

async function queueRetry(
  action: SheetsAction,
  data: Record<string, unknown>,
  reason: string
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('pending_webhook_syncs').insert({
      action,
      payload: data,
      error_reason: reason,
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
    });
  } catch (e) {
    console.error('[SheetsWebhook] Failed to queue retry:', e);
  }
}
