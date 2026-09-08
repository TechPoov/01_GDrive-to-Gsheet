/**
 * 05_ScanOrchestrator.gs
 * End-to-end processing of active Profiles: sequencing, phase
 * transitions, Profile isolation, and final status determination
 * (Processing Design doc 12; Technical Architecture §73 execution flow).
 *
 * Two public entry points drive this module:
 *   beginScanDriveRun_()     — called from the menu (has a UI context)
 *   processQueue_()          — the resumable core loop, also called
 *                               directly by 01_Main.gs::resumeScanContinuation
 *                               (no UI context) when a continuation
 *                               trigger fires.
 */

/** Projects a validated Profile entry into a compact, serializable queue item. */
function toQueueItem_(e) {
  return {
    rowNumber: e.rowNumber,
    scanKey: e.scanKey,
    classification: e.classification,
    errors: e.errors,
    profileName: e.normalized.profileName,
    mode: e.normalized.mode,
    zipCode: e.normalized.zipCode,
    maxDepth: e.maxDepth,
    folderId: e.folderId
  };
}

/**
 * TechPoov -> Scan Drive. Validates all Profiles, starts a new logical
 * run, and processes the queue synchronously until either fully done or
 * a continuation is scheduled. Returns a user-facing summary message.
 */
function beginScanDriveRun_() {
  recoverStaleRunIfAny_();
  if (isRunActive_()) {
    return 'A Drive scan is already running. Please use Cancel Scan or wait for the current execution to finish.';
  }

  var lock = acquireScriptLock_();
  if (!lock) {
    return 'Unable to start the scan right now — please try again in a moment.';
  }

  var ss, profileSheet, queueItems;
  try {
    if (isRunActive_()) {
      return 'A Drive scan is already running. Please use Cancel Scan or wait for the current execution to finish.';
    }
    ss = getSpreadsheet_();
    ensureWorkbookStructure_(ss);
    profileSheet = getProfileSheet_(ss);
    if (!profileSheet) {
      writeLog_('', LOG_ACTION.APP_INIT, LOG_STATUS.ERROR, 'Error: Profile sheet is not available.');
      return 'Error: Profile sheet is not available.';
    }

    var rawEntries = readProfileRows_(profileSheet);
    var validated = validateAllProfiles_(ss, rawEntries);
    var eligible = validated.filter(function (e) {
      return e.classification === PROFILE_CLASS.VALID || e.classification === PROFILE_CLASS.INVALID;
    });

    if (eligible.length === 0) {
      return 'No active Profile rows are available for scanning.';
    }

    queueItems = eligible.map(toQueueItem_);
    startNewRun_();
    setProfileQueue_(queueItems);
    setProfileQueueIndex_(0);
  } finally {
    releaseLockSafe_(lock);
  }

  var runResult = processQueue_();

  if (runResult.status === 'CONTINUATION_SCHEDULED') {
    return 'Scan started. This is a large scan and will continue automatically in the background — check the Log sheet for progress and the Profile sheet for final results.';
  }
  return buildRunSummaryMessage_(profileSheet, queueItems);
}

function buildRunSummaryMessage_(profileSheet, queueItems) {
  var counts = { SUCCESS: 0, WARNING: 0, ERROR: 0, CANCELLED: 0 };
  var statusCol = PROFILE_COLUMN_ORDER.indexOf(PROFILE_COLUMNS.STATUS) + 1;
  for (var i = 0; i < queueItems.length; i++) {
    var v = profileSheet.getRange(queueItems[i].rowNumber, statusCol).getValue();
    if (counts[v] !== undefined) counts[v]++;
  }
  return 'Scan Drive completed. SUCCESS: ' + counts.SUCCESS + ', WARNING: ' + counts.WARNING +
    ', ERROR: ' + counts.ERROR + ', CANCELLED: ' + counts.CANCELLED + '. See the Profile and Log sheets for details.';
}

/**
 * The resumable core loop: processes queued Profiles top-to-bottom
 * (Processing Design §5), stopping to schedule a continuation trigger
 * whenever a Profile signals it needs more time. Safe to call both from
 * the initiating menu execution and from a later continuation trigger.
 */
function processQueue_() {
  touchActivity_();
  var executionStartMs = nowMs_();
  var ss = getSpreadsheet_();
  var profileSheet = getProfileSheet_(ss);
  var queue = getProfileQueue_();
  var idx = getProfileQueueIndex_();

  for (; idx < queue.length; idx++) {
    var item = queue[idx];
    var result = processOneProfile_(ss, profileSheet, item, executionStartMs);

    if (result.status === 'SKIP_NOT_STARTED') break;

    if (result.status === 'CONTINUATION') {
      return { status: 'CONTINUATION_SCHEDULED' };
    }

    if (result.status === 'CANCELLED') {
      idx++;
      setProfileQueueIndex_(idx);
      break;
    }

    // DONE — do not manually increment idx here: the `for` loop's own
    // `idx++` already advances to the next item. Incrementing here too
    // caused every item immediately after a successful one to be
    // skipped entirely (e.g. a 3-row queue would process rows 1 and 3
    // and silently never touch row 2).
    setProfileQueueIndex_(idx + 1);
    setActiveScanKey_('');
  }

  finalizeRun_(ss);
  return { status: 'COMPLETED' };
}

