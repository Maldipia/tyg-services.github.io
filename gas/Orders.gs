// ============================================================
// TYG POS — Orders.gs
// ============================================================

function logOrder(data) {
  const sh = getSheet(TAB.ORDERS);
  const now = new Date().toISOString();
  const itemsSummary = (data.items || [])
    .map(i => `${i.name}×${i.qty}`)
    .join(', ');

  sh.appendRow([
    data.order_id,
    data.order_number,
    data.table_qr || '',
    data.customer_name,
    data.customer_phone || '',
    data.pax || 1,
    itemsSummary,
    JSON.stringify(data.items || []),
    data.subtotal,
    data.vat_amount,
    data.total_amount,
    'PENDING',
    'PENDING',
    data.payment_method || '',
    data.branch_id || '',
    now,
    now,
    data.notes || '',
  ]);

  return { logged: true, order_number: data.order_number };
}

function updateOrderStatus(data) {
  const sh = getSheet(TAB.ORDERS);
  const row = findRowByValue(sh, 1, data.order_id);
  if (row === 0) return { updated: false, error: 'Order not found' };

  const now = new Date().toISOString();
  if (data.status)         sh.getRange(row, 12).setValue(data.status);
  if (data.payment_status) sh.getRange(row, 13).setValue(data.payment_status);
  if (data.payment_method) sh.getRange(row, 14).setValue(data.payment_method);
  sh.getRange(row, 17).setValue(now);

  // Row color by status
  const colors = {
    PENDING:   '#fef3c7', CONFIRMED: '#ede9fe', PREPARING: '#ffedd5',
    READY:     '#dcfce7', COMPLETED: '#f0fdf4', CANCELLED: '#fee2e2',
  };
  if (data.status && colors[data.status]) {
    sh.getRange(row, 1, 1, 18).setBackground(colors[data.status]);
  }

  return { updated: true, row };
}

function syncOrdersFromSupabase() {
  const supabaseUrl = getConfig('SUPABASE_URL');
  const serviceKey  = getConfig('SUPABASE_SERVICE_KEY');
  const tenantSlug  = getConfig('TENANT_SLUG');
  if (!supabaseUrl || !serviceKey) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Configure SUPABASE_URL and SUPABASE_SERVICE_KEY in CONFIG tab first.', '⚠️ Config Missing', 8);
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get tenant ID first
  const tenantResp = UrlFetchApp.fetch(
    `${supabaseUrl}/rest/v1/tenants?slug=eq.${tenantSlug}&select=id`,
    { headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey } }
  );
  const tenants = JSON.parse(tenantResp.getContentText());
  if (!tenants.length) { SpreadsheetApp.getActiveSpreadsheet().toast('Tenant not found: ' + tenantSlug, '⚠️ Error', 5); return; }
  const tenantId = tenants[0].id;

  const resp = UrlFetchApp.fetch(
    `${supabaseUrl}/rest/v1/orders?tenant_id=eq.${tenantId}&created_at=gte.${today.toISOString()}&is_test=eq.false&order=created_at.desc&limit=200`,
    { headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey } }
  );

  const orders = JSON.parse(resp.getContentText());
  const sh = getSheet(TAB.ORDERS);
  // Clear existing today's rows and re-append
  orders.forEach(o => {
    const existingRow = findRowByValue(sh, 1, o.id);
    if (existingRow === 0) {
      sh.appendRow([
        o.id, o.order_number, o.table_qr || '', o.customer_name, o.customer_phone || '',
        o.pax, '', '', o.subtotal_override || 0, o.vat_amount || 0, o.total_amount,
        o.status, o.payment_status, '', o.branch_id || '',
        o.created_at, o.updated_at, '',
      ]);
    }
  });

  SpreadsheetApp.getActiveSpreadsheet().toast(`Synced ${orders.length} orders from today.`, '✅ Sync Complete', 5);
}


// ============================================================
// TYG POS — Menu.gs
// ============================================================

