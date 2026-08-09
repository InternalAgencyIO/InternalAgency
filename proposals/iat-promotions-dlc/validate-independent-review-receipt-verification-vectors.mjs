/**
 * Verify-only review-attestation vector validator.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateIndependentReviewVerificationVectors } from "./generate-independent-review-receipt-verification-vectors.mjs";
import { verifyDetachedEd25519Message, verifyExternalReviewReceiptAttestation } from "./independent-review-receipt-verifier.mjs";

const VECTOR_PATH = fileURLToPath(
  new URL("./independent-review-receipt-verification-vectors.v1.json", import.meta.url),
);
const PAYLOAD_VECTOR_PATH = fileURLToPath(
  new URL("./independent-review-receipt-payload-vectors.v1.json", import.meta.url),
);
const ADAPTER_PATH = fileURLToPath(new URL("./independent-review-receipt-verifier.mjs", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadIndependentReviewVerificationBundle() {
  return {
    vectors: JSON.parse(readFileSync(VECTOR_PATH, "utf8")),
    payloadVectors: JSON.parse(readFileSync(PAYLOAD_VECTOR_PATH, "utf8")),
    adapterSource: readFileSync(ADAPTER_PATH, "utf8"),
  };
}

export function validateIndependentReviewVerificationVectors(
  bundle = loadIndependentReviewVerificationBundle(),
) {
  const { vectors, payloadVectors, adapterSource } = bundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(vectors?.vectorVersion === 1, "review verification vector version drift");
  expect(
    vectors?.vectorId === "iat-promotions-dlc-independent-review-verification-vectors-v1",
    "review verification vector ID drift",
  );
  expect(JSON.stringify(vectors?.status?.labels) === JSON.stringify(HOLD_LABELS), "review verification HOLD labels drift");
  expect(vectors?.status?.network === "NONE", "review verification vectors must remain network-free");
  expect(vectors?.status?.programId === null, "review verification vectors must not claim a program ID");
  expect(vectors?.status?.deployable === false, "review verification vectors must remain undeployable");
  expect(vectors?.status?.verificationAdapterApplied === false, "review verification adapter must remain unapplied");
  expect(vectors?.status?.createsKeys === false, "review verification adapter claims key generation");
  expect(vectors?.status?.createsSignatures === false, "review verification adapter claims signature creation");
  expect(
    vectors?.status?.validReviewReceiptAttestationPublished === false,
    "review verification vectors claim a valid review-receipt attestation",
  );
  expect(vectors?.contract?.mode === "VERIFY_ONLY", "review adapter mode is not verify-only");
  expect(
    vectors?.contract?.cryptographicVerificationDoesNotVerifyReviewSemantics === true,
    "cryptographic verification claims semantic review",
  );
  expect(
    vectors?.contract?.cryptographicVerificationDoesNotAuthorizeActivation === true,
    "cryptographic verification claims activation authority",
  );
  expect(vectors?.contract?.activationAuthorized === false, "review verification vectors authorize activation");
  expect(vectors?.contract?.activationEffect === "NONE", "review verification vectors have activation effect");
  expect(vectors?.publicRfcCases?.length === 2, "public RFC verification case count drift");
  for (const testCase of vectors?.publicRfcCases ?? []) {
    expect(testCase.expectedValid === true, `${testCase.name} expected-valid flag drift`);
    expect(verifyDetachedEd25519Message(testCase), `${testCase.name} no longer verifies`);
  }
  expect(vectors?.reviewPayloadNegativeCases?.length === 3, "negative review-payload case count drift");
  const payloadByName = Object.fromEntries(payloadVectors.vectors.map((vector) => [vector.name, vector]));
  for (const testCase of vectors?.reviewPayloadNegativeCases ?? []) {
    const payloadVector = payloadByName[testCase.payloadVector];
    expect(Boolean(payloadVector), `${testCase.name} references an unknown payload vector`);
    if (!payloadVector) continue;
    const result = verifyExternalReviewReceiptAttestation(payloadVector.input, {
      algorithm: "Ed25519",
      publicKeyHex: testCase.publicKeyHex,
      signatureHex: testCase.signatureHex,
      payloadSha256: testCase.payloadSha256,
    });
    expect(testCase.expectedCryptographicallyVerified === false, `${testCase.name} expected result drift`);
    expect(result.cryptographicallyVerified === false, `${testCase.name} unexpectedly verifies`);
    expect(result.reason === testCase.expectedReason, `${testCase.name} reason drift`);
    expect(result.reviewSemanticsVerified === false, `${testCase.name} claims semantic review`);
    expect(result.reviewerIndependenceVerified === false, `${testCase.name} claims reviewer independence`);
    expect(result.activationAuthorized === false, `${testCase.name} claims activation authority`);
    expect(result.activationEffect === "NONE", `${testCase.name} has activation effect`);
  }
  expect(
    !/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/.test(adapterSource),
    "verify-only adapter contains signing or key-generation capability",
  );
  expect(
    JSON.stringify(vectors) === JSON.stringify(generateIndependentReviewVerificationVectors()),
    "review verification vectors differ from deterministic generation",
  );
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateIndependentReviewVerificationVectors();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Verify-only receipt vectors reproduce; no valid review signature or activation claim is published.");
  }
}
