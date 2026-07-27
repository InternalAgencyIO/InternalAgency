#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const handoffPath = process.argv[2] ?? "launch/mainnet-handoff.template.json";
const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
};
const isDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const normalizedRoleLabel = (value) => typeof value === "string" ? value.trim().toLocaleLowerCase("en-US") : "";
const isUsableRoleLabel = (value) => normalizedRoleLabel(value).length >= 2
  && !/\b(pending|todo|tbd|example|placeholder|unassigned|none)\b/i.test(value);
const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const sha256Text = (value) => createHash("sha256").update(value).digest("hex");
const snapshotMaxAgeMs = 30 * 60 * 1000;
const snapshotMaxFutureSkewMs = 60 * 1000;
const requiredPaths = {
  manifestPath: "launch/genesis-manifest.template.json",
  signingChecklistPath: "launch/genesis-signing-checklist.template.json",
  devnetRehearsalPath: "launch/devnet-rehearsal.template.json",
};
const releaseSnapshotPaths = [
  ...Object.values(requiredPaths),
  "launch/mainnet-handoff.template.json",
  "launch/release-packet.template.json",
  "launch/PUBLICATION_PAYLOAD.template.md",
];
const digestRecord = (record) => sha256Text(Object.entries(record).map(([path, digest]) => `${path}:${digest}`).join("\n"));
const recordMatchesPaths = (record, paths, label) => {
  for (const path of paths) {
    if (!isDigest(record?.[path])) {
      fail(`${label} requires a digest for ${path}`);
    } else if (record[path].toLowerCase() !== sha256File(path)) {
      fail(`${label} digest does not match ${path}`);
    }
  }
  for (const path of Object.keys(record ?? {})) {
    if (!paths.includes(path)) fail(`${label} must not include an unrecognized path: ${path}`);
  }
};
const recordHasDigestInventory = (record, paths, label) => {
  for (const path of paths) {
    if (!isDigest(record?.[path])) fail(`${label} requires a digest for ${path}`);
  }
  for (const path of Object.keys(record ?? {})) {
    if (!paths.includes(path)) fail(`${label} must not include an unrecognized path: ${path}`);
  }
};

if (!['HOLD', 'APPROVED'].includes(handoff.status)) fail("status must be HOLD or APPROVED");
if (handoff.handoffVersion !== 1) fail("handoffVersion must be 1");
if (handoff.network !== "mainnet-beta") fail("network must be mainnet-beta"); else ok("mainnet-beta selected");
if (handoff.handoffScope !== "Genesis approval handoff only; this file never authorizes a transaction or publication.") fail("handoffScope must retain the non-authorizing boundary");
for (const [field, expected] of Object.entries(requiredPaths)) {
  if (handoff.sourceArtifacts?.[field] !== expected) fail(`${field} must point to the canonical artifact`);
  else ok(`${field} points to canonical artifact`);
}
for (const field of ["noSecretsInHandoff", "noTransactionAuthorityGranted", "noPublicationBeforeEvidence", "returnToHoldOnAnyMismatch"]) {
  if (handoff.holdControls?.[field] !== true) fail(`holdControls.${field} must be true`);
}

