#!/usr/bin/env node

import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "launch/devnet-rehearsal.template.json";
const rehearsal = JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const base58DecodedLength = (value) => {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{1,88}$/.test(value)) return false;
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
const isSolanaAddress = (value) => base58DecodedLength(value) === 32;
const isSolanaTransactionSignature = (value) => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value) && base58DecodedLength(value) === 64;
const isUsableSolanaAddress = (value) => isSolanaAddress(value) && value !== "11111111111111111111111111111111";
const isPublicHttpsUrl = (value) => {
  if (typeof value !== "string" || /\[|\]|pending|todo|example/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isDevnetExplorerEvidence = (value, recordType) => {
  if (!isPublicHttpsUrl(value)) return false;
  const url = new URL(value);
  if (
    url.hostname !== "explorer.solana.com"
    || url.search !== "?cluster=devnet"
    || url.hash
  ) return false;
  const expectedPrefix = recordType === "transaction" ? "/tx/" : "/address/";
  const subject = url.pathname.startsWith(expectedPrefix) ? url.pathname.slice(expectedPrefix.length).split("/")[0] : "";
  if (url.pathname !== `${expectedPrefix}${subject}`) return false;
  return recordType === "transaction" ? isSolanaTransactionSignature(subject) : isSolanaAddress(subject);
};
const devnetExplorerSubject = (value, recordType) => {
  if (!isDevnetExplorerEvidence(value, recordType)) return null;
  const prefix = recordType === "transaction" ? "/tx/" : "/address/";
  return new URL(value).pathname.slice(prefix.length).split("/")[0];
};
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
};
const secretBearingFieldName = (name) => {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return /^(seed|seedphrase|mnemonic|privatekey|secretkey|keypair|passphrase|devicepin|wallet(?:export|backup)|recovery(?:phrase|words|material)?)$/.test(normalized);
};
const findSecretBearingField = (value, path = "rehearsal") => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findSecretBearingField(item, `${path}[${index}]`);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) {
      const fieldPath = `${path}.${name}`;
      if (secretBearingFieldName(name)) return fieldPath;
      const found = findSecretBearingField(item, fieldPath);
      if (found) return found;
    }
  }
  return null;
};

if (!["PLANNED", "COMPLETED"].includes(rehearsal.status)) fail("status must be PLANNED or COMPLETED");
if (rehearsal.network !== "devnet") fail("rehearsal must remain on devnet"); else ok("devnet selected");
if (rehearsal.token?.program !== "Original SPL Token Program") fail("unexpected token program"); else ok("original SPL Token Program selected");
if (rehearsal.token?.decimals !== 9) fail("decimals must be 9"); else ok("9 decimals selected");
const testSupply = rehearsal.token?.testSupply;
const testSupplyBaseUnits = rehearsal.token?.testSupplyBaseUnits;
if (typeof testSupply !== "string" || !/^[1-9]\d*$/.test(testSupply)) {
  fail("testSupply must be a positive whole-token decimal string without leading zeroes");
} else if (typeof testSupplyBaseUnits !== "string" || !/^[1-9]\d*$/.test(testSupplyBaseUnits)) {
  fail("testSupplyBaseUnits must be a positive base-unit decimal string without leading zeroes");
} else if (BigInt(testSupplyBaseUnits) !== BigInt(testSupply) * (10n ** BigInt(rehearsal.token.decimals))) {
  fail("testSupplyBaseUnits must exactly equal testSupply at the declared decimal precision");
} else {
  ok("test rehearsal supply exactly matches its base-unit value");
}
if (rehearsal.signingRules?.physicalConfirmationRequired !== true) fail("physical confirmation is required");
if (rehearsal.signingRules?.noSecretsInManifest !== true) fail("manifest must not contain secrets");
if (rehearsal.signingRules?.noBlindApproval !== true) fail("blind approval is forbidden");
if (rehearsal.device?.model !== "Trezor Model T") fail("rehearsal must use a Trezor Model T"); else ok("Trezor Model T selected");
const secretBearingField = findSecretBearingField(rehearsal);
if (secretBearingField) fail(`rehearsal must not contain credential-bearing field ${secretBearingField}`); else ok("no credential-bearing fields are present");

