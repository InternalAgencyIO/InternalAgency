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
  REWARD_CONSUMER_CURSOR_MAINNET_STATUS,
  REWARD_CONSUMER_CURSOR_SCHEMA,
  REWARD_CONSUMER_CURSOR_SQLITE_ADAPTER_SCHEMA,
  REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256,
  REWARD_CONSUMER_CURSOR_SQLITE_TEST_FAULT,
  REWARD_CONSUMER_CURSOR_STATUS,
  assertSqliteRewardConsumerCursorAdapter,
  createSqliteRewardConsumerCursor,
  validateRewardConsumerCursorRecord,
  validateRewardConsumerProjectionEventRecord,
} from "../programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs";
import {
  REWARD_CONSUMER_SCOPE,
  prepareRewardConsumerPermit,
} from "../programs/iat_b3_reference/reward-consumer-gate.mjs";
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
  networkId: "iat-b3-consumer-cursor-test",
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
        immutableIdentity: `consumer-cursor-${id}`,
        commitmentDigest: hex(50_000n + BigInt(id)),
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
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-consumer-cursor-"));
  const rewardDatabasePath = join(directory, "reward-cas.sqlite");
  const cursorDatabasePath = join(directory, "consumer-cursor.sqlite");
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
  let cursorStore = createSqliteRewardConsumerCursor({ databasePath: cursorDatabasePath });
  t.after(() => {
    cursorStore.close();
    rewardStore.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory,
    cursorDatabasePath,
    rewardStore,
    sink,
    cursorStore: () => cursorStore,
    reopenCursor(options = {}) {
      cursorStore.close();
      cursorStore = createSqliteRewardConsumerCursor({
        databasePath: cursorDatabasePath,
        ...options,
      });
      return cursorStore;
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

test("cursor adapter brand rejects clones, aliases, proxies, and lookalikes without reads", (t) => {
  const context = fixture(t);
  const cursor = context.cursorStore();
  assert.equal(assertSqliteRewardConsumerCursorAdapter(cursor), cursor);

  const structuralClone = Object.freeze({ ...cursor });
  const boundMethodAlias = Object.freeze({
    ...cursor,
    readCursor: cursor.readCursor.bind(cursor),
    readProjectionEvent: cursor.readProjectionEvent.bind(cursor),
    snapshot: cursor.snapshot.bind(cursor),
    consumePermit: cursor.consumePermit.bind(cursor),
  });
  const prototypeLookalike = Object.create(cursor);
  let accessorRead = false;
  const accessorFake = {};
  Object.defineProperty(accessorFake, "adapterSchema", {
    enumerable: true,
    get() {
      accessorRead = true;
      throw new Error("CURSOR_ADAPTER_ACCESSOR_EXECUTED");
    },
  });
  const proxy = new Proxy(cursor, {
    get() {
      accessorRead = true;
      throw new Error("CURSOR_ADAPTER_PROXY_EXECUTED");
    },
  });

  for (const candidate of [
    structuralClone,
    boundMethodAlias,
    prototypeLookalike,
    accessorFake,
    proxy,
  ]) {
    assert.throws(
      () => assertSqliteRewardConsumerCursorAdapter(candidate),
      /process-branded SQLite adapter/u,
    );
  }
  assert.equal(accessorRead, false);
});

function consumeInput(permitRecord) {
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
        consumerId: permitRecord.consumerId,
        targetCommitSequence: permitRecord.targetCommitSequence,
        targetCommitSha256: permitRecord.targetCommitSha256,
      },
    },
  };
}

