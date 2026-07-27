#!/usr/bin/env node

import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "launch/genesis-manifest.template.json";
const manifest = JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const expectedOrder = [
  "CREATE_MINT",
  "MINT_ALLOCATION_DESTINATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
  "PUBLISH_EVIDENCE",
];
const requiredRecords = [
  "mintCreation",
  "allocationMints",
  "mintAuthorityRevocation",
  "freezeAuthorityRevocation",
  "publicationRecord",
];
const isPublicHttpsUrl = (value) => {
  if (typeof value !== "string" || /\[|\]|pending|todo|example/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

if (!['HOLD', 'PUBLISHED'].includes(manifest.status)) {
  fail("manifest status must be HOLD or PUBLISHED");
}

const order = manifest.releaseEvidence?.transactionOrder;
if (!Array.isArray(order) || order.length !== expectedOrder.length || order.some((step, index) => step !== expectedOrder[index])) {
  fail(`transactionOrder must be exactly: ${expectedOrder.join(" -> ")}`);
} else {
  ok("transaction order preserves minting, revocation, then publication");
}

const records = manifest.releaseEvidence?.records;
if (!records || typeof records !== "object" || Array.isArray(records)) {
  fail("releaseEvidence.records must be an object");
} else if (manifest.status === "HOLD") {
  for (const name of requiredRecords) {
    if (records[name] !== null) fail(`HOLD requires releaseEvidence.records.${name} to be null`);
  }
  if (!process.exitCode) ok("HOLD contains no transaction or publication assertions");
} else {
  for (const name of requiredRecords) {
    if (!isPublicHttpsUrl(records[name])) fail(`PUBLISHED requires a non-placeholder public HTTPS URL for releaseEvidence.records.${name}`);
    else ok(`${name} evidence recorded`);
  }
}

if (process.exitCode) console.error("\nRelease evidence remains HOLD. Do not sign, publish, or distribute.");
else console.log("\nOrder and evidence fields are structurally complete. Independently inspect every transaction and final account state.");
