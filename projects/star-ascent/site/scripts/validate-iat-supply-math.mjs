#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const canonicalManifestPath = resolve(repositoryRoot, "launch", "genesis-manifest.template.json");
const requestedManifestPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : canonicalManifestPath;
const comparablePath = (value) => process.platform === "win32" ? value.toLowerCase() : value;

if (comparablePath(requestedManifestPath) !== comparablePath(canonicalManifestPath)) {
  console.error("FAIL: supply math manifest path must be launch/genesis-manifest.template.json");
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(canonicalManifestPath, "utf8"));
} catch (error) {
  console.error(`FAIL: canonical Genesis manifest is not readable JSON: ${error.message}`);
  process.exit(1);
}

const supply = 1_000_000_000n;
const decimals = 9n;
const baseUnitSupply = supply * (10n ** decimals);
const allocations = {
  community: 50n,
  treasury: 20n,
  ecosystem: 15n,
  coreTeam: 10n,
  liquidity: 5n,
};

let failed = false;
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  failed = true;
};
const unsignedInteger = (value, path) => {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    fail(`${path} must be a canonical unsigned-integer string`);
    return null;
  }
  return BigInt(value);
};

const manifestSupply = unsignedInteger(manifest?.token?.fixedSupplyTarget, "token.fixedSupplyTarget");
const manifestBaseUnitSupply = unsignedInteger(manifest?.token?.fixedSupplyBaseUnits, "token.fixedSupplyBaseUnits");
if (manifestSupply !== null && manifestSupply !== supply) {
  fail(`token.fixedSupplyTarget must equal ${supply.toString()} IAT`);
}
if (manifest?.token?.decimals !== Number(decimals)) {
  fail(`token.decimals must equal ${decimals.toString()}`);
}
if (manifestBaseUnitSupply !== null && manifestBaseUnitSupply !== baseUnitSupply) {
  fail(`token.fixedSupplyBaseUnits must equal recomputed supply ${baseUnitSupply.toString()}`);
}

const allocationRecord = manifest?.allocations;
const allocationNames = allocationRecord && typeof allocationRecord === "object" && !Array.isArray(allocationRecord)
  ? Object.keys(allocationRecord)
  : [];
if (
  allocationNames.length !== Object.keys(allocations).length
  || allocationNames.some((name) => !(name in allocations))
) {
  fail(`allocations must contain exactly ${Object.keys(allocations).join(", ")}`);
}

let total = 0n;
console.log(`IAT display supply: ${supply.toString()}`);
console.log(`IAT decimals: ${decimals.toString()}`);
console.log(`IAT base-unit supply: ${baseUnitSupply.toString()}`);
for (const [name, percent] of Object.entries(allocations)) {
  const displayAmount = (supply * percent) / 100n;
  const baseAmount = (baseUnitSupply * percent) / 100n;
  const allocation = allocationRecord?.[name];
  if (allocation?.share !== `${percent.toString()}%`) {
    fail(`allocations.${name}.share must equal ${percent.toString()}%`);
  }
  const manifestBaseAmount = unsignedInteger(
    allocation?.baseUnitAmount,
    `allocations.${name}.baseUnitAmount`,
  );
  if (manifestBaseAmount !== null) {
    total += manifestBaseAmount;
    if (manifestBaseAmount !== baseAmount) {
      fail(`allocations.${name}.baseUnitAmount must equal recomputed amount ${baseAmount.toString()}`);
    }
  }
  console.log(`${name}: ${percent.toString()}% | ${displayAmount.toString()} IAT | ${baseAmount.toString()} base units`);
}

if (total !== baseUnitSupply) {
  fail(`allocation total ${total.toString()} does not equal base-unit supply ${baseUnitSupply.toString()}`);
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("OK: all allocation base-unit amounts sum exactly to the fixed supply.");
}
