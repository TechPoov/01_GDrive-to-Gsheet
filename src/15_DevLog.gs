/**
 * 15_DevLog.gs
 * Centralized detailed DEV_MODE diagnostics (Dev_Log Design doc 09).
 * Buffered in memory during one physical execution and flushed in
 * batches to minimize spreadsheet writes (Dev_Log Design §49,
 * Technical Architecture §60-61). When DEV_MODE is false, writeDevLog_
 * returns immediately with minimal overhead.
 */

var __devLogBuffer_ = [];

/** Ensures the Dev_Log sheet exists with the frozen header/formatting. */
function ensureDevLogSheet_(ss) {
  var sheet = getSheetSafe_(ss, SHEET_DEV_LOG);
  var isNew = !sheet;
  if (isNew) sheet = getOrCreateSheet_(ss, SHEET_DEV_LOG);
  if (isNew || getHeaderRow_(sheet).length === 0) {
    writeHeaderRow_(sheet, ['DateTime', 'ScanKey', 'Function', 'Event', 'Message', 'Details']);
    setColumnWidths_(sheet, [
      { col: 1, width: 150 }, { col: 2, width: 200 }, { col: 3, width: 260 },
      { col: 4, width: 100 }, { col: 5, width: 320 }, { col: 6, width: 320 }
    ]);
  }
  return sheet;
}

/**
 * Records one detailed diagnostic entry. No-ops immediately when
 * DEV_MODE is false (Dev_Log Design §3, config.gs Design §9).
 * functionName should use the "filename::function_name" convention
 * (Technical Architecture §6).
 */
function writeDevLog_(scanKey, functionName, event, message, details) {
  if (!DEV_MODE) return;
  __devLogBuffer_.push([
    formatDateTime_(new Date()),
    scanKey || '',
    functionName || '',
    event || DEV_LOG_EVENT.INFO,
    message || '',
    safeStringify_(details, 2000)
  ]);
  if (__devLogBuffer_.length >= DEV_LOG_BATCH_SIZE) {
    flushDevLogBuffer_();
  }
}

/**
 * Writes all buffered Dev_Log entries to the sheet in one batch and
 * clears the buffer. Safe to call even when DEV_MODE is false or the
 * buffer is empty (no-op). Must be called at safe checkpoints (end of
 * Profile processing, before continuation save, and in orchestration
 * finally blocks) so diagnostics are not lost between executions.
 */
function flushDevLogBuffer_() {
  if (__devLogBuffer_.length === 0) return;
  try {
    var ss = getSpreadsheet_();
    var sheet = ensureDevLogSheet_(ss);
    // Newest-first: reverse the buffer (it was appended oldest-last)
    // before inserting so the most recent entry ends up directly under
    // the header, matching Log's newest-first convention.
    var rows = __devLogBuffer_.slice().reverse();
    insertRowsAtTop_(sheet, rows);
  } catch (e) {
    // Dev_Log is diagnostic only — per Validation & Error Handling
    // Design §57, a Dev_Log failure must never break primary processing.
  } finally {
    __devLogBuffer_ = [];
  }
}

function devLogEnter_(scanKey, functionName, details) {
  writeDevLog_(scanKey, functionName, DEV_LOG_EVENT.ENTER, 'Entered ' + functionName.split('::')[1], details);
}

function devLogExit_(scanKey, functionName, details) {
  writeDevLog_(scanKey, functionName, DEV_LOG_EVENT.EXIT, 'Completed ' + functionName.split('::')[1], details);
}
