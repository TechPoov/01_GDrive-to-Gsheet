# GDrive_to_Gsheet

A Google Apps Script tool, bound to a Google Sheets workbook, that indexes the
contents of one or more Google Drive folders into that workbook — with a
filterable Dashboard for browsing the results.

This repo tracks the `src/` code only (the `.gs` files + `appsscript.json`
that live in the Apps Script project). Design docs and user-facing docs
(Quick Start Guide, User Manual, FAQ, Changelog, License, Permissions, and
the internal design-spec suite) are maintained as Google Docs in Drive —
`Releases/<version>/docs/` and `Releases/<version>/UserDocs/` hold a frozen
copy of each doc alongside the matching code snapshot for every release.

## Layout

- `src/` — every file that goes into the Apps Script project, unmodified
  except for the numeric-prefix load order Apps Script relies on. Copy all
  of these into the Apps Script editor (Extensions → Apps Script) to install
  or update the tool. `99_Debug.gs` is an ad-hoc manual debugging helper
  (not part of the original delivered set) — safe to keep or delete.

## Releasing a new version

1. Make and test your code changes in the Apps Script editor as usual (or
   edit the files here and copy them in).
2. Update `APP_VERSION` in `config.gs`.
3. Commit the change here:
   ```
   git add -A
   git commit -m "vX.Y.Z: <short summary>"
   git tag vX.Y.Z
   ```
4. Add an entry to the Changelog doc in Drive (`UserDocs/Changelog`),
   following its existing MAJOR.MINOR.PATCH convention.
5. Take a frozen Drive snapshot: copy the current Drive `src/`, `docs/`, and
   `UserDocs/` folders into `Releases/vX.Y.Z — <date>/` (same pattern as the
   `v2.0.0` release), so the exact code+docs pairing for that version is
   preserved even if `src/`/`docs/`/`UserDocs/` keep changing afterward.
6. Re-export this repo as a bundle and drop it into the same Releases
   folder, so the full git history travels with the Drive archive:
   ```
   git bundle create GDrive_to_GSheet.gitbundle --all
   ```

## Restoring from the bundle

```
git clone GDrive_to_GSheet.gitbundle GDrive_to_GSheet
cd GDrive_to_GSheet
git log --oneline --decorate --all
```

## Versioning

Semantic versioning (MAJOR.MINOR.PATCH), as defined in the Changelog doc:
MAJOR for breaking changes to the Profile/Index format, MINOR for
backward-compatible new features, PATCH for fixes that don't change
behavior recipients depend on.
