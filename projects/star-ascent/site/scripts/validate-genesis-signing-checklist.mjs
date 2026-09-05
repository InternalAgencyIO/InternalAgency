#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const canonicalChecklistPath = "launch/genesis-signing-checklist.template.json";
const path = process.argv[2] ?? canonicalChecklistPath;
if (path !== canonicalChecklistPath) {
  console.error(`FAIL: checklist path must be ${canonicalChecklistPath}`);
  process.exit(1);
}
const checklist = JSON.parse(readFileSync(path, "utf8"));
const canonicalManifestPath = "launch/genesis-manifest.template.json";
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
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
const isSolanaAddress = (value) => typeof value === "string"
  && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  && base58DecodedLength(value) === 32;
const isUsableSolanaAddress = (value) => isSolanaAddress(value) && value !== "11111111111111111111111111111111";
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
};
const readinessMaxAgeMs = 30 * 60 * 1000;
const readinessMaxFutureSkewMs = 60 * 1000;
const isCanonicalDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const sha256File = (filePath) => createHash("sha256").update(readFileSync(filePath)).digest("hex");
const secretBearingFieldName = (name) => {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:seed(?:phrase|words)?|mnemonic|privatekey|secretkey|keypair|passphrase|devicepin|wallet(?:seed|export|backup)|recovery(?:phrase|words|material)?|derivationpath|accountpath)/.test(normalized);
};
const findSecretBearingField = (value, path = "checklist") => {
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
const credentialBearingValue = (value) => {
  if (typeof value !== "string") return false;
  if (/\b(?:seed\s*(?:phrase|words)?|mnemonic|private\s*key|secret\s*key|keypair|passphrase|device\s*pin|wallet\s*(?:seed|export|backup)|recovery\s*(?:phrase|words|material)?|derivation\s*path|account\s*path)\b/i.test(value)) return true;
  if (/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value) && base58DecodedLength(value) === 64) return true;
  const words = value.trim().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every((word) => /^[a-z]+$/i.test(word));
};
const findCredentialBearingValue = (value, path = "checklist") => {
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
const requiredRoles = {
  mintAuthoritySigner: "SIGNER",
  feePayerSigner: "SIGNER",
};
const requiredAllocationNames = ["community", "treasury", "ecosystem", "coreTeam", "liquidity"];
const hasExactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));

if (!['HOLD', 'READY'].includes(checklist.status)) fail("status must be HOLD or READY");
if (checklist.network !== "mainnet-beta") fail("network must be mainnet-beta"); else ok("mainnet-beta selected");
if (checklist.manifestPath !== canonicalManifestPath) fail("manifestPath must point to the canonical Genesis manifest");
const canonicalRecordShapes = [
  ["checklist", checklist, ["status", "network", "manifestPath", "participants", "ceremonyControls"]],
  ["participants", checklist.participants, ["mintAuthoritySigner", "feePayerSigner"]],
  ["participants.mintAuthoritySigner", checklist.participants?.mintAuthoritySigner, ["role", "publicAddress", "physicalConfirmationRequired", "devicePathReviewed"]],
  ["participants.feePayerSigner", checklist.participants?.feePayerSigner, ["role", "publicAddress", "physicalConfirmationRequired", "devicePathReviewed"]],
  ["ceremonyControls", checklist.ceremonyControls, ["observationMode", "humanReviewerRequired", "noSelfAttestation", "trezorModelTPhysicalConfirmationIsSoleHumanGate", "automaticBroadcastPermitted", "noSecretsInChecklist", "noBlindApproval", "recipientAddressesCheckedAgainstManifest", "signerAddressesCheckedAgainstManifest", "mainnetHoldObserved", "reviewedRecipientDestinations", "manifestSha256", "readyAtUtc"]],
  ["ceremonyControls.reviewedRecipientDestinations", checklist.ceremonyControls?.reviewedRecipientDestinations, requiredAllocationNames],
  ...requiredAllocationNames.map((name) => [`ceremonyControls.reviewedRecipientDestinations.${name}`, checklist.ceremonyControls?.reviewedRecipientDestinations?.[name], ["publicAddress", "expectedBaseUnitAmount"]]),
];
const malformedShape = canonicalRecordShapes.find(([, value, keys]) => !hasExactKeys(value, keys));
if (malformedShape) {
  fail(`${malformedShape[0]} must contain only its canonical reviewed fields`);
} else {
  ok("signing checklist contains only canonical reviewed fields");
}

