#!/usr/bin/env node

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(".");
const sandboxRoot = mkdtempSync(join(tmpdir(), "star-ascent-mainnet-handoff-"));
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const encodeBase58 = (bytes) => {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = base58Alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  return encoded;
};
const credentialShapedKeypair = (seed) => encodeBase58(Buffer.alloc(64, seed));

try {
  cpSync(join(repositoryRoot, "launch"), join(sandboxRoot, "launch"), { recursive: true });
  cpSync(join(repositoryRoot, "scripts"), join(sandboxRoot, "scripts"), { recursive: true });
  cpSync(join(repositoryRoot, "public"), join(sandboxRoot, "public"), { recursive: true });
  symlinkSync(join(repositoryRoot, "node_modules"), join(sandboxRoot, "node_modules"), "junction");

  const handoffPath = join(sandboxRoot, "launch", "mainnet-handoff.template.json");
  const canonicalHandoff = JSON.parse(readFileSync(handoffPath, "utf8"));
  const runValidator = () => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-mainnet-handoff.mjs")], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const runValidatorAt = (path) => spawnSync(process.execPath, [join(sandboxRoot, "scripts", "validate-mainnet-handoff.mjs"), path], {
    cwd: sandboxRoot,
    encoding: "utf8",
  });
  const writeHandoff = (fixture) => writeFileSync(handoffPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  const assertValid = (label) => {
    writeHandoff(canonicalHandoff);
    const result = runValidator();
    if (result.error || result.status !== 0) fail(`mainnet handoff validator rejected ${label}`);
    else console.log(`OK: mainnet handoff validator accepts ${label}`);
  };
  const assertRejected = (label, mutate, expectedMessage) => {
    const fixture = JSON.parse(JSON.stringify(canonicalHandoff));
    mutate(fixture);
    writeHandoff(fixture);
    const result = runValidator();
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.error || result.status === 0) fail(`mainnet handoff validator accepted ${label}`);
    else if (!output.includes(expectedMessage)) fail(`mainnet handoff validator did not report ${label}`);
    else console.log(`OK: mainnet handoff validator rejects ${label}`);
  };

  assertValid("the canonical HOLD handoff");
  const substitutedHandoffPath = join(sandboxRoot, "launch", "substituted-mainnet-handoff.json");
  writeFileSync(substitutedHandoffPath, "this is not a handoff record\n", "utf8");
  const substitutedPathValidation = runValidatorAt("launch/substituted-mainnet-handoff.json");
  const substitutedPathOutput = `${substitutedPathValidation.stdout}\n${substitutedPathValidation.stderr}`;
  if (substitutedPathValidation.error || substitutedPathValidation.status === 0) {
    fail("mainnet handoff validator accepted or parsed a substituted handoff path");
  } else if (!substitutedPathOutput.includes("handoff path must be launch/mainnet-handoff.template.json")) {
    fail("mainnet handoff validator did not report a substituted handoff path");
  } else {
    console.log("OK: mainnet handoff validator rejects a substituted handoff path");
  }
  assertRejected(
    "a HOLD handoff that grants transaction authority",
    (fixture) => { fixture.holdControls.noTransactionAuthorityGranted = false; },
    "holdControls.noTransactionAuthorityGranted must be true",
  );
  // A status-only reset is unsafe: every reviewed identity and digest must be
  // cleared, including the snapshot digest that could otherwise look reusable.
  for (const [field, staleValue] of Object.entries({
    releaseOwnerLabel: "Previous release owner",
    independentVerifierLabel: "Previous independent verifier",
    manifestDigest: "a".repeat(64),
    destinationDigest: "a".repeat(64),
    releaseSnapshotDigest: "a".repeat(64),
    manifestSha256: "a".repeat(64),
    signingChecklistSha256: "a".repeat(64),
    devnetRehearsalSha256: "a".repeat(64),
    approvedAtUtc: "2026-07-28T18:00:00.000Z",
  })) {
    assertRejected(
      `a HOLD handoff retaining stale approval.${field}`,
      (fixture) => { fixture.approval[field] = staleValue; },
      `HOLD requires approval.${field} to be null`,
    );
  }
  assertRejected(
    "a HOLD handoff with a stale correction owner",
    (fixture) => { fixture.holdControls.correctionOwnerLabel = "Release corrections"; },
    "HOLD requires holdControls.correctionOwnerLabel to be null",
  );
  assertRejected(
    "a non-canonical manifest source path",
    (fixture) => { fixture.sourceArtifacts.manifestPath = "launch/review-copy.json"; },
    "manifestPath must point to the canonical artifact",
  );
  // Even an APPROVED candidate with a malformed substituted source must fail
  // on the canonical-path binding, not parse the substitute while collecting
  // the other approval failures.
  const malformedManifestPath = join(sandboxRoot, "launch", "malformed-manifest.json");
  writeFileSync(malformedManifestPath, "this is not JSON\n", "utf8");
  const malformedSourceFixture = JSON.parse(JSON.stringify(canonicalHandoff));
  malformedSourceFixture.status = "APPROVED";
  malformedSourceFixture.sourceArtifacts.manifestPath = "launch/malformed-manifest.json";
  writeHandoff(malformedSourceFixture);
  const malformedSourceValidation = runValidator();
  const malformedSourceOutput = `${malformedSourceValidation.stdout}\n${malformedSourceValidation.stderr}`;
  if (malformedSourceValidation.error || malformedSourceValidation.status === 0) {
    fail("mainnet handoff validator accepted an APPROVED candidate with a substituted malformed source");
  } else if (!malformedSourceOutput.includes("manifestPath must point to the canonical artifact")) {
    fail("mainnet handoff validator did not report an APPROVED substituted source path");
  } else if (malformedSourceOutput.includes("SyntaxError")) {
    fail("mainnet handoff validator parsed an APPROVED substituted malformed source");
  } else {
    console.log("OK: mainnet handoff validator never parses an APPROVED substituted malformed source");
  }
  assertRejected(
    "a HOLD handoff with a substituted release-snapshot path",
    (fixture) => { fixture.approval.releaseSnapshotPath = "launch/previous-release-snapshot.json"; },
    "approval.releaseSnapshotPath must be launch/release-snapshot.generated.json",
  );
  assertRejected(
    "a mnemonic-shaped accountability label",
    (fixture) => { fixture.approval.releaseOwnerLabel = "amber bridge candle drift ember forest galaxy harbor island jungle kindle lantern"; },
    "credential-bearing value at handoff.approval.releaseOwnerLabel",
  );
  for (const [index, path] of [
    "approval.releaseOwnerLabel",
    "approval.independentVerifierLabel",
    "holdControls.correctionOwnerLabel",
  ].entries()) {
    assertRejected(
      `64-byte Base58 credential-shaped material at ${path}`,
      (fixture) => {
        const [section, field] = path.split(".");
        fixture[section][field] = credentialShapedKeypair(index + 9);
      },
      `credential-bearing value at handoff.${path}`,
    );
  }
  assertRejected(
    "an unreviewed extra handoff assertion",
    (fixture) => { fixture.emergencyOverride = "not allowed"; },
    "handoff must contain only its canonical fields",
  );
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true });
}

if (process.exitCode) console.error("\nMainnet handoff regression failed.");
else console.log("\nMainnet handoff regression passes.");