function finalizeRun_(ss) {
  removeContinuationTrigger_();
  var runId = getActiveRunId_();
  if (runId) deleteStagingSheetIfExists_(ss, runId);
  flushDevLogBuffer_();
  try { refreshRm_(ss); } catch (e) {}
  clearRunState_();
}

/**
 * Processes exactly one Profile queue item through to a terminal
 * outcome, or signals that the run must suspend for continuation.
 * Returns one of:
 *   { status: 'DONE', severity }
 *   { status: 'CANCELLED', severity }
 *   { status: 'CONTINUATION' }
 *   { status: 'SKIP_NOT_STARTED' }   — cancellation before this fresh Profile began
 */
function processOneProfile_(ss, profileSheet, item, executionStartMs) {
  var isResuming = (getActiveScanKey_() === item.scanKey) && hasStartedLogBeenWritten_(item.scanKey);

  if (checkCancellationCheckpoint_()) {
    if (!isResuming) return { status: 'SKIP_NOT_STARTED' };
    clearTraversalState_();
    return finalizeCancelledProfile_(ss, profileSheet, item, getRecordsCount_());
  }

  setActiveScanKey_(item.scanKey);
  setCurrentProfileRow_(item.rowNumber);

  if (item.classification === PROFILE_CLASS.INVALID) {
    return finalizeInvalidProfile_(ss, profileSheet, item);
  }

  if (!isResuming) {
    setProfileRunning_(profileSheet, item.rowNumber);
    var startTime = new Date();
    setProfileStartTime_(startTime.getTime());
    logScanStarted_(item.scanKey, startTime);
    markStartedLogWritten_(item.scanKey);
    setRecordsCount_(0);
    setWarningCount_(0);
    writeDevLog_(item.scanKey, '05_ScanOrchestrator.gs::processOneProfile_', DEV_LOG_EVENT.ENTER,
      'Profile processing started', { row: item.rowNumber, mode: item.mode, maxDepth: item.maxDepth, zipCode: item.zipCode });
  }

  setExecutionPhase_(EXECUTION_STATE.SCANNING);

  var stagingSheet = getOrCreateStagingSheet_(getActiveRunId_());
  var resumeState = loadTraversalState_();

  var scanCtx = {
    scanKey: item.scanKey,
    mode: item.mode,
    maxDepth: item.maxDepth,
    zipCode: item.zipCode,
    sourceFolderId: item.folderId,
    sourceFolderName: item.profileName,
    stagingSheet: stagingSheet,
    executionStartMs: executionStartMs
  };

  var scanResult;
  try {
    scanResult = scanFolderResumable_(scanCtx, resumeState);
  } catch (e) {
    clearTraversalState_();
    return finalizeErrorProfile_(ss, profileSheet, item, 'Error: Unexpected failure while scanning Drive.', extractExceptionMessage_(e));
  }

  if (scanResult.status === 'CONTINUATION') {
    setRecordsCount_(scanResult.recordsSoFar);
    flushDevLogBuffer_();
    return { status: 'CONTINUATION' };
  }

  if (scanResult.status === 'CANCELLED') {
    clearTraversalState_();
    return finalizeCancelledProfile_(ss, profileSheet, item, scanResult.recordsSoFar);
  }

  // scanResult.status === 'COMPLETE'
  clearTraversalState_();
  setRecordsCount_(scanResult.recordsSoFar);

  if (checkCancellationCheckpoint_()) {
    return finalizeCancelledProfile_(ss, profileSheet, item, scanResult.recordsSoFar);
  }

  // Do not begin the critical Index-replacement section unless enough
  // safe runtime remains (Technical Architecture §46).
  if (!isRuntimeSafe_(executionStartMs)) {
    suspendForContinuation_(item.scanKey, { stack: [], recordsSoFar: scanResult.recordsSoFar });
    return { status: 'CONTINUATION' };
  }

  return finalizeSuccessfulProfile_(ss, profileSheet, item, stagingSheet);
}

