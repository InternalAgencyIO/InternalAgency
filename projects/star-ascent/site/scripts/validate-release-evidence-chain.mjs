#!/usr/bin/env node

import { readFileSync } from "node:fs";

const canonicalManifestPath = "launch/genesis-manifest.template.json";
const canonicalPayloadPath = "launch/PUBLICATION_PAYLOAD.template.md";
const manifestPath = process.argv[2] ?? canonicalManifestPath;
const payloadPath = process.argv[3] ?? canonicalPayloadPath;
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
// This is a launch gate, not a generic artifact comparator. A clean copied
// pair must not be able to clear the canonical Genesis evidence record.
if (manifestPath !== canonicalManifestPath) fail(`manifest path must be ${canonicalManifestPath}`);
if (payloadPath !== canonicalPayloadPath) fail(`publication payload path must be ${canonicalPayloadPath}`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const payload = readFileSync(payloadPath, "utf8");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const valueFor = (label) => payload.match(new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, "m"))?.[1]?.trim();
const occurrencesFor = (label) => [...payload.matchAll(new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, "gm"))].length;
const hasPlaceholder = (value) => typeof value !== "string"
  || !value.trim()
  || /\[|\]|pending|todo|example/i.test(value);
const secretBearingFieldName = (name) => {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:seed(?:phrase|words)?|mnemonic|privatekey|secretkey|keypair|passphrase|devicepin|wallet(?:seed|export|backup)|recovery(?:phrase|words|material)?|derivationpath|accountpath)/.test(normalized);
};
const credentialBearingValue = (value) => {
  if (typeof value !== "string") return false;
  if (/\b(?:seed\s*(?:phrase|words)?|mnemonic|private\s*key|secret\s*key|keypair|passphrase|device\s*pin|wallet\s*(?:seed|export|backup)|recovery\s*(?:phrase|words|material)?|derivation\s*path|account\s*path)\b/i.test(value)) return true;
  if (isBase58EncodedByteLength(value, 64)) return true;
  const words = value.trim().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every((word) => /^[a-z]+$/i.test(word));
};
const findSecretBearingField = (value, path = "manifest") => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const result = findSecretBearingField(item, `${path}[${index}]`);
      if (result) return result;
    }
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const fieldPath = `${path}.${key}`;
      if (secretBearingFieldName(key)) return fieldPath;
      const result = findSecretBearingField(item, fieldPath);
      if (result) return result;
    }
  }
  return null;
};
const findCredentialBearingValue = (value, path = "manifest") => {
  if (typeof value === "string") return credentialBearingValue(value) ? path : null;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const result = findCredentialBearingValue(item, `${path}[${index}]`);
      if (result) return result;
    }
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const result = findCredentialBearingValue(item, `${path}.${key}`);
      if (result) return result;
    }
  }
  return null;
};
const credentialBearingPayloadField = () => {
  const fieldPattern = /^(?:\s*(?:[-*]\s*)?)?([^:\n]{1,120}):\s*(.+)$/gm;
  for (const match of payload.matchAll(fieldPattern)) {
    const label = match[1].trim();
    if (secretBearingFieldName(label)) return `payload.${label}`;
    if (credentialBearingValue(match[2].trim())) return `payload.${label}`;
  }
  return null;
};
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
  if (hasPlaceholder(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isCanonicalPublicRoute = (value) => {
  if (!isPublicHttpsUrl(value)) return false;
  const url = new URL(value);
  return url.origin === "https://internalagency.io"
    && url.pathname === "/proof"
    && !url.search
    && !url.hash;
};
const isDirectAuthorityRevocationRecord = (value) => {
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
const isDirectMintExplorerRecord = (value, mint) => {
  if (!isPublicHttpsUrl(value) || !isSolanaAddress(mint)) return false;
  const url = new URL(value);
  return url.hostname === "explorer.solana.com"
    && !url.port
    && url.pathname === `/address/${mint}`
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

const manifestIsHold = manifest.status === "HOLD";
const payloadStatus = valueFor("Status");
const payloadHasOneStatus = occurrencesFor("Status") === 1;
const payloadIsHold = payloadHasOneStatus && payloadStatus === "**HOLD**";
const payloadIsVerified = payloadHasOneStatus && payloadStatus === "**VERIFIED**";

const secretBearingField = findSecretBearingField(manifest);
if (secretBearingField) fail(`manifest must not contain credential-bearing field ${secretBearingField}`); else ok("manifest contains no credential-bearing fields");
const credentialBearingValuePath = findCredentialBearingValue(manifest);
if (credentialBearingValuePath) fail(`manifest must not contain credential-bearing value at ${credentialBearingValuePath}`); else ok("manifest contains no credential-bearing values");
const credentialBearingPayloadPath = credentialBearingPayloadField();
if (credentialBearingPayloadPath) fail(`payload must not contain credential-bearing field or value at ${credentialBearingPayloadPath}`); else ok("payload contains no credential-bearing fields or values");

if (!manifestIsHold && manifest.status !== "PUBLISHED") {
  fail("manifest status must be HOLD or PUBLISHED");
}
if (manifestIsHold !== payloadIsHold) {
  fail("manifest and publication payload must have the same HOLD/PUBLISHED state");
} else {
  ok("manifest and publication payload state agree");
}

if (manifestIsHold) {
  if (!payloadIsHold) {
    fail("HOLD manifest requires exactly one Status: **HOLD** publication payload assertion");
  }
  if (manifest.claimOrDistribution?.canonicalRoute !== null) {
    fail("HOLD manifest cannot assert a canonical route");
  }
  // A HOLD payload is a reusable template, but it must not carry forward any
  // live release proof from an earlier attempt. Require each proof-bearing
  // field to remain a single bracketed placeholder so a duplicate value cannot
  // hide behind the template's first matching line.
  const holdOnlyPlaceholderLabels = [
    "Mint", "Explorer", "Mint authority evidence", "Freeze authority evidence",
    "Allocation and lock evidence", "Checked at (UTC)", "Evidence packet SHA-256",
  ];
  for (const label of holdOnlyPlaceholderLabels) {
    if (occurrencesFor(label) !== 1 || !hasPlaceholder(valueFor(label))) {
      fail(`HOLD payload must contain exactly one unresolved ${label} assertion`);
    } else {
      ok(`HOLD payload keeps ${label} unresolved`);
    }
  }
  ok("HOLD chain contains no release assertion");
} else {
  if (!payloadIsVerified) {
    fail("PUBLISHED manifest requires exactly one Status: **VERIFIED** publication payload assertion");
  } else {
    ok("PUBLISHED manifest and publication payload state agree");
  }
  const releaseAssertionLabels = [
    "Network", "Mint", "Explorer", "Program", "Decimals", "Fixed supply", "Base units",
    "Mint authority", "Mint authority evidence", "Freeze authority", "Freeze authority evidence",
    "Allocation and lock evidence", "Checked at (UTC)", "Evidence packet SHA-256",
    "Evidence observation mode", "No self-attestation", "Human reviewer required",
  ];
  for (const label of releaseAssertionLabels) {
    if (occurrencesFor(label) !== 1) {
      fail(`verified publication payload must contain exactly one ${label} assertion`);
    } else {
      ok(`verified publication payload contains one ${label} assertion`);
    }
  }
  if (!isUtcMinute(valueFor("Checked at (UTC)"))) {
    fail("verified publication payload requires a real canonical Checked at (UTC) timestamp");
  } else if (!isNonFutureUtcMinute(valueFor("Checked at (UTC)"))) {
    fail("verified publication payload Checked at (UTC) must not be in the future");
  } else {
    ok("verified publication payload has a canonical review timestamp");
  }
  if (!isSha256(valueFor("Evidence packet SHA-256"))) {
    fail("verified publication payload requires an exact lowercase evidence-packet SHA-256");
  } else if (valueFor("Evidence observation mode") !== "AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION"
    || valueFor("No self-attestation") !== "true"
    || valueFor("Human reviewer required") !== "false") {
    fail("verified publication payload must require automated source/receipt/state evidence with no self-attestation or human-review prerequisite");
  } else {
    ok("verified publication payload binds automated source/receipt/state evidence");
  }
  // The machine-readable manifest and public payload deliberately use their
  // own canonical network spellings. Keep that mapping explicit so a valid
  // publication does not fail merely because its reader-facing label adds the
  // Solana context, while still rejecting an arbitrary network in either file.
  if (manifest.network !== "mainnet-beta" || valueFor("Network") !== "Solana mainnet-beta") {
    fail("published evidence must identify Solana mainnet-beta in the canonical manifest/payload forms");
  } else {
    ok("manifest and publication payload identify Solana mainnet-beta");
  }
  const identityChecks = [
    ["program", manifest.token?.program, valueFor("Program")],
    ["decimals", String(manifest.token?.decimals), valueFor("Decimals")],
    ["fixed supply", `${manifest.token?.fixedSupplyTarget} ${manifest.token?.symbol}`, valueFor("Fixed supply")],
    ["fixed base units", manifest.token?.fixedSupplyBaseUnits, valueFor("Base units")],
  ];
  for (const [label, manifestValue, payloadValue] of identityChecks) {
    if (hasPlaceholder(manifestValue) || hasPlaceholder(payloadValue) || manifestValue !== payloadValue) {
      fail(`${label} differs between manifest and publication payload`);
    } else {
      ok(`${label} matches across manifest and publication payload`);
    }
  }
  for (const label of ["Mint authority", "Freeze authority"]) {
    if (valueFor(label) !== "None") fail(`${label.toLowerCase()} must state None in a verified publication payload`);
    else ok(`${label.toLowerCase()} is explicitly None`);
  }
  const checks = [
    ["mint", manifest.token?.mint, valueFor("Mint"), isSolanaAddress],
    ["mint authority evidence", manifest.token?.mintAuthorityRevocationTransaction, valueFor("Mint authority evidence"), isDirectAuthorityRevocationRecord],
    ["freeze authority evidence", manifest.token?.freezeAuthorityRevocationTransaction, valueFor("Freeze authority evidence"), isDirectAuthorityRevocationRecord],
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
  if (manifest.token?.mintAuthorityRevocationTransaction === manifest.token?.freezeAuthorityRevocationTransaction) {
    fail("mint and freeze authority evidence must use distinct direct transaction records");
  } else {
    ok("mint and freeze authority evidence use distinct direct transaction records");
  }
  const mintCreationRecord = manifest.releaseEvidence?.records?.mintCreation;
  const mintExplorer = valueFor("Explorer");
  if (!isDirectMintExplorerRecord(mintCreationRecord, manifest.token?.mint) || !isDirectMintExplorerRecord(mintExplorer, manifest.token?.mint)) {
    fail("mint explorer evidence must be a direct explorer.solana.com address record for the claimed mint in both artifacts");
  } else if (mintCreationRecord !== mintExplorer) {
    fail("mint explorer evidence differs between manifest mintCreation record and publication payload");
  } else {
    ok("mint explorer evidence matches the claimed mint across both artifacts");
  }
  const canonicalRoute = manifest.claimOrDistribution?.canonicalRoute;
  const allocationEvidence = valueFor("Allocation and lock evidence");
  const publicationRecord = manifest.releaseEvidence?.records?.publicationRecord;
  if (!isCanonicalPublicRoute(canonicalRoute)) {
    fail("PUBLISHED manifest requires a non-placeholder canonical route without a query string or fragment");
  } else if (!isPublicHttpsUrl(allocationEvidence)) {
    fail("published payload requires non-placeholder allocation and lock evidence");
  } else if (canonicalRoute !== allocationEvidence) {
    fail("canonical route differs between manifest and publication payload allocation evidence");
  } else if (!isCanonicalPublicRoute(publicationRecord)) {
    fail("publication record must be a non-placeholder canonical public route without a query string or fragment");
  } else if (publicationRecord !== canonicalRoute) {
    fail("publication record differs from the canonical allocation evidence route");
  } else {
    ok("canonical allocation and lock evidence matches across manifest and publication records");
  }
}

if (process.exitCode) console.error("\nEvidence chain remains HOLD. Do not publish or distribute.");
else console.log("\nEvidence chain is internally consistent. Independent on-chain verification remains mandatory.");
