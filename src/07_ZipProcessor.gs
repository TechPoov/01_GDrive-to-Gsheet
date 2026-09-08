/**
 * 07_ZipProcessor.gs
 * ZIP_ONLY / ZIP_WITH_CONTENTS processing: internal hierarchy
 * reconstruction, derived ZIP ItemID creation, and ZIP warnings/errors
 * (Index Sheet Design §24-27, Processing Design §27-31, Validation &
 * Error Handling Design §43-45).
 *
 * Apps Script's Utilities.unzip() decompresses a whole Blob in one
 * synchronous call and does not expose per-entry timestamps or a
 * resumable/streaming API, so expansion of a single ZIP's contents is
 * necessarily atomic within one physical execution (Technical
 * Architecture §54 — runtime budget is checked before starting, but the
 * unzip+flatten step itself cannot be paused mid-way; documented as a
 * known limitation in the completion deliverables).
 */

/**
 * Expands one ZIP file's internal contents into ordered
 * ZIP_CONTENT_FOLDER / ZIP_CONTENT_FILE records.
 * Returns { success, records, warning } — on failure, records is [] and
 * warning explains that the parent ZIP record itself should be retained.
 */
function processZipContents_(zipFile, zipFileId, zipDisplayPath) {
  var blobs;
  try {
    var zipBlob = zipFile.getBlob();
    blobs = Utilities.unzip(zipBlob);
  } catch (e) {
    return {
      success: false,
      records: [],
      warning: 'Warning: ZIP contents could not be processed for "' + zipFile.getName() + '". The ZIP file itself was retained.',
      exceptionMessage: extractExceptionMessage_(e)
    };
  }

  try {
    var tree = buildZipTree_(blobs);
    var records = flattenZipTree_(tree, zipFileId, zipDisplayPath);
    return { success: true, records: records, warning: null };
  } catch (e) {
    return {
      success: false,
      records: [],
      warning: 'Warning: ZIP contents could not be processed for "' + zipFile.getName() + '". The ZIP file itself was retained.',
      exceptionMessage: extractExceptionMessage_(e)
    };
  }
}

/**
 * Builds an in-memory folder tree from the flat Blob array returned by
 * Utilities.unzip(). Directory-only entries (names ending in '/') are
 * used only as hints; the tree is otherwise derived from file paths so
 * ZIPs without explicit directory entries still produce correct
 * ZIP_CONTENT_FOLDER records.
 */
function buildZipTree_(blobs) {
  var root = { folders: {}, files: [] };
  for (var i = 0; i < blobs.length; i++) {
    var blob = blobs[i];
    var rawName = normalizeZipInternalPath_(blob.getName());
    if (!rawName || rawName.charAt(rawName.length - 1) === '/') continue; // pure directory marker, skip
    var segments = rawName.split('/');
    var fileName = segments.pop();
    var node = root;
    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      if (!seg) continue;
      if (!node.folders[seg]) node.folders[seg] = { folders: {}, files: [] };
      node = node.folders[seg];
    }
    node.files.push({ name: fileName, blob: blob });
  }
  return root;
}

/**
 * Depth-first flattening matching the same hierarchical ordering rules
 * as normal Drive traversal (Index Design §37): files sorted by Name
 * ascending, then child folders sorted by Name ascending, each child
 * folder followed immediately by its own contents.
 */
function flattenZipTree_(node, zipFileId, parentDisplayPath, parentInternalPath) {
  var records = [];
  var internalBase = parentInternalPath || '';

  var fileNames = node.files.map(function (f) { return f.name; }).sort(compareNamesCaseInsensitive_);
  var filesByName = {};
  node.files.forEach(function (f) { filesByName[f.name] = f; });
  for (var i = 0; i < fileNames.length; i++) {
    var name = fileNames[i];
    var internalPath = internalBase ? (internalBase + '/' + name) : name;
    var displayPath = parentDisplayPath + '/' + name;
    records.push(buildZipContentFileRecord_(zipFileId, internalPath, name, displayPath));
  }

  var folderNames = Object.keys(node.folders).sort(compareNamesCaseInsensitive_);
  for (var j = 0; j < folderNames.length; j++) {
    var fname = folderNames[j];
    var childInternalPath = internalBase ? (internalBase + '/' + fname) : fname;
    var childDisplayPath = parentDisplayPath + '/' + fname;
    records.push(buildZipContentFolderRecord_(zipFileId, childInternalPath, fname, childDisplayPath));
    var childRecords = flattenZipTree_(node.folders[fname], zipFileId, childDisplayPath, childInternalPath);
    records = records.concat(childRecords);
  }

  return records;
}
