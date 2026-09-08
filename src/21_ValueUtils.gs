/**
 * 21_ValueUtils.gs
 * Reusable string / enum / date / duration / list / filter-token parsing
 * helpers. No Drive or Sheets calls belong here — see 20_DriveUtils.gs and
 * 19_SheetUtils.gs respectively.
 */

/** True when value is null/undefined/empty-string-after-trim. */
function isBlank_(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

/** Trims and uppercases a value; blank stays ''. */
function normalizeEnum_(value) {
  if (isBlank_(value)) return '';
  return String(value).trim().toUpperCase();
}

/** Trims only, preserving case. Blank input returns ''. */
function normalizeText_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Parses a raw Profile Depth cell value.
 * Returns { valid: boolean, isUnlimited: boolean, depthNumber: number|null }
 * Frozen rule (Profile Design §11-16, Validation §16-17):
 *   blank => unlimited; else must be a whole number >= 0.
 */
function parseDepth_(rawDepth) {
  if (isBlank_(rawDepth)) {
    return { valid: true, isUnlimited: true, depthNumber: null };
  }
  var text = String(rawDepth).trim();
  // Reject decimals, negatives, and non-numeric text explicitly.
  if (!/^\d+$/.test(text)) {
    return { valid: false, isUnlimited: false, depthNumber: null };
  }
  var num = parseInt(text, 10);
  if (isNaN(num) || num < 0) {
    return { valid: false, isUnlimited: false, depthNumber: null };
  }
  return { valid: true, isUnlimited: false, depthNumber: num };
}

/** Builds the ScanKey Depth code: DALL, D0, D1, D10, ... */
function buildDepthCode_(parsedDepth) {
  if (parsedDepth.isUnlimited) return DEPTH_ALL;
  return DEPTH_PREFIX + String(parsedDepth.depthNumber);
}

/**
 * Builds the ScanKey ZIP code given normalized Mode and ZipMode.
 * FOLDERS always normalizes to ZNA regardless of ZipMode content
 * (Validation & Error Handling Design §20 — frozen).
 */
function buildZipCode_(normalizedMode, normalizedZipMode) {
  if (normalizedMode === MODE_FOLDERS) return ZIP_CODE_NA;
  if (normalizedZipMode === ZIP_MODE_ONLY) return ZIP_CODE_ONLY;
  if (normalizedZipMode === ZIP_MODE_WITH_CONTENTS) return ZIP_CODE_CONTENTS;
  return ''; // caller should have already validated ZipMode is required here
}

/** ScanKey = ProfileName_Mode_DepthCode_ZipCode (Profile Design §24). */
function buildScanKey_(profileName, normalizedMode, depthCode, zipCode) {
  return profileName + '_' + normalizedMode + '_' + depthCode + '_' + zipCode;
}

/**
 * Splits a comma-separated filter value into trimmed, non-empty terms.
 * Extra/blank entries from stray commas are dropped (Dashboard Design §36).
 */
function splitCommaList_(raw) {
  if (isBlank_(raw)) return [];
  return String(raw).split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

/**
 * Parses a Path/Description-style filter value into one of:
 *   { mode: 'BLANK' }
 *   { mode: 'NORMAL', text: '<lowercased text>' }
 *   { mode: 'ANY', terms: ['a','b'] }   // lowercased
 *   { mode: 'ALL', terms: ['a','b'] }   // lowercased
 * Rules per Dashboard Design §13-23 / Help §40.
 */
function parseTextFilter_(raw) {
  if (isBlank_(raw)) return { mode: 'BLANK' };
  var text = String(raw).trim();
  var upper = text.toUpperCase();
  var prefix = null;
  if (upper.indexOf(FILTER_ANY_PREFIX) === 0) prefix = 'ANY';
  else if (upper.indexOf(FILTER_ALL_PREFIX) === 0) prefix = 'ALL';

  if (prefix) {
    var rest = text.substring(prefix.length + 1).trim(); // +1 for '>'
    var terms = rest.split(/\s+/).map(function (s) { return s.trim().toLowerCase(); })
      .filter(function (s) { return s.length > 0; });
    if (terms.length === 0) return { mode: 'BLANK' }; // empty ANY>/ALL> => blank filter
    return { mode: prefix, terms: terms };
  }
  // Contains a '>' but not a recognized prefix => treat as ordinary text.
  return { mode: 'NORMAL', text: text.toLowerCase() };
}

/** Evaluates a parsed text filter (see parseTextFilter_) against a value. */
function matchesTextFilter_(value, parsed) {
  if (parsed.mode === 'BLANK') return true;
  var haystack = (value === null || value === undefined) ? '' : String(value).toLowerCase();
  if (parsed.mode === 'NORMAL') return haystack.indexOf(parsed.text) !== -1;
  if (parsed.mode === 'ANY') {
    for (var i = 0; i < parsed.terms.length; i++) {
      if (haystack.indexOf(parsed.terms[i]) !== -1) return true;
    }
    return false;
  }
  if (parsed.mode === 'ALL') {
    for (var j = 0; j < parsed.terms.length; j++) {
      if (haystack.indexOf(parsed.terms[j]) === -1) return false;
    }
    return true;
  }
  return true;
}

/** Validates a comma-separated 4-digit Year list. Returns {valid, years:[...]}. */
function validateYearList_(raw) {
  var terms = splitCommaList_(raw);
  if (terms.length === 0) return { valid: true, years: [] };
  var years = [];
  for (var i = 0; i < terms.length; i++) {
    if (!/^\d{4}$/.test(terms[i])) return { valid: false, years: [] };
    years.push(terms[i]);
  }
  return { valid: true, years: years };
}

/**
 * Resolves one Month filter term to a canonical full month name — either
 * a full/partial month name (case-insensitive) or a 1-12 numeric month.
 * Returns null if the term is not a valid month.
 */
function normalizeMonthTerm_(term) {
  if (/^\d{1,2}$/.test(term)) {
    var n = parseInt(term, 10);
    return (n >= 1 && n <= 12) ? VALID_MONTHS[n - 1] : null;
  }
  var lowerValid = VALID_MONTHS.map(function (m) { return m.toLowerCase(); });
  var idx = lowerValid.indexOf(String(term).toLowerCase());
  return idx === -1 ? null : VALID_MONTHS[idx];
}

/**
 * Parses one Created Date / Modified Date filter cell (Dashboard Design
 * §10a, Amendment 2). The cell holds exactly one of:
 *   Date>YYYY-MM-DD[,YYYY-MM-DD...]   — exact calendar date(s), OR logic
 *   Month>January[,March...] or Month>1[,3...] — month name(s) or number(s), OR logic
 *   Year>2025[,2026...]               — four-digit year(s), OR logic
 * Returns { valid, mode: 'BLANK'|'DATE'|'MONTH'|'YEAR', values: [...] }.
 */
function parseDateFieldFilter_(raw) {
  if (isBlank_(raw)) return { valid: true, mode: 'BLANK', values: [] };
  var text = String(raw).trim();
  var upper = text.toUpperCase();
  var prefix = null;
  if (upper.indexOf(FILTER_DATE_PREFIX) === 0) prefix = 'DATE';
  else if (upper.indexOf(FILTER_MONTH_PREFIX) === 0) prefix = 'MONTH';
  else if (upper.indexOf(FILTER_YEAR_PREFIX) === 0) prefix = 'YEAR';
  if (!prefix) return { valid: false, mode: 'BLANK', values: [] };

  var gtIndex = text.indexOf('>');
  var rest = text.substring(gtIndex + 1);
  var terms = splitCommaList_(rest);
  if (terms.length === 0) return { valid: true, mode: 'BLANK', values: [] };

  if (prefix === 'DATE') {
    for (var i = 0; i < terms.length; i++) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(terms[i])) return { valid: false, mode: 'BLANK', values: [] };
    }
    return { valid: true, mode: 'DATE', values: terms };
  }

  if (prefix === 'MONTH') {
    var months = [];
    for (var m = 0; m < terms.length; m++) {
      var monthName = normalizeMonthTerm_(terms[m]);
      if (!monthName) return { valid: false, mode: 'BLANK', values: [] };
      months.push(monthName);
    }
    return { valid: true, mode: 'MONTH', values: months };
  }

  // YEAR
  var yearResult = validateYearList_(rest);
  if (!yearResult.valid) return { valid: false, mode: 'BLANK', values: [] };
  return { valid: true, mode: 'YEAR', values: yearResult.years };
}

