/**
 * 11_Dashboard.gs
 * Dashboard creation/refresh, filter parsing (Path/Name/Description
 * normal|ANY>|ALL>, comma-separated Type/Extension, Date>/Month>/Year>
 * for Created Date and Modified Date), Result Count, filtered results,
 * and Clear Filters (Dashboard Sheet Design doc 07, as amended by
 * Dashboard Design Change DDC-2026-09-08 and its Amendment 2 — see the
 * "Revision History" section at the top of doc 07 for the approved
 * before/after and rationale for every layout change below).
 *
 * Layout (fixed row/column positions, written once at creation and
 * otherwise only refreshed in place):
 *   Row 1: (blank) | "Last Updated:" | <date> | "Result Count:" | <value>
 *   Row 2: (blank) | "Filters" | Path | Name | Type | Extension | Description | Created Date | Modified Date | Clear (button)
 *   Row 3: <validation message, when applicable>
 *   Row 5: Results header (mirrors Current Index header: Sl.No | ItemID | Path | Name | Type | Extension | Description | CreatedDate | ModifiedDate | ...)
 *   Row 6+: filtered result rows, in Current Index relative order
 *
 * Filter columns sit in exact 1:1 column lock-step with the Results
 * header row (Path above Path, Name above Name, etc.). Sl.No and ItemID
 * are the only columns with no filter — Sl.No stays blank, and ItemID's
 * position instead holds the word "Filters" as the row's one purpose
 * marker, since a separate per-column label row was dropped entirely in
 * favor of this strict positional alignment (Amendment 2).
 *
 * Type/Extension are plain comma-separated text cells (OR logic, same
 * as before). A Sheets-native chip-style multi-select dropdown can
 * optionally be applied to these two cells by hand (Data > Data
 * validation > Dropdown from a list > Display style: Chip > Allow
 * multiple selections) for a nicer picker — the Sheets API does not yet
 * expose creating that validation type programmatically, so this script
 * cannot set it up automatically. Either way the cell still stores a
 * plain comma-separated string, so no parsing code depends on which way
 * the cell was filled in. A note on each cell mentions this.
 *
 * Clear Filters is a small clickable image button (not a checkbox) —
 * see CLEAR_FILTERS_BUTTON_PNG_BASE64 below — inserted once at creation
 * via Sheet.insertImage()/OverGridImage.assignScript(), fully
 * automatic, no manual drawing step required.
 *
 * NOTE: This layout supersedes the column/row positions used by the
 * original DDC-2026-09-08 change (which had separate Filter Heading and
 * Filter Labels rows, a single Date Type + Month + Year cluster, and a
 * checkbox for Clear Filters). Any Dashboard sheet already created under
 * that earlier layout keeps its old structure — buildDashboardLayout_
 * only runs once, the first time a Dashboard is created for a ScanKey.
 * Delete an existing DB_<ScanKey> sheet and re-run Scan Drive to have it
 * rebuilt under this layout.
 */

var DASH_ROW_INFO = 1;
var DASH_ROW_FILTER_INPUTS = 2;
var DASH_ROW_VALIDATION_MSG = 3;
var DASH_ROW_RESULTS_HEADER = 5;
var DASH_ROW_RESULTS_START = 6;

// Row 1 (Information) columns — column 1 is intentionally left blank so
// it stays visually aligned with the narrow Sl.No results column below.
var DASH_COL_INFO_LASTUPDATED_LABEL = 2;
var DASH_COL_INFO_LASTUPDATED_VALUE = 3;
var DASH_COL_INFO_RESULTCOUNT_LABEL = 4;
var DASH_COL_INFO_RESULTCOUNT_VALUE = 5;

// Row 2 (Filters) columns mirror the Results header exactly (Sl.No=1,
// ItemID=2, Path=3, Name=4, Type=5, Extension=6, Description=7,
// CreatedDate=8, ModifiedDate=9) so each filter sits directly above the
// column it filters. Sl.No (1) has no filter and stays blank. ItemID's
// column (2) has no filter either, so it holds the "Filters" row marker
// instead of being left blank. Clear (10) follows the last data column.
var DASH_COL_FILTER_MARKER = 2;
var DASH_COL_PATH = 3;
var DASH_COL_NAME = 4;
var DASH_COL_TYPE = 5;
var DASH_COL_EXTENSION = 6;
var DASH_COL_DESCRIPTION = 7;
var DASH_COL_CREATED = 8;
var DASH_COL_MODIFIED = 9;
var DASH_COL_CLEAR = 10;
var DASH_FILTER_INPUT_COLS = [DASH_COL_PATH, DASH_COL_NAME, DASH_COL_TYPE, DASH_COL_EXTENSION, DASH_COL_DESCRIPTION, DASH_COL_CREATED, DASH_COL_MODIFIED];

