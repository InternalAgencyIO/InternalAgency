import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { encodeBase58 } from "../engagement/solana-wallet-proof.mjs";
import {
  UTC_DAY_SECONDS,
  allocateRewardCapacity,
  applyXBoundFundingOutcome,
  buildXBoundFundingObligation,
  createCccPrecommitRegistrySnapshot,
  createXBoundReward,
  sealRewardCapacityRound,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
import {
  REWARD_CAS_ENTITY_KIND,
  REWARD_CAS_GLOBAL_LEDGER_KEY,
  REWARD_CAS_OPERATION,
  REWARD_CAS_STORE_ADAPTER,
  createInitialRewardCasHead,
  createInMemoryRewardPersistenceCas,
  createRewardCasCommit,
  finalizeRewardCapacityRoundCas,
  recordPremiumUpgradeCas,
  validateRewardCasSnapshot,
} from "../programs/iat_b3_reference/reward-persistence-cas.mjs";
import {
  REWARD_CAS_SQLITE_ADAPTER_SCHEMA,
  REWARD_CAS_SQLITE_MAINNET_STATUS,
  REWARD_CAS_SQLITE_SCHEMA_MANIFEST_SHA256,
  REWARD_CAS_SQLITE_SCHEMA_VERSION,
  REWARD_CAS_SQLITE_STATUS,
  REWARD_CAS_SQLITE_TEST_FAULT,
  createSqliteRewardPersistenceCas,
} from "../programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

const LOCAL_0001_UTC = 1_786_050_060n;
const FUNDING_ROUND = 1_786_060_800n;
const TEST_SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-testnet-1",
});
const CURRENT_DAY = protocolLocalDay(LOCAL_0001_UTC);
const OPEN_LAW = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: createLockdownDecision({
    localDay: CURRENT_DAY,
    randomnessOutputHex: "00".repeat(32),
    schedule: TEST_SCHEDULE,
  }),
});
const LOCKED_LAW = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: createLockdownDecision({
    localDay: CURRENT_DAY,
    randomnessOutputHex: `${"00".repeat(31)}01`,
    schedule: TEST_SCHEDULE,
  }),
});
const hex = (value) => value.toString(16).padStart(64, "0");
const walletFor = (value) => {
  const bytes = Buffer.alloc(32);
  bytes[0] = 1;
  bytes.writeUInt32BE(value, 28);
  return encodeBase58(bytes);
};

function laneLedger(treasury = 1_000n) {
  const lane = (unlocked) => ({ unlocked, reserved: 0n, paid: 0n, withdrawn: 0n });
  return {
    lanes: {
      treasury: lane(treasury),
      ecosystem: lane(0n),
      liquidity: lane(0n),
    },
  };
}

function obligation(fundingRoundAtUnixSeconds, id, amount = 100n) {
  return {
    id: hex(id),
    priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
    amount,
    fundingRoundAtUnixSeconds,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    chronology: {
      eligibleSequence: BigInt(id),
      activitySequence: BigInt(id),
      nodeSequence: BigInt(id),
      immutableIdentity: `sqlite-cas-identity-${id}`,
      commitmentDigest: hex(10_000 + id),
    },
  };
}

function sealedRound({
  fundingRoundAtUnixSeconds = FUNDING_ROUND,
  ledger = laneLedger(),
  obligations = [obligation(fundingRoundAtUnixSeconds, 1)],
} = {}) {
  return sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds,
    sealedAtUnixSeconds: fundingRoundAtUnixSeconds,
    obligations,
    ledgerSnapshot: ledger,
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds,
      commitments: [],
    }),
  });
}

function roundInitialState(rounds = [sealedRound()]) {
  return { laneLedger: laneLedger(), roundStates: rounds, rewardStates: [] };
}

function pendingReward() {
  return createXBoundReward({
    dailyLawState: OPEN_LAW,
    rewardId: hex(501),
    rewardSourceKind: "X_INTERACTION",
    wallet: walletFor(501),
    xUserId: "9000000000000501",
    grossBaseUnits: 1_000n,
    epochClosedAtUnixSeconds: FUNDING_ROUND,
    subscriptionType: "None",
    subscriptionObservedAtUnixSeconds: FUNDING_ROUND - 3_600n,
    activityQualificationSequence: 10n,
    nodeActivationSequence: 8n,
  });
}

