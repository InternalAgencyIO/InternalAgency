# Contributing

Contributions are welcome when they preserve Codex Guardian's small, reversible,
GUI-first design.

## Scope

Good changes improve Windows 11 reliability, app discovery, accessibility,
recovery, documentation, or test coverage without adding a background service,
installer, cloud dependency, telemetry, or broad system mutation.

Windows-only support is intentional for version 1.x.

## Safety rules

- Never add machine-specific SIDs, usernames, device IDs, local paths, logs, or
  screenshots containing personal state.
- Do not disable or delete arbitrary services, tasks, startup entries, drivers,
  applications, or personal files.
- Any new system change must be explicit in the GUI, narrowly scoped, recorded
  before mutation, and reversible from the same GUI.
- Task Manager and emergency controls must remain reachable.
- A custom exact-path exception must continue to take precedence over strict
  enforcement.
- Do not add network calls or telemetry without a separately reviewed design and
  an explicit user opt-in.

## Validation

Run before opening a pull request:

```powershell
.\scripts\verify.ps1 -CaptureUi
.\scripts\package.ps1 -Version 1.0.0
git diff --check
```

Describe user impact, safety implications, validation, and rollback behavior in
the pull request.
