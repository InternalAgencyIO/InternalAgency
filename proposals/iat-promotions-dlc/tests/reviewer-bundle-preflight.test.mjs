/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { generateReviewerBundlePreflightVectors } from "../generate-reviewer-bundle-preflight-vectors.mjs";
import { lintReviewerBundle } from "../reviewer-bundle-linter.mjs";
import { preflightReviewerInputs, renderReviewerInputPreflight } from "../reviewer-bundle-preflight.mjs";
import {
  loadReviewerBundlePreflightBundle,
  validateReviewerBundlePreflightVectors,
} from "../validate-reviewer-bundle-preflight-vectors.mjs";

const LINTER_PATH = fileURLToPath(new URL("../reviewer-bundle-linter.mjs", import.meta.url));
const PREFLIGHT_PATH = fileURLToPath(new URL("../reviewer-bundle-preflight.mjs", import.meta.url));
const TEMPLATE_PATH = fileURLToPath(new URL("../independent-review-receipt-template.v1.json", import.meta.url));
const bundle = loadReviewerBundlePreflightBundle();
const receiptTemplate = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
const valid = bundle.vectors.scenarios[0];

function withInputFiles(candidate, target, run) {
  const directory = mkdtempSync(join(tmpdir(), "iat-review-preflight-"));
  try {
    const candidatePath = join(directory, "candidate.json");
    const targetPath = join(directory, "target.json");
    writeFileSync(candidatePath, JSON.stringify(candidate), "utf8");
    writeFileSync(targetPath, JSON.stringify(target), "utf8");
    return run(candidatePath, targetPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("preflight vectors reproduce under every HOLD and non-authority gate", () => {
  assert.deepEqual(validateReviewerBundlePreflightVectors(bundle), []);
  assert.deepEqual(generateReviewerBundlePreflightVectors(), bundle.vectors);
  assert.equal(bundle.vectors.scenarios.length, 10);
  assert.equal(bundle.vectors.contract.semanticEvaluationRan, false);
  assert.equal(bundle.vectors.contract.receiptIssued, false);
  assert.equal(bundle.vectors.contract.activationAuthorized, false);
});

test("valid structure permits but never performs semantic evaluation", () => {
  const result = preflightReviewerInputs(valid.candidate, valid.expectedTarget, bundle.schemas);
  assert.equal(result.structuralValid, true);
  assert.equal(result.semanticEvaluationAllowed, true);
  assert.equal(result.semanticEvaluationRan, false);
  assert.deepEqual(result.documents.map((document) => document.errors), [[], []]);
});

test("all nine malformed input scenarios stop before semantic evaluation", () => {
  for (const scenario of bundle.vectors.scenarios.slice(1)) {
    assert.equal(scenario.result.structuralValid, false, scenario.name);
    assert.equal(scenario.result.semanticEvaluationAllowed, false, scenario.name);
    assert.equal(scenario.result.semanticEvaluationRan, false, scenario.name);
    const document = scenario.result.documents.find((entry) => entry.document === scenario.mutationTarget);
    assert.equal(document.valid, false, scenario.name);
    assert.ok(document.errors.some((error) => error.keyword === scenario.expectedKeyword), scenario.name);
    for (const error of document.errors) {
      assert.equal(typeof error.instancePath, "string", scenario.name);
      assert.equal(typeof error.schemaPath, "string", scenario.name);
    }
  }
});

test("human diagnostics expose document, JSON Pointer, keyword, and message", () => {
  const scenario = bundle.vectors.scenarios.find((entry) => entry.name === "CANDIDATE_MALFORMED_SIGNATURE");
  const markdown = renderReviewerInputPreflight(scenario.result);
  assert.match(markdown, /Structural result: \*\*FAIL\*\*/);
  assert.match(markdown, /CANDIDATE/);
  assert.match(markdown, /\/attestation\/signatureHex/);
  assert.match(markdown, /pattern/);
  assert.match(markdown, /must match the fixed pattern/);
  assert.match(markdown, /Semantic evaluation ran: \*\*false\*\*/);

  const escaped = renderReviewerInputPreflight({
    ...scenario.result,
    documents: [{
      document: "CANDIDATE",
      valid: false,
      errors: [{
        instancePath: "/bad\\path|field\nnext",
        schemaPath: "#/properties/bad\\path|field",
        keyword: "additionalProperties",
        message: "line one|line two\\tail\nend",
      }],
    }],
  });
  assert.ok(escaped.includes("/bad\\\\path\\|field next"));
  assert.ok(escaped.includes("line one\\|line two\\\\tail end"));
});

test("CLI returns status 3 and JSON diagnostics for structural rejection", () => {
  const scenario = bundle.vectors.scenarios.find((entry) => entry.name === "CANDIDATE_EXTRA_FIELD");
  const result = withInputFiles(scenario.candidate, scenario.expectedTarget, (candidatePath, targetPath) =>
    spawnSync(process.execPath, [
      LINTER_PATH,
      "--candidate", candidatePath,
      "--expected-target", targetPath,
      "--format", "json",
    ], { encoding: "utf8" }));
  assert.equal(result.status, 3);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.structuralValid, false);
  assert.equal(parsed.semanticEvaluationRan, false);
  assert.ok(parsed.documents[0].errors.some((error) => error.instancePath === "/unexpected"));
});

test("CLI prints human-readable pointer diagnostics for structural rejection", () => {
  const scenario = bundle.vectors.scenarios.find((entry) => entry.name === "EXPECTED_TARGET_MISSING_ROOT");
  const result = withInputFiles(scenario.candidate, scenario.expectedTarget, (candidatePath, targetPath) =>
    spawnSync(process.execPath, [
      LINTER_PATH,
      "--candidate", candidatePath,
      "--expected-target", targetPath,
      "--format", "markdown",
    ], { encoding: "utf8" }));
  assert.equal(result.status, 3);
  assert.match(result.stdout, /EXPECTED_TARGET/);
  assert.match(result.stdout, /required/);
  assert.match(result.stdout, /Semantic evaluation allowed: \*\*false\*\*/);
  assert.doesNotMatch(result.stdout, /Gate results/);
});

test("structurally valid CLI input continues to the semantic rejection path", () => {
  const result = withInputFiles(valid.candidate, valid.expectedTarget, (candidatePath, targetPath) =>
    spawnSync(process.execPath, [
      LINTER_PATH,
      "--candidate", candidatePath,
      "--expected-target", targetPath,
      "--format", "json",
    ], { encoding: "utf8" }));
  assert.equal(result.status, 2);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.candidateSatisfiesPolicy, false);
  assert.equal(parsed.gates.find((gate) => gate.id === "CRYPTOGRAPHIC_ATTESTATION").result, "FAIL");
});

test("pure programmatic evaluator remains available without mandatory preflight", () => {
  const semantic = lintReviewerBundle(valid.candidate, valid.expectedTarget, receiptTemplate);
  assert.equal(semantic.summary.passedGateCount, "5");
  assert.equal(semantic.summary.failedGateCount, "1");
  assert.equal(semantic.candidateSatisfiesPolicy, false);
  const malformed = lintReviewerBundle(undefined, valid.expectedTarget, receiptTemplate);
  assert.equal(malformed.candidateSatisfiesPolicy, false);
  assert.equal(malformed.receiptIssued, false);
});

test("preflight source is local-read-only and every vector remains non-authoritative", () => {
  const source = readFileSync(PREFLIGHT_PATH, "utf8");
  assert.doesNotMatch(source, /\bwriteFile|\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(|\bfetch\s*\(|\bWebSocket\s*\(/);
  const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(imports, ["node:fs", "node:url", "./json-schema-subset.mjs"]);
  for (const scenario of bundle.vectors.scenarios) {
    assert.equal(scenario.result.semanticEvaluationRan, false, scenario.name);
    assert.equal(scenario.result.receiptIssued, false, scenario.name);
    assert.equal(scenario.result.reviewCompletedByThisPreflight, false, scenario.name);
    assert.equal(scenario.result.activationAuthorized, false, scenario.name);
    assert.equal(scenario.result.activationEffect, "NONE", scenario.name);
  }
});
