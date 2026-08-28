import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";

const VERSION = "git version 2.55.0.windows.5";
const SHA256 = "d1b62b94aa15e5c3bbcdd6440d5f716f78daa2736a951b0f1fad11d38c5f16da";
const BYTES = 4_378_456;
const WINDOWS_PATH = "C:\\Program Files\\Git\\mingw64\\bin\\git.exe";
const WSL_PATH = "/mnt/c/Program Files/Git/mingw64/bin/git.exe";

export const IAT_V2_ATTENDED_GIT_BINDING = Object.freeze({
  version: VERSION,
  sha256: SHA256,
  bytes: BYTES,
  windowsPath: WINDOWS_PATH,
  wslPath: WSL_PATH,
});

export class IatV2AttendedGitRuntimeError extends Error {
  constructor(message) {
    super(message);
    this.name = "IatV2AttendedGitRuntimeError";
    this.code = "IAT_V2_ATTENDED_GIT_RUNTIME_HOLD";
  }
}

function check(condition, message) {
  if (!condition) throw new IatV2AttendedGitRuntimeError(message);
}

function expectedPath(projectRoot) {
  if (process.platform === "win32") return WINDOWS_PATH;
  const root = realpathSync(projectRoot);
  if (process.platform === "linux" && root.startsWith("/mnt/c/")) return WSL_PATH;
  throw new IatV2AttendedGitRuntimeError(
    "attended Git is pinned to the reviewed Windows checkout through Ubuntu-24.04 WSL2",
  );
}

function cleanGitEnvironment() {
  const windows = process.platform === "win32";
  return {
    HOME: windows ? (process.env.USERPROFILE ?? "C:\\Users\\A") : "/home/a",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    PATH: windows ? "C:\\Windows\\System32" : "/usr/bin:/bin",
    ...(windows ? { SystemRoot: process.env.SystemRoot ?? "C:\\Windows" } : {}),
    GIT_ATTR_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: windows ? "NUL" : "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_LFS_SKIP_SMUDGE: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
  };
}

export function verifyIatV2AttendedGitRuntime(projectRoot) {
  const path = expectedPath(projectRoot);
  let entry;
  try {
    entry = lstatSync(path);
  } catch {
    throw new IatV2AttendedGitRuntimeError(`reviewed Git executable is missing at ${path}`);
  }
  check(entry.isFile() && !entry.isSymbolicLink(), "reviewed Git executable is not a regular non-symlink file");
  check(realpathSync(path) === path, "reviewed Git executable resolves through a symlink");
  check(entry.size === BYTES, `reviewed Git byte length drifted; expected ${BYTES}, observed ${entry.size}`);
  if (process.platform !== "win32") {
    check(entry.uid === process.getuid(), "reviewed Git executable is not owned by the attended POSIX user");
    check((entry.mode & 0o022) === 0, "reviewed Git executable is group- or world-writable");
  }
  const observedSha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
  check(observedSha256 === SHA256, "reviewed Git SHA-256 drifted");
  const observedVersion = execFileSync(path, ["--version"], {
    encoding: "utf8",
    env: cleanGitEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  check(observedVersion === VERSION, `reviewed Git version drifted; observed ${observedVersion}`);
  return Object.freeze({ path, version: VERSION, sha256: SHA256, bytes: BYTES });
}

export function createIatV2AttendedGitRunner(projectRoot) {
  const identity = verifyIatV2AttendedGitRuntime(projectRoot);
  const run = (root, args, options = {}) => execFileSync(identity.path, [
    "--no-pager",
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.hooksPath=/dev/null",
    ...args,
  ], {
    maxBuffer: options.maxBuffer ?? 50_000_000,
    cwd: root,
    encoding: "utf8",
    env: cleanGitEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return Object.freeze({ identity, run });
}
