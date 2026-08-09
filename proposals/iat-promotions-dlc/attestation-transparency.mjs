/**
 * Network-free verifier-attestation and transparency-log model.
 *
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This module canonicalizes and verifies envelopes but never creates keys or
 * signs data. A caller must supply a detached-signature verifier. Tests use an
 * explicitly non-cryptographic public fixture callback with no secret material.
 */

import { createHash } from "node:crypto";

export const ATTESTATION_VERSION = 0;
export const ATTESTATION_DOMAIN = "iat-promotions-dlc-attestation-v0";
export const ATTESTATION_SCHEME = "ED25519_DETACHED";
export const MAXIMUM_ATTESTATION_LIFETIME_SECONDS = 300;
export const MAXIMUM_WALLET_PROOF_AGE_SECONDS = 600;
export const EMPTY_LOG_HASH = "0".repeat(64);

const PURPOSES = new Set(["NOMINATE", "CANCEL", "SETTLE"]);
const OUTCOMES = new Set([
  "NOMINATION_ACCEPTED",
  "NOMINATION_CANCELLED",
  "PAIR_SETTLED",
  "ATTESTATION_REJECTED",
]);
const PAYLOAD_KEYS = [
  "campaignId",
  "domain",
  "expiresAt",
  "issuedAt",
  "nodeId",
  "nonce",
  "purpose",
  "wallet",
  "walletProofDigest",
  "walletProofVerifiedAt",
  "xIdentityCommitment",
];
const UNSIGNED_ENVELOPE_KEYS = [
  "attestationId",
  "keyId",
  "payload",
  "scheme",
  "version",
];
const SIGNED_ENVELOPE_KEYS = [...UNSIGNED_ENVELOPE_KEYS, "signatureBase64"];

function fail(code) {
  throw new Error(code);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function requireExactKeys(value, allowedKeys, code) {
  if (!isPlainObject(value)) fail(code);
  const keys = Object.keys(value).sort();
  const expected = [...allowedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    fail(code);
  }
}

function requireString(value, code, maximumLength = 256) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) fail(code);
  return value;
}

function requireTimestamp(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
}

function requireHash(value, code) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail(code);
  return value;
}

function requireBase58Wallet(value) {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
    fail("INVALID_SOLANA_WALLET");
  }
  return value;
}

function requireBase64(value, code) {
  requireString(value, code, 256);
  let decoded;
  try {
    decoded = Buffer.from(value, "base64");
  } catch {
    fail(code);
  }
  if (decoded.length === 0 || decoded.toString("base64") !== value) fail(code);
  return value;
}

function canonicalValue(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail("CANONICAL_JSON_REQUIRES_SAFE_INTEGER");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isPlainObject(value)) {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) fail("CANONICAL_JSON_REJECTS_UNDEFINED");
      result[key] = canonicalValue(value[key]);
    }
    return result;
  }
  fail("CANONICAL_JSON_UNSUPPORTED_TYPE");
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePayload(payload) {
  requireExactKeys(payload, PAYLOAD_KEYS, "ATTESTATION_PAYLOAD_FIELDS_MISMATCH");
  if (payload.domain !== ATTESTATION_DOMAIN) fail("ATTESTATION_DOMAIN_MISMATCH");
  if (!PURPOSES.has(payload.purpose)) fail("INVALID_ATTESTATION_PURPOSE");

  const issuedAt = requireTimestamp(payload.issuedAt, "INVALID_ATTESTATION_ISSUED_AT");
  const expiresAt = requireTimestamp(payload.expiresAt, "INVALID_ATTESTATION_EXPIRY");
  const walletProofVerifiedAt = requireTimestamp(
    payload.walletProofVerifiedAt,
    "INVALID_WALLET_PROOF_TIMESTAMP",
  );
  if (expiresAt <= issuedAt) fail("ATTESTATION_EXPIRY_NOT_AFTER_ISSUE");
  if (expiresAt - issuedAt > MAXIMUM_ATTESTATION_LIFETIME_SECONDS) {
    fail("ATTESTATION_LIFETIME_TOO_LONG");
  }
  if (walletProofVerifiedAt > issuedAt) fail("WALLET_PROOF_AFTER_ATTESTATION");
  if (issuedAt - walletProofVerifiedAt > MAXIMUM_WALLET_PROOF_AGE_SECONDS) {
    fail("WALLET_PROOF_TOO_OLD");
  }

  return {
    campaignId: requireString(payload.campaignId, "INVALID_CAMPAIGN_ID", 128),
    domain: ATTESTATION_DOMAIN,
    expiresAt,
    issuedAt,
    nodeId: requireString(payload.nodeId, "INVALID_NODE_ID", 128),
    nonce: requireString(payload.nonce, "INVALID_ATTESTATION_NONCE", 128),
    purpose: payload.purpose,
    wallet: requireBase58Wallet(payload.wallet),
    walletProofDigest: requireHash(payload.walletProofDigest, "INVALID_WALLET_PROOF_DIGEST"),
    walletProofVerifiedAt,
    xIdentityCommitment: requireHash(
      payload.xIdentityCommitment,
      "INVALID_X_IDENTITY_COMMITMENT",
    ),
  };
}

