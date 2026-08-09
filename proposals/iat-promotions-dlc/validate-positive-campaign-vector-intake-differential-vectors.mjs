/**
 * Validator for the cross-runtime positive-vector intake mutation corpus.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generatePositiveCampaignVectorIntakeDifferentialVectors } from "./generate-positive-campaign-vector-intake-differential-vectors.mjs";
import { evaluatePositiveCampaignVectorIntake } from "./positive-campaign-vector-intake.mjs";

const VECTOR_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-differential-vectors.v1.json", import.meta.url),
);
const GENERATOR_PATH = fileURLToPath(
  new URL("./generate-positive-campaign-vector-intake-differential-vectors.mjs", import.meta.url),
);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const GATE_ORDER = [
  "CLOSED_SCHEMA",
  "EXPECTED_TARGET",
  "PRIVATE_MATERIAL_EXCLUSION",
  "EXTERNAL_PROVENANCE",
  "CANONICAL_MESSAGE_BINDING",
  "CRYPTOGRAPHIC_SIGNATURE",
  "INDEPENDENT_VECTOR_REVIEW",
  "NON_AUTHORITY",
];
const REQUIRED_FAMILIES = [
  "CLOSED_SCHEMA",
  "EXPECTED_TARGET",
  "TARGET_BINDING",
  "PRIVATE_MATERIAL_EXCLUSION",
  "EXTERNAL_PROVENANCE",
  "CANONICAL_MESSAGE_BINDING",
  "CRYPTOGRAPHIC_GUARD",
  "CRYPTOGRAPHIC_SIGNATURE",
  "INDEPENDENT_VECTOR_REVIEW",
  "NON_AUTHORITY",
];

export function loadPositiveCampaignVectorIntakeDifferentialBundle() {
  return {
    vectors: JSON.parse(readFileSync(VECTOR_PATH, "utf8")),
    generatorSource: readFileSync(GENERATOR_PATH, "utf8"),
  };
}

export function validatePositiveCampaignVectorIntakeDifferentialVectors(
  bundle = loadPositiveCampaignVectorIntakeDifferentialBundle(),
) {
  const { vectors, generatorSource } = bundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(vectors?.vectorVersion === 1, "differential vector version drift");
  expect(
    vectors?.vectorId === "iat-promotions-dlc-positive-campaign-vector-intake-differential-vectors-v1",
    "differential vector ID drift",
  );
  expect(
    JSON.stringify(vectors?.status?.labels) === JSON.stringify(HOLD_LABELS),
    "differential HOLD labels drift",
  );
  expect(vectors?.status?.network === "NONE", "differential vectors must remain network-free");
  expect(vectors?.status?.programId === null, "differential vectors claim a program ID");
  expect(vectors?.status?.deployable === false, "differential vectors claim deployability");
  expect(vectors?.status?.differentialCorpusApplied === false, "differential corpus claims application");
  expect(vectors?.status?.positiveVectorAvailable === false, "differential corpus claims a positive vector");
  expect(
    vectors?.status?.positiveVectorReviewCompleted === false,
    "differential corpus claims review completion",
  );
  expect(
    vectors?.status?.positiveVectorIntegrationBlocked === true,
    "differential corpus released positive integration HOLD",
  );
  expect(
    vectors?.contract?.mode === "CROSS_RUNTIME_VERIFY_ONLY_REJECTION_ONLY",
    "differential mode drift",
  );
  expect(
    JSON.stringify(vectors?.contract?.gateOrder) === JSON.stringify(GATE_ORDER),
    "differential gate order drift",
  );
  expect(vectors?.contract?.mutationCount === 20, "differential mutation count drift");
  expect(vectors?.contract?.everyMutationRejected === true, "differential rejection contract drift");
  expect(vectors?.contract?.nodeAndPythonMustMatchExactly === true, "cross-runtime parity disabled");
  for (const field of [
    "validPositiveCampaignVectorPublished",
    "signingMaterialIncluded",
    "createsKeys",
    "createsSignatures",
    "issuesReviewReceipts",
    "completesReview",
    "activationAuthorized",
  ]) {
    expect(vectors?.contract?.[field] === false, `differential contract ${field} drift`);
  }
  expect(vectors?.contract?.activationEffect === "NONE", "differential activation effect drift");
  expect(Array.isArray(vectors?.scenarios) && vectors.scenarios.length === 20, "differential case count drift");
  const names = new Set();
  const families = new Set();
  for (const scenario of vectors?.scenarios ?? []) {
    expect(!names.has(scenario.name), `duplicate differential scenario ${scenario.name}`);
    names.add(scenario.name);
    families.add(scenario.family);
    const actual = evaluatePositiveCampaignVectorIntake(
      scenario.candidate,
      scenario.expectedTarget,
      { now: vectors.evaluationTime },
    );
    expect(
      JSON.stringify(actual) === JSON.stringify(scenario.expectedResult),
      `${scenario.name} Node result does not reproduce`,
    );
    expect(scenario.expectedAccepted === false, `${scenario.name} claims acceptance`);
    expect(actual.candidateSatisfiesIntakePolicy === false, `${scenario.name} satisfies intake policy`);
    expect(
      actual.positiveVectorAcceptedForSeparateReview === false,
      `${scenario.name} claims separate-review acceptance`,
    );
    expect(
      JSON.stringify(actual.gates.map((entry) => entry.id)) === JSON.stringify(GATE_ORDER),
      `${scenario.name} gate order drift`,
    );
    expect(actual.gates.some((entry) => entry.result === "FAIL"), `${scenario.name} has no rejecting gate`);
    expect(
      scenario.expectedReceiptIssued === false && actual.receiptIssued === false,
      `${scenario.name} issues receipt`,
    );
    expect(
      scenario.expectedReviewCompleted === false && actual.reviewCompletedByThisEvaluator === false,
      `${scenario.name} completes review`,
    );
    expect(
      scenario.expectedActivationAuthorized === false && actual.activationAuthorized === false,
      `${scenario.name} authorizes activation`,
    );
    expect(
      scenario.expectedActivationEffect === "NONE" && actual.activationEffect === "NONE",
      `${scenario.name} creates activation effect`,
    );
  }
  for (const family of REQUIRED_FAMILIES) {
    expect(families.has(family), `missing differential mutation family ${family}`);
  }
  const reviewComplete = (vectors?.scenarios ?? []).find((scenario) =>
    scenario.name === "REVIEW_BINDING_COMPLETE_BUT_CRYPTOGRAPHY_ABSENT");
  expect(
    reviewComplete?.expectedResult?.gates?.find((entry) =>
      entry.id === "INDEPENDENT_VECTOR_REVIEW")?.result === "PASS",
    "complete review binding does not isolate the cryptographic HOLD",
  );
  expect(
    reviewComplete?.expectedResult?.gates?.find((entry) =>
      entry.id === "CRYPTOGRAPHIC_SIGNATURE")?.result === "FAIL",
    "complete review binding bypasses the cryptographic HOLD",
  );
  const privateCase = (vectors?.scenarios ?? []).find((scenario) =>
    scenario.name === "CANDIDATE_ACCESS_TOKEN_FIELD_ADDED");
  expect(
    privateCase?.candidate?.provenance?.accessToken === "forbidden-placeholder-not-a-credential",
    "private-field rejection placeholder drift",
  );
  expect(!/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/.test(generatorSource), "differential generator can create keys or signatures");
  expect(!/\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/.test(generatorSource), "differential generator can use network or wallet capability");
  expect(
    JSON.stringify(generatePositiveCampaignVectorIntakeDifferentialVectors()) === JSON.stringify(vectors),
    "differential vectors do not deterministically regenerate",
  );
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validatePositiveCampaignVectorIntakeDifferentialVectors();
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Cross-runtime intake mutation vectors reproduce in Node and remain rejection-only.");
  }
}
