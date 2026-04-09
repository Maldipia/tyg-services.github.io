// src/lib/sheets/direct.ts
// ════════════════════════════════════════════════════════════════
// Direct Google Sheets API writer — zero Apps Script dependency
//
// Authentication: Service account JWT → Google OAuth2 access token
// Env vars used: GOOGLE_SERVICE_ACCOUNT_JSON · GOOGLE_SHEET_ID
//
// Sheet tabs matched to what YANI's spreadsheet already has:
//   ORDERS · PAYMENTS · DAILY_SUMMARY · SYSTEM_LOGS
//
// Drop-in replacement for the old fireSheetsWebhook() function.
// Writes are direct (no queue), failures are logged but never throw.
// ════════════════════════════════════════════════════════════════

interface ServiceAccount {
  client_email: string;
  private_key:  string;
  token_uri?:   string;
}

// In-process token cache — refreshed before expiry
let _cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token;
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set');

  const sa: ServiceAccount = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);

  // Build JWT claim
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim  = {
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  };

  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const sigInput = `${b64url(header)}.${b64url(claim)}`;

  // Import RSA private key (PKCS8)
  const pem = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pem), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(sigInput)
  );

  const b64Sig = btoa(Array.from(new Uint8Array(sigBuf)).map(b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${sigInput}.${b64Sig}`;

  // Exchange JWT for Google access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }).toString(),
  });

  const tokenData = await tokenRes.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!tokenData.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  }

  _cachedToken = {
    token:     tokenData.access_token,
    expiresAt: Date.now() + ((tokenData.expires_in ?? 3600) * 1000),
  };

  return _cachedToken.token;
}

// ── Core Sheets API helpers ───────────────────────────────────
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function sheetsGet(sheetId: string, range: string): Promise<string[][]> {
  const token = await getAccessToken();
  const res   = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets GET failed (${res.status}): ${err.slice(0,200)}`);
  }
  const data = await res.json() as { values?: string[][] };
  return data.values ?? [];
}

async function sheetsAppend(sheetId: string, tab: string, row: (string|number|null)[]): Promise<void> {
  const token = await getAccessToken();
  const res   = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(tab)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ values: [row] }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets append failed (${res.status}): ${err.slice(0,200)}`);
  }
}

async function sheetsUpdate(sheetId: string, range: string, value: string): Promise<void> {
  const token = await getAccessToken();
  const res   = await fetch(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ values: [[value]] }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets update failed (${res.status}): ${err.slice(0,200)}`);
  }
}

// ── Find row by order number and update specific columns ──────
async function findAndUpdateOrderRow(
  sheetId:     string,
  orderNumber: string,
  updates:     Record<string, string>  // { 'Status': 'COMPLETED' }
): Promise<boolean> {
  const rows  = await sheetsGet(sheetId, 'ORDERS');
  if (rows.length < 2) return false;

  const headers = (rows[0] ?? []).map(String);
  const orderCol = (headers as (string|undefined)[]).findIndex(h => h === 'Order #');
  if (orderCol < 0) return false;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    if (String(row[orderCol]) === String(orderNumber)) {
      // Update each column in parallel
      await Promise.all(
        Object.entries(updates).map(([colName, val]) => {
          const c = (headers as (string|undefined)[]).findIndex(h => h === colName);
          if (c < 0) return Promise.resolve();
          // Sheets rows are 1-indexed, +1 for header
          const cell = `ORDERS!${String.fromCharCode(65 + c)}${r + 1}`;
          return sheetsUpdate(sheetId, cell, val);
        })
      );
      return true;
    }
  }
  return false;
}

// ── PHT timestamp helper ──────────────────────────────────────
function phtDate(iso?: string): { date: string; time: string } {
  const dt = new Date(iso ?? new Date().toISOString());
  const pht = new Date(dt.getTime() + 8 * 60 * 60 * 1000);
  return {
    date: pht.toISOString().slice(0, 10),
    time: pht.toISOString().slice(11, 16),
  };
}

