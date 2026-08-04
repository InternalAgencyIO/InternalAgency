#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PublicKey } from "@solana/web3.js";

const canonicalPath = "launch/iat-v2-devnet-independent-signoff.template.json";
const evidencePath = "public/evidence/iat-v2/v2-initialization-20260730T074603Z.json";
const requestedPath = process.argv[2] ?? canonicalPath;
const failures = [];
const fail = (message) => failures.push(message);
const expectedAttestation =
  "I independently reviewed the bound IAT V2 devnet initialization evidence and every listed check matched without exception.";

function exactKeys(value, keys) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
}

function isPublicKey(value) {
  try {
    return typeof value === "string" && new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

function isUtc(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function findCredentialField(value, path = "signoff") {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (/(secret|private.?key|mnemonic|seed.?phrase|passphrase|password|recovery.?phrase|pin)/i.test(key)) {
      return `${path}.${key}`;
    }
    const nested = findCredentialField(child, `${path}.${key}`);
    if (nested) return nested;
  }
  return null;
}

if (requestedPath.replaceAll("\\", "/") !== canonicalPath) {
  fail(`sign-off path must be ${canonicalPath}`);
}

let signoff;
let evidence;
try {
  signoff = JSON.parse(readFileSync(resolve(canonicalPath), "utf8"));
  evidence = JSON.parse(readFileSync(resolve(evidencePath), "utf8"));
} catch (error) {
  fail(`sign-off or evidence is unreadable: ${error.message}`);
}

if (signoff && evidence) {
  if (!exactKeys(signoff, [
    "schema",
    "status",
    "scope",
    "evidence",
    "verifier",
    "checks",
    "exceptions",
    "attestation",
    "completedAtUtc",
  ])) fail("sign-off must contain only canonical top-level fields");
  if (signoff.schema !== "iat-v2-devnet-independent-signoff/v1") fail("wrong sign-off schema");
  if (!["PENDING", "VERIFIED"].includes(signoff.status)) fail("status must be PENDING or VERIFIED");
  if (signoff.scope !== "SEVEN_TRANSACTION_DEVNET_INITIALIZATION_AND_ACTIVATION_ONLY") {
    fail("sign-off scope must remain limited to initialization and activation");
  }
  const credentialField = findCredentialField(signoff);
  if (credentialField) fail(`sign-off contains forbidden credential field ${credentialField}`);

  if (!exactKeys(signoff.evidence, [
    "path",
    "sha256",
    "sourceCommit",
    "programId",
    "mint",
    "transactionCount",
  ])) fail("evidence binding must contain only canonical fields");
  if (
    signoff.evidence?.path !== evidencePath
    || signoff.evidence?.sha256 !== sha256File(evidencePath)
    || signoff.evidence?.sourceCommit !== evidence.sourceCommit
    || signoff.evidence?.programId !== evidence.programId
    || signoff.evidence?.mint !== evidence.mint
    || signoff.evidence?.transactionCount !== evidence.transactions?.length
  ) fail("sign-off evidence binding does not match the canonical evidence file");
  if (!isPublicKey(signoff.evidence?.programId) || !isPublicKey(signoff.evidence?.mint)) {
    fail("program and mint must be canonical Solana public keys");
  }

  if (!exactKeys(signoff.verifier, [
    "accountabilityLabel",
    "publicSolanaAddress",
    "independentOfOperator",
    "didNotOperateModelT",
    "reviewMethod",
    "communicationReference",
  ])) fail("verifier record must contain only canonical fields");
  if (
    signoff.verifier?.accountabilityLabel !== "FDF Guard"
    || signoff.verifier?.publicSolanaAddress !== "Ge2c3puY5YwsiLhFJWdoXpRbE55k7omLw37pvJVCBkja"
    || !isPublicKey(signoff.verifier?.publicSolanaAddress)
  ) fail("verifier identity does not match the reviewed independent verifier");
  if (signoff.verifier?.publicSolanaAddress === evidence.expectedHardwareSigner) {
    fail("independent verifier must not reuse the Model T operator address");
  }

  const checkKeys = [
    "evidenceSha256Matched",
    "sevenTransactionsFinalizedAndOrdered",
    "transactionMessageHashesMatched",
    "programArtifactAndUpgradeAuthorityMatched",
    "mintMetadataDecimalsAndSupplyMatched",
    "mintAndFreezeAuthoritiesAreNone",
    "fiveDestinationsAndAmountsMatched",
    "configVaultsAndSwitchboardIdentityMatched",
    "coreRewardRateTermAndReservationMatched",
    "mainnetRemainedHold",
  ];
  if (!exactKeys(signoff.checks, checkKeys)) fail("check record must contain only canonical fields");
  if (!Array.isArray(signoff.exceptions)) fail("exceptions must be an array");

  if (signoff.status === "PENDING") {
    if (
      signoff.verifier?.independentOfOperator !== null
      || signoff.verifier?.didNotOperateModelT !== null
      || signoff.verifier?.reviewMethod !== null
      || signoff.verifier?.communicationReference !== null
      || Object.values(signoff.checks ?? {}).some((value) => value !== false)
      || signoff.exceptions?.length !== 0
      || signoff.attestation !== null
      || signoff.completedAtUtc !== null
    ) fail("PENDING sign-off must not contain partial or self-asserted completion evidence");
  }

  if (signoff.status === "VERIFIED") {
    if (
      signoff.verifier?.independentOfOperator !== true
      || signoff.verifier?.didNotOperateModelT !== true
    ) fail("VERIFIED sign-off requires explicit operator independence");
    if (
      typeof signoff.verifier?.reviewMethod !== "string"
      || signoff.verifier.reviewMethod.trim().length < 12
      || typeof signoff.verifier?.communicationReference !== "string"
      || signoff.verifier.communicationReference.trim().length < 8
    ) fail("VERIFIED sign-off requires a review method and communication reference");
    if (Object.values(signoff.checks ?? {}).some((value) => value !== true)) {
      fail("VERIFIED sign-off requires every canonical check to be true");
    }
    if (signoff.exceptions?.length !== 0) fail("VERIFIED sign-off cannot contain exceptions");
    if (signoff.attestation !== expectedAttestation) fail("VERIFIED attestation text is not canonical");
    if (!isUtc(signoff.completedAtUtc)) fail("VERIFIED sign-off requires canonical UTC completion time");
    else {
      const completedAt = Date.parse(signoff.completedAtUtc);
      const evidenceAt = Date.parse(evidence.exportedAtUtc);
      if (completedAt <= evidenceAt) fail("verifier completion must follow evidence export");
      if (completedAt > Date.now() + 60_000) fail("verifier completion cannot be in the future");
    }
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(
  signoff.status === "VERIFIED"
    ? "IAT V2 devnet independent initialization sign-off passes. Full feature rehearsal and mainnet gates remain separate."
    : "IAT V2 devnet independent initialization sign-off is PENDING.",
);
