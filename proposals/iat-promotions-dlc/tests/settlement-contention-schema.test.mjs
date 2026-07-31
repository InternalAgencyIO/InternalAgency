/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import { validateJsonSchemaSubset } from "../json-schema-subset.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadSettlementContentionVectorBundle,
  validateSettlementContentionVectors,
} from "../validate-settlement-contention-vectors.mjs";

const bundle = loadSettlementContentionVectorBundle();

function allObjectSchemasAreClosed(schema) {
  const open = [];
  const visit = (value, path = "#") => {
    if (!value || typeof value !== "object") return;
    if (value.type === "object" && value.additionalProperties !== false) open.push(path);
    for (const [key, child] of Object.entries(value)) visit(child, `${path}/${key}`);
  };
  visit(schema);
  return open;
}

test("compact contention artifact satisfies a fully closed Draft-07 schema", () => {
  assert.equal(bundle.schema.$schema, "http://json-schema.org/draft-07/schema#");
  assert.deepEqual(validateJsonSchemaSubset(bundle.schema, bundle.artifact), []);
  assert.deepEqual(allObjectSchemasAreClosed(bundle.schema), []);
  assert.deepEqual(validateSettlementContentionVectors(bundle), []);
});

test("schema rejects unexpected root, nested, and scenario properties", () => {
  for (const mutate of [
    (value) => { value.expandedState = {}; },
    (value) => { value.status.rpc = "https://forbidden.invalid"; },
    (value) => { value.scenarios[0].expandedTimeline = []; },
  ]) {
    const changed = structuredClone(bundle.artifact);
    mutate(changed);
    const errors = validateJsonSchemaSubset(bundle.schema, changed);
    assert.ok(errors.some((error) => error.keyword === "additionalProperties"));
  }
});

test("schema rejects removed fields, malformed commitments, and changed accounting", () => {
  const missing = structuredClone(bundle.artifact);
  delete missing.scenarios[0].winnerAttemptId;
  assert.ok(validateJsonSchemaSubset(bundle.schema, missing).some((error) => error.keyword === "required"));

  const malformed = structuredClone(bundle.artifact);
  malformed.scenarios[0].finalStateSha256 = "not-a-digest";
  assert.ok(validateJsonSchemaSubset(bundle.schema, malformed).some((error) => error.keyword === "pattern"));

  const accounting = structuredClone(bundle.artifact);
  accounting.scenarios[0].winnerHeroBalanceBaseUnits = "119999999999";
  assert.ok(validateJsonSchemaSubset(bundle.schema, accounting).some((error) => error.keyword === "const"));
});

test("schema permanently rejects network, authority, and expanded-evidence claims", () => {
  for (const [path, value] of [
    [["status", "network"], "MAINNET"],
    [["contract", "usesLocalValidator"], true],
    [["contract", "usesRpc"], true],
    [["contract", "usesWallet"], true],
    [["contract", "preparesTransactions"], true],
    [["contract", "activationAuthorized"], true],
    [["summary", "expandedTimelineOrTraceStored"], true],
    [["summary", "reviewCompleted"], true],
  ]) {
    const changed = structuredClone(bundle.artifact);
    changed[path[0]][path[1]] = value;
    assert.ok(validateJsonSchemaSubset(bundle.schema, changed).some((error) => error.keyword === "const"));
  }
});

test("schema and portability surfaces are content-addressed with proposal-only roles", () => {
  const expected = {
    "settlement-contention-evidence.schema.v1.json": "ARTIFACT",
    "tests/settlement-contention-schema.test.mjs": "TEST",
    "verify-settlement-contention-vectors.py": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
});
