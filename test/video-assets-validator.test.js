import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_MASTER_COUNT,
  RELEASE_INVENTORY_SHA256,
  assertAnchoredDirectory,
  createPinnedExecutableSession,
  createPinnedFfprobeSession,
  hashAndMeasureFile,
  inspectMasterFile,
  invokeLockedFfprobe,
  isPathInside,
  parseFrameRate,
  parsePinnedReleaseInventory,
  validateFfprobePinMetadata,
  validateManifestEvidence,
  validateMasterInventory,
  validatePinnedSourceEvidence,
  validateSceneConfig,
  validateVideoRelease,
  verifyPinnedFfprobe
} from "../scripts/lib/video-asset-validation.mjs";

const repo = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const videoConfig = JSON.parse(fs.readFileSync(path.join(repo, "scripts", "video", "scenes.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(repo, "assets", "videos", "manifest.json"), "utf8"));
const pin = JSON.parse(fs.readFileSync(path.join(repo, "scripts", "video", "ffprobe-tool.json"), "utf8"));
const inventoryBytes = fs.readFileSync(path.join(repo, "scripts", "video", "release-inventory.json"));
const releaseInventory = parsePinnedReleaseInventory(inventoryBytes);
const configResult = validateSceneConfig(videoConfig, releaseInventory);
const binding = configResult.bindings.find((item) => item.id === "neon-listening-lounge");
const entry = manifest.assets[binding.filename];
const evidence = {
  bytes: entry.bytes,
  sha256: entry.sha256,
  frameCount: entry.frameCount,
  fps: entry.fps,
  nominalFps: entry.fps,
  durationSeconds: entry.durationSeconds
};

function temporaryDirectory(t, prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return fs.realpathSync(directory);
}

function fakeProbe(_ffprobePath, stagedPath) {
  return {
    fps: 30,
    nominalFps: 30,
    durationSeconds: 1,
    frameCount: 30,
    formatBytes: fs.statSync(stagedPath).size
  };
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function fakeLockedEnvelope({ toolPath, argumentsList, mediaPath = null, stdout = "" }) {
  const toolEvidence = hashAndMeasureFile(toolPath);
  const mediaEvidence = mediaPath ? hashAndMeasureFile(mediaPath) : null;
  return {
    schemaVersion: 1,
    mode: mediaPath ? "probe" : "version",
    argumentsSha256: sha256(Buffer.from(JSON.stringify(argumentsList), "utf8")),
    tool: { before: toolEvidence, after: toolEvidence },
    media: mediaEvidence ? { before: mediaEvidence, after: mediaEvidence } : null,
    status: 0,
    stdout,
    stderr: ""
  };
}

test("frozen inventory bytes bind exactly sixteen ordered masters, 420 seconds, and ten sources", () => {
  assert.equal(hashAndMeasureFile(path.join(repo, "scripts", "video", "release-inventory.json")).sha256, RELEASE_INVENTORY_SHA256);
  assert.equal(releaseInventory.masters.length, EXPECTED_MASTER_COUNT);
  assert.equal(releaseInventory.masters.reduce((sum, item) => sum + item.durationSeconds, 0), 420);
  assert.equal(new Set(releaseInventory.masters.map((item) => item.source)).size, 10);
});

test("frozen inventory rejects any byte-level mutation", () => {
  const changed = Buffer.concat([inventoryBytes, Buffer.from(" ")]);
  assert.throws(() => parsePinnedReleaseInventory(changed), /byte digest mismatch/);
});

test("canonical scene config matches the exact ordered frozen bindings", () => {
  assert.deepEqual(configResult.failures, []);
  assert.equal(configResult.bindings.length, EXPECTED_MASTER_COUNT);
  assert.equal(new Set(configResult.bindings.map((item) => item.filename)).size, EXPECTED_MASTER_COUNT);
});

test("scene inventory rejects fewer than sixteen scenes", () => {
  const changed = structuredClone(videoConfig);
  changed.scenes.pop();
  assert.match(validateSceneConfig(changed, releaseInventory).failures.join("\n"), /exactly 16/);
});

test("scene inventory rejects id substitution even when count and duration remain valid", () => {
  const changed = structuredClone(videoConfig);
  changed.scenes[0].id = "substituted-scene";
  assert.match(validateSceneConfig(changed, releaseInventory).failures.join("\n"), /frozen ordered release binding/);
});

test("scene inventory rejects order substitution", () => {
  const changed = structuredClone(videoConfig);
  [changed.scenes[0], changed.scenes[1]] = [changed.scenes[1], changed.scenes[0]];
  assert.match(validateSceneConfig(changed, releaseInventory).failures.join("\n"), /scene 0.*frozen ordered release binding/);
});

test("scene inventory rejects source substitution", () => {
  const changed = structuredClone(videoConfig);
  changed.scenes[0].source = "assets/scenes/02-chrome-catwalk.png";
  assert.match(validateSceneConfig(changed, releaseInventory).failures.join("\n"), /frozen ordered release binding/);
});

test("scene inventory rejects a changed total duration", () => {
  const changed = structuredClone(videoConfig);
  changed.scenes[0].durationSeconds += 1;
  const failures = validateSceneConfig(changed, releaseInventory).failures.join("\n");
  assert.match(failures, /frozen ordered release binding/);
  assert.match(failures, /exactly 420/);
});

test("inventory rejects substituted full masters on disk and in the manifest", () => {
  const failures = validateMasterInventory(
    configResult.bindings,
    ["substituted-full-30fps.mp4"],
    ["other-full-30fps.mp4"]
  );
  assert.equal(failures.length, 2);
  assert.match(failures.join("\n"), /unexpected full master on disk/);
  assert.match(failures.join("\n"), /unexpected full master manifest entry/);
});

test("Windows cross-drive paths are never treated as contained", () => {
  assert.equal(isPathInside("C:\\cache", "D:\\escape", path.win32), false);
  assert.equal(isPathInside("C:\\cache", "C:\\cache\\child", path.win32), true);
  assert.equal(path.win32.isAbsolute(path.win32.relative("C:\\cache", "D:\\escape")), true);
});

test("anchored directories reject a symlink or junction escape", (t) => {
  const parent = temporaryDirectory(t, "radiance-anchor-parent-");
  const outside = temporaryDirectory(t, "radiance-anchor-outside-");
  const link = path.join(parent, "escaped-scenes");
  try {
    fs.symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
      t.skip(`link creation unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  assert.throws(() => assertAnchoredDirectory(link, parent, "assets/scenes"), /non-symlink directory/);
});

test("pinned source evidence accepts exact bytes and SHA and rejects substitution", () => {
  const actual = { bytes: binding.sourceBytes, sha256: binding.sourceSha256 };
  assert.deepEqual(validatePinnedSourceEvidence(binding, actual), []);
  const failures = validatePinnedSourceEvidence(binding, { bytes: actual.bytes + 1, sha256: "0".repeat(64) });
  assert.match(failures.join("\n"), /byte length/);
  assert.match(failures.join("\n"), /SHA-256/);
});

test("manifest evidence accepts the exact bound recomputed values", () => {
  assert.deepEqual(validateManifestEvidence(binding, entry, evidence), []);
});

test("manifest evidence rejects scene, source, and rendition substitution", () => {
  const changed = { ...entry, scene: "chrome-catwalk", source: "assets/scenes/02.png", rendition: "draft" };
  const failures = validateManifestEvidence(binding, changed, evidence).join("\n");
  assert.match(failures, /manifest scene/);
  assert.match(failures, /manifest source/);
  assert.match(failures, /manifest rendition/);
});

test("manifest evidence rejects tampered hash and byte length", () => {
  const changed = { ...entry, bytes: entry.bytes + 1, sha256: "0".repeat(64) };
  const failures = validateManifestEvidence(binding, changed, evidence).join("\n");
  assert.match(failures, /bytes do not match/);
  assert.match(failures, /SHA-256 does not match/);
});

test("manifest evidence rejects frame, fps, and duration claims", () => {
  const changed = {
    ...entry,
    frameCount: entry.frameCount - 1,
    fps: 29.97,
    durationSeconds: entry.durationSeconds - 0.1
  };
  const failures = validateManifestEvidence(binding, changed, evidence).join("\n");
  assert.match(failures, /frameCount/);
  assert.match(failures, /manifest fps/);
  assert.match(failures, /manifest duration/);
});

test("manifest evidence rejects uppercase or malformed SHA-256", () => {
  const changed = { ...entry, sha256: entry.sha256.toUpperCase() };
  assert.match(validateManifestEvidence(binding, changed, evidence).join("\n"), /SHA-256/);
});

test("frame-rate parser accepts exact rationals and rejects invalid input", () => {
  assert.equal(parseFrameRate("30/1"), 30);
  assert.throws(() => parseFrameRate("30"), /invalid frame-rate rational/);
  assert.throws(() => parseFrameRate("30/0"), /invalid frame-rate rational/);
});

test("streamed file measurement recomputes bytes and SHA-256", () => {
  const measured = hashAndMeasureFile(path.join(repo, "scripts", "video", "ffprobe-tool.json"));
  assert.ok(measured.bytes > 0);
  assert.match(measured.sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(measured.sha256, pin.sha256);
});

test("stable staging detects mutation of the opened master during probing", (t) => {
  const root = temporaryDirectory(t, "radiance-master-mutation-");
  const videosDir = path.join(root, "videos");
  const stagingDir = path.join(root, "staging");
  fs.mkdirSync(videosDir);
  fs.mkdirSync(stagingDir);
  const filePath = path.join(videosDir, "fixture-full-30fps.mp4");
  fs.writeFileSync(filePath, Buffer.alloc(4096, 0x41));
  assert.throws(
    () =>
      inspectMasterFile({
        filePath,
        videosDir,
        ffprobeSession: "unused",
        stagingDir,
        probe: (_unused, stagedPath) => {
          fs.appendFileSync(filePath, Buffer.from("mutation"));
          return fakeProbe(_unused, stagedPath);
        }
      }),
    /changed during validation/
  );
});

test("stable staging detects mutation of the staged probe input", (t) => {
  const root = temporaryDirectory(t, "radiance-stage-mutation-");
  const videosDir = path.join(root, "videos");
  const stagingDir = path.join(root, "staging");
  fs.mkdirSync(videosDir);
  fs.mkdirSync(stagingDir);
  const filePath = path.join(videosDir, "fixture-full-30fps.mp4");
  fs.writeFileSync(filePath, Buffer.alloc(4096, 0x42));
  assert.throws(
    () =>
      inspectMasterFile({
        filePath,
        videosDir,
        ffprobeSession: "unused",
        stagingDir,
        probe: (_unused, stagedPath) => {
          const result = fakeProbe(_unused, stagedPath);
          fs.appendFileSync(stagedPath, Buffer.from("mutation"));
          return result;
        }
      }),
    /staging copy changed during probing/
  );
});

test("ffprobe pin metadata freezes archive URL, size, hash, and executable path", () => {
  assert.equal(validateFfprobePinMetadata(pin), pin);
  const changed = structuredClone(pin);
  changed.archive.sha256 = "0".repeat(64);
  assert.throws(() => validateFfprobePinMetadata(changed), /does not exactly match/);
});

test("original-path swap cannot change the staged executable and fails closed after only staged execution", (t) => {
  const root = temporaryDirectory(t, "radiance-tool-swap-");
  const stagingParent = path.join(root, "staging-parent");
  fs.mkdirSync(stagingParent);
  const executablePath = path.join(root, "fixture-ffprobe.exe");
  const trustedBytes = Buffer.from("trusted-pinned-ffprobe-fixture");
  fs.writeFileSync(executablePath, trustedBytes);
  const expected = { bytes: trustedBytes.length, sha256: sha256(trustedBytes) };
  const invokedPaths = [];
  let privateDirectory;
  let swapped = false;

  assert.throws(
    () =>
      createPinnedExecutableSession({
        executablePath,
        expectedBytes: expected.bytes,
        expectedSha256: expected.sha256,
        expectedVersionLine: "fixture ffprobe 1.0",
        stagingParent,
        lockedInvoker: ({ toolPath, argumentsList, mediaPath }) => {
          invokedPaths.push(toolPath);
          privateDirectory = path.dirname(toolPath);
          assert.notEqual(toolPath, executablePath);
          assert.deepEqual(hashAndMeasureFile(toolPath), expected);
          if (!swapped) {
            const backupPath = path.join(root, "trusted-backup.exe");
            fs.renameSync(executablePath, backupPath);
            fs.writeFileSync(executablePath, Buffer.from("malicious-transient-executable"));
            assert.deepEqual(hashAndMeasureFile(toolPath), expected);
            fs.rmSync(executablePath);
            fs.renameSync(backupPath, executablePath);
            swapped = true;
          }
          return fakeLockedEnvelope({
            toolPath,
            argumentsList,
            mediaPath,
            stdout: "fixture ffprobe 1.0\n"
          });
        }
      }),
    /original pinned executable changed during validation/
  );
  assert.equal(swapped, true);
  assert.equal(invokedPaths.length, 1);
  assert.notEqual(invokedPaths[0], executablePath);
  assert.equal(fs.existsSync(privateDirectory), false);
});

test("pinned executable session detects staged-tool mutation and cleans its private directory", (t) => {
  const root = temporaryDirectory(t, "radiance-tool-stage-mutation-");
  const stagingParent = path.join(root, "staging-parent");
  fs.mkdirSync(stagingParent);
  const executablePath = path.join(root, "fixture-ffprobe.exe");
  const trustedBytes = Buffer.from("trusted-pinned-ffprobe-fixture");
  fs.writeFileSync(executablePath, trustedBytes);
  let invocation = 0;
  let privateDirectory;
  const session = createPinnedExecutableSession({
    executablePath,
    expectedBytes: trustedBytes.length,
    expectedSha256: sha256(trustedBytes),
    expectedVersionLine: "fixture ffprobe 1.0",
    stagingParent,
    lockedInvoker: ({ toolPath, argumentsList, mediaPath }) => {
      invocation += 1;
      privateDirectory = path.dirname(toolPath);
      if (invocation > 1) {
        fs.appendFileSync(toolPath, Buffer.from("mutation"));
      }
      return fakeLockedEnvelope({
        toolPath,
        argumentsList,
        mediaPath,
        stdout: "fixture ffprobe 1.0\n"
      });
    }
  });
  assert.throws(() => session.invoke(["-fixture-probe"]), /staged pinned executable changed during validation/);
  assert.throws(() => session.close(), /staged pinned executable changed during validation/);
  assert.equal(fs.existsSync(privateDirectory), false);
});

test("production locked wrapper holds tool and media FileShare.Read handles across before-and-after hashes", () => {
  const wrapper = fs.readFileSync(path.join(repo, "scripts", "lib", "invoke-locked-ffprobe.ps1"), "utf8");
  assert.match(wrapper, /\[System\.IO\.FileShare\]::Read/g);
  assert.match(wrapper, /\$toolBefore = Get-StreamEvidence/);
  assert.match(wrapper, /\$toolAfter = Get-StreamEvidence/);
  assert.match(wrapper, /\$mediaBefore = Get-StreamEvidence/);
  assert.match(wrapper, /\$mediaAfter = if/);
  const launchIndex = wrapper.indexOf("$stdoutLines = @(& $toolFullPath");
  const toolGateIndex = wrapper.indexOf("$toolBefore.bytes -ne $ExpectedToolBytes");
  const mediaGateIndex = wrapper.indexOf("$mediaBefore.bytes -ne $ExpectedMediaBytes");
  assert.ok(launchIndex >= 0);
  assert.ok(toolGateIndex >= 0);
  assert.ok(mediaGateIndex >= 0);
  assert.ok(toolGateIndex < launchIndex);
  assert.ok(mediaGateIndex < launchIndex);
});

test(
  "locked wrapper rejects substituted tool and media evidence before the child can execute",
  { skip: process.platform !== "win32" },
  (t) => {
    const root = temporaryDirectory(t, "radiance-pre-exec-gate-");
    const markerPath = path.join(root, "child-executed.txt");
    const toolPath = path.join(root, "fixture-tool.ps1");
    const mediaPath = path.join(root, "fixture-media.mp4");
    const toolBytes = Buffer.from(
      "[System.IO.File]::WriteAllText($env:RADIANCE_TEST_EXECUTION_MARKER, 'executed')\nWrite-Output 'fixture'\n"
    );
    const mediaBytes = Buffer.from("substituted-media-bytes");
    fs.writeFileSync(toolPath, toolBytes);
    fs.writeFileSync(mediaPath, mediaBytes);
    const previousMarker = process.env.RADIANCE_TEST_EXECUTION_MARKER;
    process.env.RADIANCE_TEST_EXECUTION_MARKER = markerPath;
    t.after(() => {
      if (previousMarker === undefined) {
        delete process.env.RADIANCE_TEST_EXECUTION_MARKER;
      } else {
        process.env.RADIANCE_TEST_EXECUTION_MARKER = previousMarker;
      }
    });

    assert.throws(
      () =>
        invokeLockedFfprobe({
          toolPath,
          argumentsList: ["-version"],
          mediaPath: null,
          timeoutMs: 15_000,
          expectedToolEvidence: { bytes: toolBytes.length, sha256: "0".repeat(64) },
          expectedMediaEvidence: null
        }),
      /does not match the exact pin before invocation/
    );
    assert.equal(fs.existsSync(markerPath), false);

    assert.throws(
      () =>
        invokeLockedFfprobe({
          toolPath,
          argumentsList: ["-probe"],
          mediaPath,
          timeoutMs: 15_000,
          expectedToolEvidence: { bytes: toolBytes.length, sha256: sha256(toolBytes) },
          expectedMediaEvidence: { bytes: mediaBytes.length, sha256: "0".repeat(64) }
        }),
      /does not match the staged input before invocation/
    );
    assert.equal(fs.existsSync(markerPath), false);
  }
);

test("pinned tool rejects the current runtime or a substituted executable", () => {
  if (`${process.platform}-${process.arch}` !== pin.platform) {
    assert.throws(() => verifyPinnedFfprobe(process.execPath, pin), /pin is for win32-x64/);
  } else {
    assert.throws(
      () => verifyPinnedFfprobe(process.execPath, pin),
      /original pinned executable evidence does not match/
    );
  }
});

test(
  "canonical repository remains an exact fourteen-master HOLD with actual decoded evidence",
  { skip: !process.env.RADIANCE_FFPROBE_PATH },
  () => {
    const ffprobePath = process.env.RADIANCE_FFPROBE_PATH;
    const ffprobeSession = createPinnedFfprobeSession(ffprobePath, pin);
    let result;
    try {
      result = validateVideoRelease({ repo, videoConfig, releaseInventory, manifest, ffprobeSession });
    } finally {
      ffprobeSession.close();
    }
    assert.equal(result.expectedMasters.length, 16);
    assert.equal(result.missingMasters.length, 14);
    assert.equal(result.checkedSources.length, 10);
    assert.equal(result.checked.length, 2);
    assert.equal(result.failures.length, 14);
    assert.ok(result.failures.every((failure) => failure.endsWith("required full master is missing")));
  }
);
