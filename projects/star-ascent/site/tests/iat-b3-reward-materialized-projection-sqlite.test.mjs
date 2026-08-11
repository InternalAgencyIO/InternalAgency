import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { createCheckpointGatedRewardPersistenceCas } from "../programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs";
import {
  createCccPrecommitRegistrySnapshot,
  sealRewardCapacityRound,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
import {
  REWARD_CAS_ENTITY_KIND,
  REWARD_CAS_GLOBAL_LEDGER_KEY,
  REWARD_CAS_ZERO_SHA256,
  finalizeRewardCapacityRoundCas,
} from "../programs/iat_b3_reference/reward-persistence-cas.mjs";
import { createSqliteRewardPersistenceCas } from "../programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs";
import {
  advanceRewardCasExternalCheckpoint,
  validateRewardCasExternalCheckpoint,
} from "../programs/iat_b3_reference/reward-persistence-checkpoint.mjs";
import {
  REWARD_CONSUMER_SCOPE,
  prepareRewardConsumerPermit,
} from "../programs/iat_b3_reference/reward-consumer-gate.mjs";
import {
  REWARD_MATERIALIZED_PROJECTION_CURSOR_SCHEMA,
  REWARD_MATERIALIZED_PROJECTION_DISPOSITION,
  REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE,
  REWARD_MATERIALIZED_PROJECTION_MAINNET_STATUS,
  REWARD_MATERIALIZED_PROJECTION_SQLITE_ADAPTER_SCHEMA,
  REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_MANIFEST_SHA256,
  REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT,
  assertSqliteRewardMaterializedProjectionAdapter,
  createSqliteRewardMaterializedProjection,
  validateRewardMaterializedProjectionCursor,
  validateRewardMaterializedProjectionEvent,
  validateRewardMaterializedProjectionState,
} from "../programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

const LOCAL_0001_UTC = 1_786_050_060n;
const ROUND_ONE = 1_786_060_800n;
const ROUND_TWO = ROUND_ONE + 86_400n;
const SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-materialized-projection-test",
});
const CURRENT_DAY = protocolLocalDay(LOCAL_0001_UTC);
const hex = (value) => BigInt(value).toString(16).padStart(64, "0");

function lawWithDisposition(locked) {
  for (let candidate = 0; candidate <= 0xffff; candidate += 1) {
    const decision = createLockdownDecision({
      localDay: CURRENT_DAY,
      randomnessOutputHex: candidate.toString(16).padStart(64, "0"),
      schedule: SCHEDULE,
    });
    if (decision.locked === locked) {
      return createDailyLawState({
        protocolHeight: 86_520n,
        schedule: SCHEDULE,
        currentDecision: decision,
      });
    }
  }
  throw new Error("test vector search did not find the requested Daily-Law disposition");
}

const OPEN_LAW = lawWithDisposition(false);
const LOCKED_LAW = lawWithDisposition(true);

function laneLedger({ unlocked = 1_000n, reserved = 0n } = {}) {
  const empty = { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n };
  return {
    lanes: {
      treasury: { unlocked, reserved, paid: 0n, withdrawn: 0n },
      ecosystem: { ...empty },
      liquidity: { ...empty },
    },
  };
}

function sealedRound(fundingRoundAtUnixSeconds, boundaryLedger, id) {
  return sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds,
    sealedAtUnixSeconds: fundingRoundAtUnixSeconds,
    obligations: [{
      id: hex(id),
      priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
      amount: 100n,
      fundingRoundAtUnixSeconds,
      fundingPool: "SHARED_REWARD_RESERVE",
      reservationStatus: "NEW_UNRESERVED",
      chronology: {
        eligibleSequence: BigInt(id),
        activitySequence: BigInt(id),
        nodeSequence: BigInt(id),
        immutableIdentity: `materialized-projection-${id}`,
        commitmentDigest: hex(60_000n + BigInt(id)),
      },
    }],
    ledgerSnapshot: boundaryLedger,
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds,
      commitments: [],
    }),
  });
}

