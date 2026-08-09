# Technical design

## Goals

Codex Guardian is intentionally a small user-session utility:

- one portable WinForms executable;
- no installer, Windows service, driver, browser extension, server, or telemetry;
- GUI configuration for allowed applications;
- a reversible local record for every optional system preference it changes;
- emergency controls that do not depend on the protected application set.

## Runtime components

`Program` routes normal startup to `MainForm` and internal startup/self-test/UI-
capture arguments to their narrow handlers.

`GuardianContext` owns the notification-area icon and a 2.5-second Windows Forms
timer. A named mutex permits only one watchdog per user session.

`ProcessGuard` enumerates processes in its own Windows session. It skips the
current process, Windows-directory components, Codex, recovery/toolchain names,
and enabled app entries. In strict mode it closes remaining visible applications.
It fails open for hidden processes and executable paths Windows will not expose.

`AppCatalog` merges two discovered built-in browsers with GUI-managed custom
entries. Custom fields are base64-encoded inside a UTF-8 TSV file so tabs and
non-ASCII display names remain unambiguous without adding a serialization library.

`AtomicTextFile` uses named mutexes and same-directory replace operations to keep
configuration consistent between the main window and watchdog.

`Persistence` uses the current user's standard Windows `Run` registry key. It
references the portable EXE in place and never elevates the watchdog.

`FocusCleanup` changes only HKCU values and records existence, registry kind, and
value data before mutation.

## Local files

All mutable data is under `%LOCALAPPDATA%\CodexGuardian`:

| File/folder | Purpose |
| --- | --- |
| `guardian.ini` | Active, pause, browser, and WARP UI state |
| `allowed-apps.tsv` | Exact-path custom app entries and enabled state |
| `guardian.log` | Timestamped actions and non-fatal errors |
| `ChromeProfile\` | Isolated Chrome user-data directory |
| `focus-cleanup-backup.tsv` | Exact pre-cleanup registry state |

No data is sent to Internal Agency, OpenAI, or another backend.

## Browser isolation

Managed Chrome is launched with a dedicated `--user-data-dir`. The built-in
Chrome exception checks the process command line for this Guardian profile path,
so an ordinary Chrome profile is not accidentally covered by that row. Guardian
does not expose a Chrome remote-debugging endpoint.

Firefox is an ordinary exact-path exception and launcher.

## Compatibility

Release builds target .NET Framework 4.8 and `AnyCPU`. Windows 11 includes or can
enable the runtime. The source avoids external NuGet packages and modern runtime
APIs; it can be compiled by the Windows .NET Framework C# compiler or opened as a
classic Visual Studio project.

## Explicit non-goals

- malware containment or application sandboxing;
- multi-user or enterprise policy enforcement;
- kernel/process-protection resistance;
- silently changing services, startup entries, drivers, firewalls, VPN settings,
  Windows Update, Defender, Hyper-V, or WSL;
- cross-platform support in version 1.x.

## Provenance and public-hardening changes

The personal prototype used one 917-line C# file and included machine-specific
service/task lists, SIDs, application paths, and hardware notes. The public source
keeps the proven UI/watchdog approach but removes those values, separates optional
cleanup from enforcement, makes pause global, adds exact-path GUI exceptions, and
adds repeatable build/verification/package scripts.
