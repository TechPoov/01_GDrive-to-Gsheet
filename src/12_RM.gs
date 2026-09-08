/**
 * 12_RM.gs
 * Builds/refreshes the RM (ReadMe + navigation index) sheet from the
 * actual current workbook sheet collection (RM Sheet Design doc 04).
 * RM is always kept first; Help is expected last among recognized
 * system sheets (enforced by 13_Help.gs's own refresh, not here).
 */

var RM_SHEET_TYPE = {
  RM: 'RM', PROFILE: 'PROFILE', CURRENT_INDEX: 'CURRENT_INDEX', OLD_INDEX: 'OLD_INDEX',
  DASHBOARD: 'DASHBOARD', LOG: 'LOG', DEV_LOG: 'DEV_LOG', HELP: 'HELP', TEMP: 'TEMP', UNKNOWN: 'UNKNOWN'
};

/**
 * Classifies one workbook sheet using its name plus, where the name
 * alone is ambiguous (Current Index / _Old / Dashboard), Developer
 * Metadata ownership tags (Validation Design §29-31; RM Design §10).
 */
function classifySheetForRm_(sheet) {
  var name = sheet.getName();
  if (name === SHEET_RM) return { type: RM_SHEET_TYPE.RM, scanKey: null };
  if (name === SHEET_PROFILE) return { type: RM_SHEET_TYPE.PROFILE, scanKey: null };
  if (name === SHEET_LOG) return { type: RM_SHEET_TYPE.LOG, scanKey: null };
  if (name === SHEET_DEV_LOG) return { type: RM_SHEET_TYPE.DEV_LOG, scanKey: null };
  if (name === SHEET_HELP) return { type: RM_SHEET_TYPE.HELP, scanKey: null };
  if (name.indexOf(TEMP_SHEET_PREFIX) === 0) return { type: RM_SHEET_TYPE.TEMP, scanKey: null };

  if (name.indexOf(DASHBOARD_PREFIX) === 0) {
    var dbScanKey = getScanKeyFromDashboardName_(name);
    if (isSheetManagedAs_(sheet, managedTagForDashboard_(dbScanKey))) {
      return { type: RM_SHEET_TYPE.DASHBOARD, scanKey: dbScanKey };
    }
    return { type: RM_SHEET_TYPE.UNKNOWN, scanKey: null };
  }

  if (name.indexOf(OLD_INDEX_SUFFIX, name.length - OLD_INDEX_SUFFIX.length) !== -1) {
    var oldScanKey = name.substring(0, name.length - OLD_INDEX_SUFFIX.length);
    if (isSheetManagedAs_(sheet, managedTagForOldIndex_(oldScanKey))) {
      return { type: RM_SHEET_TYPE.OLD_INDEX, scanKey: oldScanKey };
    }
    return { type: RM_SHEET_TYPE.UNKNOWN, scanKey: null };
  }

  if (isSheetManagedAs_(sheet, managedTagForCurrentIndex_(name))) {
    return { type: RM_SHEET_TYPE.CURRENT_INDEX, scanKey: name };
  }

  return { type: RM_SHEET_TYPE.UNKNOWN, scanKey: null };
}

function descriptionForClassification_(cls) {
  switch (cls.type) {
    case RM_SHEET_TYPE.RM: return RM_DESCRIPTIONS.RM;
    case RM_SHEET_TYPE.PROFILE: return RM_DESCRIPTIONS.PROFILE;
    case RM_SHEET_TYPE.CURRENT_INDEX: return 'Current Index for ScanKey ' + cls.scanKey;
    case RM_SHEET_TYPE.OLD_INDEX: return 'Previous Index for ScanKey ' + cls.scanKey;
    case RM_SHEET_TYPE.DASHBOARD: return 'Dashboard for ScanKey ' + cls.scanKey;
    case RM_SHEET_TYPE.LOG: return RM_DESCRIPTIONS.LOG;
    case RM_SHEET_TYPE.DEV_LOG: return RM_DESCRIPTIONS.DEV_LOG;
    case RM_SHEET_TYPE.HELP: return RM_DESCRIPTIONS.HELP;
    default: return RM_DESCRIPTIONS.UNKNOWN;
  }
}

function ensureRmSheet_(ss) {
  var sheet = getSheetSafe_(ss, SHEET_RM);
  var isNew = !sheet;
  if (isNew) sheet = getOrCreateSheet_(ss, SHEET_RM);
  if (isNew || getHeaderRow_(sheet).length === 0) {
    writeHeaderRow_(sheet, ['Sl.No', 'Sheet Name', 'Description']);
    setColumnWidths_(sheet, [{ col: 1, width: 60 }, { col: 2, width: 260 }, { col: 3, width: 480 }]);
  }
  return sheet;
}

/**
 * Rebuilds RM from the actual current workbook sheet collection
 * (RM Design §8, §29). Skips temporary staging sheets (Technical
 * Architecture §21). Never deletes/renames any sheet it discovers.
 */
