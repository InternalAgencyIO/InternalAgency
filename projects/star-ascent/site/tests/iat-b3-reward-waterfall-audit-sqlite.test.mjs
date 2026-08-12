import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  allocateRewardCapacity,
  createCccPrecommitRegistrySnapshot,
  sealRewardCapacityRound,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
import { buildRewardAllocatorProofBundle } from
  "../programs/iat_b3_reference/reward-allocator-proof-bundle.mjs";
import {
  REWARD_WATERFALL_AUDIT_SQLITE_DEFENSIVE_MODE_REQUIRED,
  REWARD_WATERFALL_AUDIT_SQLITE_STATUS,
  REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT,
  createRewardWaterfallAuditSqlite,
} from "../programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

const FUNDING_ROUND = 1_786_060_800n;
const LOCAL_0001_UTC = 1_786_050_060n;
const I64_MIN_MIDNIGHT = -9_223_372_036_854_720_000n;
const I64_MAX_MIDNIGHT = 9_223_372_036_854_720_000n;
const THIS_TEST = fileURLToPath(import.meta.url);
const schedule = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-waterfall-audit-testnet-1",
});
const openLaw = createDailyLawState({
  protocolHeight: 86_520n,
  schedule,
  currentDecision: createLockdownDecision({
    localDay: protocolLocalDay(LOCAL_0001_UTC),
    randomnessOutputHex: `${"00".repeat(31)}02`,
    schedule,
  }),
});
const hex = (value) => value.toString(16).padStart(64, "0");

function ledger(amount = 1_000n) {
  const lane = (unlocked) => ({ unlocked, reserved: 0n, paid: 0n, withdrawn: 0n });
  return { lanes: { treasury: lane(amount), ecosystem: lane(0n), liquidity: lane(0n) } };
}

function finalizedRound(round = FUNDING_ROUND, candidates = 2) {
  const obligations = Array.from({ length: candidates }, (_unused, index) => ({
    id: hex(index + 1),
    priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
    amount: BigInt(100 + index),
    fundingRoundAtUnixSeconds: round,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    chronology: {
      eligibleSequence: BigInt(index + 1),
      activitySequence: BigInt(index + 1),
      nodeSequence: BigInt(index + 1),
      immutableIdentity: `waterfall-audit-${index + 1}`,
      commitmentDigest: hex(index + 100),
    },
  }));
  const sealed = sealRewardCapacityRound({
    dailyLawState: openLaw,
    fundingRoundAtUnixSeconds: round,
    sealedAtUnixSeconds: round,
    obligations,
    ledgerSnapshot: ledger(),
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds: round,
      commitments: [],
    }),
  });
  return allocateRewardCapacity({ dailyLawState: openLaw, roundState: sealed }).roundState;
}

function proofInput(round = finalizedRound()) {
  return {
    roundState: round,
    cccRandomnessReveal: null,
    bundle: buildRewardAllocatorProofBundle({ roundState: round }),
  };
}