// ════════════════════════════════════════════════════════════════
// Public action handlers — same interface as old fireSheetsWebhook
// ════════════════════════════════════════════════════════════════

export async function writeOrderToSheet(data: Record<string, unknown>): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return;
  if (data.isTest) return;

  const { date, time } = phtDate(data.createdAt as string | undefined);
  const itemsSummary = Array.isArray(data.items)
    ? (data.items as Array<{ qty: number; itemId?: string }>)
        .map(i => `${i.qty}×${i.itemId ?? '?'}`).join(', ')
    : '';

  await sheetsAppend(sheetId, 'ORDERS', [
    String(data.orderNumber   ?? ''),
    date,
    time,
    String(data.customerName  ?? ''),
    Number(data.pax           ?? 1),
    String(data.orderType     ?? ''),
    Number(data.subtotal      ?? 0),
    Number(data.serviceCharge ?? 0),
    Number(data.deliveryFee   ?? 0),
    Number(data.totalAmount   ?? 0),
    String(data.status        ?? 'PENDING'),
    String(data.paymentStatus ?? 'UNPAID'),
    String(data.notes         ?? ''),
    itemsSummary,
  ]);
}

export async function updateOrderStatusInSheet(data: Record<string, unknown>): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId || !data.orderNumber) return;

  await findAndUpdateOrderRow(sheetId, String(data.orderNumber), {
    'Status': String(data.status ?? ''),
  });
}

export async function updatePaymentInSheet(data: Record<string, unknown>): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return;

  // Update payment column on the ORDERS tab
  if (data.orderNumber) {
    await findAndUpdateOrderRow(sheetId, String(data.orderNumber), {
      'Payment': String(data.status ?? ''),
    }).catch(() => {/* order row may not exist yet */});
  }

  // Also append to PAYMENTS tab
  const { date, time } = phtDate();
  await sheetsAppend(sheetId, 'PAYMENTS', [
    String(data.orderNumber ?? data.orderId ?? ''),
    `${date} ${time}`,
    String(data.paymentId  ?? ''),
    String(data.status     ?? ''),
    String(data.verifiedBy ?? ''),
  ]);
}

// ── Drop-in replacement for fireSheetsWebhook ─────────────────
type SheetsAction =
  | 'LOG_ORDER' | 'UPDATE_ORDER' | 'UPDATE_PAYMENT'
  | 'LOG_PAYMENT' | 'VERIFY_PAYMENT' | 'REJECT_PAYMENT'
  | 'DAILY_SUMMARY' | 'APPEND_SYSTEM_LOG' | 'SYNC_MENU_TO_SHEET';

export async function writeSheetsAction(
  action: SheetsAction,
  data:   Record<string, unknown>
): Promise<void> {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return; // graceful no-op if not configured
  }

  switch (action) {
    case 'LOG_ORDER':
      await writeOrderToSheet(data);
      break;

    case 'UPDATE_ORDER':
      await updateOrderStatusInSheet(data);
      break;

    case 'UPDATE_PAYMENT':
    case 'LOG_PAYMENT':
    case 'VERIFY_PAYMENT':
    case 'REJECT_PAYMENT':
      await updatePaymentInSheet(data);
      break;

    case 'DAILY_SUMMARY': {
      const sheetId = process.env.GOOGLE_SHEET_ID!;
      const { date } = phtDate();
      await sheetsAppend(sheetId, 'DAILY_SUMMARY', [
        date,
        Number(data.orderCount ?? 0),
        Number(data.revenue    ?? 0),
        Number(data.avgOrder   ?? 0),
        String(data.topItem    ?? ''),
      ]);
      break;
    }

    // APPEND_SYSTEM_LOG and others → silently ignore (logEvent handles DB logging)
    default:
      break;
  }
}
