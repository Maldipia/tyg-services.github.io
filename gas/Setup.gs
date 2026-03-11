// ============================================================
// TYG POS — Setup.gs
// Creates and formats all 6 tabs. Run once from the TYG POS menu.
// ============================================================

const TAB = {
  ORDERS:        'ORDERS',
  MENU:          'MENU',
  STAFF:         'STAFF',
  PAYMENTS:      'PAYMENTS',
  DAILY_SUMMARY: 'DAILY_SUMMARY',
  CONFIG:        'CONFIG',
};

const TAB_COLOR = {
  ORDERS:        '#16a34a',
  MENU:          '#2563eb',
  STAFF:         '#7c3aed',
  PAYMENTS:      '#f59e0b',
  DAILY_SUMMARY: '#dc2626',
  CONFIG:        '#374151',
};

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create/get all tabs
  Object.values(TAB).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.setTabColor(TAB_COLOR[name]);
    sh.clearContents();
  });

  setupOrdersTab(ss);
  setupMenuTab(ss);
  setupStaffTab(ss);
  setupPaymentsTab(ss);
  setupDailySummaryTab(ss);
  setupConfigTab(ss);

  // Move Sheet1 to end and rename if still exists
  const default_ = ss.getSheetByName('Sheet1');
  if (default_) {
    default_.setName('_archive');
    ss.moveActiveSheet(ss.getNumSheets());
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'All 6 tabs created successfully. Fill in CONFIG tab folder IDs before going live.',
    '✅ TYG POS Setup Complete',
    10
  );
}

// ── ORDERS Tab ───────────────────────────────────────────────

function setupOrdersTab(ss) {
  const sh = ss.getSheetByName(TAB.ORDERS);
  const headers = [
    'order_id', 'order_number', 'table_qr', 'customer_name', 'customer_phone',
    'pax', 'items_summary', 'items_json', 'subtotal', 'vat', 'total',
    'status', 'payment_status', 'payment_method', 'branch_id',
    'created_at', 'updated_at', 'notes',
  ];
  applyHeaders(sh, headers, '#16a34a');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 280);   // order_id UUID
  sh.setColumnWidth(2, 100);   // order_number
  sh.setColumnWidth(7, 200);   // items_summary
  sh.setColumnWidth(8, 0);     // items_json — hidden
  sh.hideColumns(8);
  // Status validation
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['PENDING','CONFIRMED','PREPARING','READY','COMPLETED','CANCELLED'])
    .setAllowInvalid(false).build();
  sh.getRange('L2:L10000').setDataValidation(statusRule);
  // Payment status validation
  const pmtRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['PENDING','PENDING_VERIFICATION','VERIFIED','FAILED','REFUNDED'])
    .setAllowInvalid(false).build();
  sh.getRange('M2:M10000').setDataValidation(pmtRule);
}

// ── MENU Tab ─────────────────────────────────────────────────

function setupMenuTab(ss) {
  const sh = ss.getSheetByName(TAB.MENU);
  const headers = [
    'item_id', 'category', 'name', 'description', 'base_price',
    'status', 'is_featured', 'tags', 'image_url', 'sort_order', 'created_at',
  ];
  applyHeaders(sh, headers, '#2563eb');
  sh.setFrozenRows(1);
  sh.setColumnWidth(3, 200);
  sh.setColumnWidth(4, 250);

  // Status dropdown
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['AVAILABLE', 'SOLD_OUT', 'HIDDEN'])
    .setAllowInvalid(false).build();
  sh.getRange('F2:F1000').setDataValidation(statusRule);

  // Featured checkbox
  sh.getRange('G2:G1000').insertCheckboxes();

  // Add Sync button
  addButton(sh, 'Sync to Supabase', 'syncMenuToSupabase', 2, 13);
}

// ── STAFF Tab ────────────────────────────────────────────────

function setupStaffTab(ss) {
  const sh = ss.getSheetByName(TAB.STAFF);
  const headers = [
    'staff_id', 'name', 'display_name', 'role', 'pin_hash',
    'branch_id', 'is_active', 'last_login', 'created_at',
  ];
  applyHeaders(sh, headers, '#7c3aed');
  sh.setFrozenRows(1);
  sh.setColumnWidth(5, 300); // pin_hash

  // Role dropdown
  const roleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN'])
    .setAllowInvalid(false).build();
  sh.getRange('D2:D500').setDataValidation(roleRule);
  sh.getRange('G2:G500').insertCheckboxes();

  // Protect pin_hash column from accidental edits
  const protection = sh.getRange('E2:E500').protect();
  protection.setDescription('PIN Hashes — Do not edit manually');
  protection.setWarningOnly(true);
}

// ── PAYMENTS Tab ─────────────────────────────────────────────

