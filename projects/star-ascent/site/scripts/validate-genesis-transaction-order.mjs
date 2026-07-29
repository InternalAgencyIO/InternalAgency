#!/usr/bin/env node

import { readFileSync } from "node:fs";

const canonicalManifestPath = "launch/genesis-manifest.template.json";
const path = process.argv[2] ?? canonicalManifestPath;
if (path !== canonicalManifestPath) {
  console.error(`FAIL: manifest path must be ${canonicalManifestPath}`);
  process.exit(1);
}
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
const expectedAllocationNames = ["community", "treasury", "ecosystem", "coreTeam", "liquidity"];
const isPublicHttpsUrl = (value) => {
  if (typeof value !== "string" || /\[|\]|pending|todo|example/i.test(value)) return false;
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
const base58DecodedLength = (value) => {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) return null;
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
  return decoded.length + leadingZeroes - (decoded.length === 1 && decoded[0] === 0 ? 1 : 0);
};
const isSolanaAddress = (value) => base58DecodedLength(value) === 32 && value !== "11111111111111111111111111111111";
const isSolanaTransactionSignature = (value) => typeof value === "string"
  && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value)
  && !/^1+$/.test(value)
  && base58DecodedLength(value) === 64;
const isDirectMintExplorerRecord = (value, mint) => {
  if (!isPublicHttpsUrl(value) || !isSolanaAddress(mint)) return false;
  const url = new URL(value);
  return url.hostname === "explorer.solana.com"
    && !url.port
    && url.pathname === `/address/${mint}`
    && !url.search
    && !url.hash;
};
const isDirectAllocationExplorerRecord = (value, destination) => {
  if (!isPublicHttpsUrl(value) || !isSolanaAddress(destination)) return false;
  const url = new URL(value);
  return url.hostname === "explorer.solana.com"
    && !url.port
    && url.pathname === `/address/${destination}`
    && !url.search
    && !url.hash;
};
const isDirectSolanaTransactionRecord = (value) => {
  if (!isPublicHttpsUrl(value)) return false;
  const url = new URL(value);
  return url.hostname === "explorer.solana.com"
    && !url.port
    && url.pathname.startsWith("/tx/")
    && isSolanaTransactionSignature(url.pathname.slice("/tx/".length))
    && !url.search
    && !url.hash;
};
const secretBearingFieldName = (name) => {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:seed(?:phrase|words)?|mnemonic|privatekey|secretkey|keypair|passphrase|devicepin|wallet(?:seed|export|backup)|recovery(?:phrase|words|material)?|derivationpath|accountpath)/.test(normalized);
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
const credentialBearingValue = (value) => {
  if (typeof value !== "string") return false;
  if (/\b(?:seed\s*(?:phrase|words)?|mnemonic|private\s*key|secret\s*key|keypair|passphrase|device\s*pin|wallet\s*(?:seed|export|backup)|recovery\s*(?:phrase|words|material)?|derivation\s*path|account\s*path)\b/i.test(value)) return true;
  if (base58DecodedLength(value) === 64) return true;
  const words = value.trim().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every((word) => /^[a-z]+$/i.test(word));
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

const secretBearingField = findSecretBearingField(manifest);
if (secretBearingField) fail(`manifest must not contain credential-bearing field ${secretBearingField}`); else ok("no credential-bearing fields are present");
const credentialBearingValuePath = findCredentialBearingValue(manifest);
if (credentialBearingValuePath) fail(`manifest must not contain credential-bearing value at ${credentialBearingValuePath}`); else ok("no credential-bearing values are present");

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
  // HOLD is a complete evidence reset. A prior ceremony's token, recipient,
  // or public-route assertion must not survive alongside empty record fields.
  for (const field of ["mint", "mintAuthorityRevocationTransaction", "freezeAuthorityRevocationTransaction"]) {
    if (manifest.token?.[field] !== null) fail(`HOLD requires token.${field} to be null`);
  }
  for (const name of expectedAllocationNames) {
    for (const field of ["destination", "evidence"]) {
      if (manifest.allocations?.[name]?.[field] !== null) fail(`HOLD requires allocations.${name}.${field} to be null`);
    }
  }
  if (manifest.claimOrDistribution?.status !== "NOT_PUBLISHED") fail("HOLD requires claimOrDistribution.status to be NOT_PUBLISHED");
  if (manifest.claimOrDistribution?.canonicalRoute !== null) fail("HOLD requires claimOrDistribution.canonicalRoute to be null");
  if (!process.exitCode) ok("HOLD contains no stale token, allocation, transaction, or publication assertions");
} else {
  const evidenceUrls = [];
  for (const name of requiredRecords) {
    if (!isPublicHttpsUrl(records[name])) fail(`PUBLISHED requires a non-placeholder public HTTPS URL for releaseEvidence.records.${name}`);
    else {
      evidenceUrls.push(records[name]);
      ok(`${name} evidence recorded`);
    }
  }
  if (evidenceUrls.length === requiredRecords.length && new Set(evidenceUrls).size !== evidenceUrls.length) {
    fail("PUBLISHED requires distinct evidence URLs for each Genesis sequence step");
  } else if (evidenceUrls.length === requiredRecords.length) {
    ok("each Genesis sequence step has distinct public evidence");
  }
  if (!isDirectSolanaTransactionRecord(records.allocationMints)) {
    fail("PUBLISHED requires allocationMints to be a direct explorer.solana.com transaction record without a query string or fragment");
  } else {
    ok("allocation mint evidence identifies a direct transaction record");
  }

  const authorityRecordBindings = [
    ["mintAuthorityRevocation", manifest.token?.mintAuthorityRevocationTransaction],
    ["freezeAuthorityRevocation", manifest.token?.freezeAuthorityRevocationTransaction],
  ];
  for (const [recordName, canonicalUrl] of authorityRecordBindings) {
    if (!isDirectSolanaTransactionRecord(canonicalUrl)) {
      fail(`PUBLISHED requires ${recordName} to be a direct explorer.solana.com transaction record without a query string or fragment`);
    } else if (records[recordName] !== canonicalUrl) {
      fail(`${recordName} evidence must exactly match token metadata`);
    } else {
      ok(`${recordName} evidence matches canonical token metadata`);
    }
  }
  if (manifest.token?.mintAuthorityRevocationTransaction === manifest.token?.freezeAuthorityRevocationTransaction) {
    fail("PUBLISHED requires distinct direct transaction records for mint and freeze authority revocation");
  } else {
    ok("mint and freeze authority revocation records are distinct");
  }
  const canonicalRoute = manifest.claimOrDistribution?.canonicalRoute;
  if (!isCanonicalPublicRoute(canonicalRoute)) {
    fail("PUBLISHED requires a canonical public route without a query string or fragment");
  } else if (records.publicationRecord !== canonicalRoute) {
    fail("publicationRecord evidence must exactly match the canonical public route");
  } else {
    ok("publication record matches canonical public route");
  }
  const mint = manifest.token?.mint;
  if (!isSolanaAddress(mint)) {
    fail("PUBLISHED requires a claimed mint address before validating mintCreation evidence");
  } else if (!isDirectMintExplorerRecord(records.mintCreation, mint)) {
    fail("mintCreation evidence must be a direct explorer.solana.com address record for the claimed mint");
  } else {
    ok("mint creation evidence identifies the claimed mint");
  }
  for (const name of expectedAllocationNames) {
    const allocation = manifest.allocations?.[name];
    if (!isDirectAllocationExplorerRecord(allocation?.evidence, allocation?.destination)) {
      fail(`PUBLISHED requires ${name} allocation evidence to be a direct explorer.solana.com address record for its destination`);
    } else {
      ok(`${name} allocation evidence identifies its recipient destination`);
    }
  }
}

if (process.exitCode) console.error("\nRelease evidence remains HOLD. Do not sign, publish, or distribute.");
else console.log("\nOrder and evidence fields are structurally complete. Independently inspect every transaction and final account state.");
