// ============================================================
// TYG POS — Centralized Event Logger
// logEvent() → Supabase (sync) + Google Sheets (async, retry)
// NEVER throws. NEVER blocks POS operations.
// ============================================================

import { createServiceClient } from '@/lib/supabase/client';

export type EventType =
  | 'ORDER_CREATED'    | 'ORDER_UPDATED'    | 'ORDER_COMPLETED'  | 'ORDER_CANCELLED'
  | 'PAYMENT_COMPLETED'| 'PAYMENT_FAILED'   | 'PAYMENT_VERIFIED' | 'PAYMENT_REJECTED'
  | 'REFUND_ISSUED'
  | 'MENU_ITEM_CREATED'| 'MENU_ITEM_UPDATED'| 'MENU_ITEM_DELETED'
  | 'MENU_CATEGORY_CREATED' | 'MENU_CATEGORY_UPDATED' | 'MENU_CATEGORY_DELETED'
  | 'STAFF_LOGIN'      | 'STAFF_LOGOUT'     | 'STAFF_CREATED'    | 'STAFF_UPDATED'    | 'STAFF_DELETED'
  | 'TABLE_OPENED'     | 'TABLE_CLOSED'     | 'TABLE_CREATED'    | 'TABLE_UPDATED'    | 'TABLE_DELETED'
  | 'KITCHEN_STATUS_CHANGED'
  | 'SETTINGS_UPDATED'
  | 'TENANT_CREATED'   | 'TENANT_PLAN_UPGRADED' | 'TENANT_PLAN_DOWNGRADED'
  | 'SYSTEM_ERROR'     | 'SECURITY_EVENT'
  | 'CASH_SESSION_OPENED' | 'CASH_SESSION_CLOSED'
  | 'RESERVATION_CREATED' | 'RESERVATION_UPDATED' | 'RESERVATION_CANCELLED'
  | 'REFUND_ISSUED'
  | 'ORDER_COMPLETED';

export type ActionSource = 'POS' | 'KITCHEN' | 'ADMIN' | 'API' | 'CRON' | 'WEBHOOK' | 'SYSTEM';
export type EntityType   = 'ORDER' | 'PAYMENT' | 'MENU_ITEM' | 'MENU_CATEGORY' | 'STAFF' | 'TABLE' | 'TENANT' | 'SETTINGS' | 'SYSTEM' | 'CASH_SESSION' | 'RESERVATION' | 'PROMO_CODE';
export type LogStatus    = 'SUCCESS' | 'FAILURE' | 'WARNING';

export interface LogEventParams {
  eventType:   EventType;
  entityType:  EntityType;
  entityId?:   string;
  tenantId?:   string;
  branchId?:   string;
  userId?:     string;
  userName?:   string;
  source?:     ActionSource;
  status?:     LogStatus;
  details?:    Record<string, unknown>;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Log a system event to Supabase + Google Sheets.
 * NEVER throws — logging failures are swallowed so POS never breaks.
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  const {
    eventType, entityType, entityId,
    tenantId, branchId, userId, userName,
    source  = 'API',
    status  = 'SUCCESS',
    details = {},
  } = params;

  const timestamp = new Date().toISOString();
  let logId: string | null = null;

  // ── Step 1: Write to Supabase (synchronous, ~5ms) ─────────
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from('system_logs')
      .insert({
        event_type:    eventType,
        entity_type:   entityType,
        entity_id:     entityId   ?? null,
        tenant_id:     tenantId   ?? null,
        branch_id:     branchId   ?? null,
        user_id:       userId     ?? null,
        user_name:     userName   ?? null,
        action_source: source,
        status,
        details,
        sheets_synced: false,
      })
      .select('id')
      .single();

    if (error) console.error('[logEvent] Supabase write failed:', error.message);
    else logId = (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.error('[logEvent] Supabase exception:', err);
  }

  // Sheets sync handled explicitly via fireSheetsWebhook() in each route.
  // logEvent() is DB-only — APPEND_SYSTEM_LOG caused consistent failures.
  // system_logs.sheets_synced remains false intentionally for system events.
}

// ── Internal: push to Sheets ──────────────────────────────────

interface SheetsPayload {
  logId:       string;
  timestamp:   string;
  eventType:   string;
  entityType:  string;
  entityId:    string | undefined;
  tenantId:    string | undefined;
  branchId:    string | undefined;
  userId:      string | undefined;
  userName:    string | undefined;
  source:      string;
  status:      string;
  details:     Record<string, unknown>;
}

async function pushToSheets(payload: SheetsPayload): Promise<void> {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return;

  const secret  = process.env.GOOGLE_SCRIPT_SECRET ?? '';
  const body    = JSON.stringify({ action: 'APPEND_SYSTEM_LOG', data: payload });

  try {
    // HMAC-SHA256 signature
    const enc    = new TextEncoder();
    const key    = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body));
    const sig    = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetch(scriptUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-tyg-signature': sig },
      body,
      signal:  ctrl.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      // Mark row as synced
      if (payload.logId !== 'unknown') {
        try {
          await createServiceClient()
            .from('system_logs')
            .update({ sheets_synced: true, sheets_synced_at: new Date().toISOString() })
            .eq('id', payload.logId);
        } catch{/**/}
      }
    } else {
      await enqueueRetry(payload, `HTTP ${res.status}`);
    }
  } catch (err) {
    await enqueueRetry(payload, err instanceof Error ? err.message : String(err));
  }
}

async function enqueueRetry(payload: SheetsPayload, reason: string): Promise<void> {
  try {
    await createServiceClient()
      .from('pending_webhook_syncs')
      .insert({
        action:        'APPEND_SYSTEM_LOG',
        payload:       payload as unknown as Record<string, unknown>,
        error_reason:  reason,
        retry_count:   0,
        next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    console.warn(`[logEvent] Sheets sync failed, queued retry. Reason: ${reason}`);
  } catch (e) {
    console.error('[logEvent] Could not enqueue retry:', e);
  }
}
