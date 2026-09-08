/**
 * 06_DriveScanner.gs
 * Hierarchical, depth-first, resumable Google Drive traversal
 * (Index Sheet Design §36-43, Processing Design §17-31, Technical
 * Architecture §23-26).
 *
 * Implemented as an explicit-stack iterative traversal (not recursion)
 * so the entire walk state is JSON-serializable and can be persisted via
 * 18_Continuation.gs and resumed in a later physical execution with
 * bit-for-bit identical final ordering, regardless of how many
 * executions were required.
 *
 * Resulting records are streamed into the hidden staging sheet
 * (18_Continuation.gs) in batches as they are produced — the existing
 * Current Index is never touched during traversal (prepare-first
 * principle, Processing Design §73-74).
 */

function modeIncludesFiles_(mode) { return mode === MODE_FILES || mode === MODE_BOTH; }
function modeIncludesFolders_(mode) { return mode === MODE_FOLDERS || mode === MODE_BOTH; }
function canDescend_(depthLevel, maxDepth) { return maxDepth === null || depthLevel < maxDepth; }

/** Creates a fresh (uninitialized) traversal stack frame. */
function makeFrame_(folderId, path, depthLevel) {
  return {
    folderId: folderId,
    path: path,
    depthLevel: depthLevel,
    initialized: false,
    files: [],
    childFolders: [],
    nextFileIndex: 0,
    nextChildIndex: 0,
    fileZipExpansionPending: false,
    pendingZipPath: null
  };
}

/** Lazily lists a frame's direct files/child-folders (id+name only — serializable). */
function initializeFrame_(frame, mode) {
  var folder = DriveApp.getFolderById(frame.folderId);
  if (modeIncludesFiles_(mode)) {
    frame.files = collectDirectFilesSorted_(folder).map(function (f) { return { id: f.getId(), name: f.getName() }; });
  }
  frame.childFolders = collectChildFoldersSorted_(folder).map(function (f) { return { id: f.getId(), name: f.getName() }; });
  frame.initialized = true;
}

/**
 * Runs (or resumes) the resumable Drive traversal for one Profile scan.
 * ctx = { scanKey, mode, maxDepth (number|null), zipCode,
 *         sourceFolderId, sourceFolderName, stagingSheet, executionStartMs }
 * resumeState = previously saved { stack, recordsSoFar } or null for a fresh start.
 * Returns { status: 'COMPLETE'|'CONTINUATION'|'CANCELLED', recordsSoFar }.
 */
function scanFolderResumable_(ctx, resumeState) {
  var stack, recordsSoFar, stagingBuffer;
  if (resumeState) {
    stack = resumeState.stack;
    recordsSoFar = resumeState.recordsSoFar || 0;
  } else {
    stack = [];
    recordsSoFar = 0;
    // Source folder's own record (FOLDERS/BOTH only) is emitted once,
    // up front, before the root frame is pushed (Profile Design §9-10).
    if (modeIncludesFolders_(ctx.mode)) {
      var srcFolder = DriveApp.getFolderById(ctx.sourceFolderId);
      var srcMeta = getFolderMetadataSafe_(srcFolder);
      var srcRecord = buildFolderRecord_(srcMeta, ctx.sourceFolderName);
      appendStagingRows_(ctx.stagingSheet, [recordToStagingRow_(srcRecord)]);
      recordsSoFar++;
    }
    stack.push(makeFrame_(ctx.sourceFolderId, ctx.sourceFolderName, 0));
  }
  stagingBuffer = [];

  var itemCounter = 0;

  function flushBuffer() {
    if (stagingBuffer.length > 0) {
      appendStagingRows_(ctx.stagingSheet, stagingBuffer);
      recordsSoFar += stagingBuffer.length;
      stagingBuffer = [];
    }
  }

  while (stack.length > 0) {
    itemCounter++;

    if (checkCancellationCheckpoint_()) {
      flushBuffer();
      return { status: 'CANCELLED', recordsSoFar: recordsSoFar };
    }

    if (shouldCheckRuntimeNow_(itemCounter) && !isRuntimeSafe_(ctx.executionStartMs)) {
      flushBuffer();
      saveTraversalState_({ stack: stack, recordsSoFar: recordsSoFar });
      return { status: 'CONTINUATION', recordsSoFar: recordsSoFar };
    }

    var frame = stack[stack.length - 1];

    if (!frame.initialized) {
      try {
        initializeFrame_(frame, ctx.mode);
      } catch (e) {
        // Folder became inaccessible/deleted mid-scan: skip it as a
        // recoverable warning rather than failing the whole Profile
        // (Validation & Error Handling Design §39).
        incrementWarningCount_();
        writeDevLog_(ctx.scanKey, '06_DriveScanner.gs::initializeFrame_', DEV_LOG_EVENT.WARNING,
          'Folder skipped (inaccessible)', 'FolderID=' + frame.folderId + ' | ' + extractExceptionMessage_(e));
        stack.pop();
        continue;
      }
      continue;
    }

    // --- Process this frame's direct files (if any remain) ---
    if (frame.nextFileIndex < frame.files.length) {
      var fileResult = processOneFile_(frame, ctx, stagingBuffer, ctx.executionStartMs);
      if (fileResult.status === 'SUSPEND') {
        flushBuffer();
        saveTraversalState_({ stack: stack, recordsSoFar: recordsSoFar });
        return { status: 'CONTINUATION', recordsSoFar: recordsSoFar };
      }
      if (stagingBuffer.length >= STAGING_WRITE_BATCH_SIZE) flushBuffer();
      continue;
    }

    // --- Process this frame's direct child folders ---
    if (frame.nextChildIndex < frame.childFolders.length) {
      var childRef = frame.childFolders[frame.nextChildIndex];
      frame.nextChildIndex++;
      var childPath = frame.path + '/' + childRef.name;

      if (modeIncludesFolders_(ctx.mode)) {
        try {
          var childFolder = DriveApp.getFolderById(childRef.id);
          var childMeta = getFolderMetadataSafe_(childFolder);
          stagingBuffer.push(recordToStagingRow_(buildFolderRecord_(childMeta, childPath)));
        } catch (e) {
          incrementWarningCount_();
          writeDevLog_(ctx.scanKey, '06_DriveScanner.gs::scanFolderResumable_', DEV_LOG_EVENT.WARNING,
            'Child folder skipped (inaccessible)', 'FolderID=' + childRef.id);
        }
      }

      if (canDescend_(frame.depthLevel, ctx.maxDepth)) {
        stack.push(makeFrame_(childRef.id, childPath, frame.depthLevel + 1));
      }
      if (stagingBuffer.length >= STAGING_WRITE_BATCH_SIZE) flushBuffer();
      continue;
    }

    // Frame fully processed.
    stack.pop();
  }

  flushBuffer();
  return { status: 'COMPLETE', recordsSoFar: recordsSoFar };
}

