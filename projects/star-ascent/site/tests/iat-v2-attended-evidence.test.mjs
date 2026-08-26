import assert from "node:assert/strict";
import test from "node:test";
import {
  IAT_V2_ATTENDED_RECEIPT_SET_SCHEMA,
  IAT_V2_COMPLETE_BUNDLE_SCHEMA,
  attendedReceiptStorageKey,
  buildCompleteAttendedBundle,
  canonicalAttendedActionClassification,
  canonicalAttendedReceipt,
  canonicalReceiptSet,
  clearAttendedReceipts,
  loadAttendedReceiptSet,
  persistAttendedReceipt,
} from "../tools/iat-v2-admin-console/attended-evidence.mjs";

const expectedBinding = Object.freeze({
  sourceCommit: "a".repeat(40),
  programArtifactSha256: "b".repeat(64),
  mint: "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH",
});
const programId = "11111111111111111111111111111111";
const participant = expectedBinding.mint;
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
};

function receipt(action, kind, week = null, nonce = 1) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const signature = `${"1".repeat(63)}${alphabet[nonce % alphabet.length]}`;
  return canonicalAttendedReceipt({
    action,
    title: action.replaceAll("_", " "),
    signature,
    messageSha256: nonce.toString(16).padStart(64, "0"),
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    finalizedAtUtc: `2026-08-26T12:${String(nonce).padStart(2, "0")}:00.000Z`,
    kind,
    week,
  });
}

const programActions = [
  ["EXTEND_PROGRAM_DATA", null],
  ["UPGRADE_PROGRAM", null],
];
const migrationActions = [
  ["MIGRATE_LEGACY_ROUND_WEEK_7", "migration", 7],
  ["MIGRATE_LEGACY_ROUND_WEEK_8", "migration", 8],
  ["BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_9", "neutral-backfill", 9],
  ["BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_10", "neutral-backfill", 10],
];
const featureActions = [
  ["SETTLE_STANDARD_POSITION_WEEK_10", 10],
  ["SETTLE_STANDARD_POSITION_WEEK_11", 11],
  ["SETTLE_LINKED_POSITION_2_WEEK_9", 9],
  ["SETTLE_LINKED_POSITION_2_WEEK_10", 10],
  ["SETTLE_LINKED_POSITION_3_WEEK_9", 9],
  ["SETTLE_LINKED_POSITION_3_WEEK_10", 10],
  ["CREATE_SWITCHBOARD_RANDOMNESS", null],
  ["COMMIT_CCC_ROUND_11", 11],
  ["EXPIRE_CCC_ROUND_11", 11],
  ["SETTLE_LINKED_POSITION_2_WEEK_11", 11],
  ["SETTLE_LINKED_POSITION_3_WEEK_11", 11],
];

function completeFixture() {
  let nonce = 1;
  const programReceipts = programActions.map(([action, week]) => receipt(action, "program", week, nonce++));
  const migrationReceipts = migrationActions.map(([action, kind, week]) => receipt(action, kind, week, nonce++));
  const featureReceipts = featureActions.map(([action, week]) => receipt(action, "feature", week, nonce++));
  return {
    receiptSets: [canonicalReceiptSet({
      ...expectedBinding,
      preUpgradeProgramDataCapacityBytes: 400_000,
      receipts: [...programReceipts, ...migrationReceipts],
    })],
    featureExport: {
      schema: "iat-v2-devnet-on-chain-feature-rehearsal-evidence/v1",
      network: "devnet",
      rpc: "https://api.devnet.solana.com",
      programId,
      mint: expectedBinding.mint,
      participant,
      transactions: featureReceipts,
    },
  };
}

test("source/artifact/mint-bound receipt sets persist and clear exact canonical records", () => {
  const target = storage();
  assert.match(attendedReceiptStorageKey(expectedBinding), /\/v1$/u);
  const next = persistAttendedReceipt(
    target,
    expectedBinding,
    receipt("UPGRADE_PROGRAM", "program"),
    { preUpgradeProgramDataCapacityBytes: 400_000 },
  );
  assert.equal(next.schema, IAT_V2_ATTENDED_RECEIPT_SET_SCHEMA);
  assert.deepEqual(Object.keys(next.receipts[0]), [
    "action", "title", "signature", "messageSha256", "explorerUrl", "finalizedAtUtc", "kind", "week",
  ]);
  assert.deepEqual(loadAttendedReceiptSet(target, expectedBinding), next);
  const preserved = persistAttendedReceipt(
    target,
    expectedBinding,
    receipt("EXTEND_PROGRAM_DATA", "program", null, 2),
    { preUpgradeProgramDataCapacityBytes: 500_000 },
  );
  assert.equal(preserved.preUpgradeProgramDataCapacityBytes, 400_000);
  clearAttendedReceipts(target, expectedBinding);
  assert.equal(loadAttendedReceiptSet(target, expectedBinding).receipts.length, 0);
});

