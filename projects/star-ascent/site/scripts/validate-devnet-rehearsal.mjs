#!/usr/bin/env node

import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "launch/devnet-rehearsal.template.json";
const rehearsal = JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const isSolanaAddress = (value) => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const isPublicHttpsUrl = (value) => {
  if (typeof value !== "string" || /\[|\]|pending|todo|example/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isUtcTimestamp = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value);

if (!["PLANNED", "COMPLETED"].includes(rehearsal.status)) fail("status must be PLANNED or COMPLETED");
if (rehearsal.network !== "devnet") fail("rehearsal must remain on devnet"); else ok("devnet selected");
if (rehearsal.token?.program !== "Original SPL Token Program") fail("unexpected token program"); else ok("original SPL Token Program selected");
if (rehearsal.token?.decimals !== 9) fail("decimals must be 9"); else ok("9 decimals selected");
if (rehearsal.signingRules?.physicalConfirmationRequired !== true) fail("physical confirmation is required");
if (rehearsal.signingRules?.noSecretsInManifest !== true) fail("manifest must not contain secrets");
if (rehearsal.signingRules?.noBlindApproval !== true) fail("blind approval is forbidden");

if (rehearsal.status === "COMPLETED") {
  const required = [
    ["token.mint", rehearsal.token?.mint],
    ["token.mintCreationTransaction", rehearsal.token?.mintCreationTransaction],
    ["token.mintTransaction", rehearsal.token?.mintTransaction],
    ["token.mintAuthorityRevocationTransaction", rehearsal.token?.mintAuthorityRevocationTransaction],
    ["token.freezeAuthorityRevocationTransaction", rehearsal.token?.freezeAuthorityRevocationTransaction],
    ["destinations.testRecipient.address", rehearsal.destinations?.testRecipient?.address],
    ["destinations.testRecipient.evidence", rehearsal.destinations?.testRecipient?.evidence],
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
    if (!isSolanaAddress(value)) fail(`COMPLETED requires a full Solana address for ${name}`); else ok(`${name} has Solana address form`);
  }
  for (const [name, value] of [
    ["token.mintCreationTransaction", rehearsal.token?.mintCreationTransaction],
    ["token.mintTransaction", rehearsal.token?.mintTransaction],
    ["token.mintAuthorityRevocationTransaction", rehearsal.token?.mintAuthorityRevocationTransaction],
    ["token.freezeAuthorityRevocationTransaction", rehearsal.token?.freezeAuthorityRevocationTransaction],
    ["destinations.testRecipient.evidence", rehearsal.destinations?.testRecipient?.evidence],
  ]) {
    if (!isPublicHttpsUrl(value)) fail(`COMPLETED requires non-placeholder public HTTPS evidence for ${name}`); else ok(`${name} has public evidence`);
  }
  if (!isUtcTimestamp(rehearsal.verifier?.completedAtUtc)) fail("COMPLETED requires an ISO-8601 UTC completion time"); else ok("completion time is ISO-8601 UTC");
  if (rehearsal.device?.sameMainnetPathConfirmed !== true) fail("COMPLETED requires sameMainnetPathConfirmed: true");
}

if (process.exitCode) console.error("\nRehearsal is not ready to clear the Genesis gate.");
else console.log("\nRehearsal structure passes. Explorer verification remains mandatory.");
