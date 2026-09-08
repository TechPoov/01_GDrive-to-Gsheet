function debugProfileClassification_() {
  var ss = getSpreadsheet_();
  var profileSheet = getProfileSheet_(ss);
  var rawEntries = readProfileRows_(profileSheet);
  var validated = validateAllProfiles_(ss, rawEntries);
  validated.forEach(function (e) {
    var raw = rawEntries[e.rowNumber - 2];
    Logger.log(
      'Row ' + e.rowNumber +
      ' | class=' + e.classification +
      ' | scanKey=' + e.scanKey +
      ' | rawIsActive=' + JSON.stringify(raw.isActive) +
      ' | rawMode=' + JSON.stringify(raw.mode) +
      ' | errors=' + JSON.stringify(e.errors)
    );
  });
}