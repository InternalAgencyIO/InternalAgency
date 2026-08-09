# Codex Guardian

Codex Guardian is a lightweight, configurable Windows focus guard. It keeps
Codex and essential Windows tooling available, lets you choose the other apps
that may stay open, and closes unapproved interactive apps while Guardian is
active.

It is a single native WinForms executable: no installer, Electron runtime,
service, account, telemetry, or network backend.

> **Windows only.** Version 1.0.0 targets Windows 11 and .NET Framework 4.8.
> The public binaries are currently unsigned; Windows SmartScreen may show an
> unknown-publisher warning.

## Download

Download the stable portable release from
[`codex-guardian-v1.0.0`](https://github.com/InternalAgencyIO/InternalAgency/releases/tag/codex-guardian-v1.0.0):

- `CodexGuardian-1.0.0-Windows-Portable.zip` — recommended; includes the app,
  start-here guide, README, and license.
- `CodexGuardian-1.0.0.exe` — the same executable by itself.
- `SHA256SUMS.txt` — SHA-256 checksums for the ZIP, EXE, and license.
- `LICENSE.txt` — the MIT license supplied beside the raw executable.

No setup program or MSI is provided.

## Quick start

1. Extract the portable ZIP to a folder you intend to keep.
2. Run `CodexGuardian.exe`.
3. Check Firefox and/or the isolated Chrome profile if you use them.
4. Click **ADD APP...** to choose any other application executable that should
   stay open.
5. Save work in every unapproved app, then click **ENABLE GUARDIAN**.
6. Optionally enable **Start Guardian at sign-in**.

Codex, core Windows components, Task Manager, terminals, Git, Node, Python,
SSH, WSL, and Hyper-V tools are always allowed. Custom entries are matched by
their exact executable path and take precedence over strict enforcement.

## What the GUI controls

- **Enable Guardian** starts the notification-area watchdog and enforcement.
- **Pause 15 minutes** stops all enforcement, including optional WARP checks.
- **Emergency stop** leaves the tray app available but turns enforcement off.
- **Allowed apps** is the complete user-facing exception editor. Uncheck either
  bundled browser or add/remove/launch custom executables without editing a file.
- **Keep Cloudflare WARP connected** asks `warp-cli` to reconnect about once per
  minute while Guardian is actively enforcing. It has no effect if WARP is absent.
- **Start Guardian at sign-in** adds a current-user Windows startup entry that
  points to the current portable executable. It does not require elevation.
- **Focus cleanup** changes only five reversible current-user Windows settings
  related to suggestions, advertising prompts, and Game DVR.

Read the [user guide](docs/USER_GUIDE.md) and
[safety and recovery guide](docs/SAFETY_AND_RECOVERY.md) before enabling strict
mode on a machine with unsaved work.

## Portable behavior and local data

The executable can run from any writable folder. Guardian stores only local
configuration and logs in:

```text
%LOCALAPPDATA%\CodexGuardian
```

The startup entry points to the exact EXE path. Disable **Start Guardian at
sign-in** before moving or deleting the portable folder, then re-enable it from
the new location.

## Design boundaries

The open-source edition intentionally does **not** carry over the private
prototype's machine-specific service names, scheduled-task names, user SIDs,
hardware diagnosis, or blanket removal of startup entries. Public version 1.0.0:

- never deletes applications, personal files, drivers, services, or startup entries;
- runs the watchdog at ordinary user privilege;
- only considers processes in the current interactive Windows session;
- asks visible apps to close, waits 3.5 seconds, and only then force-closes them;
- leaves apps running when Windows does not expose a trustworthy executable path;
- keeps pause and emergency recovery available from both the window and tray;
- makes optional Windows preference changes reversible from the same GUI.

Guardian is a focus tool, not an antivirus, sandbox, parental-control system,
or security boundary. See [technical design](docs/TECHNICAL_DESIGN.md).

## Build from source

On Windows 11 with .NET Framework 4.8 enabled:

```powershell
cd projects\codex-guardian
.\scripts\verify.ps1 -CaptureUi
.\scripts\package.ps1 -Version 1.0.0
```

The release assets are written to `artifacts\release`. Visual Studio users can
open `src\CodexGuardian.csproj`; the scripts use Windows' bundled .NET Framework
C# compiler directly so no package restore is required.

See [building and releasing](docs/BUILDING.md) for the complete repeatable
workflow.

## Project history

The first working build was created on 4 August 2026 as a personal Windows 11
Codex-focused appliance. The public release preserves its small WinForms core,
tray watchdog, isolated Chrome profile, WARP option, pause,
emergency stop, and reversible settings while replacing machine-specific
assumptions with the GUI app picker.

## License and name

The project is released under the repository's
[MIT License](https://github.com/InternalAgencyIO/InternalAgency/blob/main/LICENSE).

Codex Guardian is an independent community project. “Codex” is used
descriptively; this project is not an official OpenAI product and is not
affiliated with or endorsed by OpenAI.
