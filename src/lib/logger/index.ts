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
