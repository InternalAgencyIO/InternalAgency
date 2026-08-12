import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const EXPECTED_MASTER_COUNT = 16;
export const EXPECTED_FPS = 30;
export const EXPECTED_TOTAL_DURATION_SECONDS = 420;
export const MIN_MASTER_BYTES = 100_000;
export const RELEASE_INVENTORY_SHA256 = "dddbd7a2dc4ad069e33990f55985c59ac31febd1ec0288fdff04af268f3117f9";

const FULL_MASTER_PATTERN = /-full-30fps\.mp4$/;
const SAFE_SCENE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const LOCKED_FFPROBE_WRAPPER = fileURLToPath(new URL("./invoke-locked-ffprobe.ps1", import.meta.url));
const EXACT_FFPROBE_PIN = Object.freeze({
  schemaVersion: 1,
  tool: "ffprobe",
  platform: "win32-x64",
  versionLine: "ffprobe version 9.0-essentials_build-www.gyan.dev Copyright (c) 2007-2026 the FFmpeg developers",
  bytes: 102599168,
  sha256: "901f0efe4793cbb0f017101e3427f816e8fbf9a407bd585f49df30f4325cfd88",
  archive: Object.freeze({
    url: "https://github.com/GyanD/codexffmpeg/releases/download/9.0/ffmpeg-9.0-essentials_build.zip",
    bytes: 111167378,
    sha256: "e6b54767a6065919048f1a098eb27211ca4e12b4348a05d88777a5855d0b6e71",
    executableRelativePath: "ffmpeg-9.0-essentials_build/bin/ffprobe.exe"
  })
});

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function statIdentity(stat) {
  return {
    dev: stat.dev,
    ino: stat.ino,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs
  };
}

function assertStableIdentity(before, after, label) {
  if (!isDeepStrictEqual(statIdentity(before), statIdentity(after))) {
    throw new Error(`${label} changed during validation`);
  }
}

function assertPathNamesDescriptor(filePath, descriptor, label) {
  const descriptorStat = fs.fstatSync(descriptor, { bigint: true });
  const pathStat = fs.statSync(filePath, { bigint: true });
  if (descriptorStat.dev !== pathStat.dev || descriptorStat.ino !== pathStat.ino) {
    throw new Error(`${label} pathname no longer names the opened file`);
  }
}

function hashDescriptor(descriptor, label) {
  const before = fs.fstatSync(descriptor, { bigint: true });
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let bytes = 0;
  for (;;) {
    const read = fs.readSync(descriptor, buffer, 0, buffer.length, bytes);
    if (read === 0) {
      break;
    }
    hash.update(buffer.subarray(0, read));
    bytes += read;
  }
  const after = fs.fstatSync(descriptor, { bigint: true });
  assertStableIdentity(before, after, label);
  if (after.size !== BigInt(bytes)) {
    throw new Error(`${label} changed length while hashing`);
  }
  return { bytes, sha256: hash.digest("hex"), stat: after };
}

export function isPathInside(parent, candidate, pathApi = path) {
  const relative = pathApi.relative(parent, candidate);
  return (
    relative === "" ||
    (!pathApi.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${pathApi.sep}`))
  );
}

export function assertAnchoredDirectory(directoryPath, parentPath, label = directoryPath) {
  const canonicalParent = fs.realpathSync(parentPath);
  const stat = fs.lstatSync(directoryPath);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must be a non-symlink directory`);
  }
  const canonicalDirectory = fs.realpathSync(directoryPath);
  if (!isPathInside(canonicalParent, canonicalDirectory)) {
    throw new Error(`${label} resolves outside ${canonicalParent}`);
  }
  return canonicalDirectory;
}

