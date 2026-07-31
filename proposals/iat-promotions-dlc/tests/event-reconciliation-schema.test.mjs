/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import { reconcileEventEvidence } from "../event-reconciler.mjs";
import { generateEventReconciliationSchemaExamples } from "../generate-event-reconciliation-schema-examples.mjs";
import { applyJsonPointerMutation, validateJsonSchemaSubset } from "../json-schema-subset.mjs";
import {
  loadEventReconciliationSchemaBundle,
  validateEventReconciliationSchemas,
} from "../validate-event-reconciliation-schemas.mjs";

const bundle = loadEventReconciliationSchemaBundle();
const clone = (value) => structuredClone(value);

test("strict Draft-07 evidence/result schemas and examples reproduce under every HOLD gate", () => {
  assert.deepEqual(validateEventReconciliationSchemas(bundle), []);
  assert.deepEqual(generateEventReconciliationSchemaExamples(), bundle.examples);
  for (const schema of [bundle.evidenceSchema, bundle.resultSchema]) {
    assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#");
    assert.equal(schema["x-iat-status"].network, "NONE");
    assert.equal(schema["x-iat-status"].programId, null);
    assert.equal(schema["x-iat-status"].deployable, false);
    assert.equal(schema["x-iat-status"].schemaApplied, false);
  }
});

test("every valid evidence example also passes semantic reconciliation", () => {
  for (const example of bundle.examples.validExamples.filter((candidate) => candidate.target === "EVIDENCE")) {
    assert.deepEqual(validateJsonSchemaSubset(bundle.evidenceSchema, example.value), [], example.name);
    const result = reconcileEventEvidence(example.value);
    assert.equal(result.accountsAndReceiptsRemainAuthoritative, true, example.name);
    assert.equal(result.eventStreamAuthorizedNoStateChange, true, example.name);
  }
});

test("every valid result example preserves held status and non-authority", () => {
  for (const example of bundle.examples.validExamples.filter((candidate) => candidate.target === "RESULT")) {
    assert.deepEqual(validateJsonSchemaSubset(bundle.resultSchema, example.value), [], example.name);
    assert.equal(example.value.status.network, "NONE");
    assert.equal(example.value.status.deployable, false);
    assert.equal(example.value.accountsAndReceiptsRemainAuthoritative, true);
    assert.equal(example.value.eventStreamAuthorizedNoStateChange, true);
  }
});

test("all invalid public examples fail their declared Draft-07 keyword", () => {
  const validByName = Object.fromEntries(
    bundle.examples.validExamples.map((example) => [example.name, example]),
  );
  for (const example of bundle.examples.invalidExamples) {
    const base = validByName[example.base];
    const schema = example.target === "EVIDENCE" ? bundle.evidenceSchema : bundle.resultSchema;
    const mutated = applyJsonPointerMutation(base.value, example.mutation);
    const errors = validateJsonSchemaSubset(schema, mutated);
    assert.ok(
      errors.some((error) => error.keyword === example.expectedKeyword),
      `${example.name}: ${JSON.stringify(errors)}`,
    );
  }
});

test("open objects, economics drift, authority escalation, and released status fail contract validation", () => {
  const mutated = clone(bundle);
  mutated.evidenceSchema.definitions.campaign.additionalProperties = true;
  mutated.evidenceSchema.definitions.campaign.properties.maximum_budget_base_units.const = "1";
  mutated.evidenceSchema.definitions.settlementReceipt.properties.hero_reward_base_units.const = "1";
  mutated.resultSchema.properties.accountsAndReceiptsRemainAuthoritative.const = false;
  mutated.resultSchema["x-iat-status"].network = "mainnet-beta";
  mutated.resultSchema["x-iat-status"].programId = "f".repeat(64);
  mutated.resultSchema["x-iat-status"].deployable = true;
  mutated.resultSchema["x-iat-status"].schemaApplied = true;
  const errors = validateEventReconciliationSchemas(mutated);
  assert.ok(errors.some((error) => error.includes("open object schema")));
  assert.ok(errors.includes("evidence schema budget contract drift"));
  assert.ok(errors.includes("evidence schema hero reward drift"));
  assert.ok(errors.includes("result schema account authority drift"));
  assert.ok(errors.includes("result schema must remain network-free"));
  assert.ok(errors.includes("result schema must not claim a program ID"));
  assert.ok(errors.includes("result schema must remain undeployable"));
  assert.ok(errors.includes("result schema must remain unapplied"));
  assert.ok(errors.includes("result schema source digest mismatch"));
});

test("schema properties expose commitments but no raw identity, handle, OAuth, or signing field", () => {
  const text = JSON.stringify([bundle.evidenceSchema, bundle.resultSchema]);
  assert.equal(text.includes("hero_x_identity_commitment"), true);
  assert.equal(text.includes("proposer_x_identity_commitment"), true);
  for (const forbidden of ["raw_x_user_id", "x_handle", "oauth", "private_key", "secret_key", "signature"]) {
    assert.equal(text.toLowerCase().includes(forbidden), false, forbidden);
  }
});
