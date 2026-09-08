/**
 * config.gs
 * GDrive_to_Gsheet_V2.0.0 — Centralized Configuration
 *
 * Purpose (Master Prompt §7, config.gs Design doc 15):
 *   Single location for ALL developer/tester/application/technical
 *   configuration. Normal user scan configuration (ProfileName, SourceURL,
 *   Mode, Depth, ZipMode, IsActive) lives in the Profile sheet, NOT here.
 *
 * Nothing in this file contains business logic beyond small factory
 * helpers for building compound values (e.g. property keys). Functional
 * modules must reference these constants rather than repeating literals.
 */

// ============================================================
// APPLICATION
// ============================================================

var APP_NAME = 'GDrive_to_Gsheet';
var APP_DISPLAY_NAME = 'GDrive-to-GSheet';
var APP_VERSION = '2.0.0';
var APP_BRAND = 'TechPoov';
var APP_PURPOSE = 'Google Drive indexing utility that scans configured folders and creates searchable Google Sheets Index and Dashboard views.';

// ============================================================
// DEVELOPER / TESTER CONTROLS
// ============================================================
// Change DEV_MODE to TRUE to enable detailed Dev_Log diagnostics.
// The operational Log always remains active regardless of DEV_MODE.

var DEV_MODE = false;

// TEST_MODE and related switches must default to safe production values.
// They exist to make continuation/runtime-limit testing practical without
// waiting for genuinely huge Drive trees.
var TEST_MODE = false;
var TEST_EXECUTION_SAFE_LIMIT_MS = 15000; // used only when TEST_MODE = true

// ============================================================
// SYSTEM SHEET NAMES (fixed)
// ============================================================

var SHEET_RM = 'RM';
var SHEET_PROFILE = 'Profile';
var SHEET_LOG = 'Log';
var SHEET_DEV_LOG = 'Dev_Log';
var SHEET_HELP = 'Help';

var FIXED_SHEET_NAMES = [SHEET_RM, SHEET_PROFILE, SHEET_LOG, SHEET_DEV_LOG, SHEET_HELP];

// ============================================================
// GENERATED SHEET NAMING
// ============================================================

var OLD_INDEX_SUFFIX = '_Old';
var DASHBOARD_PREFIX = 'DB_';
var TEMP_SHEET_PREFIX = '__TMP_';

var GOOGLE_SHEET_NAME_MAX_LENGTH = 100; // Google Sheets platform limit
var GOOGLE_SHEET_NAME_INVALID_CHARS = ['[', ']', '*', '?', '/', '\\', ':'];

// ============================================================
// PROFILE COLUMNS
// ============================================================

var PROFILE_COLUMNS = {
  PROFILE_NAME: 'ProfileName',
  SOURCE_URL: 'SourceURL',
  MODE: 'Mode',
  DEPTH: 'Depth',
  ZIP_MODE: 'ZipMode',
  IS_ACTIVE: 'IsActive',
  STATUS: 'Status',
  LAST_UPDATED: 'LastUpdated',
  REMARKS: 'Remarks'
};

// Column order exactly as they should appear in the Profile sheet.
var PROFILE_COLUMN_ORDER = [
  PROFILE_COLUMNS.PROFILE_NAME,
  PROFILE_COLUMNS.SOURCE_URL,
  PROFILE_COLUMNS.MODE,
  PROFILE_COLUMNS.DEPTH,
  PROFILE_COLUMNS.ZIP_MODE,
  PROFILE_COLUMNS.IS_ACTIVE,
  PROFILE_COLUMNS.STATUS,
  PROFILE_COLUMNS.LAST_UPDATED,
  PROFILE_COLUMNS.REMARKS
];

var ACTIVE_YES = 'YES';
var ACTIVE_NO = 'NO';

// ============================================================
// MODE CONSTANTS
// ============================================================

var MODE_FILES = 'FILES';
var MODE_FOLDERS = 'FOLDERS';
var MODE_BOTH = 'BOTH';
var VALID_MODES = [MODE_FILES, MODE_FOLDERS, MODE_BOTH];

// ============================================================
// DEPTH CONSTANTS
// ============================================================

var DEPTH_PREFIX = 'D';
var DEPTH_ALL = 'DALL';

// ============================================================
// ZIP CONSTANTS
// ============================================================

var ZIP_MODE_ONLY = 'ZIP_ONLY';
var ZIP_MODE_WITH_CONTENTS = 'ZIP_WITH_CONTENTS';
var VALID_ZIP_MODES = [ZIP_MODE_ONLY, ZIP_MODE_WITH_CONTENTS];

var ZIP_CODE_ONLY = 'ZONLY';
var ZIP_CODE_CONTENTS = 'ZCNTNTS';
var ZIP_CODE_NA = 'ZNA';

var ZIP_ITEM_ID_PREFIX = 'ZIP:';

// ============================================================
// STATUS CONSTANTS
// ============================================================

var PROFILE_STATUS = {
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED'
};

var LOG_STATUS = {
  STARTED: 'STARTED',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED'
};

// ============================================================
// LOG ACTION CONSTANTS
// ============================================================