// The allocation math is part of the frozen checklist even while the ceremony
// is on HOLD. Checking it only once addresses are populated would let a stale
// amount survive into a later READY transition without being visible in review.
// Never read a manifest path supplied by the checklist. A malformed checklist
// must fail on its canonical binding, not redirect this validator to another
// artifact (or turn a closed gate into a file-read error).
const canonicalManifest = JSON.parse(readFileSync(canonicalManifestPath, "utf8"));
// The checklist is a review record for this exact manifest. Keep its network
// declaration tied to the reviewed artifact in both HOLD and READY so a
// mainnet-labelled checklist cannot be reused against a different network.
if (canonicalManifest.network !== checklist.network) {
  fail("checklist network must match the canonical Genesis manifest");
} else {
  ok("checklist network matches the canonical Genesis manifest");
}
for (const allocationName of requiredAllocationNames) {
  const expectedAmount = canonicalManifest.allocations?.[allocationName]?.baseUnitAmount;
  const reviewedAmount = checklist.ceremonyControls?.reviewedRecipientDestinations?.[allocationName]?.expectedBaseUnitAmount;
  if (typeof expectedAmount !== "string" || !/^[1-9]\d*$/.test(expectedAmount)) {
    fail(`canonical manifest requires an unsigned base-unit amount for ${allocationName}`);
  } else if (reviewedAmount !== expectedAmount) {
    fail(`checklist expected base-unit amount must match the canonical manifest allocation for ${allocationName}`);
  }
}
if (!process.exitCode) ok("checklist allocation amounts match the canonical manifest in every state");

for (const [name, role] of Object.entries(requiredRoles)) {
  const participant = checklist.participants?.[name];
  if (!participant || participant.role !== role) fail(`${name} must have role ${role}`);
  else ok(`${name} role recorded`);
}

if (checklist.ceremonyControls?.noSecretsInChecklist !== true) fail("checklist must explicitly prohibit secrets");
if (checklist.ceremonyControls?.noBlindApproval !== true) fail("checklist must explicitly prohibit blind approval");
if (checklist.ceremonyControls?.observationMode !== "AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION") fail("checklist must use automated source/receipt/state observation");
if (checklist.ceremonyControls?.humanReviewerRequired !== false) fail("checklist must not require a human reviewer");
if (checklist.ceremonyControls?.noSelfAttestation !== true) fail("checklist must reject self-attestation");
if (checklist.ceremonyControls?.trezorModelTPhysicalConfirmationIsSoleHumanGate !== true) fail("Model T physical confirmation must be the sole human gate");
if (checklist.ceremonyControls?.automaticBroadcastPermitted !== false) fail("checklist must forbid automatic broadcast");
// Physical confirmation is a standing ceremony boundary, not a READY-only
// convenience. Requiring it while HOLD is active prevents a checklist from
// retaining the right structure but silently dropping the required device
// confirmation before automated observations can move it to READY.
for (const name of ["mintAuthoritySigner", "feePayerSigner"]) {
  if (checklist.participants?.[name]?.physicalConfirmationRequired !== true) {
    fail(`checklist requires physical confirmation for ${name} in every state`);
  }
}
const secretBearingField = findSecretBearingField(checklist);
if (secretBearingField) fail(`checklist must not contain credential-bearing field ${secretBearingField}`); else ok("no credential-bearing fields are present");
const credentialBearingValuePath = findCredentialBearingValue(checklist);
if (credentialBearingValuePath) fail(`checklist must not contain credential-bearing value at ${credentialBearingValuePath}`); else ok("no credential-bearing values are present");