function signingMessageFor(unsignedEnvelope) {
  requireExactKeys(unsignedEnvelope, UNSIGNED_ENVELOPE_KEYS, "UNSIGNED_ENVELOPE_FIELDS_MISMATCH");
  return `${ATTESTATION_DOMAIN}\n${canonicalJson(unsignedEnvelope)}`;
}

export function prepareUnsignedAttestationEnvelope({ keyId, payload }) {
  const normalizedPayload = normalizePayload(payload);
  const attestationId = sha256Hex(canonicalJson(normalizedPayload));
  const envelope = {
    attestationId,
    keyId: requireString(keyId, "INVALID_KEY_ID", 128),
    payload: normalizedPayload,
    scheme: ATTESTATION_SCHEME,
    version: ATTESTATION_VERSION,
  };
  return { envelope, signingMessage: signingMessageFor(envelope) };
}

export function attachDetachedSignature(unsignedEnvelope, signatureBase64) {
  requireExactKeys(unsignedEnvelope, UNSIGNED_ENVELOPE_KEYS, "UNSIGNED_ENVELOPE_FIELDS_MISMATCH");
  requireBase64(signatureBase64, "INVALID_SIGNATURE_ENCODING");
  return { ...unsignedEnvelope, signatureBase64 };
}

export function verifyAttestationEnvelope(
  envelope,
  { now, expectedCampaignId, allowedKeyIds, verifyDetachedSignature },
) {
  requireExactKeys(envelope, SIGNED_ENVELOPE_KEYS, "SIGNED_ENVELOPE_FIELDS_MISMATCH");
  requireTimestamp(now, "INVALID_CURRENT_TIMESTAMP");
  if (envelope.version !== ATTESTATION_VERSION) fail("ATTESTATION_VERSION_MISMATCH");
  if (envelope.scheme !== ATTESTATION_SCHEME) fail("ATTESTATION_SCHEME_MISMATCH");
  requireString(envelope.keyId, "INVALID_KEY_ID", 128);
  if (!(allowedKeyIds instanceof Set) || !allowedKeyIds.has(envelope.keyId)) {
    fail("ATTESTATION_KEY_NOT_ALLOWED");
  }
  const payload = normalizePayload(envelope.payload);
  if (canonicalJson(payload) !== canonicalJson(envelope.payload)) fail("ATTESTATION_PAYLOAD_NOT_CANONICAL");
  if (payload.campaignId !== expectedCampaignId) fail("ATTESTATION_CAMPAIGN_MISMATCH");
  if (payload.issuedAt > now) fail("ATTESTATION_NOT_YET_VALID");
  if (payload.expiresAt <= now) fail("ATTESTATION_EXPIRED");

  const expectedId = sha256Hex(canonicalJson(payload));
  if (envelope.attestationId !== expectedId) fail("ATTESTATION_ID_MISMATCH");
  const signature = requireBase64(envelope.signatureBase64, "INVALID_SIGNATURE_ENCODING");
  if (typeof verifyDetachedSignature !== "function") fail("SIGNATURE_VERIFIER_REQUIRED");
  const unsignedEnvelope = {
    attestationId: envelope.attestationId,
    keyId: envelope.keyId,
    payload,
    scheme: envelope.scheme,
    version: envelope.version,
  };
  const verified = verifyDetachedSignature({
    keyId: envelope.keyId,
    message: signingMessageFor(unsignedEnvelope),
    signatureBase64: signature,
    scheme: envelope.scheme,
  });
  if (verified !== true) fail("INVALID_ATTESTATION_SIGNATURE");

  return {
    attestationId: envelope.attestationId,
    campaignId: payload.campaignId,
    expiresAt: payload.expiresAt,
    issuedAt: payload.issuedAt,
    keyId: envelope.keyId,
    nodeId: payload.nodeId,
    nonce: payload.nonce,
    purpose: payload.purpose,
    verified: true,
    wallet: payload.wallet,
    walletProofDigest: payload.walletProofDigest,
    walletProofVerifiedAt: payload.walletProofVerifiedAt,
    xIdentityCommitment: payload.xIdentityCommitment,
  };
}

export function createTransparencyLog({ logId, campaignId }) {
  return {
    version: 0,
    logId: requireString(logId, "INVALID_LOG_ID", 128),
    campaignId: requireString(campaignId, "INVALID_CAMPAIGN_ID", 128),
    headHash: EMPTY_LOG_HASH,
    entries: [],
  };
}

