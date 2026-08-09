/**
 * Validator for the rejection-only external positive-vector intake corpus.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  generatePositiveCampaignVectorIntakeVectors,
} from "./generate-positive-campaign-vector-intake-vectors.mjs";
import {
  evaluatePositiveCampaignVectorIntake,
} from "./positive-campaign-vector-intake.mjs";

const VECTOR_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-vectors.v1.json", import.meta.url),
);
const SCHEMA_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake.schema.v1.json", import.meta.url),
);
const EVALUATOR_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake.mjs", import.meta.url),
);
const GENERATOR_PATH = fileURLToPath(
  new URL("./generate-positive-campaign-vector-intake-vectors.mjs", import.meta.url),
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

function objectSchemasAreClosed(value, path = "#", errors = []) {
  if (!value || typeof value !== "object") return errors;
  if (value.type === "object" && value.additionalProperties !== false) {
    errors.push(`${path} is not a closed object schema`);
  }
  for (const [key, nested] of Object.entries(value)) {
    objectSchemasAreClosed(nested, `${path}/${key}`, errors);
  }
  return errors;
}

function gateResult(result, id) {
  return result.gates.find((entry) => entry.id === id)?.result;
}

export function loadPositiveCampaignVectorIntakeBundle() {
  return {
    vectors: JSON.parse(readFileSync(VECTOR_PATH, "utf8")),
    schema: JSON.parse(readFileSync(SCHEMA_PATH, "utf8")),
    evaluatorSource: readFileSync(EVALUATOR_PATH, "utf8"),
    generatorSource: readFileSync(GENERATOR_PATH, "utf8"),
  };
}

export function validatePositiveCampaignVectorIntakeVectors(
  bundle = loadPositiveCampaignVectorIntakeBundle(),
) {
  const { vectors, schema, evaluatorSource, generatorSource } = bundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(vectors?.vectorVersion === 1, "intake vector version drift");
  expect(
    vectors?.vectorId === "iat-promotions-dlc-positive-campaign-vector-intake-vectors-v1",
    "intake vector ID drift",
  );
  expect(
    JSON.stringify(vectors?.status?.labels) === JSON.stringify(HOLD_LABELS),
    "intake HOLD labels drift",
  );
  expect(vectors?.status?.network === "NONE", "intake vectors must remain network-free");
  expect(vectors?.status?.programId === null, "intake vectors claim a program ID");
  expect(vectors?.status?.deployable === false, "intake vectors claim deployability");
  expect(vectors?.status?.intakeApplied === false, "intake vectors claim application");
  expect(vectors?.status?.positiveVectorAvailable === false, "intake vectors claim a positive vector");
  expect(
    vectors?.status?.positiveVectorReviewCompleted === false,
    "intake vectors claim positive-vector review completion",
  );
  expect(
    vectors?.status?.positiveVectorIntegrationBlocked === true,
    "positive-vector integration HOLD was released",
  );
  expect(vectors?.contract?.mode === "VERIFY_ONLY_REJECTION_ONLY", "intake mode drift");
  expect(
    JSON.stringify(vectors?.contract?.gateOrder) === JSON.stringify(GATE_ORDER),
    "intake gate order drift",
  );
  for (const field of [
    "everyPublicCandidateRejected",
    "validPositiveCampaignVectorPublished",
    "independentlyReviewedPositiveVectorPublished",
    "signingMaterialIncluded",
    "createsKeys",
    "createsSignatures",
    "issuesReviewReceipts",
    "completesReview",
    "activationAuthorized",
  ]) {
    const expected = field === "everyPublicCandidateRejected";
    expect(vectors?.contract?.[field] === expected, `intake contract ${field} drift`);
  }
  expect(vectors?.contract?.activationEffect === "NONE", "intake activation effect drift");
  expect(vectors?.evaluationTime === 1_800_100_001, "intake evaluation time drift");
  expect(Array.isArray(vectors?.scenarios) && vectors.scenarios.length === 10, "intake scenario count drift");

  expect(schema?.additionalProperties === false, "intake root schema is open");
  expect(objectSchemasAreClosed(schema).length === 0, objectSchemasAreClosed(schema).join("; "));
  expect(schema?.properties?.intakeVersion?.const === 1, "intake schema version is not fixed");
  expect(schema?.definitions?.authority?.properties?.receiptIssued?.const === false, "schema can issue receipt");
  expect(
    schema?.definitions?.authority?.properties?.reviewCompletedByIntake?.const === false,
    "schema can complete review",
  );
  expect(
    schema?.definitions?.authority?.properties?.activationAuthorized?.const === false,
    "schema can authorize activation",
  );
  expect(
    schema?.definitions?.authority?.properties?.activationEffect?.const === "NONE",
    "schema can create an activation effect",
  );

  expect(!/\bwriteFile(?:Sync)?\s*\(/.test(evaluatorSource), "intake evaluator can write files");
  expect(!/\bfetch\s*\(|\bWebSocket\s*\(/.test(evaluatorSource), "intake evaluator can use a network");
  expect(
    !/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/.test(evaluatorSource),
    "intake evaluator can create keys or signatures",
  );
  expect(!/wallet-adapter|window\.solana|sendTransaction/.test(evaluatorSource), "intake evaluator can access wallets");
  expect(!/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/.test(generatorSource), "intake generator can create keys or signatures");

  const names = new Set();
  for (const scenario of vectors?.scenarios ?? []) {
    expect(!names.has(scenario.name), `duplicate intake scenario ${scenario.name}`);
    names.add(scenario.name);
    const actual = evaluatePositiveCampaignVectorIntake(
      scenario.candidate,
      scenario.expectedTarget,
      { now: vectors.evaluationTime },
    );
    expect(
      JSON.stringify(actual) === JSON.stringify(scenario.expectedResult),
      `${scenario.name} result does not reproduce`,
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
    expect(scenario.expectedReceiptIssued === false && actual.receiptIssued === false, `${scenario.name} issues a receipt`);
    expect(
      scenario.expectedReviewCompleted === false && actual.reviewCompletedByThisEvaluator === false,
      `${scenario.name} completes a review`,
    );
    expect(
      scenario.expectedActivationAuthorized === false && actual.activationAuthorized === false,
      `${scenario.name} authorizes activation`,
    );
    expect(
      scenario.expectedActivationEffect === "NONE" && actual.activationEffect === "NONE",
      `${scenario.name} creates an activation effect`,
    );
  }

  const byName = Object.fromEntries((vectors?.scenarios ?? []).map((scenario) => [scenario.name, scenario]));
  const fails = (name, id) => gateResult(byName[name]?.expectedResult ?? { gates: [] }, id) === "FAIL";
  expect(fails("BASE_UNRELATED_SIGNATURE_AND_REVIEW_ABSENT", "CRYPTOGRAPHIC_SIGNATURE"), "base case does not fail cryptography");
  expect(fails("BASE_UNRELATED_SIGNATURE_AND_REVIEW_ABSENT", "INDEPENDENT_VECTOR_REVIEW"), "base case does not fail review");
  expect(fails("MISSING_PROVENANCE", "CLOSED_SCHEMA"), "missing provenance does not fail schema");
  expect(fails("PRIVATE_KEY_FIELD_ADDED", "PRIVATE_MATERIAL_EXCLUSION"), "private field does not fail privacy");
  expect(fails("CANONICAL_MESSAGE_HEX_DRIFT", "CANONICAL_MESSAGE_BINDING"), "message drift does not fail binding");
  expect(fails("CANONICAL_MESSAGE_DIGEST_DRIFT", "CANONICAL_MESSAGE_BINDING"), "digest drift does not fail binding");
  expect(fails("SOURCE_ARTIFACT_DIGEST_DRIFT", "EXTERNAL_PROVENANCE"), "source drift does not fail provenance");
  expect(fails("EXPECTED_TARGET_PUBLIC_KEY_MISMATCH", "CANONICAL_MESSAGE_BINDING"), "target mismatch does not fail binding");
  expect(fails("ACTIVATION_AUTHORITY_CLAIM", "NON_AUTHORITY"), "authority claim does not fail non-authority");
  expect(fails("CANDIDATE_ONLY_REVIEW_CLAIM", "INDEPENDENT_VECTOR_REVIEW"), "candidate-only review claim does not fail review");
  expect(fails("UNRELATED_SIGNATURE_MISLABELED_AS_SOURCE_SIGNED", "CRYPTOGRAPHIC_SIGNATURE"), "mislabelled signature does not fail cryptography");

  expect(
    JSON.stringify(generatePositiveCampaignVectorIntakeVectors()) === JSON.stringify(vectors),
    "intake vectors do not deterministically regenerate",
  );
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validatePositiveCampaignVectorIntakeVectors();
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Positive campaign-vector intake vectors valid; every public candidate remains rejected and non-authoritative.");
  }
}