test("durable cursor consumes branded permits contiguously and survives reopen", (t) => {
  const context = fixture(t);
  const firstPermit = permit(context, "reward-projection-v1", 1n);
  const secondPermit = permit(context, "reward-projection-v1", 2n);
  const first = context.cursorStore().consumePermit(consumeInput(firstPermit));
  assert.equal(first.schema, REWARD_CONSUMER_CURSOR_SCHEMA);
  assert.equal(first.status, REWARD_CONSUMER_CURSOR_STATUS);
  assert.equal(first.cursorRevision, 1n);
  assert.equal(first.previousCursorSha256, REWARD_CAS_ZERO_SHA256);
  assert.equal(first.durableCursorPersistenceVerified, true);
  assert.equal(first.localProjectionEventAppendAtomicityVerified, true);
  assert.equal(first.runtimeAuthenticationVerified, false);
  assert.equal(first.rollbackProtectionVerified, false);
  assert.equal(first.projectionEffectAtomicityVerified, false);
  assert.equal(first.externalSideEffectsAuthorized, false);
  assert.equal(first.activationReady, false);
  assert.equal(first.mainnetStatus, REWARD_CONSUMER_CURSOR_MAINNET_STATUS);
  const second = context.cursorStore().consumePermit(consumeInput(secondPermit));
  assert.equal(second.cursorRevision, 2n);
  assert.equal(second.previousCursorSha256, first.cursorSha256);

  const reopened = context.reopenCursor();
  assert.deepEqual(reopened.readCursor("reward-projection-v1"), second);
  assert.equal(reopened.adapterSchema, REWARD_CONSUMER_CURSOR_SQLITE_ADAPTER_SCHEMA);
  assert.equal(
    reopened.schemaManifestSha256,
    REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256,
  );
  assert.equal(reopened.snapshot().cursors.length, 2);
  assert.equal(reopened.snapshot().projectionEvents.length, 2);
  const firstProjectionEvent = reopened.readProjectionEvent("reward-projection-v1", 1n);
  assert.equal(firstProjectionEvent.cursorSha256, first.cursorSha256);
  assert.equal(firstProjectionEvent.projectionCommitmentSha256, first.projectionCommitmentSha256);
  assert.equal(firstProjectionEvent.localProjectionEventAppendAtomicityVerified, true);
  assert.equal(firstProjectionEvent.materializedProjectionStateVerified, false);
  assert.equal(validateRewardConsumerProjectionEventRecord(firstProjectionEvent, first), firstProjectionEvent);
});

test("nonempty Buffer and Uint8Array payloads detach across commit, reopen, reads, and replay denial", (t) => {
  const context = fixture(t);
  const permitRecord = permit(context, "reward-byte-projection-v1", 1n);
  const bufferBytes = Buffer.from([1, 2, 3, 4]);
  const typedBytes = new Uint8Array([5, 6, 7, 8]);
  const input = {
    ...consumeInput(permitRecord),
    projection: {
      kind: "reward-ledger-projection",
      key: "canonical-reward-state",
      payload: { bufferBytes, typedBytes },
    },
  };
  const cursor = context.cursorStore().consumePermit(input);
  bufferBytes[0] = 99;
  typedBytes[0] = 99;
  let event = context.cursorStore().readProjectionEvent(permitRecord.consumerId, 1n);
  assert.deepEqual([...event.payload.bufferBytes], [1, 2, 3, 4]);
  assert.deepEqual([...event.payload.typedBytes], [5, 6, 7, 8]);

  event.payload.bufferBytes[1] = 88;
  event.payload.typedBytes[1] = 88;
  event = context.cursorStore().readProjectionEvent(permitRecord.consumerId, 1n);
  assert.deepEqual([...event.payload.bufferBytes], [1, 2, 3, 4]);
  assert.deepEqual([...event.payload.typedBytes], [5, 6, 7, 8]);

  const reopened = context.reopenCursor();
  event = reopened.readProjectionEvent(permitRecord.consumerId, 1n);
  assert.deepEqual([...event.payload.bufferBytes], [1, 2, 3, 4]);
  assert.deepEqual([...event.payload.typedBytes], [5, 6, 7, 8]);
  const beforeReplay = reopened.snapshot();
  assert.throws(() => reopened.consumePermit({
    ...input,
    projection: {
      ...input.projection,
      payload: {
        bufferBytes: Buffer.from([1, 2, 3, 4]),
        typedBytes: new Uint8Array([5, 6, 7, 8]),
      },
    },
  }), /CURSOR_REPLAY/u);
  assert.deepEqual(reopened.snapshot(), beforeReplay);
  assert.equal(reopened.readCursor(permitRecord.consumerId).cursorSha256, cursor.cursorSha256);
});

