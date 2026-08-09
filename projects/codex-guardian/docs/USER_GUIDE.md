# Codex Guardian user guide

## Before the first run

Codex Guardian closes unapproved applications. Save unfinished documents,
uploads, renders, and other work before enabling it. Keep Task Manager available
as a final recovery route.

Extract the portable ZIP to a permanent folder. Do not run it directly inside
the ZIP. The app has no installer and does not copy itself elsewhere.

## Choose allowed applications

The **Allowed apps** list contains two optional built-ins:

- **Mozilla Firefox** permits Firefox from the executable path Windows reports.
- **Google Chrome (isolated Guardian profile)** permits only Chrome launched by
  Guardian with a separate profile under `%LOCALAPPDATA%\CodexGuardian`.

Uncheck a browser you do not use. To allow another browser, editor, media player,
or business application:

1. Click **ADD APP...**.
2. Browse to that application's `.exe` file.
3. Leave its row checked.
4. Select it and click **LAUNCH**, or launch it normally from Windows.

Custom applications are matched by exact executable path. This prevents an
unrelated executable with the same filename from inheriting the exception.
Some multi-process applications use helpers in other paths; add each visible
helper executable if the app still closes.

Custom entries take precedence over strict mode. For example, adding your
preferred VPN or chat client explicitly allows its visible window.

## Enable, pause, and stop

- **ENABLE GUARDIAN** turns on strict mode and starts the tray watchdog.
- **PAUSE 15 MINUTES** stops process closing and optional WARP reconnects for
  fifteen minutes. Guardian resumes automatically.
- **EMERGENCY STOP** turns enforcement off until you explicitly enable it again.

The notification-area shield offers the same controls. Double-click it to open
the main window. **Exit tray app** emergency-stops enforcement before ending the
watchdog, so it cannot resume unexpectedly at the next sign-in.

## Start at sign-in

**Start Guardian at sign-in** writes the `InternalAgency Codex Guardian` value to
the current user's standard Windows `Run` registry key. It starts with ordinary
user privilege and points to the current portable EXE path. No service, task, or
administrator approval is involved.

Before moving the portable folder:

1. Uncheck **Start Guardian at sign-in**.
2. Move the folder.
3. Run the EXE from its new location.
4. Re-enable the option.

## Browser behavior

The managed Chrome button uses a dedicated profile under Guardian's local-data
folder. It does not enable a remote-debugging endpoint. Normal Chrome profiles
are not allowed by the built-in row. Add the same `chrome.exe` as a custom app if
you want every Chrome profile allowed.

Firefox launches normally and uses the user's existing Firefox profile.

## WARP option

When **Keep Cloudflare WARP connected** is checked and Guardian is actively
enforcing, it runs the installed `warp-cli connect` command approximately once
per minute. Guardian does not install WARP, change its protocol, or alter the
WARP service. Uncheck the option if you use another VPN or no VPN.

## Optional focus cleanup

**FOCUS CLEANUP** records and then changes five current-user registry values:

- three Windows content/suggestion switches;
- the Windows advertising-info switch;
- Game DVR enablement.

It does not disable services, tasks, startup programs, drivers, Windows Update,
security, virtualization, or applications. **RESTORE CLEANUP** restores the
recorded previous value and registry type for every setting.

## Logs and data

**OPEN LOG** opens `%LOCALAPPDATA%\CodexGuardian\guardian.log`. **OPEN APP DATA**
shows the complete local-data folder. See the
[technical design](TECHNICAL_DESIGN.md) for every stored file.

## Remove Codex Guardian

1. Click **EMERGENCY STOP**.
2. Uncheck **Start Guardian at sign-in**.
3. Use **RESTORE CLEANUP** if that feature was used.
4. Exit the tray app.
5. Delete the portable folder.
6. Optionally delete `%LOCALAPPDATA%\CodexGuardian` to remove settings and logs.
