/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import { generateReviewerBundleSchemaExamples } from "../generate-reviewer-bundle-schema-examples.mjs";
import { applyJsonPointerMutation, validateJsonSchemaSubset } from "../json-schema-subset.mjs";
import { lintReviewerBundle } from "../reviewer-bundle-linter.mjs";
import {
  loadReviewerBundleSchemaBundle,
  validateReviewerBundleSchemas,
} from "../validate-reviewer-bundle-schemas.mjs";

const bundle = loadReviewerBundleSchemaBundle();
const clone = (value) => structuredClone(value);
const validByName = Object.fromEntries(bundle.examples.validExamples.map((example) => [example.name, example]));
const schemaFor = (target) => ({
  CANDIDATE: bundle.candidateSchema,
  EXPECTED_TARGET: bundle.expectedTargetSchema,
  LINT_RESULT: bundle.lintResultSchema,
})[target];

test("three strict Draft-07 schemas and rejection-only examples reproduce", () => {
  assert.deepEqual(validateReviewerBundleSchemas(bundle), []);
  assert.deepEqual(generateReviewerBundleSchemaExamples(), bundle.examples);
  for (const schema of [bundle.candidateSchema, bundle.expectedTargetSchema, bundle.lintResultSchema]) {
    assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#");
    assert.equal(schema["x-iat-status"].network, "NONE");
    assert.equal(schema["x-iat-status"].programId, null);
    assert.equal(schema["x-iat-status"].deployable, false);
    assert.equal(schema["x-iat-status"].schemaApplied, false);
  }
});

test("all three public examples are structurally valid", () => {
  for (const example of bundle.examples.validExamples) {
    assert.deepEqual(validateJsonSchemaSubset(schemaFor(example.target), example.value), [], example.name);
  }
});

test("structural validity remains separate from six-gate semantic rejection", () => {
  const candidate = validByName.PUBLIC_REJECTED_CANDIDATE.value;
  const target = validByName.PUBLIC_EXPECTED_TARGET.value;
  assert.deepEqual(validateJsonSchemaSubset(bundle.candidateSchema, candidate), []);
  assert.deepEqual(validateJsonSchemaSubset(bundle.expectedTargetSchema, target), []);
  const result = lintReviewerBundle(candidate, target, bundle.receiptTemplate);
  assert.equal(result.candidateSatisfiesPolicy, false);
  assert.equal(result.gates.find((gate) => gate.id === "CRYPTOGRAPHIC_ATTESTATION").result, "FAIL");
});

test("a structurally valid but independently mismatched target fails semantic target binding", () => {
  const target = clone(validByName.PUBLIC_EXPECTED_TARGET.value);
  target.reviewTreeRootSha256 = "0".repeat(64);
  assert.deepEqual(validateJsonSchemaSubset(bundle.expectedTargetSchema, target), []);
  const result = lintReviewerBundle(validByName.PUBLIC_REJECTED_CANDIDATE.value, target, bundle.receiptTemplate);
  assert.equal(result.gates.find((gate) => gate.id === "TARGET_BINDING").result, "FAIL");
  assert.equal(result.candidateSatisfiesPolicy, false);
});

test("all fourteen invalid examples fail their declared Draft-07 keyword", () => {
  assert.equal(bundle.examples.invalidExamples.length, 14);
  for (const example of bundle.examples.invalidExamples) {
    const mutated = applyJsonPointerMutation(validByName[example.base].value, example.mutation);
    const errors = validateJsonSchemaSubset(schemaFor(example.target), mutated);
    assert.ok(
      errors.some((error) => error.keyword === example.expectedKeyword),
      `${example.name}: ${JSON.stringify(errors)}`,
    );
  }
});

test("lint-result schema permanently fixes receipt, review, and activation non-authority", () => {
  const properties = bundle.lintResultSchema.properties;
  assert.equal(properties.receiptIssued.const, false);
  assert.equal(properties.reviewCompletedByThisLinter.const, false);
  assert.equal(properties.activationAuthorized.const, false);
  assert.equal(properties.activationEffect.const, "NONE");
  const result = validByName.PUBLIC_REJECTED_LINT_RESULT.value;
  assert.equal(result.receiptIssued, false);
  assert.equal(result.reviewCompletedByThisLinter, false);
  assert.equal(result.activationAuthorized, false);
  assert.equal(result.activationEffect, "NONE");
});

test("open objects, released status, and authority escalation fail schema contract validation", () => {
  const mutated = clone(bundle);
  mutated.candidateSchema.definitions.payload.additionalProperties = true;
  mutated.expectedTargetSchema["x-iat-status"].network = "mainnet-beta";
  mutated.expectedTargetSchema["x-iat-status"].deployable = true;
  mutated.lintResultSchema.properties.receiptIssued.const = true;
  mutated.lintResultSchema.properties.reviewCompletedByThisLinter.const = true;
  mutated.lintResultSchema.properties.activationAuthorized.const = true;
  mutated.lintResultSchema.properties.activationEffect.const = "DEPLOY";
  const errors = validateReviewerBundleSchemas(mutated);
  assert.ok(errors.includes("schema 0 contains an open object"));
  assert.ok(errors.includes("schema 1 must remain network-free"));
  assert.ok(errors.includes("schema 1 must remain undeployable"));
  assert.ok(errors.includes("lint-result schema permits receipt issuance"));
  assert.ok(errors.includes("lint-result schema permits completed review"));
  assert.ok(errors.includes("lint-result schema authorizes activation"));
  assert.ok(errors.includes("lint-result schema activation effect drift"));
  assert.ok(errors.includes("candidateSchema source digest mismatch"));
});

test("portable schemas expose commitments and public attestation material but no private identity", () => {
  const text = JSON.stringify([
    bundle.candidateSchema,
    bundle.expectedTargetSchema,
    bundle.lintResultSchema,
    bundle.examples,
  ]).toLowerCase();
  for (const required of ["revieweridentitycommitmentsha256", "publickeyhex", "signaturehex", "expectedtargetcanonicalsha256"]) {
    assert.equal(text.includes(required), true, required);
  }
  for (const forbidden of ["raw_x_user_id", "x_handle", "oauth_token", "private_key", "secret_key", "seed_phrase"] ) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