var CLEAR_FILTERS_BUTTON_FUNCTION = 'clearAllFiltersFromButton';

// A small pre-baked filter-icon + "Clear" button image (104x26 PNG),
// inserted once at Dashboard creation and assigned
// CLEAR_FILTERS_BUTTON_FUNCTION so a click clears all filters — no
// manual drawing/script-assignment step.
var CLEAR_FILTERS_BUTTON_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAGgAAAAaCAIAAADUlI48AAADX0lEQVR4nO2YW0gUURjHv7NzZmd3x7VWXaYbW6TiWmlCURIJVnYnaI2QHgKF6KKSEaQVFPRSUJEkXaCHiiDKeijIInooK8LErZBuJquVhe16W9td9zo708OUxJrO7KybWvN7mcM5f2b+8+f7Zg4HXS8EBRmoxtrARAULl/yZurH1MYGo/+wFpeJkowQnEzzcAnNqQPpdHHvp0TAzkRi24qRn8R+mBmPbqsmVVubUQOKWC2PoQTbDtioAOPbSog0rWm5IrdMt3UFlWzCTgTDF+frDPW2eusPB9mdRmx1PjBQciGUnmpoqwWgou48Zc9D2tO90frj3E2FM1WRvVOkZOWbHEyLBxUhi0VnMmPmAp/9SEe/7DgBs5xtP55s/q5FKl1eqzS0mUmbzXmfoywvPvSPst7fComHXXXV6PgAAz3FeZ+hjg6fuENvVCgDJlVY8JTPw+g7n/65Ozwc20HM0O67vBVKCG67oxMtNz1Bz1gGAv/mWkNrIJG6u0eaWBFsfOc+twdOyDdtvqzNWOGsKQl9fAYDz/HpBhjSJ9MoqetkezJh7Tyzi2YAwT2VtcN0od9+s4Fm/6LNiJ44/B8xkAEIAEO5pFxUTKanaxcUAMPDgGOfpCbY+DHU0IazRLd8ToeT9Ll/DRQAgjGl4WtbgfKjD6nt+6e+kBhJbdWjRSdqCIPRrxItqSdMCQW8of/D7PJGSKgyoOWvogn146jykpgfvTBhMoQ6rMA53t4lbGj2kfuN+z07ixo21twDPA0KDLy+F3uMLWfv7iEnCmDa55DoQpKfukPfxGVWSKeVAMwCAihjU8Bwr/SmxE8dW5dyOwLt7AKCZb0HaSSOLQ19eCgNyVu7QVXJ6DhAkAPiarvLhIDamj7bZqInvBth1o5x1tCAqYXJJLZ6SibAGM2Z69UHNfEuEMtxt8zVeAQB6ZRU5IwdRCaRpod5yUrtkGwCw9rfAcwBAzV2r0jP0qgNxtS2F+G5HOHdXX3WebulOKqcwqaIekRrO7w532zy2J0PFrpvlrP2ddtFWw+6HfNAb7vrgf1Hrt14DANb+3lVbSq/ar99Urcsr8zVeJk0L4upcFCScAEs5j4v2G/evopzHxYQSnEyi+Mb95x0agVJxMlGCk8nPVhX+FArSUSpOJj8AdIUkNA7KFu0AAAAASUVORK5CYII=';

function getDashboardSheetName_(scanKey) { return DASHBOARD_PREFIX + scanKey; }
function getScanKeyFromDashboardName_(sheetName) { return sheetName.substring(DASHBOARD_PREFIX.length); }

/**
 * Creates the Dashboard for a ScanKey if it does not exist, or reuses
 * the existing one (Dashboard Design §44-46 — never creates a
 * duplicate). Always refreshes Information + Results afterward.
 */
function createOrRefreshDashboard_(ss, scanKey, currentIndexSheet, lastUpdatedDate) {
  var name = getDashboardSheetName_(scanKey);
  var sheet = ss.getSheetByName(name);
  var isNew = !sheet;
  if (isNew) {
    sheet = getOrCreateSheet_(ss, name);
    buildDashboardLayout_(sheet);
  }
  tagSheetManaged_(sheet, managedTagForDashboard_(scanKey));
  refreshDashboardInfo_(sheet, currentIndexSheet, lastUpdatedDate);
  refreshDashboardResults_(sheet);
  return sheet;
}