test("canonical receipts reject misleading week and confirmation labels", () => {
  assert.throws(() => canonicalAttendedReceipt({
    ...receipt("MIGRATE_LEGACY_ROUND_WEEK_7", "migration", 7),
    week: 8,
  }), /action\/kind\/week mismatch/u);
  const valid = receipt("SETTLE_STANDARD_POSITION_WEEK_11", "feature", 11);
  assert.equal(Object.hasOwn(valid, "confirmedAtUtc"), false);
  assert.equal(Object.hasOwn(valid, "finalizedAtUtc"), true);
  assert.deepEqual(canonicalAttendedActionClassification("BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_10"), {
    kind: "neutral-backfill",
    week: 10,
  });
  assert.throws(
    () => canonicalAttendedReceipt({ ...valid, kind: "migration" }),
    /action\/kind\/week mismatch/u,
  );
  assert.throws(
    () => canonicalAttendedActionClassification(`COMMIT_CCC_ROUND_${"9".repeat(40)}`),
    /action week is unsafe/u,
  );
  assert.throws(
    () => canonicalAttendedReceipt({ ...valid, signature: "1", explorerUrl: "https://explorer.solana.com/tx/1?cluster=devnet" }),
    /exact Solana signature/u,
  );
});

test("complete aggregate is exact, ordered, and never fabricates a missing receipt", () => {
  const fixture = completeFixture();
  const bundle = buildCompleteAttendedBundle({
    ...fixture,
    expectedBinding,
    programId,
    participant,
    exportedAtUtc: "2026-08-26T13:00:00.000Z",
  });
  assert.equal(bundle.schema, IAT_V2_COMPLETE_BUNDLE_SCHEMA);
  assert.deepEqual(Object.keys(bundle), [
    "schema", "status", "rosterVersion", "sourceCommit", "programArtifactSha256",
    "network", "rpc", "programId", "mint", "participant", "conditions", "transactions",
    "exportedAtUtc", "mainnetStatus", "automatedDirectEvidenceRequired", "humanReviewerRequired",
    "noSelfAttestation", "secretMaterialIncluded",
  ]);
  assert.deepEqual(Object.keys(bundle.conditions), [
    "programDataExtensionRequired", "preUpgradeProgramDataCapacityBytes",
    "switchboardRandomnessCreationRequired", "cccRound11TerminalAction",
  ]);
  assert.equal(bundle.transactions[0].action, "EXTEND_PROGRAM_DATA");
  assert.equal(bundle.transactions.at(-1).action, "SETTLE_LINKED_POSITION_3_WEEK_11");
  assert.ok(bundle.transactions.every((entry) => Object.hasOwn(entry, "finalizedAtUtc")));

  fixture.featureExport.transactions = fixture.featureExport.transactions
    .filter((entry) => entry.action !== "SETTLE_STANDARD_POSITION_WEEK_11");
  assert.throws(() => buildCompleteAttendedBundle({
    ...fixture,
    expectedBinding,
    programId,
    participant,
  }), /missing receipt SETTLE_STANDARD_POSITION_WEEK_11/u);
});

test("aggregate collapses identical imported/local records but rejects conflicts", () => {
  const fixture = completeFixture();
  assert.doesNotThrow(() => buildCompleteAttendedBundle({
    ...fixture,
    receiptSets: [fixture.receiptSets[0], fixture.receiptSets[0]],
    expectedBinding,
    programId,
    participant,
  }));
  const conflict = canonicalReceiptSet({
    ...expectedBinding,
    preUpgradeProgramDataCapacityBytes: 400_000,
    receipts: [receipt("UPGRADE_PROGRAM", "program", null, 59)],
  });
  assert.throws(() => buildCompleteAttendedBundle({
    ...fixture,
    receiptSets: [...fixture.receiptSets, conflict],
    expectedBinding,
    programId,
    participant,
  }), /conflict for action UPGRADE_PROGRAM/u);

  const reusedSignatureFeatureExport = {
    ...fixture.featureExport,
    transactions: fixture.featureExport.transactions.map((entry, index) => (
      index === 0 ? { ...entry, signature: fixture.receiptSets[0].receipts[0].signature,
        explorerUrl: fixture.receiptSets[0].receipts[0].explorerUrl } : entry
    )),
  };
  assert.throws(() => buildCompleteAttendedBundle({
    ...fixture,
    featureExport: reusedSignatureFeatureExport,
    expectedBinding,
    programId,
    participant,
  }), /reuse one transaction signature for multiple actions/u);
});