/**
 * Evaluates a parsed Created/Modified Date filter (see
 * parseDateFieldFilter_) against a "yyyy-MM-dd HH:mm:ss" text value.
 */
function matchesDateFieldFilter_(dateText, parsed) {
  if (!parsed || parsed.mode === 'BLANK') return true;
  var text = String(dateText || '');
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return false;

  if (parsed.mode === 'DATE') {
    return parsed.values.indexOf(text.substring(0, 10)) !== -1;
  }

  var year = text.substring(0, 4);
  var monthNum = parseInt(text.substring(5, 7), 10);
  if (monthNum < 1 || monthNum > 12) return false;
  var monthName = VALID_MONTHS[monthNum - 1];

  if (parsed.mode === 'MONTH') return parsed.values.indexOf(monthName) !== -1;
  if (parsed.mode === 'YEAR') return parsed.values.indexOf(year) !== -1;
  return true;
}

/** Formats a Date using the spreadsheet timezone and DATE_TIME_FORMAT. */
function formatDateTime_(date) {
  if (!date) return '';
  var tz = Session.getScriptTimeZone();
  try {
    tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  } catch (e) {
    // Fall back to script timezone if no active spreadsheet context.
  }
  return Utilities.formatDate(new Date(date), tz, DATE_TIME_FORMAT);
}

