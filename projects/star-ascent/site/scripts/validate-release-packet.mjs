#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const packetPath = process.argv[2] ?? "launch/release-packet.template.json";
const packet = JSON.parse(readFileSync(packetPath, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const isDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const normalizedRoleLabel = (value) => typeof value === "string" ? value.trim().toLocaleLowerCase("en-US") : "";
const isUsableRoleLabel = (value) => normalizedRoleLabel(value).length >= 2
  && !/\b(pending|todo|tbd|example|placeholder|unassigned|none)\b/i.test(value);
const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const sha256Text = (value) => createHash("sha256").update(value).digest("hex");
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
};
const approvalMaxAgeMs = 30 * 60 * 1000;
const approvalMaxFutureSkewMs = 60 * 1000;
const releaseSnapshotPath = "launch/release-snapshot.generated.json";
const timestampMs = (value) => Date.parse(value);
const digestRecord = (record) => sha256Text(Object.entries(record).map(([path, digest]) => `${path}:${digest}`).join("\n"));
const requireFreshDecisionTimestamp = (value, label) => {
  if (!isUtcTimestamp(value)) {
    fail(`READY requires a canonical ISO-8601 UTC ${label} timestamp ending in Z`);
    return null;
  }
  const ageMs = Date.now() - timestampMs(value);
  if (ageMs < -approvalMaxFutureSkewMs) {
    fail(`${label} cannot be more than one minute in the future`);
  } else if (ageMs > approvalMaxAgeMs) {
    fail(`${label} is older than 30 minutes; return to HOLD and repeat the review`);
  } else {
    ok(`${label} is fresh for the release decision window`);
  }
  return timestampMs(value);
};
const expectedPaths = {
  manifestPath: "launch/genesis-manifest.template.json",
  publicationPayloadPath: "launch/PUBLICATION_PAYLOAD.template.md",
  signingChecklistPath: "launch/genesis-signing-checklist.template.json",
  devnetRehearsalPath: "launch/devnet-rehearsal.template.json",
  mainnetHandoffPath: "launch/mainnet-handoff.template.json",
};
const snapshotPreApprovalPaths = [
  expectedPaths.manifestPath,
  expectedPaths.signingChecklistPath,
  expectedPaths.devnetRehearsalPath,
];
const snapshotArtifactPaths = [
  ...snapshotPreApprovalPaths,
  expectedPaths.mainnetHandoffPath,
  "launch/release-packet.template.json",
  expectedPaths.publicationPayloadPath,
];
const checkSnapshotInventory = (record, paths, label) => {
  for (const path of paths) {
    if (!isDigest(record?.[path])) fail(`${label} requires a digest for ${path}`);
  }
  for (const path of Object.keys(record ?? {})) {
    if (!paths.includes(path)) fail(`${label} must not include an unrecognized path: ${path}`);
  }
};

if (!['HOLD', 'READY'].includes(packet.status)) fail("status must be HOLD or READY");
if (packet.packetScope !== "Genesis release coordination only; this packet never authorizes a transaction, publication, or claim.") fail("packetScope must retain the non-authorizing boundary");
for (const [field, expected] of Object.entries(expectedPaths)) {
  if (packet.sourceArtifacts?.[field] !== expected) fail(`${field} must point to the canonical artifact`);
  else ok(`${field} points to canonical artifact`);
}
for (const field of ["stopOnAnyMismatch", "noPublicationBeforeIndependentEvidence"]) {
  if (packet.releaseControls?.[field] !== true) fail(`releaseControls.${field} must be true`);
}

if (packet.status === "READY") {
  const manifest = JSON.parse(readFileSync(packet.sourceArtifacts.manifestPath, "utf8"));
  const checklist = JSON.parse(readFileSync(packet.sourceArtifacts.signingChecklistPath, "utf8"));
  const rehearsal = JSON.parse(readFileSync(packet.sourceArtifacts.devnetRehearsalPath, "utf8"));
  const handoff = JSON.parse(readFileSync(packet.sourceArtifacts.mainnetHandoffPath, "utf8"));
  const payload = readFileSync(packet.sourceArtifacts.publicationPayloadPath, "utf8");
  if (manifest.status !== "HOLD") fail("READY requires the mainnet manifest to remain HOLD before independent evidence exists"); else ok("manifest remains HOLD");
  if (!/Status:\s*\*\*HOLD\*\*/.test(payload)) fail("READY requires the publication payload to remain HOLD before independent evidence exists"); else ok("publication payload remains HOLD");
  if (checklist.status !== "READY") fail("READY requires a READY signer checklist"); else ok("signer checklist is READY");
  if (rehearsal.status !== "COMPLETED") fail("READY requires a COMPLETED devnet rehearsal"); else ok("devnet rehearsal is COMPLETED");
  if (handoff.status !== "APPROVED") fail("READY requires an APPROVED mainnet handoff"); else ok("mainnet handoff is APPROVED");
  if (normalizedRoleLabel(handoff.approval?.releaseOwnerLabel) === normalizedRoleLabel(handoff.approval?.independentVerifierLabel)) {
    fail("READY requires the handoff release owner and independent verifier to be separate");
  }
  if ([handoff.approval?.releaseOwnerLabel, handoff.approval?.independentVerifierLabel]
    .map(normalizedRoleLabel).includes(normalizedRoleLabel(handoff.holdControls?.correctionOwnerLabel))) {
    fail("READY requires the handoff correction owner to be separate from its release owner and independent verifier");
  }
  const expectedHandoffSources = {
    manifestPath: packet.sourceArtifacts.manifestPath,
    signingChecklistPath: packet.sourceArtifacts.signingChecklistPath,
    devnetRehearsalPath: packet.sourceArtifacts.devnetRehearsalPath,
  };
  for (const [field, path] of Object.entries(expectedHandoffSources)) {
    if (handoff.sourceArtifacts?.[field] !== path) fail(`READY requires handoff.sourceArtifacts.${field} to match the release packet`);
    else ok(`handoff.sourceArtifacts.${field} matches the release packet`);
  }
  const expectedHandoffDigests = {
    manifestSha256: packet.sourceArtifacts.manifestPath,
    signingChecklistSha256: packet.sourceArtifacts.signingChecklistPath,
    devnetRehearsalSha256: packet.sourceArtifacts.devnetRehearsalPath,
  };
  for (const [field, path] of Object.entries(expectedHandoffDigests)) {
    if (!isDigest(handoff.approval?.[field]) || handoff.approval[field].toLowerCase() !== sha256File(path)) {
      fail(`READY requires handoff.approval.${field} to match ${path}`);
    } else {
      ok(`handoff.approval.${field} matches ${path}`);
    }
  }
  const expectedHandoffDestinationDigest = sha256Text(JSON.stringify({
    handoffVersion: 1,
    network: handoff.network,
    artifactDigests: Object.fromEntries(Object.keys(expectedHandoffDigests).map((field) => [field, handoff.approval?.[field]?.toLowerCase() ?? null])),
  }));
  if (!isDigest(handoff.approval?.manifestDigest) || handoff.approval.manifestDigest.toLowerCase() !== handoff.approval.manifestSha256?.toLowerCase()) {
    fail("READY requires handoff.approval.manifestDigest to match the canonical manifest digest");
  } else {
    ok("handoff.approval.manifestDigest matches the canonical manifest digest");
  }
  if (!isDigest(handoff.approval?.destinationDigest) || handoff.approval.destinationDigest.toLowerCase() !== expectedHandoffDestinationDigest) {
    fail("READY requires handoff.approval.destinationDigest to bind its canonical artifact digests");
  } else {
    ok("handoff.approval.destinationDigest binds its canonical artifact digests");
  }
  if (handoff.approval?.releaseSnapshotPath !== releaseSnapshotPath) {
    fail(`READY requires handoff.approval.releaseSnapshotPath to be ${releaseSnapshotPath}`);
  } else if (!isDigest(handoff.approval?.releaseSnapshotDigest)) {
    fail("READY requires handoff.approval.releaseSnapshotDigest");
  } else {
    try {
      const snapshot = JSON.parse(readFileSync(releaseSnapshotPath, "utf8"));
      if (snapshot.version !== 1 || snapshot.status !== "HOLD") fail("READY requires a version 1 HOLD release snapshot");
      const generatedAtMs = requireFreshDecisionTimestamp(snapshot.generatedAtUtc, "release snapshot generatedAtUtc");
      checkSnapshotInventory(snapshot.preApprovalArtifacts, snapshotPreApprovalPaths, "release snapshot pre-approval artifacts");
      checkSnapshotInventory(snapshot.artifacts, snapshotArtifactPaths, "release snapshot artifacts");
      for (const path of snapshotPreApprovalPaths) {
        if (snapshot.artifacts?.[path]?.toLowerCase() !== snapshot.preApprovalArtifacts?.[path]?.toLowerCase()) {
          fail(`READY requires the release snapshot pre-approval digest to match its full artifact inventory for ${path}`);
        }
      }
      const expectedSnapshotDigest = digestRecord(snapshot.preApprovalArtifacts ?? {});
      if (!isDigest(snapshot.preApprovalPacketDigest) || snapshot.preApprovalPacketDigest.toLowerCase() !== expectedSnapshotDigest) {
        fail("READY requires a release snapshot with a valid pre-approval packet digest");
      }
      if (!isDigest(snapshot.packetDigest) || snapshot.packetDigest.toLowerCase() !== digestRecord(snapshot.artifacts ?? {})) {
        fail("READY requires a release snapshot with a valid full packet digest");
      }
      if (handoff.approval.releaseSnapshotDigest.toLowerCase() !== expectedSnapshotDigest) {
        fail("READY requires handoff.approval.releaseSnapshotDigest to match the release snapshot pre-approval digest");
      }
      for (const [field, path] of Object.entries(expectedHandoffDigests)) {
        if (snapshot.preApprovalArtifacts?.[path]?.toLowerCase() !== handoff.approval?.[field]?.toLowerCase()) {
          fail(`READY requires the release snapshot to match handoff.approval.${field}`);
        }
      }
      if (generatedAtMs !== null && isUtcTimestamp(handoff.approval?.approvedAtUtc)
        && generatedAtMs > timestampMs(handoff.approval.approvedAtUtc)) {
        fail("READY requires the release snapshot to be generated at or before handoff approval");
      }
      if (!process.exitCode) ok("release snapshot independently binds the approved handoff inputs");
    } catch {
      fail("READY requires a readable current release snapshot");
    }
  }
  if (packet.releaseControls?.allOperatorsReviewedSameArtifactVersions !== true) fail("READY requires same-version operator review");
  const evidenceCheckedAtMs = requireFreshDecisionTimestamp(packet.releaseControls?.publicEvidenceCheckedAtUtc, "publicEvidenceCheckedAtUtc");
  const handoffApprovedAtMs = requireFreshDecisionTimestamp(handoff.approval?.approvedAtUtc, "handoff approval.approvedAtUtc");
  if (!isUsableRoleLabel(packet.releaseControls?.correctionOwnerLabel)) fail("READY requires a non-placeholder correction owner label");
  for (const field of ["releaseOwnerLabel", "independentVerifierLabel"]) {
    if (!isUsableRoleLabel(packet.approval?.[field])) fail(`READY requires a non-placeholder approval.${field}`);
  }
  if (normalizedRoleLabel(packet.approval?.releaseOwnerLabel) === normalizedRoleLabel(packet.approval?.independentVerifierLabel)) fail("READY requires separate release owner and independent verifier labels");
  if ([packet.approval?.releaseOwnerLabel, packet.approval?.independentVerifierLabel]
    .map(normalizedRoleLabel).includes(normalizedRoleLabel(packet.releaseControls?.correctionOwnerLabel))) fail("READY requires a correction owner separate from the release owner and independent verifier");
  const roleBindings = {
    "approval.releaseOwnerLabel": handoff.approval?.releaseOwnerLabel,
    "approval.independentVerifierLabel": handoff.approval?.independentVerifierLabel,
    "releaseControls.correctionOwnerLabel": handoff.holdControls?.correctionOwnerLabel,
  };
  for (const [field, approvedValue] of Object.entries(roleBindings)) {
    const packetValue = field === "releaseControls.correctionOwnerLabel"
      ? packet.releaseControls?.correctionOwnerLabel
      : packet.approval?.[field.split(".").at(-1)];
    if (packetValue !== approvedValue) {
      fail(`READY requires ${field} to exactly match the approved mainnet handoff role`);
    } else {
      ok(`${field} matches the approved mainnet handoff role`);
    }
  }
  if (!isDigest(packet.approval?.packetDigest)) fail("READY requires a 64-character hexadecimal packetDigest");
  const packetApprovedAtMs = requireFreshDecisionTimestamp(packet.approval?.approvedAtUtc, "packet approval.approvedAtUtc");
  if (handoffApprovedAtMs !== null && evidenceCheckedAtMs !== null && handoffApprovedAtMs < evidenceCheckedAtMs) {
    fail("READY requires handoff approval.approvedAtUtc to follow the public evidence check");
  }
  if (packetApprovedAtMs !== null && handoffApprovedAtMs !== null && packetApprovedAtMs < handoffApprovedAtMs) {
    fail("READY requires packet approval.approvedAtUtc to follow the approved handoff");
  }
  const expectedArtifactDigests = {
    manifestSha256: packet.sourceArtifacts.manifestPath,
    publicationPayloadSha256: packet.sourceArtifacts.publicationPayloadPath,
    signingChecklistSha256: packet.sourceArtifacts.signingChecklistPath,
    devnetRehearsalSha256: packet.sourceArtifacts.devnetRehearsalPath,
    mainnetHandoffSha256: packet.sourceArtifacts.mainnetHandoffPath,
  };
  for (const [field, path] of Object.entries(expectedArtifactDigests)) {
    if (!isDigest(packet.artifactDigests?.[field])) {
      fail(`READY requires artifactDigests.${field}`);
      continue;
    }
    if (packet.artifactDigests[field].toLowerCase() !== sha256File(path)) fail(`artifactDigests.${field} does not match ${path}`);
    else ok(`artifactDigests.${field} matches ${path}`);
  }
  const expectedPacketDigest = sha256Text(JSON.stringify({
    packetVersion: 1,
    artifactDigests: Object.fromEntries(Object.keys(expectedArtifactDigests).map((field) => [field, packet.artifactDigests?.[field]?.toLowerCase() ?? null])),
  }));
  if (packet.approval.packetDigest.toLowerCase() !== expectedPacketDigest) fail("approval.packetDigest must bind the ordered canonical artifact digest set");
  else ok("approval.packetDigest binds the ordered canonical artifact digest set");
}

if (process.exitCode) console.error("\nRelease packet does not clear the Genesis gate.");
else console.log("\nRelease packet structure passes. It never creates keys, signs, submits transactions, or establishes on-chain truth.");
