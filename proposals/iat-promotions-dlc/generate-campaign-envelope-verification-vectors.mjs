/**
 * Rejection-only canonical campaign-envelope Ed25519 verification vectors.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Valid signature material is copied only from the public RFC 8032 vectors.
 * This generator never creates a key or signature and deliberately publishes
 * no positive campaign-envelope signature.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ATTESTATION_DOMAIN,
  attachDetachedSignature,
  prepareUnsignedAttestationEnvelope,
} from "./attestation-transparency.mjs";
import { verifyCampaignEnvelopeWithPublicKey } from "./campaign-envelope-verifier.mjs";
import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { verifyDetachedEd25519Message } from "./independent-review-receipt-verifier.mjs";

const RFC_PATH = fileURLToPath(new URL("./ed25519-public-vectors.v0.json", import.meta.url));
const ADAPTER_PATH = fileURLToPath(new URL("./campaign-envelope-verifier.mjs", import.meta.url));
const OUTPUT_PATH = fileURLToPath(
  new URL("./campaign-envelope-verification-vectors.v1.json", import.meta.url),
);
const CAMPAIGN_ID = "iat-promotions-dlc-v1-public-envelope-fixture";
const ISSUED_AT = 1_800_100_000;
const NOW = ISSUED_AT + 1;
const KEY_ID = "rfc8032-test-1-public-key";
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(
  readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
);
const signatureBase64 = (vector) => Buffer.from(vector.signatureHex, "hex").toString("base64");

function fixturePayload() {
  return {
    campaignId: CAMPAIGN_ID,
    domain: ATTESTATION_DOMAIN,
    expiresAt: ISSUED_AT + 300,
    issuedAt: ISSUED_AT,
    nodeId: "node-public-envelope-fixture",
    nonce: "nonce-public-envelope-fixture-0001",
    purpose: "NOMINATE",
    wallet: "7".repeat(44),
    walletProofDigest: sha256Hex("public-wallet-proof-fixture"),
    walletProofVerifiedAt: ISSUED_AT - 1,
    xIdentityCommitment: sha256Hex("public-x-identity-fixture"),
  };
}

function prepareEnvelope({ payload = fixturePayload(), keyId = KEY_ID, vector }) {
  const prepared = prepareUnsignedAttestationEnvelope({ keyId, payload });
  return {
    prepared,
    envelope: attachDetachedSignature(prepared.envelope, signatureBase64(vector)),
  };
}

function evaluateCase({
  name,
  category,
  mutatedField,
  envelope,
  expectedCampaignId,
  expectedKeyId,
  publicKeyHex,
  signatureSource,
}) {
  const result = verifyCampaignEnvelopeWithPublicKey(envelope, {
    now: NOW,
    expectedCampaignId,
    expectedKeyId,
    publicKeyHex,
  });
  return {
    name,
    category,
    mutatedField,
    signatureSource,
    expectedCampaignEnvelopeVerified: false,
    expectedReason: result.reason,
    expectedCanonicalMessageSha256: result.canonicalMessageSha256,
    expectedPositiveCampaignSignaturePublishedByVerifier: false,
    expectedReceiptIssued: false,
    expectedReviewCompleted: false,
    expectedActivationAuthorized: false,
    expectedActivationEffect: "NONE",
    expectedCampaignId,
    expectedKeyId,
    publicKeyHex,
    envelope,
  };
}

export function generateCampaignEnvelopeVerificationVectors() {
  const rfc = JSON.parse(readFileSync(RFC_PATH, "utf8"));
  const [rfc1, rfc2] = rfc.vectors;
  const publicPrimitiveControls = rfc.vectors.map((vector) => ({
    name: vector.name,
    source: rfc.source,
    algorithm: vector.algorithm,
    publicKeyHex: vector.publicKeyHex,
    messageHex: vector.messageHex,
    signatureHex: vector.signatureHex,
    expectedValid: verifyDetachedEd25519Message(vector),
  }));

  const base1 = prepareEnvelope({ vector: rfc1 });
  const base2 = prepareEnvelope({ keyId: "rfc8032-test-2-public-key", vector: rfc2 });
  const exactEnvelopeNegativeCases = [
    evaluateCase({
      name: "EXACT_CANONICAL_ENVELOPE_WITH_UNRELATED_RFC8032_TEST_1_SIGNATURE",
      category: "EXACT_ENVELOPE_NEGATIVE_CONTROL",
      mutatedField: null,
      envelope: base1.envelope,
      expectedCampaignId: CAMPAIGN_ID,
      expectedKeyId: KEY_ID,
      publicKeyHex: rfc1.publicKeyHex,
      signatureSource: rfc1.name,
    }),
    evaluateCase({
      name: "EXACT_CANONICAL_ENVELOPE_WITH_UNRELATED_RFC8032_TEST_2_SIGNATURE",
      category: "EXACT_ENVELOPE_NEGATIVE_CONTROL",
      mutatedField: null,
      envelope: base2.envelope,
      expectedCampaignId: CAMPAIGN_ID,
      expectedKeyId: "rfc8032-test-2-public-key",
      publicKeyHex: rfc2.publicKeyHex,
      signatureSource: rfc2.name,
    }),
  ];

  const fieldMutations = [
    ["payload.campaignId", (payload) => ({ ...payload, campaignId: `${payload.campaignId}-changed` })],
    ["payload.expiresAt", (payload) => ({ ...payload, expiresAt: payload.expiresAt - 1 })],
    ["payload.issuedAt", (payload) => ({ ...payload, issuedAt: payload.issuedAt + 1 })],
    ["payload.nodeId", (payload) => ({ ...payload, nodeId: `${payload.nodeId}-changed` })],
    ["payload.nonce", (payload) => ({ ...payload, nonce: `${payload.nonce}-changed` })],
    ["payload.purpose", (payload) => ({ ...payload, purpose: "CANCEL" })],
    ["payload.wallet", (payload) => ({ ...payload, wallet: "8".repeat(44) })],
    ["payload.walletProofDigest", (payload) => ({
      ...payload,
      walletProofDigest: sha256Hex("changed-public-wallet-proof-fixture"),
    })],
    ["payload.walletProofVerifiedAt", (payload) => ({
      ...payload,
      walletProofVerifiedAt: payload.walletProofVerifiedAt - 1,
    })],
    ["payload.xIdentityCommitment", (payload) => ({
      ...payload,
      xIdentityCommitment: sha256Hex("changed-public-x-identity-fixture"),
    })],
  ];
  const canonicalFieldMutationNegativeCases = fieldMutations.map(([field, mutate]) => {
    const payload = mutate(fixturePayload());
    const prepared = prepareEnvelope({ payload, vector: rfc1 });
    return evaluateCase({
      name: `${field.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_CHANGED_WITH_UNRELATED_SIGNATURE`,
      category: "CANONICAL_FIELD_MUTATION_NEGATIVE_CONTROL",
      mutatedField: field,
      envelope: prepared.envelope,
      expectedCampaignId: payload.campaignId,
      expectedKeyId: KEY_ID,
      publicKeyHex: rfc1.publicKeyHex,
      signatureSource: rfc1.name,
    });
  });
  const changedKeyPrepared = prepareEnvelope({
    keyId: `${KEY_ID}-changed`,
    vector: rfc1,
  });
  canonicalFieldMutationNegativeCases.push(evaluateCase({
    name: "ENVELOPE_KEY_ID_CHANGED_WITH_UNRELATED_SIGNATURE",
    category: "CANONICAL_FIELD_MUTATION_NEGATIVE_CONTROL",
    mutatedField: "envelope.keyId",
    envelope: changedKeyPrepared.envelope,
    expectedCampaignId: CAMPAIGN_ID,
    expectedKeyId: `${KEY_ID}-changed`,
    publicKeyHex: rfc1.publicKeyHex,
    signatureSource: rfc1.name,
  }));

  const changedSignature = Buffer.from(rfc1.signatureHex, "hex");
  changedSignature[0] ^= 1;
  const changedSignatureEnvelope = {
    ...base1.envelope,
    signatureBase64: changedSignature.toString("base64"),
  };
  const cryptographicMutationNegativeCases = [
    evaluateCase({
      name: "CAMPAIGN_SIGNATURE_FIRST_BYTE_CHANGED",
      category: "CRYPTOGRAPHIC_MUTATION_NEGATIVE_CONTROL",
      mutatedField: "signature[0]",
      envelope: changedSignatureEnvelope,
      expectedCampaignId: CAMPAIGN_ID,
      expectedKeyId: KEY_ID,
      publicKeyHex: rfc1.publicKeyHex,
      signatureSource: `${rfc1.name}_MUTATED_PUBLIC_COPY`,
    }),
    evaluateCase({
      name: "CAMPAIGN_PUBLIC_KEY_SUBSTITUTED",
      category: "CRYPTOGRAPHIC_MUTATION_NEGATIVE_CONTROL",
      mutatedField: "publicKeyHex",
      envelope: base1.envelope,
      expectedCampaignId: CAMPAIGN_ID,
      expectedKeyId: KEY_ID,
      publicKeyHex: rfc2.publicKeyHex,
      signatureSource: rfc1.name,
    }),
  ];

  const preSignatureGuardNegativeCases = [
    ["payload.domain", { ...base1.envelope, payload: { ...base1.envelope.payload, domain: "changed-domain" } }],
    ["envelope.scheme", { ...base1.envelope, scheme: "CHANGED_SCHEME" }],
    ["envelope.version", { ...base1.envelope, version: 1 }],
    ["envelope.attestationId", { ...base1.envelope, attestationId: "f".repeat(64) }],
  ].map(([field, envelope]) => evaluateCase({
    name: `${field.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_PRE_SIGNATURE_REJECTION`,
    category: "PRE_SIGNATURE_GUARD_NEGATIVE_CONTROL",
    mutatedField: field,
    envelope,
    expectedCampaignId: CAMPAIGN_ID,
    expectedKeyId: KEY_ID,
    publicKeyHex: rfc1.publicKeyHex,
    signatureSource: rfc1.name,
  }));

  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-campaign-envelope-verification-vectors-v1",
    status: {
      labels: ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"],
      network: "NONE",
      programId: null,
      deployable: false,
      verificationAdapterApplied: false,
      createsKeys: false,
      createsSignatures: false,
      signingMaterialIncluded: false,
      validCampaignEnvelopeSignaturePublished: false,
      positiveCampaignIntegrationBlocked: true,
    },
    sources: {
      rfc8032Vectors: {
        path: "ed25519-public-vectors.v0.json",
        source: rfc.source,
        canonicalSha256: canonicalSha256(rfc),
      },
      verificationAdapter: {
        path: "campaign-envelope-verifier.mjs",
        normalizedTextSha256: normalizedTextSha256(ADAPTER_PATH),
      },
    },
    contract: {
      algorithm: "Ed25519",
      mode: "VERIFY_ONLY_REJECTION_ONLY",
      campaignEnvelopeDomain: ATTESTATION_DOMAIN,
      exactCampaignEnvelopePositiveCasePublished: false,
      externalPrimitivePositiveControls: true,
      unrelatedExternalSignaturesMustRejectCampaignEnvelope: true,
      positiveIntegrationRequiresSeparatelySuppliedReviewedVector: true,
      cryptographicVerificationDoesNotAuthorizeActivation: true,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    publicPrimitiveControls,
    exactEnvelopeNegativeCases,
    canonicalFieldMutationNegativeCases,
    cryptographicMutationNegativeCases,
    preSignatureGuardNegativeCases,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = `${JSON.stringify(generateCampaignEnvelopeVerificationVectors(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote rejection-only campaign-envelope vectors; no key or signature was created.");
  } else {
    process.stdout.write(rendered);
  }
}
