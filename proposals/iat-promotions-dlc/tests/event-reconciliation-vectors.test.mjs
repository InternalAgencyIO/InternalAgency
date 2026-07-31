/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReconciliationScenarioEvidence,
  generateEventReconciliationVectors,
  reconciliationMerkleRoot,
  RECONCILIATION_SCENARIOS,
} from "../generate-event-reconciliation-vectors.mjs";
import {
  loadEventReconciliationVectorBundle,
  validateEventReconciliationVectors,
} from "../validate-event-reconciliation-vectors.mjs";

const vectors = loadEventReconciliationVectorBundle();
const clone = (value) => structuredClone(value);

test("compact reconciliation vectors reproduce exactly and preserve every HOLD gate", () => {
  assert.deepEqual(validateEventReconciliationVectors(vectors), []);
  assert.deepEqual(generateEventReconciliationVectors(), vectors);
  assert.equal(vectors.status.network, "NONE");
  assert.equal(vectors.status.programId, null);
  assert.equal(vectors.status.deployable, false);
  assert.equal(vectors.status.reconciliationApplied, false);
});

test("all five public scenarios bind exact event, receipt, terminal, surplus, and verifier outcomes", () => {
  assert.deepEqual(vectors.scenarios.map((scenario) => scenario.name), RECONCILIATION_SCENARIOS);
  const byName = Object.fromEntries(vectors.scenarios.map((scenario) => [scenario.name, scenario]));
  assert.equal(byName.ACTIVE_TWO_PAIRS.result.campaign.completedPairs, "2");
  assert.equal(byName.CANCELLED_PRE_ACTIVATION.result.campaign.status, "CANCELLED");
  assert.equal(byName.EXHAUSTED_1000.result.campaign.completedPairs, "1000");
  assert.equal(byName.EXHAUSTED_1000.result.campaign.pendingNominationCountAtEnd, "1");
  assert.equal(byName.SURPLUS_FINALIZED.result.campaign.unattributedSurplusBaseUnits, "500");
  assert.equal(byName.SURPLUS_FINALIZED.result.campaign.surplusFinalized, true);
  assert.equal(byName.VERIFIER_DISABLED.result.verifierRegistries[0].status, "EMERGENCY_DISABLED");
  assert.equal(byName.VERIFIER_DISABLED.result.verifierRegistries[0].eventCount, "2");
});

test("record and receipt Merkle roots commit to order, content, cardinality, and empty sets", () => {
  const evidence = buildReconciliationScenarioEvidence("ACTIVE_TWO_PAIRS");
  const recordDomain = "iat-promotions-dlc-reconciliation-records-v1";
  const receiptDomain = "iat-promotions-dlc-reconciliation-receipts-v1";
  const recordRoot = reconciliationMerkleRoot(evidence.records, recordDomain);
  const receiptRoot = reconciliationMerkleRoot(evidence.snapshot.settlementReceipts, receiptDomain);
  const scenario = vectors.scenarios.find((candidate) => candidate.name === "ACTIVE_TWO_PAIRS");
  assert.equal(recordRoot, scenario.digests.recordMerkleRoot);
  assert.equal(receiptRoot, scenario.digests.receiptMerkleRoot);

  const changedRecord = clone(evidence.records);
  changedRecord[0].ordinal = "9";
  assert.notEqual(reconciliationMerkleRoot(changedRecord, recordDomain), recordRoot);
  assert.notEqual(reconciliationMerkleRoot([...evidence.records].reverse(), recordDomain), recordRoot);
  const changedReceipt = clone(evidence.snapshot.settlementReceipts);
  changedReceipt[0].hero_wallet = "0".repeat(64);
  assert.notEqual(reconciliationMerkleRoot(changedReceipt, receiptDomain), receiptRoot);

  const cancelled = vectors.scenarios.find((candidate) => candidate.name === "CANCELLED_PRE_ACTIVATION");
  assert.equal(reconciliationMerkleRoot([], receiptDomain), cancelled.digests.receiptMerkleRoot);
});

test("source, scenario, digest, result, and deployment mutations cannot pass validation", () => {
  const mutated = clone(vectors);
  mutated.status.network = "mainnet-beta";
  mutated.status.programId = "f".repeat(64);
  mutated.status.deployable = true;
  mutated.status.reconciliationApplied = true;
  mutated.sources.reconciler.normalizedTextSha256 = "0".repeat(64);
  mutated.scenarios[0].name = "UNKNOWN";
  mutated.scenarios[1].digests.evidenceCanonicalSha256 = "1".repeat(64);
  mutated.scenarios[2].result.campaign.completedPairs = "999";
  const errors = validateEventReconciliationVectors(mutated);
  assert.ok(errors.includes("reconciliation vectors must remain network-free"));
  assert.ok(errors.includes("reconciliation vectors must not claim a program ID"));
  assert.ok(errors.includes("reconciliation vectors must remain undeployable"));
  assert.ok(errors.includes("reconciliation vectors must remain unapplied"));
  assert.ok(errors.includes("reconciliation vectors differ from deterministic generation"));
  assert.ok(errors.includes("reconciliation scenario set or order drift"));
  assert.ok(errors.includes("unknown reconciliation scenario: UNKNOWN"));
  assert.ok(errors.includes("EXHAUSTED_1000 pair count drift"));
  assert.ok(errors.includes("reconciliation source binding drift: reconciler"));
});

test("raw identity, signatures, full event bytes, snapshots, and receipt bodies remain absent", () => {
  const leaked = clone(vectors);
  leaked.raw_x_user_id = "not-public";
  leaked.scenarios[0].bytes_hex = "00";
  leaked.scenarios[1].snapshot = {};
  leaked.scenarios[2].settlementReceipts = [];
  leaked.scenarios[3].signature = "not-a-signature";
  const errors = validateEventReconciliationVectors(leaked);
  assert.ok(errors.some((error) => error.startsWith("compact reconciliation artifact leaks evidence fields:")));
  const publishedKeys = JSON.stringify(vectors);
  for (const forbidden of ["raw_x_user_id", "x_handle", "bytes_hex", "settlementReceipts", "signature"]) {
    assert.equal(publishedKeys.includes(forbidden), false, forbidden);
  }
});
