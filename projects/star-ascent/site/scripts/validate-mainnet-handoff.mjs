#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const canonicalHandoffPath = "launch/mainnet-handoff.template.json";
const handoffPath = process.argv[2] ?? canonicalHandoffPath;
// Reject a substituted input before parsing it. Otherwise a malformed or
// hostile alternate file can turn this closed canonical gate into a parser
// failure before the operator sees the binding violation.
if (handoffPath !== canonicalHandoffPath) {
  console.error(`FAIL: handoff path must be ${canonicalHandoffPath}`);
  process.exit(1);
}
const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
};
const isDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const isCanonicalDigest = (value) => isDigest(value) && value === value.toLowerCase();
const hasExactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const secretBearingFieldName = (name) => {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:seed(?:phrase|words)?|mnemonic|privatekey|secretkey|keypair|passphrase|devicepin|wallet(?:seed|export|backup)|recovery(?:phrase|words|material)?|derivationpath|accountpath)/.test(normalized);
};
const findSecretBearingField = (value, path = "handoff") => {
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
const findCredentialBearingValue = (value, path = "handoff") => {
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
const findMnemonicShapedValue = (value, path = "handoff") => {
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
const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const sha256Text = (value) => createHash("sha256").update(value).digest("hex");
const manifestValidatorPath = fileURLToPath(new URL("./validate-genesis-manifest.mjs", import.meta.url));
const devnetRehearsalValidatorPath = fileURLToPath(new URL("./validate-devnet-rehearsal.mjs", import.meta.url));
const signingChecklistValidatorPath = fileURLToPath(new URL("./validate-genesis-signing-checklist.mjs", import.meta.url));
const releaseSnapshotValidatorPath = fileURLToPath(new URL("./validate-release-snapshot.mjs", import.meta.url));
const snapshotMaxAgeMs = 30 * 60 * 1000;
const snapshotMaxFutureSkewMs = 60 * 1000;
const requiredPaths = {
  manifestPath: "launch/genesis-manifest.template.json",
  signingChecklistPath: "launch/genesis-signing-checklist.template.json",
  devnetRehearsalPath: "launch/devnet-rehearsal.template.json",
};
const canonicalReleaseSnapshotPath = "launch/release-snapshot.generated.json";
const releaseSnapshotPaths = [
  ...Object.values(requiredPaths),
  "launch/mainnet-handoff.template.json",
  "launch/release-packet.template.json",
  "launch/PUBLICATION_PAYLOAD.template.md",
];
const snapshotFields = ["version", "status", "generatedAtUtc", "packetDigest", "artifacts", "preApprovalPacketDigest", "preApprovalArtifacts"];
const digestRecord = (record) => sha256Text(Object.entries(record).map(([path, digest]) => `${path}:${digest}`).join("\n"));
const recordMatchesPaths = (record, paths, label) => {
  for (const path of paths) {
    if (!isCanonicalDigest(record?.[path])) {
      fail(`${label} requires a lowercase SHA-256 digest for ${path}`);
    } else if (record[path] !== sha256File(path)) {
      fail(`${label} digest does not match ${path}`);
    }
  }
  for (const path of Object.keys(record ?? {})) {
    if (!paths.includes(path)) fail(`${label} must not include an unrecognized path: ${path}`);
  }
};
const recordHasDigestInventory = (record, paths, label) => {
  for (const path of paths) {
    if (!isCanonicalDigest(record?.[path])) fail(`${label} requires a lowercase SHA-256 digest for ${path}`);
  }
  for (const path of Object.keys(record ?? {})) {
    if (!paths.includes(path)) fail(`${label} must not include an unrecognized path: ${path}`);
  }
};

if (!['HOLD', 'READY'].includes(handoff.status)) fail("status must be HOLD or READY");
if (handoff.handoffVersion !== 2) fail("handoffVersion must be 2");
if (handoff.network !== "mainnet-beta") fail("network must be mainnet-beta"); else ok("mainnet-beta selected");
if (handoff.handoffScope !== "Genesis automated evidence handoff only; this file never authorizes a transaction or publication.") fail("handoffScope must retain the non-authorizing boundary");
const canonicalRecordShapes = [
  ["handoff", handoff, ["handoffVersion", "status", "network", "handoffScope", "sourceArtifacts", "automatedClosure", "holdControls"]],
  ["sourceArtifacts", handoff.sourceArtifacts, ["manifestPath", "signingChecklistPath", "devnetRehearsalPath"]],
  ["automatedClosure", handoff.automatedClosure, ["observationMode", "manifestDigest", "destinationDigest", "releaseSnapshotPath", "releaseSnapshotDigest", "manifestSha256", "signingChecklistSha256", "devnetRehearsalSha256", "observedAtUtc"]],
  ["holdControls", handoff.holdControls, ["noSecretsInHandoff", "noTransactionAuthorityGranted", "noPublicationBeforeEvidence", "returnToHoldOnAnyMismatch", "automatedSourceReceiptStateOnly", "humanReviewerRequired", "noSelfAttestation", "trezorModelTPhysicalConfirmationIsSoleHumanGate"]],
];
const malformedShape = canonicalRecordShapes.find(([, value, keys]) => !hasExactKeys(value, keys));
if (malformedShape) {
  fail(`${malformedShape[0]} must contain only its canonical fields`);
} else {
  ok("handoff record contains only canonical reviewed fields");
}
for (const [field, expected] of Object.entries(requiredPaths)) {
  if (handoff.sourceArtifacts?.[field] !== expected) fail(`${field} must point to the canonical artifact`);
  else ok(`${field} points to canonical artifact`);
}
// Keep the snapshot pointer canonical even on HOLD. A reset must not leave an
// operator with a stale or substituted location to approve in the next window.
if (handoff.automatedClosure?.releaseSnapshotPath !== canonicalReleaseSnapshotPath) {
  fail(`automatedClosure.releaseSnapshotPath must be ${canonicalReleaseSnapshotPath}`);
} else {
  ok("release snapshot path points to the canonical handoff snapshot");
}
const manifestValidation = spawnSync(process.execPath, [manifestValidatorPath, requiredPaths.manifestPath], {
  encoding: "utf8",
});
if (manifestValidation.error || manifestValidation.status !== 0) {
  fail("handoff requires the canonical manifest validator to pass before any handoff state is accepted");
} else {
  ok("canonical manifest validator passes before any handoff state is accepted");
}
for (const [label, validatorPath, artifactPath] of [
  ["signer checklist", signingChecklistValidatorPath, requiredPaths.signingChecklistPath],
  ["devnet rehearsal", devnetRehearsalValidatorPath, requiredPaths.devnetRehearsalPath],
]) {
  const validation = spawnSync(process.execPath, [validatorPath, artifactPath], { encoding: "utf8" });
  if (validation.error || validation.status !== 0) {
    fail(`handoff requires the canonical ${label} validator to pass before any handoff state is accepted`);
  } else {
    ok(`canonical ${label} validator passes before any handoff state is accepted`);
  }
}
// A completed devnet trace is useful only when it rehearses the same immutable
// token-program and precision choices that will be reviewed for mainnet.
try {
  const manifestForRehearsalParity = JSON.parse(readFileSync(requiredPaths.manifestPath, "utf8"));
  const rehearsalForMainnetParity = JSON.parse(readFileSync(requiredPaths.devnetRehearsalPath, "utf8"));
  const mismatchedField = ["program", "decimals"].find((field) =>
    rehearsalForMainnetParity.token?.[field] !== manifestForRehearsalParity.token?.[field]);
  const exactTransactionOrder = [
    "CREATE_INITIALIZE_IMMUTABLE_METADATA",
    "MINT_FIVE_ALLOCATION_DESTINATIONS",
    "REVOKE_MINT_AUTHORITY",
    "REVOKE_FREEZE_AUTHORITY",
  ];
  if (mismatchedField) {
    fail(`devnet rehearsal token.${mismatchedField} must exactly match the canonical mainnet manifest`);
  } else if (rehearsalForMainnetParity.token?.programId !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
    fail("devnet rehearsal token.programId must be the canonical Original SPL Token Program");
  } else if (
    JSON.stringify(rehearsalForMainnetParity.mainnetPlan?.transactionOrder)
    !== JSON.stringify(exactTransactionOrder)
  ) {
    fail("devnet rehearsal must bind the exact four-transaction mainnet ceremony");
  } else {
    ok("devnet rehearsal matches the mainnet program, precision, metadata, allocations, and four-transaction shape");
  }
} catch {
  fail("handoff requires readable canonical manifest and devnet rehearsal artifacts for parity review");
}
for (const field of ["noSecretsInHandoff", "noTransactionAuthorityGranted", "noPublicationBeforeEvidence", "returnToHoldOnAnyMismatch", "automatedSourceReceiptStateOnly", "noSelfAttestation", "trezorModelTPhysicalConfirmationIsSoleHumanGate"]) {
  if (handoff.holdControls?.[field] !== true) fail(`holdControls.${field} must be true`);
}
if (handoff.holdControls?.humanReviewerRequired !== false) fail("holdControls.humanReviewerRequired must be false");
if (handoff.automatedClosure?.observationMode !== "AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION") fail("automatedClosure must use exact automated source/receipt/state observation");
const secretBearingField = findSecretBearingField(handoff);
if (secretBearingField) fail(`handoff must not contain credential-bearing field ${secretBearingField}`); else ok("no credential-bearing fields are present");
const credentialBearingValuePath = findCredentialBearingValue(handoff);
if (credentialBearingValuePath) fail(`handoff must not contain credential-bearing value at ${credentialBearingValuePath}`); else ok("no credential-bearing values are present");
const mnemonicShapedValue = findMnemonicShapedValue(handoff);
if (mnemonicShapedValue) fail(`handoff must not contain a 12-24-word mnemonic-shaped value at ${mnemonicShapedValue}`); else ok("no mnemonic-shaped values are present");

// HOLD is a reset state, not a READY record with its status changed. Keeping
// prior observation digests or timestamps here could make an expired or
// corrected closure appear usable to automation scanning the handoff packet.
if (handoff.status === "HOLD") {
  for (const field of [
    "manifestDigest",
    "destinationDigest",
    "releaseSnapshotDigest",
    "manifestSha256",
    "signingChecklistSha256",
    "devnetRehearsalSha256",
    "observedAtUtc",
  ]) {
    if (handoff.automatedClosure?.[field] !== null) fail(`HOLD requires automatedClosure.${field} to be null`);
  }
  if (!process.exitCode) ok("HOLD clears stale automated-closure evidence");
}

if (handoff.status === "READY") {
  // Read only the canonical records after the source-artifact pointer checks.
  // Validation deliberately continues to report all actionable failures, so a
  // substituted path must never become a later parser input in an READY
  // candidate (where it could hide the binding violation behind malformed data).
  const manifest = JSON.parse(readFileSync(requiredPaths.manifestPath, "utf8"));
  const checklist = JSON.parse(readFileSync(requiredPaths.signingChecklistPath, "utf8"));
  const rehearsal = JSON.parse(readFileSync(requiredPaths.devnetRehearsalPath, "utf8"));
  if (manifest.status !== "HOLD") fail("READY requires the mainnet manifest to remain HOLD before evidence exists");
  else ok("manifest remains HOLD before signing");
  if (checklist.status !== "READY") fail("READY requires a READY signer checklist"); else ok("signer checklist is READY");
  if (rehearsal.status !== "COMPLETED") fail("READY requires a COMPLETED devnet rehearsal"); else ok("devnet rehearsal is COMPLETED");
  const readinessTimestamp = checklist.ceremonyControls?.readyAtUtc;
  const rehearsalTimestamp = rehearsal.automatedObservation?.observedAtUtc;
  for (const [label, value] of [
    ["signer checklist readyAtUtc", readinessTimestamp],
    ["devnet rehearsal automated observation observedAtUtc", rehearsalTimestamp],
  ]) {
    if (!isUtcTimestamp(value)) fail(`READY requires a canonical ISO-8601 UTC ${label} ending in Z`);
  }
  for (const field of ["manifestDigest", "destinationDigest"]) {
    if (!isCanonicalDigest(handoff.automatedClosure?.[field])) fail(`READY requires a lowercase SHA-256 automatedClosure.${field}`);
  }
  const expectedArtifactDigests = {
    manifestSha256: handoff.sourceArtifacts.manifestPath,
    signingChecklistSha256: handoff.sourceArtifacts.signingChecklistPath,
    devnetRehearsalSha256: handoff.sourceArtifacts.devnetRehearsalPath,
  };
  for (const [field, path] of Object.entries(expectedArtifactDigests)) {
    if (!isCanonicalDigest(handoff.automatedClosure?.[field])) {
      fail(`READY requires a lowercase SHA-256 automatedClosure.${field}`);
      continue;
    }
    if (handoff.automatedClosure[field] !== sha256File(path)) fail(`automatedClosure.${field} does not match ${path}`);
    else ok(`automatedClosure.${field} matches ${path}`);
  }
  if (handoff.automatedClosure.manifestDigest !== handoff.automatedClosure.manifestSha256) {
    fail("automatedClosure.manifestDigest must match the canonical manifest digest");
  } else {
    ok("automatedClosure.manifestDigest matches the canonical manifest digest");
  }
  const snapshotPath = canonicalReleaseSnapshotPath;
  if (handoff.automatedClosure?.releaseSnapshotPath !== snapshotPath) {
    fail(`READY requires automatedClosure.releaseSnapshotPath to be ${snapshotPath}`);
  } else if (!isCanonicalDigest(handoff.automatedClosure?.releaseSnapshotDigest)) {
    fail("READY requires a lowercase SHA-256 automatedClosure.releaseSnapshotDigest");
  } else {
    try {
      // Do not duplicate the release-snapshot gate here: an READY handoff
      // must inherit its canonical ordering, freshness, and inventory checks.
      const snapshotValidation = spawnSync(process.execPath, [releaseSnapshotValidatorPath, snapshotPath, "pre-approval"], {
        encoding: "utf8",
      });
      if (snapshotValidation.error || snapshotValidation.status !== 0) {
        fail("READY requires the canonical release snapshot validator to pass before automated observation");
      } else {
        ok("canonical release snapshot validator passes before automated observation");
      }
      const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
      const snapshotArtifacts = snapshot.preApprovalArtifacts;
      const expectedSnapshotDigest = digestRecord(snapshotArtifacts ?? {});
      if (!hasExactKeys(snapshot, snapshotFields)) fail("automated-closure snapshot must contain only canonical reviewed fields");
      if (snapshot.status !== "HOLD" || snapshot.version !== 1) fail("automated-closure snapshot must be a version 1 HOLD record");
      if (!isUtcTimestamp(snapshot.generatedAtUtc)) {
        fail("automated-closure snapshot requires a canonical ISO-8601 UTC generatedAtUtc timestamp ending in Z");
      } else {
        const snapshotAgeMs = Date.now() - Date.parse(snapshot.generatedAtUtc);
        if (snapshotAgeMs < -snapshotMaxFutureSkewMs) fail("automated-closure snapshot cannot be more than one minute in the future");
        else if (snapshotAgeMs > snapshotMaxAgeMs) fail("automated-closure snapshot is older than 30 minutes; regenerate it before observation");
        if (isUtcTimestamp(handoff.automatedClosure?.observedAtUtc)
          && Date.parse(snapshot.generatedAtUtc) >= Date.parse(handoff.automatedClosure.observedAtUtc)) {
          fail("automatedClosure.observedAtUtc must be after the frozen automated-closure snapshot; complete automated observation after snapshot generation");
        }
        for (const [label, value] of [
          ["signer checklist readyAtUtc", readinessTimestamp],
          ["devnet rehearsal completedAtUtc", rehearsalTimestamp],
        ]) {
          if (isUtcTimestamp(value) && Date.parse(value) > Date.parse(snapshot.generatedAtUtc)) {
            fail(`${label} must be at or before the automated-closure snapshot; regenerate the snapshot after every gate completes`);
          }
          if (isUtcTimestamp(value) && isUtcTimestamp(handoff.automatedClosure?.observedAtUtc)
            && Date.parse(value) > Date.parse(handoff.automatedClosure.observedAtUtc)) {
            fail(`${label} must be at or before automatedClosure.observedAtUtc`);
          }
        }
      }
      recordMatchesPaths(snapshot.preApprovalArtifacts, Object.values(requiredPaths), "automated-closure snapshot pre-approval artifacts");
      // This wider inventory is historical: automated closure mutates the handoff after
      // the HOLD snapshot. It must remain complete and self-consistent without
      // creating a circular requirement to match the current handoff file.
      recordHasDigestInventory(snapshot.artifacts, releaseSnapshotPaths, "automated-closure snapshot artifacts");
      for (const path of Object.values(requiredPaths)) {
        if (snapshot.artifacts?.[path] !== snapshot.preApprovalArtifacts?.[path]) {
          fail(`automated-closure snapshot pre-closure digest must match the full artifact inventory for ${path}`);
        }
      }
      if (snapshot.preApprovalPacketDigest !== expectedSnapshotDigest) fail("automated-closure snapshot pre-closure digest is invalid");
      if (handoff.automatedClosure.releaseSnapshotDigest !== expectedSnapshotDigest) fail("automatedClosure.releaseSnapshotDigest does not match the current pre-automated-closure snapshot");
      if (snapshot.packetDigest !== digestRecord(snapshot.artifacts ?? {})) fail("automated-closure snapshot packet digest is invalid");
      for (const field of Object.keys(expectedArtifactDigests)) {
        const snapshotPathForField = requiredPaths[field.replace("Sha256", "Path")];
        if (snapshotArtifacts?.[snapshotPathForField] !== handoff.automatedClosure[field]) {
          fail(`automated-closure snapshot does not match automatedClosure.${field}`);
        }
      }
      if (!process.exitCode) ok("automated-closure snapshot binds the current manifest, signer checklist, and rehearsal digests");
    } catch {
      fail("READY requires a readable current release snapshot");
    }
  }
  const expectedDestinationDigest = sha256Text(JSON.stringify({
    handoffVersion: 2,
    network: handoff.network,
    artifactDigests: Object.fromEntries(Object.keys(expectedArtifactDigests).map((field) => [field, handoff.automatedClosure?.[field] ?? null])),
  }));
  if (handoff.automatedClosure.destinationDigest !== expectedDestinationDigest) {
    fail("automatedClosure.destinationDigest must bind the ordered mainnet handoff artifact digest set");
  } else {
    ok("automatedClosure.destinationDigest binds the ordered mainnet handoff artifact digest set");
  }
  if (!isUtcTimestamp(handoff.automatedClosure?.observedAtUtc)) {
    fail("READY requires a canonical ISO-8601 UTC observedAtUtc timestamp ending in Z");
  } else {
    const observationAgeMs = Date.now() - Date.parse(handoff.automatedClosure.observedAtUtc);
    if (observationAgeMs < -snapshotMaxFutureSkewMs) {
      fail("READY observation cannot be more than one minute in the future");
    } else if (observationAgeMs > snapshotMaxAgeMs) {
      fail("READY observation is older than 30 minutes; return to HOLD and repeat automated observation");
    } else {
      ok("READY timestamp is fresh for the automated evidence handoff window");
    }
  }
}

if (process.exitCode) console.error("\nMainnet handoff does not clear the Genesis gate.");
else console.log("\nMainnet handoff structure passes. It never creates keys, signs, submits transactions, or establishes on-chain truth.");
