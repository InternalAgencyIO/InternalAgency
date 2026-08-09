/**
 * Offline structural preflight for reviewer candidate and expected-target files.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { validateJsonSchemaSubset } from "./json-schema-subset.mjs";

const CANDIDATE_SCHEMA_PATH = fileURLToPath(new URL("./reviewer-candidate.schema.v1.json", import.meta.url));
const TARGET_SCHEMA_PATH = fileURLToPath(new URL("./reviewer-expected-target.schema.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));

export function loadReviewerInputSchemas() {
  return {
    candidateSchema: parse(CANDIDATE_SCHEMA_PATH),
    expectedTargetSchema: parse(TARGET_SCHEMA_PATH),
  };
}

function documentResult(document, schema, value) {
  const errors = validateJsonSchemaSubset(schema, value);
  return {
    document,
    valid: errors.length === 0,
    errors,
  };
}

export function preflightReviewerInputs(candidate, expectedTarget, schemas = loadReviewerInputSchemas()) {
  const documents = [
    documentResult("CANDIDATE", schemas.candidateSchema, candidate),
    documentResult("EXPECTED_TARGET", schemas.expectedTargetSchema, expectedTarget),
  ];
  const structuralValid = documents.every((document) => document.valid);
  return {
    preflightVersion: 1,
    preflightId: "iat-promotions-dlc-reviewer-input-preflight-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      schemaApplied: false,
    },
    structuralValid,
    semanticEvaluationAllowed: structuralValid,
    semanticEvaluationRan: false,
    documents,
    receiptIssued: false,
    reviewCompletedByThisPreflight: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  };
}

function escapeTableCell(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

export function renderReviewerInputPreflight(preflight) {
  const errors = preflight.documents.flatMap((document) =>
    document.errors.map((error) => ({ ...error, document: document.document })),
  );
  const rows = errors.length
    ? errors.map((error) => [
      "|",
      escapeTableCell(error.document),
      "|",
      escapeTableCell(error.instancePath || "/"),
      "|",
      escapeTableCell(error.keyword),
      "|",
      escapeTableCell(error.message),
      "|",
    ].join(" "))
    : ["| — | — | — | No structural errors |"];
  return [
    "# Offline reviewer-input structural preflight",
    "",
    "> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**",
    "",
    `- Structural result: **${preflight.structuralValid ? "PASS" : "FAIL"}**`,
    `- Semantic evaluation allowed: **${preflight.semanticEvaluationAllowed}**`,
    `- Semantic evaluation ran: **${preflight.semanticEvaluationRan}**`,
    `- Receipt issued: **${preflight.receiptIssued}**`,
    `- Review completed by this preflight: **${preflight.reviewCompletedByThisPreflight}**`,
    `- Activation authorized: **${preflight.activationAuthorized}**`,
    `- Activation effect: **${preflight.activationEffect}**`,
    "",
    "## JSON Pointer diagnostics",
    "",
    "| Document | Instance pointer | Keyword | Message |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "Structural PASS permits the separate six-gate semantic evaluator to run; it",
    "does not establish target authenticity, accept a review, issue a receipt, or",
    "authorize activation.",
    "",
  ].join("\n");
}
