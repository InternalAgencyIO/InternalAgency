#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cccRoundRecoveryAvailable,
  cccRoundAtTimestamp,
  cumulativeCorePrincipalUnlocked,
  cumulativeUnlocked,
  expireCccRound,
  neutralExpiredRoundReward,
  policyWeekAtTimestamp,
} from "../engagement/iat-v2-reference-engine.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPath = path.join(siteRoot, "launch/iat-v2-local-time-gate-proof.json");
const canonicalBytes = await readFile(canonicalPath);
const proof = JSON.parse(canonicalBytes.toString("utf8"));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function observe(operation) {
  try {
    return { outcome: "ACCEPTED", value: String(operation()) };
  } catch (error) {
    return { outcome: "REJECTED", error: error.message };
  }
}

check(proof.schema === "iat-v2-local-time-gate-proof/v1", "unexpected proof schema");
check(proof.status === "VERIFIED_LOCAL_HOST_ONLY", "time-gate proof is not verified");
check(proof.network === "local-host", "time-gate proof must remain local-only");
check(proof.mainnetStatus === "HOLD", "time-gate proof must preserve mainnet HOLD");
check(proof.method?.kind === "DETERMINISTIC_VIRTUAL_CLOCK_OVER_EXACT_PROGRAM_POLICY", "unexpected proof method");
for (const field of ["localValidatorTransactionUsed", "signingPerformed", "simulationForSigningPerformed", "broadcastingPerformed", "walletAccessed", "keyCreated"]) {
  check(proof.method?.[field] === false, `unsafe method flag changed: ${field}`);
}
check(
  proof.reviewedProgramArtifact?.sha256 === "d01d56161396ce7de28c1ff8c7386bf2fdf1014f6f62935c29106054b0e93e22"
    && proof.reviewedProgramArtifact?.bytes === 606320
    && proof.reviewedProgramArtifact?.bindingSource === "public/audits/iat-v2-remediation-20260802/scope.json"
    && proof.reviewedProgramArtifact?.artifactEmbedded === false,
  "reviewed program artifact binding drift",
);

const publicPath = path.resolve(siteRoot, proof.publicEvidencePath ?? "");
check(publicPath.startsWith(`${siteRoot}${path.sep}`), "public evidence path escapes site root");
const publicBytes = await readFile(publicPath);
check(Buffer.compare(canonicalBytes, publicBytes) === 0, "launch and public proof bytes differ");

