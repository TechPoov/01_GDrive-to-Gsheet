/**
 * 04_Validation.gs
 * Centralized validation: ProfileName, SourceURL, Mode, Depth, ZipMode,
 * IsActive, generated sheet names, ScanKey uniqueness, and Drive source
 * access (Validation & Error Handling Design doc 13).
 *
 * All validation rules live here so no other module re-implements them
 * (Validation Design §83, Technical Architecture §63).
 */

var PROFILE_CLASS = {
  BLANK: 'BLANK',
  INACTIVE: 'INACTIVE',
  VALID: 'VALID',
  INVALID: 'INVALID'
};

/**
 * Pure syntax/logic validation for one Profile row — no Drive or
 * cross-row calls. Builds normalized values and ScanKey where possible.
 */
function validateProfileSyntax_(entry) {
  var result = {
    rowNumber: entry.rowNumber,
    classification: PROFILE_CLASS.VALID,
    errors: [],
    normalized: { profileName: '', mode: '', zipMode: '', depthCode: '', isActive: '' },
    scanKey: null,
    folderId: null,
    sourceUrl: entry.sourceUrl
  };

  if (entry.isCompletelyBlank) {
    result.classification = PROFILE_CLASS.BLANK;
    return result;
  }

  var normalizedIsActive = normalizeEnum_(entry.isActive);
  if (normalizedIsActive === ACTIVE_NO) {
    result.classification = PROFILE_CLASS.INACTIVE;
    return result;
  }

  var errors = [];

  // --- ProfileName ---
  var profileName = normalizeText_(entry.profileName);
  if (isBlank_(profileName)) {
    errors.push('Error: ProfileName is required.');
  }
  result.normalized.profileName = profileName;

  // --- SourceURL ---
  var folderId = extractFolderIdFromUrl_(entry.sourceUrl);
  if (isBlank_(entry.sourceUrl)) {
    errors.push('Error: SourceURL is required.');
  } else if (!folderId) {
    errors.push('Error: SourceURL must be a valid Google Drive folder URL.');
  }
  result.folderId = folderId;

  // --- Mode ---
  var normalizedMode = normalizeEnum_(entry.mode);
  var modeValid = VALID_MODES.indexOf(normalizedMode) !== -1;
  if (!modeValid) {
    errors.push('Error: Mode must be FILES, FOLDERS, or BOTH.');
  }
  result.normalized.mode = normalizedMode;

  // --- Depth ---
  var parsedDepth = parseDepth_(entry.depth);
  if (!parsedDepth.valid) {
    errors.push('Error: Depth must be blank or a whole number greater than or equal to 0.');
  }
  result.normalized.depthCode = parsedDepth.valid ? buildDepthCode_(parsedDepth) : '';
  result.maxDepth = (parsedDepth.valid && !parsedDepth.isUnlimited) ? parsedDepth.depthNumber : null;

  // --- ZipMode ---
  var normalizedZipMode = normalizeEnum_(entry.zipMode);
  var zipCode = '';
  if (modeValid && normalizedMode === MODE_FOLDERS) {
    zipCode = ZIP_CODE_NA; // Frozen normalization regardless of any entered ZipMode value.
  } else if (modeValid) {
    if (normalizedZipMode === ZIP_MODE_ONLY) zipCode = ZIP_CODE_ONLY;
    else if (normalizedZipMode === ZIP_MODE_WITH_CONTENTS) zipCode = ZIP_CODE_CONTENTS;
    else errors.push('Error: ZipMode is required when Mode is FILES or BOTH.');
  }
  result.normalized.zipMode = normalizedZipMode;
  result.normalized.zipCode = zipCode;

  // --- IsActive ---
  if (normalizedIsActive !== ACTIVE_YES) {
    if (isBlank_(entry.isActive)) {
      errors.push('Error: IsActive is required and must be YES or NO.');
    } else {
      errors.push('Error: IsActive must be YES or NO.');
    }
  }
  result.normalized.isActive = normalizedIsActive;

  // --- ScanKey (only when the inputs that compose it are all valid) ---
  if (!isBlank_(profileName) && modeValid && parsedDepth.valid && zipCode) {
    result.scanKey = buildScanKey_(profileName, normalizedMode, result.normalized.depthCode, zipCode);
  }

  if (errors.length > 0) {
    result.classification = PROFILE_CLASS.INVALID;
    result.errors = errors;
  }
  return result;
}

/** Google Sheets sheet-name safety: length + disallowed characters. */
function isValidGeneratedSheetName_(name) {
  if (isBlank_(name)) return false;
  if (name.length > GOOGLE_SHEET_NAME_MAX_LENGTH) return false;
  for (var i = 0; i < GOOGLE_SHEET_NAME_INVALID_CHARS.length; i++) {
    if (name.indexOf(GOOGLE_SHEET_NAME_INVALID_CHARS[i]) !== -1) return false;
  }
  return true;
}