function setupPaymentsTab(ss) {
  const sh = ss.getSheetByName(TAB.PAYMENTS);
  const headers = [
    'payment_id', 'order_id', 'order_number', 'method', 'amount',
    'proof_filename', 'proof_drive_url', 'drive_status',
    'verified_by', 'verified_at', 'supabase_status', 'notes', 'created_at',
  ];
  applyHeaders(sh, headers, '#f59e0b');
  sh.setFrozenRows(1);
  sh.setColumnWidth(6, 250);
  sh.setColumnWidth(7, 300);

  // Drive status dropdown
  const driveRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['UPLOADED', 'PROCESSED', 'REJECTED', 'ERROR'])
    .setAllowInvalid(false).build();
  sh.getRange('H2:H5000').setDataValidation(driveRule);

  // Method dropdown
  const methodRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['GCASH', 'MAYA', 'BPI', 'BDO', 'UNIONBANK', 'CASH'])
    .setAllowInvalid(false).build();
  sh.getRange('D2:D5000').setDataValidation(methodRule);
}

// ── DAILY_SUMMARY Tab ────────────────────────────────────────

function setupDailySummaryTab(ss) {
  const sh = ss.getSheetByName(TAB.DAILY_SUMMARY);
  const headers = [
    'date', 'total_orders', 'completed', 'cancelled', 'completion_rate',
    'gross_sales', 'vat_collected', 'avg_order_value', 'top_item',
    'gcash_sales', 'maya_sales', 'bank_sales', 'cash_sales', 'generated_at',
  ];
  applyHeaders(sh, headers, '#dc2626');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 100);  // date
  sh.setColumnWidth(6, 120);  // gross_sales
  sh.setColumnWidth(9, 200);  // top_item

  // Format currency columns
  const currCols = [6, 7, 8, 10, 11, 12, 13];
  currCols.forEach(col => {
    sh.getRange(2, col, 1000, 1).setNumberFormat('₱#,##0.00');
  });
  // Percentage
  sh.getRange('E2:E1000').setNumberFormat('0.0%');
}

// ── CONFIG Tab ───────────────────────────────────────────────

function setupConfigTab(ss) {
  const sh = ss.getSheetByName(TAB.CONFIG);
  const headers = ['key', 'value', 'description'];
  applyHeaders(sh, headers, '#374151');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 340);
  sh.setColumnWidth(3, 320);

  const defaults = [
    ['TENANT_SLUG',         'yani',                                          'Your TYG POS tenant slug'],
    ['TENANT_NAME',         'YANI Garden Café',                              'Business display name'],
    ['PAYMENT_FOLDER_ID',   '1DwWjYMaJZSWfSGzhY0BqNPtxJBicFCiS',            'Google Drive PAYMENT folder ID'],
    ['PROCESSED_FOLDER_ID', 'PASTE_PROCESSED_FOLDER_ID_HERE',                'Google Drive processed/ subfolder ID'],
    ['REJECT_FOLDER_ID',    'PASTE_REJECT_FOLDER_ID_HERE',                   'Google Drive reject/ subfolder ID'],
    ['POS_SHEET_ID',        '13Zim0xX8aoatUXbKhN1oDVT7d1j8qloc_lk1fUnHQZA', 'This Google Sheet ID'],
    ['SUPABASE_URL',        'https://YOUR_PROJECT.supabase.co',              'Supabase project URL'],
    ['SUPABASE_SERVICE_KEY','PASTE_SERVICE_ROLE_KEY_HERE',                   '⚠️ Keep secret — bypass RLS'],
    ['SCRIPT_SECRET',       'GENERATE_A_RANDOM_SECRET_HERE',                 'HMAC secret — must match GOOGLE_SCRIPT_SECRET in Vercel'],
    ['OWNER_EMAIL',         'your@email.com',                                'Receives daily summary reports'],
    ['VAT_RATE',            '0.12',                                          'VAT rate (0.12 = 12%)'],
    ['TIMEZONE',            'Asia/Manila',                                   'Timezone for date calculations'],
    ['DAILY_REPORT_HOUR',   '23',                                            'Hour to generate daily summary (24hr, PHT)'],
  ];

  sh.getRange(2, 1, defaults.length, 3).setValues(defaults);

  // Highlight cells needing action
  const needsAction = [3, 4, 5, 8, 9, 10]; // 1-indexed rows that have PASTE_ or YOUR_
  needsAction.forEach(r => {
    sh.getRange(r + 1, 2).setBackground('#fef3c7').setFontColor('#92400e');
  });

  // Protect this sheet with warning
  const protection = sh.protect();
  protection.setDescription('CONFIG — edit values in column B only');
  protection.setWarningOnly(true);
}

// ── Shared helpers ───────────────────────────────────────────

function applyHeaders(sh, headers, color) {
  const range = sh.getRange(1, 1, 1, headers.length);
  range.setValues([headers])
    .setFontWeight('bold')
    .setFontColor('#FFFFFF')
    .setBackground(color)
    .setFontSize(10)
    .setHorizontalAlignment('center');
  sh.setRowHeight(1, 28);
}

function addButton(sh, label, functionName, row, col) {
  const drawings = sh.getDrawings();
  // Remove existing button with same label if any
  drawings.forEach(d => { try { if (d.getAltTextTitle() === label) d.remove(); } catch(e) {} });

  const btn = sh.insertButton(label, functionName, SpreadsheetApp.Position.AFTER_LAST_ROW);
  // Note: Sheets API button placement is approximate
}
