/**
 * 09_IndexManager.gs
 * Builds the Current Index from staged scan records, manages the safe
 * Current -> _Old rotation, restores preserved user-added data, and
 * applies formatting/hyperlinks (Index Sheet Design doc 06, Processing
 * Design §35-41, Technical Architecture §43-46).
 *
 * This is the "critical section" described throughout the frozen
 * design: it must only be entered once complete replacement data is
 * ready (prepare-first -> replace-later), and once entered it runs to
 * completion without honoring a mid-flight cancellation, to protect
 * workbook consistency (Processing Design §38, §62).
 */

/**
 * Finalizes the Current Index for one ScanKey from fully-collected
 * staged rows. Returns { recordCount, matchedUserData, newItems }.
 */
function finalizeIndex_(ss, scanKey, stagedRows) {
  var existingCurrent = ss.getSheetByName(scanKey);
  var preserved = preserveUserAddedData_(existingCurrent);

  // --- Safe rotation: existing Current -> _Old (Index Design §34, §11) ---
  var oldName = scanKey + OLD_INDEX_SUFFIX;
  deleteSheetIfExists_(ss, oldName);
  if (existingCurrent) {
    renameSheetSafe_(existingCurrent, oldName);
    tagSheetManaged_(existingCurrent, managedTagForOldIndex_(scanKey));
  }

  var newSheet = getOrCreateSheet_(ss, scanKey);
  clearSheetCompletely_(newSheet);
  tagSheetManaged_(newSheet, managedTagForCurrentIndex_(scanKey));

  var headers = INDEX_COLUMNS.concat(preserved.userColumnNames);
  writeHeaderRow_(newSheet, headers);

  var itemIds = stagedRows.map(function (r) { return stagingRowToRecord_(r).itemId; });
  var userRowsInfo = buildUserColumnRows_(preserved, itemIds);

  var allRows = new Array(stagedRows.length);
  for (var i = 0; i < stagedRows.length; i++) {
    var rec = stagingRowToRecord_(stagedRows[i]);
    var row = [
      i + 1,
      rec.itemId,
      buildHyperlinkFormula_(rec.pathUrl, rec.path),
      buildHyperlinkFormula_(rec.nameUrl, rec.name),
      rec.type,
      rec.extension,
      rec.description,
      rec.createdDate,
      rec.modifiedDate
    ].concat(userRowsInfo.rows[i]);
    allRows[i] = row;
  }

  writeIndexRowsBatched_(newSheet, allRows);

  freezeHeaderRow_(newSheet);
  enableFilterSafe_(newSheet, allRows.length + 1, headers.length);
  applyIndexColumnFormatting_(newSheet, headers.length);

  writeDevLog_(scanKey, '09_IndexManager.gs::finalizeIndex_', DEV_LOG_EVENT.OUTPUT,
    'User-added values restored',
    { matchedItemIds: userRowsInfo.matchedCount, newItems: userRowsInfo.newCount, userColumns: preserved.userColumnNames.length });

  return { recordCount: allRows.length, matchedUserData: userRowsInfo.matchedCount, newItems: userRowsInfo.newCount, sheet: newSheet };
}

/** Writes index rows in configurable batches to bound single-call payload size. */
function writeIndexRowsBatched_(sheet, allRows) {
  if (allRows.length === 0) return;
  var startRow = 2;
  for (var offset = 0; offset < allRows.length; offset += SHEET_WRITE_BATCH_SIZE) {
    var chunk = allRows.slice(offset, offset + SHEET_WRITE_BATCH_SIZE);
    batchSetValues_(sheet, startRow + offset, 1, chunk);
  }
}

function applyIndexColumnFormatting_(sheet, numCols) {
  try {
    setColumnWidths_(sheet, [
      { col: 1, width: 60 },   // Sl.No
      { col: 2, width: 180 },  // ItemID
      { col: 3, width: 320 },  // Path
      { col: 4, width: 220 },  // Name
      { col: 5, width: 130 },  // Type
      { col: 6, width: 110 },  // Extension
      { col: 7, width: 260 },  // Description
      { col: 8, width: 150 },  // CreatedDate
      { col: 9, width: 150 }   // ModifiedDate
    ]);
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 7, lastRow - 1, 1).setWrap(true); // Description
    }
  } catch (e) {}
}