var LOG_ACTION = {
  SCAN_DRIVE: 'SCAN_DRIVE',
  VALIDATE_PROFILE: 'VALIDATE_PROFILE',
  PREPARE_INDEX: 'PREPARE_INDEX',
  SCAN_FOLDER: 'SCAN_FOLDER',
  PROCESS_ZIP: 'PROCESS_ZIP',
  WRITE_INDEX: 'WRITE_INDEX',
  REFRESH_DASHBOARD: 'REFRESH_DASHBOARD',
  REFRESH_RM: 'REFRESH_RM',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  CANCEL_SCAN: 'CANCEL_SCAN',
  APP_INIT: 'APP_INIT'
};

// ============================================================
// DEV_LOG EVENT CONSTANTS
// ============================================================

var DEV_LOG_EVENT = {
  ENTER: 'ENTER',
  EXIT: 'EXIT',
  INFO: 'INFO',
  INPUT: 'INPUT',
  OUTPUT: 'OUTPUT',
  VALIDATION: 'VALIDATION',
  DECISION: 'DECISION',
  PERFORMANCE: 'PERFORMANCE',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  EXCEPTION: 'EXCEPTION'
};

// ============================================================
// INDEX CONSTANTS
// ============================================================

var INDEX_COLUMNS = [
  'Sl.No',
  'ItemID',
  'Path',
  'Name',
  'Type',
  'Extension', // shortened from "Extension / Google File Type" (Dashboard Design DDC-2026-09-08 Amendment 2) — still holds either a normal file extension or a Google Workspace short type
  'Description',
  'CreatedDate',
  'ModifiedDate'
];

var INDEX_TYPE = {
  FILE: 'FILE',
  FOLDER: 'FOLDER',
  ZIP_CONTENT_FILE: 'ZIP_CONTENT_FILE',
  ZIP_CONTENT_FOLDER: 'ZIP_CONTENT_FOLDER'
};

// ============================================================
// DASHBOARD CONSTANTS
// ============================================================

var DASHBOARD_FILTER_FIELDS = {
  PATH: 'Path',
  NAME: 'Name',
  TYPE: 'Type',
  EXTENSION: 'Extension',
  DESCRIPTION: 'Description',
  CREATED_DATE: 'CreatedDate',
  MODIFIED_DATE: 'ModifiedDate'
};

var FILTER_ANY_PREFIX = 'ANY>';
var FILTER_ALL_PREFIX = 'ALL>';
// Created Date / Modified Date filters (Dashboard Design §10a Amendment 2)
// each take exactly one of these prefixes, comma-separated values, OR logic.
var FILTER_DATE_PREFIX = 'DATE>';
var FILTER_MONTH_PREFIX = 'MONTH>';
var FILTER_YEAR_PREFIX = 'YEAR>';

var VALID_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ============================================================
// GOOGLE WORKSPACE FILE TYPE MAPPING
// ============================================================

var GOOGLE_MIME_TYPE_MAP = {};
GOOGLE_MIME_TYPE_MAP['application/vnd.google-apps.spreadsheet'] = 'gsheet';
GOOGLE_MIME_TYPE_MAP['application/vnd.google-apps.document'] = 'gdoc';
GOOGLE_MIME_TYPE_MAP['application/vnd.google-apps.presentation'] = 'gslide';
GOOGLE_MIME_TYPE_MAP['application/vnd.google-apps.form'] = 'gform';
GOOGLE_MIME_TYPE_MAP['application/vnd.google-apps.drawing'] = 'gdraw';
// Additional Google-native types recognized but not part of the frozen
// required list; included so they do not fall through as "unknown".
GOOGLE_MIME_TYPE_MAP['application/vnd.google-apps.folder'] = ''; // handled specially, never used as extension
GOOGLE_MIME_TYPE_MAP['application/vnd.google-apps.script'] = 'gscript';
GOOGLE_MIME_TYPE_MAP['application/vnd.google-apps.site'] = 'gsite';
GOOGLE_MIME_TYPE_MAP['application/vnd.google-apps.jam'] = 'gjam';

var ZIP_MIME_TYPES = ['application/zip', 'application/x-zip-compressed'];

// ============================================================
// EXECUTION / CONTINUATION SETTINGS
// ============================================================

// Stop normal processing well before the ~6 minute Apps Script hard
// execution ceiling so there is always time to persist state, log, and
// schedule a continuation trigger. See Technical Architecture §11-13.
var EXECUTION_SAFE_LIMIT_MS = 290000; // 4 min 50 sec

var RUNTIME_CHECK_EVERY_N_ITEMS = 25;

var CONTINUATION_ENABLED = true;
var CONTINUATION_DELAY_MS = 10000; // 10 seconds
var CONTINUATION_TRIGGER_HANDLER = 'resumeScanContinuation';

var LOCK_WAIT_MS = 30000;

// ============================================================
// RUNTIME / PERSISTENT STATE
// ============================================================

var RUN_ID_PREFIX = 'RUN_';

