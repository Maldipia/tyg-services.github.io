// ============================================================
// TYG POS — Autoconfig.gs
// One-click setup: registers all triggers, creates Drive folders,
// validates CONFIG tab, and links everything together.
// Run autoSetup() once from the TYG POS menu after initial setup.
// ============================================================

/**
 * Master setup function. Run once after setting up CONFIG tab.
 * Creates Drive folders, registers time triggers, validates config.
 */
function autoSetup() {
  const ui = SpreadsheetApp.getUi();

  try {
    const results = [];

    // 1. Validate required config keys
    const validation = validateConfig();
    if (!validation.valid) {
      ui.alert(
        '⚠️ Config Incomplete',
        'Please fill in CONFIG tab first:\n\n' + validation.missing.join('\n'),
        ui.ButtonSet.OK
      );
      return;
    }
    results.push('✅ Config validated');

    // 2. Create Drive folder structure
    const folders = setupDriveFolders();
    results.push('✅ Drive folders: ' + folders.join(', '));

    // 3. Register all time-based triggers (remove old ones first)
    registerTriggers();
    results.push('✅ Triggers registered (nightly sync + daily report)');

    // 4. Update CONFIG tab with auto-populated values
    updateConfigValue('POS_SHEET_ID', SpreadsheetApp.getActiveSpreadsheet().getId());
    results.push('✅ POS_SHEET_ID saved to CONFIG');

    // 5. Initial sync from Supabase
    const syncResult = syncAllFromSupabase();
    if (syncResult) {
      results.push('✅ Initial sync: ' + syncResult.orders + ' orders, ' + syncResult.menu + ' menu items');
    }

    ui.alert(
      '🎉 TYG POS Autoconfig Complete',
      results.join('\n') + '\n\nYour sheet is ready for live operations!',
      ui.ButtonSet.OK
    );

  } catch (err) {
    ui.alert('❌ Autoconfig Error', err.message + '\n\nCheck Apps Script logs for details.', ui.ButtonSet.OK);
    console.error('autoSetup error:', err);
  }
}

// ── Trigger management ────────────────────────────────────────

/**
 * Register all time-based triggers. Removes duplicates first.
 */
function registerTriggers() {
  const triggerFunctions = ['runNightlySync', 'generateDailySummary', 'sendDailyReport'];

  // Remove any existing triggers for our functions
  ScriptApp.getProjectTriggers().forEach(t => {
    if (triggerFunctions.includes(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Nightly sync at 11:45 PM PHT (pulls orders + payments)
  ScriptApp.newTrigger('runNightlySync')
    .timeBased()
    .atHour(23)
    .nearMinute(45)
    .everyDays(1)
    .inTimezone('Asia/Manila')
    .create();

  // Daily summary generation at 11:55 PM PHT
  ScriptApp.newTrigger('generateDailySummary')
    .timeBased()
    .atHour(23)
    .nearMinute(55)
    .everyDays(1)
    .inTimezone('Asia/Manila')
    .create();

  // Daily report email at 12:00 AM PHT (next day)
  ScriptApp.newTrigger('sendDailyReport')
    .timeBased()
    .atHour(0)
    .nearMinute(5)
    .everyDays(1)
    .inTimezone('Asia/Manila')
    .create();

  console.log('Triggers registered: runNightlySync (11:45 PM), generateDailySummary (11:55 PM), sendDailyReport (12:05 AM)');
}

/**
 * Remove all project triggers (emergency reset).
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  SpreadsheetApp.getActiveSpreadsheet().toast(
    triggers.length + ' triggers removed.',
    '🔧 Triggers Cleared', 4
  );
}

/**
 * Show current trigger status in a dialog.
 */
function showTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  const ui = SpreadsheetApp.getUi();

  if (!triggers.length) {
    ui.alert('No triggers registered. Run Autoconfig to set them up.', '⚠️ No Triggers', ui.ButtonSet.OK);
    return;
  }

  const lines = triggers.map(t => {
    const src = t.getTriggerSource();
    return `• ${t.getHandlerFunction()} (${src})`;
  });

  ui.alert('Active Triggers', lines.join('\n'), ui.ButtonSet.OK);
}

// ── Drive folder setup ────────────────────────────────────────

/**
 * Create PAYMENT / processed / reject folder structure in Drive.
 * Updates CONFIG tab with folder IDs automatically.
 */
function setupDriveFolders() {
  const paymentFolderName   = 'TYG POS — Payments';
  const processedFolderName = 'processed';
  const rejectFolderName    = 'reject';

  // Root: TYG POS — Payments folder
  let paymentFolder;
  const existingPayment = DriveApp.getFoldersByName(paymentFolderName);
  if (existingPayment.hasNext()) {
    paymentFolder = existingPayment.next();
  } else {
    paymentFolder = DriveApp.createFolder(paymentFolderName);
  }
  updateConfigValue('PAYMENT_FOLDER_ID', paymentFolder.getId());

  // processed/ subfolder
  let processedFolder;
  const existingProcessed = paymentFolder.getFoldersByName(processedFolderName);
  if (existingProcessed.hasNext()) {
    processedFolder = existingProcessed.next();
  } else {
    processedFolder = paymentFolder.createFolder(processedFolderName);
  }
  updateConfigValue('PROCESSED_FOLDER_ID', processedFolder.getId());

  // reject/ subfolder
  let rejectFolder;
  const existingReject = paymentFolder.getFoldersByName(rejectFolderName);
  if (existingReject.hasNext()) {
    rejectFolder = existingReject.next();
  } else {
    rejectFolder = paymentFolder.createFolder(rejectFolderName);
  }
  updateConfigValue('REJECT_FOLDER_ID', rejectFolder.getId());

  console.log('Drive folders created/found:', paymentFolder.getId(), processedFolder.getId(), rejectFolder.getId());
  return [paymentFolderName, processedFolderName, rejectFolderName];
}

// ── Config validation ─────────────────────────────────────────

/**
 * Validate that required CONFIG keys are filled in.
 * Returns { valid: boolean, missing: string[] }
 */
function validateConfig() {
  const required = [
    { key: 'TENANT_SLUG',          label: 'TENANT_SLUG (e.g. yani)' },
    { key: 'SUPABASE_URL',         label: 'SUPABASE_URL',     skipIf: 'YOUR_PROJECT' },
    { key: 'SUPABASE_SERVICE_KEY', label: 'SUPABASE_SERVICE_KEY', skipIf: 'PASTE_' },
    { key: 'SCRIPT_SECRET',        label: 'SCRIPT_SECRET',    skipIf: 'GENERATE_' },
    { key: 'OWNER_EMAIL',          label: 'OWNER_EMAIL' },
  ];

  const missing = [];

  required.forEach(({ key, label, skipIf }) => {
    const val = getConfig(key);
    if (!val || (skipIf && val.includes(skipIf))) {
      missing.push('• ' + label);
    }
  });

  return { valid: missing.length === 0, missing };
}

/**
 * Update a single CONFIG tab key value.
 */
function updateConfigValue(key, value) {
  const sh   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.CONFIG);
  if (!sh) return;
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sh.getRange(i + 1, 2).setValue(value).setBackground('#d1fae5').setFontColor('#065f46');
      return;
    }
  }
  // Key not found — append it
  sh.appendRow([key, value, 'Auto-populated by Autoconfig']);
}

