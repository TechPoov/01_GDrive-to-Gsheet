/**
 * 19_SheetUtils.gs
 * Reusable Google Sheets helpers: safe sheet creation/lookup, batch
 * read/write, formatting, hyperlinks, and header/row utilities. Every
 * other module should go through these rather than calling
 * SpreadsheetApp directly, so batching/formatting stays consistent.
 */

function sheetExists_(ss, name) {
  return !!ss.getSheetByName(name);
}

function getSheetSafe_(ss, name) {
  return ss.getSheetByName(name);
}

/** Returns an existing sheet or creates a new blank one with that name. */
function getOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

/** Deletes a sheet if it exists. Safe no-op otherwise. */
function deleteSheetIfExists_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) ss.deleteSheet(sheet);
}

/**
 * Renames a sheet, guarding against the Google Sheets restriction that
 * you cannot rename onto a name that already exists. Caller is
 * responsible for having removed/renamed any conflicting sheet first
 * (see 09_IndexManager.gs safe rotation sequence).
 */
function renameSheetSafe_(sheet, newName) {
  sheet.setName(newName);
}

/** Writes a header row starting at row 1, column 1, bold + frozen. */
function writeHeaderRow_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/**
 * Batch-writes a 2D array of row values starting at (startRow, startCol).
 * No-ops safely when rows2D is empty.
 */
function batchSetValues_(sheet, startRow, startCol, rows2D) {
  if (!rows2D || rows2D.length === 0) return;
  var numRows = rows2D.length;
  var numCols = rows2D[0].length;
  sheet.getRange(startRow, startCol, numRows, numCols).setValues(rows2D);
}

/** Clears all content (values, formats) below/around while keeping the sheet object. */
function clearSheetCompletely_(sheet) {
  sheet.clear();
  sheet.clearFormats();
  try { sheet.getFilter() && sheet.getFilter().remove(); } catch (e) {}
}

function freezeHeaderRow_(sheet) {
  sheet.setFrozenRows(1);
}

/** Enables a basic filter over the full used range (header + data). */
function enableFilterSafe_(sheet, numRows, numCols) {
  try {
    var existing = sheet.getFilter();
    if (existing) existing.remove();
    if (numRows >= 1 && numCols >= 1) {
      sheet.getRange(1, 1, numRows, numCols).createFilter();
    }
  } catch (e) {
    // Filters are a formatting convenience; never fail the operation over this.
  }
}

/** Sets column widths from a 1-based array (index 0 unused) of {col, width}. */
function setColumnWidths_(sheet, widthSpecs) {
  for (var i = 0; i < widthSpecs.length; i++) {
    try { sheet.setColumnWidth(widthSpecs[i].col, widthSpecs[i].width); } catch (e) {}
  }
}

/**
 * Moves a sheet to a 1-based position in the workbook (1 = first tab).
 */
function moveSheetToPosition_(ss, sheet, position) {
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(position);
}

/**
 * Prepends a single row immediately below the header row — used by Log
 * and Dev_Log which must show newest entries first (Log Design §34,
 * Dev_Log Design §42).
 */
function insertRowAtTop_(sheet, rowValues) {
  sheet.insertRowAfter(1);
  sheet.getRange(2, 1, 1, rowValues.length).setValues([rowValues]);
}

/**
 * Prepends multiple rows (already newest-first order) immediately below
 * the header row in one batch operation.
 */
function insertRowsAtTop_(sheet, rows2D) {
  if (!rows2D || rows2D.length === 0) return;
  sheet.insertRowsAfter(1, rows2D.length);
  sheet.getRange(2, 1, rows2D.length, rows2D[0].length).setValues(rows2D);
}

/** Returns the header row (row 1) as a plain array; [] if sheet is empty. */
function getHeaderRow_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function findColumnIndexByName_(headers, name) {
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === name) return i;
  }
  return -1;
}

/**
 * Reads all data rows (excluding header) as a 2D array of raw values.
 * Returns [] if the sheet has only a header row or is empty.
 */
function readAllDataRows_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];
  return sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
}

/** Reads the full used range (header + data) as a 2D array. */
function readAllValues_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return [];
  return sheet.getRange(1, 1, lastRow, lastCol).getValues();
}

function hideSheetSafe_(sheet) {
  try { sheet.hideSheet(); } catch (e) {}
}

// ============================================================
// APPLICATION-MANAGED SHEET TAGGING
// ============================================================
// Developer Metadata is used to reliably distinguish sheets this
// application created (Current Index / _Old / Dashboard for a specific
// ScanKey) from a same-named sheet a user happens to have created
// manually. This lets sheet-name-collision validation (Validation &
// Error Handling Design §29-31; Test Case TC-045) refuse to touch a
// user-created sheet even when its name matches a required generated
// name exactly.

var MANAGED_SHEET_METADATA_KEY = 'TP_MANAGED';

/** Tags a sheet as application-managed with the given identity string. */
function tagSheetManaged_(sheet, tagValue) {
  try {
    var finder = sheet.createDeveloperMetadataFinder().withKey(MANAGED_SHEET_METADATA_KEY).find();
    for (var i = 0; i < finder.length; i++) finder[i].remove();
  } catch (e) {}
  try {
    sheet.addDeveloperMetadata(MANAGED_SHEET_METADATA_KEY, tagValue);
  } catch (e) {}
}

/** Returns the application-managed tag value for a sheet, or null. */
function getSheetManagedTag_(sheet) {
  try {
    var finder = sheet.createDeveloperMetadataFinder().withKey(MANAGED_SHEET_METADATA_KEY).find();
    if (finder.length > 0) return finder[0].getValue();
  } catch (e) {}
  return null;
}

function isSheetManagedAs_(sheet, expectedTag) {
  return getSheetManagedTag_(sheet) === expectedTag;
}

function managedTagForCurrentIndex_(scanKey) { return 'CURRENT_INDEX:' + scanKey; }
function managedTagForOldIndex_(scanKey) { return 'OLD_INDEX:' + scanKey; }
function managedTagForDashboard_(scanKey) { return 'DASHBOARD:' + scanKey; }

/** Wraps a plain-text label + URL pair as a RichTextValue hyperlink. */
function buildRichTextHyperlink_(label, url) {
  var text = (label === null || label === undefined) ? '' : String(label);
  var builder = SpreadsheetApp.newRichTextValue().setText(text || ' ');
  if (url) builder.setLinkUrl(url);
  return builder.build();
}

/** Batch-applies RichTextValue hyperlinks to a single column range. */
function setRichTextColumn_(sheet, startRow, col, richTextValues) {
  if (!richTextValues || richTextValues.length === 0) return;
  sheet.getRange(startRow, col, richTextValues.length, 1).setRichTextValues(
    richTextValues.map(function (v) { return [v]; })
  );
}
