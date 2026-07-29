#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PublicKey } from "@solana/web3.js";

const canonicalPath = "launch/allocation-lock-plan.template.json";
const requestedPath = process.argv[2] ?? canonicalPath;
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const METADATA_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
const MODEL_T = "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
const expected = {
  community: ["50%", "500000000000000000", "PUBLIC_DISTRIBUTION_CUSTODY", false, 0, 0, "PUBLIC_CAMPAIGNS_ONLY"],
  treasury: ["20%", "200000000000000000", "EXTERNAL_VESTING_VAULT", true, 12, 36, "CLIFF_THEN_LINEAR"],
  ecosystem: ["15%", "150000000000000000", "EXTERNAL_VESTING_VAULT", true, 6, 24, "CLIFF_THEN_LINEAR"],
  coreTeam: ["10%", "100000000000000000", "EXTERNAL_VESTING_VAULT", true, 12, 36, "CLIFF_THEN_LINEAR"],
  liquidity: ["5%", "50000000000000000", "LIQUIDITY_RESERVE_VAULT", true, 0, 0, "LOCKED_UNTIL_PUBLIC_LIQUIDITY_PROPOSAL"],
};
const allocationFields = [
  "share", "baseUnitAmount", "ownerAddress", "custodyModel", "lockRequired",
  "cliffMonths", "releaseMonths", "releaseRule", "lockProgramId",
  "vaultEvidence", "programEvidence", "scheduleEvidence",
];
const failures = [];
const fail = (message) => failures.push(message);
const exactKeys = (value, keys) =>
  value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const usableAddress = (value) => {
  try {
    return typeof value === "string" && new PublicKey(value).toBytes().length === 32;
  } catch {
    return false;
  }
};
const isOffCurve = (value) => usableAddress(value) && !PublicKey.isOnCurve(new PublicKey(value).toBytes());
const addressEvidence = (value, address) => value === `https://explorer.solana.com/address/${address}`;
const isHttps = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
};
const isUtc = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value));
const usableLabel = (value) => typeof value === "string"
  && value === value.trim()
  && value.length >= 3
  && value.length <= 80
  && !/^(reviewer|operator|pending|tbd|unknown)$/i.test(value);
const planDigest = (record) => createHash("sha256").update(JSON.stringify({
  version: record.version,
  network: record.network,
  allocations: record.allocations,
})).digest("hex");

if (requestedPath.replaceAll("\\", "/") !== canonicalPath) fail(`lock-plan path must be ${canonicalPath}`);

let record;
try {
  record = JSON.parse(readFileSync(resolve(canonicalPath), "utf8"));
} catch (error) {
  fail(`lock plan is unreadable: ${error.message}`);
}

if (record) {
  if (!exactKeys(record, ["version", "status", "network", "allocations", "independentReview"])) fail("lock plan must contain only canonical fields");
  if (!exactKeys(record.independentReview, ["reviewedBy", "reviewedAtUtc", "planSha256"])) fail("independent review must contain only canonical fields");
  if (record.version !== 1) fail("lock-plan version must be 1");
  if (!["HOLD", "READY"].includes(record.status)) fail("lock-plan status must be HOLD or READY");
  if (record.network !== "mainnet-beta") fail("lock-plan network must be mainnet-beta");
  if (!exactKeys(record.allocations, Object.keys(expected))) fail("lock plan must contain exactly the five canonical allocations");

  const owners = [];
  for (const [name, values] of Object.entries(expected)) {
    const allocation = record.allocations?.[name];
    if (!exactKeys(allocation, allocationFields)) {
      fail(`${name} allocation must contain only canonical fields`);
      continue;
    }
    const [share, amount, custodyModel, lockRequired, cliffMonths, releaseMonths, releaseRule] = values;
    for (const [field, expectedValue] of Object.entries({ share, baseUnitAmount: amount, custodyModel, lockRequired, cliffMonths, releaseMonths, releaseRule })) {
      if (allocation[field] !== expectedValue) fail(`${name}.${field} does not match canonical tokenomics`);
    }

    if (record.status === "HOLD") {
      for (const field of ["ownerAddress", "lockProgramId", "vaultEvidence", "programEvidence", "scheduleEvidence"]) {
        if (allocation[field] !== null) fail(`HOLD requires ${name}.${field} to be null`);
      }
      continue;
    }

    if (!usableAddress(allocation.ownerAddress) || [SYSTEM_PROGRAM, TOKEN_PROGRAM, METADATA_PROGRAM, MODEL_T].includes(allocation.ownerAddress)) {
      fail(`READY requires a distinct usable custody owner for ${name}`);
    } else {
      owners.push(allocation.ownerAddress);
    }
    if (!addressEvidence(allocation.vaultEvidence, allocation.ownerAddress)) fail(`READY requires direct vault Explorer evidence for ${name}`);
    if (!isHttps(allocation.scheduleEvidence) || allocation.scheduleEvidence === allocation.vaultEvidence) fail(`READY requires separate public schedule evidence for ${name}`);

    if (allocation.lockRequired) {
      if (!isOffCurve(allocation.ownerAddress)) fail(`READY locked allocation ${name} must be owned by an off-curve program-derived vault authority`);
      if (!usableAddress(allocation.lockProgramId) || [SYSTEM_PROGRAM, TOKEN_PROGRAM, METADATA_PROGRAM, MODEL_T].includes(allocation.lockProgramId)) {
        fail(`READY locked allocation ${name} requires a reviewed external lock program`);
      }
      if (!addressEvidence(allocation.programEvidence, allocation.lockProgramId)) fail(`READY requires direct lock-program Explorer evidence for ${name}`);
    } else if (allocation.lockProgramId !== null || allocation.programEvidence !== null) {
      fail(`READY non-lock allocation ${name} must not imply a lock program`);
    }
  }

  if (record.status === "HOLD") {
    if (Object.values(record.independentReview ?? {}).some((value) => value !== null)) fail("HOLD lock plan must clear independent-review evidence");
  } else {
    if (owners.length === 5 && new Set(owners).size !== owners.length) fail("READY allocation owners must all be distinct");
    if (!usableLabel(record.independentReview?.reviewedBy)) fail("READY lock plan requires an independent reviewer label");
    if (!isUtc(record.independentReview?.reviewedAtUtc)) fail("READY lock plan requires a canonical UTC review time");
    else if (Date.parse(record.independentReview.reviewedAtUtc) > Date.now() + 60_000) fail("lock-plan review time cannot be in the future");
    if (record.independentReview?.planSha256 !== planDigest(record)) fail("READY lock plan must bind the exact reviewed plan digest");
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(`Allocation and lock gate passes in ${record.status}. Program-specific schedule verification remains an independent review duty.`);
