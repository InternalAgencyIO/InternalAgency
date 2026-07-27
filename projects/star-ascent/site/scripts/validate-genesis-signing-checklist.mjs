#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const path = process.argv[2] ?? "launch/genesis-signing-checklist.template.json";
const checklist = JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`OK: ${message}`);
const isSolanaAddress = (value) => typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const isUtcTimestamp = (value) => {
  if (typeof value !== "string" || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
};
const isDigest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const sha256File = (filePath) => createHash("sha256").update(readFileSync(filePath)).digest("hex");
const requiredRoles = {
  mintAuthoritySigner: "SIGNER",
  feePayerSigner: "SIGNER",
  independentVerifier: "VERIFIER",
  publicationOperator: "PUBLISHER",
};

if (!['HOLD', 'READY'].includes(checklist.status)) fail("status must be HOLD or READY");
if (checklist.network !== "mainnet-beta") fail("network must be mainnet-beta"); else ok("mainnet-beta selected");
if (checklist.manifestPath !== "launch/genesis-manifest.template.json") fail("manifestPath must point to the canonical Genesis manifest");

for (const [name, role] of Object.entries(requiredRoles)) {
  const participant = checklist.participants?.[name];
  if (!participant || participant.role !== role) fail(`${name} must have role ${role}`);
  else ok(`${name} role recorded`);
}

if (checklist.ceremonyControls?.noSecretsInChecklist !== true) fail("checklist must explicitly prohibit secrets");
if (checklist.ceremonyControls?.noBlindApproval !== true) fail("checklist must explicitly prohibit blind approval");
if (checklist.participants?.publicationOperator?.hasNoSigningAuthority !== true) fail("publication operator must not have signing authority");

if (checklist.status === "READY") {
  const signerAddresses = [];
  for (const [name, role] of Object.entries(requiredRoles)) {
    const participant = checklist.participants?.[name];
    if (!isSolanaAddress(participant?.publicAddress)) fail(`READY requires a full Solana public address for ${name}`);
    else { ok(`${name} has Solana address form`); signerAddresses.push(participant.publicAddress); }
    if (role === "SIGNER" && (participant.physicalConfirmationRequired !== true || participant.devicePathReviewed !== true)) fail(`READY requires physical confirmation and device-path review for ${name}`);
  }
  if (new Set(signerAddresses).size !== signerAddresses.length) fail("READY requires distinct public addresses for every ceremony role");
  if (checklist.participants?.independentVerifier?.reviewedManifest !== true) fail("READY requires independent manifest review");
  if (checklist.participants?.independentVerifier?.reviewedDestinations !== true) fail("READY requires independent destination review");
  for (const field of ["recipientAddressesCheckedAgainstManifest", "signerAddressesCheckedAgainstManifest", "holdOwnerConfirmed"]) {
    if (checklist.ceremonyControls?.[field] !== true) fail(`READY requires ${field}: true`);
  }
  if (!isDigest(checklist.ceremonyControls?.manifestSha256)) {
    fail("READY requires ceremonyControls.manifestSha256 as a 64-character hexadecimal digest");
  } else if (checklist.ceremonyControls.manifestSha256.toLowerCase() !== sha256File(checklist.manifestPath)) {
    fail("READY requires ceremonyControls.manifestSha256 to match the exact reviewed manifest");
  } else {
    ok("address review is bound to the exact current manifest digest");
  }
  if (!isUtcTimestamp(checklist.ceremonyControls?.readyAtUtc)) fail("READY requires a canonical ISO-8601 UTC readyAtUtc timestamp ending in Z");
}

if (process.exitCode) console.error("\nSigning checklist does not clear the Genesis gate.");
else console.log("\nSigning checklist structure passes. It never signs, creates transactions, or verifies on-chain state.");