function admittedReward() {
  const reward = pendingReward();
  const due = buildXBoundFundingObligation({ reward, fundingRoundAtUnixSeconds: FUNDING_ROUND });
  const roundState = sealedRound({ obligations: [due] });
  const allocation = allocateRewardCapacity({ dailyLawState: OPEN_LAW, roundState });
  return applyXBoundFundingOutcome({
    dailyLawState: OPEN_LAW,
    reward,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    outcome: allocation.funded[0],
    roundState: allocation.roundState,
  });
}

function rewardInitialState() {
  return { laneLedger: laneLedger(), roundStates: [], rewardStates: [admittedReward()] };
}

function testDatabase(t, label) {
  const directory = mkdtempSync(join(tmpdir(), `iat-b3-cas-${label}-`));
  const databasePath = join(directory, "reward-cas.sqlite");
  const stores = [];
  t.after(() => {
    for (const store of stores) store.close();
    rmSync(directory, { force: true, recursive: true });
  });
  return {
    databasePath,
    open(options = {}) {
      const store = createSqliteRewardPersistenceCas({ databasePath, ...options });
      stores.push(store);
      return store;
    },
  };
}

function finalizationInput(store, fundingRoundAtUnixSeconds = FUNDING_ROUND) {
  const round = store.readEntity(REWARD_CAS_ENTITY_KIND.ROUND, fundingRoundAtUnixSeconds.toString());
  const ledger = store.readEntity(REWARD_CAS_ENTITY_KIND.LANE_LEDGER, REWARD_CAS_GLOBAL_LEDGER_KEY);
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

function upgradeInput(store, premiumEvidenceSha256 = "ab".repeat(32)) {
  const rewardId = hex(501);
  const reward = store.readEntity(REWARD_CAS_ENTITY_KIND.X_REWARD, rewardId);
  return {
    dailyLawState: OPEN_LAW,
    store,
    rewardId,
    expectedRewardRevision: reward.revision,
    expectedRewardSha256: reward.stateSha256,
    subscriptionType: "Premium",
    subscriptionObservedAtUnixSeconds: FUNDING_ROUND + 3_600n,
    premiumProofAcceptedAtUnixSeconds: FUNDING_ROUND + 3_600n,
    premiumProofAcceptedSequence: 11n,
    premiumEvidenceSha256,
  };
}

test("file-backed adapter pins strict v1 schema, WAL/FULL/foreign keys, flags, and clean reopen", (t) => {
  assert.throws(
    () => createSqliteRewardPersistenceCas({
      databasePath: ":memory:",
      initialState: roundInitialState(),
    }),
    /FILE_BACKED_DATABASE_REQUIRED/u,
  );
  const fixture = testDatabase(t, "schema");
  const store = fixture.open({ initialState: roundInitialState() });
  assert.equal(store.adapterSchema, REWARD_CAS_SQLITE_ADAPTER_SCHEMA);
  assert.equal(store.schemaVersion, REWARD_CAS_SQLITE_SCHEMA_VERSION);
  assert.equal(store.status, REWARD_CAS_SQLITE_STATUS);
  assert.equal(store.runtimeAuthenticationVerified, false);
  assert.equal(store.rollbackProtectionVerified, false);
  assert.equal(store.activationReady, false);
  assert.equal(store.mainnetStatus, REWARD_CAS_SQLITE_MAINNET_STATUS);
  assert.deepEqual(store.readPragmas(), {
    foreignKeys: 1,
    journalMode: "wal",
    synchronous: 2,
    recursiveTriggers: 1,
    trustedSchema: 0,
    defensive: true,
    busyTimeoutMs: 0,
  });
  const before = store.snapshot();
  store.close();
  const reopened = fixture.open();
  assert.deepEqual(reopened.snapshot(), before);
  reopened.close();
  const raw = new DatabaseSync(fixture.databasePath);
  try {
    const meta = raw.prepare("SELECT * FROM reward_cas_sqlite_meta").get();
    assert.equal(meta.adapter_schema, REWARD_CAS_SQLITE_ADAPTER_SCHEMA);
    assert.equal(meta.schema_version, 1);
    assert.equal(meta.schema_manifest_sha256, REWARD_CAS_SQLITE_SCHEMA_MANIFEST_SHA256);
    assert.equal(meta.runtime_authentication_verified, 0);
    assert.equal(meta.rollback_protection_verified, 0);
    assert.equal(meta.activation_ready, 0);
    assert.equal(meta.mainnet_status, "HOLD");
    const tables = raw.prepare(`
      SELECT name, strict FROM pragma_table_list
      WHERE name LIKE 'reward_cas_%'
    `).all();
    assert.equal(tables.length, 7);
    assert.equal(tables.every(({ strict }) => strict === 1), true);
    const triggerCount = raw.prepare(`
      SELECT count(*) AS count FROM sqlite_schema
      WHERE type = 'trigger' AND name LIKE 'reward_cas_%'
    `).get().count;
    assert.equal(triggerCount, 21);
  } finally {
    raw.close();
  }
});

test("SQLite and in-memory adapters produce byte/digest-identical atomic round proof records", (t) => {
  const initialState = roundInitialState();
  const memory = createInMemoryRewardPersistenceCas({ initialState });
  const fixture = testDatabase(t, "round-equivalence");
  const sqlite = fixture.open({ initialState });
  const memoryResult = finalizeRewardCapacityRoundCas(finalizationInput(memory));
  const sqliteResult = finalizeRewardCapacityRoundCas(finalizationInput(sqlite));
  assert.deepEqual(sqliteResult, memoryResult);
  assert.deepEqual(sqliteResult.proofRecord, memoryResult.proofRecord);
  assert.equal(sqliteResult.proofRecord.proofRecordSha256, memoryResult.proofRecord.proofRecordSha256);
  const committed = sqlite.snapshot();
  assert.equal(validateRewardCasSnapshot(committed), committed);
  sqlite.close();
  const reopened = fixture.open();
  assert.deepEqual(reopened.snapshot(), committed);
  assert.deepEqual(reopened.readRoundConsumption(FUNDING_ROUND), sqliteResult.roundConsumption);
  assert.deepEqual(reopened.readRoundProof(FUNDING_ROUND), sqliteResult.proofRecord);
  assert.deepEqual(reopened.readCommit(1n), sqliteResult.commit);
});

test("Premium upgrade is atomic, durable, one-shot, and rejects exact or alternate replay", (t) => {
  const fixture = testDatabase(t, "upgrade");
  const store = fixture.open({ initialState: rewardInitialState() });
  const input = upgradeInput(store);
  const result = recordPremiumUpgradeCas(input);
  const committed = store.snapshot();
  assert.equal(result.rewardRecord.value.latestSubscriptionType, "Premium");
  assert.deepEqual(store.readUpgradeAttempt(input.rewardId), result.upgradeAttempt);
  assert.throws(() => recordPremiumUpgradeCas(input), /UPGRADE_ATTEMPT_ALREADY_RECORDED/u);
  assert.throws(
    () => recordPremiumUpgradeCas({ ...input, premiumEvidenceSha256: "cd".repeat(32) }),
    /UPGRADE_ATTEMPT_ALREADY_RECORDED/u,
  );
  assert.deepEqual(store.snapshot(), committed);
  store.close();
  const reopened = fixture.open();
  assert.deepEqual(reopened.snapshot(), committed);
  assert.deepEqual(reopened.readUpgradeAttempt(input.rewardId), result.upgradeAttempt);
  assert.deepEqual(reopened.readEntity(REWARD_CAS_ENTITY_KIND.X_REWARD, input.rewardId), result.rewardRecord);
});

test("two connections serialize writers and stale cross-round ledger CAS fails closed", (t) => {
  const secondRoundAt = FUNDING_ROUND + UTC_DAY_SECONDS;
  const initialState = roundInitialState([
    sealedRound(),
    sealedRound({
      fundingRoundAtUnixSeconds: secondRoundAt,
      obligations: [obligation(secondRoundAt, 2)],
    }),
  ]);
  const fixture = testDatabase(t, "contention");
  const first = fixture.open({ initialState, busyTimeoutMs: 10 });
  const second = fixture.open({ busyTimeoutMs: 10 });
  const firstInput = finalizationInput(first);
  const staleSecondInput = finalizationInput(second, secondRoundAt);
  const blocker = new DatabaseSync(fixture.databasePath);
  blocker.exec("PRAGMA busy_timeout = 0; BEGIN IMMEDIATE");
  try {
    const unchanged = second.snapshot();
    assert.throws(() => finalizeRewardCapacityRoundCas(firstInput), /locked|busy/iu);
    assert.deepEqual(second.snapshot(), unchanged);
  } finally {
    blocker.exec("ROLLBACK");
    blocker.close();
  }
  finalizeRewardCapacityRoundCas(firstInput);
  const afterFirst = first.snapshot();
  assert.throws(
    () => finalizeRewardCapacityRoundCas(staleSecondInput),
    /STALE_VERSION_OR_DIGEST/u,
  );
  assert.deepEqual(second.snapshot(), afterFirst);
  const currentSecondInput = finalizationInput(second, secondRoundAt);
  assert.throws(
    () => finalizeRewardCapacityRoundCas(currentSecondInput),
    /SEALED_LEDGER_SNAPSHOT_STALE/u,
  );
  assert.deepEqual(second.snapshot(), afterFirst);
});

test("round faults after marker, first entity, proof, commit, or head roll back across reopen", async (t) => {
  for (const point of [
    REWARD_CAS_SQLITE_TEST_FAULT.AFTER_MARKER,
    REWARD_CAS_SQLITE_TEST_FAULT.AFTER_FIRST_ENTITY,
    REWARD_CAS_SQLITE_TEST_FAULT.AFTER_PROOF,
    REWARD_CAS_SQLITE_TEST_FAULT.AFTER_COMMIT,
    REWARD_CAS_SQLITE_TEST_FAULT.AFTER_HEAD,
  ]) {
    await t.test(point, () => {
      const fixture = testDatabase(t, `round-fault-${point.toLowerCase()}`);
      const store = fixture.open({ initialState: roundInitialState(), testOnlyFault: point });
      const before = store.snapshot();
      assert.throws(
        () => finalizeRewardCapacityRoundCas(finalizationInput(store)),
        new RegExp(`TEST_ONLY_REWARD_CAS_SQLITE_FAULT_${point}`, "u"),
      );
      assert.deepEqual(store.snapshot(), before);
      store.close();
      const reopened = fixture.open();
      assert.deepEqual(reopened.snapshot(), before);
    });
  }
});

test("Premium faults at every applicable write boundary roll back across reopen", async (t) => {
  for (const point of [
    REWARD_CAS_SQLITE_TEST_FAULT.AFTER_MARKER,
    REWARD_CAS_SQLITE_TEST_FAULT.AFTER_FIRST_ENTITY,
    REWARD_CAS_SQLITE_TEST_FAULT.AFTER_COMMIT,
    REWARD_CAS_SQLITE_TEST_FAULT.AFTER_HEAD,
  ]) {
    await t.test(point, () => {
      const fixture = testDatabase(t, `upgrade-fault-${point.toLowerCase()}`);
      const store = fixture.open({ initialState: rewardInitialState(), testOnlyFault: point });
      const before = store.snapshot();
      assert.throws(
        () => recordPremiumUpgradeCas(upgradeInput(store)),
        new RegExp(`TEST_ONLY_REWARD_CAS_SQLITE_FAULT_${point}`, "u"),
      );
      assert.deepEqual(store.snapshot(), before);
      store.close();
      const reopened = fixture.open();
      assert.deepEqual(reopened.snapshot(), before);
    });
  }
});

test("a lost response after durable COMMIT is recovered exactly and retry remains one-shot", (t) => {
  const fixture = testDatabase(t, "uncertain-response");
  const uncertain = fixture.open({
    initialState: roundInitialState(),
    testOnlyFault: REWARD_CAS_SQLITE_TEST_FAULT.AFTER_DURABLE_COMMIT,
  });
  const input = finalizationInput(uncertain);
  assert.throws(
    () => finalizeRewardCapacityRoundCas(input),
    /TEST_ONLY_REWARD_CAS_SQLITE_FAULT_AFTER_DURABLE_COMMIT/u,
  );
  const committed = uncertain.snapshot();
  assert.equal(committed.head.commitSequence, 1n);
  assert.equal(committed.roundConsumptions.length, 1);
  assert.equal(committed.roundProofs.length, 1);
  uncertain.close();
  const recovered = fixture.open();
  assert.deepEqual(recovered.snapshot(), committed);
  assert.throws(() => finalizeRewardCapacityRoundCas({ ...input, store: recovered }), /ROUND_ALREADY_CONSUMED/u);
});

test("append-only guards reject UPDATE, DELETE, and REPLACE while leaving recovery valid", (t) => {
  const fixture = testDatabase(t, "append-only");
  const store = fixture.open({ initialState: roundInitialState() });
  const before = store.snapshot();
  const raw = new DatabaseSync(fixture.databasePath);
  try {
    for (const sql of [
      "UPDATE reward_cas_sqlite_meta SET schema_version = 1 WHERE singleton_id = 1",
      "DELETE FROM reward_cas_entity_versions",
      "INSERT OR REPLACE INTO reward_cas_sqlite_meta SELECT * FROM reward_cas_sqlite_meta",
    ]) assert.throws(() => raw.exec(sql), /APPEND_ONLY|REPLACE_OR_DUPLICATE/u);
  } finally {
    raw.close();
  }
  assert.deepEqual(store.snapshot(), before);
  store.close();
  assert.deepEqual(fixture.open().snapshot(), before);
});

test("reopen rejects any exact schema-manifest tamper", (t) => {
  const fixture = testDatabase(t, "schema-tamper");
  fixture.open({ initialState: roundInitialState() }).close();
  const raw = new DatabaseSync(fixture.databasePath);
  try {
    raw.exec("DROP TRIGGER reward_cas_entity_versions_forbid_update");
  } finally {
    raw.close();
  }
  assert.throws(() => fixture.open(), /SCHEMA_OBJECT_SET_MISMATCH/u);
});

test("reopen rejects a restored-schema database with missing proof/consumption tombstones", (t) => {
  const fixture = testDatabase(t, "missing-markers");
  const store = fixture.open({ initialState: roundInitialState() });
  finalizeRewardCapacityRoundCas(finalizationInput(store));
  store.close();
  const raw = new DatabaseSync(fixture.databasePath);
  try {
    const triggerNames = [
      "reward_cas_round_proofs_forbid_delete",
      "reward_cas_round_consumptions_forbid_delete",
    ];
    const triggerSql = triggerNames.map((name) => raw.prepare(`
      SELECT sql FROM sqlite_schema WHERE type = 'trigger' AND name = ?
    `).get(name).sql);
    for (const name of triggerNames) raw.exec(`DROP TRIGGER ${name}`);
    raw.exec("DELETE FROM reward_cas_round_proofs");
    raw.exec("DELETE FROM reward_cas_round_consumptions");
    for (const sql of triggerSql) raw.exec(sql);
  } finally {
    raw.close();
  }
  assert.throws(
    () => fixture.open(),
    /FINALIZE_COMMIT_REQUIRES_CONSUMPTION_AND_PROOF/u,
  );
});

test("reopen canonical decoding rejects a malformed entity BLOB even with the schema restored", (t) => {
  const fixture = testDatabase(t, "malformed-blob");
  fixture.open({ initialState: roundInitialState() }).close();
  const raw = new DatabaseSync(fixture.databasePath);
  try {
    const triggerName = "reward_cas_entity_versions_forbid_update";
    const triggerSql = raw.prepare(`
      SELECT sql FROM sqlite_schema WHERE type = 'trigger' AND name = ?
    `).get(triggerName).sql;
    raw.exec(`DROP TRIGGER ${triggerName}`);
    raw.exec("UPDATE reward_cas_entity_versions SET record_blob = X'00' WHERE entity_kind = 'LANE_LEDGER'");
    raw.exec(triggerSql);
  } finally {
    raw.close();
  }
  assert.throws(() => fixture.open(), /INVALID_ENTITY_RECORD/u);
});

test("a hard child-process exit with an open WAL transaction leaves no partial entity version", (t) => {
  const fixture = testDatabase(t, "hard-exit");
  const initialized = fixture.open({ initialState: roundInitialState() });
  const before = initialized.snapshot();
  initialized.close();
  const script = `
    import { DatabaseSync } from "node:sqlite";
    const database = new DatabaseSync(process.env.IAT_CAS_CRASH_DB);
    database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; BEGIN IMMEDIATE");
    const revision = Buffer.alloc(8);
    revision.writeBigUInt64BE(1n);
    database.prepare(\`
      INSERT INTO reward_cas_entity_versions (
        entity_kind, entity_key, revision_be, revision_text, state_sha256, record_blob,
        status, runtime_authentication_verified, rollback_protection_verified,
        activation_ready, mainnet_status
      )
      SELECT entity_kind, entity_key, ?, '1', state_sha256, record_blob,
        status, runtime_authentication_verified, rollback_protection_verified,
        activation_ready, mainnet_status
      FROM reward_cas_entity_versions
      WHERE entity_kind = 'LANE_LEDGER' AND revision_text = '0'
    \`).run(revision);
    process.kill(process.pid, "SIGKILL");
  `;
  const crashed = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    env: { ...process.env, IAT_CAS_CRASH_DB: fixture.databasePath },
    timeout: 10_000,
  });
  assert.notEqual(crashed.status, 0, crashed.stderr);
  const recovered = fixture.open();
  assert.deepEqual(recovered.snapshot(), before);
});

