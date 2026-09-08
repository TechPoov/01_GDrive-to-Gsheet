/**
 * 14_Log.gs
 * Centralized, concise operational Log writing (Log Design doc 08).
 * One shared Log sheet across all ScanKeys. Newest entries first.
 */

/** Ensures the Log sheet exists with the frozen header/formatting. */
function ensureLogSheet_(ss) {
  var sheet = getSheetSafe_(ss, SHEET_LOG);
  var isNew = !sheet;
  if (isNew) sheet = getOrCreateSheet_(ss, SHEET_LOG);
  if (isNew || getHeaderRow_(sheet).length === 0) {
    writeHeaderRow_(sheet, ['DateTime', 'ScanKey', 'Action', 'Status', 'Message']);
    setColumnWidths_(sheet, [
      { col: 1, width: 150 }, { col: 2, width: 220 }, { col: 3, width: 140 },
      { col: 4, width: 90 }, { col: 5, width: 480 }
    ]);
  }
  return sheet;
}

/**
 * Writes one concise operational Log entry. scanKey may be '' for
 * workbook-level/non-ScanKey-specific actions (Log Design §6).
 */
function writeLog_(scanKey, action, status, message) {
  try {
    var ss = getSpreadsheet_();
    var sheet = ensureLogSheet_(ss);
    var row = [formatDateTime_(new Date()), scanKey || '', action, status, message || ''];
    insertRowAtTop_(sheet, row);
  } catch (e) {
    // Per Validation & Error Handling Design §56: a Log write failure must
    // not be allowed to take down otherwise-valid processing. Best-effort
    // fallback to Dev_Log so the failure is at least diagnosable.
    try { writeDevLog_(scanKey, '14_Log.gs::writeLog_', DEV_LOG_EVENT.ERROR, 'Log write failed', extractExceptionMessage_(e)); } catch (e2) {}
  }
}

/** Convenience: SCAN_DRIVE / STARTED entry (Log Design §15). */
function logScanStarted_(scanKey, startDateTime) {
  writeLog_(scanKey, LOG_ACTION.SCAN_DRIVE, LOG_STATUS.STARTED, 'Started at: ' + formatDateTime_(startDateTime));
}

/** Convenience: final SCAN_DRIVE entry for any terminal severity. */
function logScanFinal_(scanKey, status, message) {
  writeLog_(scanKey, LOG_ACTION.SCAN_DRIVE, status, message);
}
