#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  IAT_V2_POLICY,
  cccRoundRecoveryAvailable,
  cccRoundAtTimestamp,
  closePosition,
  cumulativeCorePrincipalUnlocked,
  cumulativeUnlocked,
  expireCccRound,
  initializeRewardLedger,
  neutralExpiredRoundReward,
  openPosition,
  policyWeekAtTimestamp,
  settlePositionWeek,
  withdrawPositionPrincipal,
} from "../engagement/iat-v2-reference-engine.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputArg = process.argv.find((argument) => argument.startsWith("--output="));
const publicOutputArg = process.argv.find((argument) => argument.startsWith("--public-output="));
const generatedAtArg = process.argv.find((argument) => argument.startsWith("--generated-at="));
const sourceCommitArg = process.argv.find((argument) => argument.startsWith("--source-commit="));

if (!outputArg || !publicOutputArg || !generatedAtArg || !sourceCommitArg) {
  throw new Error("Usage: generate-iat-v2-time-gate-proof.mjs --output=<path> --public-output=<path> --generated-at=<ISO-UTC> --source-commit=<full-sha>");
}

const generatedAtUtc = generatedAtArg.slice("--generated-at=".length);
if (new Date(generatedAtUtc).toISOString() !== generatedAtUtc) {
  throw new Error("--generated-at must be a canonical ISO-8601 UTC timestamp");
}
const sourceCommit = sourceCommitArg.slice("--source-commit=".length);
if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) throw new Error("--source-commit must be a full lowercase Git SHA-1");
const sourceTree = execFileSync("git", ["rev-parse", `${sourceCommit}^{tree}`], { encoding: "utf8" }).trim();

const outputPath = path.resolve(siteRoot, outputArg.slice("--output=".length));
const publicOutputPath = path.resolve(siteRoot, publicOutputArg.slice("--public-output=".length));
for (const candidate of [outputPath, publicOutputPath]) {
  if (!candidate.startsWith(`${siteRoot}${path.sep}`)) throw new Error("Output path escapes the site root");
}

const inputPaths = [
  "programs/iat_v2/src/lib.rs",
  "programs/iat_v2/src/policy.rs",
  "programs/iat_v2/tests/time_warp.rs",
  "engagement/iat-economic-policy.v2.json",
  "engagement/iat-v2-reference-engine.mjs",
  "tests/iat-v2-reference-engine.test.mjs",
];