function checkpointSink() {
  let current = null;
  return Object.freeze({
    readCurrent() {
      return current;
    },
    compareAndSwap({ expectedCheckpointRevision, expectedCheckpointSha256, nextCheckpoint }) {
      assert.equal(current?.checkpointRevision ?? 0n, expectedCheckpointRevision);
      assert.equal(current?.checkpointSha256 ?? REWARD_CAS_ZERO_SHA256, expectedCheckpointSha256);
      validateRewardCasExternalCheckpoint(nextCheckpoint);
      current = nextCheckpoint;
    },
  });
}

function finalizationInput(store, fundingRoundAtUnixSeconds) {
  const round = store.readEntity(REWARD_CAS_ENTITY_KIND.ROUND, fundingRoundAtUnixSeconds.toString());
  const ledger = store.readEntity(
    REWARD_CAS_ENTITY_KIND.LANE_LEDGER,
    REWARD_CAS_GLOBAL_LEDGER_KEY,
  );
  return {
    dailyLawState: OPEN_LAW,
    store,
    fundingRoundAtUnixSeconds,
    expectedRoundRevision: round.revision,
    expectedRoundSha256: round.stateSha256,
    expectedLedgerRevision: ledger.revision,
    expectedLedgerSha256: ledger.stateSha256,
  };
}

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-materialized-projection-"));
  const rewardDatabasePath = join(directory, "reward-cas.sqlite");
  const projectionDatabasePath = join(directory, "materialized-projection.sqlite");
  const firstLedger = laneLedger();
  const secondLedger = laneLedger({ reserved: 100n });
  const baseStore = createSqliteRewardPersistenceCas({
    databasePath: rewardDatabasePath,
    initialState: {
      laneLedger: firstLedger,
      roundStates: [
        sealedRound(ROUND_ONE, firstLedger, 1n),
        sealedRound(ROUND_TWO, secondLedger, 2n),
      ],
      rewardStates: [],
    },
  });
  const sink = checkpointSink();
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store: baseStore, sink });
  const rewardStore = createCheckpointGatedRewardPersistenceCas({
    store: baseStore,
    checkpointSource: sink,
  });
  finalizeRewardCapacityRoundCas(finalizationInput(rewardStore, ROUND_ONE));
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store: rewardStore, sink });
  finalizeRewardCapacityRoundCas(finalizationInput(rewardStore, ROUND_TWO));
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store: rewardStore, sink });
  let projectionStore = createSqliteRewardMaterializedProjection({
    databasePath: projectionDatabasePath,
  });
  t.after(() => {
    projectionStore.close();
    rewardStore.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    projectionDatabasePath,
    rewardStore,
    sink,
    projectionStore: () => projectionStore,
    reopenProjection(options = {}) {
      projectionStore.close();
      projectionStore = createSqliteRewardMaterializedProjection({
        databasePath: projectionDatabasePath,
        ...options,
      });
      return projectionStore;
    },
  };
}

function permit(context, consumerId, sequence) {
  const commit = context.rewardStore.readCommit(sequence);
  return prepareRewardConsumerPermit({
    dailyLawState: OPEN_LAW,
    store: context.rewardStore,
    checkpoint: context.sink.readCurrent(),
    consumerId,
    scope: REWARD_CONSUMER_SCOPE.LOCAL_PROJECTION,
    targetCommitSequence: sequence,
    targetCommitSha256: commit.commitSha256,
  });
}

function consumeInput(permitRecord, balance = permitRecord.targetCommitSequence * 100n) {
  return {
    dailyLawState: OPEN_LAW,
    permit: permitRecord,
    consumerId: permitRecord.consumerId,
    targetCommitSequence: permitRecord.targetCommitSequence,
    targetCommitSha256: permitRecord.targetCommitSha256,
    projection: {
      kind: "reward-ledger-projection",
      key: "canonical-reward-state",
      payload: {
        balance,
        consumerId: permitRecord.consumerId,
        sourceCommitSha256: permitRecord.targetCommitSha256,
        sourceCommitSequence: permitRecord.targetCommitSequence,
      },
    },
  };
}

