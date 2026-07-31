/**
 * Compact reconciliation-vector validator.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  generateEventReconciliationVectors,
  RECONCILIATION_SCENARIOS,
} from "./generate-event-reconciliation-vectors.mjs";

const VECTOR_PATH = fileURLToPath(
  new URL("./event-reconciliation-vectors.v1.json", import.meta.url),
);

const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const DIGEST_KEYS = [
  "evidenceCanonicalSha256",
  "recordsCanonicalSha256",
  "snapshotCanonicalSha256",
  "recordMerkleRoot",
  "receiptMerkleRoot",
  "resultCanonicalSha256",
];
const EXPECTED_SCENARIOS = Object.freeze({
  ACTIVE_TWO_PAIRS: { events: "8", receipts: "2", status: "ACTIVE", pairs: "2" },
  CANCELLED_PRE_ACTIVATION: { events: "3", receipts: "0", status: "CANCELLED", pairs: "0" },
  EXHAUSTED_1000: { events: "2006", receipts: "1000", status: "EXHAUSTED", pairs: "1000" },
  SURPLUS_FINALIZED: { events: "2006", receipts: "1000", status: "EXHAUSTED", pairs: "1000" },
  VERIFIER_DISABLED: { events: "9", receipts: "2", status: "ACTIVE", pairs: "2" },
});

export function loadEventReconciliationVectorBundle() {
  return JSON.parse(readFileSync(VECTOR_PATH, "utf8"));
}

function walkKeys(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkKeys(item, visitor));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      visitor(key);
      walkKeys(child, visitor);
    }
  }
}

export function validateEventReconciliationVectors(vectors = loadEventReconciliationVectorBundle()) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(vectors?.vectorVersion === 1, "reconciliation vector version must equal one");
  expect(vectors?.status?.network === "NONE", "reconciliation vectors must remain network-free");
  expect(vectors?.status?.programId === null, "reconciliation vectors must not claim a program ID");
  expect(vectors?.status?.deployable === false, "reconciliation vectors must remain undeployable");
  expect(vectors?.status?.reconciliationApplied === false, "reconciliation vectors must remain unapplied");
  expect(
    JSON.stringify(vectors?.status?.labels) === JSON.stringify(HOLD_LABELS),
    "reconciliation vector HOLD labels drift",
  );
  let expected = null;
  try {
    expected = generateEventReconciliationVectors();
    expect(
      JSON.stringify(vectors) === JSON.stringify(expected),
      "reconciliation vectors differ from deterministic generation",
    );
  } catch (error) {
    errors.push(`deterministic reconciliation generation failed: ${error.message}`);
  }
  expect(
    JSON.stringify(vectors?.scenarios?.map((scenario) => scenario.name)) ===
      JSON.stringify(RECONCILIATION_SCENARIOS),
    "reconciliation scenario set or order drift",
  );
  expect(vectors?.digestContract?.hash === "SHA-256", "reconciliation digest algorithm drift");
  expect(vectors?.digestContract?.oddNode === "duplicate final node", "reconciliation odd-node rule drift");
  for (const scenario of vectors?.scenarios ?? []) {
    const contract = EXPECTED_SCENARIOS[scenario.name];
    if (!contract) {
      errors.push(`unknown reconciliation scenario: ${scenario.name}`);
      continue;
    }
    expect(scenario.eventRecordCount === contract.events, `${scenario.name} event count drift`);
    expect(scenario.settlementReceiptCount === contract.receipts, `${scenario.name} receipt count drift`);
    expect(scenario.result?.eventCount === contract.events, `${scenario.name} result event count drift`);
    expect(scenario.result?.campaign?.status === contract.status, `${scenario.name} campaign status drift`);
    expect(scenario.result?.campaign?.completedPairs === contract.pairs, `${scenario.name} pair count drift`);
    expect(
      scenario.result?.accountsAndReceiptsRemainAuthoritative === true,
      `${scenario.name} authority boundary drift`,
    );
    expect(
      scenario.result?.eventStreamAuthorizedNoStateChange === true,
      `${scenario.name} event authority drift`,
    );
    for (const digestKey of DIGEST_KEYS) {
      expect(
        typeof scenario.digests?.[digestKey] === "string" &&
          /^[0-9a-f]{64}$/.test(scenario.digests[digestKey]),
        `${scenario.name} ${digestKey} malformed`,
      );
    }
  }
  const forbiddenKeys = [];
  walkKeys(vectors, (key) => {
    if (/raw_x|x_user_id|x_handle|oauth|secret|private_key|signature/i.test(key)) {
      forbiddenKeys.push(key);
    }
    if (["records", "bytes_hex", "snapshot", "settlementReceipts"].includes(key)) {
      forbiddenKeys.push(key);
    }
  });
  expect(forbiddenKeys.length === 0, `compact reconciliation artifact leaks evidence fields: ${forbiddenKeys.join(",")}`);
  if (expected) {
    for (const sourceName of ["reconciliationPolicy", "eventInterface", "reconciler", "generator"]) {
      expect(
        JSON.stringify(vectors?.sources?.[sourceName]) === JSON.stringify(expected.sources[sourceName]),
        `reconciliation source binding drift: ${sourceName}`,
      );
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateEventReconciliationVectors();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Compact reconciliation vectors reproduce and remain held, private-safe evidence digests.");
  }
}