function getMenuFromSheet() {
  const sh = getSheet(TAB.MENU);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1)
    .filter(r => r[0]) // skip empty rows
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
}

function syncMenuToSheet(menuData) {
  const sh = getSheet(TAB.MENU);
  // Keep header row, clear data rows
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();

  const rows = (menuData.items || []).map(item => [
    item.id,
    item.category_name || '',
    item.name,
    item.description || '',
    item.base_price,
    item.status,
    item.is_featured || false,
    (item.tags || []).join(', '),
    item.image_url || '',
    item.sort_order || 0,
    item.created_at || new Date().toISOString(),
  ]);

  if (rows.length) sh.getRange(2, 1, rows.length, 11).setValues(rows);
  return { synced: rows.length };
}

function syncMenuToSupabase() {
  const supabaseUrl = getConfig('SUPABASE_URL');
  const serviceKey  = getConfig('SUPABASE_SERVICE_KEY');
  const tenantSlug  = getConfig('TENANT_SLUG');

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes('YOUR_PROJECT')) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Configure Supabase settings in CONFIG tab first.', '⚠️ Config Missing', 8);
    return;
  }

  const items = getMenuFromSheet().filter(i => i.item_id);
  if (!items.length) {
    SpreadsheetApp.getActiveSpreadsheet().toast('No items found in MENU tab.', '⚠️ Empty Menu', 5);
    return;
  }

  // For each item: upsert via Supabase REST
  let updated = 0, errors = 0;
  items.forEach(item => {
    try {
      const body = {
        name:        item.name,
        description: item.description || null,
        base_price:  parseFloat(item.base_price) || 0,
        status:      item.status || 'AVAILABLE',
        is_featured: item.is_featured === true || item.is_featured === 'TRUE',
        tags:        item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      const resp = UrlFetchApp.fetch(
        `${supabaseUrl}/rest/v1/menu_items?id=eq.${item.item_id}`,
        {
          method: 'patch',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          payload: JSON.stringify(body),
          muteHttpExceptions: true,
        }
      );
      if (resp.getResponseCode() < 300) updated++;
      else errors++;
    } catch (e) {
      errors++;
    }
  });

  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Updated ${updated} items. ${errors > 0 ? errors + ' errors.' : 'All successful!'}`,
    errors > 0 ? '⚠️ Partial Sync' : '✅ Menu Synced',
    6
  );
}


// ============================================================
// TYG POS — Staff.gs
// ============================================================

function getStaffFromSheet() {
  const sh = getSheet(TAB.STAFF);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1)
    .filter(r => r[0])
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
}

function syncStaffToSheet(staffData) {
  const sh = getSheet(TAB.STAFF);
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();

  const rows = (staffData.staff || []).map(s => [
    s.id, s.name || s.display_name, s.display_name, s.role,
    s.pin_hash, s.branch_id || '', s.is_active,
    s.last_login || '', s.created_at,
  ]);

  if (rows.length) sh.getRange(2, 1, rows.length, 9).setValues(rows);
  return { synced: rows.length };
}


// ============================================================
// TYG POS — Daily.gs
// ============================================================

function generateDailySummary() {
  const sh     = getSheet(TAB.ORDERS);
  const sumSh  = getSheet(TAB.DAILY_SUMMARY);
  const paidSh = getSheet(TAB.PAYMENTS);

  const today = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
  const data  = sh.getDataRange().getValues().slice(1); // skip header

  // Filter today's orders
  const todayOrders = data.filter(r => {
    const created = r[15]; // created_at col
    if (!created) return false;
    const d = new Date(created);
    return Utilities.formatDate(d, 'Asia/Manila', 'yyyy-MM-dd') === today;
  });

  const completed  = todayOrders.filter(r => r[11] === 'COMPLETED');
  const cancelled  = todayOrders.filter(r => r[11] === 'CANCELLED');
  const grossSales = completed.reduce((s, r) => s + (parseFloat(r[10]) || 0), 0);
  const vatColl    = completed.reduce((s, r) => s + (parseFloat(r[9])  || 0), 0);
  const avgOrder   = completed.length ? grossSales / completed.length : 0;

  // Top item — parse items_summary (col 7)
  const itemCounts = {};
  todayOrders.forEach(r => {
    const summary = r[6] || ''; // items_summary
    summary.split(', ').forEach(part => {
      const match = part.match(/^(.+)×(\d+)$/);
      if (match) {
        const name = match[1].trim();
        itemCounts[name] = (itemCounts[name] || 0) + parseInt(match[2]);
      }
    });
  });
  const topItem = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // Payment breakdown from PAYMENTS tab
  const pmtData = paidSh.getDataRange().getValues().slice(1);
  const todayPmt = pmtData.filter(r => {
    const d = new Date(r[12]);
    return Utilities.formatDate(d, 'Asia/Manila', 'yyyy-MM-dd') === today && r[10] === 'VERIFIED';
  });
  const byMethod = (method) => todayPmt
    .filter(r => r[3] === method)
    .reduce((s, r) => s + (parseFloat(r[4]) || 0), 0);

  const completionRate = todayOrders.length > 0 ? completed.length / todayOrders.length : 0;
  const now = new Date().toISOString();

  // Check if today already has a row
  const existingRow = findRowByValue(sumSh, 1, today);
  const row = [
    today, todayOrders.length, completed.length, cancelled.length, completionRate,
    grossSales, vatColl, avgOrder, topItem,
    byMethod('GCASH'), byMethod('MAYA'),
    byMethod('BPI') + byMethod('BDO') + byMethod('UNIONBANK'),
    byMethod('CASH'), now,
  ];

  if (existingRow > 0) {
    sumSh.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sumSh.appendRow(row);
  }

  return {
    date: today, totalOrders: todayOrders.length, completed: completed.length,
    grossSales, topItem,
  };
}

function sendDailyReport() {
  const summary = generateDailySummary();
  const ownerEmail = getConfig('OWNER_EMAIL');
  const tenantName  = getConfig('TENANT_NAME');

  if (!ownerEmail || ownerEmail === 'your@email.com') {
    SpreadsheetApp.getActiveSpreadsheet().toast('Set OWNER_EMAIL in CONFIG tab to receive reports.', '⚠️ No Email Set', 6);
    return;
  }

  const subject = `📊 Daily Summary — ${tenantName} — ${summary.date}`;
  const body = `
TYG POS Daily Summary
═══════════════════════════════
Business:    ${tenantName}
Date:        ${summary.date}

Total Orders:   ${summary.totalOrders}
Completed:      ${summary.completed}
Gross Sales:    ₱${Number(summary.grossSales).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
Top Item:       ${summary.topItem}
═══════════════════════════════

View full report in your POS Sheet:
${SpreadsheetApp.getActiveSpreadsheet().getUrl()}

— TYG POS Automated Report
www.tyg-services.com
  `.trim();

  GmailApp.sendEmail(ownerEmail, subject, body);
  SpreadsheetApp.getActiveSpreadsheet().toast(`Daily report sent to ${ownerEmail}`, '📧 Report Sent', 5);
}


// ============================================================
// TYG POS — Config.gs
// ============================================================

let _configCache = null;

function getConfig(key) {
  if (!_configCache) _configCache = buildConfigCache();
  return _configCache[key] || '';
}

function setConfig(key, value) {
  const sh = getSheet(TAB.CONFIG);
  const row = findRowByValue(sh, 1, key);
  if (row > 0) {
    sh.getRange(row, 2).setValue(value);
  } else {
    sh.appendRow([key, value, '']);
  }
  _configCache = null; // bust cache
}

function getAllConfig() {
  return buildConfigCache();
}

function buildConfigCache() {
  try {
    const sh = getSheet(TAB.CONFIG);
    const data = sh.getDataRange().getValues().slice(1);
    const cfg = {};
    data.forEach(r => { if (r[0]) cfg[String(r[0]).trim()] = String(r[1]).trim(); });
    return cfg;
  } catch (e) {
    return {};
  }
}
