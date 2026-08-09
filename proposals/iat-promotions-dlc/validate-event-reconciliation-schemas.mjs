/**
 * Draft-07 schema and synthetic-example validator.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateEventReconciliationSchemaExamples } from "./generate-event-reconciliation-schema-examples.mjs";
import { applyJsonPointerMutation, validateJsonSchemaSubset } from "./json-schema-subset.mjs";

const path = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const PATHS = Object.freeze({
  evidenceSchema: path("event-reconciliation-evidence.schema.v1.json"),
  resultSchema: path("event-reconciliation-result.schema.v1.json"),
  examples: path("event-reconciliation-schema-examples.v1.json"),
});
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

const parse = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

export function loadEventReconciliationSchemaBundle() {
  return {
    evidenceSchema: parse(PATHS.evidenceSchema),
    resultSchema: parse(PATHS.resultSchema),
    examples: parse(PATHS.examples),
  };
}

function walkSchema(node, pathName, visitor) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  visitor(node, pathName);
  for (const [key, value] of Object.entries(node)) {
    if (key === "x-iat-status") continue;
    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        value.forEach((item, index) => walkSchema(item, `${pathName}/${key}/${index}`, visitor));
      } else {
        walkSchema(value, `${pathName}/${key}`, visitor);
      }
    }
  }
}

function schemaStatusErrors(schema, name) {
  const errors = [];
  const status = schema?.["x-iat-status"];
  if (schema?.$schema !== "http://json-schema.org/draft-07/schema#") {
    errors.push(`${name} must use JSON Schema Draft-07`);
  }
  if (JSON.stringify(status?.labels) !== JSON.stringify(HOLD_LABELS)) {
    errors.push(`${name} HOLD labels drift`);
  }
  if (status?.network !== "NONE") errors.push(`${name} must remain network-free`);
  if (status?.programId !== null) errors.push(`${name} must not claim a program ID`);
  if (status?.deployable !== false) errors.push(`${name} must remain undeployable`);
  if (status?.schemaApplied !== false) errors.push(`${name} must remain unapplied`);
  if (!schema?.description?.includes("DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE")) {
    errors.push(`${name} public HOLD description missing`);
  }
  walkSchema(schema, "#", (node, nodePath) => {
    if (node.type === "object" && node.properties && node.additionalProperties !== false) {
      errors.push(`${name} open object schema at ${nodePath}`);
    }
  });
  return errors;
}

function findExample(examples, name) {
  return examples.validExamples.find((example) => example.name === name);
}

export function validateEventReconciliationSchemas(
  bundle = loadEventReconciliationSchemaBundle(),
) {
  const errors = [
    ...schemaStatusErrors(bundle.evidenceSchema, "evidence schema"),
    ...schemaStatusErrors(bundle.resultSchema, "result schema"),
  ];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const examples = bundle.examples;
  expect(examples?.status?.network === "NONE", "schema corpus must remain network-free");
  expect(examples?.status?.programId === null, "schema corpus must not claim a program ID");
  expect(examples?.status?.deployable === false, "schema corpus must remain undeployable");
  expect(examples?.status?.schemaApplied === false, "schema corpus must remain unapplied");
  expect(
    JSON.stringify(examples?.status?.labels) === JSON.stringify(HOLD_LABELS),
    "schema corpus HOLD labels drift",
  );
  expect(
    examples?.sources?.evidenceSchema?.canonicalSha256 === canonicalSha256(bundle.evidenceSchema),
    "evidence schema source digest mismatch",
  );
  expect(
    examples?.sources?.resultSchema?.canonicalSha256 === canonicalSha256(bundle.resultSchema),
    "result schema source digest mismatch",
  );
  let generated = null;
  try {
    generated = generateEventReconciliationSchemaExamples();
    expect(
      JSON.stringify(examples) === JSON.stringify(generated),
      "schema examples differ from deterministic generation",
    );
  } catch (error) {
    errors.push(`schema example generation failed: ${error.message}`);
  }
  for (const example of examples?.validExamples ?? []) {
    const schema = example.target === "EVIDENCE"
      ? bundle.evidenceSchema
      : example.target === "RESULT"
        ? bundle.resultSchema
        : null;
    if (!schema) {
      errors.push(`${example.name} has unknown schema target`);
      continue;
    }
    const validationErrors = validateJsonSchemaSubset(schema, example.value);
    if (validationErrors.length) {
      errors.push(`${example.name} valid example failed: ${validationErrors[0].keyword}`);
    }
  }
  for (const example of examples?.invalidExamples ?? []) {
    const base = findExample(examples, example.base);
    if (!base) {
      errors.push(`${example.name} base example missing`);
      continue;
    }
    const schema = example.target === "EVIDENCE"
      ? bundle.evidenceSchema
      : example.target === "RESULT"
        ? bundle.resultSchema
        : null;
    if (!schema) {
      errors.push(`${example.name} has unknown schema target`);
      continue;
    }
    try {
      const mutated = applyJsonPointerMutation(base.value, example.mutation);
      const validationErrors = validateJsonSchemaSubset(schema, mutated);
      if (!validationErrors.some((error) => error.keyword === example.expectedKeyword)) {
        errors.push(`${example.name} did not fail expected ${example.expectedKeyword}`);
      }
    } catch (error) {
      errors.push(`${example.name} mutation failed: ${error.message}`);
    }
  }
  expect(
    bundle.evidenceSchema?.definitions?.campaign?.properties?.maximum_budget_base_units?.const ===
      "180000000000000",
    "evidence schema budget contract drift",
  );
  expect(
    bundle.evidenceSchema?.definitions?.settlementReceipt?.properties?.hero_reward_base_units?.const ===
      "120000000000",
    "evidence schema hero reward drift",
  );
  expect(
    bundle.evidenceSchema?.definitions?.settlementReceipt?.properties?.proposer_reward_base_units?.const ===
      "60000000000",
    "evidence schema proposer reward drift",
  );
  expect(
    bundle.resultSchema?.properties?.accountsAndReceiptsRemainAuthoritative?.const === true,
    "result schema account authority drift",
  );
  expect(
    bundle.resultSchema?.properties?.eventStreamAuthorizedNoStateChange?.const === true,
    "result schema event authority drift",
  );
  const schemaText = JSON.stringify([bundle.evidenceSchema, bundle.resultSchema]);
  expect(!/raw_x_user_id|x_handle|oauth|private_key|secret_key|signature/i.test(schemaText), "schema exposes private identity or signing fields");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateEventReconciliationSchemas();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Reconciliation Draft-07 schemas and synthetic examples are strict, held, and reproducible.");
  }
}