export function assertContainedRegularFile(filePath, parentPath, label = filePath) {
  const parent = fs.realpathSync(parentPath);
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular, non-symlink file`);
  }
  const realFile = fs.realpathSync(filePath);
  if (!isPathInside(parent, realFile)) {
    throw new Error(`${label} resolves outside ${parentPath}`);
  }
  return realFile;
}

export function hashAndMeasureFile(filePath, parentPath = null) {
  const realFile = parentPath
    ? assertContainedRegularFile(filePath, parentPath, path.basename(filePath))
    : fs.realpathSync(filePath);
  const descriptor = fs.openSync(realFile, "r");
  try {
    assertPathNamesDescriptor(realFile, descriptor, path.basename(filePath));
    const measured = hashDescriptor(descriptor, path.basename(filePath));
    assertPathNamesDescriptor(realFile, descriptor, path.basename(filePath));
    return { bytes: measured.bytes, sha256: measured.sha256 };
  } finally {
    fs.closeSync(descriptor);
  }
}

export function parsePinnedReleaseInventory(bytes) {
  if (!Buffer.isBuffer(bytes)) {
    throw new Error("release inventory must be supplied as exact file bytes");
  }
  const digest = sha256Bytes(bytes);
  if (digest !== RELEASE_INVENTORY_SHA256) {
    throw new Error(`release inventory byte digest mismatch: expected ${RELEASE_INVENTORY_SHA256}, got ${digest}`);
  }
  let inventory;
  try {
    inventory = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`release inventory is invalid JSON: ${formatError(error)}`);
  }
  if (
    !isPlainObject(inventory) ||
    inventory.schemaVersion !== 1 ||
    inventory.fps !== EXPECTED_FPS ||
    inventory.totalDurationSeconds !== EXPECTED_TOTAL_DURATION_SECONDS ||
    !Array.isArray(inventory.masters) ||
    inventory.masters.length !== EXPECTED_MASTER_COUNT
  ) {
    throw new Error("release inventory metadata is invalid");
  }
  const ids = new Set();
  const filenames = new Set();
  let duration = 0;
  for (const [index, master] of inventory.masters.entries()) {
    if (
      !isPlainObject(master) ||
      !SAFE_SCENE_ID_PATTERN.test(master.id ?? "") ||
      typeof master.source !== "string" ||
      !master.source.startsWith("assets/scenes/") ||
      master.source.includes("\\") ||
      master.source.split("/").includes("..") ||
      !Number.isFinite(master.durationSeconds) ||
      master.durationSeconds <= 0 ||
      master.filename !== `${master.id}-full-30fps.mp4` ||
      !Number.isSafeInteger(master.sourceBytes) ||
      master.sourceBytes <= 0 ||
      !SHA256_PATTERN.test(master.sourceSha256 ?? "")
    ) {
      throw new Error(`release inventory master ${index} is invalid`);
    }
    if (ids.has(master.id) || filenames.has(master.filename)) {
      throw new Error(`release inventory master ${index} is duplicated`);
    }
    ids.add(master.id);
    filenames.add(master.filename);
    duration += master.durationSeconds;
  }
  if (duration !== EXPECTED_TOTAL_DURATION_SECONDS) {
    throw new Error(`release inventory runtime must be ${EXPECTED_TOTAL_DURATION_SECONDS} seconds`);
  }
  return inventory;
}

export function validateFfprobePinMetadata(pin) {
  if (!isDeepStrictEqual(pin, EXACT_FFPROBE_PIN)) {
    throw new Error("ffprobe pin metadata does not exactly match the frozen release pin");
  }
  return pin;
}

export function parseFrameRate(value) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`invalid frame-rate rational: ${String(value)}`);
  }
  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    throw new Error(`invalid frame-rate rational: ${value}`);
  }
  const result = numerator / denominator;
  if (!Number.isFinite(result) || result <= 0) {
    throw new Error(`invalid frame rate: ${value}`);
  }
  return result;
}

function finiteNumber(value, label) {
  const result = Number(value);
  if (!Number.isFinite(result)) {
    throw new Error(`${label} is not finite`);
  }
  return result;
}

function positiveInteger(value, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new Error(`${label} is not a positive integer`);
  }
  return result;
}

function assertExactEvidence(actual, expected, label) {
  if (!isPlainObject(actual) || !isDeepStrictEqual(actual, expected)) {
    throw new Error(`${label} does not match the expected byte length and SHA-256`);
  }
}

function lockedPowerShellPath() {
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !path.win32.isAbsolute(systemRoot)) {
    throw new Error("SystemRoot must name the absolute Windows PowerShell installation root");
  }
  const candidate = path.win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe"
  );
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("Windows PowerShell must be a regular, non-symlink executable");
  }
  return fs.realpathSync(candidate);
}

export function invokeLockedFfprobe({
  toolPath,
  argumentsList,
  mediaPath,
  timeoutMs,
  expectedToolEvidence,
  expectedMediaEvidence
}) {
  const argumentsBytes = Buffer.from(JSON.stringify(argumentsList), "utf8");
  const mode = mediaPath ? "probe" : "version";
  const wrapperArguments = [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    LOCKED_FFPROBE_WRAPPER,
    "-Mode",
    mode,
    "-ToolPath",
    toolPath,
    "-ArgumentsBase64",
    argumentsBytes.toString("base64"),
    "-ExpectedToolBytes",
    String(expectedToolEvidence.bytes),
    "-ExpectedToolSha256",
    expectedToolEvidence.sha256
  ];
  if (mediaPath) {
    wrapperArguments.push(
      "-MediaPath",
      mediaPath,
      "-ExpectedMediaBytes",
      String(expectedMediaEvidence.bytes),
      "-ExpectedMediaSha256",
      expectedMediaEvidence.sha256
    );
  }
  const result = spawnSync(lockedPowerShellPath(), wrapperArguments, {
    encoding: "utf8",
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error) {
    throw new Error(`locked ffprobe wrapper failed: ${formatError(result.error)}`);
  }
  if (result.status !== 0) {
    throw new Error(`locked ffprobe wrapper exited ${result.status}: ${result.stderr.trim() || "no diagnostic"}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`locked ffprobe wrapper returned invalid JSON: ${formatError(error)}`);
  }
}