function refreshRm_(ss) {
  var startTime = nowMs_();
  var rmSheet = ensureRmSheet_(ss);
  var allSheets = ss.getSheets();

  var rmEntry = null, profileEntry = null, logEntry = null, devLogEntry = null, helpEntry = null;
  var groups = {}; // scanKey -> {current, old, dashboard, minIndex}
  var unknownEntries = [];

  for (var i = 0; i < allSheets.length; i++) {
    var sheet = allSheets[i];
    if (sheet.getName() === SHEET_RM) continue; // handled separately as the first row
    var cls = classifySheetForRm_(sheet);
    if (cls.type === RM_SHEET_TYPE.TEMP) continue;

    if (cls.type === RM_SHEET_TYPE.PROFILE) { profileEntry = { sheet: sheet, cls: cls }; continue; }
    if (cls.type === RM_SHEET_TYPE.LOG) { logEntry = { sheet: sheet, cls: cls }; continue; }
    if (cls.type === RM_SHEET_TYPE.DEV_LOG) { devLogEntry = { sheet: sheet, cls: cls }; continue; }
    if (cls.type === RM_SHEET_TYPE.HELP) { helpEntry = { sheet: sheet, cls: cls }; continue; }

    if (cls.type === RM_SHEET_TYPE.CURRENT_INDEX || cls.type === RM_SHEET_TYPE.OLD_INDEX || cls.type === RM_SHEET_TYPE.DASHBOARD) {
      if (!groups[cls.scanKey]) groups[cls.scanKey] = { minIndex: i };
      groups[cls.scanKey].minIndex = Math.min(groups[cls.scanKey].minIndex, i);
      if (cls.type === RM_SHEET_TYPE.CURRENT_INDEX) groups[cls.scanKey].current = { sheet: sheet, cls: cls };
      if (cls.type === RM_SHEET_TYPE.OLD_INDEX) groups[cls.scanKey].old = { sheet: sheet, cls: cls };
      if (cls.type === RM_SHEET_TYPE.DASHBOARD) groups[cls.scanKey].dashboard = { sheet: sheet, cls: cls };
      continue;
    }

    unknownEntries.push({ sheet: sheet, cls: cls });
  }

  var orderedGroupKeys = Object.keys(groups).sort(function (a, b) { return groups[a].minIndex - groups[b].minIndex; });

  var rows = [];
  var slNo = 1;

  rows.push([slNo++, buildInternalSheetHyperlink_(rmSheet.getSheetId(), rmSheet.getName()), RM_DESCRIPTIONS.RM]);
  if (profileEntry) rows.push([slNo++, buildInternalSheetHyperlink_(profileEntry.sheet.getSheetId(), profileEntry.sheet.getName()), descriptionForClassification_(profileEntry.cls)]);

  orderedGroupKeys.forEach(function (key) {
    var g = groups[key];
    ['current', 'old', 'dashboard'].forEach(function (member) {
      if (g[member]) {
        rows.push([slNo++, buildInternalSheetHyperlink_(g[member].sheet.getSheetId(), g[member].sheet.getName()), descriptionForClassification_(g[member].cls)]);
      }
    });
  });

  if (logEntry) rows.push([slNo++, buildInternalSheetHyperlink_(logEntry.sheet.getSheetId(), logEntry.sheet.getName()), descriptionForClassification_(logEntry.cls)]);
  if (devLogEntry) rows.push([slNo++, buildInternalSheetHyperlink_(devLogEntry.sheet.getSheetId(), devLogEntry.sheet.getName()), descriptionForClassification_(devLogEntry.cls)]);
  if (helpEntry) rows.push([slNo++, buildInternalSheetHyperlink_(helpEntry.sheet.getSheetId(), helpEntry.sheet.getName()), descriptionForClassification_(helpEntry.cls)]);

  unknownEntries.forEach(function (u) {
    rows.push([slNo++, buildInternalSheetHyperlink_(u.sheet.getSheetId(), u.sheet.getName()), descriptionForClassification_(u.cls)]);
  });

  clearSheetCompletely_(rmSheet);
  writeHeaderRow_(rmSheet, ['Sl.No', 'Sheet Name', 'Description']);
  if (rows.length > 0) batchSetValues_(rmSheet, 2, 1, rows);
  freezeHeaderRow_(rmSheet);
  enableFilterSafe_(rmSheet, rows.length + 1, 3);
  setColumnWidths_(rmSheet, [{ col: 1, width: 60 }, { col: 2, width: 260 }, { col: 3, width: 480 }]);
  try { rmSheet.getRange(2, 3, Math.max(rows.length, 1), 1).setWrap(true); } catch (e) {}

  moveSheetToPosition_(ss, rmSheet, 1);

  writeDevLog_('', '12_RM.gs::refreshRm_', DEV_LOG_EVENT.PERFORMANCE, 'RM refreshed',
    { totalSheets: allSheets.length, rows: rows.length, unknownSheets: unknownEntries.length, durationMs: elapsedMs_(startTime) });

  return rows.length;
}
