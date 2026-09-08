/**
 * 20_DriveUtils.gs
 * Reusable Google Drive helpers: URL/ID parsing, metadata retrieval,
 * MIME/type checks, and Drive hyperlink construction. Uses the built-in
 * DriveApp service (see Design Review — chosen over Advanced Drive to
 * avoid requiring users to enable an advanced service).
 */

/**
 * Extracts a Drive folder ID from a full folder URL.
 * Supports the standard "/drive/folders/<id>" pattern and tolerates a
 * trailing "?usp=sharing" or similar query string.
 * Returns the ID string, or null if not recognized as a folder URL.
 */
function extractFolderIdFromUrl_(url) {
  if (isBlank_(url)) return null;
  var text = String(url).trim();
  var match = text.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  // Tolerate a bare folder ID being pasted directly.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(text) && text.indexOf('/') === -1) return text;
  return null;
}

/**
 * Attempts to open a folder by ID. Never throws — returns a structured
 * result so callers can classify SOURCE_NOT_FOUND vs SOURCE_ACCESS_DENIED.
 */
function getFolderByIdSafe_(folderId) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    // Force a property read to confirm real access (getFolderById alone
    // can succeed even when later calls fail for permission reasons).
    folder.getName();
    return { success: true, folder: folder };
  } catch (e) {
    var msg = String(e && e.message || e);
    if (msg.indexOf('access') !== -1 || msg.indexOf('permission') !== -1) {
      return { success: false, code: ERROR_CODES.SOURCE_ACCESS_DENIED, error: msg };
    }
    return { success: false, code: ERROR_CODES.SOURCE_NOT_FOUND, error: msg };
  }
}

/** True if a Drive File is a ZIP archive by MIME type or extension. */
function isZipFile_(file) {
  try {
    var mime = file.getMimeType();
    if (ZIP_MIME_TYPES.indexOf(mime) !== -1) return true;
  } catch (e) { /* fall through to extension check */ }
  var ext = getFileExtension_(file.getName());
  return ext === 'zip';
}

/**
 * Maps a Google Workspace MIME type to its short Index value (gsheet,
 * gdoc, ...). Returns null for non-Google-native / unmapped MIME types.
 */
function getGoogleFileTypeShort_(mimeType) {
  if (isBlank_(mimeType)) return null;
  if (mimeType === 'application/vnd.google-apps.folder') return null;
  var mapped = GOOGLE_MIME_TYPE_MAP[mimeType];
  return mapped ? mapped : null;
}

/** True if the MIME type represents a Google Workspace native file. */
function isGoogleNativeMime_(mimeType) {
  return typeof mimeType === 'string' && mimeType.indexOf('application/vnd.google-apps') === 0
    && mimeType !== 'application/vnd.google-apps.folder';
}

function buildDriveFileUrl_(id) {
  return 'https://drive.google.com/file/d/' + id + '/view';
}

function buildDriveFolderUrl_(id) {
  return 'https://drive.google.com/drive/folders/' + id;
}

/** Builds a Sheets HYPERLINK() formula string for a URL + display label. */
function buildHyperlinkFormula_(url, label) {
  var safeLabel = String(label === undefined || label === null ? '' : label).replace(/"/g, '""');
  var safeUrl = String(url === undefined || url === null ? '' : url).replace(/"/g, '""');
  if (!safeUrl) return safeLabel;
  return '=HYPERLINK("' + safeUrl + '","' + safeLabel + '")';
}

/**
 * Returns direct child files of a folder as a plain array, sorted by
 * Name ascending (case-insensitive) — Index Design §37/39.
 */
function collectDirectFilesSorted_(folder) {
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    files.push(it.next());
  }
  files.sort(function (a, b) { return compareNamesCaseInsensitive_(a.getName(), b.getName()); });
  return files;
}

/**
 * Returns direct child folders of a folder as a plain array, sorted by
 * Name ascending (case-insensitive) — Index Design §37/40.
 */
function collectChildFoldersSorted_(folder) {
  var folders = [];
  var it = folder.getFolders();
  while (it.hasNext()) {
    folders.push(it.next());
  }
  folders.sort(function (a, b) { return compareNamesCaseInsensitive_(a.getName(), b.getName()); });
  return folders;
}

/**
 * Extracts the metadata this application needs from a Drive File, never
 * throwing — individual metadata calls are wrapped so one failing
 * property (e.g. description) does not lose the whole record.
 */
function getFileMetadataSafe_(file) {
  var meta = { id: '', name: '', description: '', createdDate: null, modifiedDate: null, mimeType: '', sizeKnown: false };
  try { meta.id = file.getId(); } catch (e) {}
  try { meta.name = file.getName(); } catch (e) {}
  try { meta.description = file.getDescription() || ''; } catch (e) {}
  try { meta.createdDate = file.getDateCreated(); } catch (e) {}
  try { meta.modifiedDate = file.getLastUpdated(); } catch (e) {}
  try { meta.mimeType = file.getMimeType(); } catch (e) {}
  return meta;
}

/** Same idea as getFileMetadataSafe_ but for a Drive Folder. */
function getFolderMetadataSafe_(folder) {
  var meta = { id: '', name: '', description: '', createdDate: null, modifiedDate: null };
  try { meta.id = folder.getId(); } catch (e) {}
  try { meta.name = folder.getName(); } catch (e) {}
  try { meta.description = folder.getDescription() || ''; } catch (e) {}
  try { meta.createdDate = folder.getDateCreated(); } catch (e) {}
  try { meta.modifiedDate = folder.getLastUpdated(); } catch (e) {}
  return meta;
}
