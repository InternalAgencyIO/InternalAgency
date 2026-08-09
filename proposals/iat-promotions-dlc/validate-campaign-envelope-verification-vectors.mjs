/**
 * Rejection-only campaign-envelope verification-vector validator.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { verifyCampaignEnvelopeWithPublicKey } from "./campaign-envelope-verifier.mjs";
import { generateCampaignEnvelopeVerificationVectors } from "./generate-campaign-envelope-verification-vectors.mjs";
import { verifyDetachedEd25519Message } from "./independent-review-receipt-verifier.mjs";

const VECTOR_PATH = fileURLToPath(
  new URL("./campaign-envelope-verification-vectors.v1.json", import.meta.url),
);
const RFC_PATH = fileURLToPath(new URL("./ed25519-public-vectors.v0.json", import.meta.url));
const ADAPTER_PATH = fileURLToPath(new URL("./campaign-envelope-verifier.mjs", import.meta.url));
const GENERATOR_PATH = fileURLToPath(
  new URL("./generate-campaign-envelope-verification-vectors.mjs", import.meta.url),
);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const NOW = 1_800_100_001;

function containsForbiddenSecretField(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, nested] of Object.entries(value)) {
    if (/(private|secret|seed|mnemonic)/i.test(key)) return true;
    if (containsForbiddenSecretField(nested)) return true;
  }
  return false;
}

export function loadCampaignEnvelopeVerificationBundle() {
  return {
    vectors: JSON.parse(readFileSync(VECTOR_PATH, "utf8")),
    rfc: JSON.parse(readFileSync(RFC_PATH, "utf8")),
    adapterSource: readFileSync(ADAPTER_PATH, "utf8"),
    generatorSource: readFileSync(GENERATOR_PATH, "utf8"),
  };
}

export function validateCampaignEnvelopeVerificationVectors(
  bundle = loadCampaignEnvelopeVerificationBundle(),
) {
  const { vectors, rfc, adapterSource, generatorSource } = bundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(vectors?.vectorVersion === 1, "campaign-envelope vector version drift");
  expect(
    vectors?.vectorId === "iat-promotions-dlc-campaign-envelope-verification-vectors-v1",
    "campaign-envelope vector ID drift",
  );
  expect(
    JSON.stringify(vectors?.status?.labels) === JSON.stringify(HOLD_LABELS),
    "campaign-envelope HOLD labels drift",
  );
  expect(vectors?.status?.network === "NONE", "campaign-envelope vectors must remain network-free");
  expect(vectors?.status?.programId === null, "campaign-envelope vectors claim a program ID");
  expect(vectors?.status?.deployable === false, "campaign-envelope vectors claim deployability");
  expect(vectors?.status?.verificationAdapterApplied === false, "campaign verifier claims application");
  expect(vectors?.status?.createsKeys === false, "campaign verifier claims key generation");
  expect(vectors?.status?.createsSignatures === false, "campaign verifier claims signature creation");
  expect(vectors?.status?.signingMaterialIncluded === false, "campaign vectors claim signing material");
  expect(
    vectors?.status?.validCampaignEnvelopeSignaturePublished === false,
    "campaign vectors claim a valid campaign-envelope signature",
  );
  expect(
    vectors?.status?.positiveCampaignIntegrationBlocked === true,
    "missing positive campaign integration is not held",
  );
  expect(vectors?.contract?.mode === "VERIFY_ONLY_REJECTION_ONLY", "campaign mode drift");
  expect(
    vectors?.contract?.exactCampaignEnvelopePositiveCasePublished === false,
    "campaign contract claims a positive envelope vector",
  );
  expect(
    vectors?.contract?.positiveIntegrationRequiresSeparatelySuppliedReviewedVector === true,
    "future positive vector gate is missing",
  );
  expect(
    vectors?.contract?.cryptographicVerificationDoesNotAuthorizeActivation === true,
    "campaign verification claims activation authority",
  );
  expect(vectors?.contract?.receiptIssued === false, "campaign verification claims a receipt");
  expect(vectors?.contract?.reviewCompleted === false, "campaign verification claims review completion");
  expect(vectors?.contract?.activationAuthorized === false, "campaign verification authorizes activation");
  expect(vectors?.contract?.activationEffect === "NONE", "campaign verification has activation effect");
  expect(!containsForbiddenSecretField(vectors), "campaign vectors contain a secret-bearing field name");

  expect(vectors?.publicPrimitiveControls?.length === 2, "RFC primitive control count drift");
  for (const control of vectors?.publicPrimitiveControls ?? []) {
    expect(control.source === rfc.source, `${control.name} RFC source drift`);
    expect(control.expectedValid === true, `${control.name} positive-control expectation drift`);
    expect(verifyDetachedEd25519Message(control), `${control.name} public RFC control no longer verifies`);
  }

  const groups = [
    ["exactEnvelopeNegativeCases", 2],
    ["canonicalFieldMutationNegativeCases", 11],
    ["cryptographicMutationNegativeCases", 2],
    ["preSignatureGuardNegativeCases", 4],
  ];
  const allCases = [];
  for (const [name, count] of groups) {
    expect(vectors?.[name]?.length === count, `${name} count drift`);
    allCases.push(...(vectors?.[name] ?? []));
  }
  const names = new Set();
  for (const testCase of allCases) {
    expect(typeof testCase.name === "string" && testCase.name.length > 0, "campaign case name missing");
    expect(!names.has(testCase.name), `duplicate campaign case: ${testCase.name}`);
    names.add(testCase.name);
    const actual = verifyCampaignEnvelopeWithPublicKey(testCase.envelope, {
      now: NOW,
      expectedCampaignId: testCase.expectedCampaignId,
      expectedKeyId: testCase.expectedKeyId,
      publicKeyHex: testCase.publicKeyHex,
    });
    expect(testCase.expectedCampaignEnvelopeVerified === false, `${testCase.name} expectation is positive`);
    expect(actual.campaignEnvelopeVerified === false, `${testCase.name} unexpectedly verifies`);
    expect(actual.reason === testCase.expectedReason, `${testCase.name} reason drift`);
    expect(
      actual.canonicalMessageSha256 === testCase.expectedCanonicalMessageSha256,
      `${testCase.name} canonical message digest drift`,
    );
    expect(
      actual.positiveCampaignSignaturePublishedByThisVerifier === false,
      `${testCase.name} verifier claims publication of a positive signature`,
    );
    expect(actual.receiptIssued === false, `${testCase.name} claims a receipt`);
    expect(actual.reviewCompleted === false, `${testCase.name} claims review completion`);
    expect(actual.activationAuthorized === false, `${testCase.name} claims activation authority`);
    expect(actual.activationEffect === "NONE", `${testCase.name} has activation effect`);
  }
  expect(
    vectors?.exactEnvelopeNegativeCases?.every((entry) =>
      entry.expectedReason === "INVALID_ATTESTATION_SIGNATURE"),
    "exact campaign envelope does not fail at the signature gate",
  );
  expect(
    vectors?.canonicalFieldMutationNegativeCases?.every((entry) =>
      entry.expectedReason === "INVALID_ATTESTATION_SIGNATURE"),
    "canonical field mutation does not reach the signature gate",
  );
  expect(
    !/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/.test(
      `${adapterSource}\n${generatorSource}`,
    ),
    "campaign vector tooling contains signing or key-generation capability",
  );
  expect(
    !/\bfetch\s*\(|\bWebSocket\s*\(|\bhttps?\.request\s*\(/.test(adapterSource),
    "campaign verification adapter contains network capability",
  );
  expect(
    JSON.stringify(vectors) === JSON.stringify(generateCampaignEnvelopeVerificationVectors()),
    "campaign-envelope vectors differ from deterministic generation",
  );
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateCampaignEnvelopeVerificationVectors();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Campaign-envelope negative vectors reproduce; positive integration remains held.");
  }
}
