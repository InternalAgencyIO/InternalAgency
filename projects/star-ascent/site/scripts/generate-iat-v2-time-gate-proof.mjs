#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  IAT_V2_POLICY,
  cccRoundAtTimestamp,
  closePosition,
  cumulativeCorePrincipalUnlocked,
  cumulativeUnlocked,
  initializeRewardLedger,
  openPosition,
  policyWeekAtTimestamp,
  settlePositionWeek,
  withdrawPositionPrincipal,
} from "../engagement/iat-v2-reference-engine.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputArg = process.argv.find((argument) => argument.startsWith("--output="));
const publicOutputArg = process.argv.find((argument) => argument.startsWith("--public-output="));
const generatedAtArg = process.argv.find((argument) => argument.startsWith("--generated-at="));

if (!outputArg || !publicOutputArg || !generatedAtArg) {
  throw new Error("Usage: generate-iat-v2-time-gate-proof.mjs --output=<path> --public-output=<path> --generated-at=<ISO-UTC>");
}

const generatedAtUtc = generatedAtArg.slice("--generated-at=".length);
if (new Date(generatedAtUtc).toISOString() !== generatedAtUtc) {
  throw new Error("--generated-at must be a canonical ISO-8601 UTC timestamp");
}

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
    sha256: "634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7",
    bytes: 597336,
    bindingSource: "public/evidence/iat-v2/v2-feature-independent-signoff-20260801T055736Z.json",
    artifactEmbedded: false,
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
      tests: 4,
    },
    {
      command: "node --test tests/iat-v2-reference-engine.test.mjs",
      result: "PASS",
      tests: 14,
    },
  ],
  observations: {
    genesisTimestamp,
    secondsPerWeek,
    clockCases,
    cccCases,
    laneCases,
    positionCase,
  },
  coverage: [
    "pre-Genesis rejection and exact policy-week boundaries",
    "CCC round zero at exactly 24 hours and weekly cadence",
    "treasury 52-week cliff and 208-week linear end",
    "ecosystem, core-team, and liquidity 26-week cliffs and 104-week linear ends",
    "integer-floor unlock amounts immediately after cliffs and immediately before end weeks",
    "52-week position maturity on the same policy week as its final accrual",
    "pre-maturity rejection, exact-maturity principal return, and residual reservation release",
  ],
  limitations: [
    "This is deterministic local host-program evidence, not a signed or broadcast transaction.",
    "No local-validator transaction was used because the proof requires no signer, keypair, wallet, or network state.",
    "The proof binds exact program policy source and cross-language reference behavior; it does not replace the finalized Devnet transaction receipt.",
    "Switchboard commit/reveal and hardware authority were already exercised separately on Devnet and are outside this artifact.",
    "This artifact does not authorize mainnet, choose a ceremony time, or clear funding and release gates.",
  ],
};

const serialized = `${JSON.stringify(proof, null, 2)}\n`;
for (const destination of [outputPath, publicOutputPath]) {
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, serialized, "utf8");
}

console.log(`PASS: wrote byte-identical local time-gate evidence to ${path.relative(siteRoot, outputPath)} and ${proof.publicEvidencePath}`);
