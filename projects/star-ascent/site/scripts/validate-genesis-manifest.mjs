#!/usr/bin/env node

import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "launch/genesis-manifest.template.json";
const manifest = JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const isPublicHttpsUrl = (value) => {
  if (typeof value !== "string" || /\[|\]|pending|todo|example/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isSolanaAddress = (value) => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const isUnsignedInteger = (value) => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value);

if (manifest.network !== "mainnet-beta") fail("network must be mainnet-beta"); else ok("mainnet-beta selected");
if (manifest.token?.program !== "Original SPL Token Program") fail("unexpected token program"); else ok("original SPL Token Program selected");
if (manifest.token?.decimals !== 9) fail("decimals must be 9"); else ok("9 decimals selected");
if (manifest.token?.fixedSupplyTarget !== "1000000000") fail("fixed supply target must be 1000000000"); else ok("fixed supply target is 1,000,000,000");
const fixedSupply = 1_000_000_000n;
const decimals = 9n;
const expectedBaseUnitSupply = fixedSupply * (10n ** decimals);
if (!isUnsignedInteger(manifest.token?.fixedSupplyBaseUnits) || BigInt(manifest.token.fixedSupplyBaseUnits) !== expectedBaseUnitSupply) {
  fail(`fixedSupplyBaseUnits must be ${expectedBaseUnitSupply.toString()}`);
} else ok("fixed supply base units match display supply and decimals");

const expected = { community: "50%", treasury: "20%", ecosystem: "15%", coreTeam: "10%", liquidity: "5%" };
let allocationBaseUnitTotal = 0n;
for (const [name, share] of Object.entries(expected)) {
  if (manifest.allocations?.[name]?.share !== share) fail(`${name} allocation must be ${share}`);
  else ok(`${name} allocation is ${share}`);
  const amount = manifest.allocations?.[name]?.baseUnitAmount;
  const expectedAmount = (expectedBaseUnitSupply * BigInt(share.slice(0, -1))) / 100n;
  if (!isUnsignedInteger(amount) || BigInt(amount) !== expectedAmount) {
    fail(`${name} baseUnitAmount must be ${expectedAmount.toString()}`);
  } else {
    allocationBaseUnitTotal += BigInt(amount);
    ok(`${name} base-unit amount is exact`);
  }
}
if (allocationBaseUnitTotal !== expectedBaseUnitSupply) fail("allocation base-unit amounts must sum exactly to fixedSupplyBaseUnits");
else ok("allocation base-unit amounts sum exactly to fixed supply");

if (!["HOLD", "PUBLISHED"].includes(manifest.status)) fail("status must be HOLD or PUBLISHED");
if (manifest.status === "HOLD") {
  if (manifest.claimOrDistribution?.status !== "NOT_PUBLISHED") fail("HOLD requires claimOrDistribution.status to be NOT_PUBLISHED");
  if (manifest.claimOrDistribution?.canonicalRoute !== null) fail("HOLD requires claimOrDistribution.canonicalRoute to be null");
  ok("HOLD state: no public claim route is asserted");
} else {
  if (manifest.claimOrDistribution?.status !== "PUBLISHED") fail("PUBLISHED requires claimOrDistribution.status to be PUBLISHED");
  const checks = [
    ["token.mint", manifest.token?.mint, isSolanaAddress],
    ["token.mintAuthorityRevocationTransaction", manifest.token?.mintAuthorityRevocationTransaction, isPublicHttpsUrl],
    ["token.freezeAuthorityRevocationTransaction", manifest.token?.freezeAuthorityRevocationTransaction, isPublicHttpsUrl],
    ["claimOrDistribution.canonicalRoute", manifest.claimOrDistribution?.canonicalRoute, isPublicHttpsUrl],
  ];
  for (const [name, value, validate] of checks) {
    if (!validate(value)) fail(`PUBLISHED requires a non-placeholder public value for ${name}`); else ok(`${name} present`);
  }
  for (const [name, allocation] of Object.entries(manifest.allocations ?? {})) {
    if (!isSolanaAddress(allocation.destination) || !isPublicHttpsUrl(allocation.evidence)) fail(`PUBLISHED requires a public destination and non-placeholder HTTPS evidence for ${name}`);
    else ok(`${name} destination and evidence present`);
  }
}

if (process.exitCode) console.error("\nManifest remains HOLD. Do not publish a claim or token status.");
else console.log("\nManifest structure passes. Independent on-chain verification is still required.");
