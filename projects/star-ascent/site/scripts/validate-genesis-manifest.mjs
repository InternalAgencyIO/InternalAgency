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
const hasExactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const isPublicHttpsUrl = (value) => {
  if (typeof value !== "string" || /\[|\]|pending|todo|example/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
// The release record must point to the English-first public Proof Board. This
// prevents a lookalike host or an alternate document from becoming the record
// that reviewers treat as the canonical allocation and lock evidence.
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
const isSolanaAddress = (value) => typeof value === "string"
  && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
  && base58DecodedLength(value) === 32;
const isUsableSolanaAddress = (value) => isSolanaAddress(value) && value !== "11111111111111111111111111111111";
const isSolanaTransactionSignature = (value) => typeof value === "string"
  && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value)
  && !/^1+$/.test(value)
  && base58DecodedLength(value) === 64;
const isUnsignedInteger = (value) => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value);
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
  // Bare 64-byte Base58 values are indistinguishable from exported Solana
  // keypair material. Explorer URLs remain valid because the complete value
  // is not itself Base58.
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

if (manifest.network !== "mainnet-beta") fail("network must be mainnet-beta"); else ok("mainnet-beta selected");
if (manifest.token?.symbol !== "IAT") fail("token symbol must be IAT"); else ok("token symbol is IAT");
if (manifest.token?.name !== "Internal Agency Token") fail("token name must be Internal Agency Token"); else ok("token name is Internal Agency Token");
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
const expectedAllocationNames = Object.keys(expected);
const expectedTransactionOrder = [
  "CREATE_MINT",
  "MINT_ALLOCATION_DESTINATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
  "PUBLISH_EVIDENCE",
];
const requiredEvidenceRecords = [
  "mintCreation",
  "allocationMints",
  "mintAuthorityRevocation",
  "freezeAuthorityRevocation",
  "publicationRecord",
];
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
const reviewedManifestFields = ["status", "network", "token", "allocations", "claimOrDistribution", "releaseEvidence"];
const reviewedTokenFields = ["symbol", "name", "program", "decimals", "fixedSupplyTarget", "fixedSupplyBaseUnits", "mint", "mintAuthorityRevocationTransaction", "freezeAuthorityRevocationTransaction"];
const reviewedAllocationFields = ["share", "baseUnitAmount", "destination", "evidence"];
const reviewedClaimFields = ["status", "canonicalRoute"];
const reviewedReleaseEvidenceFields = ["transactionOrder", "records"];
const isDirectMintExplorerRecord = (value, mint) => {
  if (!isPublicHttpsUrl(value) || !isUsableSolanaAddress(mint)) return false;
  const url = new URL(value);
  return url.hostname === "explorer.solana.com"
    && !url.port
    && url.pathname === `/address/${mint}`
    && !url.search
    && !url.hash;
};
const isDirectAllocationExplorerRecord = (value, destination) => {
  if (!isPublicHttpsUrl(value) || !isUsableSolanaAddress(destination)) return false;
  const url = new URL(value);
  return url.hostname === "explorer.solana.com"
    && !url.port
    && url.pathname === `/address/${destination}`
    && !url.search
    && !url.hash;
};