test("replay, skip, copied permits, and cross-consumer substitution fail without mutation", (t) => {
  const context = fixture(t);
  const cursor = context.cursorStore();
  const firstA = permit(context, "projection-a", 1n);
  const secondA = permit(context, "projection-a", 2n);
  const firstB = permit(context, "projection-b", 1n);
  const secondB = permit(context, "projection-b", 2n);
  const empty = cursor.snapshot();
  assert.throws(() => cursor.consumePermit(consumeInput(secondA)), /CURSOR_SKIP_FORBIDDEN/u);
  assert.deepEqual(cursor.snapshot(), empty);
  assert.throws(
    () => cursor.consumePermit(consumeInput(structuredClone(firstA))),
    /INVALID_REWARD_CONSUMER_PERMIT/u,
  );
  assert.deepEqual(cursor.snapshot(), empty);

  const firstRecord = cursor.consumePermit(consumeInput(firstA));
  const afterFirst = cursor.snapshot();
  assert.throws(() => cursor.consumePermit(consumeInput(firstA)), /CURSOR_REPLAY/u);
  assert.deepEqual(cursor.snapshot(), afterFirst);
  assert.throws(() => cursor.consumePermit({
    ...consumeInput(firstB),
    consumerId: "projection-a",
  }), /INVALID_REWARD_CONSUMER_PERMIT/u);
  assert.deepEqual(cursor.snapshot(), afterFirst);

  const bRecord = cursor.consumePermit(consumeInput(firstB));
  assert.equal(bRecord.cursorRevision, 1n);
  assert.notEqual(bRecord.cursorSha256, firstRecord.cursorSha256);
  cursor.consumePermit(consumeInput(secondA));
  cursor.consumePermit(consumeInput(secondB));
  assert.equal(cursor.snapshot().cursors.length, 4);
  assert.equal(cursor.snapshot().projectionEvents.length, 4);
});

test("append-only SQL guards and schema validation reject cursor rollback or replacement", (t) => {
  const context = fixture(t);
  const cursor = context.cursorStore();
  cursor.consumePermit(consumeInput(permit(context, "projection-audit", 1n)));
  const snapshot = cursor.snapshot();
  const attacker = new DatabaseSync(context.cursorDatabasePath, {
    allowExtension: false,
    enableForeignKeyConstraints: true,
  });
  try {
    assert.throws(
      () => attacker.exec("UPDATE reward_consumer_cursor_history SET cursor_revision_text = '2'"),
      /REWARD_CONSUMER_CURSOR_APPEND_ONLY_UPDATE_FORBIDDEN/u,
    );
    assert.throws(
      () => attacker.exec("DELETE FROM reward_consumer_cursor_history"),
      /REWARD_CONSUMER_CURSOR_APPEND_ONLY_DELETE_FORBIDDEN/u,
    );
    assert.throws(
      () => attacker.exec("UPDATE reward_consumer_projection_events SET projection_key = 'replacement'"),
      /REWARD_CONSUMER_CURSOR_APPEND_ONLY_UPDATE_FORBIDDEN/u,
    );
    assert.throws(
      () => attacker.exec("DELETE FROM reward_consumer_projection_events"),
      /REWARD_CONSUMER_CURSOR_APPEND_ONLY_DELETE_FORBIDDEN/u,
    );
  } finally {
    attacker.close();
  }
  assert.deepEqual(cursor.snapshot(), snapshot);

  cursor.close();
  const schemaAttacker = new DatabaseSync(context.cursorDatabasePath);
  schemaAttacker.exec("DROP TRIGGER reward_consumer_cursor_history_forbid_update");
  schemaAttacker.close();
  assert.throws(
    () => context.reopenCursor(),
    /REWARD_CONSUMER_CURSOR_SCHEMA_OBJECT_SET_MISMATCH/u,
  );
});

