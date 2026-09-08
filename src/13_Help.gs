/**
 * 13_Help.gs
 * Creates/refreshes the static, user-oriented Help content and supports
 * Help navigation (Help Sheet Design doc 10). Content mirrors the
 * frozen Topic/Explanation guidance in that document.
 */

function getHelpContent_() {
  return [
    ['ProfileName', 'A friendly name used to identify one scan definition, e.g. FolderA. Becomes part of ScanKey (e.g. FolderA_FILES_D0_ZONLY). Keep it short — it contributes to generated sheet names.'],
    ['SourceURL', 'Paste the full Google Drive folder URL to scan, e.g. https://drive.google.com/drive/folders/<FolderID>. You do not need to extract the Folder ID yourself. The folder must be accessible to the account running the utility.'],
    ['Mode', 'Controls which Drive items are indexed. FILES indexes files only (the source folder itself is not included). FOLDERS indexes folders only (the source folder is included). BOTH indexes files and folders (the source folder is included).'],
    ['Depth', 'Controls how many folder levels below SourceURL are scanned: 0 = source level only, 1 = source + one child level, 2 = two levels, n = n levels, blank = unlimited (scans every accessible descendant level).'],
    ['ZipMode', 'Controls how ZIP files are indexed. ZIP_ONLY indexes the ZIP file itself only. ZIP_WITH_CONTENTS also indexes the folders and files inside the ZIP. Not applicable when Mode = FOLDERS (leave blank; the app uses ZNA internally).'],
    ['IsActive', 'YES makes the row eligible for Scan Drive processing. NO skips the row without treating it as an error.'],
    ['Status', 'System-maintained. One of blank, RUNNING, SUCCESS, WARNING, ERROR, CANCELLED. Do not edit manually.'],
    ['LastUpdated', 'System-maintained date/time of the latest completed processing attempt (spreadsheet timezone).'],
    ['Remarks', 'System-maintained summary of the latest relevant final result, e.g. "Started at: ... | Records processed: ... | Ended at: ... | Time taken: ..." or an error/cancellation message.'],
    ['ScanKey', 'Uniquely identifies one scan definition: ProfileName_Mode_Depth_Zip, e.g. FolderA_FILES_D0_ZONLY or FolderA_BOTH_DALL_ZCNTNTS. Generated automatically — not a Profile column you fill in.'],
    ['Depth Codes', 'Depth appears in ScanKey as D0, D1, D2, ... or DALL when Profile Depth is blank (unlimited).'],
    ['ZIP Codes', 'ZipMode appears in ScanKey as ZONLY (ZIP_ONLY), ZCNTNTS (ZIP_WITH_CONTENTS), or ZNA (not applicable, used with FOLDERS).'],
    ['Generated Sheet Names', 'For ScanKey FolderA_BOTH_DALL_ZCNTNTS: Current Index = FolderA_BOTH_DALL_ZCNTNTS, Previous Index = FolderA_BOTH_DALL_ZCNTNTS_Old, Dashboard = DB_FolderA_BOTH_DALL_ZCNTNTS.'],
    ['Current Index', 'Contains the latest scan results for one ScanKey. Its sheet name is exactly the ScanKey.'],
    ['Previous Index (_Old)', 'Stores the previous snapshot. On refresh: the existing _Old is removed, the current Index becomes the new _Old, and a fresh current Index is generated. Only one previous snapshot is kept.'],
    ['Index Columns', 'Standard columns: Sl.No, ItemID, Path, Name, Type, Extension, Description, CreatedDate, ModifiedDate. There is no separate URL column.'],
    ['ItemID', 'The technical identity of a record: the Drive file/folder ID for normal items, or a derived ZIP:<ZipFileID>:<InternalPath> identity for items inside a ZIP. Do not edit manually.'],
    ['Path', 'The logical folder (or ZIP) hierarchy for the item, e.g. FolderA/SubFolder1/File2.pdf. Clickable where applicable.'],
    ['Name', 'The file/folder/item name. This is the primary navigation link — click it to open the Drive item (or, for items inside a ZIP, the parent ZIP file).'],
    ['Type', 'FILE, FOLDER, ZIP_CONTENT_FILE, or ZIP_CONTENT_FOLDER. A ZIP file itself is always Type=FILE with extension "zip".'],
    ['Extension', 'Normal file extension (pdf, docx, xlsx, zip, ...) or a Google Workspace short type (gsheet, gdoc, gslide, gform, gdraw), always lowercase. (Shortened from "Extension / Google File Type" — Dashboard Design DDC-2026-09-08 Amendment 2.)'],
    ['Description', 'The Drive description, when one exists. Left blank otherwise — never invented.'],
    ['User-Added Columns', 'Add your own columns after the standard Index columns (e.g. Category, Review Status, Notes). Their names, order, and values (matched by ItemID) are preserved every time the Index is refreshed. New items get blank values; renamed/moved items keep their values as long as the Drive ID is unchanged.'],
    ['Dashboard', 'Each Current Index has one Dashboard (DB_ScanKey) for filtering, browsing, and navigating its records. The Dashboard always reflects the Current Index, never the _Old snapshot.'],
    ['Dashboard Information', 'A single row shows "Last Updated:" (click it to jump to the Current Index sheet) and "Result Count:" (how many records match the current filters). ScanKey and a separate Index Sheet row were removed as redundant — Dashboard Design DDC-2026-09-08.'],
    ['Dashboard Filters Row', 'The filter row sits directly under the Results header, one filter per matching column (Path above Path, Name above Name, and so on). Sl.No has no filter; the ItemID column instead shows the word "Filters" marking the row. There are no separate per-column labels — Amendment 2.'],
    ['Dashboard - Path / Name / Description', 'Support three search styles: plain text (must appear as an exact sequence), ANY>term1 term2 (matches if at least one term appears), and ALL>term1 term2 (matches only if every term appears, anywhere). Matching is case-insensitive. Entering ANY> or ALL> with no terms is treated as a blank filter.'],
    ['Dashboard - Type', 'Comma-separated list, matched with OR logic, e.g. FILE,ZIP_CONTENT_FILE. Allowed values: FILE, FOLDER, ZIP_CONTENT_FILE, ZIP_CONTENT_FOLDER. A right-click "Data validation" chip-style dropdown can optionally be added to this cell for click-to-pick multi-select.'],
    ['Dashboard - Extension', 'Comma-separated list, matched with OR logic, e.g. pdf,gdoc,gsheet. A chip-style multi-select dropdown can optionally be added the same way as Type.'],
    ['Dashboard - Created Date / Modified Date', 'Two independent filter cells, one per date field. Each takes exactly one prefix: Date>2026-09-01,2026-09-05 (exact dates), Month>January,March or Month>1,3 (month names or numbers), or Year>2025,2026 (four-digit years). Multiple values after a prefix use OR logic; the two date columns combine with AND when both are filled in.'],
    ['Combined Filters', 'Different filter fields (Path, Name, Type, Extension, Description, Created Date, Modified Date) combine with AND. Multiple values inside one field (Type, Extension, or the values after a Date>/Month>/Year> prefix) combine with OR.'],
    ['Result Count', 'Shows how many records match the current filters. 0 simply means no matches — it is not an error. Blank filters show the full Current Index.'],
    ['Clear Filters', 'Click the "Clear" button (with the filter icon) next to the last filter column to reset every filter to blank.'],
    ['RM', 'The workbook ReadMe and navigation index — always the first sheet. Lists every sheet in the workbook with a clickable link.'],
    ['Log', 'Concise operational history: DateTime, ScanKey, Action, Status, Message. Use it to see when a scan started, finished, warned, errored, or was cancelled. Newest entries are at the top.'],
    ['Dev_Log', 'Detailed diagnostics for developers/testers (function entry/exit, validation, decisions, performance, errors). Controlled by DEV_MODE in config.gs. Normal users typically do not need it.'],
    ['TechPoov Menu', 'TechPoov > Scan Drive, Cancel Scan, Help, and About this tool.'],
    ['Scan Drive', 'Processes every Profile row with IsActive = YES, after validating configuration. Large scans continue automatically across several executions if needed — no manual restart required.'],
    ['Cancel Scan', 'Requests a controlled stop of the active scan at the next safe checkpoint. If nothing is running, you will see a message saying so — this is not an error.'],
    ['Help', 'Opens this Help sheet.'],
    ['About this tool', 'Shows the application name, version, TechPoov brand, and a short description.'],
    ['Common Error - Invalid SourceURL', 'Confirm you pasted a full Google Drive folder URL, and that the folder is accessible to your account.'],
    ['Common Error - Invalid Mode', 'Use only FILES, FOLDERS, or BOTH.'],
    ['Common Error - Invalid Depth', 'Depth must be blank or a whole number 0 or greater. Negative numbers, decimals, and text are not supported.'],
    ['Common Error - Invalid ZipMode', 'For FILES or BOTH, use ZIP_ONLY or ZIP_WITH_CONTENTS. For FOLDERS, leave ZipMode blank.'],
    ['Common Error - Duplicate ScanKey', 'Two active rows produced the same ScanKey. Change ProfileName, Mode, Depth, or ZipMode so each active scan definition is unique.'],
    ['Common Error - Drive Access Error', 'Confirm the signed-in user has permission to access the configured source folder. Check Log for details, or Dev_Log when DEV_MODE is enabled.'],
    ['Common Error - Invalid Dashboard Date Filter', 'Created Date / Modified Date cells must start with Date>, Month>, or Year>, followed by comma-separated values, e.g. Month>January,March or Year>2025,2026.'],
    ['Common Message - No Active Profiles', 'Scan Drive found no rows with IsActive = YES. Set at least one Profile row to YES to scan it.'],
    ['Common Message - Scan Already Running', 'Only one scan can run at a time. Wait for it to finish, or use Cancel Scan.'],
    ['Common Message - No Scan Running', 'Cancel Scan was used while nothing was active — this is not an error.']
  ];
}