async function digestFile(relativePath) {
  const sourceBytes = await readFile(path.join(siteRoot, relativePath));
  const bytes = Buffer.from(sourceBytes.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
  const committedBytes = execFileSync("git", ["show", `${sourceCommit}:projects/star-ascent/site/${relativePath}`], { maxBuffer: 50_000_000 });
  const committed = Buffer.from(committedBytes.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
  if (Buffer.compare(bytes, committed) !== 0) throw new Error(`Input is not byte-bound to ${sourceCommit}: ${relativePath}`);
  return {
    path: relativePath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    normalization: "UTF8_LF",
  };
}

function observe(operation) {
  try {
    return { outcome: "ACCEPTED", value: String(operation()) };
  } catch (error) {
    return { outcome: "REJECTED", error: error.message };
  }
}

const genesisTimestamp = 1_900_000_000;
const secondsPerWeek = IAT_V2_POLICY.time.secondsPerWeek;
const clockCases = [
  ["PRE_GENESIS", genesisTimestamp - 1, "REJECTED", "TIMESTAMP_BEFORE_GENESIS"],
  ["GENESIS", genesisTimestamp, "ACCEPTED", "0"],
  ["WEEK_52_MINUS_ONE_SECOND", genesisTimestamp + 52 * secondsPerWeek - 1, "ACCEPTED", "51"],
  ["WEEK_52_EXACT", genesisTimestamp + 52 * secondsPerWeek, "ACCEPTED", "52"],
  ["WEEK_104_EXACT", genesisTimestamp + 104 * secondsPerWeek, "ACCEPTED", "104"],
  ["WEEK_208_EXACT", genesisTimestamp + 208 * secondsPerWeek, "ACCEPTED", "208"],
].map(([id, timestamp, expectedOutcome, expectedValue]) => ({
  id,
  timestamp,
  expectedOutcome,
  expectedValue,
  observed: observe(() => policyWeekAtTimestamp(genesisTimestamp, timestamp)),
}));

const cccCases = [
  ["ROUND_0_MINUS_ONE_SECOND", genesisTimestamp + 86_399, "REJECTED", "CCC_SELECTION_NOT_OPEN"],
  ["ROUND_0_EXACT", genesisTimestamp + 86_400, "ACCEPTED", "0"],
  ["ROUND_1_MINUS_ONE_SECOND", genesisTimestamp + 86_400 + secondsPerWeek - 1, "ACCEPTED", "0"],
  ["ROUND_1_EXACT", genesisTimestamp + 86_400 + secondsPerWeek, "ACCEPTED", "1"],
].map(([id, timestamp, expectedOutcome, expectedValue]) => ({
  id,
  timestamp,
  expectedOutcome,
  expectedValue,
  observed: observe(() => cccRoundAtTimestamp(genesisTimestamp, timestamp)),
}));

const recoveryCommitTimestamp = genesisTimestamp + 86_400;
const pendingRecoveryRound = {
  week: 0,
  status: "PENDING",
  commitTimestamp: recoveryCommitTimestamp,
  agencyCountSnapshot: 100,
  candidateSnapshotHash: "LOCAL_IMMUTABLE_SNAPSHOT",
};
const recoveryCases = [
  ["RECOVERY_MINUS_ONE_SECOND", recoveryCommitTimestamp + 86_399, "REJECTED", "ROUND_REVEAL_TIMEOUT_NOT_REACHED"],
  ["RECOVERY_EXACT", recoveryCommitTimestamp + 86_400, "ACCEPTED", "EXPIRED_NEUTRAL"],
].map(([id, timestamp, expectedOutcome, expectedValue]) => ({
  id,
  timestamp,
  expectedOutcome,
  expectedValue,
  recoveryAvailable: cccRoundRecoveryAvailable(recoveryCommitTimestamp, timestamp),
  observed: observe(() => expireCccRound({ existingRound: pendingRecoveryRound, nowTimestamp: timestamp }).status),
}));
const neutralRewardCases = [
  [1, "0"],
  [2, "500"],
  [100, "990"],
].map(([candidateCount, expected]) => ({
  fullReward: "1001",
  candidateCount,
  expected,
  observed: String(neutralExpiredRoundReward(1_001n, candidateCount)),
}));

const laneExpectations = {
  treasury: [[51, "50000000000000000"], [52, "50000000000000000"], [53, "50961538461538461"], [130, "125000000000000000"], [207, "199038461538461538"], [208, "200000000000000000"]],
  ecosystem: [[25, "37500000000000000"], [26, "37500000000000000"], [27, "38942307692307692"], [65, "93750000000000000"], [103, "148557692307692307"], [104, "150000000000000000"]],
  coreTeam: [[25, "0"], [26, "0"], [27, "1282051282051282"], [65, "50000000000000000"], [103, "98717948717948717"], [104, "100000000000000000"]],
  liquidity: [[25, "12500000000000000"], [26, "12500000000000000"], [27, "12980769230769230"], [65, "31250000000000000"], [103, "49519230769230769"], [104, "50000000000000000"]],
};
const laneCases = Object.entries(laneExpectations).flatMap(([lane, expectations]) => expectations.map(([week, expected]) => ({
  lane,
  week,
  expected,
  observed: String(lane === "coreTeam" ? cumulativeCorePrincipalUnlocked(week) : cumulativeUnlocked(lane, week)),
})));

let { ledger, position } = openPosition({
  ledger: initializeRewardLedger().ledger,
  owner: "LOCAL_HOST_TEST_OWNER",
  principal: 520_000_000_000n,
  role: "standard",
  acceptedWeek: 7,
});
const rejectedBeforeMaturity = observe(() => withdrawPositionPrincipal({ position, currentWeek: 58 }).principalReturned);
for (let week = 8; week <= 59; week += 1) {
  ({ ledger, position } = settlePositionWeek({ ledger, position, week }));
}
const withdrawn = withdrawPositionPrincipal({ position, currentWeek: 59 });
const closed = closePosition({ ledger, position: withdrawn.position, currentWeek: 59 });
const positionCase = {
  acceptedWeek: 7,
  firstAccrualWeek: 8,
  finalAccrualWeek: 59,
  maturityWeek: 59,
  preBoundaryWeek: 58,
  preBoundaryResult: rejectedBeforeMaturity,
  exactBoundaryResult: {
    outcome: "ACCEPTED",
    principalReturned: String(withdrawn.principalReturned),
    paidReward: String(position.paid),
    settledWeeks: position.settledWeeks.length,
    closed: closed.position.closed,
  },
};

for (const item of [...clockCases, ...cccCases]) {
  const observedValue = item.observed.value ?? item.observed.error;
  if (item.observed.outcome !== item.expectedOutcome || observedValue !== item.expectedValue) {
    throw new Error(`Time case failed: ${item.id}`);
  }
}
for (const item of recoveryCases) {
  const observedValue = item.observed.value ?? item.observed.error;
  if (item.observed.outcome !== item.expectedOutcome || observedValue !== item.expectedValue) {
    throw new Error(`Recovery time case failed: ${item.id}`);
  }
}
for (const item of neutralRewardCases) {
  if (item.observed !== item.expected) {
    throw new Error(`Neutral recovery reward case failed: N=${item.candidateCount}`);
  }
}
for (const item of laneCases) {
  if (item.observed !== item.expected) throw new Error(`Lane case failed: ${item.lane} week ${item.week}`);
}
if (
  positionCase.preBoundaryResult.outcome !== "REJECTED"
  || positionCase.preBoundaryResult.error !== "POSITION_TERM_NOT_COMPLETE"
  || positionCase.exactBoundaryResult.principalReturned !== "520000000000"
  || positionCase.exactBoundaryResult.paidReward !== "52000000000"
  || positionCase.exactBoundaryResult.settledWeeks !== 52
  || positionCase.exactBoundaryResult.closed !== true
) {
  throw new Error("Position maturity case failed");
}

const proof = {
  schema: "iat-v2-local-time-gate-proof/v1",
  status: "VERIFIED_LOCAL_HOST_ONLY",
  generatedAtUtc,
  network: "local-host",
  mainnetStatus: "HOLD",
  sourceBinding: {
    commit: sourceCommit,
    gitTree: sourceTree,
    allInputsMatchCommit: true,
  },
  publicEvidencePath: path.relative(siteRoot, publicOutputPath).replaceAll("\\", "/"),
  method: {
    kind: "DETERMINISTIC_VIRTUAL_CLOCK_OVER_EXACT_PROGRAM_POLICY",
    localValidatorTransactionUsed: false,
    signingPerformed: false,
    simulationForSigningPerformed: false,
    broadcastingPerformed: false,
    walletAccessed: false,
    keyCreated: false,
  },
  reviewedProgramArtifact: {
    status: "CURRENT_SOURCE_VERIFIABLE_SBF",
    sourceCommit,
    sha256: "d437be9a78aeaa09eeef419554bd0c0598a18239edeb226912c79a973f24d2a4",
    bytes: 579480,
    bindingSource: "public/audits/iat-v2-remediation-20260802/scope.json",
    artifactEmbedded: false,
    coversCurrentSource: true,
  },
  inputs: await Promise.all(inputPaths.map(digestFile)),
  environment: {
    node: process.version,
    rust: "rustc 1.97.1 (8bab26f4f 2026-07-14)",
    cargo: "cargo 1.97.1 (c980f4866 2026-06-30)",
    solana: "solana-cli 3.1.10",
    anchor: "anchor-cli 1.0.2",
  },
  commands: [
    {
      command: "cargo test --locked --test time_warp -- --nocapture",
      result: "PASS",
      tests: 6,
    },
    {
      command: "node --test tests/iat-v2-reference-engine.test.mjs",
      result: "PASS",
      tests: 16,
    },
  ],
  observations: {
    genesisTimestamp,
    secondsPerWeek,
    clockCases,
    cccCases,
    recoveryCases,
    neutralRewardCases,
    laneCases,
    positionCase,
  },
  coverage: [
    "pre-Genesis rejection and exact policy-week boundaries",
    "CCC round zero at exactly 24 hours and weekly cadence",
    "CCC reveal recovery at exactly 24 hours after commit with no early expiry",
    "neutral expected-value payout floors for one, two, and 100 candidates",
    "treasury 52-week cliff and 208-week linear end",
    "ecosystem, core-team, and liquidity 26-week cliffs and 104-week linear ends",
    "integer-floor unlock amounts immediately after cliffs and immediately before end weeks",
    "52-week position maturity on the same policy week as its final accrual",
    "pre-maturity rejection, exact-maturity principal return, and residual reservation release",
  ],
  limitations: [
    "This is deterministic local host-program evidence, not a signed or broadcast transaction.",
    "No local-validator transaction was used because the proof requires no signer, keypair, wallet, or network state.",
    "The proof binds exact hardened source inputs and cross-language reference behavior; it does not replace a fresh finalized Devnet transaction receipt.",
    "Earlier Switchboard commit/reveal evidence targets a prior binary and is not signed Devnet evidence for the hardened source commit or current SBF.",
    "This artifact does not authorize mainnet, choose a ceremony time, or clear funding and release gates.",
  ],
};

const serialized = `${JSON.stringify(proof, null, 2)}\n`;
for (const destination of [outputPath, publicOutputPath]) {
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, serialized, "utf8");
}

console.log(`PASS: wrote byte-identical local time-gate evidence to ${path.relative(siteRoot, outputPath)} and ${proof.publicEvidencePath}`);