/** Critical section: Index rotation/write, Dashboard refresh, RM refresh, final status. */
function finalizeSuccessfulProfile_(ss, profileSheet, item, stagingSheet) {
  setExecutionPhase_(EXECUTION_STATE.BUILDING_INDEX);
  var stagedRows = readStagingRows_(stagingSheet);

  var indexResult;
  try {
    indexResult = finalizeIndex_(ss, item.scanKey, stagedRows);
  } catch (e) {
    return finalizeErrorProfile_(ss, profileSheet, item, 'Error: Unable to write the Index for this scan.', extractExceptionMessage_(e));
  }
  deleteStagingSheetIfExists_(ss, getActiveRunId_());

  var dashboardOk = true, dashboardWarningMsg = null;
  setExecutionPhase_(EXECUTION_STATE.REFRESHING_DASHBOARD);
  try {
    createOrRefreshDashboard_(ss, item.scanKey, indexResult.sheet, new Date());
  } catch (e) {
    dashboardOk = false;
    dashboardWarningMsg = 'Dashboard refresh failed for ScanKey ' + item.scanKey;
    writeDevLog_(item.scanKey, '05_ScanOrchestrator.gs::finalizeSuccessfulProfile_', DEV_LOG_EVENT.ERROR, dashboardWarningMsg, extractExceptionMessage_(e));
  }

  var rmOk = true, rmWarningMsg = null;
  setExecutionPhase_(EXECUTION_STATE.REFRESHING_RM);
  try {
    refreshRm_(ss);
  } catch (e) {
    rmOk = false;
    rmWarningMsg = 'RM refresh failed';
    writeDevLog_(item.scanKey, '05_ScanOrchestrator.gs::finalizeSuccessfulProfile_', DEV_LOG_EVENT.ERROR, rmWarningMsg, extractExceptionMessage_(e));
  }

  var warnCount = getWarningCount_();
  var hasWarnings = warnCount > 0 || !dashboardOk || !rmOk;

  var endTime = new Date();
  var startTime = new Date(getProfileStartTime_());
  var duration = formatDuration_(endTime.getTime() - startTime.getTime());
  var recordsText = formatCount_(indexResult.recordCount);

  var status, message;
  if (hasWarnings) {
    status = PROFILE_STATUS.WARNING;
    var warnParts = [];
    if (warnCount > 0) warnParts.push(warnCount + ' item(s) skipped or generated warnings');
    if (!dashboardOk) warnParts.push(dashboardWarningMsg);
    if (!rmOk) warnParts.push(rmWarningMsg);
    message = 'Started at: ' + formatDateTime_(startTime) + ' | Records processed: ' + recordsText +
      ' | Warnings: ' + warnParts.join('; ') + ' | Ended at: ' + formatDateTime_(endTime) + ' | Time taken: ' + duration;
  } else {
    status = PROFILE_STATUS.SUCCESS;
    message = 'Started at: ' + formatDateTime_(startTime) + ' | Records processed: ' + recordsText +
      ' | Ended at: ' + formatDateTime_(endTime) + ' | Time taken: ' + duration;
  }

  setExecutionPhase_(EXECUTION_STATE.COMPLETING);
  setProfileFinal_(profileSheet, item.rowNumber, status, endTime, message);
  logScanFinal_(item.scanKey, status === PROFILE_STATUS.WARNING ? LOG_STATUS.WARNING : LOG_STATUS.SUCCESS, message);
  writeDevLog_(item.scanKey, '05_ScanOrchestrator.gs::finalizeSuccessfulProfile_', DEV_LOG_EVENT.EXIT,
    'Profile completed', { status: status, records: indexResult.recordCount });
  flushDevLogBuffer_();

  return { status: 'DONE', severity: status };
}

function finalizeInvalidProfile_(ss, profileSheet, item) {
  var message = item.errors.join(' ');
  var now = new Date();
  setProfileFinal_(profileSheet, item.rowNumber, PROFILE_STATUS.ERROR, now, message);
  writeLog_(item.scanKey || '', LOG_ACTION.VALIDATE_PROFILE, LOG_STATUS.ERROR, message);
  writeDevLog_(item.scanKey || '', '05_ScanOrchestrator.gs::finalizeInvalidProfile_', DEV_LOG_EVENT.VALIDATION,
    'Profile validation failed', { row: item.rowNumber, errors: item.errors });
  flushDevLogBuffer_();
  return { status: 'DONE', severity: PROFILE_STATUS.ERROR };
}

function finalizeErrorProfile_(ss, profileSheet, item, userMessage, technicalDetails) {
  var now = new Date();
  setProfileFinal_(profileSheet, item.rowNumber, PROFILE_STATUS.ERROR, now, userMessage);
  logScanFinal_(item.scanKey, LOG_STATUS.ERROR, userMessage);
  writeDevLog_(item.scanKey, '05_ScanOrchestrator.gs::finalizeErrorProfile_', DEV_LOG_EVENT.EXCEPTION, userMessage, technicalDetails);
  flushDevLogBuffer_();
  return { status: 'DONE', severity: PROFILE_STATUS.ERROR };
}

function finalizeCancelledProfile_(ss, profileSheet, item, recordsSoFar) {
  var now = new Date();
  var message = 'Cancelled at: ' + formatDateTime_(now) + ' | Records processed before cancellation: ' + formatCount_(recordsSoFar || 0);
  setProfileFinal_(profileSheet, item.rowNumber, PROFILE_STATUS.CANCELLED, now, message);
  logScanFinal_(item.scanKey, LOG_STATUS.CANCELLED, message);
  writeDevLog_(item.scanKey, '05_ScanOrchestrator.gs::finalizeCancelledProfile_', DEV_LOG_EVENT.INFO, 'Profile cancelled', { records: recordsSoFar });
  flushDevLogBuffer_();
  return { status: 'CANCELLED', severity: PROFILE_STATUS.CANCELLED };
}
