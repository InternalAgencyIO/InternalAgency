/**
 * Deterministic structural-preflight vectors for reviewer input files.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { applyJsonPointerMutation } from "./json-schema-subset.mjs";
import { preflightReviewerInputs } from "./reviewer-bundle-preflight.mjs";

const EXAMPLES_PATH = fileURLToPath(new URL("./reviewer-bundle-schema-examples.v1.json", import.meta.url));
const CANDIDATE_SCHEMA_PATH = fileURLToPath(new URL("./reviewer-candidate.schema.v1.json", import.meta.url));
const TARGET_SCHEMA_PATH = fileURLToPath(new URL("./reviewer-expected-target.schema.v1.json", import.meta.url));
const PREFLIGHT_PATH = fileURLToPath(new URL("./reviewer-bundle-preflight.mjs", import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL("./reviewer-bundle-preflight-vectors.v1.json", import.meta.url));
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const normalizedTextSha256 = (path) => createHash("sha256")
  .update(readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"))
  .digest("hex");

export function generateReviewerBundlePreflightVectors() {
  const examples = parse(EXAMPLES_PATH);
  const candidateSchema = parse(CANDIDATE_SCHEMA_PATH);
  const expectedTargetSchema = parse(TARGET_SCHEMA_PATH);
  const validByName = Object.fromEntries(examples.validExamples.map((example) => [example.name, example]));
  const baseCandidate = validByName.PUBLIC_REJECTED_CANDIDATE.value;
  const baseTarget = validByName.PUBLIC_EXPECTED_TARGET.value;
  const scenarios = [{
    name: "VALID_PUBLIC_STRUCTURE",
    mutationTarget: "NONE",
    expectedStructuralValid: true,
    candidate: baseCandidate,
    expectedTarget: baseTarget,
    result: preflightReviewerInputs(baseCandidate, baseTarget, { candidateSchema, expectedTargetSchema }),
  }];

  for (const example of examples.invalidExamples.filter((entry) => entry.target !== "LINT_RESULT")) {
    const candidate = example.target === "CANDIDATE"
      ? applyJsonPointerMutation(baseCandidate, example.mutation)
      : structuredClone(baseCandidate);
    const expectedTarget = example.target === "EXPECTED_TARGET"
      ? applyJsonPointerMutation(baseTarget, example.mutation)
      : structuredClone(baseTarget);
    scenarios.push({
      name: example.name,
      mutationTarget: example.target,
      expectedStructuralValid: false,
      expectedKeyword: example.expectedKeyword,
      candidate,
      expectedTarget,
      result: preflightReviewerInputs(candidate, expectedTarget, { candidateSchema, expectedTargetSchema }),
    });
  }

  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-reviewer-bundle-preflight-vectors-v1",
    status: {
      labels: ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"],
      network: "NONE",
      programId: null,
      deployable: false,
      preflightApplied: false,
    },
    sources: {
      schemaExamples: {
        path: "reviewer-bundle-schema-examples.v1.json",
        canonicalSha256: canonicalSha256(examples),
      },
      candidateSchema: {
        path: "reviewer-candidate.schema.v1.json",
        canonicalSha256: canonicalSha256(candidateSchema),
      },
      expectedTargetSchema: {
        path: "reviewer-expected-target.schema.v1.json",
        canonicalSha256: canonicalSha256(expectedTargetSchema),
      },
      preflight: {
        path: "reviewer-bundle-preflight.mjs",
        normalizedTextSha256: normalizedTextSha256(PREFLIGHT_PATH),
      },
    },
    contract: {
      validStructureIsNotSemanticAcceptance: true,
      invalidStructureStopsSemanticEvaluation: true,
      jsonPointerDiagnosticsRequired: true,
      semanticEvaluationRan: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    scenarios,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = `${JSON.stringify(generateReviewerBundlePreflightVectors(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote structural-preflight vectors; no semantic acceptance or receipt was created.");
  } else {
    process.stdout.write(rendered);
  }
}