test("materialized adapter brand rejects clones, aliases, proxies, and lookalikes without reads", (t) => {
  const context = fixture(t);
  const adapter = context.projectionStore();
  assert.equal(assertSqliteRewardMaterializedProjectionAdapter(adapter), adapter);

  const boundAliases = Object.freeze({
    ...adapter,
    readCursor: adapter.readCursor.bind(adapter),
    readProjectionEvent: adapter.readProjectionEvent.bind(adapter),
    readMaterializedProjection: adapter.readMaterializedProjection.bind(adapter),
    snapshot: adapter.snapshot.bind(adapter),
    consumePermit: adapter.consumePermit.bind(adapter),
  });
  let hostileRead = false;
  const accessorFake = {};
  Object.defineProperty(accessorFake, "adapterSchema", {
    enumerable: true,
    get() {
      hostileRead = true;
      throw new Error("MATERIALIZED_ADAPTER_ACCESSOR_EXECUTED");
    },
  });
  const hostileProxy = new Proxy(adapter, {
    get() {
      hostileRead = true;
      throw new Error("MATERIALIZED_ADAPTER_PROXY_EXECUTED");
    },
  });
  const { proxy: revokedProxy, revoke } = Proxy.revocable(adapter, {});
  revoke();

  for (const candidate of [
    Object.freeze({ ...adapter }),
    boundAliases,
    Object.create(adapter),
    accessorFake,
    new Proxy(adapter, {}),
    hostileProxy,
    revokedProxy,
  ]) {
    assert.throws(
      () => assertSqliteRewardMaterializedProjectionAdapter(candidate),
      /process-branded SQLite adapter/u,
    );
  }
  assert.equal(hostileRead, false);
});

test("cursor, event, and canonical materialized state commit atomically and survive reopen", (t) => {
  const context = fixture(t);
  const firstPermit = permit(context, "materialized-reward-v1", 1n);
  const secondPermit = permit(context, "materialized-reward-v1", 2n);
  const first = context.projectionStore().consumePermit(consumeInput(firstPermit));
  assert.equal(first.disposition, REWARD_MATERIALIZED_PROJECTION_DISPOSITION.COMMITTED);
  assert.equal(first.cursor.schema, REWARD_MATERIALIZED_PROJECTION_CURSOR_SCHEMA);
  assert.equal(first.cursor.cursorRevision, 1n);
  assert.equal(first.materializedState.stateRevision, 1n);
  assert.equal(first.materializedState.previousMaterializedStateSha256, REWARD_CAS_ZERO_SHA256);
  assert.equal(first.materializedState.payload.balance, 100n);
  assert.equal(first.projectionEvent.cursorSha256, first.cursor.cursorSha256);
  assert.equal(
    first.projectionEvent.materializedStateSha256,
    first.materializedState.materializedStateSha256,
  );
  assert.equal(validateRewardMaterializedProjectionCursor(first.cursor), first.cursor);
  assert.equal(
    validateRewardMaterializedProjectionState(first.materializedState, first.cursor),
    first.materializedState,
  );
  assert.equal(
    validateRewardMaterializedProjectionEvent(
      first.projectionEvent,
      first.cursor,
      first.materializedState,
    ),
    first.projectionEvent,
  );

  const second = context.projectionStore().consumePermit(consumeInput(secondPermit));
  assert.equal(second.cursor.cursorRevision, 2n);
  assert.equal(second.cursor.previousCursorSha256, first.cursor.cursorSha256);
  assert.equal(second.materializedState.stateRevision, 2n);
  assert.equal(
    second.materializedState.previousMaterializedStateSha256,
    first.materializedState.materializedStateSha256,
  );

  const reopened = context.reopenProjection();
  assert.equal(reopened.adapterSchema, REWARD_MATERIALIZED_PROJECTION_SQLITE_ADAPTER_SCHEMA);
  assert.equal(
    reopened.schemaManifestSha256,
    REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_MANIFEST_SHA256,
  );
  assert.deepEqual(reopened.readCursor(firstPermit.consumerId), second.cursor);
  assert.deepEqual(
    reopened.readProjectionEvent(firstPermit.consumerId, 1n),
    first.projectionEvent,
  );
  assert.deepEqual(
    reopened.readMaterializedProjection(
      firstPermit.consumerId,
      "reward-ledger-projection",
      "canonical-reward-state",
    ),
    second.materializedState,
  );
  const snapshot = reopened.snapshot();
  assert.equal(snapshot.cursors.length, 2);
  assert.equal(snapshot.projectionEvents.length, 2);
  assert.equal(snapshot.materializedStates.length, 2);
});