if (rehearsal.status === "COMPLETED") {
  const required = [
    ["token.mint", rehearsal.token?.mint],
    ["token.mintEvidence", rehearsal.token?.mintEvidence],
    ["token.mintCreationTransaction", rehearsal.token?.mintCreationTransaction],
    ["token.mintInitializationTransaction", rehearsal.token?.mintInitializationTransaction],
    ["token.mintTransaction", rehearsal.token?.mintTransaction],
    ["token.mintAuthorityRevocationTransaction", rehearsal.token?.mintAuthorityRevocationTransaction],
    ["token.freezeAuthorityRevocationTransaction", rehearsal.token?.freezeAuthorityRevocationTransaction],
    ["destinations.testRecipient.address", rehearsal.destinations?.testRecipient?.address],
    ["destinations.testRecipient.evidence", rehearsal.destinations?.testRecipient?.evidence],
    ["destinations.testRecipient.creationTransaction", rehearsal.destinations?.testRecipient?.creationTransaction],
    ["device.firmwareVersion", rehearsal.device?.firmwareVersion],
    ["device.suiteOrWalletInterface", rehearsal.device?.suiteOrWalletInterface],
    ["verifier.reviewedBy", rehearsal.verifier?.reviewedBy],
    ["verifier.completedAtUtc", rehearsal.verifier?.completedAtUtc],
  ];
  for (const [name, value] of required) {
    if (!value || typeof value !== "string") fail(`COMPLETED requires ${name}`); else ok(`${name} recorded`);
  }
  for (const [name, value] of [
    ["token.mint", rehearsal.token?.mint],
    ["destinations.testRecipient.address", rehearsal.destinations?.testRecipient?.address],
  ]) {
    if (!isUsableSolanaAddress(value)) fail(`COMPLETED requires a usable 32-byte Solana address for ${name}`); else ok(`${name} has a usable 32-byte Solana address`);
  }
  if (!isDevnetExplorerEvidence(rehearsal.token?.mintEvidence, "address")) {
    fail("COMPLETED requires a Solana Explorer devnet address URL for token.mintEvidence");
  } else if (devnetExplorerSubject(rehearsal.token.mintEvidence, "address") !== rehearsal.token.mint) {
    fail("COMPLETED mint evidence must point to the recorded devnet mint address");
  } else if (isUsableSolanaAddress(rehearsal.token?.mint)) {
    ok("mint evidence points to the recorded devnet mint address");
  }
  if (rehearsal.token?.mint === rehearsal.destinations?.testRecipient?.address) {
    fail("COMPLETED test recipient must not reuse the devnet mint address");
  } else if (isUsableSolanaAddress(rehearsal.token?.mint) && isUsableSolanaAddress(rehearsal.destinations?.testRecipient?.address)) {
    ok("test recipient is distinct from the devnet mint address");
  }
  for (const [name, value] of [
    ["token.mintCreationTransaction", rehearsal.token?.mintCreationTransaction],
    ["token.mintInitializationTransaction", rehearsal.token?.mintInitializationTransaction],
    ["token.mintTransaction", rehearsal.token?.mintTransaction],
    ["token.mintAuthorityRevocationTransaction", rehearsal.token?.mintAuthorityRevocationTransaction],
    ["token.freezeAuthorityRevocationTransaction", rehearsal.token?.freezeAuthorityRevocationTransaction],
    ["destinations.testRecipient.creationTransaction", rehearsal.destinations?.testRecipient?.creationTransaction],
  ]) {
    if (!isDevnetExplorerEvidence(value, "transaction")) fail(`COMPLETED requires a Solana Explorer devnet transaction URL for ${name}`); else ok(`${name} has Solana Explorer devnet transaction evidence`);
  }
  if (!isDevnetExplorerEvidence(rehearsal.destinations?.testRecipient?.evidence, "address")) {
    fail("COMPLETED requires a Solana Explorer devnet address URL for destinations.testRecipient.evidence");
  } else ok("destinations.testRecipient.evidence has Solana Explorer devnet address evidence");
  if (devnetExplorerSubject(rehearsal.destinations?.testRecipient?.evidence, "address") !== rehearsal.destinations?.testRecipient?.address) {
    fail("COMPLETED test-recipient evidence must point to the recorded test-recipient address");
  } else if (isUsableSolanaAddress(rehearsal.destinations?.testRecipient?.address)) {
    ok("test-recipient evidence points to the recorded test-recipient address");
  }
  const transactionEvidence = [
    rehearsal.token?.mintCreationTransaction,
    rehearsal.token?.mintInitializationTransaction,
    rehearsal.destinations?.testRecipient?.creationTransaction,
    rehearsal.token?.mintTransaction,
    rehearsal.token?.mintAuthorityRevocationTransaction,
    rehearsal.token?.freezeAuthorityRevocationTransaction,
  ];
  if (new Set(transactionEvidence).size !== transactionEvidence.length) {
    fail("COMPLETED requires distinct devnet transaction evidence for every rehearsal step");
  } else if (transactionEvidence.every((value) => isDevnetExplorerEvidence(value, "transaction"))) {
    ok("every rehearsal step has distinct devnet transaction evidence");
  }
  const transactionSubjects = transactionEvidence.map((value) => devnetExplorerSubject(value, "transaction"));
  if (transactionSubjects.some((value) => value === null)) {
    fail("COMPLETED requires decodable transaction identities for every rehearsal step");
  } else if (new Set(transactionSubjects).size !== transactionSubjects.length) {
    fail("COMPLETED requires a different devnet transaction for every rehearsal step");
  } else {
    ok("every rehearsal step names a different devnet transaction");
  }
  if (!isUtcTimestamp(rehearsal.verifier?.completedAtUtc)) fail("COMPLETED requires an ISO-8601 UTC completion time"); else ok("completion time is ISO-8601 UTC");
  if (rehearsal.device?.sameMainnetPathConfirmed !== true) fail("COMPLETED requires sameMainnetPathConfirmed: true");
}

if (process.exitCode) console.error("\nRehearsal is not ready to clear the Genesis gate.");
else console.log("\nRehearsal structure passes. Explorer verification remains mandatory.");