test("Daily Law is first and locked attempts leave the durable cursor unchanged", (t) => {
  const context = fixture(t);
  const cursor = context.cursorStore();
  const before = cursor.snapshot();
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
  assert.throws(() => cursor.consumePermit(poison), /INVALID_IAT_DAILY_LAW_STATE/u);
  assert.equal(laterRead, false);
  assert.deepEqual(cursor.snapshot(), before);

  const first = permit(context, "locked-projection", 1n);
  assert.throws(
    () => cursor.consumePermit({ ...consumeInput(first), dailyLawState: LOCKED_LAW }),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.deepEqual(cursor.snapshot(), before);
});

test("cursor records reject digest, chain, key, accessor, symbol, and prototype aliases", (t) => {
  const context = fixture(t);
  const first = context.cursorStore().consumePermit(consumeInput(
    permit(context, "record-validator", 1n),
  ));
  assert.equal(validateRewardConsumerCursorRecord(first), first);
  assert.throws(
    () => validateRewardConsumerCursorRecord({ ...first, cursorSha256: "ff".repeat(32) }),
    /CURSOR_DIGEST_MISMATCH/u,
  );
  assert.throws(
    () => validateRewardConsumerCursorRecord({ ...first, extra: false }),
    /INVALID_REWARD_CONSUMER_CURSOR_RECORD/u,
  );
  const withSymbol = { ...first };
  withSymbol[Symbol("hidden")] = true;
  assert.throws(
    () => validateRewardConsumerCursorRecord(withSymbol),
    /INVALID_REWARD_CONSUMER_CURSOR_RECORD/u,
  );
  let accessorRead = false;
  const withAccessor = { ...first };
  Object.defineProperty(withAccessor, "cursorSha256", {
    enumerable: true,
    get() {
      accessorRead = true;
      throw new Error("CURSOR_ACCESSOR_EXECUTED");
    },
  });
  assert.throws(
    () => validateRewardConsumerCursorRecord(withAccessor),
    /INVALID_REWARD_CONSUMER_CURSOR_RECORD/u,
  );
  assert.equal(accessorRead, false);
  const nullPrototype = Object.assign(Object.create(null), first);
  assert.throws(
    () => validateRewardConsumerCursorRecord(nullPrototype),
    /INVALID_REWARD_CONSUMER_CURSOR_RECORD/u,
  );

  const second = context.cursorStore().consumePermit(consumeInput(
    permit(context, "record-validator", 2n),
  ));
  assert.equal(validateRewardConsumerCursorRecord(second, first), second);
  assert.throws(
    () => validateRewardConsumerCursorRecord(second),
    /CURSOR_CHAIN_MISMATCH/u,
  );
});

test("cursor persistence never authorizes a projection effect or Mainnet", (t) => {
  const context = fixture(t);
  const store = context.cursorStore();
  assert.equal(store.durableCursorPersistenceVerified, true);
  assert.equal(store.localProjectionEventAppendAtomicityVerified, true);
  assert.equal(store.materializedProjectionStateVerified, false);
  assert.equal(store.runtimeAuthenticationVerified, false);
  assert.equal(store.rollbackProtectionVerified, false);
  assert.equal(store.projectionEffectAtomicityVerified, false);
  assert.equal(store.externalSideEffectsAuthorized, false);
  assert.equal(store.activationReady, false);
  assert.equal(store.mainnetStatus, "HOLD");
});

test("cursor and local projection event roll back together at every injected transaction boundary", async (t) => {
  for (const point of Object.values(REWARD_CONSUMER_CURSOR_SQLITE_TEST_FAULT)) {
    await t.test(point, (subtest) => {
      const context = fixture(subtest);
      const faultingStore = context.reopenCursor({ testOnlyFault: point });
      const first = permit(context, `atomic-${point.toLowerCase().replaceAll("_", "-")}`, 1n);
      assert.throws(
        () => faultingStore.consumePermit(consumeInput(first)),
        new RegExp(`TEST_ONLY_REWARD_CONSUMER_CURSOR_SQLITE_FAULT_${point}`, "u"),
      );
      const reopened = context.reopenCursor();
      assert.deepEqual(reopened.snapshot().cursors, []);
      assert.deepEqual(reopened.snapshot().projectionEvents, []);
      assert.equal(reopened.readCursor(first.consumerId), null);
      assert.equal(reopened.readProjectionEvent(first.consumerId, 1n), null);
    });
  }
});

test("projection input is exact and hostile payload accessors fail without execution or mutation", (t) => {
  const context = fixture(t);
  const store = context.cursorStore();
  const first = permit(context, "hostile-projection", 1n);
  const before = store.snapshot();
  let accessorRead = false;
  const payload = {};
  Object.defineProperty(payload, "secret", {
    enumerable: true,
    get() {
      accessorRead = true;
      throw new Error("PROJECTION_PAYLOAD_ACCESSOR_EXECUTED");
    },
  });
  assert.throws(
    () => store.consumePermit({
      ...consumeInput(first),
      projection: {
        kind: "reward-ledger-projection",
        key: "canonical-reward-state",
        payload,
      },
    }),
    /accessor|typed|canonical|INVALID_REWARD_CAS/iu,
  );
  assert.equal(accessorRead, false);
  assert.deepEqual(store.snapshot(), before);
  assert.throws(
    () => store.consumePermit({
      ...consumeInput(first),
      projection: { ...consumeInput(first).projection, extra: false },
    }),
    /INVALID_REWARD_CONSUMER_LOCAL_PROJECTION_INPUT/u,
  );
  assert.deepEqual(store.snapshot(), before);
});
