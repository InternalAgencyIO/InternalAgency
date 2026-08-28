import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  IAT_V2_ATTENDED_GIT_BINDING,
  verifyIatV2AttendedGitRuntime,
} from "../scripts/lib/iat-v2-attended-git-runtime.mjs";

test("attended Git runtime is bound to one exact Windows executable visible in Ubuntu WSL", () => {
  assert.deepEqual(IAT_V2_ATTENDED_GIT_BINDING, {
    version: "git version 2.55.0.windows.5",
    sha256: "d1b62b94aa15e5c3bbcdd6440d5f716f78daa2736a951b0f1fad11d38c5f16da",
    bytes: 4_378_456,
    windowsPath: "C:\\Program Files\\Git\\mingw64\\bin\\git.exe",
    wslPath: "/mnt/c/Program Files/Git/mingw64/bin/git.exe",
  });
  const source = readFileSync("scripts/lib/iat-v2-attended-git-runtime.mjs", "utf8");
  assert.doesNotMatch(source, /execFileSync\(["']git["']/u);
  assert.match(source, /GIT_CONFIG_NOSYSTEM: "1"/u);
  assert.match(source, /GIT_CONFIG_GLOBAL:/u);
  assert.match(source, /GIT_NO_LAZY_FETCH: "1"/u);
  assert.match(source, /GIT_NO_REPLACE_OBJECTS: "1"/u);
  assert.match(source, /GIT_TERMINAL_PROMPT: "0"/u);
  assert.match(source, /core\.fsmonitor=false/u);
  assert.match(source, /core\.hooksPath=\/dev\/null/u);
  assert.doesNotMatch(source, /\.\.\.options,\s*\n\s*\}\)/u, "callers must not replace the clean Git child environment");
});

const exactGitExists = existsSync(process.platform === "win32"
  ? IAT_V2_ATTENDED_GIT_BINDING.windowsPath
  : IAT_V2_ATTENDED_GIT_BINDING.wslPath);

test("this attended checkout verifies the exact Git path, bytes, digest, and version", {
  skip: !exactGitExists,
}, () => {
  const result = verifyIatV2AttendedGitRuntime(process.cwd());
  assert.equal(result.version, IAT_V2_ATTENDED_GIT_BINDING.version);
  assert.equal(result.sha256, IAT_V2_ATTENDED_GIT_BINDING.sha256);
  assert.equal(result.bytes, IAT_V2_ATTENDED_GIT_BINDING.bytes);
  assert.notEqual(result.path, "git");
});
