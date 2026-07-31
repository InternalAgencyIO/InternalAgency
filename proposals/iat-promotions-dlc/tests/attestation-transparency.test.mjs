import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  ATTESTATION_DOMAIN,
  appendTransparencyEntry,
  attachDetachedSignature,
  canonicalJson,
  createTransparencyCheckpoint,
  createTransparencyLog,
  prepareUnsignedAttestationEnvelope,
  sha256Hex,
  validateTransparencyLog,
  verifyAppendOnlyExtension,
  verifyAttestationEnvelope,
} from "../attestation-transparency.mjs";
import {
  AttestationPurpose,
  COMMUNITY_PROMOTION_SOURCE,
  MAXIMUM_BUDGET_BASE_UNITS,
  activateCampaign,
  createCampaign,
  fundCampaign,
  nominateHero,
  settlePair,
} from "../reference-engine.mjs";

const CAMPAIGN_ID = "iat-promotions-dlc-v0-reference";
const KEY_ID = "public-test-verifier-v0";
const NOW = 1_800_100_000;
const HASH = "b".repeat(64);
const wallet = (character) => character.repeat(44);
const commitment = (value) => sha256Hex(value);

// Deliberately public, deterministic, and non-cryptographic. It exercises the
// detached-signature boundary without creating or embedding any key material.
function publicTestSignature({ keyId, message }) {
  return createHash("sha256")
    .update("PUBLIC_TEST_FIXTURE_NOT_A_SIGNATURE\0")
    .update(keyId)
    .update("\0")
    .update(message)
    .digest("base64");
}

function publicTestVerifier({ keyId, message, signatureBase64 }) {
  return signatureBase64 === publicTestSignature({ keyId, message });
}

function envelopeFor({
  identity,
  purpose = "NOMINATE",
  campaignId = CAMPAIGN_ID,
  keyId = KEY_ID,
  now = NOW,
  overrides = {},
}) {
  const payload = {
    campaignId,
    domain: ATTESTATION_DOMAIN,
    expiresAt: now + 300,
    issuedAt: now,
    nodeId: `node-${identity}`,
    nonce: `nonce-${purpose.toLowerCase()}-${identity}-${now}`,
    purpose,
    wallet: wallet(identity === "proposer" ? "7" : "8"),
    walletProofDigest: commitment(`wallet-proof-${identity}`),
    walletProofVerifiedAt: now - 1,
    xIdentityCommitment: commitment(`x-${identity}`),
    ...overrides,
  };
  const prepared = prepareUnsignedAttestationEnvelope({ keyId, payload });
  return attachDetachedSignature(
    prepared.envelope,
    publicTestSignature({ keyId, message: prepared.signingMessage }),
  );
}

function verifyEnvelope(envelope, now = NOW + 1) {
  return verifyAttestationEnvelope(envelope, {
    now,
    expectedCampaignId: CAMPAIGN_ID,
    allowedKeyIds: new Set([KEY_ID]),
    verifyDetachedSignature: publicTestVerifier,
  });
}

test("canonical JSON is stable across object insertion order", () => {
  assert.equal(
    canonicalJson({ z: 1, a: { y: 2, b: 3 } }),
    canonicalJson({ a: { b: 3, y: 2 }, z: 1 }),
  );
  assert.throws(() => canonicalJson({ unsafe: Number.MAX_SAFE_INTEGER + 1 }), /SAFE_INTEGER/);
});

test("a valid envelope verifies to the minimal reference-engine binding", () => {
  const envelope = envelopeFor({ identity: "proposer" });
  const verified = verifyEnvelope(envelope);
  assert.equal(verified.verified, true);
  assert.equal(verified.campaignId, CAMPAIGN_ID);
  assert.equal(verified.purpose, "NOMINATE");
  assert.equal(verified.wallet, wallet("7"));
  assert.equal(verified.xIdentityCommitment, commitment("x-proposer"));
  assert.equal(verified.attestationId, commitment(canonicalJson(envelope.payload)));
});

