/**
 * Verify-only Ed25519 adapter for canonical campaign attestation envelopes.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This module cannot create keys or signatures and has no wallet, file-write,
 * network, receipt, review-completion, or activation capability.
 */

import { createHash } from "node:crypto";

import { verifyAttestationEnvelope } from "./attestation-transparency.mjs";
import { verifyDetachedEd25519Message } from "./independent-review-receipt-verifier.mjs";

const HEX_32 = /^[0-9a-f]{64}$/;

function signatureBase64ToHex(value) {
  if (typeof value !== "string") return null;
  try {
    const bytes = Buffer.from(value, "base64");
    if (bytes.length !== 64 || bytes.toString("base64") !== value) return null;
    return bytes.toString("hex");
  } catch {
    return null;
  }
}

export function verifyCampaignEnvelopeWithPublicKey(
  envelope,
  { now, expectedCampaignId, expectedKeyId, publicKeyHex },
) {
  const result = {
    verificationOnly: true,
    campaignEnvelopeVerified: false,
    canonicalMessageHex: null,
    canonicalMessageSha256: null,
    positiveCampaignSignaturePublishedByThisVerifier: false,
    receiptIssued: false,
    reviewCompleted: false,
    activationAuthorized: false,
    activationEffect: "NONE",
    reason: null,
  };
  if (typeof expectedKeyId !== "string" || expectedKeyId.length === 0) {
    return { ...result, reason: "INVALID_EXPECTED_KEY_ID" };
  }
  if (!HEX_32.test(publicKeyHex ?? "")) {
    return { ...result, reason: "INVALID_ED25519_PUBLIC_KEY_HEX" };
  }
  const signatureHex = signatureBase64ToHex(envelope?.signatureBase64);
  if (signatureHex === null) {
    return { ...result, reason: "INVALID_SIGNATURE_ENCODING" };
  }
  let observedMessage = null;
  try {
    verifyAttestationEnvelope(envelope, {
      now,
      expectedCampaignId,
      allowedKeyIds: new Set([expectedKeyId]),
      verifyDetachedSignature: ({ keyId, message, signatureBase64, scheme }) => {
        if (keyId !== expectedKeyId || scheme !== "ED25519_DETACHED") return false;
        observedMessage = Buffer.from(message, "utf8");
        return verifyDetachedEd25519Message({
          messageHex: observedMessage.toString("hex"),
          publicKeyHex,
          signatureHex: signatureBase64ToHex(signatureBase64),
        });
      },
    });
    return {
      ...result,
      campaignEnvelopeVerified: true,
      canonicalMessageHex: observedMessage?.toString("hex") ?? null,
      canonicalMessageSha256: observedMessage === null
        ? null
        : createHash("sha256").update(observedMessage).digest("hex"),
      reason: "VALID_EXTERNAL_CAMPAIGN_SIGNATURE",
    };
  } catch (error) {
    return {
      ...result,
      canonicalMessageHex: observedMessage?.toString("hex") ?? null,
      canonicalMessageSha256: observedMessage === null
        ? null
        : createHash("sha256").update(observedMessage).digest("hex"),
      reason: error instanceof Error ? error.message : "CAMPAIGN_ENVELOPE_VERIFICATION_FAILED",
    };
  }
}
