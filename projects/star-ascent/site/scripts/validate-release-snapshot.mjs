#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const canonicalSnapshotPath = "launch/release-snapshot.generated.json";
const snapshotPath = process.argv[2] ?? canonicalSnapshotPath;
const validationScope = process.argv[3] ?? "full";
if (!['full', 'pre-approval'].includes(validationScope) || process.argv.length > 4) {
  console.error("FAIL: snapshot validation scope must be full or pre-approval");
  process.exit(1);
}
const files = [
  "launch/genesis-manifest.template.json",
  "launch/genesis-signing-checklist.template.json",
  "launch/devnet-rehearsal.template.json",
  "launch/mainnet-handoff.template.json",
  "launch/release-packet.template.json",
  "launch/PUBLICATION_PAYLOAD.template.md",
];
const preApprovalFiles = files.slice(0, 3);
const maxSnapshotAgeMs = 30 * 60 * 1000;
const maxFutureSkewMs = 60 * 1000;
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const digestMap = (paths) => Object.fromEntries(paths.map((path) => [path, sha256(readFileSync(path))]));
const digestRecord = (record) => sha256(Object.entries(record).map(([path, digest]) => `${path}:${digest}`).join("\n"));
const isDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const isCanonicalDigest = (value) => isDigest(value) && value === value.toLowerCase();
const hasExactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const hasCanonicalKeyOrder = (value, keys) => value && Object.keys(value).every((key, index) => key === keys[index]);
const snapshotFields = ["version", "status", "generatedAtUtc", "packetDigest", "artifacts", "preApprovalPacketDigest", "preApprovalArtifacts"];
const canonicalDependencyValidators = [
  ["manifest", "launch/genesis-manifest.template.json", "./validate-genesis-manifest.mjs"],
  ["signer checklist", "launch/genesis-signing-checklist.template.json", "./validate-genesis-signing-checklist.mjs"],
  ["devnet rehearsal", "launch/devnet-rehearsal.template.json", "./validate-devnet-rehearsal.mjs"],
  ["mainnet handoff", "launch/mainnet-handoff.template.json", "./validate-mainnet-handoff.mjs"],
  ["release packet", "launch/release-packet.template.json", "./validate-release-packet.mjs"],
  ["publication payload", "launch/PUBLICATION_PAYLOAD.template.md", "./validate-publication-payload.mjs"],
];
const preApprovalDependencyValidators = canonicalDependencyValidators.slice(0, 3);
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
};
const validateFreshness = (value) => {
  const ageMs = Date.now() - Date.parse(value);
  if (ageMs < -maxFutureSkewMs) {
    fail("snapshot generatedAtUtc cannot be more than one minute in the future");
  } else if (ageMs > maxSnapshotAgeMs) {
    fail("snapshot is older than 30 minutes; regenerate it immediately before the handoff");
  } else {
    ok("snapshot timestamp is fresh for the handoff window");
  }
};

let snapshot;
// This is a launch handoff gate, not a generic snapshot parser. A clean
// sidecar snapshot cannot attest to the canonical release record, and must
// not be read as a fallback.
if (snapshotPath !== canonicalSnapshotPath) {
  fail(`snapshot path must be ${canonicalSnapshotPath}`);
} else {
  try {
    snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  } catch {
    fail(`snapshot must be readable JSON: ${snapshotPath}`);
  }
}

