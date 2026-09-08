/**
 * 18_Continuation.gs
 * Runtime monitoring, save/resume state, continuation triggers, and
 * temporary staging storage for multi-execution scans (Technical
 * Architecture §10-35, §43-46).
 */

/** True while there is still safe time left in the current physical execution. */
function isRuntimeSafe_(executionStartMs) {
  return elapsedMs_(executionStartMs) < getExecutionSafeLimitMs_();
}

/** Cheap periodic-check gate so we don't call Date/Properties on every item. */
function shouldCheckRuntimeNow_(itemCounter) {
  return (itemCounter % RUNTIME_CHECK_EVERY_N_ITEMS) === 0;
}

/**
 * Creates exactly one continuation trigger for the active RunID, unless
 * one already exists (Technical Architecture §33). Returns the trigger
 * ID (existing or newly created).
 */
function scheduleContinuationTrigger_() {
  var existing = getContinuationTriggerId_();
  if (existing && continuationTriggerReallyExists_(existing)) {
    return existing;
  }
  var trigger = ScriptApp.newTrigger(CONTINUATION_TRIGGER_HANDLER)
    .timeBased()
    .after(CONTINUATION_DELAY_MS)
    .create();
  var id = trigger.getUniqueId();
  getAppProperties_().setProperty(PROPERTY_KEYS.CONTINUATION_TRIGGER_ID, id);
  return id;
}

function getContinuationTriggerId_() {
  return getAppProperties_().getProperty(PROPERTY_KEYS.CONTINUATION_TRIGGER_ID) || '';
}

function continuationTriggerReallyExists_(triggerId) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getUniqueId() === triggerId) return true;
  }
  return false;
}

/**
 * Removes the continuation trigger associated with the active RunID, if
 * any (Technical Architecture §34). Safe to call even when none exists.
 */
function removeContinuationTrigger_() {
  var id = getContinuationTriggerId_();
  if (!id) return;
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getUniqueId() === id) {
      ScriptApp.deleteTrigger(triggers[i]);
      break;
    }
  }
  getAppProperties_().deleteProperty(PROPERTY_KEYS.CONTINUATION_TRIGGER_ID);
}

/** Persists compact traversal-resume state (Technical Architecture §23, §17-18). */
function saveTraversalState_(stateObj) {
  getAppProperties_().setProperty(PROPERTY_KEYS.TRAVERSAL_STATE, safeStringify_(stateObj, 8500));
}

function loadTraversalState_() {
  return safeParseJson_(getAppProperties_().getProperty(PROPERTY_KEYS.TRAVERSAL_STATE), null);
}

function clearTraversalState_() {
  getAppProperties_().deleteProperty(PROPERTY_KEYS.TRAVERSAL_STATE);
}

// ============================================================
// TEMPORARY STAGING SHEET
// ============================================================
// Large/resumable scans persist partially collected Index records into a
// hidden, application-owned temporary sheet rather than PropertiesService
// (Technical Architecture §19-22). The sheet is never exposed through RM
// and is deleted on safe completion or cleanup.

function getTempStagingSheetName_(runId) {
  return TEMP_SHEET_PREFIX + runId;
}

/** Creates (or reuses) the hidden temp staging sheet for this RunID. */
function getOrCreateStagingSheet_(runId) {
  var ss = getSpreadsheet_();
  var name = getTempStagingSheetName_(runId);
  var sheet = getSheetSafe_(ss, name);
  if (!sheet) {
    sheet = getOrCreateSheet_(ss, name);
    hideSheetSafe_(sheet);
    getAppProperties_().setProperty(PROPERTY_KEYS.TEMP_SHEET_NAME, name);
    getAppProperties_().setProperty(PROPERTY_KEYS.TEMP_SHEET_ROW_COUNT, '0');
  }
  return sheet;
}

/**
 * Appends staged Index records (raw row arrays, NOT yet Sl.No'd or
 * hyperlinked) to the staging sheet in one batch call.
 */
function appendStagingRows_(sheet, rows2D) {
  if (!rows2D || rows2D.length === 0) return;
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows2D.length, rows2D[0].length).setValues(rows2D);
  var countKey = PROPERTY_KEYS.TEMP_SHEET_ROW_COUNT;
  var current = Number(getAppProperties_().getProperty(countKey) || '0');
  getAppProperties_().setProperty(countKey, String(current + rows2D.length));
}

/** Reads back all staged rows (used once traversal is fully complete). */
function readStagingRows_(sheet) {
  return readAllValues_(sheet);
}

function deleteStagingSheetIfExists_(ss, runId) {
  var name = getTempStagingSheetName_(runId);
  deleteSheetIfExists_(ss, name);
  var props = getAppProperties_();
  if (props.getProperty(PROPERTY_KEYS.TEMP_SHEET_NAME) === name) {
    props.deleteProperty(PROPERTY_KEYS.TEMP_SHEET_NAME);
    props.deleteProperty(PROPERTY_KEYS.TEMP_SHEET_ROW_COUNT);
  }
}

/**
 * Persists state and schedules resumption when the runtime-safety
 * threshold is reached mid-traversal (Technical Architecture §12-13,
 * §26). Caller supplies the traversal cursor object to save.
 */
function suspendForContinuation_(scanKey, traversalState) {
  saveTraversalState_(traversalState);
  setExecutionPhase_(EXECUTION_STATE.CONTINUATION_PENDING);
  scheduleContinuationTrigger_();
  writeDevLog_(scanKey, '18_Continuation.gs::suspendForContinuation_', DEV_LOG_EVENT.INFO,
    'Runtime threshold reached; continuation scheduled', traversalState);
  flushDevLogBuffer_();
}
