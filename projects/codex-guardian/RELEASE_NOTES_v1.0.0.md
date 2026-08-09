# Codex Guardian 1.0.0

Codex Guardian is now open source as a stable Windows 11 portable app.

This release keeps the small, responsive WinForms guardian that proved useful in
daily Codex work and makes it suitable for other Windows setups:

- select Firefox and/or isolated managed Chrome from the GUI;
- add any custom application with a normal Windows file picker;
- allow custom apps by exact executable path;
- pause or emergency-stop enforcement from the window or tray;
- optionally keep Cloudflare WARP connected;
- optionally start the portable EXE at sign-in without an installer or elevation;
- use narrowly scoped, reversible focus preferences.

The public edition removes the prototype's machine-specific SIDs, service/task
lists, hardware notes, and blanket startup deletion. It does not remove programs,
drivers, services, startup entries, or personal files.

## Downloads

- `CodexGuardian-1.0.0-Windows-Portable.zip` — recommended package.
- `CodexGuardian-1.0.0.exe` — raw portable executable.
- `SHA256SUMS.txt` — SHA-256 integrity values.
- `LICENSE.txt` — the MIT license supplied beside the raw EXE.

The binaries are unsigned, so Windows SmartScreen may show an unknown-publisher
warning. Download only from this release page and verify the checksum file.

See the included README and the online
[safety guide](https://github.com/InternalAgencyIO/InternalAgency/blob/main/projects/codex-guardian/docs/SAFETY_AND_RECOVERY.md)
before first use.
