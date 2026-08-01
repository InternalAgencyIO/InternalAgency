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
  readiness.schedule = { state: "SCHEDULED_HOLD", publishedAtUtc: "2026-07-31T23:30:00Z", priorWindow: readiness.schedule.priorWindow };
  readiness.funding.observedLamports = readiness.funding.ceremonyFloorLamports;
  readiness.funding.shortfallToCeremonyFloorLamports = "0";
  readiness.funding.ceremonyFloorSatisfied = true;
  for (const field of ["mainnetFundingFloorSatisfied", "replacementUtcWindowPublished", "releaseArtifactsRegeneratedAfterFundingAndScheduling", "finalPreflightPassedAgainstRegeneratedArtifacts", "physicalModelTDevicePathReviewed", "physicalModelTReviewCompleted", "independentMainnetVerifierAssigned", "mainnetExecutionAuthorized"]) readiness.gates[field] = true;
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
    programId: "2".repeat(32),
    programDataAddress: "3".repeat(32),
    mint: "4".repeat(32),
    administrator: "5".repeat(32),
  });
  for (const [index, stage] of journal.stages.entries()) {
    stage.plannedTransactionMessageSha256 = createHash("sha256").update(`planned-stage-${index + 1}`).digest("hex");
    stage.expectedPostStateSha256 = createHash("sha256").update(`expected-stage-${index + 1}`).digest("hex");
  }
  return journal;
}

function matched(stage, index) {
  const signature = String(index + 2).repeat(88);
  stage.status = "FINALIZED_MATCHED";
  stage.signature = signature;
  stage.explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`;
  stage.confirmedAtUtc = `2026-08-01T00:${String(index).padStart(2, "0")}:00Z`;
  stage.independentlyVerifiedAtUtc = `2026-08-01T00:${String(index).padStart(2, "0")}:30Z`;
  stage.independentVerifierLabel = `independent-verifier-${index + 1}`;
  stage.observedPostStateSha256 = stage.expectedPostStateSha256;
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

  const staleEvidence = clone(baseline);
  staleEvidence.stages[0].signature = "2".repeat(88);
  expectFail("evidence retained on HOLD", staleEvidence, "HOLD requires stages[0].signature to be null");

  const credential = clone(baseline);
  credential.identity.secretKey = "do-not-store-credentials";
  expectFail("credential-shaped field", credential, "credential-shaped content");

  const armed = armedFixture();
  expectPass("fully bound ARMED", armed);

  const reconciled = clone(armed);
  reconciled.status = "RECONCILED";
  reconciled.stages.forEach(matched);
  Object.assign(reconciled.terminalDecision, {
    state: "RECONCILED",
    reasonCode: "ALL_STAGES_MATCHED",
    reviewedAtUtc: "2026-08-01T00:09:00Z",
    reviewerLabel: "independent-terminal-reviewer",
  });
  expectPass("eight-stage RECONCILED", reconciled);

  const terminal = clone(armed);
  terminal.status = "TERMINAL_HOLD";
  matched(terminal.stages[0], 0);
  Object.assign(terminal.stages[1], {
    status: "FAILED_OR_MISMATCH",
    independentlyVerifiedAtUtc: "2026-08-01T00:03:00Z",
    independentVerifierLabel: "independent-failure-reviewer",
    mismatchCode: "POST_STATE_MISMATCH",
  });
  for (const stage of terminal.stages.slice(2)) stage.status = "NOT_ATTEMPTED";
  Object.assign(terminal.terminalDecision, {
    state: "TERMINAL_HOLD",
    failedStage: terminal.stages[1].stage,
    reasonCode: "POST_STATE_MISMATCH",
    reviewedAtUtc: "2026-08-01T00:04:00Z",
    reviewerLabel: "independent-terminal-reviewer",
    publicIncidentUrl: "https://example.com/public-incidents/iat-v2-stage-2",
  });
  expectPass("terminal first-mismatch HOLD", terminal);

  const continuedAfterFailure = clone(terminal);
  matched(continuedAfterFailure.stages[2], 2);
  expectFail("continued execution after mismatch", continuedAfterFailure, "TERMINAL_HOLD stage 3 must be NOT_ATTEMPTED");

  const duplicateSignature = clone(reconciled);
  duplicateSignature.stages[7].signature = duplicateSignature.stages[0].signature;
  duplicateSignature.stages[7].explorerUrl = duplicateSignature.stages[0].explorerUrl;
  expectFail("replayed signature", duplicateSignature, "duplicate stage signature");

  console.log("IAT V2 stage-journal regression checks pass: HOLD hygiene, immutable order, source binding, eight matched stages, first-mismatch terminal stop, credential rejection, and replay resistance.");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
