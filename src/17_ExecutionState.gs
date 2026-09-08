/**
 * 17_ExecutionState.gs
 * RunID lifecycle, persistent execution state (PropertiesService),
 * execution phases, locking, and stale-run recovery
 * (Technical Architecture §14-22, §36-39, §67).
 */

var STALE_RUN_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes of inactivity

/**
 * Acquires the script-wide execution lock used to protect critical
 * shared-state transitions (starting a run, creating/removing the
 * continuation trigger, Current/Old rotation). Returns the Lock on
 * success or null if it could not be acquired within LOCK_WAIT_MS.
 */
function acquireScriptLock_() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
    return lock;
  } catch (e) {
    return null;
  }
}

function releaseLockSafe_(lock) {
  if (!lock) return;
  try { lock.releaseLock(); } catch (e) {}
}

function getActiveRunId_() {
  return getAppProperties_().getProperty(PROPERTY_KEYS.ACTIVE_RUN_ID) || '';
}

function touchActivity_() {
  getAppProperties_().setProperty(PROPERTY_KEYS.LAST_ACTIVITY_AT, String(nowMs_()));
}

function getLastActivityMs_() {
  var v = getAppProperties_().getProperty(PROPERTY_KEYS.LAST_ACTIVITY_AT);
  return v ? Number(v) : 0;
}

/**
 * True when a RunID is currently recorded as active AND it does not
 * look stale (see isStaleRun_). Used to decide whether a new user
 * Scan Drive request must be rejected with "already running".
 */
function isRunActive_() {
  var runId = getActiveRunId_();
  if (!runId) return false;
  if (isStaleRun_()) return false;
  return true;
}

/** Heuristic stale-run detection (Technical Architecture §67). */
function isStaleRun_() {
  var runId = getActiveRunId_();
  if (!runId) return false;
  var last = getLastActivityMs_();
  if (!last) return true; // no activity timestamp recorded at all -> treat as stale
  return (nowMs_() - last) > STALE_RUN_THRESHOLD_MS;
}

/**
 * Clears stale run state so a new scan can start safely. Never touches
 * Drive content or user-created sheets — only PropertiesService keys,
 * any orphaned continuation trigger, and a recognizable temp staging
 * sheet owned by the stale RunID.
 */
function recoverStaleRunIfAny_() {
  if (!getActiveRunId_()) return;
  if (!isStaleRun_()) return;
  var staleRunId = getActiveRunId_();
  removeContinuationTrigger_();
  deleteStagingSheetIfExists_(getSpreadsheet_(), staleRunId);
  writeDevLog_('', '17_ExecutionState.gs::recoverStaleRunIfAny_', DEV_LOG_EVENT.WARNING,
    'Stale run recovered', 'RunID=' + staleRunId);
  clearRunState_();
}

/**
 * Begins a brand-new logical run: generates a RunID and initializes all
 * persistent run-state properties. Caller must hold the script lock.
 */
function startNewRun_() {
  var runId = generateRunId_();
  var props = getAppProperties_();
  props.setProperties({
    ACTIVE_RUN_ID: runId,
    RUN_START_TIME: String(nowMs_()),
    LAST_ACTIVITY_AT: String(nowMs_()),
    EXECUTION_PHASE: EXECUTION_STATE.INITIALIZING,
    CANCEL_REQUESTED: 'false',
    STARTED_LOG_WRITTEN: '{}'
  });
  return runId;
}

function setExecutionPhase_(phase) {
  getAppProperties_().setProperty(PROPERTY_KEYS.EXECUTION_PHASE, phase);
  touchActivity_();
}

function getExecutionPhase_() {
  return getAppProperties_().getProperty(PROPERTY_KEYS.EXECUTION_PHASE) || EXECUTION_STATE.IDLE;
}

function setActiveScanKey_(scanKey) {
  getAppProperties_().setProperty(PROPERTY_KEYS.ACTIVE_SCAN_KEY, scanKey || '');
}

function getActiveScanKey_() {
  return getAppProperties_().getProperty(PROPERTY_KEYS.ACTIVE_SCAN_KEY) || '';
}

function setCurrentProfileRow_(rowNumber) {
  getAppProperties_().setProperty(PROPERTY_KEYS.CURRENT_PROFILE_ROW, String(rowNumber));
}

function getCurrentProfileRow_() {
  var v = getAppProperties_().getProperty(PROPERTY_KEYS.CURRENT_PROFILE_ROW);
  return v ? Number(v) : -1;
}

function setProfileStartTime_(timeMs) {
  getAppProperties_().setProperty(PROPERTY_KEYS.PROFILE_START_TIME, String(timeMs));
}

function getProfileStartTime_() {
  var v = getAppProperties_().getProperty(PROPERTY_KEYS.PROFILE_START_TIME);
  return v ? Number(v) : nowMs_();
}

function markStartedLogWritten_(scanKey) {
  var props = getAppProperties_();
  var map = safeParseJson_(props.getProperty(PROPERTY_KEYS.STARTED_LOG_WRITTEN), {});
  map[scanKey] = true;
  props.setProperty(PROPERTY_KEYS.STARTED_LOG_WRITTEN, safeStringify_(map, 4000));
}

function hasStartedLogBeenWritten_(scanKey) {
  var props = getAppProperties_();
  var map = safeParseJson_(props.getProperty(PROPERTY_KEYS.STARTED_LOG_WRITTEN), {});
  return !!map[scanKey];
}

function setProfileQueue_(scanKeys) {
  getAppProperties_().setProperty(PROPERTY_KEYS.PROFILE_QUEUE, safeStringify_(scanKeys, 8000));
}

function getProfileQueue_() {
  return safeParseJson_(getAppProperties_().getProperty(PROPERTY_KEYS.PROFILE_QUEUE), []);
}

function setProfileQueueIndex_(idx) {
  getAppProperties_().setProperty(PROPERTY_KEYS.PROFILE_QUEUE_INDEX, String(idx));
}

function getProfileQueueIndex_() {
  var v = getAppProperties_().getProperty(PROPERTY_KEYS.PROFILE_QUEUE_INDEX);
  return v ? Number(v) : 0;
}

function setRecordsCount_(n) {
  getAppProperties_().setProperty(PROPERTY_KEYS.RECORDS_COUNT, String(n));
}

function getRecordsCount_() {
  var v = getAppProperties_().getProperty(PROPERTY_KEYS.RECORDS_COUNT);
  return v ? Number(v) : 0;
}

function setWarningCount_(n) {
  getAppProperties_().setProperty(PROPERTY_KEYS.WARNING_COUNT, String(n));
}

function getWarningCount_() {
  var v = getAppProperties_().getProperty(PROPERTY_KEYS.WARNING_COUNT);
  return v ? Number(v) : 0;
}

function incrementWarningCount_() {
  setWarningCount_(getWarningCount_() + 1);
}

/**
 * Full cleanup of all run-scoped persistent state (Technical
 * Architecture §65-66). Called on SUCCESS, WARNING, ERROR, and
 * CANCELLED terminal outcomes, and during stale-run recovery.
 */
function clearRunState_() {
  var props = getAppProperties_();
  var keys = Object.keys(PROPERTY_KEYS).map(function (k) { return PROPERTY_KEYS[k]; });
  for (var i = 0; i < keys.length; i++) {
    props.deleteProperty(keys[i]);
  }
}
