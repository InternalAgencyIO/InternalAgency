import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/main.cjs", import.meta.url), "utf8");

test("desktop renderer is sandboxed and cannot navigate or create windows", () => {
  assert.match(source, /contextIsolation:\s*true/);
  assert.match(source, /nodeIntegration:\s*false/);
  assert.match(source, /sandbox:\s*true/);
  assert.match(source, /will-frame-navigate/);
  assert.match(source, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
});

test("capture is restricted to the exact local main frame and a user gesture", () => {
  assert.match(source, /request\.userGesture/);
  assert.match(source, /request\.frame !== overlay\?\.webContents\.mainFrame/);
  assert.match(source, /request\.frame\?\.url !== RENDERER_URL/);
  assert.match(source, /request\.securityOrigin !== "file:\/\/"/);
  assert.match(source, /CAPTURE_GRANT_MS = 10_000/);
  assert.match(source, /setPermissionCheckHandler/);
  assert.match(source, /setPermissionRequestHandler/);
});

test("desktop IPC rejects senders outside the trusted renderer", () => {
  assert.match(source, /isTrustedRenderer\(event\.sender\)/);
  assert.doesNotMatch(source, /ipcMain\.on\("overlay:close", \(\) =>/);
});