test("nonempty Buffer and Uint8Array payloads commit, isolate caller mutation, reopen, and replay", (t) => {
  const context = fixture(t);
  const firstPermit = permit(context, "byte-payload-projection", 1n);
  const bufferInput = Buffer.from([0x00, 0x7f, 0x80, 0xff]);
  const uint8Input = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  const input = consumeInput(firstPermit);
  input.projection.payload = {
    bufferInput,
    nested: { uint8Input },
  };

  const committed = context.projectionStore().consumePermit(input);
  assert.equal(committed.disposition, REWARD_MATERIALIZED_PROJECTION_DISPOSITION.COMMITTED);
  assert.deepEqual(
    [...committed.materializedState.payload.bufferInput],
    [0x00, 0x7f, 0x80, 0xff],
  );
  assert.deepEqual(
    [...committed.materializedState.payload.nested.uint8Input],
    [0xde, 0xad, 0xbe, 0xef],
  );
  assert.equal(Object.isFrozen(committed.materializedState.payload), true);
  assert.equal(Object.isFrozen(committed.materializedState.payload.nested), true);
  assert.equal(Object.isFrozen(committed.materializedState.payload.bufferInput), false);
  assert.equal(Object.isFrozen(committed.materializedState.payload.nested.uint8Input), false);

  bufferInput.fill(0x11);
  uint8Input.fill(0x22);
  committed.materializedState.payload.bufferInput.fill(0x33);
  committed.materializedState.payload.nested.uint8Input.fill(0x44);
  const reread = context.projectionStore().readMaterializedProjection(
    firstPermit.consumerId,
    "reward-ledger-projection",
    "canonical-reward-state",
  );
  assert.deepEqual([...reread.payload.bufferInput], [0x00, 0x7f, 0x80, 0xff]);
  assert.deepEqual([...reread.payload.nested.uint8Input], [0xde, 0xad, 0xbe, 0xef]);

  reread.payload.bufferInput.fill(0x55);
  const reopened = context.reopenProjection();
  const durable = reopened.readMaterializedProjection(
    firstPermit.consumerId,
    "reward-ledger-projection",
    "canonical-reward-state",
  );
  assert.deepEqual([...durable.payload.bufferInput], [0x00, 0x7f, 0x80, 0xff]);
  assert.deepEqual([...durable.payload.nested.uint8Input], [0xde, 0xad, 0xbe, 0xef]);

  const replayInput = consumeInput(firstPermit);
  replayInput.projection.payload = {
    bufferInput: Buffer.from([0x00, 0x7f, 0x80, 0xff]),
    nested: { uint8Input: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) },
  };
  const replay = reopened.consumePermit(replayInput);
  assert.equal(
    replay.disposition,
    REWARD_MATERIALIZED_PROJECTION_DISPOSITION.RECONCILED_EXACT_REPLAY,
  );
  assert.equal(reopened.snapshot().materializedStates.length, 1);
  assert.deepEqual([...replay.materializedState.payload.bufferInput], [0x00, 0x7f, 0x80, 0xff]);
});

test("exact retries reconcile idempotently while drift, skips, and copied permits fail closed", (t) => {
  const context = fixture(t);
  const store = context.projectionStore();
  const firstPermit = permit(context, "idempotent-projection", 1n);
  const secondPermit = permit(context, "idempotent-projection", 2n);
  assert.throws(
    () => store.consumePermit(consumeInput(secondPermit)),
    /REWARD_MATERIALIZED_PROJECTION_SKIP_FORBIDDEN/u,
  );
  assert.deepEqual(store.snapshot().cursors, []);
  assert.throws(
    () => store.consumePermit(consumeInput(structuredClone(firstPermit))),
    /INVALID_REWARD_CONSUMER_PERMIT/u,
  );

  const committed = store.consumePermit(consumeInput(firstPermit));
  const afterFirst = store.snapshot();
  const reconciled = store.consumePermit(consumeInput(firstPermit));
  assert.equal(
    reconciled.disposition,
    REWARD_MATERIALIZED_PROJECTION_DISPOSITION.RECONCILED_EXACT_REPLAY,
  );
  assert.deepEqual(reconciled.cursor, committed.cursor);
  assert.deepEqual(reconciled.projectionEvent, committed.projectionEvent);
  assert.deepEqual(reconciled.materializedState, committed.materializedState);
  assert.deepEqual(store.snapshot(), afterFirst);
  assert.throws(
    () => store.consumePermit(consumeInput(firstPermit, 999n)),
    /REWARD_MATERIALIZED_PROJECTION_REPLAY_MISMATCH/u,
  );
  assert.deepEqual(store.snapshot(), afterFirst);

  store.consumePermit(consumeInput(secondPermit));
  const afterSecond = store.snapshot();
  const historicalRetry = store.consumePermit(consumeInput(firstPermit));
  assert.equal(
    historicalRetry.disposition,
    REWARD_MATERIALIZED_PROJECTION_DISPOSITION.RECONCILED_EXACT_REPLAY,
  );
  assert.deepEqual(store.snapshot(), afterSecond);
});

