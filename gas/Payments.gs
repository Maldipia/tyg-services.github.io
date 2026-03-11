// ============================================================
// TYG POS — Payments.gs
// Logs payments + routes proof images to processed/reject in Drive
// ============================================================

/**
 * Log a new payment proof upload to the PAYMENTS tab.
 * Called when customer uploads proof — file not yet moved.
 *
 * @param {Object} data
 *   payment_id, order_id, order_number, method, amount,
 *   proof_filename, supabase_file_path, supabase_storage_url
 */
function logPayment(data) {
  const sh = getSheet(TAB.PAYMENTS);
  const now = new Date().toISOString();

  sh.appendRow([
    data.payment_id,
    data.order_id,
    data.order_number,
    data.method,
    data.amount,
    data.proof_filename,
    data.supabase_storage_url || '',  // public URL from Supabase Storage
    'UPLOADED',                        // drive_status — not yet in Drive
    '',                                // verified_by
    '',                                // verified_at
    'PENDING_VERIFICATION',            // supabase_status
    '',                                // notes
    now,
  ]);

  return { logged: true, order_number: data.order_number };
}

/**
 * Verify a payment — move proof file to PAYMENT/processed/ in Drive.
 * Also updates the PAYMENTS and ORDERS tabs.
 *
 * @param {Object} data
 *   payment_id, order_id, order_number, verified_by,
 *   supabase_file_path (e.g. "tenantId/payment-proofs/filename.jpg")
 */
function verifyPayment(data) {
  const processedFolderId = getConfig('PROCESSED_FOLDER_ID');

  // ── Move file in Drive ────────────────────────────────────
  let driveUrl = '';
  let driveStatus = 'PROCESSED';

  try {
    const result = moveProofFile(data.supabase_file_path, data.order_number, processedFolderId, 'processed');
    driveUrl = result.url;
  } catch (err) {
    console.error('Drive move failed (verify):', err.message);
    driveStatus = 'ERROR';
  }

  // ── Update PAYMENTS tab ───────────────────────────────────
  const sh = getSheet(TAB.PAYMENTS);
  const row = findRowByValue(sh, 1, data.payment_id);
  if (row > 0) {
    const now = new Date().toISOString();
    sh.getRange(row, 7).setValue(driveUrl || sh.getRange(row, 7).getValue());
    sh.getRange(row, 8).setValue(driveStatus);
    sh.getRange(row, 9).setValue(data.verified_by || 'Staff');
    sh.getRange(row, 10).setValue(now);
    sh.getRange(row, 11).setValue('VERIFIED');
    // Green row highlight
    sh.getRange(row, 1, 1, 13).setBackground('#dcfce7');
  }

  // ── Update ORDERS tab payment_status ─────────────────────
  const ordSh = getSheet(TAB.ORDERS);
  const ordRow = findRowByValue(ordSh, 1, data.order_id);
  if (ordRow > 0) {
    ordSh.getRange(ordRow, 13).setValue('VERIFIED');
    ordSh.getRange(ordRow, 17).setValue(new Date().toISOString()); // updated_at
  }

  return { verified: true, driveStatus, driveUrl };
}

/**
 * Reject a payment — move proof file to PAYMENT/reject/ in Drive.
 *
 * @param {Object} data
 *   payment_id, order_id, order_number, rejected_by, reason,
 *   supabase_file_path
 */
function rejectPayment(data) {
  const rejectFolderId = getConfig('REJECT_FOLDER_ID');

  let driveUrl = '';
  let driveStatus = 'REJECTED';

  try {
    const result = moveProofFile(data.supabase_file_path, data.order_number, rejectFolderId, 'rejected');
    driveUrl = result.url;
  } catch (err) {
    console.error('Drive move failed (reject):', err.message);
    driveStatus = 'ERROR';
  }

  // ── Update PAYMENTS tab ───────────────────────────────────
  const sh = getSheet(TAB.PAYMENTS);
  const row = findRowByValue(sh, 1, data.payment_id);
  if (row > 0) {
    const now = new Date().toISOString();
    sh.getRange(row, 7).setValue(driveUrl || sh.getRange(row, 7).getValue());
    sh.getRange(row, 8).setValue(driveStatus);
    sh.getRange(row, 9).setValue(data.rejected_by || 'Staff');
    sh.getRange(row, 10).setValue(now);
    sh.getRange(row, 11).setValue('FAILED');
    sh.getRange(row, 12).setValue(data.reason || 'Rejected by staff');
    // Red row highlight
    sh.getRange(row, 1, 1, 13).setBackground('#fee2e2');
  }

  // ── Update ORDERS tab ─────────────────────────────────────
  const ordSh = getSheet(TAB.ORDERS);
  const ordRow = findRowByValue(ordSh, 1, data.order_id);
  if (ordRow > 0) {
    ordSh.getRange(ordRow, 13).setValue('FAILED');
    ordSh.getRange(ordRow, 17).setValue(new Date().toISOString());
  }

  return { rejected: true, driveStatus, driveUrl };
}

// ── Core Drive file move ──────────────────────────────────────

/**
 * Download file from Supabase Storage URL, save to Google Drive
 * under the PAYMENT folder, then move to processedFolder or rejectFolder.
 *
 * Returns: { fileId, url, filename }
 */
function moveProofFile(supabasePath, orderNumber, targetFolderId, action) {
  const supabaseUrl = getConfig('SUPABASE_URL');
  const serviceKey  = getConfig('SUPABASE_SERVICE_KEY');

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY not configured in CONFIG tab');
  }

  // ── Download from Supabase Storage ───────────────────────
  const downloadUrl = `${supabaseUrl}/storage/v1/object/payment-proofs/${supabasePath}`;
  const resp = UrlFetchApp.fetch(downloadUrl, {
    method: 'get',
    headers: { 'Authorization': `Bearer ${serviceKey}` },
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() !== 200) {
    throw new Error(`Supabase Storage download failed: ${resp.getResponseCode()} — ${resp.getContentText()}`);
  }

  // ── Determine file extension + MIME ──────────────────────
  const contentType = resp.getHeaders()['Content-Type'] || 'image/jpeg';
  const ext = contentType.includes('png') ? '.png'
    : contentType.includes('webp') ? '.webp'
    : contentType.includes('heic') ? '.heic' : '.jpg';

  const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyyMMdd_HHmmss');
  const filename  = `${orderNumber}_${timestamp}_${action.toUpperCase()}${ext}`;

  // ── Save to target Drive folder ───────────────────────────
  const folder = DriveApp.getFolderById(targetFolderId);
  const blob   = resp.getBlob().setName(filename);
  const file   = folder.createFile(blob);

  // Make file viewable by anyone with link (for staff review)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    fileId:   file.getId(),
    url:      file.getUrl(),
    filename: filename,
  };
}

// ── Shared helpers ────────────────────────────────────────────

function getSheet(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(tabName);
  if (!sh) throw new Error(`Tab "${tabName}" not found. Run Setup first.`);
  return sh;
}

/**
 * Find the row index (1-based) where column `col` matches `value`.
 * Returns 0 if not found.
 */
function findRowByValue(sh, col, value) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col - 1]) === String(value)) return i + 1;
  }
  return 0;
}