if (snapshot) {
  // A release snapshot is a review artifact, not merely a checksum envelope.
  // Re-run the canonical gates so a syntactically fresh inventory cannot attest
  // to an invalid manifest, signer review, or devnet rehearsal.
  // A frozen HOLD snapshot attests to the three immutable inputs that precede
  // approval. During an APPROVED handoff, revalidating the mutable handoff and
  // packet from here would re-enter this snapshot gate through their normal
  // dependency checks. The scoped call preserves the causal boundary without
  // creating a recursive validator tree.
  const dependencyValidators = validationScope === "pre-approval"
    ? preApprovalDependencyValidators
    : canonicalDependencyValidators;
  for (const [label, artifactPath, relativeValidatorPath] of dependencyValidators) {
    const validatorPath = fileURLToPath(new URL(relativeValidatorPath, import.meta.url));
    const validation = spawnSync(process.execPath, [validatorPath, artifactPath], { encoding: "utf8" });
    if (validation.error || validation.status !== 0) {
      fail(`snapshot requires the canonical ${label} validator to pass before any snapshot state is accepted`);
    } else {
      ok(`canonical ${label} validator passes before snapshot review`);
    }
  }
  if (!hasExactKeys(snapshot, snapshotFields)) fail("snapshot must contain only its canonical reviewed fields");
  else ok("snapshot contains only canonical reviewed fields");
  if (snapshot.version !== 1) fail("snapshot version must be 1");
  if (snapshot.status !== "HOLD") fail("snapshot status must remain HOLD");
  if (!isUtcTimestamp(snapshot.generatedAtUtc)) fail("snapshot requires a canonical ISO-8601 UTC generatedAtUtc timestamp ending in Z");
  else validateFreshness(snapshot.generatedAtUtc);

  const expectedPreApprovalArtifacts = digestMap(preApprovalFiles);
  const expectedCurrentArtifacts = validationScope === "full"
    ? digestMap(files)
    : expectedPreApprovalArtifacts;
  // Full validation proves that every operator still has the exact snapshotted
  // packet. The scoped handoff check compares only the three inputs that must
  // remain immutable while the handoff, packet, and payload advance.
  for (const path of files) {
    if (!isCanonicalDigest(snapshot.artifacts?.[path])) fail(`snapshot artifacts requires a lowercase SHA-256 digest for ${path}`);
  }
  for (const [path, digest] of Object.entries(expectedCurrentArtifacts)) {
    if (snapshot.artifacts?.[path] !== digest) {
      fail(`snapshot artifact digest does not match ${path}`);
    } else {
      ok(`snapshot artifact digest matches ${path}`);
    }
  }
  for (const path of Object.keys(snapshot.artifacts ?? {})) {
    if (!files.includes(path)) fail(`snapshot artifacts must not include an unrecognized path: ${path}`);
  }
  if (!hasCanonicalKeyOrder(snapshot.artifacts, files)) {
    fail("snapshot artifacts must retain the canonical artifact order used for packetDigest");
  } else {
    ok("snapshot artifact inventory retains canonical packet-digest order");
  }
  for (const [path, digest] of Object.entries(expectedPreApprovalArtifacts)) {
    if (!isCanonicalDigest(snapshot.preApprovalArtifacts?.[path])) fail(`snapshot pre-approval artifacts requires a lowercase SHA-256 digest for ${path}`);
    else if (snapshot.preApprovalArtifacts[path].toLowerCase() !== digest) fail(`snapshot pre-approval digest does not match ${path}`);
    else if (snapshot.artifacts?.[path]?.toLowerCase() !== snapshot.preApprovalArtifacts[path].toLowerCase()) {
      fail(`snapshot pre-approval digest must match the full artifact inventory for ${path}`);
    }
  }
  for (const path of Object.keys(snapshot.preApprovalArtifacts ?? {})) {
    if (!preApprovalFiles.includes(path)) fail(`snapshot pre-approval artifacts must not include an unrecognized path: ${path}`);
  }
  if (!hasCanonicalKeyOrder(snapshot.preApprovalArtifacts, preApprovalFiles)) {
    fail("snapshot pre-approval artifacts must retain the canonical packet-digest order");
  } else {
    ok("snapshot pre-approval inventory retains canonical packet-digest order");
  }

  const expectedPacketDigest = digestRecord(snapshot.artifacts ?? {});
  const expectedPreApprovalPacketDigest = digestRecord(expectedPreApprovalArtifacts);
  if (!isCanonicalDigest(snapshot.packetDigest) || snapshot.packetDigest !== expectedPacketDigest) fail("snapshot packetDigest does not match the canonical artifact set");
  else ok("snapshot packet digest matches the canonical artifact set");
  if (!isCanonicalDigest(snapshot.preApprovalPacketDigest) || snapshot.preApprovalPacketDigest !== expectedPreApprovalPacketDigest) fail("snapshot preApprovalPacketDigest does not match the canonical pre-approval set");
  else ok("snapshot pre-approval packet digest matches the canonical artifact set");
}

if (process.exitCode) console.error("\nRelease snapshot remains HOLD; regenerate it after correcting any mismatch.");
else console.log("\nRelease snapshot is internally consistent. It never authorizes a transaction, publication, or launch claim.");