function ensureHelpSheet_(ss) {
  var sheet = getSheetSafe_(ss, SHEET_HELP);
  var isNew = !sheet;
  if (isNew) sheet = getOrCreateSheet_(ss, SHEET_HELP);
  return sheet;
}

/** (Re)writes the full static Help content and repositions Help last. */
function refreshHelp_(ss) {
  var sheet = ensureHelpSheet_(ss);
  clearSheetCompletely_(sheet);
  writeHeaderRow_(sheet, ['Topic', 'Explanation']);
  var content = getHelpContent_();
  batchSetValues_(sheet, 2, 1, content);
  freezeHeaderRow_(sheet);
  enableFilterSafe_(sheet, content.length + 1, 2);
  setColumnWidths_(sheet, [{ col: 1, width: 220 }, { col: 2, width: 620 }]);
  try { sheet.getRange(2, 2, content.length, 1).setWrap(true); } catch (e) {}
  moveSheetToPosition_(ss, sheet, ss.getSheets().length); // last among current sheets
  return sheet;
}

/** TechPoov -> Help. Activates the Help sheet, creating it if missing. */
function activateHelpSheet_() {
  var ss = getSpreadsheet_();
  var sheet = getSheetSafe_(ss, SHEET_HELP);
  if (!sheet) {
    showAlertSafe_('Help sheet is not available.');
    writeDevLog_('', '13_Help.gs::activateHelpSheet_', DEV_LOG_EVENT.WARNING, 'Help sheet missing on navigation', '');
    flushDevLogBuffer_();
    return;
  }
  ss.setActiveSheet(sheet);
}