function fixture(t, label) {
  const directory = mkdtempSync(join(tmpdir(), `iat-b3-waterfall-audit-${label}-`));
  const databasePath = join(directory, "waterfall-audit.sqlite");
  const adapters = [];
  t.after(() => {
    for (const adapter of adapters) adapter.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory,
    databasePath,
    open(options = {}) {
      const adapter = createRewardWaterfallAuditSqlite({ databasePath, ...options });
      adapters.push(adapter);
      return adapter;
    },
  };
}

function runCrashChild() {
  const scenario = process.env.IAT_B3_WATERFALL_AUDIT_CRASH_SCENARIO;
  if (!scenario) return;
  const databasePath = process.env.IAT_B3_WATERFALL_AUDIT_CRASH_DATABASE;
  if (!databasePath) process.exit(85);
  const fault = scenario === "before-commit"
    ? REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.HARD_EXIT_AFTER_RECEIPT_INSERT
    : REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.HARD_EXIT_AFTER_DURABLE_COMMIT;
  const adapter = createRewardWaterfallAuditSqlite({ databasePath, testOnlyFault: fault });
  adapter.appendFinalizedRound(proofInput());
  process.exit(84);
}

runCrashChild();

test("adapter requires the pinned runtime's SQLite defensive-mode API", (t) => {
  const context = fixture(t, "defensive-mode");
  assert.equal(REWARD_WATERFALL_AUDIT_SQLITE_DEFENSIVE_MODE_REQUIRED, true);
  assert.equal(
    typeof DatabaseSync.prototype.enableDefensive === "function",
    true,
    "run this suite with the pinned Node 25.5.0 executable",
  );
  assert.equal(context.open().count(), 0);
});

test("durably replays a complete finalized round and exact contiguous proof set after reopen", (t) => {
  const context = fixture(t, "reopen");
  const input = proofInput();
  const adapter = context.open();
  const receipt = adapter.appendFinalizedRound(input);
  assert.equal(adapter.count(), 1);
  assert.equal(receipt.fundingRoundAtUnixSeconds, FUNDING_ROUND);
  assert.equal(receipt.receiptCount, 2);
  assert.equal(receipt.durableLocalReplayAuditVerified, true);
  assert.equal(receipt.runtimeAuthenticationVerified, false);
  assert.equal(receipt.rollbackProtectionVerified, false);
  assert.equal(receipt.activationReady, false);
  assert.equal(receipt.mainnetStatus, "HOLD");
  adapter.close();
  assert.equal(context.open().count(), 1);
});

test("zero-outcome finalized round is retained and replayed without invented receipt rows", (t) => {
  const context = fixture(t, "empty");
  const input = proofInput(finalizedRound(FUNDING_ROUND, 0));
  const receipt = context.open().appendFinalizedRound(input);
  assert.equal(receipt.receiptCount, 0);
  assert.equal(context.open().count(), 1);
});

test("canonical signed-i64 negative and near-boundary UTC rounds persist exactly", (t) => {
  const context = fixture(t, "signed-i64");
  const adapter = context.open();
  for (const round of [I64_MIN_MIDNIGHT, -86_400n, 0n, I64_MAX_MIDNIGHT]) {
    const receipt = adapter.appendFinalizedRound(proofInput(finalizedRound(round, 0)));
    assert.equal(receipt.fundingRoundAtUnixSeconds, round);
  }
  assert.equal(adapter.count(), 4);
  adapter.close();
  assert.equal(context.open().count(), 4);
});

test("duplicate, changed, reordered, sparse, accessor, symbol, and extra-key inputs fail closed", (t) => {
  const context = fixture(t, "hostile");
  const adapter = context.open();
  const input = proofInput();
  adapter.appendFinalizedRound(input);
  assert.throws(() => adapter.appendFinalizedRound(input), /ROUND_ALREADY_RETAINED/u);

  const changed = structuredClone(input);
  changed.bundle.receiptBytes[0][0] ^= 0xff;
  assert.throws(() => context.open().appendFinalizedRound(changed), /BUNDLE|TRANSCRIPT|RECOMPUTATION/u);

  const reordered = structuredClone(input);
  reordered.bundle.receiptBytes.reverse();
  assert.throws(() => context.open().appendFinalizedRound(reordered), /BUNDLE|RECOMPUTATION/u);

  const sparse = structuredClone(input);
  delete sparse.bundle.receiptBytes[0];
  assert.throws(() => context.open().appendFinalizedRound(sparse), /dense|BUNDLE/iu);

  let getterRead = false;
  const accessor = {};
  Object.defineProperty(accessor, "roundState", {
    enumerable: true,
    get() { getterRead = true; return input.roundState; },
  });
  Object.defineProperty(accessor, "cccRandomnessReveal", { enumerable: true, value: null });
  Object.defineProperty(accessor, "bundle", { enumerable: true, value: input.bundle });
  assert.throws(() => context.open().appendFinalizedRound(accessor), /data-only input/u);
  assert.equal(getterRead, false);

  const symbol = { ...input, [Symbol("hidden")]: true };
  assert.throws(() => context.open().appendFinalizedRound(symbol), /data-only input/u);
  assert.throws(() => context.open().appendFinalizedRound({ ...input, extra: true }), /data-only input/u);
  assert.equal(adapter.count(), 1);
});

test("every pre-commit fault rolls back the round and all receipt rows across reopen", async (t) => {
  for (const point of [
    REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.AFTER_ROUND_INSERT,
    REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.AFTER_RECEIPT_INSERT,
    REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.BEFORE_COMMIT,
  ]) {
    await t.test(point, () => {
      const context = fixture(t, point.toLowerCase());
      const adapter = context.open({ testOnlyFault: point });
      assert.throws(
        () => adapter.appendFinalizedRound(proofInput()),
        new RegExp(`TEST_ONLY_REWARD_WATERFALL_AUDIT_FAULT_${point}`, "u"),
      );
      assert.equal(adapter.count(), 0);
      adapter.close();
      assert.equal(context.open().count(), 0);
    });
  }
});

test("lost response after durable commit reopens one exact record and retry remains one-shot", (t) => {
  const context = fixture(t, "lost-return");
  const input = proofInput();
  const adapter = context.open({
    testOnlyFault: REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.AFTER_DURABLE_COMMIT,
  });
  assert.throws(
    () => adapter.appendFinalizedRound(input),
    /TEST_ONLY_REWARD_WATERFALL_AUDIT_FAULT_AFTER_DURABLE_COMMIT/u,
  );
  adapter.close();
  const reopened = context.open();
  assert.equal(reopened.count(), 1);
  assert.throws(() => reopened.appendFinalizedRound(input), /ROUND_ALREADY_RETAINED/u);
});

test("abrupt process exit before commit recovers empty and after commit recovers complete", async (t) => {
  for (const scenario of ["before-commit", "after-commit"]) {
    await t.test(scenario, () => {
      const context = fixture(t, `crash-${scenario}`);
      const child = spawnSync(process.execPath, [THIS_TEST], {
        encoding: "utf8",
        env: {
          ...process.env,
          IAT_B3_WATERFALL_AUDIT_CRASH_SCENARIO: scenario,
          IAT_B3_WATERFALL_AUDIT_CRASH_DATABASE: context.databasePath,
        },
        timeout: 30_000,
      });
      assert.equal(child.status, 86, `${child.stdout}\n${child.stderr}`);
      assert.equal(context.open().count(), scenario === "before-commit" ? 0 : 1);
    });
  }
});

test("writer contention fails closed without partial rows and succeeds after lock release", (t) => {
  const context = fixture(t, "contention");
  const adapter = context.open({ busyTimeoutMs: 10 });
  const blocker = new DatabaseSync(context.databasePath);
  blocker.exec("PRAGMA busy_timeout = 0; BEGIN IMMEDIATE");
  try {
    assert.throws(() => adapter.appendFinalizedRound(proofInput()), /busy|locked/iu);
    assert.equal(adapter.count(), 0);
  } finally {
    blocker.exec("ROLLBACK");
    blocker.close();
  }
  adapter.appendFinalizedRound(proofInput());
  assert.equal(adapter.count(), 1);
});

test("append-only update, delete, and replace attempts are rejected", (t) => {
  const context = fixture(t, "tamper");
  const adapter = context.open();
  adapter.appendFinalizedRound(proofInput());
  adapter.close();

  const raw = new DatabaseSync(context.databasePath);
  assert.throws(
    () => raw.exec("UPDATE reward_waterfall_audit_rounds SET mainnet_status = 'HOLD'"),
    /APPEND_ONLY_UPDATE_FORBIDDEN/u,
  );
  assert.throws(
    () => raw.exec("DELETE FROM reward_waterfall_audit_receipts"),
    /APPEND_ONLY_DELETE_FORBIDDEN/u,
  );
  assert.throws(
    () => raw.exec("INSERT OR REPLACE INTO reward_waterfall_audit_rounds SELECT * FROM reward_waterfall_audit_rounds"),
    /ROUND_ALREADY_RETAINED|APPEND_ONLY_DELETE_FORBIDDEN/u,
  );
  raw.close();
  assert.equal(context.open().count(), 1);
});

test("receipt coverage tampering fails full replay on reopen", (t) => {
  const context = fixture(t, "coverage-tamper");
  const adapter = context.open();
  adapter.appendFinalizedRound(proofInput());
  adapter.close();
  const raw = new DatabaseSync(context.databasePath);
  const trigger = raw.prepare("SELECT sql FROM sqlite_schema WHERE name = ?")
    .get("reward_waterfall_audit_receipts_forbid_delete").sql;
  raw.exec("DROP TRIGGER reward_waterfall_audit_receipts_forbid_delete");
  raw.exec("DELETE FROM reward_waterfall_audit_receipts WHERE allocation_index = 0");
  raw.exec(trigger);
  raw.close();
  assert.throws(() => context.open(), /RECEIPT_SET_NOT_CONTIGUOUS/u);
});

test("schema and retained flag tampering fail closed on reopen", async (t) => {
  await t.test("schema", () => {
    const context = fixture(t, "schema-tamper");
    const adapter = context.open();
    adapter.appendFinalizedRound(proofInput());
    adapter.close();
    const raw = new DatabaseSync(context.databasePath);
    raw.exec("DROP TRIGGER reward_waterfall_audit_receipts_forbid_update");
    raw.close();
    assert.throws(() => context.open(), /SCHEMA_OBJECT_SET_MISMATCH/u);
  });

  await t.test("receipt flags", () => {
    const context = fixture(t, "flag-tamper");
    const adapter = context.open();
    adapter.appendFinalizedRound(proofInput());
    adapter.close();
    const raw = new DatabaseSync(context.databasePath);
    const trigger = raw.prepare("SELECT sql FROM sqlite_schema WHERE name = ?")
      .get("reward_waterfall_audit_receipts_forbid_update").sql;
    raw.exec("DROP TRIGGER reward_waterfall_audit_receipts_forbid_update");
    raw.exec("PRAGMA ignore_check_constraints = ON");
    raw.exec(`UPDATE reward_waterfall_audit_receipts
      SET runtime_authentication_verified = 1
      WHERE allocation_index = 0`);
    raw.exec(trigger);
    raw.close();
    assert.throws(() => context.open(), /INTEGRITY_CHECK_FAILED|ROW_BINDING_MISMATCH/u);
  });
});

test("SQL signed-decimal constraint rejects noncanonical round keys", async (t) => {
  for (const key of ["-0", "00", "01", "-01", "+1", " 1", "1 ", "--1", "1a"]) {
    await t.test(key, () => {
      const context = fixture(t, `round-key-${Buffer.from(key).toString("hex")}`);
      const adapter = context.open();
      adapter.appendFinalizedRound(proofInput(finalizedRound(FUNDING_ROUND, 0)));
      adapter.close();
      const raw = new DatabaseSync(context.databasePath);
      const trigger = raw.prepare("SELECT sql FROM sqlite_schema WHERE name = ?")
        .get("reward_waterfall_audit_rounds_forbid_update").sql;
      raw.exec("DROP TRIGGER reward_waterfall_audit_rounds_forbid_update");
      assert.throws(
        () => raw.prepare(`UPDATE reward_waterfall_audit_rounds
          SET funding_round_at_unix_seconds = ?`).run(key),
        /constraint failed/iu,
      );
      raw.exec(trigger);
      raw.close();
      assert.equal(context.open().count(), 1);
    });
  }
});

test("whole-unit rollback remains detectable only relative to a separately retained newer receipt", (t) => {
  const context = fixture(t, "rollback-boundary");
  const adapter = context.open();
  const first = adapter.appendFinalizedRound(proofInput());
  adapter.close();
  const backup = join(context.directory, "older.sqlite");
  copyFileSync(context.databasePath, backup);

  const secondRound = FUNDING_ROUND + 86_400n;
  const live = context.open();
  const second = live.appendFinalizedRound(proofInput(finalizedRound(secondRound)));
  assert.equal(live.count(), 2);
  assert.notEqual(first.proofBundleSha256, second.proofBundleSha256);
  live.close();

  copyFileSync(backup, context.databasePath);
  const restored = context.open();
  assert.equal(restored.count(), 1);
  assert.equal(restored.rollbackProtectionVerified, false);
  assert.equal(restored.activationReady, false);
  assert.equal(restored.mainnetStatus, "HOLD");
});

test("adapter truth surface never promotes local replay durability to runtime authority", (t) => {
  const adapter = fixture(t, "truth").open();
  assert.equal(adapter.status, REWARD_WATERFALL_AUDIT_SQLITE_STATUS);
  assert.equal(adapter.runtimeAuthenticationVerified, false);
  assert.equal(adapter.rollbackProtectionVerified, false);
  assert.equal(adapter.activationReady, false);
  assert.equal(adapter.mainnetStatus, "HOLD");
});