var EXECUTION_STATE = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  SCANNING: 'SCANNING',
  CONTINUATION_PENDING: 'CONTINUATION_PENDING',
  BUILDING_INDEX: 'BUILDING_INDEX',
  REFRESHING_DASHBOARD: 'REFRESHING_DASHBOARD',
  REFRESHING_RM: 'REFRESHING_RM',
  COMPLETING: 'COMPLETING',
  CANCELLING: 'CANCELLING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

// PropertiesService keys. Kept short; values are compact (RunID, phase
// name, counters, small JSON traversal cursors) — never the full Index.
var PROPERTY_KEYS = {
  ACTIVE_RUN_ID: 'ACTIVE_RUN_ID',
  ACTIVE_SCAN_KEY: 'ACTIVE_SCAN_KEY',
  CURRENT_PROFILE_ROW: 'CURRENT_PROFILE_ROW',
  EXECUTION_PHASE: 'EXECUTION_PHASE',
  CANCEL_REQUESTED: 'CANCEL_REQUESTED',
  CONTINUATION_TRIGGER_ID: 'CONTINUATION_TRIGGER_ID',
  LAST_ACTIVITY_AT: 'LAST_ACTIVITY_AT',
  RUN_START_TIME: 'RUN_START_TIME',
  PROFILE_START_TIME: 'PROFILE_START_TIME',
  PROFILE_QUEUE: 'PROFILE_QUEUE',
  PROFILE_QUEUE_INDEX: 'PROFILE_QUEUE_INDEX',
  WARNING_COUNT: 'WARNING_COUNT',
  RECORDS_COUNT: 'RECORDS_COUNT',
  TRAVERSAL_STATE: 'TRAVERSAL_STATE',
  TEMP_SHEET_NAME: 'TEMP_SHEET_NAME',
  TEMP_SHEET_ROW_COUNT: 'TEMP_SHEET_ROW_COUNT',
  ACTIVE_SCAN_KEY_LIST: 'ACTIVE_SCAN_KEY_LIST',
  STARTED_LOG_WRITTEN: 'STARTED_LOG_WRITTEN'
};

// ============================================================
// PERFORMANCE / BATCH SETTINGS
// ============================================================

var SHEET_WRITE_BATCH_SIZE = 500;
var STAGING_WRITE_BATCH_SIZE = 200;
var DRIVE_PAGE_SIZE = 100;
var DEV_LOG_BATCH_SIZE = 50;

// ============================================================
// FORMATTING CONSTANTS
// ============================================================

var DATE_TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';

// ============================================================
// ERROR CODES (internal, not shown to users)
// ============================================================

var ERROR_CODES = {
  MISSING_PROFILE_SHEET: 'MISSING_PROFILE_SHEET',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_PROFILE_NAME: 'INVALID_PROFILE_NAME',
  INVALID_SOURCE_URL: 'INVALID_SOURCE_URL',
  SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
  SOURCE_ACCESS_DENIED: 'SOURCE_ACCESS_DENIED',
  INVALID_MODE: 'INVALID_MODE',
  INVALID_DEPTH: 'INVALID_DEPTH',
  INVALID_ZIP_MODE: 'INVALID_ZIP_MODE',
  INVALID_IS_ACTIVE: 'INVALID_IS_ACTIVE',
  DUPLICATE_SCAN_KEY: 'DUPLICATE_SCAN_KEY',
  INVALID_SHEET_NAME: 'INVALID_SHEET_NAME',
  SHEET_NAME_COLLISION: 'SHEET_NAME_COLLISION',
  INDEX_WRITE_FAILED: 'INDEX_WRITE_FAILED',
  ZIP_READ_FAILED: 'ZIP_READ_FAILED',
  DASHBOARD_REFRESH_FAILED: 'DASHBOARD_REFRESH_FAILED',
  RM_REFRESH_FAILED: 'RM_REFRESH_FAILED',
  SCAN_ALREADY_RUNNING: 'SCAN_ALREADY_RUNNING',
  UNEXPECTED_EXCEPTION: 'UNEXPECTED_EXCEPTION'
};

// ============================================================
// SEVERITY
// ============================================================

var SEVERITY = {
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED'
};

// ============================================================
// RM / DESCRIPTION TEMPLATES
// ============================================================

var RM_DESCRIPTIONS = {
  RM: 'Workbook ReadMe and navigation index',
  PROFILE: 'User configuration and latest scan status',
  LOG: 'Operational execution history',
  DEV_LOG: 'Detailed developer and troubleshooting diagnostics',
  HELP: 'User instructions and configuration help',
  UNKNOWN: 'User-created or unclassified sheet'
};

// ============================================================
// PROPERTY / SMALL HELPERS (constants only, no business logic)
// ============================================================

/**
 * Returns the ScriptProperties store used for all persistent execution
 * state. Centralized so every module retrieves the same store.
 */
function getAppProperties_() {
  return PropertiesService.getScriptProperties();
}

/**
 * Returns the effective execution-safe threshold, honoring TEST_MODE.
 */
function getExecutionSafeLimitMs_() {
  return TEST_MODE ? TEST_EXECUTION_SAFE_LIMIT_MS : EXECUTION_SAFE_LIMIT_MS;
}
