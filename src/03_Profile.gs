/**
 * 03_Profile.gs
 * Read Profile rows, normalize Profile data, and update Status,
 * LastUpdated, and Remarks (Profile Sheet Design doc 05).
 */

function getProfileSheet_(ss) {
  return getSheetSafe_(ss, SHEET_PROFILE);
}

/**
 * Creates the Profile sheet with frozen headers and helpful dropdown
 * validation if it does not already exist. Idempotent; safe to call from
 * onOpen (Workbook Design §28 — required fixed sheets should exist as
 * part of the application workbook structure).
 */
function ensureProfileSheet_(ss) {
  var sheet = getProfileSheet_(ss);
  var isNew = !sheet;
  if (isNew) sheet = getOrCreateSheet_(ss, SHEET_PROFILE);
  if (isNew || getHeaderRow_(sheet).length === 0) {
    writeHeaderRow_(sheet, PROFILE_COLUMN_ORDER);
    applyProfileDataValidation_(sheet);
    setColumnWidths_(sheet, [
      { col: 1, width: 160 }, { col: 2, width: 320 }, { col: 3, width: 90 },
      { col: 4, width: 70 }, { col: 5, width: 150 }, { col: 6, width: 80 },
      { col: 7, width: 90 }, { col: 8, width: 150 }, { col: 9, width: 380 }
    ]);
  }
  return sheet;
}

/** Applies Mode / ZipMode / IsActive dropdown validation (Profile Design §41-42). */
function applyProfileDataValidation_(sheet) {
  var maxRows = 200;
  var modeCol = PROFILE_COLUMN_ORDER.indexOf(PROFILE_COLUMNS.MODE) + 1;
  var zipCol = PROFILE_COLUMN_ORDER.indexOf(PROFILE_COLUMNS.ZIP_MODE) + 1;
  var activeCol = PROFILE_COLUMN_ORDER.indexOf(PROFILE_COLUMNS.IS_ACTIVE) + 1;

  var modeRule = SpreadsheetApp.newDataValidation().requireValueInList(VALID_MODES, true).setAllowInvalid(true).build();
  var zipRule = SpreadsheetApp.newDataValidation().requireValueInList(VALID_ZIP_MODES, true).setAllowInvalid(true).build();
  var activeRule = SpreadsheetApp.newDataValidation().requireValueInList([ACTIVE_YES, ACTIVE_NO], true).setAllowInvalid(true).build();

  sheet.getRange(2, modeCol, maxRows, 1).setDataValidation(modeRule);
  sheet.getRange(2, zipCol, maxRows, 1).setDataValidation(zipRule);
  sheet.getRange(2, activeCol, maxRows, 1).setDataValidation(activeRule);
}

/**
 * Reads every Profile row into plain objects, along with a raw
 * "isCompletelyBlank" flag (Profile Design §22 — blank rows are
 * ignored entirely by Validation).
 */
function readProfileRows_(sheet) {
  var headers = getHeaderRow_(sheet);
  var colIndex = {};
  for (var c = 0; c < headers.length; c++) colIndex[headers[c]] = c;

  var dataRows = readAllDataRows_(sheet);
  var results = [];
  for (var r = 0; r < dataRows.length; r++) {
    var raw = dataRows[r];
    var rowNumber = r + 2; // header is row 1
    var entry = {
      rowNumber: rowNumber,
      profileName: getCell_(raw, colIndex, PROFILE_COLUMNS.PROFILE_NAME),
      sourceUrl: getCell_(raw, colIndex, PROFILE_COLUMNS.SOURCE_URL),
      mode: getCell_(raw, colIndex, PROFILE_COLUMNS.MODE),
      depth: getCell_(raw, colIndex, PROFILE_COLUMNS.DEPTH),
      zipMode: getCell_(raw, colIndex, PROFILE_COLUMNS.ZIP_MODE),
      isActive: getCell_(raw, colIndex, PROFILE_COLUMNS.IS_ACTIVE)
    };
    entry.isCompletelyBlank = isBlank_(entry.profileName) && isBlank_(entry.sourceUrl) &&
      isBlank_(entry.mode) && isBlank_(entry.depth) && isBlank_(entry.zipMode) && isBlank_(entry.isActive);
    results.push(entry);
  }
  return results;
}

function getCell_(rowArray, colIndex, columnName) {
  var idx = colIndex[columnName];
  if (idx === undefined) return '';
  var v = rowArray[idx];
  return (v === null || v === undefined) ? '' : v;
}

/**
 * Sets Status = RUNNING only. LastUpdated/Remarks are left untouched
 * here — they are only ever updated at a final terminal state (Profile
 * Design §35 / §37-38).
 */
function setProfileRunning_(sheet, rowNumber) {
  var statusCol = PROFILE_COLUMN_ORDER.indexOf(PROFILE_COLUMNS.STATUS) + 1;
  sheet.getRange(rowNumber, statusCol).setValue(PROFILE_STATUS.RUNNING);
  SpreadsheetApp.flush();
}

/**
 * Sets the final Status / LastUpdated / Remarks for a Profile row in one
 * batch write (Profile Design §35-38).
 */
function setProfileFinal_(sheet, rowNumber, status, lastUpdatedDate, remarks) {
  var statusCol = PROFILE_COLUMN_ORDER.indexOf(PROFILE_COLUMNS.STATUS) + 1;
  var lastUpdatedCol = PROFILE_COLUMN_ORDER.indexOf(PROFILE_COLUMNS.LAST_UPDATED) + 1;
  var remarksCol = PROFILE_COLUMN_ORDER.indexOf(PROFILE_COLUMNS.REMARKS) + 1;
  sheet.getRange(rowNumber, statusCol).setValue(status);
  sheet.getRange(rowNumber, lastUpdatedCol).setValue(formatDateTime_(lastUpdatedDate));
  sheet.getRange(rowNumber, remarksCol).setValue(remarks);
}
