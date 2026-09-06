#!/usr/bin/env node

import { readFileSync } from "node:fs";

const canonicalPayloadPath = "launch/PUBLICATION_PAYLOAD.template.md";
const file = process.argv[2] ?? canonicalPayloadPath;
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
// This validator controls the actual public launch payload. Do not allow a
// clean substitute to be reviewed in place of the canonical release artifact.
if (file !== canonicalPayloadPath) fail(`publication payload path must be ${canonicalPayloadPath}`);
const text = readFileSync(file, "utf8");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const valueFor = (label) => text.match(new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, "m"))?.[1]?.trim();
const hasPlaceholder = (value) => typeof value !== "string" || /\[|\]|pending|todo|example/i.test(value);
const isBase58EncodedByteLength = (value, byteLength) => {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = [0];
  for (const character of value) {
    let carry = alphabet.indexOf(character);
    for (let index = 0; index < decoded.length; index += 1) {
      carry += decoded[index] * 58;
      decoded[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { decoded.push(carry & 0xff); carry >>= 8; }
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return decoded.length + leadingZeroes - (decoded.length === 1 && decoded[0] === 0 ? 1 : 0) === byteLength;
};
const isSolanaAddress = (value) => typeof value === "string"
  && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  && isBase58EncodedByteLength(value, 32);
const isSolanaTransactionSignature = (value) => typeof value === "string"
  && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value)
  && !/^1+$/.test(value)
  && isBase58EncodedByteLength(value, 64);
const isPublicHttpsUrl = (value) => {
  if (typeof value !== "string" || /\\[|\\]|pending|todo|example/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isDirectMintExplorerRecord = (value, mint) => {
  if (!isPublicHttpsUrl(value) || !isSolanaAddress(mint)) return false;
  const url = new URL(value);
  return url.hostname === "explorer.solana.com"
    && !url.port
    && url.pathname === `/address/${mint}`
    && !url.search
    && !url.hash;
};
const isDirectTransactionExplorerRecord = (value) => {
  if (!isPublicHttpsUrl(value)) return false;
  const url = new URL(value);
  const signature = url.pathname.slice("/tx/".length);
  return url.hostname === "explorer.solana.com"
    && !url.port
    && /^\/tx\/[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(url.pathname)
    && isSolanaTransactionSignature(signature)
    && !url.search
    && !url.hash;
};
const isCanonicalPublicProofRoute = (value) => {
  if (!isPublicHttpsUrl(value)) return false;
  const url = new URL(value);
  return url.origin === "https://internalagency.io"
    && url.pathname === "/proof"
    && !url.search
    && !url.hash;
};
const isUtcMinute = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/.test(value)) return false;
  const instant = new Date(value.replace(" ", "T").replace(" UTC", ":00Z"));
  return !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 16) === value.slice(0, 16).replace(" ", "T");
};
const isNonFutureUtcMinute = (value) => {
  if (!isUtcMinute(value)) return false;
  return Date.parse(value.replace(" ", "T").replace(" UTC", ":00Z")) <= Date.now();
};
const isSha256 = (value) => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const secretBearingFieldName = (name) => {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:seed(?:phrase|words)?|mnemonic|privatekey|secretkey|keypair|passphrase|devicepin|wallet(?:seed|export|backup)|recovery(?:phrase|words|material)?|derivationpath|accountpath)/.test(normalized);
};
const secretBearingPayloadField = () => {
  const fieldPattern = /^(?:\s*(?:[-*]\s*)?)?([^:\n]{1,120}):/gm;
  for (const match of text.matchAll(fieldPattern)) {
    if (secretBearingFieldName(match[1])) return match[1].trim();
  }
  return null;
};
const mnemonicShapedPayloadValue = () => {
  const word = "[a-z]{3,8}";
  const match = text.match(new RegExp(`(?:^|[^a-z])(${word}(?:\\s+${word}){11,23})(?=$|[^a-z])`, "i"));
  return match?.[1] ?? null;
};
const credentialShapedPayloadField = () => {
  const fieldPattern = /^(?:\s*(?:[-*]\s*)?)?([^:\n]{1,120}):\s*(.+)$/gm;
  for (const match of text.matchAll(fieldPattern)) {
    if (isBase58EncodedByteLength(match[2].trim(), 64)) return match[1].trim();
  }
  return null;
};

const secretBearingField = secretBearingPayloadField();
if (secretBearingField) fail(`payload must not contain credential-bearing field ${secretBearingField}`); else ok("no credential-bearing fields are present");
const mnemonicShapedValue = mnemonicShapedPayloadValue();
if (mnemonicShapedValue) fail("payload must not contain a 12-24-word mnemonic-shaped value"); else ok("no mnemonic-shaped values are present");
const credentialShapedField = credentialShapedPayloadField();
if (credentialShapedField) fail(`payload must not contain a bare 64-byte Base58 credential-shaped value at ${credentialShapedField}`); else ok("no bare credential-shaped Base58 values are present");

const required = ["Status", "Network", "Mint", "Explorer", "Program", "Decimals", "Fixed supply", "Base units", "Mint authority", "Mint authority evidence", "Freeze authority", "Freeze authority evidence", "Allocation and lock evidence", "Checked at (UTC)", "Evidence packet SHA-256", "Evidence observation mode", "No self-attestation", "Human reviewer required"];
for (const label of required) {
  const occurrences = [...text.matchAll(new RegExp(`^${escapeRegExp(label)}:`, "gm"))].length;
  if (occurrences === 0) fail(`${label}: missing`);
  else if (occurrences !== 1) fail(`${label}: must appear exactly once`);
  else ok(`${label}: present once`);
}

const status = valueFor("Status");
const releaseValueLabels = [
  "Mint", "Explorer", "Fixed supply", "Base units", "Mint authority evidence",
  "Freeze authority evidence", "Allocation and lock evidence", "Checked at (UTC)", "Evidence packet SHA-256",
];
if (status === "**HOLD**") {
  // HOLD is a reset state. A copied payload must not retain a prior mint,
  // review, or proof just because its visible status was switched back.
  for (const label of releaseValueLabels) {
    if (!hasPlaceholder(valueFor(label))) fail(`HOLD payload must keep ${label} unresolved`);
    else ok(`HOLD payload keeps ${label} unresolved`);
  }
  ok("template/HOLD markers present — not publishable as verified evidence");
} else {
  if (status !== "**VERIFIED**") fail("Status must read **HOLD** or **VERIFIED**");
  if (releaseValueLabels.some((label) => hasPlaceholder(valueFor(label)))) {
    fail("verified payload contains unresolved value");
  }
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
  if (!isCanonicalPublicProofRoute(valueFor("Allocation and lock evidence"))) {
    fail("Allocation and lock evidence must be the canonical https://internalagency.io/proof route without a query string or fragment");
  }
  if (!isUtcMinute(valueFor("Checked at (UTC)"))) fail("Checked at (UTC) must be a real YYYY-MM-DD HH:MM UTC timestamp");
  else if (!isNonFutureUtcMinute(valueFor("Checked at (UTC)"))) fail("Checked at (UTC) must not be in the future");
  if (!isSha256(valueFor("Evidence packet SHA-256"))) fail("Evidence packet SHA-256 must be an exact lowercase digest");
  if (valueFor("Evidence observation mode") !== "AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION") fail("Evidence observation mode must require automated source/receipt/state evidence");
  if (valueFor("No self-attestation") !== "true") fail("No self-attestation must be true");
  if (valueFor("Human reviewer required") !== "false") fail("Human reviewer required must be false");
  const evidenceUrls = ["Explorer", "Mint authority evidence", "Freeze authority evidence", "Allocation and lock evidence"].map(valueFor);
  if (new Set(evidenceUrls).size !== evidenceUrls.length) fail("Explorer and evidence URLs must be distinct direct records");
  if (!isDirectMintExplorerRecord(valueFor("Explorer"), valueFor("Mint"))) {
    fail("Explorer must be a direct explorer.solana.com address record for the claimed Mint without a query string or fragment");
  }
  for (const label of ["Mint authority evidence", "Freeze authority evidence"]) {
    if (!isDirectTransactionExplorerRecord(valueFor(label))) {
      fail(`${label} must be a direct explorer.solana.com transaction record without a query string or fragment`);
    }
  }
}

if (process.exitCode) console.error("\nDo not publish this payload as verified Genesis evidence.");
else console.log("\nPayload structure passes. Exact source-bound receipt/state/endpoint verification remains mandatory.");
