// ============================================================
// TYG POS SaaS — Google Apps Script Backend
// File: Code.gs — Web App Entry Point
// Domain: www.tyg-services.com
// ============================================================

const SCRIPT_VERSION = '1.0.0';

/**
 * HTTP POST handler — receives webhooks from Next.js SaaS
 * Deploy as Web App: Execute as Me, Access: Anyone with link
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // ── HMAC verification ──────────────────────────────────
    const sig   = e.parameter.sig || (e.postData.headers && e.postData.headers['x-tyg-signature']) || '';
    const secret = getConfig('SCRIPT_SECRET');
    if (secret && !verifyHmac(e.postData.contents, sig, secret)) {
      return jsonResponse({ ok: false, error: 'Invalid signature' }, 401);
    }

    const { action } = payload;
    let result;

    switch (action) {
      case 'LOG_ORDER':          result = logOrder(payload.data);         break;
      case 'UPDATE_ORDER':       result = updateOrderStatus(payload.data); break;
      case 'LOG_PAYMENT':        result = logPayment(payload.data);        break;
      case 'VERIFY_PAYMENT':     result = verifyPayment(payload.data);     break;
      case 'REJECT_PAYMENT':     result = rejectPayment(payload.data);     break;
      case 'SYNC_MENU_TO_SHEET': result = syncMenuToSheet(payload.data);   break;
      case 'SYNC_MENU_TO_SUPA':  result = syncMenuToSupabase();            break;
      case 'DAILY_SUMMARY':      result = generateDailySummary();          break;
      case 'SETUP':              result = setupSheet();                    break;
      default:
        return jsonResponse({ ok: false, error: `Unknown action: ${action}` }, 400);
    }

    return jsonResponse({ ok: true, action, result });

  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

/**
 * HTTP GET handler — health check + menu fetch
 */
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'health') {
    return jsonResponse({
      ok: true,
      version: SCRIPT_VERSION,
      timestamp: new Date().toISOString(),
      sheet: SpreadsheetApp.getActiveSpreadsheet().getName(),
    });
  }

  if (action === 'menu') {
    return jsonResponse({ ok: true, data: getMenuFromSheet() });
  }

  return jsonResponse({ ok: true, message: 'TYG POS Apps Script v' + SCRIPT_VERSION });
}

/**
 * onOpen — adds TYG POS menu to the spreadsheet UI
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🍃 TYG POS')
    .addItem('⚙️  Setup Sheet (first time)', 'setupSheet')
    .addSeparator()
    .addItem('📤  Sync Menu → Supabase', 'syncMenuToSupabase')
    .addItem('📥  Pull Orders from Supabase', 'syncOrdersFromSupabase')
    .addSeparator()
    .addItem('📊  Generate Daily Summary', 'generateDailySummary')
    .addItem('📧  Send Daily Report Email', 'sendDailyReport')
    .addSeparator()
    .addItem('🔧  View Config', 'showConfig')
    .addToUi();
}

// ── Helpers ──────────────────────────────────────────────────

function jsonResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function verifyHmac(body, signature, secret) {
  try {
    const mac = Utilities.computeHmacSha256Signature(body, secret);
    const hex = mac.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
    return hex === signature;
  } catch (e) {
    return false;
  }
}

function showConfig() {
  const cfg = getAllConfig();
  const msg = Object.entries(cfg)
    .map(([k, v]) => `${k}: ${k.includes('KEY') || k.includes('SECRET') ? '***' : v}`)
    .join('\n');
  SpreadsheetApp.getUi().alert('TYG POS Config', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ── Nightly trigger registration ─────────────────────────────

function createNightlyTrigger() {
  // Call once from menu to register the nightly summary trigger
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'generateDailySummary') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('generateDailySummary')
    .timeBased()
    .atHour(23)
    .nearMinute(55)
    .everyDays(1)
    .inTimezone('Asia/Manila')
    .create();
  SpreadsheetApp.getUi().alert('Nightly trigger created (11:55 PM PHT)');
}
