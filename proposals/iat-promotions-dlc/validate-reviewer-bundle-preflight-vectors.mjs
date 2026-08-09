/**
 * Validator for reviewer-input structural-preflight vectors.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateReviewerBundlePreflightVectors } from "./generate-reviewer-bundle-preflight-vectors.mjs";
import { loadReviewerInputSchemas, preflightReviewerInputs } from "./reviewer-bundle-preflight.mjs";

const VECTOR_PATH = fileURLToPath(new URL("./reviewer-bundle-preflight-vectors.v1.json", import.meta.url));
const PREFLIGHT_PATH = fileURLToPath(new URL("./reviewer-bundle-preflight.mjs", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadReviewerBundlePreflightBundle() {
  return {
    vectors: JSON.parse(readFileSync(VECTOR_PATH, "utf8")),
    schemas: loadReviewerInputSchemas(),
    preflightSource: readFileSync(PREFLIGHT_PATH, "utf8"),
  };
}

export function validateReviewerBundlePreflightVectors(bundle = loadReviewerBundlePreflightBundle()) {
  const { vectors, schemas, preflightSource } = bundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(vectors?.vectorVersion === 1, "preflight vector version drift");
  expect(vectors?.vectorId === "iat-promotions-dlc-reviewer-bundle-preflight-vectors-v1", "preflight vector ID drift");
  expect(JSON.stringify(vectors?.status?.labels) === JSON.stringify(HOLD_LABELS), "preflight HOLD labels drift");
  expect(vectors?.status?.network === "NONE", "preflight vectors must remain network-free");
  expect(vectors?.status?.programId === null, "preflight vectors must not claim a program ID");
  expect(vectors?.status?.deployable === false, "preflight vectors must remain undeployable");
  expect(vectors?.status?.preflightApplied === false, "preflight vectors must remain unapplied");
  expect(vectors?.contract?.validStructureIsNotSemanticAcceptance === true, "preflight conflates structure with acceptance");
  expect(vectors?.contract?.invalidStructureStopsSemanticEvaluation === true, "invalid structure no longer stops semantics");
  expect(vectors?.contract?.jsonPointerDiagnosticsRequired === true, "preflight diagnostics contract drift");
  expect(vectors?.contract?.semanticEvaluationRan === false, "preflight claims semantic evaluation");
  expect(vectors?.contract?.receiptIssued === false, "preflight claims receipt issuance");
  expect(vectors?.contract?.reviewCompleted === false, "preflight claims completed review");
  expect(vectors?.contract?.activationAuthorized === false, "preflight claims activation authority");
  expect(vectors?.contract?.activationEffect === "NONE", "preflight has activation effect");

  for (const scenario of vectors?.scenarios ?? []) {
    const result = preflightReviewerInputs(scenario.candidate, scenario.expectedTarget, schemas);
    expect(JSON.stringify(result) === JSON.stringify(scenario.result), `${scenario.name} preflight result drift`);
    expect(result.structuralValid === scenario.expectedStructuralValid, `${scenario.name} structural result drift`);
    expect(result.semanticEvaluationAllowed === scenario.expectedStructuralValid, `${scenario.name} semantic permission drift`);
    expect(result.semanticEvaluationRan === false, `${scenario.name} claims semantic evaluation`);
    expect(result.receiptIssued === false, `${scenario.name} claims receipt issuance`);
    expect(result.reviewCompletedByThisPreflight === false, `${scenario.name} claims completed review`);
    expect(result.activationAuthorized === false, `${scenario.name} claims activation authority`);
    expect(result.activationEffect === "NONE", `${scenario.name} has activation effect`);
    if (!scenario.expectedStructuralValid) {
      const targetDocument = result.documents.find((document) => document.document === scenario.mutationTarget);
      expect(targetDocument?.valid === false, `${scenario.name} mutated document unexpectedly valid`);
      expect(
        targetDocument?.errors?.some((error) => error.keyword === scenario.expectedKeyword),
        `${scenario.name} expected diagnostic keyword missing`,
      );
      expect(
        targetDocument?.errors?.every((error) =>
          typeof error.instancePath === "string" &&
          (error.instancePath === "" || error.instancePath.startsWith("/"))) ?? false,
        `${scenario.name} lacks JSON Pointer diagnostics`,
      );
    }
  }
  expect(
    !/\bwriteFile|\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(|\bfetch\s*\(|\bWebSocket\s*\(/.test(preflightSource),
    "preflight source contains write, signing, keygen, or network capability",
  );
  expect(JSON.stringify(vectors) === JSON.stringify(generateReviewerBundlePreflightVectors()), "preflight vectors differ from deterministic generation");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateReviewerBundlePreflightVectors();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Reviewer structural-preflight vectors reproduce; invalid inputs stop before semantic evaluation.");
  }
}