/** Formats a millisecond duration as "45s" / "2m 25s" / "1h 3m 12s". */
function formatDuration_(ms) {
  var totalSeconds = Math.max(0, Math.round(ms / 1000));
  var hours = Math.floor(totalSeconds / 3600);
  var minutes = Math.floor((totalSeconds % 3600) / 60);
  var seconds = totalSeconds % 60;
  if (hours > 0) return hours + 'h ' + minutes + 'm ' + seconds + 's';
  if (minutes > 0) return minutes + 'm ' + seconds + 's';
  return seconds + 's';
}

/** Formats an integer count with thousands separators (e.g. 1245 -> "1,245"). */
function formatCount_(n) {
  var num = Number(n) || 0;
  var s = String(Math.round(num));
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var posFromEnd = s.length - i;
    out += s.charAt(i);
    if (posFromEnd > 1 && posFromEnd % 3 === 1) out += ',';
  }
  return out;
}

/** Returns the lowercase file extension (no dot) or '' if none present. */
function getFileExtension_(fileName) {
  if (isBlank_(fileName)) return '';
  var idx = fileName.lastIndexOf('.');
  if (idx === -1 || idx === fileName.length - 1) return '';
  return fileName.substring(idx + 1).toLowerCase();
}

/** Case-insensitive ascending name comparator for sort(). */
function compareNamesCaseInsensitive_(a, b) {
  var an = (a || '').toLowerCase();
  var bn = (b || '').toLowerCase();
  if (an < bn) return -1;
  if (an > bn) return 1;
  return 0;
}

/** Normalizes a ZIP internal path to use forward slashes without leading slash. */
function normalizeZipInternalPath_(path) {
  var p = String(path || '').replace(/\\/g, '/');
  while (p.indexOf('/') === 0) p = p.substring(1);
  return p;
}

function nowMs_() {
  return new Date().getTime();
}
