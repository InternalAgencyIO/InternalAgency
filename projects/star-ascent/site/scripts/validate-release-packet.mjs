#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeAccountabilityLabel } from "./normalize-accountability-label.mjs";

const canonicalPacketPath = "launch/release-packet.template.json";
const packetPath = process.argv[2] ?? canonicalPacketPath;
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
// Reject a substituted input before parsing it. Otherwise a malformed alternate
// file can conceal the closed canonical-path violation with a JSON error.
if (packetPath !== canonicalPacketPath) {
  fail(`release packet path must be ${canonicalPacketPath}`);
  process.exit(1);
}
const packet = JSON.parse(readFileSync(packetPath, "utf8"));
const isDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const isCanonicalDigest = (value) => isDigest(value) && value === value.toLowerCase();
const normalizedRoleLabel = normalizeAccountabilityLabel;
const isUsableRoleLabel = (value) => typeof value === "string"
  && value === value.trim()
  && !/\p{C}/u.test(value)
  && normalizedRoleLabel(value).length >= 2
  && !/\b(pending|todo|tbd|example|placeholder|unassigned|none|unknown)\b/i.test(value);
const hasExactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const sha256Text = (value) => createHash("sha256").update(value).digest("hex");
const secretBearingFieldName = (name) => {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:seed(?:phrase|words)?|mnemonic|privatekey|secretkey|keypair|passphrase|devicepin|wallet(?:seed|export|backup)|recovery(?:phrase|words|material)?|derivationpath|accountpath)/.test(normalized);
};
const findSecretBearingField = (value, path = "packet") => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findSecretBearingField(item, `${path}[${index}]`);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) {
      const fieldPath = `${path}.${name}`;
      if (secretBearingFieldName(name)) return fieldPath;
      const found = findSecretBearingField(item, fieldPath);
      if (found) return found;
    }
  }
  return null;
};
const base58DecodedLength = (value) => {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{1,88}$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = [0];
  for (const character of value) {
    let carry = alphabet.indexOf(character);
    for (let index = 0; index < decoded.length; index += 1) {
      carry += decoded[index] * 58;
      decoded[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { decoded.push(carry & 0xff); carry >>= 8; }
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return decoded.length + leadingZeroes - (decoded.length === 1 && decoded[0] === 0 ? 1 : 0);
};
const credentialBearingValue = (value) => {
  if (typeof value !== "string") return false;
  if (/\b(?:seed\s*(?:phrase|words)?|mnemonic|private\s*key|secret\s*key|keypair|passphrase|device\s*pin|wallet\s*(?:seed|export|backup)|recovery\s*(?:phrase|words|material)?|derivation\s*path|account\s*path)\b/i.test(value)) return true;
  if (/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value) && base58DecodedLength(value) === 64) return true;
  const words = value.trim().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every((word) => /^[a-z]+$/i.test(word));
};
const findCredentialBearingValue = (value, path = "packet") => {
  if (typeof value === "string") return credentialBearingValue(value) ? path : null;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findCredentialBearingValue(item, `${path}[${index}]`);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) {
      const found = findCredentialBearingValue(item, `${path}.${name}`);
      if (found) return found;
    }
  }
  return null;
};
const isMnemonicShapedValue = (value) => {
  if (typeof value !== "string") return false;
  const words = value.trim().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every((word) => /^[a-z]{3,8}$/.test(word));
};
const findMnemonicShapedValue = (value, path = "packet") => {
  if (typeof value === "string") return isMnemonicShapedValue(value) ? path : null;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findMnemonicShapedValue(item, `${path}[${index}]`);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) {
      const found = findMnemonicShapedValue(item, `${path}.${name}`);
      if (found) return found;
    }
  }
  return null;
};
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
const manifestValidatorPath = fileURLToPath(new URL("./validate-genesis-manifest.mjs", import.meta.url));
const publicationPayloadValidatorPath = fileURLToPath(new URL("./validate-publication-payload.mjs", import.meta.url));
const signingChecklistValidatorPath = fileURLToPath(new URL("./validate-genesis-signing-checklist.mjs", import.meta.url));
const devnetRehearsalValidatorPath = fileURLToPath(new URL("./validate-devnet-rehearsal.mjs", import.meta.url));
const mainnetHandoffValidatorPath = fileURLToPath(new URL("./validate-mainnet-handoff.mjs", import.meta.url));
const canonicalPacketShapes = [
  ["release packet", packet, ["status", "packetScope", "sourceArtifacts", "releaseControls", "artifactDigests", "approval"]],
  ["release packet sourceArtifacts", packet.sourceArtifacts, Object.keys(expectedPaths)],
  ["release packet releaseControls", packet.releaseControls, ["allOperatorsReviewedSameArtifactVersions", "publicEvidenceCheckedAtUtc", "correctionOwnerLabel", "stopOnAnyMismatch", "noPublicationBeforeIndependentEvidence"]],
  ["release packet artifactDigests", packet.artifactDigests, ["manifestSha256", "publicationPayloadSha256", "signingChecklistSha256", "devnetRehearsalSha256", "mainnetHandoffSha256"]],
  ["release packet approval", packet.approval, ["releaseOwnerLabel", "independentVerifierLabel", "packetDigest", "approvedAtUtc"]],
];
const malformedPacketShape = canonicalPacketShapes.find(([, value, keys]) => !hasExactKeys(value, keys));
if (malformedPacketShape) fail(`${malformedPacketShape[0]} must contain only its exact canonical reviewed fields`);
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
const snapshotFields = ["version", "status", "generatedAtUtc", "packetDigest", "artifacts", "preApprovalPacketDigest", "preApprovalArtifacts"];
const checkSnapshotInventory = (record, paths, label) => {
  for (const path of paths) {
    if (!isCanonicalDigest(record?.[path])) fail(`${label} requires a lowercase SHA-256 digest for ${path}`);
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
const manifestValidation = spawnSync(process.execPath, [manifestValidatorPath, expectedPaths.manifestPath], {
  encoding: "utf8",
});
if (manifestValidation.error || manifestValidation.status !== 0) {
  fail("release packet requires the canonical manifest validator to pass before any packet state is accepted");
} else {
  ok("canonical manifest validator passes before any packet state is accepted");
}
const publicationPayloadValidation = spawnSync(process.execPath, [publicationPayloadValidatorPath, expectedPaths.publicationPayloadPath], {
  encoding: "utf8",
});
if (publicationPayloadValidation.error || publicationPayloadValidation.status !== 0) {
  fail("release packet requires the canonical publication payload validator to pass before any packet state is accepted");
} else {
  ok("canonical publication payload validator passes before any packet state is accepted");
}
for (const [label, validatorPath, artifactPath] of [
  ["signer checklist", signingChecklistValidatorPath, expectedPaths.signingChecklistPath],
  ["devnet rehearsal", devnetRehearsalValidatorPath, expectedPaths.devnetRehearsalPath],
]) {
  const validation = spawnSync(process.execPath, [validatorPath, artifactPath], { encoding: "utf8" });
  if (validation.error || validation.status !== 0) {
    fail(`release packet requires the canonical ${label} validator to pass before any packet state is accepted`);
  } else {
    ok(`canonical ${label} validator passes before any packet state is accepted`);
  }
}
const handoffValidation = spawnSync(process.execPath, [mainnetHandoffValidatorPath, expectedPaths.mainnetHandoffPath], {
  encoding: "utf8",
});
if (handoffValidation.error || handoffValidation.status !== 0) {
  fail("release packet requires the canonical mainnet handoff validator to pass before any packet state is accepted");
} else {
  ok("canonical mainnet handoff validator passes before any packet state is accepted");
}
for (const field of ["stopOnAnyMismatch", "noPublicationBeforeIndependentEvidence"]) {
  if (packet.releaseControls?.[field] !== true) fail(`releaseControls.${field} must be true`);
}
const secretBearingField = findSecretBearingField(packet);
if (secretBearingField) fail(`release packet must not contain credential-bearing field ${secretBearingField}`); else ok("no credential-bearing fields are present");
const credentialBearingValuePath = findCredentialBearingValue(packet);
if (credentialBearingValuePath) fail(`release packet must not contain credential-bearing value at ${credentialBearingValuePath}`); else ok("no credential-bearing values are present");
const mnemonicShapedValue = findMnemonicShapedValue(packet);
if (mnemonicShapedValue) fail(`release packet must not contain a 12-24-word mnemonic-shaped value at ${mnemonicShapedValue}`); else ok("no mnemonic-shaped values are present");

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
  const approvedHandoffValidation = spawnSync(process.execPath, [mainnetHandoffValidatorPath, packet.sourceArtifacts.mainnetHandoffPath], {
    encoding: "utf8",
  });
  if (approvedHandoffValidation.error || approvedHandoffValidation.status !== 0) {
    fail("READY requires the canonical mainnet handoff validator to pass before packet approval");
  } else {
    ok("canonical mainnet handoff validator passes before packet approval");
  }
  for (const [field, value] of [
    ["handoff approval.releaseOwnerLabel", handoff.approval?.releaseOwnerLabel],
    ["handoff approval.independentVerifierLabel", handoff.approval?.independentVerifierLabel],
    ["handoff holdControls.correctionOwnerLabel", handoff.holdControls?.correctionOwnerLabel],
  ]) {
    if (!isUsableRoleLabel(value)) fail(`READY requires a trimmed, printable, non-placeholder ${field}`);
  }
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
    if (!isCanonicalDigest(handoff.approval?.[field]) || handoff.approval[field] !== sha256File(path)) {
      fail(`READY requires handoff.approval.${field} to match ${path}`);
    } else {
      ok(`handoff.approval.${field} matches ${path}`);
    }
  }
  const expectedHandoffDestinationDigest = sha256Text(JSON.stringify({
    handoffVersion: 1,
    network: handoff.network,
    artifactDigests: Object.fromEntries(Object.keys(expectedHandoffDigests).map((field) => [field, handoff.approval?.[field] ?? null])),
  }));
  if (!isCanonicalDigest(handoff.approval?.manifestDigest) || handoff.approval.manifestDigest !== handoff.approval.manifestSha256) {
    fail("READY requires handoff.approval.manifestDigest to match the canonical manifest digest");
  } else {
    ok("handoff.approval.manifestDigest matches the canonical manifest digest");
  }
  if (!isCanonicalDigest(handoff.approval?.destinationDigest)) {
    fail("READY requires a lowercase SHA-256 handoff.approval.destinationDigest");
  } else if (handoff.approval.destinationDigest !== expectedHandoffDestinationDigest) {
    fail("READY requires handoff.approval.destinationDigest to bind its canonical artifact digests");
  } else {
    ok("handoff.approval.destinationDigest binds its canonical artifact digests");
  }
  let snapshotGeneratedAtMs = null;
  if (handoff.approval?.releaseSnapshotPath !== releaseSnapshotPath) {
    fail(`READY requires handoff.approval.releaseSnapshotPath to be ${releaseSnapshotPath}`);
  } else if (!isCanonicalDigest(handoff.approval?.releaseSnapshotDigest)) {
    fail("READY requires a lowercase SHA-256 handoff.approval.releaseSnapshotDigest");
  } else {
    try {
      const snapshot = JSON.parse(readFileSync(releaseSnapshotPath, "utf8"));
      if (!hasExactKeys(snapshot, snapshotFields)) fail("READY requires a release snapshot with only canonical reviewed fields");
      if (snapshot.version !== 1 || snapshot.status !== "HOLD") fail("READY requires a version 1 HOLD release snapshot");
      snapshotGeneratedAtMs = requireFreshDecisionTimestamp(snapshot.generatedAtUtc, "release snapshot generatedAtUtc");
      checkSnapshotInventory(snapshot.preApprovalArtifacts, snapshotPreApprovalPaths, "release snapshot pre-approval artifacts");
      checkSnapshotInventory(snapshot.artifacts, snapshotArtifactPaths, "release snapshot artifacts");
      for (const path of snapshotPreApprovalPaths) {
        if (snapshot.artifacts?.[path] !== snapshot.preApprovalArtifacts?.[path]) {
          fail(`READY requires the release snapshot pre-approval digest to match its full artifact inventory for ${path}`);
        }
      }
      const expectedSnapshotDigest = digestRecord(snapshot.preApprovalArtifacts ?? {});
      if (!isCanonicalDigest(snapshot.preApprovalPacketDigest) || snapshot.preApprovalPacketDigest !== expectedSnapshotDigest) {
        fail("READY requires a release snapshot with a valid pre-approval packet digest");
      }
      if (!isCanonicalDigest(snapshot.packetDigest) || snapshot.packetDigest !== digestRecord(snapshot.artifacts ?? {})) {
        fail("READY requires a release snapshot with a valid full packet digest");
      }
      if (handoff.approval.releaseSnapshotDigest !== expectedSnapshotDigest) {
        fail("READY requires handoff.approval.releaseSnapshotDigest to match the release snapshot pre-approval digest");
      }
      for (const [field, path] of Object.entries(expectedHandoffDigests)) {
        if (snapshot.preApprovalArtifacts?.[path] !== handoff.approval?.[field]) {
          fail(`READY requires the release snapshot to match handoff.approval.${field}`);
        }
      }
      if (snapshotGeneratedAtMs !== null && isUtcTimestamp(handoff.approval?.approvedAtUtc)
        && snapshotGeneratedAtMs > timestampMs(handoff.approval.approvedAtUtc)) {
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
  if (snapshotGeneratedAtMs !== null && evidenceCheckedAtMs !== null && evidenceCheckedAtMs <= snapshotGeneratedAtMs) {
    fail("READY requires publicEvidenceCheckedAtUtc to be strictly after the frozen release snapshot");
  }
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
  if (!isCanonicalDigest(packet.approval?.packetDigest)) fail("READY requires a lowercase SHA-256 packetDigest");
  const packetApprovedAtMs = requireFreshDecisionTimestamp(packet.approval?.approvedAtUtc, "packet approval.approvedAtUtc");
  if (handoffApprovedAtMs !== null && evidenceCheckedAtMs !== null && handoffApprovedAtMs <= evidenceCheckedAtMs) {
    fail("READY requires handoff approval.approvedAtUtc to be strictly after the public evidence check");
  }
  if (packetApprovedAtMs !== null && handoffApprovedAtMs !== null && packetApprovedAtMs <= handoffApprovedAtMs) {
    fail("READY requires packet approval.approvedAtUtc to be strictly after the approved handoff");
  }
  const expectedArtifactDigests = {
    manifestSha256: packet.sourceArtifacts.manifestPath,
    publicationPayloadSha256: packet.sourceArtifacts.publicationPayloadPath,
    signingChecklistSha256: packet.sourceArtifacts.signingChecklistPath,
    devnetRehearsalSha256: packet.sourceArtifacts.devnetRehearsalPath,
    mainnetHandoffSha256: packet.sourceArtifacts.mainnetHandoffPath,
  };
  for (const [field, path] of Object.entries(expectedArtifactDigests)) {
    if (!isCanonicalDigest(packet.artifactDigests?.[field])) {
      fail(`READY requires a lowercase SHA-256 artifactDigests.${field}`);
      continue;
    }
    if (packet.artifactDigests[field] !== sha256File(path)) fail(`artifactDigests.${field} does not match ${path}`);
    else ok(`artifactDigests.${field} matches ${path}`);
  }
  const expectedPacketDigest = sha256Text(JSON.stringify({
    packetVersion: 1,
    artifactDigests: Object.fromEntries(Object.keys(expectedArtifactDigests).map((field) => [field, packet.artifactDigests?.[field] ?? null])),
  }));
  if (packet.approval.packetDigest !== expectedPacketDigest) fail("approval.packetDigest must bind the ordered canonical artifact digest set");
  else ok("approval.packetDigest binds the ordered canonical artifact digest set");
}

if (packet.status === "HOLD") {
  for (const [field, value] of [
    ["releaseControls.allOperatorsReviewedSameArtifactVersions", packet.releaseControls?.allOperatorsReviewedSameArtifactVersions],
    ["releaseControls.publicEvidenceCheckedAtUtc", packet.releaseControls?.publicEvidenceCheckedAtUtc],
    ["releaseControls.correctionOwnerLabel", packet.releaseControls?.correctionOwnerLabel],
    ["approval.releaseOwnerLabel", packet.approval?.releaseOwnerLabel],
    ["approval.independentVerifierLabel", packet.approval?.independentVerifierLabel],
    ["approval.packetDigest", packet.approval?.packetDigest],
    ["approval.approvedAtUtc", packet.approval?.approvedAtUtc],
  ]) {
    const expected = field === "releaseControls.allOperatorsReviewedSameArtifactVersions" ? false : null;
    if (value !== expected) fail(`HOLD requires ${field} to be ${JSON.stringify(expected)} so no prior approval can survive a reset`);
  }
  for (const [field, value] of Object.entries(packet.artifactDigests ?? {})) {
    if (value !== null) fail(`HOLD requires artifactDigests.${field} to be null so no prior approval digest can survive a reset`);
  }
  if (!process.exitCode) ok("HOLD contains no stale review, approval, or artifact-digest state");
}

if (process.exitCode) console.error("\nRelease packet does not clear the Genesis gate.");
else console.log("\nRelease packet structure passes. It never creates keys, signs, submits transactions, or establishes on-chain truth.");
