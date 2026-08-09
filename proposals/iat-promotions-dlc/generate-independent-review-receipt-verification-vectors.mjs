/**
 * Public verify-only receipt-attestation vectors.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { verifyDetachedEd25519Message, verifyExternalReviewReceiptAttestation } from "./independent-review-receipt-verifier.mjs";

const RFC_PATH = fileURLToPath(new URL("./ed25519-public-vectors.v0.json", import.meta.url));
const PAYLOAD_VECTOR_PATH = fileURLToPath(
  new URL("./independent-review-receipt-payload-vectors.v1.json", import.meta.url),
);
const ADAPTER_PATH = fileURLToPath(new URL("./independent-review-receipt-verifier.mjs", import.meta.url));
const OUTPUT_PATH = fileURLToPath(
  new URL("./independent-review-receipt-verification-vectors.v1.json", import.meta.url),
);
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));

export function generateIndependentReviewVerificationVectors() {
  const rfc = JSON.parse(readFileSync(RFC_PATH, "utf8"));
  const payloadVectors = JSON.parse(readFileSync(PAYLOAD_VECTOR_PATH, "utf8"));
  const publicRfcCases = rfc.vectors.map((vector) => ({
    name: vector.name,
    algorithm: vector.algorithm,
    publicKeyHex: vector.publicKeyHex,
    messageHex: vector.messageHex,
    signatureHex: vector.signatureHex,
    expectedValid: verifyDetachedEd25519Message(vector),
  }));
  const rfcFixture = rfc.vectors[0];
  const reviewPayloadNegativeCases = payloadVectors.vectors.map((vector) => {
    const attestation = {
      algorithm: "Ed25519",
      publicKeyHex: rfcFixture.publicKeyHex,
      signatureHex: rfcFixture.signatureHex,
      payloadSha256: vector.messageSha256,
    };
    const result = verifyExternalReviewReceiptAttestation(vector.input, attestation);
    return {
      name: `${vector.name}_WITH_UNRELATED_RFC_SIGNATURE`,
      payloadVector: vector.name,
      payloadSha256: vector.messageSha256,
      publicKeyHex: rfcFixture.publicKeyHex,
      signatureHex: rfcFixture.signatureHex,
      expectedCryptographicallyVerified: false,
      expectedReason: result.reason,
    };
  });
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-independent-review-verification-vectors-v1",
    status: {
      labels: ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"],
      network: "NONE",
      programId: null,
      deployable: false,
      verificationAdapterApplied: false,
      createsKeys: false,
      createsSignatures: false,
      validReviewReceiptAttestationPublished: false,
    },
    sources: {
      rfc8032Vectors: {
        path: "ed25519-public-vectors.v0.json",
        canonicalSha256: canonicalSha256(rfc),
      },
      unsignedPayloadVectors: {
        path: "independent-review-receipt-payload-vectors.v1.json",
        canonicalSha256: canonicalSha256(payloadVectors),
      },
      verificationAdapter: {
        path: "independent-review-receipt-verifier.mjs",
        normalizedTextSha256: normalizedTextSha256(ADAPTER_PATH),
      },
    },
    contract: {
      algorithm: "Ed25519",
      mode: "VERIFY_ONLY",
      publicRfcSource: rfc.source,
      receiptPayloadSignatureRequiredForFutureReceipt: true,
      cryptographicVerificationDoesNotVerifyReviewSemantics: true,
      cryptographicVerificationDoesNotAuthorizeActivation: true,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    publicRfcCases,
    reviewPayloadNegativeCases,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = `${JSON.stringify(generateIndependentReviewVerificationVectors(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote verify-only public vectors; no key or signature was created.");
  } else {
    process.stdout.write(rendered);
  }
}
