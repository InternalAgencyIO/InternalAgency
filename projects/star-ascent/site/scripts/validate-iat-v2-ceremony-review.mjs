#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const canonicalPath = "launch/iat-v2-ceremony-review.template.json";
const reviewPath = process.argv[2] ?? canonicalPath;
if (reviewPath !== canonicalPath) {
  console.error(`FAIL: ceremony review path must be ${canonicalPath}`);
  process.exit(1);
}

const review = JSON.parse(readFileSync(reviewPath, "utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const sha256 = (filePath) => createHash("sha256").update(readFileSync(filePath)).digest("hex");
const canonicalDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const label = (value) => typeof value === "string" && value.trim().length >= 3 && value.trim().length <= 120;
const utc = (value) => typeof value === "string" && value.endsWith("Z")
  && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
const base58DecodedLength = (value) => {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{1,44}$/u.test(value)) return -1;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = 0n;
  for (const character of value) number = number * 58n + BigInt(alphabet.indexOf(character));
  let byteLength = 0;
  while (number > 0n) { byteLength += 1; number >>= 8n; }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return byteLength + leadingZeroes;
};
const usableAddress = (value) => typeof value === "string"
  && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(value)
  && base58DecodedLength(value) === 32
  && value !== "11111111111111111111111111111111";
const secretField = (name) => /(?:seed|mnemonic|privatekey|secretkey|keypair|passphrase|pin|recovery|derivationpath|accountpath)/iu
  .test(name.replace(/[^a-z0-9]/giu, ""));
const credentialValue = (value) => typeof value === "string" && (
  /\b(?:seed phrase|mnemonic|private key|secret key|passphrase|device pin|recovery phrase|derivation path)\b/iu.test(value)
  || (value.trim().split(/\s+/u).length >= 12 && value.trim().split(/\s+/u).length <= 24
    && value.trim().split(/\s+/u).every((word) => /^[a-z]+$/iu.test(word)))
);
const scan = (value, location = "review") => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scan(item, `${location}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) {
      check(!secretField(name), `credential-bearing field at ${location}.${name}`);
      scan(item, `${location}.${name}`);
    }
  } else {
    check(!credentialValue(value), `credential-bearing value at ${location}`);
  }
};

check(exactKeys(review, ["schema", "status", "network", "scope", "sourceArtifacts", "artifactDigests", "signatureGate", "controls", "observation", "limitations"]), "review must contain only canonical top-level fields");
check(review.schema === "iat-v2-ceremony-review/v2", "unexpected ceremony review schema");
check(["HOLD", "READY"].includes(review.status), "ceremony review status must be HOLD or READY");
check(review.network === "mainnet-beta", "ceremony review network must be mainnet-beta");
check(review.scope === "Non-authorizing V2 automated source/receipt/state observation record; this file never signs, simulates for signing, broadcasts, deploys, mints, transfers, schedules, publishes, or stores wallet credentials.", "ceremony review must retain its non-authorizing automated-observation scope");

const sourcePaths = {
  readinessGatePath: "launch/iat-v2-mainnet-readiness-gate.json",
  stageJournalPath: "launch/iat-v2-mainnet-stage-journal.template.json",
  policyPath: "engagement/iat-economic-policy.v2.json",
  allocationPlanPath: "launch/iat-v2-allocation-plan.template.json",
  remediationAuditPath: "public/audits/iat-v2-remediation-20260802/manifest.json",
  localTimeGateProofPath: "launch/iat-v2-local-time-gate-proof.json",
};
const digestFields = {
  readinessGateSha256: sourcePaths.readinessGatePath,
  stageJournalSha256: sourcePaths.stageJournalPath,
  policySha256: sourcePaths.policyPath,
  allocationPlanSha256: sourcePaths.allocationPlanPath,
  remediationAuditSha256: sourcePaths.remediationAuditPath,
  localTimeGateProofSha256: sourcePaths.localTimeGateProofPath,
};
check(exactKeys(review.sourceArtifacts, Object.keys(sourcePaths)), "sourceArtifacts must contain only canonical V2 paths");
for (const [field, expected] of Object.entries(sourcePaths)) check(review.sourceArtifacts?.[field] === expected, `${field} must point to ${expected}`);
check(exactKeys(review.artifactDigests, Object.keys(digestFields)), "artifactDigests must contain only canonical V2 digest fields");
check(exactKeys(review.signatureGate, ["soleTrezorOperator"]), "signatureGate must contain only the sole Trezor operator");
check(exactKeys(review.signatureGate?.soleTrezorOperator, ["role", "label", "publicAddress", "physicalConfirmationRequired", "devicePathReviewed"]), "soleTrezorOperator has unexpected fields");
check(review.signatureGate?.soleTrezorOperator?.role === "SOLE_TREZOR_SIGNER", "operator role must remain SOLE_TREZOR_SIGNER");
check(review.signatureGate?.soleTrezorOperator?.physicalConfirmationRequired === true, "sole Trezor signing always requires physical confirmation");

const expectedControls = {
  soleTrezorAuthorityTopology: true,
  authorityRoleSeparationClaimed: false,
  noServerSigner: true,
  noAutomaticSigning: true,
  noBlindApproval: true,
  automaticBroadcastPermitted: false,
  separateHumanApprovalRequired: false,
  humanReviewerRequired: false,
  noSelfAttestation: true,
  trezorModelTPhysicalConfirmationIsSoleHumanGate: true,
  noSecretsInRecord: true,
};
check(exactKeys(review.controls, Object.keys(expectedControls)), "controls must contain only canonical safety fields");
for (const [field, expected] of Object.entries(expectedControls)) check(review.controls?.[field] === expected, `${field} must remain ${expected}`);
check(exactKeys(review.observation, ["mode", "releaseArtifactsRegeneratedAfterFundingAndScheduling", "replacementUtcWindowObserved", "currentSbfDigestObserved", "currentSignedDevnetReceiptObserved", "stagePlanStateObserved", "observedAtUtc"]), "observation must contain only canonical automated source/receipt/state fields");
check(review.observation?.mode === "AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION", "observation mode must be automated source/receipt/state observation");
check(Array.isArray(review.limitations) && review.limitations.length === 4 && review.limitations.every((item) => typeof item === "string" && item.length > 20), "limitations must retain four reviewed statements");
scan(review);

if (review.status === "HOLD") {
  for (const value of Object.values(review.artifactDigests ?? {})) check(value === null, "HOLD must clear every artifact digest");
  check(review.signatureGate?.soleTrezorOperator?.label === null, "HOLD must clear the operator label");
  check(review.signatureGate?.soleTrezorOperator?.publicAddress === null, "HOLD must clear the operator address");
  check(review.signatureGate?.soleTrezorOperator?.devicePathReviewed === false, "HOLD must retain the device-path blocker");
  for (const [field, value] of Object.entries(review.observation ?? {})) {
    const expected = field === "mode"
      ? "AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION"
      : field === "observedAtUtc" ? null : false;
    check(value === expected, `HOLD must clear observation.${field}`);
  }
}

if (review.status === "READY") {
  const gate = JSON.parse(readFileSync(sourcePaths.readinessGatePath, "utf8"));
  const journal = JSON.parse(readFileSync(sourcePaths.stageJournalPath, "utf8"));
  const remediationAudit = JSON.parse(readFileSync(sourcePaths.remediationAuditPath, "utf8"));
  for (const [field, filePath] of Object.entries(digestFields)) {
    check(canonicalDigest(review.artifactDigests?.[field]), `READY requires ${field}`);
    check(review.artifactDigests?.[field] === sha256(filePath), `READY ${field} must match the canonical V2 artifact`);
  }
  const operator = review.signatureGate?.soleTrezorOperator;
  check(label(operator?.label), "READY requires an operator label");
  check(usableAddress(operator?.publicAddress), "READY requires the usable sole-Trezor public address");
  check(operator?.publicAddress === gate.funding?.publicAddress, "READY operator address must match the reviewed mainnet funding/administrator address");
  check(operator?.devicePathReviewed === true, "READY requires attended Model T device-path review");
  check(journal.status === "ARMED", "READY requires the canonical V2 stage journal to be ARMED");
  const publishedAtMs = utc(gate.schedule?.publishedAtUtc) ? Date.parse(gate.schedule.publishedAtUtc) : Number.NaN;
  const scheduledAtMs = utc(gate.schedule?.scheduledAtUtc) ? Date.parse(gate.schedule.scheduledAtUtc) : Number.NaN;
  check(
    gate.schedule?.state === "SCHEDULED_HOLD"
      && Number.isFinite(publishedAtMs)
      && Number.isFinite(scheduledAtMs)
      && scheduledAtMs > publishedAtMs,
    "READY requires one exact replacement UTC ceremony time later than its publication time while mainnet remains HOLD",
  );
  check(gate.gates?.releaseArtifactsRegeneratedAfterFundingAndScheduling === true, "READY requires post-funding/post-scheduling artifact regeneration");
  check(gate.gates?.automatedSourceReceiptStateObservationComplete === true, "READY requires the readiness ledger automated-observation gate");
  check(review.observation?.releaseArtifactsRegeneratedAfterFundingAndScheduling === true, "READY requires regenerated-artifact state observation");
  check(review.observation?.replacementUtcWindowObserved === true, "READY requires exact replacement-window observation");
  check(review.observation?.currentSbfDigestObserved === true && remediationAudit.clearance?.freshCurrentSourceSbfComplete === true, "READY requires current source-bound SBF observation");
  check(review.observation?.currentSignedDevnetReceiptObserved === true && remediationAudit.clearance?.freshSignedDevnetComplete === true, "READY requires current signed Devnet receipt observation");
  check(review.observation?.stagePlanStateObserved === true && journal.status === "ARMED", "READY requires ARMED stage-plan state observation");
  check(utc(review.observation?.observedAtUtc), "READY requires a canonical UTC observedAtUtc timestamp");
  const age = Date.now() - Date.parse(review.observation?.observedAtUtc ?? "");
  check(age >= -60_000 && age <= 30 * 60_000, "READY observation must be no more than 30 minutes old with one minute future skew");
}

if (failures.length) {
  console.error("IAT V2 ceremony review validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`IAT V2 ceremony review passed in ${review.status}: exact automated source/receipt/state observations, sole-Model-T signature limits, credential rejection, and nonauthorizing HOLD boundaries remain bound.`);