if (handoff.status === "APPROVED") {
  const manifest = JSON.parse(readFileSync(handoff.sourceArtifacts.manifestPath, "utf8"));
  const checklist = JSON.parse(readFileSync(handoff.sourceArtifacts.signingChecklistPath, "utf8"));
  const rehearsal = JSON.parse(readFileSync(handoff.sourceArtifacts.devnetRehearsalPath, "utf8"));
  if (manifest.status !== "HOLD") fail("APPROVED requires the mainnet manifest to remain HOLD before evidence exists");
  else ok("manifest remains HOLD before signing");
  if (checklist.status !== "READY") fail("APPROVED requires a READY signer checklist"); else ok("signer checklist is READY");
  if (rehearsal.status !== "COMPLETED") fail("APPROVED requires a COMPLETED devnet rehearsal"); else ok("devnet rehearsal is COMPLETED");
  const readinessTimestamp = checklist.ceremonyControls?.readyAtUtc;
  const rehearsalTimestamp = rehearsal.verifier?.completedAtUtc;
  for (const [label, value] of [
    ["signer checklist readyAtUtc", readinessTimestamp],
    ["devnet rehearsal completedAtUtc", rehearsalTimestamp],
  ]) {
    if (!isUtcTimestamp(value)) fail(`APPROVED requires a canonical ISO-8601 UTC ${label} ending in Z`);
  }
  for (const field of ["releaseOwnerLabel", "independentVerifierLabel"]) {
    if (!isUsableRoleLabel(handoff.approval?.[field])) fail(`APPROVED requires a non-placeholder approval.${field}`);
  }
  if (normalizedRoleLabel(handoff.approval?.releaseOwnerLabel) === normalizedRoleLabel(handoff.approval?.independentVerifierLabel)) {
    fail("APPROVED requires separate release owner and independent verifier labels");
  }
  for (const field of ["manifestDigest", "destinationDigest"]) {
    if (!isDigest(handoff.approval?.[field])) fail(`APPROVED requires a 64-character hexadecimal approval.${field}`);
  }
  const expectedArtifactDigests = {
    manifestSha256: handoff.sourceArtifacts.manifestPath,
    signingChecklistSha256: handoff.sourceArtifacts.signingChecklistPath,
    devnetRehearsalSha256: handoff.sourceArtifacts.devnetRehearsalPath,
  };
  for (const [field, path] of Object.entries(expectedArtifactDigests)) {
    if (!isDigest(handoff.approval?.[field])) {
      fail(`APPROVED requires approval.${field}`);
      continue;
    }
    if (handoff.approval[field].toLowerCase() !== sha256File(path)) fail(`approval.${field} does not match ${path}`);
    else ok(`approval.${field} matches ${path}`);
  }
  if (handoff.approval.manifestDigest.toLowerCase() !== handoff.approval.manifestSha256.toLowerCase()) {
    fail("approval.manifestDigest must match the canonical manifest digest");
  } else {
    ok("approval.manifestDigest matches the canonical manifest digest");
  }
  const snapshotPath = "launch/release-snapshot.generated.json";
  if (handoff.approval?.releaseSnapshotPath !== snapshotPath) {
    fail(`APPROVED requires approval.releaseSnapshotPath to be ${snapshotPath}`);
  } else if (!isDigest(handoff.approval?.releaseSnapshotDigest)) {
    fail("APPROVED requires a 64-character hexadecimal approval.releaseSnapshotDigest");
  } else {
    try {
      const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
      const snapshotArtifacts = snapshot.preApprovalArtifacts;
      const expectedSnapshotDigest = digestRecord(snapshotArtifacts ?? {});
      if (snapshot.status !== "HOLD" || snapshot.version !== 1) fail("approval snapshot must be a version 1 HOLD record");
      if (!isUtcTimestamp(snapshot.generatedAtUtc)) {
        fail("approval snapshot requires a canonical ISO-8601 UTC generatedAtUtc timestamp ending in Z");
      } else {
        const snapshotAgeMs = Date.now() - Date.parse(snapshot.generatedAtUtc);
        if (snapshotAgeMs < -snapshotMaxFutureSkewMs) fail("approval snapshot cannot be more than one minute in the future");
        else if (snapshotAgeMs > snapshotMaxAgeMs) fail("approval snapshot is older than 30 minutes; regenerate it before approval");
        if (isUtcTimestamp(handoff.approval?.approvedAtUtc)
          && Date.parse(snapshot.generatedAtUtc) > Date.parse(handoff.approval.approvedAtUtc)) {
          fail("approval snapshot must be generated at or before approval.approvedAtUtc; regenerate it before independent review");
        }
        for (const [label, value] of [
          ["signer checklist readyAtUtc", readinessTimestamp],
          ["devnet rehearsal completedAtUtc", rehearsalTimestamp],
        ]) {
          if (isUtcTimestamp(value) && Date.parse(value) > Date.parse(snapshot.generatedAtUtc)) {
            fail(`${label} must be at or before the approval snapshot; regenerate the snapshot after every gate completes`);
          }
          if (isUtcTimestamp(value) && isUtcTimestamp(handoff.approval?.approvedAtUtc)
            && Date.parse(value) > Date.parse(handoff.approval.approvedAtUtc)) {
            fail(`${label} must be at or before approval.approvedAtUtc`);
          }
        }
      }
      recordMatchesPaths(snapshot.preApprovalArtifacts, Object.values(requiredPaths), "approval snapshot pre-approval artifacts");
      // This wider inventory is historical: approval mutates the handoff after
      // the HOLD snapshot. It must remain complete and self-consistent without
      // creating a circular requirement to match the current handoff file.
      recordHasDigestInventory(snapshot.artifacts, releaseSnapshotPaths, "approval snapshot artifacts");
      for (const path of Object.values(requiredPaths)) {
        if (snapshot.artifacts?.[path]?.toLowerCase() !== snapshot.preApprovalArtifacts?.[path]?.toLowerCase()) {
          fail(`approval snapshot pre-approval digest must match the full artifact inventory for ${path}`);
        }
      }
      if (snapshot.preApprovalPacketDigest?.toLowerCase() !== expectedSnapshotDigest) fail("approval snapshot pre-approval digest is invalid");
      if (handoff.approval.releaseSnapshotDigest.toLowerCase() !== expectedSnapshotDigest) fail("approval.releaseSnapshotDigest does not match the current pre-approval snapshot");
      if (snapshot.packetDigest?.toLowerCase() !== digestRecord(snapshot.artifacts ?? {})) fail("approval snapshot packet digest is invalid");
      for (const [field, path] of Object.entries(expectedArtifactDigests)) {
        const snapshotPathForField = requiredPaths[field.replace("Sha256", "Path")];
        if (snapshotArtifacts?.[snapshotPathForField]?.toLowerCase() !== handoff.approval[field].toLowerCase()) {
          fail(`approval snapshot does not match approval.${field}`);
        }
      }
      if (!process.exitCode) ok("approval snapshot binds the current manifest, signer checklist, and rehearsal digests");
    } catch {
      fail("APPROVED requires a readable current release snapshot");
    }
  }
  const expectedDestinationDigest = sha256Text(JSON.stringify({
    handoffVersion: 1,
    network: handoff.network,
    artifactDigests: Object.fromEntries(Object.keys(expectedArtifactDigests).map((field) => [field, handoff.approval?.[field]?.toLowerCase() ?? null])),
  }));
  if (handoff.approval.destinationDigest.toLowerCase() !== expectedDestinationDigest) {
    fail("approval.destinationDigest must bind the ordered mainnet handoff artifact digest set");
  } else {
    ok("approval.destinationDigest binds the ordered mainnet handoff artifact digest set");
  }
  if (!isUtcTimestamp(handoff.approval?.approvedAtUtc)) {
    fail("APPROVED requires a canonical ISO-8601 UTC approvedAtUtc timestamp ending in Z");
  } else {
    const approvalAgeMs = Date.now() - Date.parse(handoff.approval.approvedAtUtc);
    if (approvalAgeMs < -snapshotMaxFutureSkewMs) {
      fail("APPROVED approval cannot be more than one minute in the future");
    } else if (approvalAgeMs > snapshotMaxAgeMs) {
      fail("APPROVED approval is older than 30 minutes; return to HOLD and repeat independent review");
    } else {
      ok("APPROVED timestamp is fresh for the handoff window");
    }
  }
  if (!isUsableRoleLabel(handoff.holdControls?.correctionOwnerLabel)) {
    fail("APPROVED requires a non-placeholder correction owner label");
  } else if ([handoff.approval?.releaseOwnerLabel, handoff.approval?.independentVerifierLabel]
    .map(normalizedRoleLabel).includes(normalizedRoleLabel(handoff.holdControls.correctionOwnerLabel))) {
    fail("APPROVED requires a correction owner separate from the release owner and independent verifier");
  }
}

if (process.exitCode) console.error("\nMainnet handoff does not clear the Genesis gate.");
else console.log("\nMainnet handoff structure passes. It never creates keys, signs, submits transactions, or establishes on-chain truth.");
