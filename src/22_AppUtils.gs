/**
 * 22_AppUtils.gs
 * General reusable application helpers that do not logically belong to
 * another module: spreadsheet access, structured result objects, RunID
 * generation, and safe UI wrappers.
 */

/** Returns the active (container-bound) spreadsheet. */
function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Returns SpreadsheetApp.getUi() or null if UI is unavailable (e.g. when
 * running from a time-driven continuation trigger, which has no user
 * interface context). Callers must handle a null return.
 */
function getUiSafe_() {
  try {
    return SpreadsheetApp.getUi();
  } catch (e) {
    return null;
  }
}

/** Shows an alert dialog if a UI context is available; no-op otherwise. */
function showAlertSafe_(message) {
  var ui = getUiSafe_();
  if (ui) {
    try { ui.alert(message); } catch (e) {}
  }
}

function showAlertTitledSafe_(title, message) {
  var ui = getUiSafe_();
  if (ui) {
    try { ui.alert(title, message, ui.ButtonSet.OK); } catch (e) {}
  }
}

/**
 * Generates a unique internal RunID identifying one logical Scan Drive
 * execution (Technical Architecture §14). Distinct from ScanKey.
 */
function generateRunId_() {
  var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  var rand = Math.floor(Math.random() * 1000000);
  return RUN_ID_PREFIX + ts + '_' + rand;
}

/**
 * Structured internal result object (Processing/Validation Design §41,
 * §84 respectively). Prefer this over ad-hoc strings/booleans so
 * orchestration code can reason about severity consistently.
 */
function buildResult_(success, severity, code, message, details, data) {
  return {
    success: !!success,
    severity: severity || (success ? SEVERITY.SUCCESS : SEVERITY.ERROR),
    code: code || '',
    message: message || '',
    details: details || '',
    data: (data === undefined) ? null : data
  };
}

function okResult_(message, data) {
  return buildResult_(true, SEVERITY.SUCCESS, '', message, '', data);
}

function warningResult_(code, message, details, data) {
  return buildResult_(true, SEVERITY.WARNING, code, message, details, data);
}

function errorResult_(code, message, details) {
  return buildResult_(false, SEVERITY.ERROR, code, message, details, null);
}

function cancelledResult_(message, details) {
  return buildResult_(false, SEVERITY.CANCELLED, '', message, details, null);
}

/** Milliseconds elapsed since a startTime (ms since epoch). */
function elapsedMs_(startTimeMs) {
  return nowMs_() - startTimeMs;
}

/**
 * Bounded, safe JSON stringify used for Dev_Log Details and compact
 * traversal-state persistence. Truncates very large payloads instead of
 * risking oversized PropertiesService values (Technical Architecture §18).
 */
function safeStringify_(obj, maxLength) {
  var limit = maxLength || 8000;
  var text;
  try {
    text = JSON.stringify(obj);
  } catch (e) {
    text = String(obj);
  }
  if (text && text.length > limit) {
    text = text.substring(0, limit) + '...(truncated)';
  }
  return text;
}

function safeParseJson_(text, fallback) {
  if (isBlank_(text)) return fallback;
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

/** Extracts a concise, user-safe message from a thrown JS error/exception. */
function extractExceptionMessage_(e) {
  if (!e) return 'Unknown error';
  if (e.message) return String(e.message);
  return String(e);
}
