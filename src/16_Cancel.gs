/**
 * 16_Cancel.gs
 * Cancellation request/state handling and safe-checkpoint checking
 * (Menu Design §18-23, Processing Design §59-64, Technical Architecture
 * §40-42). Final Profile/Log/state cleanup for an honored cancellation
 * is orchestrated by 05_ScanOrchestrator.gs, which calls back into this
 * module's flag helpers.
 */

function setCancelRequested_(value) {
  getAppProperties_().setProperty(PROPERTY_KEYS.CANCEL_REQUESTED, value ? 'true' : 'false');
}

function isCancelRequested_() {
  return getAppProperties_().getProperty(PROPERTY_KEYS.CANCEL_REQUESTED) === 'true';
}

/**
 * Handles TechPoov -> Cancel Scan. Returns a user-facing message string.
 * Does not itself alter any Profile row — the active Profile is marked
 * CANCELLED only once the running/continuation execution actually
 * detects and honors the request at a safe checkpoint.
 */
function handleCancelScanRequest_() {
  if (!isRunActive_()) {
    writeDevLog_('', '16_Cancel.gs::handleCancelScanRequest_', DEV_LOG_EVENT.INFO,
      'Cancel Scan requested with no active run', '');
    flushDevLogBuffer_();
    return 'No active Drive scan is currently running.';
  }
  var lock = acquireScriptLock_();
  try {
    setCancelRequested_(true);
    touchActivity_();
  } finally {
    releaseLockSafe_(lock);
  }
  var scanKey = getActiveScanKey_();
  writeLog_(scanKey, LOG_ACTION.CANCEL_SCAN, LOG_STATUS.STARTED, 'Cancellation requested by user.');
  writeDevLog_(scanKey, '16_Cancel.gs::handleCancelScanRequest_', DEV_LOG_EVENT.INFO,
    'Cancellation flag set', 'RunID=' + getActiveRunId_());
  flushDevLogBuffer_();
  return 'Cancellation requested. The active scan will stop at the next safe checkpoint.';
}

/**
 * Safe-checkpoint helper: returns true (and leaves state untouched) when
 * cancellation has been requested. Callers in the scan/index/dashboard
 * pipeline should check this at the checkpoints enumerated in Processing
 * Design §61 and stop cleanly, letting the orchestrator finalize the
 * CANCELLED status.
 */
function checkCancellationCheckpoint_() {
  return isCancelRequested_();
}
