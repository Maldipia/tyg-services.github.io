// ============================================================
// TYG POS — Sync.gs
// Bidirectional sync between Supabase and Google Sheets.
// Called from the TYG POS menu or triggered by cron.
// ============================================================

/**
 * Full sync: pull today's orders + payments from Supabase into Sheets.
 * Runs at boot or on-demand from TYG POS menu.
 */
function syncAllFromSupabase() {
  const supabaseUrl = getConfig('SUPABASE_URL');
  const serviceKey  = getConfig('SUPABASE_SERVICE_KEY');
  const tenantSlug  = getConfig('TENANT_SLUG');

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes('YOUR_PROJECT')) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY in CONFIG tab first.',
      '⚠️ Config Missing', 8
    );
    return;
  }

  const tenantId = getTenantId(supabaseUrl, serviceKey, tenantSlug);
  if (!tenantId) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Tenant "' + tenantSlug + '" not found.', '⚠️ Error', 5);
    return;
  }

  const results = {};
  results.orders   = syncOrdersToSheet(supabaseUrl, serviceKey, tenantId);
  results.payments = syncPaymentsToSheet(supabaseUrl, serviceKey, tenantId);
  results.menu     = syncMenuToSheet({ tenantId, supabaseUrl, serviceKey });

  const msg = `Orders: ${results.orders} | Payments: ${results.payments} | Menu items: ${results.menu}`;
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '✅ Sync Complete', 6);
  return results;
}

/**
 * Pull today's orders from Supabase → ORDERS tab.
 * Deduplicates by order_id — updates existing rows, appends new ones.
 */
function syncOrdersToSheet(supabaseUrl, serviceKey, tenantId) {
  const sh = getSheet(TAB.ORDERS);

  // PH midnight today in ISO
  const phNow  = new Date(Date.now() + 8 * 3600 * 1000);
  const todayPH = phNow.toISOString().slice(0, 10);
  const fromUTC = new Date(todayPH + 'T00:00:00+08:00').toISOString();

  const url = supabaseUrl + '/rest/v1/orders'
    + '?tenant_id=eq.' + tenantId
    + '&is_test=eq.false'
    + '&created_at=gte.' + encodeURIComponent(fromUTC)
    + '&select=id,order_number,table_name:restaurant_tables(name),customer_name,customer_phone,'
    + 'pax,status,payment_status,total_amount,vat_amount,subtotal_override,'
    + 'notes,branch_id,created_at,updated_at'
    + '&order=created_at.desc&limit=200';

  let orders;
  try {
    const resp = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + serviceKey, 'apikey': serviceKey },
      muteHttpExceptions: true,
    });
    orders = JSON.parse(resp.getContentText());
    if (!Array.isArray(orders)) return 0;
  } catch (e) {
    console.error('syncOrdersToSheet fetch failed:', e.message);
    return 0;
  }

  const existing = getSheetMap(sh, 1); // order_id → row number
  let newCount = 0;

  orders.forEach(o => {
    const row = [
      o.id,
      o.order_number,
      o.table_name?.name || '',
      o.customer_name,
      o.customer_phone || '',
      o.pax || 1,
      '',                          // items_summary — not included in this pull
      '',                          // items_json
      o.subtotal_override,
      o.vat_amount,
      o.total_amount,
      o.status,
      o.payment_status,
      '',                          // payment_method
      o.branch_id || '',
      o.created_at,
      o.updated_at,
      o.notes || '',
    ];

    if (existing[o.id]) {
      // Update status, payment_status, updated_at only (avoid overwriting items_summary)
      const r = existing[o.id];
      sh.getRange(r, 12).setValue(o.status);
      sh.getRange(r, 13).setValue(o.payment_status);
      sh.getRange(r, 17).setValue(o.updated_at);
    } else {
      sh.appendRow(row);
      newCount++;
    }
  });

  return orders.length;
}