for (const input of proof.inputs ?? []) {
  const inputPath = path.resolve(siteRoot, input.path);
  check(inputPath.startsWith(`${siteRoot}${path.sep}`), `input escapes site root: ${input.path}`);
  const sourceBytes = await readFile(inputPath);
  const bytes = Buffer.from(sourceBytes.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
  check(input.normalization === "UTF8_LF", `input normalization drift: ${input.path}`);
  check(bytes.length === input.bytes, `input byte count drift: ${input.path}`);
  check(createHash("sha256").update(bytes).digest("hex") === input.sha256, `input hash drift: ${input.path}`);
}
check(proof.inputs?.length === 6, "expected six exact source/test inputs");

const expectedClock = {
  PRE_GENESIS: ["REJECTED", "TIMESTAMP_BEFORE_GENESIS"],
  GENESIS: ["ACCEPTED", "0"],
  WEEK_52_MINUS_ONE_SECOND: ["ACCEPTED", "51"],
  WEEK_52_EXACT: ["ACCEPTED", "52"],
  WEEK_104_EXACT: ["ACCEPTED", "104"],
  WEEK_208_EXACT: ["ACCEPTED", "208"],
};
for (const item of proof.observations?.clockCases ?? []) {
  const observed = observe(() => policyWeekAtTimestamp(proof.observations.genesisTimestamp, item.timestamp));
  const expected = expectedClock[item.id];
  check(Boolean(expected), `unknown clock case: ${item.id}`);
  check(item.expectedOutcome === expected?.[0] && item.expectedValue === expected?.[1], `clock expectation drift: ${item.id}`);
  check(JSON.stringify(item.observed) === JSON.stringify(observed), `clock observation drift: ${item.id}`);
}
check(proof.observations?.clockCases?.length === 6, "expected six clock cases");

const expectedCcc = {
  ROUND_0_MINUS_ONE_SECOND: ["REJECTED", "CCC_SELECTION_NOT_OPEN"],
  ROUND_0_EXACT: ["ACCEPTED", "0"],
  ROUND_1_MINUS_ONE_SECOND: ["ACCEPTED", "0"],
  ROUND_1_EXACT: ["ACCEPTED", "1"],
};
for (const item of proof.observations?.cccCases ?? []) {
  const observed = observe(() => cccRoundAtTimestamp(proof.observations.genesisTimestamp, item.timestamp));
  const expected = expectedCcc[item.id];
  check(Boolean(expected), `unknown CCC case: ${item.id}`);
  check(item.expectedOutcome === expected?.[0] && item.expectedValue === expected?.[1], `CCC expectation drift: ${item.id}`);
  check(JSON.stringify(item.observed) === JSON.stringify(observed), `CCC observation drift: ${item.id}`);
}
check(proof.observations?.cccCases?.length === 4, "expected four CCC cases");

const expectedRecovery = {
  RECOVERY_MINUS_ONE_SECOND: ["REJECTED", "ROUND_REVEAL_TIMEOUT_NOT_REACHED", false],
  RECOVERY_EXACT: ["ACCEPTED", "EXPIRED_NEUTRAL", true],
};
for (const item of proof.observations?.recoveryCases ?? []) {
  const expected = expectedRecovery[item.id];
  check(Boolean(expected), `unknown recovery case: ${item.id}`);
  const pending = {
    week: 0,
    status: "PENDING",
    commitTimestamp: proof.observations.genesisTimestamp + 86_400,
    agencyCountSnapshot: 100,
    candidateSnapshotHash: "LOCAL_IMMUTABLE_SNAPSHOT",
  };
  const observed = observe(() => expireCccRound({ existingRound: pending, nowTimestamp: item.timestamp }).status);
  check(item.expectedOutcome === expected?.[0] && item.expectedValue === expected?.[1], `recovery expectation drift: ${item.id}`);
  check(item.recoveryAvailable === expected?.[2], `recovery availability drift: ${item.id}`);
  check(
    item.recoveryAvailable === cccRoundRecoveryAvailable(pending.commitTimestamp, item.timestamp),
    `recovery predicate drift: ${item.id}`,
  );
  check(JSON.stringify(item.observed) === JSON.stringify(observed), `recovery observation drift: ${item.id}`);
}
check(proof.observations?.recoveryCases?.length === 2, "expected two recovery boundary cases");

for (const item of proof.observations?.neutralRewardCases ?? []) {
  const observed = String(neutralExpiredRoundReward(BigInt(item.fullReward), item.candidateCount));
  check(item.observed === item.expected && observed === item.expected, `neutral reward drift: N=${item.candidateCount}`);
}
check(proof.observations?.neutralRewardCases?.length === 3, "expected three neutral reward cases");

for (const item of proof.observations?.laneCases ?? []) {
  const observed = String(item.lane === "coreTeam" ? cumulativeCorePrincipalUnlocked(item.week) : cumulativeUnlocked(item.lane, item.week));
  check(observed === item.expected && item.observed === item.expected, `lane observation drift: ${item.lane} week ${item.week}`);
}
check(proof.observations?.laneCases?.length === 24, "expected 24 cliff/linear cases");

const position = proof.observations?.positionCase;
check(position?.acceptedWeek === 7 && position?.firstAccrualWeek === 8, "position acceptance boundary drift");
check(position?.finalAccrualWeek === 59 && position?.maturityWeek === 59, "position maturity boundary drift");
check(
  position?.preBoundaryWeek === 58
    && position?.preBoundaryResult?.outcome === "REJECTED"
    && position?.preBoundaryResult?.error === "POSITION_TERM_NOT_COMPLETE",
  "position pre-maturity rejection drift",
);
check(
  position?.exactBoundaryResult?.outcome === "ACCEPTED"
    && position?.exactBoundaryResult?.principalReturned === "520000000000"
    && position?.exactBoundaryResult?.paidReward === "52000000000"
    && position?.exactBoundaryResult?.settledWeeks === 52
    && position?.exactBoundaryResult?.closed === true,
  "position exact-maturity result drift",
);
check(proof.commands?.every(({ result }) => result === "PASS"), "a recorded proof command did not pass");
check(proof.limitations?.length === 5, "proof limitations must remain explicit");

if (failures.length) {
  console.error("IAT V2 local time-gate proof validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("IAT V2 local time-gate proof validation passed: 6 Rust host tests, 16 JS tests, 39 exact clock/cliff/maturity/recovery vectors, no signing or broadcast, mainnet HOLD.");