test("every precommit fault rolls cursor, event, and materialized state back together", async (t) => {
  const precommitFaults = [
    REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT.AFTER_CURSOR,
    REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT.AFTER_PROJECTION_EVENT,
    REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT.AFTER_MATERIALIZED_STATE,
  ];
  for (const point of precommitFaults) {
    await t.test(point, (subtest) => {
      const context = fixture(subtest);
      const faultingStore = context.reopenProjection({ testOnlyFault: point });
      const firstPermit = permit(
        context,
        `fault-${point.toLowerCase().replaceAll("_", "-")}`,
        1n,
      );
      assert.throws(
        () => faultingStore.consumePermit(consumeInput(firstPermit)),
        new RegExp(`TEST_ONLY_REWARD_MATERIALIZED_PROJECTION_SQLITE_FAULT_${point}`, "u"),
      );
      const reopened = context.reopenProjection();
      const snapshot = reopened.snapshot();
      assert.deepEqual(snapshot.cursors, []);
      assert.deepEqual(snapshot.projectionEvents, []);
      assert.deepEqual(snapshot.materializedStates, []);
      assert.equal(reopened.readCursor(firstPermit.consumerId), null);
      assert.equal(reopened.readProjectionEvent(firstPermit.consumerId, 1n), null);
      assert.equal(
        reopened.readMaterializedProjection(
          firstPermit.consumerId,
          "reward-ledger-projection",
          "canonical-reward-state",
        ),
        null,
      );
    });
  }
});

test("lost acknowledgement after commit is recovered by an exact replay after reopen", (t) => {
  const context = fixture(t);
  const firstPermit = permit(context, "postcommit-recovery", 1n);
  const faultingStore = context.reopenProjection({
    testOnlyFault: REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT.AFTER_COMMIT,
  });
  assert.throws(
    () => faultingStore.consumePermit(consumeInput(firstPermit)),
    /TEST_ONLY_REWARD_MATERIALIZED_PROJECTION_SQLITE_FAULT_AFTER_COMMIT/u,
  );
  const reopened = context.reopenProjection();
  assert.equal(reopened.snapshot().cursors.length, 1);
  assert.equal(reopened.snapshot().projectionEvents.length, 1);
  assert.equal(reopened.snapshot().materializedStates.length, 1);
  const retry = reopened.consumePermit(consumeInput(firstPermit));
  assert.equal(
    retry.disposition,
    REWARD_MATERIALIZED_PROJECTION_DISPOSITION.RECONCILED_EXACT_REPLAY,
  );
  assert.equal(reopened.snapshot().cursors.length, 1);
});

