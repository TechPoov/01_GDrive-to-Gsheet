/**
 * 10_UserData.gs
 * Detects, preserves, maps, and restores user-added Index columns and
 * values using ItemID as the primary identity (Index Sheet Design
 * §28-31, §46; Processing Design §36, §40).
 */

// NOTE: computed lazily (not as top-level constants) because Apps Script
// evaluates each file's top-level statements in file-list order, and this
// file must not depend on config.gs (which defines INDEX_COLUMNS) having
// already loaded first.
function getIndexStandardColumnCount_() {
  return INDEX_COLUMNS.length;
}

function getIndexItemIdColumnIndex_() {
  return INDEX_COLUMNS.indexOf('ItemID'); // 0-based, expected 1
}

/**
 * Reads an existing Current Index sheet and extracts any user-added
 * columns (those beyond the 9 frozen standard columns) plus their
 * values keyed by ItemID. Returns { userColumnNames, valuesByItemId }.
 * Returns empty structures if the sheet has no extra columns (or is
 * null, e.g. first scan for this ScanKey).
 */
function preserveUserAddedData_(sheet) {
  if (!sheet) return { userColumnNames: [], valuesByItemId: {} };
  var headers = getHeaderRow_(sheet);
  var standardColumnCount = getIndexStandardColumnCount_();
  if (headers.length <= standardColumnCount) {
    return { userColumnNames: [], valuesByItemId: {} };
  }
  var userColumnNames = headers.slice(standardColumnCount);
  var data = readAllDataRows_(sheet);
  var valuesByItemId = {};
  var itemIdColumnIndex = getIndexItemIdColumnIndex_();
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var itemId = row[itemIdColumnIndex];
    if (isBlank_(itemId)) continue;
    valuesByItemId[itemId] = row.slice(standardColumnCount);
  }
  return { userColumnNames: userColumnNames, valuesByItemId: valuesByItemId };
}

/**
 * Builds the user-added-column value rows aligned to a new ordered list
 * of ItemIDs. Matched ItemIDs restore their previous values; new
 * ItemIDs receive blank values (Index Sheet Design §29-32).
 * Returns { rows, matchedCount, newCount }.
 */
function buildUserColumnRows_(preserved, itemIdsInOrder) {
  var numUserCols = preserved.userColumnNames.length;
  var matchedCount = 0;
  var newCount = 0;
  var rows = new Array(itemIdsInOrder.length);

  for (var i = 0; i < itemIdsInOrder.length; i++) {
    var existing = preserved.valuesByItemId[itemIdsInOrder[i]];
    if (existing) {
      matchedCount++;
      var row = existing.slice(0, numUserCols);
      while (row.length < numUserCols) row.push('');
      rows[i] = row;
    } else {
      newCount++;
      rows[i] = new Array(numUserCols).fill('');
    }
  }
  return { rows: rows, matchedCount: matchedCount, newCount: newCount };
}
