/**
 * Validator for the closed reviewer candidate, target, and lint-result schemas.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateReviewerBundleSchemaExamples } from "./generate-reviewer-bundle-schema-examples.mjs";
import { applyJsonPointerMutation, validateJsonSchemaSubset } from "./json-schema-subset.mjs";
import { lintReviewerBundle } from "./reviewer-bundle-linter.mjs";

const CANDIDATE_SCHEMA_PATH = fileURLToPath(new URL("./reviewer-candidate.schema.v1.json", import.meta.url));
const TARGET_SCHEMA_PATH = fileURLToPath(new URL("./reviewer-expected-target.schema.v1.json", import.meta.url));
const RESULT_SCHEMA_PATH = fileURLToPath(new URL("./reviewer-lint-result.schema.v1.json", import.meta.url));
const EXAMPLES_PATH = fileURLToPath(new URL("./reviewer-bundle-schema-examples.v1.json", import.meta.url));
const TEMPLATE_PATH = fileURLToPath(new URL("./independent-review-receipt-template.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));

export function loadReviewerBundleSchemaBundle() {
  return {
    candidateSchema: parse(CANDIDATE_SCHEMA_PATH),
    expectedTargetSchema: parse(TARGET_SCHEMA_PATH),
    lintResultSchema: parse(RESULT_SCHEMA_PATH),
    examples: parse(EXAMPLES_PATH),
    receiptTemplate: parse(TEMPLATE_PATH),
  };
}

function schemaFor(bundle, target) {
  if (target === "CANDIDATE") return bundle.candidateSchema;
  if (target === "EXPECTED_TARGET") return bundle.expectedTargetSchema;
  if (target === "LINT_RESULT") return bundle.lintResultSchema;
  throw new Error(`unknown reviewer schema target: ${target}`);
}

function everyObjectSchemaIsClosed(schema) {
  let closed = true;
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.type === "object" && value.additionalProperties !== false) closed = false;
    for (const child of Object.values(value)) visit(child);
  };
  visit(schema);
  return closed;
}

export function validateReviewerBundleSchemas(bundle = loadReviewerBundleSchemaBundle()) {
  const { candidateSchema, expectedTargetSchema, lintResultSchema, examples, receiptTemplate } = bundle;
  const schemas = [candidateSchema, expectedTargetSchema, lintResultSchema];
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };

  for (const [index, schema] of schemas.entries()) {
    expect(schema?.$schema === "http://json-schema.org/draft-07/schema#", `schema ${index} Draft-07 declaration drift`);
    expect(JSON.stringify(schema?.["x-iat-status"]?.labels) === JSON.stringify(HOLD_LABELS), `schema ${index} HOLD labels drift`);
    expect(schema?.["x-iat-status"]?.network === "NONE", `schema ${index} must remain network-free`);
    expect(schema?.["x-iat-status"]?.programId === null, `schema ${index} must not claim a program ID`);
    expect(schema?.["x-iat-status"]?.deployable === false, `schema ${index} must remain undeployable`);
    expect(schema?.["x-iat-status"]?.schemaApplied === false, `schema ${index} must remain unapplied`);
    expect(everyObjectSchemaIsClosed(schema), `schema ${index} contains an open object`);
  }
  expect(candidateSchema?.properties?.payload?.$ref === "#/definitions/payload", "candidate payload schema drift");
  expect(candidateSchema?.definitions?.payload?.properties?.activationAuthorized?.const === false, "candidate schema authorizes activation");
  expect(candidateSchema?.definitions?.payload?.properties?.activationEffect?.const === "NONE", "candidate schema activation effect drift");
  expect(expectedTargetSchema?.additionalProperties === false, "expected-target schema is open");
  expect(lintResultSchema?.properties?.receiptIssued?.const === false, "lint-result schema permits receipt issuance");
  expect(lintResultSchema?.properties?.reviewCompletedByThisLinter?.const === false, "lint-result schema permits completed review");
  expect(lintResultSchema?.properties?.activationAuthorized?.const === false, "lint-result schema authorizes activation");
  expect(lintResultSchema?.properties?.activationEffect?.const === "NONE", "lint-result schema activation effect drift");
  expect(examples?.contract?.structuralValidationIsNotSemanticAcceptance === true, "schema examples conflate structure and semantics");
  expect(examples?.contract?.expectedTargetAuthenticityMustBeEstablishedSeparately === true, "schema examples trust candidate target");
  expect(examples?.contract?.publicExamplesAreRejectionOnly === true, "schema examples are not rejection-only");
  expect(examples?.contract?.receiptIssued === false, "schema examples claim receipt issuance");
  expect(examples?.contract?.reviewCompleted === false, "schema examples claim completed review");
  expect(examples?.contract?.activationAuthorized === false, "schema examples claim activation authority");
  expect(examples?.contract?.activationEffect === "NONE", "schema examples have activation effect");

  const sourcePairs = [
    ["candidateSchema", candidateSchema],
    ["expectedTargetSchema", expectedTargetSchema],
    ["lintResultSchema", lintResultSchema],
  ];
  for (const [key, schema] of sourcePairs) {
    expect(examples?.sources?.[key]?.canonicalSha256 === canonicalSha256(schema), `${key} source digest mismatch`);
  }

  const validByName = Object.fromEntries((examples?.validExamples ?? []).map((example) => [example.name, example]));
  for (const example of examples?.validExamples ?? []) {
    expect(validateJsonSchemaSubset(schemaFor(bundle, example.target), example.value).length === 0, `${example.name} is not structurally valid`);
  }
  for (const example of examples?.invalidExamples ?? []) {
    const base = validByName[example.base];
    if (!base) {
      errors.push(`${example.name} base example missing`);
      continue;
    }
    const mutated = applyJsonPointerMutation(base.value, example.mutation);
    const schemaErrors = validateJsonSchemaSubset(schemaFor(bundle, example.target), mutated);
    expect(schemaErrors.some((error) => error.keyword === example.expectedKeyword), `${example.name} expected keyword not observed`);
  }

  const candidate = validByName.PUBLIC_REJECTED_CANDIDATE?.value;
  const target = validByName.PUBLIC_EXPECTED_TARGET?.value;
  const publishedResult = validByName.PUBLIC_REJECTED_LINT_RESULT?.value;
  const reproducedResult = lintReviewerBundle(candidate, target, receiptTemplate);
  expect(JSON.stringify(publishedResult) === JSON.stringify(reproducedResult), "public lint result does not reproduce");
  expect(reproducedResult.candidateSatisfiesPolicy === false, "public candidate unexpectedly satisfies policy");
  expect(reproducedResult.receiptIssued === false, "public lint result issues a receipt");
  expect(reproducedResult.reviewCompletedByThisLinter === false, "public lint result completes review");
  expect(reproducedResult.activationAuthorized === false, "public lint result authorizes activation");
  expect(reproducedResult.activationEffect === "NONE", "public lint result has activation effect");
  expect(JSON.stringify(examples) === JSON.stringify(generateReviewerBundleSchemaExamples()), "reviewer schema examples differ from deterministic generation");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateReviewerBundleSchemas();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Reviewer bundle schemas and rejection-only examples reproduce under every HOLD gate.");
  }
}
