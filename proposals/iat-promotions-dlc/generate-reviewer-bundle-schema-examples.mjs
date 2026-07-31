/**
 * Deterministic structural examples for the offline reviewer-bundle schemas.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { lintReviewerBundle } from "./reviewer-bundle-linter.mjs";

const CANDIDATE_SCHEMA_PATH = fileURLToPath(new URL("./reviewer-candidate.schema.v1.json", import.meta.url));
const TARGET_SCHEMA_PATH = fileURLToPath(new URL("./reviewer-expected-target.schema.v1.json", import.meta.url));
const RESULT_SCHEMA_PATH = fileURLToPath(new URL("./reviewer-lint-result.schema.v1.json", import.meta.url));
const VECTOR_PATH = fileURLToPath(
  new URL("./independent-review-receipt-acceptance-vectors.v1.json", import.meta.url),
);
const TEMPLATE_PATH = fileURLToPath(new URL("./independent-review-receipt-template.v1.json", import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL("./reviewer-bundle-schema-examples.v1.json", import.meta.url));
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));

export function generateReviewerBundleSchemaExamples() {
  const candidateSchema = parse(CANDIDATE_SCHEMA_PATH);
  const expectedTargetSchema = parse(TARGET_SCHEMA_PATH);
  const lintResultSchema = parse(RESULT_SCHEMA_PATH);
  const vectors = parse(VECTOR_PATH);
  const receiptTemplate = parse(TEMPLATE_PATH);
  const scenario = vectors.scenarios.find((entry) => entry.name === "UNRELATED_SIGNATURE_ONLY");
  if (!scenario) throw new Error("public rejection-only review candidate is missing");
  const lintResult = lintReviewerBundle(scenario.candidate, scenario.expectedTarget, receiptTemplate);

  return {
    corpusVersion: 1,
    corpusId: "iat-promotions-dlc-reviewer-bundle-schema-examples-v1",
    status: {
      labels: ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"],
      network: "NONE",
      programId: null,
      deployable: false,
      schemaApplied: false,
      acceptedReceiptPublished: false,
      activationAuthorized: false,
    },
    sources: {
      candidateSchema: {
        path: "reviewer-candidate.schema.v1.json",
        canonicalSha256: canonicalSha256(candidateSchema),
      },
      expectedTargetSchema: {
        path: "reviewer-expected-target.schema.v1.json",
        canonicalSha256: canonicalSha256(expectedTargetSchema),
      },
      lintResultSchema: {
        path: "reviewer-lint-result.schema.v1.json",
        canonicalSha256: canonicalSha256(lintResultSchema),
      },
    },
    contract: {
      structuralValidationIsNotSemanticAcceptance: true,
      expectedTargetAuthenticityMustBeEstablishedSeparately: true,
      publicExamplesAreRejectionOnly: true,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    validExamples: [
      { name: "PUBLIC_REJECTED_CANDIDATE", target: "CANDIDATE", value: scenario.candidate },
      { name: "PUBLIC_EXPECTED_TARGET", target: "EXPECTED_TARGET", value: scenario.expectedTarget },
      { name: "PUBLIC_REJECTED_LINT_RESULT", target: "LINT_RESULT", value: lintResult },
    ],
    invalidExamples: [
      {
        name: "CANDIDATE_EXTRA_FIELD",
        target: "CANDIDATE",
        base: "PUBLIC_REJECTED_CANDIDATE",
        mutation: { operation: "add", path: "/unexpected", value: true },
        expectedKeyword: "additionalProperties",
      },
      {
        name: "CANDIDATE_MISSING_TARGET",
        target: "CANDIDATE",
        base: "PUBLIC_REJECTED_CANDIDATE",
        mutation: { operation: "remove", path: "/target" },
        expectedKeyword: "required",
      },
      {
        name: "CANDIDATE_NUMERIC_FILE_COUNT",
        target: "CANDIDATE",
        base: "PUBLIC_REJECTED_CANDIDATE",
        mutation: { operation: "replace", path: "/target/coveredFileCount", value: 91 },
        expectedKeyword: "type",
      },
      {
        name: "CANDIDATE_MALFORMED_SIGNATURE",
        target: "CANDIDATE",
        base: "PUBLIC_REJECTED_CANDIDATE",
        mutation: { operation: "replace", path: "/attestation/signatureHex", value: "00" },
        expectedKeyword: "pattern",
      },
      {
        name: "CANDIDATE_ACTIVATION_CLAIM",
        target: "CANDIDATE",
        base: "PUBLIC_REJECTED_CANDIDATE",
        mutation: { operation: "replace", path: "/payload/activationAuthorized", value: true },
        expectedKeyword: "const",
      },
      {
        name: "CANDIDATE_SCOPE_OMISSION",
        target: "CANDIDATE",
        base: "PUBLIC_REJECTED_CANDIDATE",
        mutation: {
          operation: "replace",
          path: "/scope/reviewAreas",
          value: [
            "PROTOCOL_AND_ECONOMICS",
            "IDENTITY_AND_DEDUPLICATION",
            "ATOMIC_SETTLEMENT_AND_ROLLBACK",
            "VAULT_AND_AUTHORITY_ISOLATION",
            "VERIFIER_KEY_LIFECYCLE",
            "EVENT_ACCOUNT_RECONCILIATION",
            "CLIENT_ABI_AND_FIXED_BYTES"
          ]
        },
        expectedKeyword: "const",
      },
      {
        name: "EXPECTED_TARGET_EXTRA_FIELD",
        target: "EXPECTED_TARGET",
        base: "PUBLIC_EXPECTED_TARGET",
        mutation: { operation: "add", path: "/candidateSaysValid", value: true },
        expectedKeyword: "additionalProperties",
      },
      {
        name: "EXPECTED_TARGET_UPPERCASE_COMMIT",
        target: "EXPECTED_TARGET",
        base: "PUBLIC_EXPECTED_TARGET",
        mutation: { operation: "replace", path: "/gitCommitSha", value: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
        expectedKeyword: "pattern",
      },
      {
        name: "EXPECTED_TARGET_MISSING_ROOT",
        target: "EXPECTED_TARGET",
        base: "PUBLIC_EXPECTED_TARGET",
        mutation: { operation: "remove", path: "/reviewTreeRootSha256" },
        expectedKeyword: "required",
      },
      {
        name: "LINT_RELEASED_NETWORK",
        target: "LINT_RESULT",
        base: "PUBLIC_REJECTED_LINT_RESULT",
        mutation: { operation: "replace", path: "/status/network", value: "mainnet-beta" },
        expectedKeyword: "const",
      },
      {
        name: "LINT_RECEIPT_ISSUED",
        target: "LINT_RESULT",
        base: "PUBLIC_REJECTED_LINT_RESULT",
        mutation: { operation: "replace", path: "/receiptIssued", value: true },
        expectedKeyword: "const",
      },
      {
        name: "LINT_UNKNOWN_GATE_RESULT",
        target: "LINT_RESULT",
        base: "PUBLIC_REJECTED_LINT_RESULT",
        mutation: { operation: "replace", path: "/gates/0/result", value: "UNKNOWN" },
        expectedKeyword: "enum",
      },
      {
        name: "LINT_MISSING_INPUT_BINDING",
        target: "LINT_RESULT",
        base: "PUBLIC_REJECTED_LINT_RESULT",
        mutation: { operation: "remove", path: "/inputBindings/expectedTargetCanonicalSha256" },
        expectedKeyword: "required",
      },
      {
        name: "LINT_EXTRA_FIELD",
        target: "LINT_RESULT",
        base: "PUBLIC_REJECTED_LINT_RESULT",
        mutation: { operation: "add", path: "/activationTransaction", value: "none" },
        expectedKeyword: "additionalProperties",
      },
    ],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = `${JSON.stringify(generateReviewerBundleSchemaExamples(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote rejection-only reviewer schema examples; no receipt or signature was created.");
  } else {
    process.stdout.write(rendered);
  }
}