test("payload, ID, signature, extra-field, key, and campaign tampering is rejected", () => {
  const envelope = envelopeFor({ identity: "proposer" });

  assert.throws(
    () => verifyEnvelope({ ...envelope, payload: { ...envelope.payload, nodeId: "node-attacker" } }),
    /ATTESTATION_ID_MISMATCH/,
  );
  assert.throws(
    () => verifyEnvelope({ ...envelope, signatureBase64: Buffer.from("tampered").toString("base64") }),
    /INVALID_ATTESTATION_SIGNATURE/,
  );
  assert.throws(() => verifyEnvelope({ ...envelope, unexpected: true }), /SIGNED_ENVELOPE_FIELDS_MISMATCH/);
  assert.throws(
    () =>
      verifyAttestationEnvelope(envelope, {
        now: NOW + 1,
        expectedCampaignId: CAMPAIGN_ID,
        allowedKeyIds: new Set(["different-key"]),
        verifyDetachedSignature: publicTestVerifier,
      }),
    /ATTESTATION_KEY_NOT_ALLOWED/,
  );
  assert.throws(
    () =>
      verifyAttestationEnvelope(envelope, {
        now: NOW + 1,
        expectedCampaignId: "different-campaign",
        allowedKeyIds: new Set([KEY_ID]),
        verifyDetachedSignature: publicTestVerifier,
      }),
    /ATTESTATION_CAMPAIGN_MISMATCH/,
  );
});

test("attestation lifetime, wallet proof age, and expiry are bounded", () => {
  assert.throws(
    () =>
      envelopeFor({
        identity: "proposer",
        overrides: { expiresAt: NOW + 301 },
      }),
    /ATTESTATION_LIFETIME_TOO_LONG/,
  );
  assert.throws(
    () =>
      envelopeFor({
        identity: "proposer",
        overrides: { walletProofVerifiedAt: NOW - 601 },
      }),
    /WALLET_PROOF_TOO_OLD/,
  );
  const envelope = envelopeFor({ identity: "proposer" });
  assert.throws(() => verifyEnvelope(envelope, NOW + 300), /ATTESTATION_EXPIRED/);
});

test("transparency entries form a verifiable append-only hash chain", () => {
  const nomination = envelopeFor({ identity: "proposer" });
  const settlement = envelopeFor({ identity: "hero", purpose: "SETTLE", now: NOW + 2 });
  let log = createTransparencyLog({ logId: "promo-log-v0", campaignId: CAMPAIGN_ID });
  log = appendTransparencyEntry(log, {
    attestationId: nomination.attestationId,
    purpose: "NOMINATE",
    outcome: "NOMINATION_ACCEPTED",
    recordedAt: NOW + 1,
    publicRecordId: "nomination-0",
  });
  log = appendTransparencyEntry(log, {
    attestationId: settlement.attestationId,
    purpose: "SETTLE",
    outcome: "PAIR_SETTLED",
    recordedAt: NOW + 3,
    publicRecordId: "settlement-0",
  });
  assert.deepEqual(validateTransparencyLog(log), []);
  assert.equal(log.entries.length, 2);
  assert.equal(log.entries[1].previousHash, log.entries[0].entryHash);
  assert.equal(log.headHash, log.entries[1].entryHash);
});