/**
 * Processes exactly one direct file of the current frame: emits its
 * FILE record, and — for ZIP_WITH_CONTENTS — expands its internal
 * contents as a distinct, separately runtime-checked sub-step
 * (Technical Architecture §54; Design Review decision, Processing
 * Design §28-31). Returns {status:'CONTINUE'} or {status:'SUSPEND'}.
 */
function processOneFile_(frame, ctx, stagingBuffer, executionStartMs) {
  var fileRef = frame.files[frame.nextFileIndex];

  if (!frame.fileZipExpansionPending) {
    var file;
    try {
      file = DriveApp.getFileById(fileRef.id);
    } catch (e) {
      incrementWarningCount_();
      writeDevLog_(ctx.scanKey, '06_DriveScanner.gs::processOneFile_', DEV_LOG_EVENT.WARNING,
        'File skipped (inaccessible)', 'FileID=' + fileRef.id);
      frame.nextFileIndex++;
      return { status: 'CONTINUE' };
    }
    var fileMeta = getFileMetadataSafe_(file);
    var filePath = frame.path + '/' + fileMeta.name;
    stagingBuffer.push(recordToStagingRow_(buildFileRecord_(fileMeta, filePath, frame.folderId)));

    var isZip = isZipFile_(file);
    if (isZip && ctx.zipCode === ZIP_CODE_CONTENTS) {
      frame.fileZipExpansionPending = true;
      frame.pendingZipPath = filePath;
      // Fall through to the expansion phase below within this same call.
    } else {
      frame.nextFileIndex++;
      return { status: 'CONTINUE' };
    }
  }

  // --- ZIP expansion phase ---
  if (!isRuntimeSafe_(executionStartMs)) {
    return { status: 'SUSPEND' }; // frame retains fileZipExpansionPending=true for clean resume
  }
  var zipFile = DriveApp.getFileById(fileRef.id);
  var zipResult = processZipContents_(zipFile, fileRef.id, frame.pendingZipPath);
  if (zipResult.success) {
    for (var i = 0; i < zipResult.records.length; i++) {
      stagingBuffer.push(recordToStagingRow_(zipResult.records[i]));
    }
  } else {
    incrementWarningCount_();
    writeLog_(ctx.scanKey, LOG_ACTION.PROCESS_ZIP, LOG_STATUS.WARNING, zipResult.warning);
    writeDevLog_(ctx.scanKey, '07_ZipProcessor.gs::processZipContents_', DEV_LOG_EVENT.WARNING,
      zipResult.warning, zipResult.exceptionMessage);
  }
  frame.fileZipExpansionPending = false;
  frame.pendingZipPath = null;
  frame.nextFileIndex++;
  return { status: 'CONTINUE' };
}
