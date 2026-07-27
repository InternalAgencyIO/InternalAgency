#!/usr/bin/env node

import { readFileSync } from "node:fs";

const manifestPath = process.argv[2] ?? "launch/genesis-manifest.template.json";
const payloadPath = process.argv[3] ?? "launch/PUBLICATION_PAYLOAD.template.md";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const payload = readFileSync(payloadPath, "utf8");
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const valueFor = (label) => payload.match(new RegExp(`^${label}:\\s*(.+)$`, "m"))?.[1]?.trim();
const hasPlaceholder = (value) => typeof value !== "string" || /\[|\]|pending|todo|example/i.test(value);
const isSolanaAddress = (value) => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const isPublicHttpsUrl = (value) => {
  if (hasPlaceholder(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

const manifestIsHold = manifest.status === "HOLD";
const payloadIsHold = payload.includes("Status: **HOLD**");

if (!manifestIsHold && manifest.status !== "PUBLISHED") {
  fail("manifest status must be HOLD or PUBLISHED");
}
if (manifestIsHold !== payloadIsHold) {
  fail("manifest and publication payload must have the same HOLD/PUBLISHED state");
} else {
  ok("manifest and publication payload state agree");
}

if (manifestIsHold) {
  if (manifest.claimOrDistribution?.canonicalRoute !== null) {
    fail("HOLD manifest cannot assert a canonical route");
  }
  if (valueFor("Mint") && !hasPlaceholder(valueFor("Mint"))) {
    fail("HOLD payload cannot assert a mint");
  }
  ok("HOLD chain contains no release assertion");
} else {
  const checks = [
    ["mint", manifest.token?.mint, valueFor("Mint"), isSolanaAddress],
    ["mint authority evidence", manifest.token?.mintAuthorityRevocationTransaction, valueFor("Mint authority evidence"), isPublicHttpsUrl],
    ["freeze authority evidence", manifest.token?.freezeAuthorityRevocationTransaction, valueFor("Freeze authority evidence"), isPublicHttpsUrl],
  ];
  for (const [label, manifestValue, payloadValue, validate] of checks) {
    if (!validate(manifestValue) || !validate(payloadValue)) {
      fail(`${label} must be a non-placeholder public value in both artifacts`);
    } else if (manifestValue !== payloadValue) {
      fail(`${label} differs between manifest and publication payload`);
    } else {
      ok(`${label} matches across both artifacts`);
    }
  }
  if (!isPublicHttpsUrl(manifest.claimOrDistribution?.canonicalRoute)) {
    fail("PUBLISHED manifest requires a non-placeholder canonical route");
  } else {
    ok("published manifest has a canonical route");
  }
}

if (process.exitCode) console.error("\nEvidence chain remains HOLD. Do not publish or distribute.");
else console.log("\nEvidence chain is internally consistent. Independent on-chain verification remains mandatory.");