/**
 * Pull today's payments from Supabase → PAYMENTS tab.
 */
function syncPaymentsToSheet(supabaseUrl, serviceKey, tenantId) {
  const sh = getSheet(TAB.PAYMENTS);

  const phNow  = new Date(Date.now() + 8 * 3600 * 1000);
  const todayPH = phNow.toISOString().slice(0, 10);
  const fromUTC = new Date(todayPH + 'T00:00:00+08:00').toISOString();

  const url = supabaseUrl + '/rest/v1/payments'
    + '?tenant_id=eq.' + tenantId
    + '&created_at=gte.' + encodeURIComponent(fromUTC)
    + '&select=id,order_id,method,amount,status,proof_url,verified_by,verified_at,reference_number,notes,created_at'
    + '&order=created_at.desc&limit=200';

  let payments;
  try {
    const resp = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + serviceKey, 'apikey': serviceKey },
      muteHttpExceptions: true,
    });
    payments = JSON.parse(resp.getContentText());
    if (!Array.isArray(payments)) return 0;
  } catch (e) {
    console.error('syncPaymentsToSheet fetch failed:', e.message);
    return 0;
  }

  const existing = getSheetMap(sh, 1); // payment_id → row number

  payments.forEach(p => {
    if (existing[p.id]) {
      const r = existing[p.id];
      sh.getRange(r, 11).setValue(p.status);         // supabase_status
      sh.getRange(r, 9).setValue(p.verified_by || '');
      sh.getRange(r, 10).setValue(p.verified_at || '');
    } else {
      sh.appendRow([
        p.id,
        p.order_id,
        '',                          // order_number — resolve separately if needed
        p.method,
        p.amount,
        p.proof_url || '',
        '',                          // proof_drive_url
        'UPLOADED',
        p.verified_by || '',
        p.verified_at || '',
        p.status,
        p.notes || '',
        p.created_at,
      ]);
    }
  });

  return payments.length;
}

/**
 * Push menu items from MENU tab → Supabase.
 * Only pushes rows where item_id is a valid UUID (skips blank/header rows).
 */
function syncMenuToSupabase() {
  const supabaseUrl = getConfig('SUPABASE_URL');
  const serviceKey  = getConfig('SUPABASE_SERVICE_KEY');
  if (!supabaseUrl || !serviceKey || supabaseUrl.includes('YOUR_PROJECT')) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Configure Supabase credentials in CONFIG tab.', '⚠️ Config Missing', 6);
    return;
  }

  const sh    = getSheet(TAB.MENU);
  const data  = sh.getDataRange().getValues();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let pushed = 0;

  // Skip header row (row 0)
  for (let i = 1; i < data.length; i++) {
    const [itemId, category, name, description, basePrice, status, isFeatured, tags, imageUrl, sortOrder] = data[i];
    if (!itemId || !UUID_RE.test(String(itemId))) continue;

    const body = JSON.stringify({
      name:        name || '',
      description: description || null,
      base_price:  parseFloat(basePrice) || 0,
      status:      status || 'AVAILABLE',
      is_featured: Boolean(isFeatured),
      sort_order:  parseInt(sortOrder) || 0,
    });

    try {
      UrlFetchApp.fetch(supabaseUrl + '/rest/v1/menu_items?id=eq.' + itemId, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + serviceKey,
          'apikey': serviceKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        payload: body,
        muteHttpExceptions: true,
      });
      pushed++;
    } catch (e) {
      console.error('syncMenuToSupabase patch failed for', itemId, ':', e.message);
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    pushed + ' items synced to Supabase.',
    '✅ Menu Synced', 5
  );
  return { pushed };
}

/**
 * Pull menu items from Supabase → MENU tab.
 * Called by action 'SYNC_MENU_TO_SHEET'.
 */
