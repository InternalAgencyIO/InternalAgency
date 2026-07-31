/**
 * Verify-only detached Ed25519 adapter for external review attestations.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * No signing, key generation, wallet access, or network access exists here.
 */

import { createHash, verify } from "node:crypto";

import { createEd25519PublicKey } from "./validate-ed25519-public-vectors.mjs";
import { encodeUnsignedReviewReceiptPayload } from "./independent-review-receipt-payload.mjs";

const ATTESTATION_KEYS = Object.freeze([
  "algorithm",
  "publicKeyHex",
  "signatureHex",
  "payloadSha256",
]);

const exactAttestationShape = (attestation) =>
  attestation &&
  typeof attestation === "object" &&
  !Array.isArray(attestation) &&
  JSON.stringify(Object.keys(attestation)) === JSON.stringify(ATTESTATION_KEYS);

export function verifyDetachedEd25519Message({ messageHex, publicKeyHex, signatureHex }) {
  if (!/^(?:[0-9a-f]{2})*$/.test(messageHex ?? "")) return false;
  if (!/^[0-9a-f]{64}$/.test(publicKeyHex ?? "")) return false;
  if (!/^[0-9a-f]{128}$/.test(signatureHex ?? "")) return false;
  try {
    return verify(
      null,
      Buffer.from(messageHex, "hex"),
      createEd25519PublicKey(publicKeyHex),
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    return false;
  }
}

export function verifyExternalReviewReceiptAttestation(payload, attestation) {
  const result = {
    verificationOnly: true,
    cryptographicallyVerified: false,
    payloadDigestMatches: false,
    payloadSha256: null,
    reviewSemanticsVerified: false,
    reviewerIndependenceVerified: false,
    activationAuthorized: false,
    activationEffect: "NONE",
    reason: null,
  };
  let message;
  try {
    message = encodeUnsignedReviewReceiptPayload(payload);
  } catch (error) {
    return { ...result, reason: `INVALID_PAYLOAD: ${error.message}` };
  }
  result.payloadSha256 = createHash("sha256").update(message).digest("hex");
  if (!exactAttestationShape(attestation)) {
    return { ...result, reason: "INVALID_ATTESTATION_SHAPE" };
  }
  if (attestation.algorithm !== "Ed25519") {
    return { ...result, reason: "UNSUPPORTED_ATTESTATION_ALGORITHM" };
  }
  if (!/^[0-9a-f]{64}$/.test(attestation.payloadSha256 ?? "")) {
    return { ...result, reason: "INVALID_PAYLOAD_DIGEST" };
  }
  result.payloadDigestMatches = attestation.payloadSha256 === result.payloadSha256;
  if (!result.payloadDigestMatches) {
    return { ...result, reason: "PAYLOAD_DIGEST_MISMATCH" };
  }
  result.cryptographicallyVerified = verifyDetachedEd25519Message({
    messageHex: message.toString("hex"),
    publicKeyHex: attestation.publicKeyHex,
    signatureHex: attestation.signatureHex,
  });
  result.reason = result.cryptographicallyVerified ? "VALID_EXTERNAL_SIGNATURE" : "INVALID_EXTERNAL_SIGNATURE";
  return result;
}
