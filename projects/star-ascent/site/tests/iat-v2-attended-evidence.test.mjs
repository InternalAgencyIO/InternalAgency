import assert from "node:assert/strict";
import test from "node:test";
import {
  IAT_V2_ATTENDED_RECEIPT_SET_SCHEMA,
  IAT_V2_COMPLETE_BUNDLE_SCHEMA,
  assertCanonicalAttendedNextAction,
  assertCanonicalAttendedNextActionFromReceiptSet,
  attendedReceiptStorageKey,
  buildCompleteAttendedBundle,
  canonicalAttendedActionClassification,
  canonicalAttendedNextActionPolicy,
  canonicalAttendedReceipt,
  canonicalReceiptSet,
  clearAttendedReceipts,
  completeAttendedRoster,
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
  assert.throws(
    () => attendedReceiptStorageKey({ ...expectedBinding, mint: "1" }),
    /exact 32-byte Devnet mint/u,
  );
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
  const idempotent = persistAttendedReceipt(
    target,
    expectedBinding,
    receipt("EXTEND_PROGRAM_DATA", "program", null, 2),
  );
  assert.deepEqual(idempotent, preserved);
  assert.throws(
    () => persistAttendedReceipt(
      target,
      expectedBinding,
      receipt("EXTEND_PROGRAM_DATA", "program", null, 3),
    ),
    /already recorded with different evidence/u,
  );
  assert.deepEqual(
    loadAttendedReceiptSet(target, expectedBinding).receipts.map(({ action }) => action),
    ["UPGRADE_PROGRAM", "EXTEND_PROGRAM_DATA"],
  );
  clearAttendedReceipts(target, expectedBinding);
  assert.equal(loadAttendedReceiptSet(target, expectedBinding).receipts.length, 0);
});