/** Writes the one-time static layout: marker, labels, highlights, Clear button. */
function buildDashboardLayout_(sheet) {
  // "Last Updated:" (row 1) is written by refreshDashboardInfo_ on every
  // refresh, since it doubles as the hyperlink to the Current Index
  // sheet and that target can only be known at refresh time.
  sheet.getRange(DASH_ROW_INFO, DASH_COL_INFO_RESULTCOUNT_LABEL).setValue('Result Count:').setFontWeight('bold');

  sheet.getRange(DASH_ROW_FILTER_INPUTS, DASH_COL_FILTER_MARKER).setValue('Filters').setFontWeight('bold');

  for (var i = 0; i < DASH_FILTER_INPUT_COLS.length; i++) {
    sheet.getRange(DASH_ROW_FILTER_INPUTS, DASH_FILTER_INPUT_COLS[i]).setBackground('#fff3cd');
  }

  var chipHintNote = 'Optional: Data validation > Dropdown from a list > Display style: Chip > ' +
    'Allow multiple selections, for a click-to-pick multi-select. Typed comma-separated values ' +
    '(matched with OR logic) also work without this — the app cannot set up the chip picker itself.';
  sheet.getRange(DASH_ROW_FILTER_INPUTS, DASH_COL_TYPE).setNote(chipHintNote);
  sheet.getRange(DASH_ROW_FILTER_INPUTS, DASH_COL_EXTENSION).setNote(chipHintNote);

  var dateHintNote = 'Use Date>YYYY-MM-DD, Month>January (or Month>1), or Year>2026 — comma-separated ' +
    'for multiple values (OR logic). Only one prefix per cell.';
  sheet.getRange(DASH_ROW_FILTER_INPUTS, DASH_COL_CREATED).setNote(dateHintNote);
  sheet.getRange(DASH_ROW_FILTER_INPUTS, DASH_COL_MODIFIED).setNote(dateHintNote);

  sheet.getRange(DASH_ROW_VALIDATION_MSG, 1, 1, DASH_COL_CLEAR).setFontColor('#c00000').setFontStyle('italic');

  var clearBlob = Utilities.newBlob(Utilities.base64Decode(CLEAR_FILTERS_BUTTON_PNG_BASE64), 'image/png', 'clear_filters_button.png');
  sheet.insertImage(clearBlob, DASH_COL_CLEAR, DASH_ROW_FILTER_INPUTS)
    .setWidth(104).setHeight(26)
    .assignScript(CLEAR_FILTERS_BUTTON_FUNCTION);

  setColumnWidths_(sheet, [
    { col: DASH_COL_PATH, width: 220 }, { col: DASH_COL_NAME, width: 180 },
    { col: DASH_COL_TYPE, width: 140 }, { col: DASH_COL_EXTENSION, width: 110 },
    { col: DASH_COL_DESCRIPTION, width: 220 }, { col: DASH_COL_CREATED, width: 200 },
    { col: DASH_COL_MODIFIED, width: 200 }, { col: DASH_COL_CLEAR, width: 120 }
  ]);
  sheet.setFrozenRows(DASH_ROW_RESULTS_HEADER);
}

/**
 * "Last Updated:" doubles as the navigation hyperlink to the Current
 * Index sheet — replaces the old standalone "Index Sheet:" row
 * (DDC-2026-09-08) without losing one-click navigation to the Index.
 */
function refreshDashboardInfo_(sheet, currentIndexSheet, lastUpdatedDate) {
  var label = buildInternalSheetHyperlink_(currentIndexSheet.getSheetId(), 'Last Updated:');
  sheet.getRange(DASH_ROW_INFO, DASH_COL_INFO_LASTUPDATED_LABEL).setValue(label).setFontWeight('bold');
  sheet.getRange(DASH_ROW_INFO, DASH_COL_INFO_LASTUPDATED_VALUE).setValue(formatDateTime_(lastUpdatedDate));
}

