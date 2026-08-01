#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gatePath = path.join(siteRoot, "launch/iat-v2-mainnet-readiness-gate.json");
const gate = JSON.parse(await readFile(gatePath, "utf8"));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(gate.schema === "iat-v2-mainnet-readiness-gate/v1", "unexpected readiness schema");
check(gate.status === "HOLD" && gate.network === "mainnet-beta", "mainnet readiness must remain HOLD");
check(gate.schedule?.state === "UNSCHEDULED_HOLD", "schedule must remain UNSCHEDULED_HOLD");
check(gate.schedule?.publishedAtUtc === null, "replacement UTC window must not be populated before publication");
check(
  gate.schedule?.priorWindow?.state === "EXPIRED_SUPERSEDED_DO_NOT_USE",
  "prior window must be explicitly expired and non-actionable",
);

const observed = BigInt(gate.funding?.observedLamports ?? "-1");
const rentMinimum = BigInt(gate.funding?.measuredRentExemptMinimumLamports ?? "-1");
const ceremonyFloor = BigInt(gate.funding?.ceremonyFloorLamports ?? "-1");
check(ceremonyFloor === 8_500_000_000n, "ceremony floor must remain exactly 8.5 SOL");
check(
  BigInt(gate.funding?.shortfallToRentMinimumLamports ?? "-1") === rentMinimum - observed,
  "rent-minimum shortfall arithmetic drift",
);
check(
  BigInt(gate.funding?.shortfallToCeremonyFloorLamports ?? "-1") === ceremonyFloor - observed,
  "ceremony-floor shortfall arithmetic drift",
);
check(
  gate.funding?.ceremonyFloorSatisfied === (observed >= ceremonyFloor),
  "ceremony-floor Boolean does not match recorded integer balance",
);
check(gate.funding?.ceremonyFloorSatisfied === false, "recorded observation must retain the funding blocker");

const proofPath = path.resolve(siteRoot, gate.timeGateEvidence?.path ?? "");
check(proofPath.startsWith(`${siteRoot}${path.sep}`), "time-gate evidence path escapes site root");
const proofBytes = await readFile(proofPath);
check(
  createHash("sha256").update(proofBytes).digest("hex") === gate.timeGateEvidence?.sha256,
  "time-gate evidence digest drift",
);
check(
  gate.timeGateEvidence?.status === "VERIFIED_LOCAL_HOST_ONLY"
    && gate.timeGateEvidence?.signedDevnetEvidence === false
    && gate.timeGateEvidence?.validatorTransaction === false,
  "local time-gate limitations changed",
);

for (const [name, value] of Object.entries(gate.gates ?? {})) {
  if (name.endsWith("Satisfied") || name.endsWith("Published") || name.endsWith("RegeneratedAfterFundingAndScheduling") || name.endsWith("PassedAgainstRegeneratedArtifacts") || name.endsWith("Completed") || name.endsWith("Assigned") || name.endsWith("Authorized")) {
    check(value === false, `pending mainnet gate became true without a new readiness record: ${name}`);
  }
}
for (const [name, value] of Object.entries(gate.safety ?? {})) {
  if (name === "authorizesTransaction") check(value === false, "readiness file cannot authorize a transaction");
  else check(value === false, `unsafe action recorded in readiness gate: ${name}`);
}

const expectedOrder = [
  "FUND_PUBLIC_MAINNET_ADDRESS_TO_AT_LEAST_8500000000_LAMPORTS",
  "RECORD_FRESH_READ_ONLY_BALANCE_OBSERVATION",
  "PUBLISH_ONE_NEW_EXACT_UTC_WINDOW",
  "REGENERATE_ALL_BOUND_RELEASE_ARTIFACTS",
  "RUN_COMPLETE_PREFLIGHT_AND_INDEPENDENT_REVIEW",
  "CONDUCT_HUMAN_CONTROLLED_HARDWARE_CEREMONY",
  "BROADCAST_ONLY_AFTER_SEPARATE_EXPLICIT_APPROVAL",
  "RECONCILE_CONFIRMED_CHAIN_STATE_BEFORE_PUBLICATION",
];
check(JSON.stringify(gate.requiredOrder) === JSON.stringify(expectedOrder), "required launch order drift");

async function collectTextFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTextFiles(absolute));
    else if ([".md", ".mjs", ".ts", ".tsx", ".txt"].includes(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

const activeFiles = [
  ...await collectTextFiles(path.join(siteRoot, "app")),
  ...await collectTextFiles(path.join(siteRoot, "launch")),
];
const staleActionableSchedule = /30 JUL(?:Y)? 2026|30 July 2026|30 TEM(?:MUZ)? 2026|03:45:00 UTC|06:45:00 (?:ISTANBUL|Istanbul|İSTANBUL|İstanbul)|EXACT WINDOW SCHEDULED/u;
for (const activePath of activeFiles) {
  const source = await readFile(activePath, "utf8");
  check(!staleActionableSchedule.test(source), `active surface retains the expired ceremony time: ${path.relative(siteRoot, activePath)}`);
}

if (failures.length) {
  console.error("IAT V2 mainnet readiness validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("IAT V2 mainnet readiness gate passed: exact 8.5 SOL floor, UNSCHEDULED_HOLD, ordered regeneration/ceremony controls, no signing or broadcast.");