function validateLockedInvocationEnvelope({
  envelope,
  argumentsList,
  expectedToolEvidence,
  expectedMediaEvidence,
  mediaPath
}) {
  const expectedArgumentsSha256 = sha256Bytes(Buffer.from(JSON.stringify(argumentsList), "utf8"));
  const expectedMode = mediaPath ? "probe" : "version";
  if (
    !isPlainObject(envelope) ||
    envelope.schemaVersion !== 1 ||
    envelope.mode !== expectedMode ||
    envelope.argumentsSha256 !== expectedArgumentsSha256 ||
    !isPlainObject(envelope.tool) ||
    !Number.isSafeInteger(envelope.status) ||
    typeof envelope.stdout !== "string" ||
    typeof envelope.stderr !== "string"
  ) {
    throw new Error("locked ffprobe wrapper evidence envelope is invalid");
  }
  assertExactEvidence(envelope.tool.before, expectedToolEvidence, "locked ffprobe tool evidence before invocation");
  assertExactEvidence(envelope.tool.after, expectedToolEvidence, "locked ffprobe tool evidence after invocation");
  if (mediaPath) {
    if (!isPlainObject(envelope.media) || !expectedMediaEvidence) {
      throw new Error("locked ffprobe media evidence envelope is missing");
    }
    assertExactEvidence(envelope.media.before, expectedMediaEvidence, "locked media evidence before invocation");
    assertExactEvidence(envelope.media.after, expectedMediaEvidence, "locked media evidence after invocation");
  } else if (envelope.media !== null) {
    throw new Error("locked ffprobe version evidence must not contain media evidence");
  }
  return {
    status: envelope.status,
    stdout: envelope.stdout,
    stderr: envelope.stderr,
    error: null
  };
}