function syncMenuToSheet(data) {
  const supabaseUrl = data.supabaseUrl || getConfig('SUPABASE_URL');
  const serviceKey  = data.serviceKey  || getConfig('SUPABASE_SERVICE_KEY');
  const tenantId    = data.tenantId    || getTenantId(supabaseUrl, serviceKey, getConfig('TENANT_SLUG'));

  if (!tenantId) return 0;

  const url = supabaseUrl + '/rest/v1/menu_items'
    + '?tenant_id=eq.' + tenantId
    + '&select=id,name,description,base_price,status,is_featured,sort_order,'
    + 'category:menu_categories(name)'
    + '&order=sort_order.asc';

  let items;
  try {
    const resp = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + serviceKey, 'apikey': serviceKey },
      muteHttpExceptions: true,
    });
    items = JSON.parse(resp.getContentText());
    if (!Array.isArray(items)) return 0;
  } catch (e) {
    console.error('syncMenuToSheet failed:', e.message);
    return 0;
  }

  const sh = getSheet(TAB.MENU);
  // Clear data rows (keep header)
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, 11).clearContent();

  items.forEach((item, idx) => {
    sh.getRange(idx + 2, 1, 1, 11).setValues([[
      item.id,
      item.category?.name || '',
      item.name,
      item.description || '',
      item.base_price,
      item.status,
      item.is_featured,
      '',                    // tags
      '',                    // image_url
      item.sort_order,
      new Date().toISOString(),
    ]]);
  });

  return items.length;
}

// ── Daily sync trigger (registered by Autoconfig.gs) ─────────

function runNightlySync() {
  try {
    const supabaseUrl = getConfig('SUPABASE_URL');
    const serviceKey  = getConfig('SUPABASE_SERVICE_KEY');
    const tenantSlug  = getConfig('TENANT_SLUG');
    if (!supabaseUrl || !serviceKey) return;
    const tenantId = getTenantId(supabaseUrl, serviceKey, tenantSlug);
    if (!tenantId) return;
    syncOrdersToSheet(supabaseUrl, serviceKey, tenantId);
    syncPaymentsToSheet(supabaseUrl, serviceKey, tenantId);
    generateDailySummary();
  } catch (e) {
    console.error('runNightlySync error:', e.message);
  }
}

// ── Shared helpers ────────────────────────────────────────────

/**
 * Get tenant UUID from slug via Supabase REST API.
 */
function getTenantId(supabaseUrl, serviceKey, tenantSlug) {
  try {
    const resp = UrlFetchApp.fetch(
      supabaseUrl + '/rest/v1/tenants?slug=eq.' + tenantSlug + '&select=id',
      { headers: { 'Authorization': 'Bearer ' + serviceKey, 'apikey': serviceKey } }
    );
    const rows = JSON.parse(resp.getContentText());
    return rows.length ? rows[0].id : null;
  } catch (e) {
    console.error('getTenantId failed:', e.message);
    return null;
  }
}

/**
 * Build a map of { cellValue → rowNumber } for a given column (1-indexed).
 */
function getSheetMap(sh, colIndex) {
  const data = sh.getDataRange().getValues();
  const map  = {};
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][colIndex - 1]);
    if (key) map[key] = i + 1; // 1-indexed row number
  }
  return map;
}

/**
 * Shared getSheet helper (referenced from Orders.gs / Payments.gs)
 */
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name + '. Run Setup first.');
  return sh;
}

/**
 * Config helpers — read/write from CONFIG tab
 */
function getConfig(key) {
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.CONFIG);
  if (!sh) return null;
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1] ? String(data[i][1]).trim() : null;
  }
  return null;
}

function getAllConfig() {
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.CONFIG);
  if (!sh) return {};
  const data = sh.getDataRange().getValues();
  const cfg  = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) cfg[data[i][0]] = data[i][1];
  }
  return cfg;
}

/**
 * Find first row where column colNum matches value (1-indexed, returns 0 if not found)
 */
function findRowByValue(sh, colNum, value) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colNum - 1]) === String(value)) return i + 1;
  }
  return 0;
}
