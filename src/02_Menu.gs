/**
 * 02_Menu.gs
 * TechPoov custom menu: the onOpen(e) simple trigger and thin,
 * UI-facing handler functions (Menu Design doc 03). onOpen itself is
 * kept lightweight per §41 — no sheet creation or workbook writes
 * happen here; that is deferred to beginScanDriveRun_()'s call to
 * ensureWorkbookStructure_() so opening the workbook is always fast.
 */

/** Builds the TechPoov menu: Scan Drive, Cancel Scan, Help, separator, About this tool. */
function onOpen(e) {
  var ui = getUiSafe_();
  if (!ui) return;
  ui.createMenu(APP_BRAND)
    .addItem('Scan Drive', 'handleScanDriveMenuAction_')
    .addItem('Cancel Scan', 'handleCancelScanMenuAction_')
    .addItem('Help', 'handleHelpMenuAction_')
    .addSeparator()
    .addItem('About this tool', 'handleAboutMenuAction_')
    .addToUi();
}

/** TechPoov -> Scan Drive. */
function handleScanDriveMenuAction_() {
  var message;
  try {
    message = beginScanDriveRun_();
  } catch (e) {
    message = 'Error: Unexpected failure while starting the scan.';
    writeDevLog_('', '02_Menu.gs::handleScanDriveMenuAction_', DEV_LOG_EVENT.EXCEPTION, message, extractExceptionMessage_(e));
    flushDevLogBuffer_();
  }
  showAlertTitledSafe_('Scan Drive', message);
}

/** TechPoov -> Cancel Scan. */
function handleCancelScanMenuAction_() {
  var message;
  try {
    message = handleCancelScanRequest_();
  } catch (e) {
    message = 'Error: Unexpected failure while requesting cancellation.';
    writeDevLog_('', '02_Menu.gs::handleCancelScanMenuAction_', DEV_LOG_EVENT.EXCEPTION, message, extractExceptionMessage_(e));
    flushDevLogBuffer_();
  }
  showAlertTitledSafe_('Cancel Scan', message);
}

/** TechPoov -> Help. Navigates to the Help sheet (creating it if missing). */
function handleHelpMenuAction_() {
  try {
    activateHelpSheet_();
  } catch (e) {
    showAlertSafe_('Error: Unable to open the Help sheet.');
    writeDevLog_('', '02_Menu.gs::handleHelpMenuAction_', DEV_LOG_EVENT.EXCEPTION, 'Help navigation failed', extractExceptionMessage_(e));
    flushDevLogBuffer_();
  }
}

/** TechPoov -> About this tool. */
function handleAboutMenuAction_() {
  var message = APP_DISPLAY_NAME + ' (Version ' + APP_VERSION + ')\n' +
    'Brand: ' + APP_BRAND + '\n\n' + APP_PURPOSE;
  showAlertTitledSafe_('About ' + APP_DISPLAY_NAME, message);
}