// ── Health check ──────────────────────────────────────────────

/**
 * Full health check — config, triggers, Supabase connectivity.
 * Run from TYG POS menu to diagnose issues.
 */
function runHealthCheck() {
  const ui      = SpreadsheetApp.getUi();
  const results = [];

  // 1. Config validation
  const validation = validateConfig();
  results.push(validation.valid
    ? '✅ CONFIG — all required keys filled'
    : '❌ CONFIG — missing: ' + validation.missing.join(', ')
  );

  // 2. Triggers
  const triggers = ScriptApp.getProjectTriggers();
  results.push(triggers.length > 0
    ? '✅ TRIGGERS — ' + triggers.length + ' active'
    : '⚠️ TRIGGERS — none registered (run Autoconfig)'
  );

  // 3. Supabase connectivity
  try {
    const supabaseUrl = getConfig('SUPABASE_URL');
    const serviceKey  = getConfig('SUPABASE_SERVICE_KEY');
    if (supabaseUrl && !supabaseUrl.includes('YOUR_PROJECT') && serviceKey && !serviceKey.includes('PASTE_')) {
      const resp = UrlFetchApp.fetch(
        supabaseUrl + '/rest/v1/tenants?select=id&limit=1',
        {
          headers: { 'Authorization': 'Bearer ' + serviceKey, 'apikey': serviceKey },
          muteHttpExceptions: true,
        }
      );
      results.push(resp.getResponseCode() === 200
        ? '✅ SUPABASE — connected'
        : '❌ SUPABASE — HTTP ' + resp.getResponseCode()
      );
    } else {
      results.push('⚠️ SUPABASE — not configured yet');
    }
  } catch (e) {
    results.push('❌ SUPABASE — ' + e.message);
  }

  // 4. Sheet tabs
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const required = Object.values(TAB);
  const present  = required.filter(name => ss.getSheetByName(name));
  results.push(present.length === required.length
    ? '✅ SHEETS — all ' + required.length + ' tabs present'
    : '⚠️ SHEETS — missing: ' + required.filter(n => !present.includes(n)).join(', ')
  );

  // 5. Script URL check
  try {
    const url = ScriptApp.getService().getUrl();
    results.push(url
      ? '✅ WEB APP — deployed at ' + url.slice(0, 60) + '...'
      : '⚠️ WEB APP — not yet deployed (Deploy → New deployment)'
    );
  } catch (e) {
    results.push('⚠️ WEB APP — status unknown');
  }

  ui.alert('🔍 TYG POS Health Check', results.join('\n'), ui.ButtonSet.OK);
}

// ── onOpen menu additions ─────────────────────────────────────
// These entries are merged into the main onOpen() in Code.gs at runtime.
// If you move onOpen() here, delete it from Code.gs.
//
// Additional menu items added when autoconfig is present:
//   .addItem('🔧  Autoconfig (first-time setup)', 'autoSetup')
//   .addItem('❤️  Health Check', 'runHealthCheck')
//   .addItem('⚡  Trigger Status', 'showTriggerStatus')
//   .addItem('🗑️  Remove All Triggers', 'removeAllTriggers')
