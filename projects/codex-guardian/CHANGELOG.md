# Changelog

All notable Codex Guardian changes are recorded here. Versions follow semantic
versioning and use namespaced monorepo tags.

## 1.0.0 - 2026-08-09

First stable open-source release.

- Preserved the proven lightweight .NET Framework WinForms watchdog and tray UI.
- Added a GUI checkbox list for Firefox and isolated managed Chrome.
- Added exact-path custom app selection, removal, and launching.
- Matched custom app choices by exact executable path.
- Made WARP management optional and disabled all enforcement during pause.
- Added non-elevated current-user portable start-at-sign-in support.
- Replaced machine-specific deep debloat behavior with five reversible HKCU focus
  preferences; removed blanket startup, task, service, and policy changes.
- Added atomic cross-process config writes, longer graceful-close time, self-tests,
  privacy checks, UI rendering QA, portable packaging, checksums, CI, and complete
  user/technical/recovery/build documentation.