export function createPinnedExecutableSession({
  executablePath,
  expectedBytes,
  expectedSha256,
  expectedVersionLine,
  stagingParent = os.tmpdir(),
  lockedInvoker = invokeLockedFfprobe
}) {
  if (!executablePath || !path.isAbsolute(executablePath)) {
    throw new Error("executable path must be explicit and absolute");
  }
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || !SHA256_PATTERN.test(expectedSha256 ?? "")) {
    throw new Error("expected executable evidence is invalid");
  }
  if (typeof expectedVersionLine !== "string" || expectedVersionLine.length === 0) {
    throw new Error("expected executable version line is invalid");
  }
  if (typeof lockedInvoker !== "function") {
    throw new Error("locked executable invoker is invalid");
  }

  const initialStat = fs.lstatSync(executablePath);
  if (initialStat.isSymbolicLink() || !initialStat.isFile()) {
    throw new Error("executable must be a regular, non-symlink file");
  }
  const originalRealPath = fs.realpathSync(executablePath);
  const realStagingParent = fs.realpathSync(stagingParent);
  const parentStat = fs.lstatSync(stagingParent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new Error("executable staging parent must be a non-symlink directory");
  }

  let originalDescriptor;
  let stagedDescriptor;
  let stagingDirectory;
  let stagedRealPath;
  let originalBaseline;
  let stagedBaseline;
  let closed = false;
  let versionLine;

  function assertOpenIdentity() {
    assertPathNamesDescriptor(originalRealPath, originalDescriptor, "original pinned executable");
    assertStableIdentity(originalBaseline.stat, fs.fstatSync(originalDescriptor, { bigint: true }), "original pinned executable");
    assertPathNamesDescriptor(stagedRealPath, stagedDescriptor, "staged pinned executable");
    assertStableIdentity(stagedBaseline.stat, fs.fstatSync(stagedDescriptor, { bigint: true }), "staged pinned executable");
  }

  function close() {
    if (closed) {
      return;
    }
    closed = true;
    let integrityError;
    try {
      if (
        typeof originalDescriptor === "number" &&
        typeof stagedDescriptor === "number" &&
        originalBaseline &&
        stagedBaseline &&
        stagedRealPath
      ) {
        assertOpenIdentity();
        const originalFinal = hashDescriptor(originalDescriptor, "original pinned executable");
        const stagedFinal = hashDescriptor(stagedDescriptor, "staged pinned executable");
        assertExactEvidence(
          { bytes: originalFinal.bytes, sha256: originalFinal.sha256 },
          { bytes: expectedBytes, sha256: expectedSha256 },
          "original pinned executable final evidence"
        );
        assertExactEvidence(
          { bytes: stagedFinal.bytes, sha256: stagedFinal.sha256 },
          { bytes: expectedBytes, sha256: expectedSha256 },
          "staged pinned executable final evidence"
        );
      }
    } catch (error) {
      integrityError = error;
    } finally {
      if (typeof stagedDescriptor === "number") {
        fs.closeSync(stagedDescriptor);
      }
      if (typeof originalDescriptor === "number") {
        fs.closeSync(originalDescriptor);
      }
      if (stagingDirectory) {
        fs.rmSync(stagingDirectory, { recursive: true, force: true });
      }
    }
    if (integrityError) {
      throw integrityError;
    }
  }

  const expectedToolEvidence = { bytes: expectedBytes, sha256: expectedSha256 };
  const session = {
    invoke(argumentsList, { mediaPath = null, expectedMediaEvidence = null, timeoutMs = 120_000 } = {}) {
      if (closed) {
        throw new Error("pinned executable session is closed");
      }
      if (!Array.isArray(argumentsList) || argumentsList.length === 0 || argumentsList.some((item) => typeof item !== "string")) {
        throw new Error("pinned executable arguments must be a non-empty string array");
      }
      if (mediaPath && (!path.isAbsolute(mediaPath) || !expectedMediaEvidence)) {
        throw new Error("locked media invocation requires an absolute path and expected evidence");
      }
      assertOpenIdentity();
      let envelope;
      let invocationError;
      try {
        envelope = lockedInvoker({
          toolPath: stagedRealPath,
          argumentsList,
          mediaPath,
          timeoutMs,
          expectedToolEvidence,
          expectedMediaEvidence
        });
      } catch (error) {
        invocationError = error;
      }
      let identityError;
      try {
        assertOpenIdentity();
      } catch (error) {
        identityError = error;
      }
      if (identityError) {
        throw identityError;
      }
      if (invocationError) {
        throw invocationError;
      }
      return validateLockedInvocationEnvelope({
        envelope,
        argumentsList,
        expectedToolEvidence,
        expectedMediaEvidence,
        mediaPath
      });
    },
    close,
    get evidence() {
      return { ...expectedToolEvidence, versionLine };
    }
  };

  try {
    originalDescriptor = fs.openSync(originalRealPath, "r");
    assertPathNamesDescriptor(originalRealPath, originalDescriptor, "original pinned executable");
    originalBaseline = hashDescriptor(originalDescriptor, "original pinned executable");
    assertExactEvidence(
      { bytes: originalBaseline.bytes, sha256: originalBaseline.sha256 },
      expectedToolEvidence,
      "original pinned executable evidence"
    );

    stagingDirectory = fs.mkdtempSync(path.join(realStagingParent, "radiance-locked-ffprobe-"));
    fs.chmodSync(stagingDirectory, 0o700);
    stagingDirectory = assertAnchoredDirectory(
      stagingDirectory,
      realStagingParent,
      "pinned executable staging directory"
    );
    const stagedPath = path.join(stagingDirectory, path.basename(originalRealPath));
    const copied = stageOpenedFile(
      originalDescriptor,
      originalRealPath,
      stagedPath,
      "original pinned executable",
      0o700
    );
    assertExactEvidence(
      { bytes: copied.bytes, sha256: copied.sha256 },
      expectedToolEvidence,
      "staged executable copy evidence"
    );
    stagedRealPath = assertContainedRegularFile(stagedPath, stagingDirectory, path.basename(stagedPath));
    stagedDescriptor = fs.openSync(stagedRealPath, "r");
    assertPathNamesDescriptor(stagedRealPath, stagedDescriptor, "staged pinned executable");
    stagedBaseline = hashDescriptor(stagedDescriptor, "staged pinned executable");
    assertExactEvidence(
      { bytes: stagedBaseline.bytes, sha256: stagedBaseline.sha256 },
      expectedToolEvidence,
      "staged pinned executable evidence"
    );
    originalBaseline = copied;

    const version = session.invoke(["-version"], { timeoutMs: 15_000 });
    if (version.error) {
      throw new Error(`executable version check failed: ${formatError(version.error)}`);
    }
    if (version.status !== 0) {
      throw new Error(`executable version check exited ${version.status}: ${version.stderr.trim()}`);
    }
    versionLine = version.stdout.split(/\r?\n/, 1)[0];
    if (versionLine !== expectedVersionLine) {
      throw new Error(
        `executable version mismatch: expected ${JSON.stringify(expectedVersionLine)}, got ${JSON.stringify(versionLine)}`
      );
    }
    return session;
  } catch (error) {
    let cleanupError;
    try {
      close();
    } catch (closeError) {
      cleanupError = closeError;
    }
    if (cleanupError && error && typeof error === "object") {
      error.cause = cleanupError;
    }
    throw error;
  }
}