// HOLD is a reset, not a READY checklist with its status changed. Retaining
// addresses, completed reviews, a digest, or a timestamp could let an operator
// mistake an expired ceremony review for the current signing decision.
if (checklist.status === "HOLD") {
  for (const name of Object.keys(requiredRoles)) {
    if (checklist.participants?.[name]?.publicAddress !== null) {
      fail(`HOLD requires participants.${name}.publicAddress to be null`);
    }
  }
  for (const name of ["mintAuthoritySigner", "feePayerSigner"]) {
    if (checklist.participants?.[name]?.devicePathReviewed !== false) {
      fail(`HOLD requires participants.${name}.devicePathReviewed to be false`);
    }
  }
  for (const field of ["recipientAddressesCheckedAgainstManifest", "signerAddressesCheckedAgainstManifest", "mainnetHoldObserved", "manifestSha256", "readyAtUtc"]) {
    const expected = ["manifestSha256", "readyAtUtc"].includes(field) ? null : false;
    if (checklist.ceremonyControls?.[field] !== expected) {
      fail(`HOLD requires ceremonyControls.${field} to be ${JSON.stringify(expected)}`);
    }
  }
  for (const allocationName of requiredAllocationNames) {
    if (checklist.ceremonyControls?.reviewedRecipientDestinations?.[allocationName]?.publicAddress !== null) {
      fail(`HOLD requires ceremonyControls.reviewedRecipientDestinations.${allocationName}.publicAddress to be null`);
    }
  }
  if (!process.exitCode) ok("HOLD clears stale ceremony addresses, reviews, manifest binding, and readiness timestamp");
}