/**
 * Validates the three derived sheet names for a ScanKey against Google
 * Sheets restrictions, fixed-sheet collisions, and collisions with
 * sheets this application did not create itself (Validation Design
 * §26-31; Test Cases TC-044/TC-045).
 */
function validateGeneratedSheetNames_(ss, scanKey) {
  var errors = [];
  var currentName = scanKey;
  var oldName = scanKey + OLD_INDEX_SUFFIX;
  var dashboardName = DASHBOARD_PREFIX + scanKey;

  var names = [currentName, oldName, dashboardName];
  for (var i = 0; i < names.length; i++) {
    if (!isValidGeneratedSheetName_(names[i])) {
      errors.push('Error: ProfileName produces an invalid generated sheet name.');
      return errors; // no point checking collisions on an invalid name
    }
    if (FIXED_SHEET_NAMES.indexOf(names[i]) !== -1) {
      errors.push('Error: Generated sheet name conflicts with an application system sheet.');
      return errors;
    }
  }

  var currentSheet = ss.getSheetByName(currentName);
  if (currentSheet && !isSheetManagedAs_(currentSheet, managedTagForCurrentIndex_(scanKey))) {
    errors.push('Error: A sheet named "' + currentName + '" already exists and was not created by this application.');
  }
  var oldSheet = ss.getSheetByName(oldName);
  if (oldSheet && !isSheetManagedAs_(oldSheet, managedTagForOldIndex_(scanKey))) {
    errors.push('Error: A sheet named "' + oldName + '" already exists and was not created by this application.');
  }
  var dashboardSheet = ss.getSheetByName(dashboardName);
  if (dashboardSheet && !isSheetManagedAs_(dashboardSheet, managedTagForDashboard_(scanKey))) {
    errors.push('Error: A sheet named "' + dashboardName + '" already exists and was not created by this application.');
  }
  return errors;
}

/**
 * Validates SourceURL Drive access for one Profile entry. Pure network
 * check, no side effects.
 */
function validateSourceAccess_(folderId) {
  if (!folderId) {
    return { valid: false, message: 'Error: SourceURL must be a valid Google Drive folder URL.' };
  }
  var result = getFolderByIdSafe_(folderId);
  if (!result.success) {
    if (result.code === ERROR_CODES.SOURCE_ACCESS_DENIED) {
      return { valid: false, message: 'Error: Source folder cannot be accessed. Check Google Drive permissions.' };
    }
    return { valid: false, message: 'Error: Source folder was not found or is no longer available.' };
  }
  return { valid: true, folder: result.folder };
}

/**
 * Full pre-processing validation pipeline for every Profile row
 * (Processing Design §10-14, Validation Design §3). Returns an array of
 * per-row entries (same shape as validateProfileSyntax_ output) with
 * classification finalized, including duplicate-ScanKey and generated
 * sheet-name / source-access checks layered on top of syntax validation.
 */
function validateAllProfiles_(ss, rawEntries) {
  var entries = rawEntries.map(validateProfileSyntax_);

  // --- Duplicate ScanKey detection among currently-VALID rows ---
  var scanKeyCounts = {};
  entries.forEach(function (e) {
    if (e.classification === PROFILE_CLASS.VALID && e.scanKey) {
      scanKeyCounts[e.scanKey] = (scanKeyCounts[e.scanKey] || 0) + 1;
    }
  });
  entries.forEach(function (e) {
    if (e.classification === PROFILE_CLASS.VALID && e.scanKey && scanKeyCounts[e.scanKey] > 1) {
      e.classification = PROFILE_CLASS.INVALID;
      e.errors = ['Error: Duplicate ScanKey "' + e.scanKey + '". Each active Profile must generate a unique ScanKey.'];
    }
  });

  // --- Generated sheet-name validation ---
  entries.forEach(function (e) {
    if (e.classification === PROFILE_CLASS.VALID && e.scanKey) {
      var nameErrors = validateGeneratedSheetNames_(ss, e.scanKey);
      if (nameErrors.length > 0) {
        e.classification = PROFILE_CLASS.INVALID;
        e.errors = nameErrors;
      }
    }
  });

  // --- Source access validation ---
  entries.forEach(function (e) {
    if (e.classification === PROFILE_CLASS.VALID) {
      var access = validateSourceAccess_(e.folderId);
      if (!access.valid) {
        e.classification = PROFILE_CLASS.INVALID;
        e.errors = [access.message];
      } else {
        e.sourceFolder = access.folder;
      }
    }
  });

  return entries;
}
