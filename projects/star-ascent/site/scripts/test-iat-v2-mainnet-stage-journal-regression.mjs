#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const journalPath = "launch/iat-v2-mainnet-stage-journal.template.json";
const validatorPath = "scripts/validate-iat-v2-mainnet-stage-journal.mjs";
const sourcePaths = [
  "programs/iat_v2/client.mjs",
  "engagement/iat-economic-policy.v2.json",
  "launch/iat-v2-allocation-plan.template.json",
  "launch/iat-v2-mainnet-readiness-gate.json",
  "launch/iat-v2-local-time-gate-proof.json",
];
const sandbox = mkdtempSync(join(tmpdir(), "iat-v2-stage-journal-"));
const baseline = JSON.parse(readFileSync(join(root, journalPath), "utf8"));
const clone = (value) => structuredClone(value);
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const sha256Bytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const encodeBase58 = (bytes) => {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = base58Alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return "1".repeat(leadingZeroes) + encoded;
};

function copy(path) {
  const target = join(sandbox, path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(root, path), target);
}

function writeJson(path, value) {
  const target = join(sandbox, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validate(journal) {
  writeJson(journalPath, journal);
  return spawnSync(process.execPath, [validatorPath], { cwd: sandbox, encoding: "utf8" });
}

function expectPass(name, journal) {
  const result = validate(journal);
  if (result.status !== 0) throw new Error(`${name} should pass:\n${result.stderr}${result.stdout}`);
}

function expectFail(name, journal, needle) {
  const result = validate(journal);
  if (result.status === 0 || !`${result.stderr}${result.stdout}`.includes(needle)) {
    throw new Error(`${name} should fail with ${JSON.stringify(needle)}:\n${result.stderr}${result.stdout}`);
  }
}

function armedFixture() {
  const readiness = JSON.parse(readFileSync(join(sandbox, "launch/iat-v2-mainnet-readiness-gate.json"), "utf8"));
  readiness.schedule = {
    state: "SCHEDULED_HOLD",
    publishedAtUtc: "2026-07-31T23:30:00Z",
    scheduledAtUtc: "2026-08-01T03:30:00Z",
    priorWindow: readiness.schedule.priorWindow,
  };
  readiness.funding.observedLamports = readiness.funding.ceremonyFloorLamports;
  readiness.funding.shortfallToCeremonyFloorLamports = "0";
  readiness.funding.ceremonyFloorSatisfied = true;
  for (const field of ["mainnetFundingFloorSatisfied", "replacementUtcWindowPublished", "releaseArtifactsRegeneratedAfterFundingAndScheduling", "finalPreflightPassedAgainstRegeneratedArtifacts", "physicalModelTDevicePathReviewed", "physicalModelTReviewCompleted", "automatedSourceReceiptStateObservationComplete", "mainnetExecutionAuthorized"]) readiness.gates[field] = true;
  writeJson("launch/iat-v2-mainnet-readiness-gate.json", readiness);

  const journal = clone(baseline);
  journal.status = "ARMED";
  for (const [field, path] of Object.entries({
    programClientSha256: "programs/iat_v2/client.mjs",
    policySha256: "engagement/iat-economic-policy.v2.json",
    allocationPlanSha256: "launch/iat-v2-allocation-plan.template.json",
    readinessGateSha256: "launch/iat-v2-mainnet-readiness-gate.json",
    releaseSnapshotSha256: "launch/release-snapshot.generated.json",
    localTimeGateProofSha256: "launch/iat-v2-local-time-gate-proof.json",
  })) journal.artifactDigests[field] = sha256(join(sandbox, path));
  Object.assign(journal.identity, {
    sourceCommit: "a".repeat(40),
    programId: encodeBase58(Buffer.alloc(32, 1)),
    programDataAddress: encodeBase58(Buffer.alloc(32, 2)),
    mint: encodeBase58(Buffer.alloc(32, 3)),
    administrator: encodeBase58(Buffer.alloc(32, 4)),
  });
  for (const [index, stage] of journal.stages.entries()) {
    stage.reviewedIntentSha256 = createHash("sha256").update(`reviewed-intent-stage-${index + 1}`).digest("hex");
    stage.expectedPostStateSha256 = createHash("sha256").update(`expected-stage-${index + 1}`).digest("hex");
  }
  return journal;
}

function writeObservationReceipt(stage, index, journal) {
  const receiptPath = `launch/evidence/iat-v2-mainnet-stage-${index + 1}-observation.json`;
  const receipt = {
    schema: "iat-v2-stage-observation/v1",
    observationMode: "AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION",
    network: journal.network,
    sourceCommit: journal.identity.sourceCommit,
    programId: journal.identity.programId,
    stageIndex: stage.index,
    stage: stage.stage,
    reviewedIntentSha256: stage.reviewedIntentSha256,
    signedMessageSha256: stage.signedMessageSha256,
    expectedPostStateSha256: stage.expectedPostStateSha256,
    signature: stage.signature,
    confirmedAtUtc: stage.confirmedAtUtc,
    observedPostStateSha256: stage.observedPostStateSha256,
    mismatchCode: stage.mismatchCode,
    observedAtUtc: stage.observedAtUtc,
  };
  writeJson(receiptPath, receipt);
  stage.observationReceiptPath = receiptPath;
  stage.observationReceiptSha256 = sha256(join(sandbox, receiptPath));
}

const receiptSetSha256 = (stages) => sha256Bytes(Buffer.from(
  `${stages.map((stage) => stage.observationReceiptSha256).join("\n")}\n`,
  "utf8",
));

function matched(stage, index, journal) {
  const signature = encodeBase58(Buffer.alloc(64, index + 1));
  stage.status = "FINALIZED_MATCHED";
  stage.signedMessageSha256 = createHash("sha256").update(`signed-message-stage-${index + 1}`).digest("hex");
  stage.signature = signature;
  stage.explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`;
  stage.confirmedAtUtc = `2026-08-01T00:${String(index).padStart(2, "0")}:00Z`;
  stage.observedAtUtc = `2026-08-01T00:${String(index).padStart(2, "0")}:30Z`;
  stage.observedPostStateSha256 = stage.expectedPostStateSha256;
  writeObservationReceipt(stage, index, journal);
}

try {
  for (const path of [journalPath, validatorPath, ...sourcePaths]) copy(path);
  writeJson("launch/release-snapshot.generated.json", { schema: "synthetic-regression-fixture", status: "HOLD" });

  expectPass("canonical HOLD", clone(baseline));

  const swapped = clone(baseline);
  [swapped.stages[0], swapped.stages[1]] = [swapped.stages[1], swapped.stages[0]];
  expectFail("swapped order", swapped, "breaks the immutable V2 order");

  const compensating = clone(baseline);
  compensating.controls.noCompensatingTransaction = false;
  expectFail("compensating transaction authority", compensating, "controls.noCompensatingTransaction must be true");

  const humanReviewer = clone(baseline);
  humanReviewer.controls.humanReviewerRequired = true;
  expectFail("human reviewer authorization gate", humanReviewer, "controls.humanReviewerRequired must be false");

  const selfAttestation = clone(baseline);
  selfAttestation.controls.noSelfAttestation = false;
  expectFail("self-attestation", selfAttestation, "controls.noSelfAttestation must be true");

  const ambiguousIntentHash = clone(baseline);
  ambiguousIntentHash.hashContract.reviewedIntentExcludes = ["signatures"];
  expectFail("intent hash that includes an expiring blockhash", ambiguousIntentHash, "hashContract must retain the exact reviewed intent, message, and post-state encodings");

  const staleEvidence = clone(baseline);
  staleEvidence.stages[0].signature = "2".repeat(88);
  expectFail("evidence retained on HOLD", staleEvidence, "HOLD requires stages[0].signature to be null");

  const credential = clone(baseline);
  credential.identity.secretKey = "do-not-store-credentials";
  expectFail("credential-shaped field", credential, "credential-shaped content");

  const missingCeremonyTimeArmed = armedFixture();
  const missingCeremonyTimeGate = JSON.parse(readFileSync(join(sandbox, "launch/iat-v2-mainnet-readiness-gate.json"), "utf8"));
  missingCeremonyTimeGate.schedule.scheduledAtUtc = null;
  writeJson("launch/iat-v2-mainnet-readiness-gate.json", missingCeremonyTimeGate);
  missingCeremonyTimeArmed.artifactDigests.readinessGateSha256 = sha256(join(sandbox, "launch/iat-v2-mainnet-readiness-gate.json"));
  expectFail("ARMED without exact ceremony time", missingCeremonyTimeArmed, "exact SCHEDULED_HOLD UTC ceremony time");

  const armed = armedFixture();
  expectPass("fully bound ARMED", armed);

  const armedWithSignedMessage = clone(armed);
  armedWithSignedMessage.stages[0].signedMessageSha256 = createHash("sha256").update("premature-message").digest("hex");
  expectFail("ARMED record retaining a signed message", armedWithSignedMessage, "PENDING requires stages[0].signedMessageSha256 to be null");

  const shapeOnlyAddress = clone(armed);
  shapeOnlyAddress.identity.programId = "2".repeat(32);
  expectFail("shape-only Base58 address", shapeOnlyAddress, "usable public identity.programId");

  const reconciled = clone(armed);
  reconciled.status = "RECONCILED";
  reconciled.stages.forEach((stage, index) => matched(stage, index, reconciled));
  Object.assign(reconciled.terminalDecision, {
    state: "RECONCILED",
    reasonCode: "ALL_STAGES_MATCHED",
    observationReceiptSetSha256: receiptSetSha256(reconciled.stages),
    observedAtUtc: "2026-08-01T00:09:00Z",
  });
  expectPass("eight-stage RECONCILED", reconciled);

  const finalizedWithoutMessage = clone(reconciled);
  finalizedWithoutMessage.stages[0].signedMessageSha256 = null;
  expectFail("finalized stage without signed message", finalizedWithoutMessage, "finalized evidence requires its signed-message digest");

  const shapeOnlySignature = clone(reconciled);
  shapeOnlySignature.stages[0].signature = "2".repeat(80);
  shapeOnlySignature.stages[0].explorerUrl = `https://explorer.solana.com/tx/${shapeOnlySignature.stages[0].signature}?cluster=mainnet-beta`;
  expectFail("shape-only Base58 signature", shapeOnlySignature, "requires a usable finalized signature");

  const earlyReconciledReview = clone(reconciled);
  earlyReconciledReview.terminalDecision.observedAtUtc = "2026-08-01T00:06:00Z";
  expectFail("terminal reconciliation before final stage observation", earlyReconciledReview, "cannot predate any stage observation");

  const alteredReceipt = clone(reconciled);
  alteredReceipt.stages[0].observationReceiptSha256 = "a".repeat(64);
  expectFail("altered observation receipt binding", alteredReceipt, "observationReceiptSha256 must bind the exact receipt bytes");

  const terminal = clone(armed);
  terminal.status = "TERMINAL_HOLD";
  matched(terminal.stages[0], 0, terminal);
  Object.assign(terminal.stages[1], {
    status: "FAILED_OR_MISMATCH",
    observedAtUtc: "2026-08-01T00:03:00Z",
    mismatchCode: "POST_STATE_MISMATCH",
  });
  writeObservationReceipt(terminal.stages[1], 1, terminal);
  for (const stage of terminal.stages.slice(2)) stage.status = "NOT_ATTEMPTED";
  Object.assign(terminal.terminalDecision, {
    state: "TERMINAL_HOLD",
    failedStage: terminal.stages[1].stage,
    reasonCode: "POST_STATE_MISMATCH",
    observationReceiptSetSha256: receiptSetSha256(terminal.stages.slice(0, 2)),
    observedAtUtc: "2026-08-01T00:04:00Z",
    publicIncidentUrl: "https://status.internalagency.io/public-incidents/iat-v2-stage-2",
  });
  expectPass("terminal first-mismatch HOLD", terminal);

  const divergentReason = clone(terminal);
  divergentReason.terminalDecision.reasonCode = "UNRELATED_FAILURE";
  expectFail("divergent terminal reason", divergentReason, "reasonCode must equal the stopped stage mismatchCode");

  const earlyTerminalReview = clone(terminal);
  earlyTerminalReview.terminalDecision.observedAtUtc = "2026-08-01T00:02:00Z";
  expectFail("terminal observation before stopped-stage observation", earlyTerminalReview, "cannot predate the stopped-stage observation");

  const placeholderIncident = clone(terminal);
  placeholderIncident.terminalDecision.publicIncidentUrl = "https://example.com/incident";
  expectFail("placeholder incident URL", placeholderIncident, "publicIncidentUrl must be null or a public HTTPS URL");

  const continuedAfterFailure = clone(terminal);
  matched(continuedAfterFailure.stages[2], 2, continuedAfterFailure);
  expectFail("continued execution after mismatch", continuedAfterFailure, "TERMINAL_HOLD stage 3 must be NOT_ATTEMPTED");

  const unresolved = clone(armed);
  unresolved.status = "TERMINAL_HOLD";
  const unresolvedSignature = encodeBase58(Buffer.alloc(64, 11));
  Object.assign(unresolved.stages[0], {
    status: "SUBMITTED_UNRESOLVED",
    signedMessageSha256: createHash("sha256").update("unresolved-signed-message").digest("hex"),
    signature: unresolvedSignature,
    explorerUrl: `https://explorer.solana.com/tx/${unresolvedSignature}?cluster=mainnet-beta`,
    observedAtUtc: "2026-08-01T00:03:00Z",
    mismatchCode: "CONFIRMATION_UNKNOWN",
  });
  writeObservationReceipt(unresolved.stages[0], 0, unresolved);
  for (const stage of unresolved.stages.slice(1)) stage.status = "NOT_ATTEMPTED";
  Object.assign(unresolved.terminalDecision, {
    state: "TERMINAL_HOLD",
    failedStage: unresolved.stages[0].stage,
    reasonCode: "CONFIRMATION_UNKNOWN",
    observationReceiptSetSha256: receiptSetSha256(unresolved.stages.slice(0, 1)),
    observedAtUtc: "2026-08-01T00:04:00Z",
  });
  expectPass("submitted but unresolved terminal HOLD", unresolved);

  const unresolvedWithoutSignature = clone(unresolved);
  unresolvedWithoutSignature.stages[0].signature = null;
  unresolvedWithoutSignature.stages[0].explorerUrl = null;
  expectFail("unresolved submission without signature", unresolvedWithoutSignature, "requires its usable public signature");

  const unresolvedWithoutMessage = clone(unresolved);
  unresolvedWithoutMessage.stages[0].signedMessageSha256 = null;
  expectFail("unresolved submission without signed message", unresolvedWithoutMessage, "requires its signed-message digest");

  const unresolvedWithConfirmationClaim = clone(unresolved);
  unresolvedWithConfirmationClaim.stages[0].confirmedAtUtc = "2026-08-01T00:02:00Z";
  expectFail("unresolved submission with confirmation claim", unresolvedWithConfirmationClaim, "cannot claim a confirmation time");

  const continuedAfterUnknown = clone(unresolved);
  matched(continuedAfterUnknown.stages[1], 1, continuedAfterUnknown);
  expectFail("continued execution after unresolved submission", continuedAfterUnknown, "TERMINAL_HOLD stage 2 must be NOT_ATTEMPTED");

  const duplicateSignature = clone(reconciled);
  duplicateSignature.stages[7].signature = duplicateSignature.stages[0].signature;
  duplicateSignature.stages[7].explorerUrl = duplicateSignature.stages[0].explorerUrl;
  expectFail("replayed signature", duplicateSignature, "duplicate stage signature");

  const alteredLimitations = clone(baseline);
  alteredLimitations.limitations[3] = "This altered statement is long but no longer preserves the reviewed publication boundary.";
  expectFail("altered limitations", alteredLimitations, "limitations must retain the five exact reviewed non-authorizing statements");

  console.log("IAT V2 stage-journal regression checks pass: HOLD hygiene, exact UTC ceremony scheduling, immutable order, automated source/receipt/state binding, Model T-only human signature confirmation, terminal stops, credential rejection, and replay resistance.");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