test("interleaved round and Premium commits recover as one complete chronological history", (t) => {
  const fixture = testDatabase(t, "interleaved");
  const initialState = {
    laneLedger: laneLedger(),
    roundStates: [sealedRound()],
    rewardStates: [admittedReward()],
  };
  const store = fixture.open({ initialState });
  const roundResult = finalizeRewardCapacityRoundCas(finalizationInput(store));
  const upgradeResult = recordPremiumUpgradeCas(upgradeInput(store));
  const committed = store.snapshot();
  assert.deepEqual(committed.commits.map(({ operation }) => operation), [
    REWARD_CAS_OPERATION.FINALIZE_ROUND,
    REWARD_CAS_OPERATION.RECORD_PREMIUM_UPGRADE,
  ]);
  assert.equal(committed.head.commitSequence, 2n);
  assert.equal(committed.roundConsumptions.length, 1);
  assert.equal(committed.roundProofs.length, 1);
  assert.equal(committed.upgradeAttempts.length, 1);
  store.close();
  const reopened = fixture.open();
  assert.deepEqual(reopened.snapshot(), committed);
  assert.deepEqual(reopened.readCommit(1n), roundResult.commit);
  assert.deepEqual(reopened.readCommit(2n), upgradeResult.commit);
});

test("Daily Law is first even through the direct adapter and every denial leaves the DB unchanged", (t) => {
  const fixture = testDatabase(t, "daily-law");
  const store = fixture.open({ initialState: roundInitialState() });
  const before = store.snapshot();
  assert.throws(
    () => finalizeRewardCapacityRoundCas({ ...finalizationInput(store), dailyLawState: LOCKED_LAW }),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.deepEqual(store.snapshot(), before);
  assert.throws(
    () => store[REWARD_CAS_STORE_ADAPTER].finalizeRound({
      dailyLawState: {},
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
    }),
    /INVALID_IAT_DAILY_LAW_STATE/u,
  );
  assert.deepEqual(store.snapshot(), before);
  store.close();
  assert.throws(
    () => store[REWARD_CAS_STORE_ADAPTER].finalizeRound({
      dailyLawState: {},
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
    }),
    /INVALID_IAT_DAILY_LAW_STATE/u,
  );
});

test("u64 terminal head cannot produce an invalid durable next head", () => {
  const terminalMinusOne = (1n << 64n) - 2n;
  assert.throws(() => createRewardCasCommit({
    dailyLawState: OPEN_LAW,
    head: {
      ...createInitialRewardCasHead(),
      commitSequence: terminalMinusOne,
      headCommitSha256: "ab".repeat(32),
    },
    operation: REWARD_CAS_OPERATION.RECORD_PREMIUM_UPGRADE,
    changes: [{
      entityKind: REWARD_CAS_ENTITY_KIND.X_REWARD,
      entityKey: hex(999),
      expectedRevision: 0n,
      expectedStateSha256: "cd".repeat(32),
      nextRevision: 1n,
      nextStateSha256: "ef".repeat(32),
    }],
    evidenceSha256: "12".repeat(32),
  }), /cannot increment past u64/u);
});
