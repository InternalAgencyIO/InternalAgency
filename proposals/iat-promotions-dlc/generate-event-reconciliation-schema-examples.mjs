/**
 * Deterministic synthetic JSON Schema examples for the Promotions DLC draft.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { reconcileEventEvidence } from "./event-reconciler.mjs";
import { buildReconciliationScenarioEvidence } from "./generate-event-reconciliation-vectors.mjs";

const EVIDENCE_SCHEMA_PATH = fileURLToPath(
  new URL("./event-reconciliation-evidence.schema.v1.json", import.meta.url),
);
const RESULT_SCHEMA_PATH = fileURLToPath(
  new URL("./event-reconciliation-result.schema.v1.json", import.meta.url),
);
const OUTPUT_PATH = fileURLToPath(
  new URL("./event-reconciliation-schema-examples.v1.json", import.meta.url),
);

const parse = (path) => JSON.parse(readFileSync(path, "utf8"));

export function generateEventReconciliationSchemaExamples() {
  const evidenceSchema = parse(EVIDENCE_SCHEMA_PATH);
  const resultSchema = parse(RESULT_SCHEMA_PATH);
  const cancelledEvidence = buildReconciliationScenarioEvidence("CANCELLED_PRE_ACTIVATION");
  const activeEvidence = buildReconciliationScenarioEvidence("ACTIVE_TWO_PAIRS");
  const disabledEvidence = buildReconciliationScenarioEvidence("VERIFIER_DISABLED");
  const activeResult = reconcileEventEvidence(activeEvidence);
  const disabledResult = reconcileEventEvidence(disabledEvidence);
  return {
    corpusVersion: 1,
    corpusId: "iat-promotions-dlc-reconciliation-schema-examples-v1",
    status: {
      labels: ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"],
      network: "NONE",
      programId: null,
      deployable: false,
      schemaApplied: false,
    },
    sources: {
      evidenceSchema: {
        path: "event-reconciliation-evidence.schema.v1.json",
        canonicalSha256: canonicalSha256(evidenceSchema),
      },
      resultSchema: {
        path: "event-reconciliation-result.schema.v1.json",
        canonicalSha256: canonicalSha256(resultSchema),
      },
    },
    validExamples: [
      { name: "CANCELLED_EVIDENCE", target: "EVIDENCE", value: cancelledEvidence },
      { name: "ACTIVE_TWO_PAIR_EVIDENCE", target: "EVIDENCE", value: activeEvidence },
      { name: "ACTIVE_RESULT", target: "RESULT", value: activeResult },
      { name: "VERIFIER_DISABLED_RESULT", target: "RESULT", value: disabledResult },
    ],
    invalidExamples: [
      {
        name: "NUMERIC_EVENT_ORDINAL",
        target: "EVIDENCE",
        base: "CANCELLED_EVIDENCE",
        mutation: { operation: "replace", path: "/records/0/ordinal", value: 0 },
        expectedKeyword: "type",
      },
      {
        name: "ODD_LENGTH_EVENT_BYTES",
        target: "EVIDENCE",
        base: "CANCELLED_EVIDENCE",
        mutation: { operation: "replace", path: "/records/0/bytes_hex", value: "0" },
        expectedKeyword: "pattern",
      },
      {
        name: "UNKNOWN_CAMPAIGN_STATUS",
        target: "EVIDENCE",
        base: "ACTIVE_TWO_PAIR_EVIDENCE",
        mutation: { operation: "replace", path: "/snapshot/campaign/status", value: "UNKNOWN" },
        expectedKeyword: "enum",
      },
      {
        name: "EXTRA_CAMPAIGN_FIELD",
        target: "EVIDENCE",
        base: "CANCELLED_EVIDENCE",
        mutation: { operation: "add", path: "/snapshot/campaign/unexpected_field", value: "0" },
        expectedKeyword: "additionalProperties",
      },
      {
        name: "MISSING_VAULT_ADDRESS",
        target: "EVIDENCE",
        base: "CANCELLED_EVIDENCE",
        mutation: { operation: "remove", path: "/snapshot/promotionVault/address" },
        expectedKeyword: "required",
      },
      {
        name: "RELEASED_RESULT_NETWORK",
        target: "RESULT",
        base: "ACTIVE_RESULT",
        mutation: { operation: "replace", path: "/status/network", value: "mainnet-beta" },
        expectedKeyword: "const",
      },
      {
        name: "NUMERIC_RESULT_EVENT_COUNT",
        target: "RESULT",
        base: "ACTIVE_RESULT",
        mutation: { operation: "replace", path: "/eventCount", value: 8 },
        expectedKeyword: "type",
      },
      {
        name: "EXTRA_RESULT_FIELD",
        target: "RESULT",
        base: "VERIFIER_DISABLED_RESULT",
        mutation: { operation: "add", path: "/unexpected_field", value: true },
        expectedKeyword: "additionalProperties",
      },
      {
        name: "RESULT_AUTHORITY_ESCALATION",
        target: "RESULT",
        base: "ACTIVE_RESULT",
        mutation: {
          operation: "replace",
          path: "/eventStreamAuthorizedNoStateChange",
          value: false
        },
        expectedKeyword: "const",
      }
    ],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = `${JSON.stringify(generateEventReconciliationSchemaExamples(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote synthetic reconciliation schema examples; no network or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}