test("source-bound receipt persistence fails closed when storage is not durable", () => {
  const target = {
    getItem: () => null,
    setItem: () => {},
  };
  assert.throws(
    () => persistAttendedReceipt(
      target,
      expectedBinding,
      receipt("UPGRADE_PROGRAM", "program"),
      { preUpgradeProgramDataCapacityBytes: 400_000 },
    ),
    /storage is unavailable or non-durable/u,
  );
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

  const noFreshRandomness = completeFixture();
  noFreshRandomness.featureExport.transactions = noFreshRandomness.featureExport.transactions
    .filter((entry) => entry.action !== "CREATE_SWITCHBOARD_RANDOMNESS");
  assert.throws(() => buildCompleteAttendedBundle({
    ...noFreshRandomness,
    expectedBinding,
    programId,
    participant,
  }), /missing mandatory receipt CREATE_SWITCHBOARD_RANDOMNESS/u);
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

test("complete aggregate rejects every extra receipt instead of silently dropping it", () => {
  const hostile = [
    ["RETURN_BUFFER_AUTHORITY_TO_DEPLOYER", "program", null, "receipt-set"],
    ["MIGRATE_LEGACY_ROUND_WEEK_6", "migration", 6, "receipt-set"],
    ["BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_11", "neutral-backfill", 11, "receipt-set"],
    ["REGISTER_AGENCY_0", "feature", null, "feature-export"],
    ["SETTLE_STANDARD_POSITION_WEEK_9", "feature", 9, "feature-export"],
    ["COMMIT_CCC_ROUND_10", "feature", 10, "feature-export"],
  ];
  hostile.forEach(([action, kind, week, location], index) => {
    const fixture = completeFixture();
    const extra = receipt(action, kind, week, 30 + index);
    if (location === "receipt-set") {
      const [current] = fixture.receiptSets;
      fixture.receiptSets = [canonicalReceiptSet({
        ...expectedBinding,
        preUpgradeProgramDataCapacityBytes: current.preUpgradeProgramDataCapacityBytes,
        receipts: [...current.receipts, extra],
      })];
    } else {
      fixture.featureExport = {
        ...fixture.featureExport,
        transactions: [...fixture.featureExport.transactions, extra],
      };
    }
    assert.throws(() => buildCompleteAttendedBundle({
      ...fixture,
      expectedBinding,
      programId,
      participant,
    }), new RegExp(`out-of-roster receipt ${action}`, "u"));
  });
});

test("canonical next-action policy follows the mandatory fresh-randomness 17-prompt roster exactly", () => {
  const roster = completeAttendedRoster({
    programDataExtensionRequired: true,
    cccRound11TerminalAction: "EXPIRE_CCC_ROUND_11",
  });
  assert.equal(roster.length, 17);
  for (let index = 0; index < roster.length; index += 1) {
    const policy = assertCanonicalAttendedNextAction({
      completedActions: roster.slice(0, index),
      programDataExtensionRequired: true,
      nextAction: roster[index],
    });
    assert.equal(policy.completedActionCount, index);
    assert.equal(policy.totalActionCount, 17);
    assert.equal(policy.switchboardRandomnessCreationRequired, true);
  }
  const complete = canonicalAttendedNextActionPolicy({
    completedActions: roster,
    programDataExtensionRequired: true,
  });
  assert.equal(complete.complete, true);
  assert.equal(complete.totalActionCount, 17);
  assert.deepEqual(complete.allowedNextActions, []);
});

test("canonical next-action policy requires fresh randomness and resolves only the terminal choice", () => {
  assert.throws(() => completeAttendedRoster({
    programDataExtensionRequired: true,
    switchboardRandomnessCreationRequired: false,
    cccRound11TerminalAction: "REVEAL_CCC_ROUND_11",
  }), /Fresh Switchboard randomness creation is mandatory/u);
  assert.throws(() => canonicalAttendedNextActionPolicy({
    completedActions: [],
    programDataExtensionRequired: true,
    switchboardRandomnessCreationRequired: false,
  }), /Fresh Switchboard randomness creation is mandatory/u);

  const roster = completeAttendedRoster({
    programDataExtensionRequired: true,
    cccRound11TerminalAction: "REVEAL_CCC_ROUND_11",
  });
  const createIndex = roster.indexOf("CREATE_SWITCHBOARD_RANDOMNESS");
  const beforeRandomness = roster.slice(0, createIndex);
  const randomness = canonicalAttendedNextActionPolicy({
    completedActions: beforeRandomness,
    programDataExtensionRequired: true,
  });
  assert.equal(randomness.expectedAction, "CREATE_SWITCHBOARD_RANDOMNESS");
  assert.deepEqual(randomness.allowedNextActions, ["CREATE_SWITCHBOARD_RANDOMNESS"]);
  assert.doesNotThrow(() => assertCanonicalAttendedNextAction({
    completedActions: beforeRandomness,
    programDataExtensionRequired: true,
    nextAction: "CREATE_SWITCHBOARD_RANDOMNESS",
  }));
  assert.throws(() => assertCanonicalAttendedNextAction({
    completedActions: beforeRandomness,
    programDataExtensionRequired: true,
    nextAction: "COMMIT_CCC_ROUND_11",
  }), /expected CREATE_SWITCHBOARD_RANDOMNESS/u);

  const commitIndex = roster.indexOf("COMMIT_CCC_ROUND_11");
  const throughCommit = roster.slice(0, commitIndex + 1);
  const terminal = canonicalAttendedNextActionPolicy({
    completedActions: throughCommit,
    programDataExtensionRequired: true,
  });
  assert.deepEqual(terminal.allowedNextActions, [
    "REVEAL_CCC_ROUND_11",
    "EXPIRE_CCC_ROUND_11",
  ]);
  assert.doesNotThrow(() => assertCanonicalAttendedNextAction({
    completedActions: throughCommit,
    programDataExtensionRequired: true,
    nextAction: "EXPIRE_CCC_ROUND_11",
  }));
});

test("canonical next-action receipt-set bridge preserves exact bound order and rejects hostile progress", () => {
  const receiptSet = (actions, nonceFloor = 1, bindingOverride = expectedBinding) => canonicalReceiptSet({
    ...bindingOverride,
    preUpgradeProgramDataCapacityBytes: 400_000,
    receipts: actions.map((action, index) => {
      const { kind, week } = canonicalAttendedActionClassification(action);
      return receipt(action, kind, week, nonceFloor + index);
    }),
  });
  const validPrefix = [
    "EXTEND_PROGRAM_DATA",
    "UPGRADE_PROGRAM",
    "MIGRATE_LEGACY_ROUND_WEEK_7",
  ];
  const bridged = assertCanonicalAttendedNextActionFromReceiptSet({
    receiptSet: receiptSet(validPrefix),
    expectedBinding,
    programDataExtensionRequired: true,
    nextAction: "MIGRATE_LEGACY_ROUND_WEEK_8",
  });
  assert.deepEqual(bridged.completedActions, validPrefix);
  assert.equal(bridged.policy.expectedAction, "MIGRATE_LEGACY_ROUND_WEEK_8");

  assert.throws(() => assertCanonicalAttendedNextActionFromReceiptSet({
    receiptSet: receiptSet([
      "EXTEND_PROGRAM_DATA",
      "MIGRATE_LEGACY_ROUND_WEEK_7",
      "UPGRADE_PROGRAM",
    ], 10),
    expectedBinding,
    programDataExtensionRequired: true,
    nextAction: "MIGRATE_LEGACY_ROUND_WEEK_8",
  }), /expected UPGRADE_PROGRAM at index 1/u);

  assert.throws(() => assertCanonicalAttendedNextActionFromReceiptSet({
    receiptSet: receiptSet([
      "EXTEND_PROGRAM_DATA",
      "UPGRADE_PROGRAM",
      "RETURN_BUFFER_AUTHORITY_TO_DEPLOYER",
    ], 20),
    expectedBinding,
    programDataExtensionRequired: true,
    nextAction: "MIGRATE_LEGACY_ROUND_WEEK_7",
  }), /out-of-roster receipt RETURN_BUFFER_AUTHORITY_TO_DEPLOYER/u);

  assert.throws(() => assertCanonicalAttendedNextActionFromReceiptSet({
    receiptSet: receiptSet(validPrefix, 30, { ...expectedBinding, sourceCommit: "c".repeat(40) }),
    expectedBinding,
    programDataExtensionRequired: true,
    nextAction: "MIGRATE_LEGACY_ROUND_WEEK_8",
  }), /source commit drifted/u);
});

test("canonical next-action policy rejects recovery, arbitrary weeks, skips, repeats, and post-completion actions", () => {
  const prefix = ["EXTEND_PROGRAM_DATA", "UPGRADE_PROGRAM"];
  for (const nextAction of [
    "RETURN_BUFFER_AUTHORITY_TO_DEPLOYER",
    "MIGRATE_LEGACY_ROUND_WEEK_6",
    "REGISTER_AGENCY_0",
    "SETTLE_STANDARD_POSITION_WEEK_9",
  ]) {
    assert.throws(() => assertCanonicalAttendedNextAction({
      completedActions: prefix,
      programDataExtensionRequired: true,
      nextAction,
    }), /Canonical attended roster expected MIGRATE_LEGACY_ROUND_WEEK_7/u);
  }
  assert.throws(() => canonicalAttendedNextActionPolicy({
    completedActions: ["UPGRADE_PROGRAM"],
    programDataExtensionRequired: true,
  }), /expected EXTEND_PROGRAM_DATA at index 0/u);
  assert.throws(() => canonicalAttendedNextActionPolicy({
    completedActions: ["EXTEND_PROGRAM_DATA", "EXTEND_PROGRAM_DATA"],
    programDataExtensionRequired: true,
  }), /repeats an action/u);

  const roster = completeAttendedRoster({
    programDataExtensionRequired: true,
    switchboardRandomnessCreationRequired: true,
    cccRound11TerminalAction: "REVEAL_CCC_ROUND_11",
  });
  assert.throws(() => assertCanonicalAttendedNextAction({
    completedActions: roster,
    programDataExtensionRequired: true,
    switchboardRandomnessCreationRequired: true,
    nextAction: "SETTLE_LINKED_POSITION_3_WEEK_11",
  }), /roster is already complete/u);
  assert.throws(() => canonicalAttendedNextActionPolicy({
    completedActions: [
      ...roster.slice(0, roster.indexOf("REVEAL_CCC_ROUND_11") + 1),
      "EXPIRE_CCC_ROUND_11",
    ],
    programDataExtensionRequired: true,
    switchboardRandomnessCreationRequired: true,
  }), /expected SETTLE_LINKED_POSITION_2_WEEK_11/u);
});