test("append-only guards and reopen validation reject state rollback or schema drift", (t) => {
  const context = fixture(t);
  const store = context.projectionStore();
  store.consumePermit(consumeInput(permit(context, "append-only-projection", 1n)));
  const snapshot = store.snapshot();
  const attacker = new DatabaseSync(context.projectionDatabasePath, {
    allowExtension: false,
    enableForeignKeyConstraints: true,
  });
  try {
    attacker.exec("PRAGMA recursive_triggers = OFF");
    assert.equal(attacker.prepare("PRAGMA recursive_triggers").get().recursive_triggers, 0);
    for (const table of [
      "reward_materialized_projection_cursor_history",
      "reward_materialized_projection_events",
      "reward_materialized_projection_state_history",
    ]) {
      assert.throws(
        () => attacker.exec(`DELETE FROM ${table}`),
        /REWARD_MATERIALIZED_PROJECTION_APPEND_ONLY_DELETE_FORBIDDEN/u,
      );
      assert.throws(
        () => attacker.exec(`UPDATE ${table} SET record_blob = X'00'`),
        /REWARD_MATERIALIZED_PROJECTION_APPEND_ONLY_UPDATE_FORBIDDEN/u,
      );
    }
    for (const table of [
      "reward_materialized_projection_meta",
      "reward_materialized_projection_cursor_history",
      "reward_materialized_projection_events",
      "reward_materialized_projection_state_history",
    ]) {
      assert.throws(
        () => attacker.exec(`INSERT OR REPLACE INTO ${table} SELECT * FROM ${table} LIMIT 1`),
        /REWARD_MATERIALIZED_PROJECTION_APPEND_ONLY_INSERT_CONFLICT_FORBIDDEN/u,
      );
    }
  } finally {
    attacker.close();
  }
  assert.deepEqual(store.snapshot(), snapshot);

  store.close();
  const schemaAttacker = new DatabaseSync(context.projectionDatabasePath);
  schemaAttacker.exec(
    "DROP TRIGGER reward_materialized_projection_state_history_forbid_conflicting_insert",
  );
  schemaAttacker.close();
  assert.throws(
    () => context.reopenProjection(),
    /REWARD_MATERIALIZED_PROJECTION_SCHEMA_OBJECT_SET_MISMATCH/u,
  );
});

test("Daily Law remains first and local atomicity never claims provider, rollback, or Mainnet", (t) => {
  const context = fixture(t);
  const store = context.projectionStore();
  const before = store.snapshot();
  let laterRead = false;
  const poison = {
    dailyLawState: {},
    get consumerId() {
      laterRead = true;
      throw new Error("CONSUMER_READ_BEFORE_LAW");
    },
    get permit() {
      laterRead = true;
      throw new Error("PERMIT_READ_BEFORE_LAW");
    },
  };
  assert.throws(() => store.consumePermit(poison), /INVALID_IAT_DAILY_LAW_STATE/u);
  assert.equal(laterRead, false);
  assert.deepEqual(store.snapshot(), before);

  const firstPermit = permit(context, "locked-materialized", 1n);
  assert.throws(
    () => store.consumePermit({ ...consumeInput(firstPermit), dailyLawState: LOCKED_LAW }),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.deepEqual(store.snapshot(), before);
  assert.equal(store.materializedProjectionStateVerified, true);
  assert.equal(store.projectionEffectScope, REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE);
  assert.equal(store.projectionEffectAtomicityVerified, true);
  assert.equal(store.runtimeAuthenticationVerified, false);
  assert.equal(store.providerAuthenticityVerified, false);
  assert.equal(store.externalRollbackAnchorVerified, false);
  assert.equal(store.rollbackProtectionVerified, false);
  assert.equal(store.externalSideEffectsAuthorized, false);
  assert.equal(store.activationReady, false);
  assert.equal(store.mainnetStatus, REWARD_MATERIALIZED_PROJECTION_MAINNET_STATUS);
});

test("record validators reject digest and truth-boundary substitution", (t) => {
  const context = fixture(t);
  const result = context.projectionStore().consumePermit(consumeInput(
    permit(context, "validator-projection", 1n),
  ));
  assert.throws(
    () => validateRewardMaterializedProjectionCursor({
      ...result.cursor,
      cursorSha256: "ff".repeat(32),
    }),
    /CURSOR_DIGEST_MISMATCH/u,
  );
  assert.throws(
    () => validateRewardMaterializedProjectionState({
      ...result.materializedState,
      runtimeAuthenticationVerified: true,
    }, result.cursor),
    /INVALID_REWARD_MATERIALIZED_PROJECTION_TRUTH_BOUNDARY/u,
  );
  assert.throws(
    () => validateRewardMaterializedProjectionEvent({
      ...result.projectionEvent,
      extra: false,
    }, result.cursor, result.materializedState),
    /INVALID_REWARD_MATERIALIZED_PROJECTION_EVENT/u,
  );
});