export function appendTransparencyEntry(
  log,
  {
    attestationId,
    purpose,
    outcome,
    reasonCode = null,
    recordedAt,
    publicRecordId = null,
  },
) {
  const errors = validateTransparencyLog(log);
  if (errors.length) fail(`INVALID_TRANSPARENCY_LOG: ${errors.join("; ")}`);
  requireHash(attestationId, "INVALID_ATTESTATION_ID");
  if (!PURPOSES.has(purpose)) fail("INVALID_ATTESTATION_PURPOSE");
  if (!OUTCOMES.has(outcome)) fail("INVALID_TRANSPARENCY_OUTCOME");
  requireTimestamp(recordedAt, "INVALID_RECORDED_AT");
  if (log.entries.some((entry) => entry.attestationId === attestationId)) {
    fail("ATTESTATION_OUTCOME_ALREADY_LOGGED");
  }
  if (reasonCode !== null) requireString(reasonCode, "INVALID_REASON_CODE", 128);
  if (publicRecordId !== null) requireString(publicRecordId, "INVALID_PUBLIC_RECORD_ID", 128);

  const body = {
    attestationId,
    campaignId: log.campaignId,
    logId: log.logId,
    outcome,
    previousHash: log.headHash,
    publicRecordId,
    purpose,
    reasonCode,
    recordedAt,
    sequence: log.entries.length,
    version: 0,
  };
  const entry = { ...body, entryHash: sha256Hex(canonicalJson(body)) };
  return {
    ...log,
    headHash: entry.entryHash,
    entries: [...log.entries, entry],
  };
}

export function validateTransparencyLog(log) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(isPlainObject(log), "log must be a plain object");
  if (!isPlainObject(log)) return errors;
  expect(log.version === 0, "log version mismatch");
  expect(typeof log.logId === "string" && log.logId.length > 0, "log ID missing");
  expect(typeof log.campaignId === "string" && log.campaignId.length > 0, "campaign ID missing");
  expect(Array.isArray(log.entries), "entries must be an array");
  if (!Array.isArray(log.entries)) return errors;

  let previousHash = EMPTY_LOG_HASH;
  const attestationIds = new Set();
  for (let index = 0; index < log.entries.length; index += 1) {
    const entry = log.entries[index];
    if (!isPlainObject(entry)) {
      errors.push(`entry ${index} is not an object`);
      continue;
    }
    const { entryHash, ...body } = entry;
    expect(entry.sequence === index, `entry ${index} sequence mismatch`);
    expect(entry.logId === log.logId, `entry ${index} log ID mismatch`);
    expect(entry.campaignId === log.campaignId, `entry ${index} campaign mismatch`);
    expect(entry.previousHash === previousHash, `entry ${index} previous hash mismatch`);
    expect(entryHash === sha256Hex(canonicalJson(body)), `entry ${index} hash mismatch`);
    expect(!attestationIds.has(entry.attestationId), `entry ${index} repeats attestation outcome`);
    attestationIds.add(entry.attestationId);
    previousHash = entryHash;
  }
  expect(log.headHash === previousHash, "log head hash mismatch");
  return errors;
}

export function createTransparencyCheckpoint(log, { publishedAt }) {
  const errors = validateTransparencyLog(log);
  if (errors.length) fail(`INVALID_TRANSPARENCY_LOG: ${errors.join("; ")}`);
  requireTimestamp(publishedAt, "INVALID_CHECKPOINT_TIMESTAMP");
  const body = {
    campaignId: log.campaignId,
    entryCount: log.entries.length,
    headHash: log.headHash,
    logId: log.logId,
    publishedAt,
    version: 0,
  };
  return { ...body, checkpointHash: sha256Hex(canonicalJson(body)) };
}

export function verifyAppendOnlyExtension(checkpoint, log) {
  const errors = validateTransparencyLog(log);
  if (errors.length) fail(`INVALID_TRANSPARENCY_LOG: ${errors.join("; ")}`);
  if (checkpoint.logId !== log.logId || checkpoint.campaignId !== log.campaignId) {
    fail("CHECKPOINT_LOG_MISMATCH");
  }
  const { checkpointHash, ...checkpointBody } = checkpoint;
  if (checkpointHash !== sha256Hex(canonicalJson(checkpointBody))) fail("CHECKPOINT_HASH_MISMATCH");
  if (!Number.isSafeInteger(checkpoint.entryCount) || checkpoint.entryCount < 0) {
    fail("INVALID_CHECKPOINT_ENTRY_COUNT");
  }
  if (log.entries.length < checkpoint.entryCount) fail("TRANSPARENCY_LOG_TRUNCATED");
  const historicalHead = checkpoint.entryCount === 0
    ? EMPTY_LOG_HASH
    : log.entries[checkpoint.entryCount - 1].entryHash;
  if (historicalHead !== checkpoint.headHash) fail("TRANSPARENCY_HISTORY_REWRITTEN");
  return true;
}
