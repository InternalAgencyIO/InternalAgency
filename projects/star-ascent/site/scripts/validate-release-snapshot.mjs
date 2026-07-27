#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const snapshotPath = process.argv[2] ?? "launch/release-snapshot.generated.json";
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
try {
  snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
} catch {
  fail(`snapshot must be readable JSON: ${snapshotPath}`);
}

if (snapshot) {
  if (snapshot.version !== 1) fail("snapshot version must be 1");
  if (snapshot.status !== "HOLD") fail("snapshot status must remain HOLD");
  if (!isUtcTimestamp(snapshot.generatedAtUtc)) fail("snapshot requires a canonical ISO-8601 UTC generatedAtUtc timestamp ending in Z");
  else validateFreshness(snapshot.generatedAtUtc);

  const expectedPreApprovalArtifacts = digestMap(preApprovalFiles);
  // The full packet is a point-in-time record. The handoff and release packet
  // legitimately change after this HOLD snapshot is created, so only the three
  // pre-approval artifacts may be compared to current files.
  for (const path of files) {
    if (!isDigest(snapshot.artifacts?.[path])) fail(`snapshot artifacts requires a digest for ${path}`);
  }
  for (const path of Object.keys(snapshot.artifacts ?? {})) {
    if (!files.includes(path)) fail(`snapshot artifacts must not include an unrecognized path: ${path}`);
  }
  for (const [path, digest] of Object.entries(expectedPreApprovalArtifacts)) {
    if (!isDigest(snapshot.preApprovalArtifacts?.[path])) fail(`snapshot pre-approval artifacts requires a digest for ${path}`);
    else if (snapshot.preApprovalArtifacts[path].toLowerCase() !== digest) fail(`snapshot pre-approval digest does not match ${path}`);
    else if (snapshot.artifacts?.[path]?.toLowerCase() !== snapshot.preApprovalArtifacts[path].toLowerCase()) {
      fail(`snapshot pre-approval digest must match the full artifact inventory for ${path}`);
    }
  }
  for (const path of Object.keys(snapshot.preApprovalArtifacts ?? {})) {
    if (!preApprovalFiles.includes(path)) fail(`snapshot pre-approval artifacts must not include an unrecognized path: ${path}`);
  }

  const expectedPacketDigest = digestRecord(snapshot.artifacts ?? {});
  const expectedPreApprovalPacketDigest = digestRecord(expectedPreApprovalArtifacts);
  if (!isDigest(snapshot.packetDigest) || snapshot.packetDigest.toLowerCase() !== expectedPacketDigest) fail("snapshot packetDigest does not match the canonical artifact set");
  else ok("snapshot packet digest matches the canonical artifact set");
  if (!isDigest(snapshot.preApprovalPacketDigest) || snapshot.preApprovalPacketDigest.toLowerCase() !== expectedPreApprovalPacketDigest) fail("snapshot preApprovalPacketDigest does not match the canonical pre-approval set");
  else ok("snapshot pre-approval packet digest matches the canonical artifact set");
}

if (process.exitCode) console.error("\nRelease snapshot remains HOLD; regenerate it after correcting any mismatch.");
else console.log("\nRelease snapshot is internally consistent. It never authorizes a transaction, publication, or launch claim.");