/** Builds a HYPERLINK() formula pointing at another sheet in the same workbook. */
function buildInternalSheetHyperlink_(gid, sheetName) {
  var safeName = sheetName.replace(/"/g, '""');
  return '=HYPERLINK("#gid=' + gid + '","' + safeName + '")';
}

function readFilterInputs_(sheet) {
  var numCols = DASH_COL_MODIFIED - DASH_COL_PATH + 1;
  var vals = sheet.getRange(DASH_ROW_FILTER_INPUTS, DASH_COL_PATH, 1, numCols).getValues()[0];
  return {
    path: vals[DASH_COL_PATH - DASH_COL_PATH],
    name: vals[DASH_COL_NAME - DASH_COL_PATH],
    type: vals[DASH_COL_TYPE - DASH_COL_PATH],
    extension: vals[DASH_COL_EXTENSION - DASH_COL_PATH],
    description: vals[DASH_COL_DESCRIPTION - DASH_COL_PATH],
    created: vals[DASH_COL_CREATED - DASH_COL_PATH],
    modified: vals[DASH_COL_MODIFIED - DASH_COL_PATH]
  };
}

/**
 * Validates + parses raw filter inputs. Returns { valid, errors, parsed }.
 * See Dashboard Design §13-27, §10a, and Amendment 2 (Name filter, and
 * Created Date/Modified Date as two independent Date>/Month>/Year>
 * filters replacing the old single Date Type + Month + Year cluster).
 */
function parseAndValidateFilters_(inputs) {
  var errors = [];

  var typeTerms = splitCommaList_(inputs.type).map(normalizeEnum_);
  var validTypeValues = [INDEX_TYPE.FILE, INDEX_TYPE.FOLDER, INDEX_TYPE.ZIP_CONTENT_FILE, INDEX_TYPE.ZIP_CONTENT_FOLDER];
  for (var t = 0; t < typeTerms.length; t++) {
    if (validTypeValues.indexOf(typeTerms[t]) === -1) {
      errors.push('Invalid Type value "' + typeTerms[t] + '". Use FILE, FOLDER, ZIP_CONTENT_FILE, or ZIP_CONTENT_FOLDER.');
    }
  }

  var extensionTerms = splitCommaList_(inputs.extension).map(function (s) { return s.toLowerCase(); });

  var createdFilter = parseDateFieldFilter_(inputs.created);
  if (!createdFilter.valid) {
    errors.push('Invalid Created Date filter. Use Date>YYYY-MM-DD, Month>January (or Month>1), or Year>2026 (comma-separated for multiple).');
  }

  var modifiedFilter = parseDateFieldFilter_(inputs.modified);
  if (!modifiedFilter.valid) {
    errors.push('Invalid Modified Date filter. Use Date>YYYY-MM-DD, Month>January (or Month>1), or Year>2026 (comma-separated for multiple).');
  }

  var parsed = {
    pathFilter: parseTextFilter_(inputs.path),
    nameFilter: parseTextFilter_(inputs.name),
    descriptionFilter: parseTextFilter_(inputs.description),
    typeTerms: typeTerms,
    extensionTerms: extensionTerms,
    createdFilter: createdFilter.valid ? createdFilter : { mode: 'BLANK' },
    modifiedFilter: modifiedFilter.valid ? modifiedFilter : { mode: 'BLANK' }
  };

  return { valid: errors.length === 0, errors: errors, parsed: parsed };
}

/**
 * Reads the Current Index into a filter-ready structure: `values` are
 * the computed/display cell values (used for filter matching), and
 * `output` mixes in HYPERLINK formulas where present (values.length
 * cells) so results copied into the Dashboard remain clickable.
 */
function readIndexForDashboard_(indexSheet) {
  var lastRow = indexSheet.getLastRow();
  var lastCol = indexSheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { headers: [], values: [], output: [] };
  var headers = indexSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (lastRow < 2) return { headers: headers, values: [], output: [] };
  var range = indexSheet.getRange(2, 1, lastRow - 1, lastCol);
  var values = range.getValues();
  var formulas = range.getFormulas();
  var output = values.map(function (row, r) {
    return row.map(function (cell, c) { return formulas[r][c] ? formulas[r][c] : cell; });
  });
  return { headers: headers, values: values, output: output };
}

/** Evaluates one Index data row (`values` form) against parsed filters. */
function recordMatchesFilters_(valuesRow, parsed) {
  var path = valuesRow[2], name = valuesRow[3], type = valuesRow[4], extension = valuesRow[5], description = valuesRow[6];
  var createdDate = valuesRow[7], modifiedDate = valuesRow[8];

  if (!matchesTextFilter_(path, parsed.pathFilter)) return false;
  if (!matchesTextFilter_(name, parsed.nameFilter)) return false;
  if (!matchesTextFilter_(description, parsed.descriptionFilter)) return false;

  if (parsed.typeTerms.length > 0 && parsed.typeTerms.indexOf(normalizeEnum_(type)) === -1) return false;

  if (parsed.extensionTerms.length > 0) {
    var extLower = String(extension || '').toLowerCase();
    if (parsed.extensionTerms.indexOf(extLower) === -1) return false;
  }

  if (!matchesDateFieldFilter_(createdDate, parsed.createdFilter)) return false;
  if (!matchesDateFieldFilter_(modifiedDate, parsed.modifiedFilter)) return false;

  return true;
}

/**
 * Recomputes the filtered Results block for a Dashboard sheet from its
 * corresponding Current Index, writing Result Count, any validation
 * message, and the results themselves (or clearing them on 0 matches /
 * invalid input) — Dashboard Design §9, §48-50.
 */
function refreshDashboardResults_(sheet) {
  var scanKey = getScanKeyFromDashboardName_(sheet.getName());
  var ss = getSpreadsheet_();
  var indexSheet = ss.getSheetByName(scanKey);

  clearResultsArea_(sheet);
  sheet.getRange(DASH_ROW_VALIDATION_MSG, 1).setValue('');

  if (!indexSheet) {
    sheet.getRange(DASH_ROW_INFO, DASH_COL_INFO_RESULTCOUNT_VALUE).setValue(0);
    sheet.getRange(DASH_ROW_VALIDATION_MSG, 1).setValue('Current Index sheet is not available.');
    return;
  }

  var inputs = readFilterInputs_(sheet);
  var validation = parseAndValidateFilters_(inputs);

  if (!validation.valid) {
    sheet.getRange(DASH_ROW_VALIDATION_MSG, 1).setValue(validation.errors.join(' '));
    sheet.getRange(DASH_ROW_INFO, DASH_COL_INFO_RESULTCOUNT_VALUE).setValue(0);
    return;
  }

  var indexData = readIndexForDashboard_(indexSheet);
  var matchedOutputRows = [];
  for (var i = 0; i < indexData.values.length; i++) {
    if (recordMatchesFilters_(indexData.values[i], validation.parsed)) {
      matchedOutputRows.push(indexData.output[i]);
    }
  }

  sheet.getRange(DASH_ROW_INFO, DASH_COL_INFO_RESULTCOUNT_VALUE).setValue(formatCount_(matchedOutputRows.length));

  if (indexData.headers.length > 0) {
    sheet.getRange(DASH_ROW_RESULTS_HEADER, 1, 1, indexData.headers.length).setValues([indexData.headers]).setFontWeight('bold');
  }
  if (matchedOutputRows.length > 0) {
    sheet.getRange(DASH_ROW_RESULTS_START, 1, matchedOutputRows.length, matchedOutputRows[0].length).setValues(matchedOutputRows);
  }
}

function clearResultsArea_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow >= DASH_ROW_RESULTS_HEADER) {
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    sheet.getRange(DASH_ROW_RESULTS_HEADER, 1, lastRow - DASH_ROW_RESULTS_HEADER + 1, lastCol).clearContent();
  }
}

