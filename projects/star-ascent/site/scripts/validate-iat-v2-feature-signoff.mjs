#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PublicKey } from "@solana/web3.js";

const canonicalPath = "launch/iat-v2-devnet-feature-independent-signoff.template.json";
const featurePath = "public/evidence/iat-v2/v2-features-20260801T053340Z.json";
const receiptPath = "public/evidence/iat-v2/chain-status-20260801T053947Z.json";
const initPath = "public/evidence/iat-v2/v2-initialization-20260730T074603Z.json";
const legacyPath = "public/evidence/iat-v2/legacy-v1-devnet-ceremony-20260729.json";
const remediationScopePath = "public/audits/iat-v2-remediation-20260802/scope.json";
const requestedPath = process.argv[2] ?? canonicalPath;
const failures = [];
const fail = (message) => failures.push(message);
function exactKeys(value, keys) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
}

function isPublicKey(value) {
  try {
    return typeof value === "string" && new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

function isUtc(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function findCredentialField(value, path = "signoff") {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (/(secret|private.?key|mnemonic|seed.?phrase|passphrase|password|recovery.?phrase|pin)/i.test(key)) {
      return `${path}.${key}`;
    }
    const nested = findCredentialField(child, `${path}.${key}`);
    if (nested) return nested;
  }
  return null;
}

if (requestedPath.replaceAll("\\", "/") !== canonicalPath) {
  fail(`sign-off path must be ${canonicalPath}`);
}

let signoff;
let feature;
let receipt;
let init;
let legacy;
let remediationScope;
try {
  signoff = readJson(canonicalPath);
  feature = readJson(featurePath);
  receipt = readJson(receiptPath);
  init = readJson(initPath);
  legacy = readJson(legacyPath);
  remediationScope = readJson(remediationScopePath);
} catch (error) {
  fail(`sign-off or public evidence is unreadable: ${error.message}`);
}

if (remediationScope) {
  if (
    remediationScope.historicalDevnetEvidence?.remainsHistoricalEvidence !== true
    || remediationScope.historicalDevnetEvidence?.coversThisSourceCommit !== false
    || remediationScope.historicalDevnetEvidence?.freshSignedRehearsalRequired !== true
    || remediationScope.verifiableSbf?.sha256 === "634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7"
  ) fail("remediation audit must classify this feature sign-off as historical and require a fresh run");
}

if (signoff && feature && receipt && init && legacy) {
  if (!exactKeys(signoff, [
    "schema",
    "status",
    "scope",
    "evidence",
    "chainReceipt",
    "programArtifact",
    "observationPolicy",
    "checks",
    "exceptions",
    "completedAtUtc",
  ])) fail("sign-off must contain only canonical top-level fields");
  if (signoff.schema !== "iat-v2-devnet-feature-automated-observation/v2") fail("wrong automated-observation schema");
  if (!["PENDING", "VERIFIED"].includes(signoff.status)) fail("status must be PENDING or VERIFIED");
  if (signoff.scope !== "CORRECTED_PROGRAM_AND_EIGHTEEN_TRANSACTION_FEATURE_REHEARSAL") {
    fail("sign-off scope must bind the corrected program and 18-transaction feature rehearsal");
  }
  const credentialField = findCredentialField(signoff);
  if (credentialField) fail(`sign-off contains forbidden credential field ${credentialField}`);

  if (!exactKeys(signoff.evidence, [
    "path",
    "sha256",
    "programId",
    "mint",
    "config",
    "transactionCount",
  ])) fail("feature evidence binding must contain only canonical fields");
  if (
    signoff.evidence?.path !== featurePath
    || signoff.evidence?.sha256 !== sha256File(featurePath)
    || signoff.evidence?.programId !== feature.programId
    || signoff.evidence?.mint !== feature.mint
    || signoff.evidence?.config !== feature.config
    || signoff.evidence?.transactionCount !== feature.transactions?.length
  ) fail("feature evidence binding does not match the canonical export");
  if (
    feature.schema !== "iat-v2-devnet-on-chain-feature-rehearsal-evidence/v1"
    || feature.status !== "PARTIAL_PENDING_ALL_TIME_GATES_AND_INDEPENDENT_REVIEW"
    || feature.network !== "devnet"
    || feature.mainnetStatus !== "HOLD"
    || feature.independentReviewRequired !== true
    || feature.secretMaterialIncluded !== false
    || feature.transactions?.length !== 18
  ) fail("canonical feature evidence boundary drift");
  for (const value of [signoff.evidence?.programId, signoff.evidence?.mint, signoff.evidence?.config]) {
    if (!isPublicKey(value)) fail("feature binding contains a non-canonical Solana public key");
  }

  if (!exactKeys(signoff.chainReceipt, ["path", "sha256", "signatureCount"])) {
    fail("chain receipt binding must contain only canonical fields");
  }
  if (
    signoff.chainReceipt?.path !== receiptPath
    || signoff.chainReceipt?.sha256 !== sha256File(receiptPath)
    || signoff.chainReceipt?.signatureCount !== receipt.results?.length
    || receipt.schema !== "iat-public-chain-status/v1"
    || receipt.network !== "devnet"
    || receipt.mainnetStatus !== "HOLD"
    || receipt.signingOrBroadcastPerformed !== false
    || receipt.results?.length !== 29
    || receipt.results.some(({ confirmationStatus, err }) => confirmationStatus !== "finalized" || err !== null)
  ) fail("chain receipt does not prove 29 finalized, error-free canonical signatures");
  const expectedSignatures = new Set([
    ...legacy.transactions.map(({ signature }) => signature),
    ...init.transactions.map(({ signature }) => signature),
    ...feature.transactions.map(({ signature }) => signature),
  ]);
  const receiptSignatures = new Set(receipt.results.map(({ signature }) => signature));
  if (
    expectedSignatures.size !== 29
    || receiptSignatures.size !== 29
    || [...expectedSignatures].some((signature) => !receiptSignatures.has(signature))
  ) fail("chain receipt signature set does not match the canonical exports");

  if (!exactKeys(signoff.programArtifact, [
    "sha256",
    "bytes",
    "programData",
    "deployedAtSlot",
    "upgradeAuthority",
  ])) fail("program artifact binding must contain only canonical fields");
  if (
    signoff.programArtifact?.sha256 !== "634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7"
    || signoff.programArtifact?.bytes !== 597336
    || signoff.programArtifact?.programData !== "6DaESYUqB7th7kkfYAhsqiYfzmdnCFeFeoxDi5WkejTP"
    || signoff.programArtifact?.deployedAtSlot !== 480117343
    || signoff.programArtifact?.upgradeAuthority !== "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH"
    || !isPublicKey(signoff.programArtifact?.programData)
    || !isPublicKey(signoff.programArtifact?.upgradeAuthority)
  ) fail("corrected program artifact binding drift");

  const expectedObservationPolicy = {
    mode: "AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION",
    humanReviewerRequired: false,
    noSelfAttestation: true,
    trezorModelTPhysicalConfirmationIsSoleHumanGate: true,
  };
  if (!exactKeys(signoff.observationPolicy, Object.keys(expectedObservationPolicy))) {
    fail("observationPolicy must contain only canonical automated-policy fields");
  } else if (JSON.stringify(signoff.observationPolicy) !== JSON.stringify(expectedObservationPolicy)) {
    fail("observationPolicy must preserve automated evidence, no-self-attestation, and Model T-only signature gates");
  }

  const checkKeys = [
    "evidenceSha256Matched",
    "eighteenFeatureTransactionsFinalizedAndOrdered",
    "transactionMessageHashesMatched",
    "correctedProgramArtifactAndUpgradeAuthorityMatched",
    "threeStakeRolesAndReservationsMatched",
    "standardWeek8SettlementMatched",
    "cccRound8CommitRevealMatched",
    "linkedWeek8SettlementsMatched",
    "coreAndLiquidityActionsMatched",
    "switchboardIdentityMatched",
    "chainReceipt29Of29Finalized",
    "remainingTimeGatesAcknowledged",
    "mainnetRemainedHold",
  ];
  if (!exactKeys(signoff.checks, checkKeys)) fail("check record must contain only canonical fields");
  if (!Array.isArray(signoff.exceptions)) fail("exceptions must be an array");

  if (signoff.status === "PENDING") {
    if (
      Object.values(signoff.checks ?? {}).some((value) => value !== false)
      || signoff.exceptions?.length !== 0
      || signoff.completedAtUtc !== null
    ) fail("PENDING observation must not contain partial or self-asserted completion evidence");
  }

  if (signoff.status === "VERIFIED") {
    if (Object.values(signoff.checks ?? {}).some((value) => value !== true)) {
      fail("VERIFIED observation requires every canonical check to be true");
    }
    if (signoff.exceptions?.length !== 0) fail("VERIFIED observation cannot contain exceptions");
    if (!isUtc(signoff.completedAtUtc)) fail("VERIFIED observation requires canonical UTC completion time");
    else {
      const completedAt = Date.parse(signoff.completedAtUtc);
      const evidenceReadyAt = Math.max(Date.parse(feature.exportedAtUtc), Date.parse(receipt.checkedAtUtc));
      if (completedAt <= evidenceReadyAt) fail("automated observation completion must follow evidence and receipt creation");
      if (completedAt > Date.now() + 60_000) fail("automated observation completion cannot be in the future");
    }
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(
  signoff.status === "VERIFIED"
    ? "IAT V2 historical corrected-program feature automated observation validates for its prior artifact. Current remediation source requires a fresh signed Devnet rehearsal; Mainnet HOLD."
    : "IAT V2 corrected-program feature automated observation is PENDING.",
);
