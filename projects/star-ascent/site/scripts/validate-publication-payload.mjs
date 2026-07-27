#!/usr/bin/env node

import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "launch/PUBLICATION_PAYLOAD.template.md";
const text = readFileSync(file, "utf8");
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const valueFor = (label) => text.match(new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, "m"))?.[1]?.trim();
const isSolanaAddress = (value) => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const isPublicHttpsUrl = (value) => {
  if (typeof value !== "string" || /\\[|\\]|pending|todo|example/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isUtcMinute = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/.test(value)) return false;
  const instant = new Date(value.replace(" ", "T").replace(" UTC", ":00Z"));
  return !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 16) === value.slice(0, 16).replace(" ", "T");
};
const isVerifierLabel = (value) => typeof value === "string"
  && value.length >= 3
  && !/^(pending|tbd|unknown|n\/a|none|unverified)$/i.test(value)
  && !/[\[\]]/.test(value);

const required = ["Status", "Network", "Mint", "Explorer", "Program", "Decimals", "Fixed supply", "Base units", "Mint authority", "Mint authority evidence", "Freeze authority", "Freeze authority evidence", "Allocation and lock evidence", "Checked at (UTC)", "Verified by"];
for (const label of required) {
  const occurrences = [...text.matchAll(new RegExp(`^${escapeRegExp(label)}:`, "gm"))].length;
  if (occurrences === 0) fail(`${label}: missing`);
  else if (occurrences !== 1) fail(`${label}: must appear exactly once`);
  else ok(`${label}: present once`);
}

const isTemplate = text.includes("Status: **HOLD**") || /\[[^\]\n]+\]/.test(text);
if (isTemplate) {
  ok("template/HOLD markers present — not publishable as verified evidence");
} else {
  if (valueFor("Status") !== "**VERIFIED**") fail("Status must read **VERIFIED** before publication");
  if (!text.includes("Network: Solana mainnet-beta")) fail("mainnet-beta network marker missing");
  if (!text.includes("Program: Original SPL Token Program")) fail("original SPL Token Program marker missing");
  if (!text.includes("Decimals: 9")) fail("9-decimal marker missing");
  if (!text.includes("Mint authority: None")) fail("mint authority must read None");
  if (!text.includes("Freeze authority: None")) fail("freeze authority must read None");
  if (/PENDING|TBD|UNKNOWN|\[[^\]\n]+\]/i.test(text)) fail("verified payload contains unresolved value");
  if (!isSolanaAddress(valueFor("Mint"))) fail("Mint must be a full Solana base58 address");
  if (valueFor("Fixed supply") !== "1000000000 IAT") fail("Fixed supply must be exactly 1000000000 IAT");
  if (valueFor("Base units") !== "1000000000000000000") fail("Base units must be exactly 1000000000000000000 (1B IAT at 9 decimals)");
  for (const label of ["Explorer", "Mint authority evidence", "Freeze authority evidence", "Allocation and lock evidence"]) {
    if (!isPublicHttpsUrl(valueFor(label))) fail(`${label} must be a non-placeholder public HTTPS URL`);
  }
  if (!isUtcMinute(valueFor("Checked at (UTC)"))) fail("Checked at (UTC) must be a real YYYY-MM-DD HH:MM UTC timestamp");
  if (!isVerifierLabel(valueFor("Verified by"))) fail("Verified by must identify a non-placeholder verifier label");
  const evidenceUrls = ["Explorer", "Mint authority evidence", "Freeze authority evidence", "Allocation and lock evidence"].map(valueFor);
  if (new Set(evidenceUrls).size !== evidenceUrls.length) fail("Explorer and evidence URLs must be distinct direct records");
}

if (process.exitCode) console.error("\nDo not publish this payload as verified Genesis evidence.");
else console.log("\nPayload structure passes. Independent Explorer verification remains mandatory.");