test("duplicate outcomes, mutation, and reordering are detected", () => {
  const envelope = envelopeFor({ identity: "proposer" });
  let log = createTransparencyLog({ logId: "promo-log-v0", campaignId: CAMPAIGN_ID });
  log = appendTransparencyEntry(log, {
    attestationId: envelope.attestationId,
    purpose: "NOMINATE",
    outcome: "NOMINATION_ACCEPTED",
    recordedAt: NOW + 1,
  });
  assert.throws(
    () =>
      appendTransparencyEntry(log, {
        attestationId: envelope.attestationId,
        purpose: "NOMINATE",
        outcome: "ATTESTATION_REJECTED",
        reasonCode: "DUPLICATE",
        recordedAt: NOW + 2,
      }),
    /ATTESTATION_OUTCOME_ALREADY_LOGGED/,
  );

  const mutated = structuredClone(log);
  mutated.entries[0].outcome = "ATTESTATION_REJECTED";
  assert.ok(validateTransparencyLog(mutated).some((error) => error.includes("hash mismatch")));

  const secondEnvelope = envelopeFor({ identity: "hero", purpose: "SETTLE", now: NOW + 2 });
  const extended = appendTransparencyEntry(log, {
    attestationId: secondEnvelope.attestationId,
    purpose: "SETTLE",
    outcome: "PAIR_SETTLED",
    recordedAt: NOW + 3,
  });
  const reordered = structuredClone(extended);
  reordered.entries.reverse();
  assert.ok(validateTransparencyLog(reordered).length > 0);
});

test("published checkpoints reject truncation and rewritten history but accept extensions", () => {
  const firstEnvelope = envelopeFor({ identity: "proposer" });
  let log = createTransparencyLog({ logId: "promo-log-v0", campaignId: CAMPAIGN_ID });
  log = appendTransparencyEntry(log, {
    attestationId: firstEnvelope.attestationId,
    purpose: "NOMINATE",
    outcome: "NOMINATION_ACCEPTED",
    recordedAt: NOW + 1,
  });
  const checkpoint = createTransparencyCheckpoint(log, { publishedAt: NOW + 2 });

  const secondEnvelope = envelopeFor({ identity: "hero", purpose: "SETTLE", now: NOW + 3 });
  const extended = appendTransparencyEntry(log, {
    attestationId: secondEnvelope.attestationId,
    purpose: "SETTLE",
    outcome: "PAIR_SETTLED",
    recordedAt: NOW + 4,
  });
  assert.equal(verifyAppendOnlyExtension(checkpoint, extended), true);

  const truncated = createTransparencyLog({ logId: "promo-log-v0", campaignId: CAMPAIGN_ID });
  assert.throws(() => verifyAppendOnlyExtension(checkpoint, truncated), /TRANSPARENCY_LOG_TRUNCATED/);

  const rewritten = structuredClone(extended);
  rewritten.entries[0].entryHash = "c".repeat(64);
  assert.throws(() => verifyAppendOnlyExtension(checkpoint, rewritten), /INVALID_TRANSPARENCY_LOG/);
});

test("verified envelopes drive one reference nomination and paired settlement", () => {
  const genesis = NOW - 28_800;
  let state = createCampaign({ campaignId: CAMPAIGN_ID, genesisTimestamp: genesis });
  state = fundCampaign(state, {
    amountBaseUnits: MAXIMUM_BUDGET_BASE_UNITS,
    source: COMMUNITY_PROMOTION_SOURCE,
  });
  state = activateCampaign(state, {
    now: NOW,
    network: "MAINNET",
    separatelyReviewed: true,
    reviewHash: HASH,
    artifactHash: HASH,
    policyHash: HASH,
  });

  const proposerEnvelope = envelopeFor({ identity: "proposer", now: NOW + 1 });
  const proposer = verifyEnvelope(proposerEnvelope, NOW + 2);
  const nominated = nominateHero(state, {
    now: NOW + 2,
    proposerAttestation: proposer,
    heroXIdentityCommitment: commitment("x-hero"),
    heroDisplayHandle: "@hero",
  });

  const heroEnvelope = envelopeFor({ identity: "hero", purpose: "SETTLE", now: NOW + 3 });
  const hero = verifyEnvelope(heroEnvelope, NOW + 4);
  state = settlePair(nominated.state, {
    now: NOW + 4,
    nominationId: nominated.nominationId,
    heroAttestation: hero,
    heroDisplayHandle: "@hero_renamed",
  });
  assert.equal(state.completedPairs, 1);
  assert.equal(state.settlements[0].heroWallet, wallet("8"));
});
