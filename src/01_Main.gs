/**
 * 01_Main.gs
 * Top-level workbook orchestration entry points: ensures the fixed
 * application sheet structure exists (Workbook Design doc 02, §28) and
 * supplies the global continuation-trigger handler (Technical
 * Architecture §33; config.gs's CONTINUATION_TRIGGER_HANDLER).
 */

/**
 * Creates/ensures every fixed system sheet exists (Profile, Log,
 * Dev_Log, RM, Help). RM and Help are additionally (re)built with their
 * full content the first time they are created, so a brand-new workbook
 * is immediately navigable and self-documenting even before any scan
 * has ever run. Idempotent and safe to call on every Scan Drive
 * invocation (Workbook Design §28-29).
 */
function ensureWorkbookStructure_(ss) {
  ensureProfileSheet_(ss);
  ensureLogSheet_(ss);
  ensureDevLogSheet_(ss);

  var helpSheet = getSheetSafe_(ss, SHEET_HELP);
  if (!helpSheet || getHeaderRow_(helpSheet).length === 0) {
    refreshHelp_(ss);
  }

  var rmSheet = getSheetSafe_(ss, SHEET_RM);
  if (!rmSheet || getHeaderRow_(rmSheet).length === 0) {
    refreshRm_(ss);
  }
}

/**
 * Global time-based trigger handler that resumes a suspended scan
 * (Technical Architecture §33-35). Apps Script invokes this by exact
 * function name with no arguments and no UI context — code reached from
 * here must never assume SpreadsheetApp.getUi() succeeds (see
 * 22_AppUtils.gs::getUiSafe_ and every showAlertSafe_/showAlertTitledSafe_
 * call, which already no-op without a UI). This function's name MUST
 * match config.gs's CONTINUATION_TRIGGER_HANDLER constant exactly.
 */
function resumeScanContinuation() {
  var runId = getActiveRunId_();
  if (!runId) {
    // Nothing left to resume — the run may already have completed or
    // been cleaned up (e.g. stale-run recovery) by the time this fired.
    return;
  }
  touchActivity_();
  try {
    processQueue_();
  } catch (e) {
    var scanKey = getActiveScanKey_();
    writeDevLog_(scanKey, '01_Main.gs::resumeScanContinuation', DEV_LOG_EVENT.EXCEPTION,
      'Unhandled exception during scan continuation', extractExceptionMessage_(e));
    flushDevLogBuffer_();
    try {
      writeLog_(scanKey, LOG_ACTION.SCAN_DRIVE, LOG_STATUS.ERROR, 'Error: Continuation execution failed unexpectedly.');
    } catch (e2) { /* Log must never mask the original failure */ }
    // Fail safe: never leave the workbook permanently "locked" by a
    // half-finished run that can no longer make progress on its own.
    try {
      removeContinuationTrigger_();
      deleteStagingSheetIfExists_(getSpreadsheet_(), runId);
      clearRunState_();
    } catch (e3) { /* best-effort cleanup only */ }
  }
}