/** Resets all filter inputs to blank (Dashboard Design §47, Amendment 2). */
function clearDashboardFilters_(sheet) {
  var numCols = DASH_COL_MODIFIED - DASH_COL_PATH + 1;
  sheet.getRange(DASH_ROW_FILTER_INPUTS, DASH_COL_PATH, 1, numCols).clearContent();
  refreshDashboardResults_(sheet);
}

/**
 * Runs when the Clear image button is clicked (OverGridImage.assignScript).
 * Button-assigned functions run with no event object, so the target
 * sheet is derived from the active sheet at click time.
 */
function clearAllFiltersFromButton() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) return;
    var name = sheet.getName();
    if (name.indexOf(DASHBOARD_PREFIX) !== 0) return;
    if (!isSheetManagedAs_(sheet, managedTagForDashboard_(getScanKeyFromDashboardName_(name)))) return;
    clearDashboardFilters_(sheet);
  } catch (err) {
    // Button-assigned functions should never surface a raw error to the user.
  }
}

/**
 * Installable-compatible simple trigger: re-evaluates filters live when
 * a user edits a Dashboard filter input cell. Clear Filters is a button
 * (clearAllFiltersFromButton), not an editable cell, so onEdit no
 * longer needs to special-case it (Amendment 2).
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var name = sheet.getName();
    if (name.indexOf(DASHBOARD_PREFIX) !== 0) return;
    if (!isSheetManagedAs_(sheet, managedTagForDashboard_(getScanKeyFromDashboardName_(name)))) return;

    var row = e.range.getRow();
    var col = e.range.getColumn();
    if (row !== DASH_ROW_FILTER_INPUTS) return;

    if (DASH_FILTER_INPUT_COLS.indexOf(col) !== -1) {
      refreshDashboardResults_(sheet);
    }
  } catch (err) {
    // onEdit simple triggers must never throw back to the UI.
  }
}
