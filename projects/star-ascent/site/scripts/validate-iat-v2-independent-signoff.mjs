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
    "observationPolicy",
    "checks",
    "exceptions",
    "completedAtUtc",
  ])) fail("sign-off must contain only canonical top-level fields");
  if (signoff.schema !== "iat-v2-devnet-automated-observation/v2") fail("wrong automated-observation schema");
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

  const expectedObservationPolicy = {
    mode: "AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION",
    humanReviewerRequired: false,
    noSelfAttestation: true,
    trezorModelTPhysicalConfirmationIsSoleHumanGate: true,
  };
  if (!exactKeys(signoff.observationPolicy, Object.keys(expectedObservationPolicy))) {
    fail("observationPolicy must contain only canonical automated-policy fields");
  } else if (JSON.stringify(signoff.observationPolicy) !== JSON.stringify(expectedObservationPolicy)) {
    fail("observationPolicy must preserve automated evidence, no-self-attestation, and Model T-only signature gates");
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
      Object.values(signoff.checks ?? {}).some((value) => value !== false)
      || signoff.exceptions?.length !== 0
      || signoff.completedAtUtc !== null
    ) fail("PENDING observation must not contain partial or self-asserted completion evidence");
  }

  if (signoff.status === "VERIFIED") {
    if (Object.values(signoff.checks ?? {}).some((value) => value !== true)) {
      fail("VERIFIED observation requires every canonical check to be true");
    }
    if (signoff.exceptions?.length !== 0) fail("VERIFIED observation cannot contain exceptions");
    if (!isUtc(signoff.completedAtUtc)) fail("VERIFIED observation requires canonical UTC completion time");
    else {
      const completedAt = Date.parse(signoff.completedAtUtc);
      const evidenceAt = Date.parse(evidence.exportedAtUtc);
      if (completedAt <= evidenceAt) fail("automated observation completion must follow evidence export");
      if (completedAt > Date.now() + 60_000) fail("automated observation completion cannot be in the future");
    }
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(
  signoff.status === "VERIFIED"
    ? "IAT V2 devnet initialization automated observation passes. Full feature rehearsal and mainnet gates remain separate."
    : "IAT V2 devnet initialization automated observation is PENDING.",
);