if (!hasExactKeys(manifest, reviewedManifestFields)) fail("manifest must contain only canonical reviewed fields");
else ok("manifest contains only canonical reviewed fields");
if (!hasExactKeys(manifest.token, reviewedTokenFields)) fail("token must contain only canonical reviewed fields");
else ok("token contains only canonical reviewed fields");
for (const name of expectedAllocationNames) {
  if (!hasExactKeys(manifest.allocations?.[name], reviewedAllocationFields)) {
    fail(`${name} allocation must contain only canonical reviewed fields`);
  } else {
    ok(`${name} allocation contains only canonical reviewed fields`);
  }
}
if (!hasExactKeys(manifest.claimOrDistribution, reviewedClaimFields)) fail("claimOrDistribution must contain only canonical reviewed fields");
else ok("claimOrDistribution contains only canonical reviewed fields");
if (!hasExactKeys(manifest.releaseEvidence, reviewedReleaseEvidenceFields)) fail("releaseEvidence must contain only canonical reviewed fields");
else ok("releaseEvidence contains only canonical reviewed fields");
if (!hasExactKeys(manifest.releaseEvidence?.records, requiredEvidenceRecords)) fail("releaseEvidence.records must contain only canonical reviewed fields");
else ok("releaseEvidence.records contains only canonical reviewed fields");
const providedAllocationNames = Object.keys(manifest.allocations ?? {});
for (const name of providedAllocationNames) {
  if (!expectedAllocationNames.includes(name)) {
    fail(`allocations must not include an unaccounted-for bucket: ${name}`);
  }
}
if (providedAllocationNames.length !== expectedAllocationNames.length) {
  fail("allocations must include exactly the five canonical allocation buckets");
} else if (!process.exitCode) {
  ok("allocation inventory contains exactly the five canonical buckets");
}
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
const transactionOrder = manifest.releaseEvidence?.transactionOrder;
if (!Array.isArray(transactionOrder) || transactionOrder.length !== expectedTransactionOrder.length || transactionOrder.some((step, index) => step !== expectedTransactionOrder[index])) {
  fail(`releaseEvidence.transactionOrder must be exactly: ${expectedTransactionOrder.join(" -> ")}`);
} else {
  ok("release evidence preserves the canonical Genesis transaction order");
}
const evidenceRecords = manifest.releaseEvidence?.records;
if (!evidenceRecords || typeof evidenceRecords !== "object" || Array.isArray(evidenceRecords)) {
  fail("releaseEvidence.records must be an object");
} else if (manifest.status === "HOLD") {
  for (const name of requiredEvidenceRecords) {
    if (evidenceRecords[name] !== null) fail(`HOLD requires releaseEvidence.records.${name} to be null`);
  }
  if (!process.exitCode) ok("HOLD manifest contains no Genesis evidence assertions");
}
if (manifest.status === "HOLD") {
  // HOLD is a full reset. A previous mint, authority-revocation receipt, or
  // allocation destination must not remain visible as though it were current
  // Genesis evidence after a correction or aborted ceremony.
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
  if (!process.exitCode) ok("HOLD state: no stale token, allocation, or public claim evidence is asserted");
} else {
  if (manifest.claimOrDistribution?.status !== "PUBLISHED") fail("PUBLISHED requires claimOrDistribution.status to be PUBLISHED");
  const checks = [
    ["token.mint", manifest.token?.mint, isUsableSolanaAddress],
    ["token.mintAuthorityRevocationTransaction", manifest.token?.mintAuthorityRevocationTransaction, isDirectSolanaTransactionRecord],
    ["token.freezeAuthorityRevocationTransaction", manifest.token?.freezeAuthorityRevocationTransaction, isDirectSolanaTransactionRecord],
    ["claimOrDistribution.canonicalRoute", manifest.claimOrDistribution?.canonicalRoute, isCanonicalPublicRoute],
  ];
  for (const [name, value, validate] of checks) {
    if (!validate(value)) fail(`PUBLISHED requires a non-placeholder public value for ${name}`); else ok(`${name} present`);
  }
  const allocationDestinations = [];
  const allocationEvidenceUrls = [];
  for (const [name, allocation] of Object.entries(manifest.allocations ?? {})) {
    if (!isUsableSolanaAddress(allocation.destination)) {
      fail(`PUBLISHED requires a usable public destination for ${name}`);
    } else if (!isDirectAllocationExplorerRecord(allocation.evidence, allocation.destination)) {
      fail(`PUBLISHED requires ${name} allocation evidence to be a direct explorer.solana.com address record for its destination`);
    }
    else {
      allocationDestinations.push(allocation.destination);
      allocationEvidenceUrls.push(allocation.evidence);
      ok(`${name} destination and evidence present`);
    }
  }
  if (allocationDestinations.length === Object.keys(expected).length && new Set(allocationDestinations).size !== allocationDestinations.length) {
    fail("PUBLISHED requires a distinct destination for every allocation");
  } else if (allocationDestinations.length === Object.keys(expected).length) {
    ok("every allocation uses a distinct destination");
  }
  if (allocationDestinations.includes(manifest.token.mint)) {
    fail("PUBLISHED allocation destinations must not reuse the mint address");
  } else if (allocationDestinations.length === Object.keys(expected).length) {
    ok("allocation destinations are separate from the mint address");
  }
  if (allocationEvidenceUrls.length === Object.keys(expected).length && new Set(allocationEvidenceUrls).size !== allocationEvidenceUrls.length) {
    fail("PUBLISHED requires distinct allocation evidence URLs");
  } else if (allocationEvidenceUrls.length === Object.keys(expected).length) {
    ok("every allocation has distinct public evidence");
  }
  const publicationRecord = evidenceRecords?.publicationRecord;
  const publishedEvidenceUrls = [];
  for (const recordName of requiredEvidenceRecords) {
    const evidenceUrl = evidenceRecords?.[recordName];
    if (!isPublicHttpsUrl(evidenceUrl)) {
      fail(`PUBLISHED requires a non-placeholder public releaseEvidence.records.${recordName}`);
    } else {
      publishedEvidenceUrls.push(evidenceUrl);
      ok(`${recordName} evidence present`);
    }
  }
  if (publishedEvidenceUrls.length === requiredEvidenceRecords.length && new Set(publishedEvidenceUrls).size !== publishedEvidenceUrls.length) {
    fail("PUBLISHED requires distinct evidence URLs for each Genesis sequence step");
  } else if (publishedEvidenceUrls.length === requiredEvidenceRecords.length) {
    ok("each Genesis sequence step has distinct public evidence");
  }
  if (!isDirectSolanaTransactionRecord(evidenceRecords?.allocationMints)) {
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
    } else if (evidenceRecords?.[recordName] !== canonicalUrl) {
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
  if (!isPublicHttpsUrl(publicationRecord)) {
    fail("PUBLISHED requires a non-placeholder public releaseEvidence.records.publicationRecord");
  } else if (publicationRecord !== manifest.claimOrDistribution.canonicalRoute) {
    fail("PUBLISHED publicationRecord evidence must exactly match the canonical public route");
  } else {
    ok("publication record matches the canonical public route");
  }
  const mintCreationRecord = evidenceRecords?.mintCreation;
  if (!isPublicHttpsUrl(mintCreationRecord)) {
    fail("PUBLISHED requires a non-placeholder public releaseEvidence.records.mintCreation");
  } else if (!isDirectMintExplorerRecord(mintCreationRecord, manifest.token.mint)) {
    fail("PUBLISHED mintCreation evidence must be a direct explorer.solana.com address record for the claimed mint");
  } else {
    ok("mint creation evidence identifies the claimed mint");
  }
}

if (process.exitCode) console.error("\nManifest remains HOLD. Do not publish a claim or token status.");
else console.log("\nManifest structure passes. Independent on-chain verification is still required.");
