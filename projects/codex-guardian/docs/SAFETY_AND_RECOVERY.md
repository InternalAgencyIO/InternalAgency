# Safety and recovery

## Main risk: unsaved application state

Strict mode asks an unapproved visible application to close, waits 3.5 seconds,
and then terminates it if it remains open. Applications may not have time to
finish saving. Guardian cannot determine whether every application has unsaved
work.

Always save work before enabling strict mode. Add long-running renderers,
uploaders, password managers, accessibility tools, remote-control clients, and
other required applications before activation.

## Recovery order

Use the first available option:

1. Click **EMERGENCY STOP** in the main window.
2. Open the notification-area shield and choose **Emergency stop**.
3. Open Task Manager with `Ctrl+Shift+Esc`, select the `CodexGuardian` process,
   and choose **End task**. This stops only the current process; saved active state
   can resume at the next sign-in.
4. Before signing out or restarting, disable **Codex Guardian** in Task Manager's
   **Startup apps**, or remove the
   `InternalAgency Codex Guardian` value from the current user's Windows `Run`
   registry key.
5. Sign out or restart Windows, then leave Guardian off until its allowed-app list
   has been corrected.

Task Manager and core Windows recovery components are always allowed.

## What pause means

While paused, Guardian performs no process enforcement and no WARP reconnect.
The tray app remains running so it can resume after the selected interval.
Emergency stop is different: it clears the active setting and does not resume
on its own.

## Privileges

The main window and watchdog run as the current user. They do not install a
service, scheduled task, or kernel component. The startup entry is per-user.

Guardian refuses to run its normal GUI or watchdog with administrator rights.
The focus cleanup and start-at-sign-in entry are limited to the current user and
do not need elevation.

## Process matching limitations

Guardian is deliberately small and uses normal Windows process information:

- core tools are allowed by known process name or verified Codex package path;
- custom apps are allowed by exact executable path;
- strict mode targets visible apps in the current interactive session;
- processes without a visible window are left alone;
- unknown or inaccessible executable paths fail open rather than being killed.

Guardian is not resistant to a malicious process, path spoofing, administrator
tampering, or code injection. It is not a security boundary.

## Startup-entry recovery

The current-user startup value contains only the absolute path to the portable
EXE plus the internal `--watchdog` argument. If the file is moved, Windows logs a
failed startup attempt but does not download or substitute anything. Disable and
recreate the entry from the GUI after moving the app.

## Focus-cleanup backup

The original registry value, existence flag, and value type are stored in:

```text
%LOCALAPPDATA%\CodexGuardian\focus-cleanup-backup.tsv
```

After restoration, Guardian renames the manifest with a `.restored-<timestamp>`
suffix. It never deletes the record silently.

## Unsigned release

Version 1.0.0 is not Authenticode-signed. Download only from the official GitHub
release page and compare its SHA-256 value with `SHA256SUMS.txt`. A checksum
detects corruption or substitution relative to that release record; it does not
replace publisher identity signing.

On Windows PowerShell, verify a downloaded asset with:

```powershell
(Get-FileHash .\CodexGuardian-1.0.0.exe -Algorithm SHA256).Hash.ToLowerInvariant()
Get-Content .\SHA256SUMS.txt
```

## Reporting a safety problem

Do not include personal paths, logs, usernames, or device identifiers in a public
issue. Follow the project [security policy](../SECURITY.md) for private reports.
