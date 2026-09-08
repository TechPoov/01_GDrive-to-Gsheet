/**
 * 08_Metadata.gs
 * Normalizes raw Drive/ZIP metadata into the canonical in-memory Index
 * record shape used throughout scanning, staging, and Index writing
 * (Index Sheet Design doc 06 §5-22).
 *
 * Canonical record shape:
 *   {
 *     itemId, path, pathUrl, name, nameUrl, type,
 *     extension, description, createdDate, modifiedDate
 *   }
 */

/** Determines the Extension (file extension or Google Workspace short type) value for a normal Drive file. */
function resolveExtensionOrGoogleType_(mimeType, fileName) {
  var googleType = getGoogleFileTypeShort_(mimeType);
  if (googleType) return googleType;
  return getFileExtension_(fileName);
}

/**
 * Builds a FILE record from Drive file metadata (Index Design §37/39).
 * parentFolderId is used for the secondary Path hyperlink, which points
 * to the containing folder (Index Design §11).
 */
function buildFileRecord_(fileMeta, path, parentFolderId) {
  return {
    itemId: fileMeta.id,
    path: path,
    pathUrl: parentFolderId ? buildDriveFolderUrl_(parentFolderId) : buildDriveFileUrl_(fileMeta.id),
    name: fileMeta.name,
    nameUrl: buildDriveFileUrl_(fileMeta.id),
    type: INDEX_TYPE.FILE,
    extension: resolveExtensionOrGoogleType_(fileMeta.mimeType, fileMeta.name),
    description: fileMeta.description || '',
    createdDate: fileMeta.createdDate || null,
    modifiedDate: fileMeta.modifiedDate || null
  };
}

/** Builds a FOLDER record from Drive folder metadata (Index Design §25). */
function buildFolderRecord_(folderMeta, path) {
  return {
    itemId: folderMeta.id,
    path: path,
    pathUrl: buildDriveFolderUrl_(folderMeta.id),
    name: folderMeta.name,
    nameUrl: buildDriveFolderUrl_(folderMeta.id),
    type: INDEX_TYPE.FOLDER,
    extension: '',
    description: folderMeta.description || '',
    createdDate: folderMeta.createdDate || null,
    modifiedDate: folderMeta.modifiedDate || null
  };
}

/**
 * Builds a ZIP_CONTENT_FILE record. ZIP internal timestamps are not
 * reliably available via Apps Script's Utilities.unzip(), so
 * created/modified are always left blank (Index Design §20-21;
 * Design Review decision #2).
 */
function buildZipContentFileRecord_(zipFileId, internalPath, entryName, path) {
  return {
    itemId: ZIP_ITEM_ID_PREFIX + zipFileId + ':' + internalPath,
    path: path,
    pathUrl: buildDriveFileUrl_(zipFileId),
    name: entryName,
    nameUrl: buildDriveFileUrl_(zipFileId), // ZIP internal items open the parent ZIP (Index Design §13).
    type: INDEX_TYPE.ZIP_CONTENT_FILE,
    extension: getFileExtension_(entryName),
    description: '',
    createdDate: null,
    modifiedDate: null
  };
}

function buildZipContentFolderRecord_(zipFileId, internalPath, folderName, path) {
  return {
    itemId: ZIP_ITEM_ID_PREFIX + zipFileId + ':' + internalPath,
    path: path,
    pathUrl: buildDriveFileUrl_(zipFileId),
    name: folderName,
    nameUrl: buildDriveFileUrl_(zipFileId),
    type: INDEX_TYPE.ZIP_CONTENT_FOLDER,
    extension: '',
    description: '',
    createdDate: null,
    modifiedDate: null
  };
}

/**
 * Converts a canonical record into a raw staging row array. Sl.No is
 * intentionally excluded — it is assigned only after final ordering
 * (Index Design §7/43). Dates are stored as spreadsheet-timezone
 * formatted strings so staging (a plain sheet) round-trips them safely.
 */
function recordToStagingRow_(record) {
  return [
    record.itemId,
    record.path,
    record.pathUrl || '',
    record.name,
    record.nameUrl || '',
    record.type,
    record.extension || '',
    record.description || '',
    record.createdDate ? formatDateTime_(record.createdDate) : '',
    record.modifiedDate ? formatDateTime_(record.modifiedDate) : ''
  ];
}

/** Staging row column layout, matched to recordToStagingRow_ above. */
var STAGING_COLUMNS = ['ItemID', 'Path', 'PathUrl', 'Name', 'NameUrl', 'Type', 'Extension', 'Description', 'CreatedDate', 'ModifiedDate'];

function stagingRowToRecord_(row) {
  return {
    itemId: row[0],
    path: row[1],
    pathUrl: row[2],
    name: row[3],
    nameUrl: row[4],
    type: row[5],
    extension: row[6],
    description: row[7],
    createdDate: row[8],   // already formatted text at this point
    modifiedDate: row[9]
  };
}
