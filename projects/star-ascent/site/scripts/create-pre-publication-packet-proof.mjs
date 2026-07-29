#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const releasePacketPath = "launch/release-packet.template.json";
const releaseSnapshotPath = "launch/release-snapshot.generated.json";
const outputPath = "launch/pre-publication-packet-proof.generated.json";
const temporaryPath = `${outputPath}.tmp`;
const artifactPaths = {
  manifestSha256: "launch/genesis-manifest.template.json",
  publicationPayloadSha256: "launch/PUBLICATION_PAYLOAD.template.md",
  signingChecklistSha256: "launch/genesis-signing-checklist.template.json",
  devnetRehearsalSha256: "launch/devnet-rehearsal.template.json",
  mainnetHandoffSha256: "launch/mainnet-handoff.template.json",
};
const observedPaths = [
  releasePacketPath,
  ...Object.values(artifactPaths),
  releaseSnapshotPath,
];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const isCanonicalDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
};
const hasExactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const readObservedBundle = () => Object.fromEntries(
  observedPaths.map((path) => [path, readFileSync(path)]),
);
const sameObservedBundle = (left, right) => observedPaths.every(
  (path) => Buffer.compare(left[path], right[path]) === 0,
);

// Capture every byte that the READY validator may depend on before invoking
// it. A source edit during validation must not be sealed as reviewed.
const beforeValidation = readObservedBundle();
const packetValidatorPath = fileURLToPath(new URL("./validate-release-packet.mjs", import.meta.url));
const packetValidation = spawnSync(process.execPath, [packetValidatorPath, releasePacketPath], {
  encoding: "utf8",
});
if (packetValidation.error || packetValidation.status !== 0) {
  throw new Error("Cannot seal pre-publication packet proof: canonical READY release-packet validation did not pass.");
}

const reviewedBundle = readObservedBundle();
if (!sameObservedBundle(beforeValidation, reviewedBundle)) {
  throw new Error("Pre-publication packet inputs changed during READY validation; preserve the prior proof and repeat review.");
}

let packet;
try {
  packet = JSON.parse(reviewedBundle[releasePacketPath].toString("utf8"));
} catch {
  throw new Error("Cannot seal pre-publication packet proof: canonical release packet is not readable JSON.");
}
if (packet?.status !== "READY") {
  throw new Error("Cannot seal pre-publication packet proof: canonical release packet must be READY.");
}

const artifactDigestFields = Object.keys(artifactPaths);
if (!hasExactKeys(packet.artifactDigests, artifactDigestFields)) {
  throw new Error("Cannot seal pre-publication packet proof: release packet artifactDigests must contain the exact canonical fields.");
}
const artifactDigests = Object.fromEntries(artifactDigestFields.map((field) => {
  const digest = packet.artifactDigests[field];
  if (!isCanonicalDigest(digest)) {
    throw new Error(`Cannot seal pre-publication packet proof: artifactDigests.${field} must be a lowercase SHA-256 digest.`);
  }
  const sourceDigest = sha256(reviewedBundle[artifactPaths[field]]);
  if (digest !== sourceDigest) {
    throw new Error(`Cannot seal pre-publication packet proof: artifactDigests.${field} does not match ${artifactPaths[field]}.`);
  }
  return [field, digest];
}));

const approvalPacketDigest = packet.approval?.packetDigest;
if (!isCanonicalDigest(approvalPacketDigest)) {
  throw new Error("Cannot seal pre-publication packet proof: approval.packetDigest must be a lowercase SHA-256 digest.");
}
const expectedApprovalPacketDigest = sha256(JSON.stringify({
  packetVersion: 1,
  artifactDigests,
}));
if (approvalPacketDigest !== expectedApprovalPacketDigest) {
  throw new Error("Cannot seal pre-publication packet proof: approval.packetDigest does not bind the ordered canonical artifact digests.");
}
if (!isUtcTimestamp(packet.approval?.approvedAtUtc)) {
  throw new Error("Cannot seal pre-publication packet proof: approval.approvedAtUtc must be a canonical ISO-8601 UTC timestamp.");
}

// Take a second stable read after extracting the reviewed fields. This catches
// changes between the validator result and proof construction.
if (!sameObservedBundle(reviewedBundle, readObservedBundle())) {
  throw new Error("Pre-publication packet inputs changed after READY validation; preserve the prior proof and repeat review.");
}

const proof = {
  version: 1,
  status: "SEALED",
  scope: "Historical pre-publication READY-packet proof only; this record never authorizes signing, submission, publication, or a claim.",
  sealedAtUtc: new Date().toISOString(),
  releasePacketPath,
  releasePacketSha256: sha256(reviewedBundle[releasePacketPath]),
  releaseSnapshotPath,
  releaseSnapshotSha256: sha256(reviewedBundle[releaseSnapshotPath]),
  approvalPacketDigest,
  packetApprovedAtUtc: packet.approval.approvedAtUtc,
  artifactDigests,
};
const sealDelayMs = Date.parse(proof.sealedAtUtc) - Date.parse(proof.packetApprovedAtUtc);
if (sealDelayMs < 0 || sealDelayMs > 30 * 60 * 1000) {
  throw new Error("Cannot seal pre-publication packet proof: seal time must be at or within 30 minutes after packet approval.");
}

try {
  // Publish atomically so a reader sees either the prior complete proof or the
  // new complete proof, never a partially serialized record.
  writeFileSync(temporaryPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  // Recheck all seven observed inputs immediately before replacement. The
  // prior proof remains untouched if any late edit lands during publication.
  if (!sameObservedBundle(reviewedBundle, readObservedBundle())) {
    throw new Error("Pre-publication packet inputs changed while the proof was being published; preserve the prior proof and repeat review.");
  }
  renameSync(temporaryPath, outputPath);
} catch (error) {
  try { unlinkSync(temporaryPath); } catch { /* no temporary proof to remove */ }
  throw error;
}

console.log(`Pre-publication packet proof sealed: ${proof.releasePacketSha256}`);