if (checklist.status === "READY") {
  // READY authorizes only the pre-Genesis review window. Once the manifest is
  // PUBLISHED, its evidence describes a completed ceremony and must not be
  // repurposed to make a fresh signer checklist look actionable.
  if (canonicalManifest.status !== "HOLD") {
    fail("READY requires the canonical Genesis manifest to remain HOLD until the signing ceremony is complete");
  } else {
    ok("canonical Genesis manifest remains HOLD for the pre-Genesis signing review");
  }
  // A matching digest proves only that automation observed this byte sequence. The
  // manifest must still clear its own canonical gate before that review can
  // authorize a signing ceremony; otherwise a freshly hashed malformed
  // manifest could inherit READY status from an otherwise complete checklist.
  const manifestValidation = spawnSync(process.execPath, [resolve("scripts/validate-genesis-manifest.mjs")], {
    encoding: "utf8",
  });
  if (manifestValidation.error || manifestValidation.status !== 0) {
    fail("READY requires the canonical Genesis manifest validator to pass before the signing ceremony");
  } else {
    ok("canonical Genesis manifest validator passes before the signing ceremony");
  }
  const reviewedManifest = canonicalManifest;
  const ceremonyRoleAddresses = [];
  for (const [name, role] of Object.entries(requiredRoles)) {
    const participant = checklist.participants?.[name];
    if (!isUsableSolanaAddress(participant?.publicAddress)) fail(`READY requires a usable Solana public address for ${name}`);
    else { ok(`${name} has Solana address form`); ceremonyRoleAddresses.push(participant.publicAddress); }
    if (role === "SIGNER" && (participant.physicalConfirmationRequired !== true || participant.devicePathReviewed !== true)) fail(`READY requires physical confirmation and device-path review for ${name}`);
  }
  const mintAuthorityAddress = checklist.participants?.mintAuthoritySigner?.publicAddress;
  const feePayerAddress = checklist.participants?.feePayerSigner?.publicAddress;
  if (isUsableSolanaAddress(mintAuthorityAddress)
    && isUsableSolanaAddress(feePayerAddress)
    && mintAuthorityAddress !== feePayerAddress) {
    fail("READY requires mintAuthoritySigner and feePayerSigner to share one reviewed physical signing address");
  }
  // A mint account is a program-owned record, never a ceremony identity. Once
  // the manifest is published, make that separation explicit so a copied mint
  // address cannot be mistaken for a confirmed signer in the handoff room.
  if (reviewedManifest.status === "PUBLISHED" && ceremonyRoleAddresses.includes(reviewedManifest.token?.mint)) {
    fail("READY ceremony-role addresses must be separate from the published mint address");
  }
  const reviewedRecipients = checklist.ceremonyControls?.reviewedRecipientDestinations;
  if (!reviewedRecipients || typeof reviewedRecipients !== "object" || Array.isArray(reviewedRecipients)) {
    fail("READY requires reviewedRecipientDestinations for every allocation");
  } else {
    const recipientAddresses = [];
    for (const allocationName of requiredAllocationNames) {
      const review = reviewedRecipients[allocationName];
      if (!isUsableSolanaAddress(review?.publicAddress)) {
        fail(`READY requires a usable Solana recipient address for ${allocationName}`);
      } else {
        recipientAddresses.push(review.publicAddress);
      }
      const expectedAmount = reviewedManifest.allocations?.[allocationName]?.baseUnitAmount;
      if (typeof review?.expectedBaseUnitAmount !== "string" || !/^[1-9]\d*$/.test(review.expectedBaseUnitAmount)) {
        fail(`READY requires an unsigned expected base-unit amount for ${allocationName}`);
      } else if (review.expectedBaseUnitAmount !== expectedAmount) {
        fail(`READY recipient review amount must match the manifest allocation for ${allocationName}`);
      }
      if (reviewedManifest.status === "PUBLISHED" && review?.publicAddress !== reviewedManifest.allocations?.[allocationName]?.destination) {
        fail(`READY recipient review address must match the PUBLISHED manifest destination for ${allocationName}`);
      }
    }
    for (const allocationName of Object.keys(reviewedRecipients)) {
      if (!requiredAllocationNames.includes(allocationName)) fail(`READY must not include an unrecognized recipient allocation: ${allocationName}`);
    }
    if (new Set(recipientAddresses).size !== recipientAddresses.length) fail("READY requires distinct recipient addresses for every allocation");
    if (recipientAddresses.some((address) => ceremonyRoleAddresses.includes(address))) fail("READY recipient addresses must be separate from ceremony-role addresses");
    if (reviewedManifest.status === "PUBLISHED" && recipientAddresses.includes(reviewedManifest.token?.mint)) {
      fail("READY recipient review addresses must be separate from the published mint address");
    }
    if (recipientAddresses.length === requiredAllocationNames.length && !process.exitCode) ok("every allocation recipient address is source-bound and distinct");
    if (reviewedManifest.status === "PUBLISHED" && !process.exitCode) ok("reviewed recipient addresses match the published manifest destinations");
  }
  for (const field of ["recipientAddressesCheckedAgainstManifest", "signerAddressesCheckedAgainstManifest", "mainnetHoldObserved"]) {
    if (checklist.ceremonyControls?.[field] !== true) fail(`READY requires ${field}: true`);
  }
  if (!isCanonicalDigest(checklist.ceremonyControls?.manifestSha256)) {
    fail("READY requires ceremonyControls.manifestSha256 as a lowercase 64-character SHA-256 digest");
  } else if (checklist.ceremonyControls.manifestSha256 !== sha256File(canonicalManifestPath)) {
    fail("READY requires ceremonyControls.manifestSha256 to match the exact reviewed manifest");
  } else {
    ok("address review is bound to the exact current manifest digest");
  }
  const readyAtUtc = checklist.ceremonyControls?.readyAtUtc;
  if (!isUtcTimestamp(readyAtUtc)) {
    fail("READY requires a canonical ISO-8601 UTC readyAtUtc timestamp ending in Z");
  } else {
    const readinessAgeMs = Date.now() - Date.parse(readyAtUtc);
    if (readinessAgeMs < -readinessMaxFutureSkewMs) {
      fail("READY readyAtUtc cannot be more than one minute in the future");
    } else if (readinessAgeMs > readinessMaxAgeMs) {
      fail("READY readyAtUtc is older than 30 minutes; return to HOLD and repeat the address review");
    } else {
      ok("READY timestamp is fresh for the signing decision window");
    }
  }
}

if (process.exitCode) console.error("\nSigning checklist does not clear the Genesis gate.");
else console.log("\nSigning checklist structure passes. Non-signature gates use exact automated source/state observations; Model T physical confirmation remains the sole human signature gate.");