export function createPinnedFfprobeSession(ffprobePath, pin, options = {}) {
  validateFfprobePinMetadata(pin);
  if (!ffprobePath || !path.isAbsolute(ffprobePath)) {
    throw new Error("ffprobe path must be explicit and absolute");
  }
  const runtimePlatform = `${process.platform}-${process.arch}`;
  if (pin.platform !== runtimePlatform) {
    throw new Error(`ffprobe pin is for ${pin.platform}, not ${runtimePlatform}`);
  }
  return createPinnedExecutableSession({
    executablePath: ffprobePath,
    expectedBytes: pin.bytes,
    expectedSha256: pin.sha256,
    expectedVersionLine: pin.versionLine,
    ...options
  });
}

export function verifyPinnedFfprobe(ffprobePath, pin, options = {}) {
  const session = createPinnedFfprobeSession(ffprobePath, pin, options);
  try {
    return session.evidence;
  } finally {
    session.close();
  }
}

export function probeVideoFile(ffprobeSession, filePath, expectedMediaEvidence) {
  if (!ffprobeSession || typeof ffprobeSession.invoke !== "function") {
    throw new Error("ffprobe must be supplied as an active pinned executable session");
  }
  const result = ffprobeSession.invoke(
    [
      "-v",
      "error",
      "-select_streams",
      "v",
      "-count_frames",
      "-show_entries",
      "stream=codec_type,avg_frame_rate,r_frame_rate,duration,nb_read_frames",
      "-show_entries",
      "format=duration,size",
      "-of",
      "json",
      "--",
      filePath
    ],
    {
      mediaPath: filePath,
      expectedMediaEvidence,
      timeoutMs: 120_000
    }
  );
  if (result.error) {
    throw new Error(`ffprobe failed: ${formatError(result.error)}`);
  }
  if (result.status !== 0) {
    throw new Error(`ffprobe exited ${result.status}: ${result.stderr.trim() || "no diagnostic"}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`ffprobe returned invalid JSON: ${formatError(error)}`);
  }
  if (!Array.isArray(parsed.streams) || parsed.streams.length !== 1) {
    throw new Error(`expected exactly one video stream, got ${parsed.streams?.length ?? 0}`);
  }
  const stream = parsed.streams[0];
  if (stream.codec_type !== "video") {
    throw new Error("ffprobe selected a non-video stream");
  }
  const averageFps = parseFrameRate(stream.avg_frame_rate);
  const nominalFps = parseFrameRate(stream.r_frame_rate);
  const frameCount = positiveInteger(stream.nb_read_frames, "decoded frame count");
  const streamDuration = finiteNumber(stream.duration, "stream duration");
  const formatDuration = finiteNumber(parsed.format?.duration, "container duration");
  const formatBytes = positiveInteger(parsed.format?.size, "container byte length");
  const decodedDuration = frameCount / averageFps;
  const oneFrameTolerance = 1 / averageFps + 0.001;
  if (Math.abs(streamDuration - decodedDuration) > oneFrameTolerance) {
    throw new Error("stream duration disagrees with decoded frame count and average fps");
  }
  if (Math.abs(formatDuration - decodedDuration) > oneFrameTolerance) {
    throw new Error("container duration disagrees with decoded frame count and average fps");
  }
  return {
    fps: Number(averageFps.toFixed(3)),
    nominalFps: Number(nominalFps.toFixed(3)),
    durationSeconds: Number(decodedDuration.toFixed(3)),
    frameCount,
    formatBytes
  };
}

function stageOpenedFile(sourceDescriptor, sourcePath, stagingPath, label, mode = 0o600) {
  const sourceBefore = fs.fstatSync(sourceDescriptor, { bigint: true });
  assertPathNamesDescriptor(sourcePath, sourceDescriptor, label);
  const destinationDescriptor = fs.openSync(stagingPath, "wx", mode);
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let bytes = 0;
  try {
    for (;;) {
      const read = fs.readSync(sourceDescriptor, buffer, 0, buffer.length, bytes);
      if (read === 0) {
        break;
      }
      hash.update(buffer.subarray(0, read));
      let written = 0;
      while (written < read) {
        written += fs.writeSync(destinationDescriptor, buffer, written, read - written, null);
      }
      bytes += read;
    }
    fs.fsyncSync(destinationDescriptor);
  } finally {
    fs.closeSync(destinationDescriptor);
  }
  const sourceAfter = fs.fstatSync(sourceDescriptor, { bigint: true });
  assertStableIdentity(sourceBefore, sourceAfter, label);
  assertPathNamesDescriptor(sourcePath, sourceDescriptor, label);
  if (sourceAfter.size !== BigInt(bytes)) {
    throw new Error(`${label} changed length while staging`);
  }
  return { bytes, sha256: hash.digest("hex"), stat: sourceAfter };
}

export function inspectMasterFile({
  filePath,
  videosDir,
  ffprobeSession,
  stagingDir,
  probe = probeVideoFile
}) {
  const realFile = assertContainedRegularFile(filePath, videosDir, path.basename(filePath));
  const sourceDescriptor = fs.openSync(realFile, "r");
  const stagingPath = path.join(stagingDir, `${crypto.randomUUID()}-${path.basename(filePath)}`);
  try {
    const sourceEvidence = stageOpenedFile(sourceDescriptor, realFile, stagingPath, path.basename(filePath));
    const stagedRealFile = assertContainedRegularFile(stagingPath, stagingDir, path.basename(stagingPath));
    const stagedBefore = hashAndMeasureFile(stagedRealFile, stagingDir);
    if (stagedBefore.bytes !== sourceEvidence.bytes || stagedBefore.sha256 !== sourceEvidence.sha256) {
      throw new Error("stable staging copy does not match the opened source file");
    }
    const probed = probe(ffprobeSession, stagedRealFile, stagedBefore);
    const stagedAfter = hashAndMeasureFile(stagedRealFile, stagingDir);
    if (!isDeepStrictEqual(stagedAfter, stagedBefore)) {
      throw new Error("stable staging copy changed during probing");
    }
    const sourceAfter = fs.fstatSync(sourceDescriptor, { bigint: true });
    assertStableIdentity(sourceEvidence.stat, sourceAfter, path.basename(filePath));
    assertPathNamesDescriptor(realFile, sourceDescriptor, path.basename(filePath));
    if (fs.realpathSync(filePath) !== realFile) {
      throw new Error("master pathname changed during probing");
    }
    if (probed.formatBytes !== sourceEvidence.bytes) {
      throw new Error(`ffprobe byte length ${probed.formatBytes} disagrees with actual ${sourceEvidence.bytes}`);
    }
    return { bytes: sourceEvidence.bytes, sha256: sourceEvidence.sha256, ...probed };
  } finally {
    fs.closeSync(sourceDescriptor);
    fs.rmSync(stagingPath, { force: true });
  }
}

export function validateSceneConfig(videoConfig, releaseInventory) {
  const failures = [];
  const bindings = releaseInventory?.masters?.map((master) => ({ ...master })) ?? [];
  if (!isPlainObject(videoConfig)) {
    return { failures: ["scene config must be an object"], bindings };
  }
  if (videoConfig.fps !== EXPECTED_FPS) {
    failures.push(`scene config fps must be exactly ${EXPECTED_FPS}`);
  }
  if (!Array.isArray(videoConfig.scenes)) {
    return { failures: [...failures, "scene config scenes must be an array"], bindings };
  }
  if (videoConfig.scenes.length !== EXPECTED_MASTER_COUNT) {
    failures.push(`scene config must contain exactly ${EXPECTED_MASTER_COUNT} scenes, got ${videoConfig.scenes.length}`);
  }
  for (let index = 0; index < EXPECTED_MASTER_COUNT; index += 1) {
    const scene = videoConfig.scenes[index];
    const frozen = bindings[index];
    if (!scene || !frozen) {
      continue;
    }
    const actualBinding = {
      id: scene.id,
      source: scene.source,
      durationSeconds: scene.durationSeconds,
      filename: `${scene.id}-full-30fps.mp4`
    };
    const frozenBinding = {
      id: frozen.id,
      source: frozen.source,
      durationSeconds: frozen.durationSeconds,
      filename: frozen.filename
    };
    if (!isDeepStrictEqual(actualBinding, frozenBinding)) {
      failures.push(`scene ${index} does not match the frozen ordered release binding for ${frozen.id}`);
    }
  }
  const duration = videoConfig.scenes.reduce(
    (total, scene) => total + (Number.isFinite(scene?.durationSeconds) ? scene.durationSeconds : 0),
    0
  );
  if (duration !== EXPECTED_TOTAL_DURATION_SECONDS) {
    failures.push(`configured runtime must be exactly ${EXPECTED_TOTAL_DURATION_SECONDS} seconds, got ${duration}`);
  }
  return { failures, bindings };
}

export function validateMasterInventory(bindings, diskNames, manifestNames) {
  const expected = new Set(bindings.map((binding) => binding.filename));
  const unexpectedDiskMasters = diskNames
    .filter((name) => FULL_MASTER_PATTERN.test(name) && !expected.has(name))
    .sort();
  const unexpectedManifestMasters = manifestNames
    .filter((name) => FULL_MASTER_PATTERN.test(name) && !expected.has(name))
    .sort();
  return [
    ...unexpectedDiskMasters.map((name) => `${name}: unexpected full master on disk`),
    ...unexpectedManifestMasters.map((name) => `${name}: unexpected full master manifest entry`)
  ];
}

export function validatePinnedSourceEvidence(binding, actual) {
  const failures = [];
  if (actual.bytes !== binding.sourceBytes) {
    failures.push(`${binding.source}: pinned byte length does not match actual source bytes`);
  }
  if (actual.sha256 !== binding.sourceSha256) {
    failures.push(`${binding.source}: pinned SHA-256 does not match actual source SHA-256`);
  }
  return failures;
}

export function validateManifestEvidence(binding, entry, actual) {
  const failures = [];
  if (!isPlainObject(entry)) {
    return [`${binding.filename}: manifest entry is missing or invalid`];
  }
  if (entry.scene !== binding.id) {
    failures.push(`${binding.filename}: manifest scene must be ${binding.id}`);
  }
  if (entry.rendition !== "full") {
    failures.push(`${binding.filename}: manifest rendition must be full`);
  }
  if (entry.source !== binding.source) {
    failures.push(`${binding.filename}: manifest source must be ${binding.source}`);
  }
  if (!Number.isSafeInteger(entry.bytes) || entry.bytes !== actual.bytes) {
    failures.push(`${binding.filename}: manifest bytes do not match actual bytes`);
  }
  if (typeof entry.sha256 !== "string" || !SHA256_PATTERN.test(entry.sha256) || entry.sha256 !== actual.sha256) {
    failures.push(`${binding.filename}: manifest SHA-256 does not match actual SHA-256`);
  }
  if (!Number.isSafeInteger(entry.frameCount) || entry.frameCount !== actual.frameCount) {
    failures.push(`${binding.filename}: manifest frameCount does not match decoded frames`);
  }
  if (!Number.isFinite(entry.fps) || entry.fps !== actual.fps) {
    failures.push(`${binding.filename}: manifest fps does not match decoded fps`);
  }
  if (!Number.isFinite(entry.durationSeconds) || entry.durationSeconds !== actual.durationSeconds) {
    failures.push(`${binding.filename}: manifest duration does not match decoded duration`);
  }
  if (actual.bytes < MIN_MASTER_BYTES) {
    failures.push(`${binding.filename}: full master is smaller than ${MIN_MASTER_BYTES} bytes`);
  }
  if (Math.abs(actual.fps - EXPECTED_FPS) > 0.01 || Math.abs(actual.nominalFps - EXPECTED_FPS) > 0.01) {
    failures.push(`${binding.filename}: decoded fps must be exactly ${EXPECTED_FPS}`);
  }
  if (Math.abs(actual.durationSeconds - binding.durationSeconds) > 1) {
    failures.push(`${binding.filename}: decoded duration differs from configured duration by more than one second`);
  }
  return failures;
}

export function validateVideoRelease({
  repo,
  videoConfig,
  releaseInventory,
  manifest,
  ffprobeSession,
  stagingParent = os.tmpdir(),
  probe = probeVideoFile
}) {
  const failures = [];
  const checked = [];
  const checkedSources = [];
  const config = validateSceneConfig(videoConfig, releaseInventory);
  failures.push(...config.failures);
  if (config.failures.length > 0 || config.bindings.length !== EXPECTED_MASTER_COUNT) {
    return { failures, checked, checkedSources, missingMasters: [], expectedMasters: config.bindings };
  }

  let realRepo;
  let videosDir;
  let scenesDir;
  let diskNames = [];
  try {
    realRepo = fs.realpathSync(repo);
    videosDir = assertAnchoredDirectory(path.join(realRepo, "assets", "videos"), realRepo, "assets/videos");
    scenesDir = assertAnchoredDirectory(path.join(realRepo, "assets", "scenes"), realRepo, "assets/scenes");
    diskNames = fs.readdirSync(videosDir);
  } catch (error) {
    failures.push(`release asset directories are unavailable: ${formatError(error)}`);
    return { failures, checked, checkedSources, missingMasters: [], expectedMasters: config.bindings };
  }

  const manifestAssets = isPlainObject(manifest?.assets) ? manifest.assets : {};
  if (!isPlainObject(manifest) || manifest.version !== 1 || !isPlainObject(manifest.assets)) {
    failures.push("assets/videos/manifest.json must be a version 1 manifest with an assets object");
  }
  failures.push(...validateMasterInventory(config.bindings, diskNames, Object.keys(manifestAssets)));

  const diskNameSet = new Set(diskNames);
  const missingMasters = config.bindings.filter((binding) => !diskNameSet.has(binding.filename));
  for (const binding of missingMasters) {
    failures.push(`${binding.filename}: required full master is missing`);
  }

  const sourceEvidenceByPath = new Map();
  for (const binding of config.bindings) {
    if (sourceEvidenceByPath.has(binding.source)) {
      failures.push(...validatePinnedSourceEvidence(binding, sourceEvidenceByPath.get(binding.source)));
      continue;
    }
    const sourcePath = path.join(realRepo, ...binding.source.split("/"));
    try {
      const actual = hashAndMeasureFile(sourcePath, scenesDir);
      sourceEvidenceByPath.set(binding.source, actual);
      checkedSources.push({ source: binding.source, ...actual });
      failures.push(...validatePinnedSourceEvidence(binding, actual));
    } catch (error) {
      failures.push(`${binding.source}: source evidence failed: ${formatError(error)}`);
    }
  }

  const presentBindings = config.bindings.filter((binding) => diskNameSet.has(binding.filename));
  if (presentBindings.length === 0) {
    return { failures, checked, checkedSources, missingMasters, expectedMasters: config.bindings };
  }

  let stagingDir;
  try {
    const realStagingParent = fs.realpathSync(stagingParent);
    stagingDir = fs.mkdtempSync(path.join(realStagingParent, "radiance-video-validation-"));
    stagingDir = assertAnchoredDirectory(stagingDir, realStagingParent, "video validation staging directory");
  } catch (error) {
    failures.push(`stable video staging could not be created: ${formatError(error)}`);
    return { failures, checked, checkedSources, missingMasters, expectedMasters: config.bindings };
  }

  try {
    for (const binding of presentBindings) {
      const filePath = path.join(videosDir, binding.filename);
      try {
        const actual = inspectMasterFile({ filePath, videosDir, ffprobeSession, stagingDir, probe });
        checked.push({ filename: binding.filename, ...actual });
        failures.push(...validateManifestEvidence(binding, manifestAssets[binding.filename], actual));
      } catch (error) {
        failures.push(`${binding.filename}: release evidence failed: ${formatError(error)}`);
      }
    }
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }

  return { failures, checked, checkedSources, missingMasters, expectedMasters: config.bindings };
}
