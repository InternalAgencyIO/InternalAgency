/**
 * Rejection-only review-receipt acceptance-vector validator.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateIndependentReviewAcceptanceVectors } from "./generate-independent-review-receipt-acceptance-vectors.mjs";
import { evaluateIndependentReviewReceiptCandidate } from "./independent-review-receipt-acceptance.mjs";

const VECTOR_PATH = fileURLToPath(
  new URL("./independent-review-receipt-acceptance-vectors.v1.json", import.meta.url),
);
const TEMPLATE_PATH = fileURLToPath(new URL("./independent-review-receipt-template.v1.json", import.meta.url));
const POLICY_PATH = fileURLToPath(new URL("./independent-review-receipt-acceptance.mjs", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const EXPECTED_SCENARIOS = [
  "UNRELATED_SIGNATURE_ONLY",
  "TARGET_COMMIT_MISMATCH",
  "SCOPE_AREA_OMITTED",
  "REVIEWER_ROLE_CONFLICT",
  "BLOCKING_FINDING_WITH_APPROVAL",
  "ACTIVATION_AUTHORITY_CLAIM",
];

export function loadIndependentReviewAcceptanceBundle() {
  return {
    vectors: JSON.parse(readFileSync(VECTOR_PATH, "utf8")),
    receiptTemplate: JSON.parse(readFileSync(TEMPLATE_PATH, "utf8")),
    policySource: readFileSync(POLICY_PATH, "utf8"),
  };
}

export function validateIndependentReviewAcceptanceVectors(
  bundle = loadIndependentReviewAcceptanceBundle(),
) {
  const { vectors, receiptTemplate, policySource } = bundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(vectors?.vectorVersion === 1, "review acceptance vector version drift");
  expect(
    vectors?.vectorId === "iat-promotions-dlc-independent-review-acceptance-vectors-v1",
    "review acceptance vector ID drift",
  );
  expect(JSON.stringify(vectors?.status?.labels) === JSON.stringify(HOLD_LABELS), "review acceptance HOLD labels drift");
  expect(vectors?.status?.network === "NONE", "review acceptance vectors must remain network-free");
  expect(vectors?.status?.programId === null, "review acceptance vectors must not claim a program ID");
  expect(vectors?.status?.deployable === false, "review acceptance vectors must remain undeployable");
  expect(vectors?.status?.acceptancePolicyApplied === false, "review acceptance policy must remain unapplied");
  expect(vectors?.status?.acceptedReceiptPublished === false, "review acceptance vectors claim an accepted receipt");
  expect(vectors?.status?.validReviewSignaturePublished === false, "review acceptance vectors claim a valid review signature");
  expect(vectors?.contract?.allGatesRequired === true, "review acceptance no longer requires all gates");
  expect(vectors?.contract?.publicVectorsAreRejectionOnly === true, "review acceptance vectors are not rejection-only");
  expect(vectors?.contract?.evaluationIssuesNoReceipt === true, "review acceptance evaluator claims receipt issuance");
  expect(vectors?.contract?.activationAuthorized === false, "review acceptance contract authorizes activation");
  expect(vectors?.contract?.activationEffect === "NONE", "review acceptance contract has activation effect");
  expect(
    JSON.stringify(vectors?.scenarios?.map((scenario) => scenario.name)) === JSON.stringify(EXPECTED_SCENARIOS),
    "review acceptance scenario set or order drift",
  );
  for (const scenario of vectors?.scenarios ?? []) {
    const result = evaluateIndependentReviewReceiptCandidate(
      scenario.candidate,
      scenario.expectedTarget,
      receiptTemplate,
    );
    expect(scenario.expectedAccepted === false, `${scenario.name} expected acceptance drift`);
    expect(result.accepted === false, `${scenario.name} unexpectedly accepted`);
    expect(result.receiptIssued === false, `${scenario.name} claims receipt issuance`);
    expect(result.reviewCompletedByThisEvaluator === false, `${scenario.name} claims completed review`);
    expect(result.activationAuthorized === false, `${scenario.name} claims activation authority`);
    expect(result.activationEffect === "NONE", `${scenario.name} has activation effect`);
    expect(
      JSON.stringify(result.failures.map((failure) => failure.gate)) ===
        JSON.stringify(scenario.expectedFailedGates),
      `${scenario.name} failed-gate set drift`,
    );
    expect(JSON.stringify(result) === JSON.stringify(scenario.result), `${scenario.name} result drift`);
  }
  expect(
    !/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(|\bfetch\s*\(|\bWebSocket\s*\(/.test(policySource),
    "review acceptance policy contains signing, keygen, or network capability",
  );
  expect(
    JSON.stringify(vectors) === JSON.stringify(generateIndependentReviewAcceptanceVectors()),
    "review acceptance vectors differ from deterministic generation",
  );
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateIndependentReviewAcceptanceVectors();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Receipt-acceptance vectors reproduce; all public candidates remain rejected and non-activating.");
  }
}
