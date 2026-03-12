// ============================================================
// TYG POS — System Logs (SYSTEM_LOGS sheet)
// Handles APPEND_SYSTEM_LOG action from logEvent() in backend
// ============================================================

var SYSTEM_LOGS_SHEET = 'SYSTEM_LOGS';

var SYSTEM_LOG_HEADERS = [
  'TIMESTAMP',
  'EVENT_TYPE',
  'TENANT_ID',
  'BRANCH_ID',
  'USER_ID',
  'USER_NAME',
  'ACTION_SOURCE',
  'ENTITY_TYPE',
  'ENTITY_ID',
  'STATUS',
  'DETAILS_JSON',
  'LOG_ID',
];

// ── Setup SYSTEM_LOGS sheet (call once from Setup menu) ───────

function setupSystemLogsSheet() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheet  = ss.getSheetByName(SYSTEM_LOGS_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(SYSTEM_LOGS_SHEET);
  }

  // Clear and set headers
  sheet.clearContents();
  var headerRow = sheet.getRange(1, 1, 1, SYSTEM_LOG_HEADERS.length);
  headerRow.setValues([SYSTEM_LOG_HEADERS]);

  // Style header row
  headerRow.setBackground('#1a1f2e');
  headerRow.setFontColor('#22c55e');
  headerRow.setFontWeight('bold');
  headerRow.setFontSize(10);

  // Freeze header
  sheet.setFrozenRows(1);

  // Column widths
  sheet.setColumnWidth(1, 160);  // TIMESTAMP
  sheet.setColumnWidth(2, 200);  // EVENT_TYPE
  sheet.setColumnWidth(3, 260);  // TENANT_ID
  sheet.setColumnWidth(4, 260);  // BRANCH_ID
  sheet.setColumnWidth(5, 260);  // USER_ID
  sheet.setColumnWidth(6, 130);  // USER_NAME
  sheet.setColumnWidth(7, 120);  // ACTION_SOURCE
  sheet.setColumnWidth(8, 140);  // ENTITY_TYPE
  sheet.setColumnWidth(9, 260);  // ENTITY_ID
  sheet.setColumnWidth(10, 90);  // STATUS
  sheet.setColumnWidth(11, 400); // DETAILS_JSON
  sheet.setColumnWidth(12, 260); // LOG_ID

  // Alternating row colors via conditional formatting
  var range = sheet.getRange('A2:L1000');
  range.setBackground('#0f1117');
  range.setFontColor('#c8ccd4');
  range.setFontSize(9);

  // Color rules for STATUS column (col 10)
  var rules = sheet.getConditionalFormatRules();
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('SUCCESS')
      .setFontColor('#22c55e')
      .setRanges([sheet.getRange('J2:J1000')])
      .build()
  );
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('FAILURE')
      .setFontColor('#ef4444')
      .setRanges([sheet.getRange('J2:J1000')])
      .build()
  );
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('WARNING')
      .setFontColor('#f59e0b')
      .setRanges([sheet.getRange('J2:J1000')])
      .build()
  );
  sheet.setConditionalFormatRules(rules);

  return { ok: true, message: 'SYSTEM_LOGS sheet created' };
}

// ── Append a single log row ────────────────────────────────────

function appendSystemLog(data) {
  if (!data) return { ok: false, error: 'No data' };

  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SYSTEM_LOGS_SHEET);

    // Auto-create sheet if missing
    if (!sheet) {
      setupSystemLogsSheet();
      sheet = ss.getSheetByName(SYSTEM_LOGS_SHEET);
    }

    // Format timestamp for readability
    var ts = data.timestamp ? new Date(data.timestamp) : new Date();
    var tsFormatted = Utilities.formatDate(ts, 'Asia/Manila', 'yyyy-MM-dd HH:mm:ss');

    // Format details — truncate to 1000 chars to avoid cell overflow
    var detailsStr = '';
    try {
      detailsStr = JSON.stringify(data.details || {});
      if (detailsStr.length > 1000) detailsStr = detailsStr.substring(0, 997) + '...';
    } catch (e) {
      detailsStr = String(data.details || '');
    }

    var row = [
      tsFormatted,
      data.eventType   || '',
      data.tenantId    || '',
      data.branchId    || '',
      data.userId      || '',
      data.userName    || '',
      data.source      || 'API',
      data.entityType  || '',
      data.entityId    || '',
      data.status      || 'SUCCESS',
      detailsStr,
      data.logId       || '',
    ];

    sheet.appendRow(row);

    // Color the STATUS cell based on value
    var lastRow = sheet.getLastRow();
    var statusCell = sheet.getRange(lastRow, 10);
    if (data.status === 'FAILURE') {
      statusCell.setBackground('rgba(239,68,68,0.15)');
    }

    return { ok: true, row: lastRow };

  } catch (err) {
    console.error('appendSystemLog error:', err);
    return { ok: false, error: err.toString() };
  }
}

// ── Batch append (for cron retry) ─────────────────────────────

function batchAppendSystemLogs(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: true, count: 0 };
  var results = rows.map(function(r) { return appendSystemLog(r); });
  var succeeded = results.filter(function(r) { return r.ok; }).length;
  return { ok: true, count: succeeded, total: rows.length };
}

// ── Query logs by event type (for dashboards) ──────────────────

function getSystemLogsSummary() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SYSTEM_LOGS_SHEET);
  if (!sheet) return { ok: false, error: 'SYSTEM_LOGS sheet not found' };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, rows: 0, summary: {} };

  var summary = {};
  var today = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');

  for (var i = 1; i < data.length; i++) {
    var row   = data[i];
    var ts    = String(row[0]);
    var event = String(row[1]);

    if (!ts.startsWith(today)) continue; // today only
    summary[event] = (summary[event] || 0) + 1;
  }

  return { ok: true, rows: data.length - 1, todaySummary: summary };
}
