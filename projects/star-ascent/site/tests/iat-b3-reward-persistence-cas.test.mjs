import assert from "node:assert/strict";
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
  REWARD_CAS_MAINNET_STATUS,
  REWARD_CAS_OPERATION,
  REWARD_CAS_STATUS,
  REWARD_CAS_STORE_ADAPTER,
  REWARD_CAS_ZERO_SHA256,
  createInMemoryRewardPersistenceCas,
  createInitialRewardCasHead,
  createRewardCasCommit,
  decodeRewardCasTypedValue,
  encodeRewardCasTypedValue,
  finalizeRewardCapacityRoundCas,
  recordPremiumUpgradeCas,
  rewardAllocatorProofBundleSha256,
  rewardCasStateSha256,
  validateRewardCasCommit,
  validateRewardCasHead,
  validateRewardCasSnapshot,
} from "../programs/iat_b3_reference/reward-persistence-cas.mjs";
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

function ledger(treasury = 1_000n) {
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
      immutableIdentity: `cas-identity-${id}`,
      commitmentDigest: hex(10_000 + id),
    },
  };
}

function sealedRound({
  fundingRoundAtUnixSeconds = FUNDING_ROUND,
  boundaryLedger = ledger(),
  obligations = [obligation(fundingRoundAtUnixSeconds, 1)],
} = {}) {
  const cccPrecommitRegistrySnapshot = createCccPrecommitRegistrySnapshot({
    fundingRoundAtUnixSeconds,
    commitments: [],
  });
  return sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds,
    sealedAtUnixSeconds: fundingRoundAtUnixSeconds,
    obligations,
    ledgerSnapshot: boundaryLedger,
    cccPrecommitRegistrySnapshot,
  });
}

function roundStore({ rounds = [sealedRound()], boundaryLedger = ledger(), testOnlyFault = null } = {}) {
  return createInMemoryRewardPersistenceCas({
    initialState: { laneLedger: boundaryLedger, roundStates: rounds, rewardStates: [] },
    testOnlyFault,
  });
}

function finalizationInput(store, fundingRoundAtUnixSeconds = FUNDING_ROUND) {
  const round = store.readEntity(REWARD_CAS_ENTITY_KIND.ROUND, fundingRoundAtUnixSeconds.toString());
  const laneLedger = store.readEntity(REWARD_CAS_ENTITY_KIND.LANE_LEDGER, REWARD_CAS_GLOBAL_LEDGER_KEY);
  return {
    dailyLawState: OPEN_LAW,
    store,
    fundingRoundAtUnixSeconds,
    expectedRoundRevision: round.revision,
    expectedRoundSha256: round.stateSha256,
    expectedLedgerRevision: laneLedger.revision,
    expectedLedgerSha256: laneLedger.stateSha256,
  };
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
  const due = buildXBoundFundingObligation({
    reward,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
  });
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

function rewardStore({ testOnlyFault = null } = {}) {
  return createInMemoryRewardPersistenceCas({
    initialState: { laneLedger: ledger(), roundStates: [], rewardStates: [admittedReward()] },
    testOnlyFault,
  });
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

test("typed CAS encoding is canonical across supported types and exact byte-view aliases", () => {
  const backing = Uint8Array.from([90, 1, 2, 3, 91]);
  const view = backing.subarray(1, 4);
  const value = {
    bigint: -5n,
    boolean: false,
    bytes: view,
    negativeNumber: -7,
    null: null,
    string: "-7",
  };
  const encoded = encodeRewardCasTypedValue(value);
  const decoded = decodeRewardCasTypedValue(encoded);
  assert.equal(decoded.bigint, -5n);
  assert.equal(decoded.negativeNumber, -7);
  assert.deepEqual(decoded.bytes, Buffer.from([1, 2, 3]));
  assert.equal(encodeRewardCasTypedValue(decoded).equals(encoded), true);
  assert.equal(
    encodeRewardCasTypedValue(Buffer.from([1, 2, 3])).equals(
      encodeRewardCasTypedValue(Uint8Array.from([1, 2, 3])),
    ),
    true,
  );
  assert.notEqual(rewardCasStateSha256(1), rewardCasStateSha256(1n));
  assert.notEqual(rewardCasStateSha256(1), rewardCasStateSha256("1"));
  const shared = { value: 1 };
  assert.equal(
    encodeRewardCasTypedValue({ left: shared, right: shared }).equals(
      encodeRewardCasTypedValue({ left: { value: 1 }, right: { value: 1 } }),
    ),
    true,
  );
});

test("typed CAS encoding rejects sparse, accessor, cyclic, and decorated byte values without invoking accessors", () => {
  const sparse = [];
  sparse.length = 2;
  assert.throws(() => encodeRewardCasTypedValue(sparse), /dense/u);
  let invoked = false;
  const accessor = {};
  Object.defineProperty(accessor, "danger", {
    enumerable: true,
    get() {
      invoked = true;
      return 1;
    },
  });
  assert.throws(() => encodeRewardCasTypedValue(accessor), /data properties/u);
  assert.equal(invoked, false);
  const arrayAccessor = [1];
  Object.defineProperty(arrayAccessor, "0", { enumerable: true, get: () => 1 });
  assert.throws(() => encodeRewardCasTypedValue(arrayAccessor), /data elements/u);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => encodeRewardCasTypedValue(cyclic), /cyclic/u);
  const decoratedBytes = Uint8Array.from([1]);
  decoratedBytes.extra = true;
  assert.throws(() => encodeRewardCasTypedValue(decoratedBytes), /extra properties/u);
  const customArrayPrototype = [1];
  Object.setPrototypeOf(customArrayPrototype, Object.create(Array.prototype));
  assert.throws(() => encodeRewardCasTypedValue(customArrayPrototype), /canonical Array prototype/u);
  const customBytePrototype = Uint8Array.from([1]);
  Object.setPrototypeOf(customBytePrototype, Object.create(Uint8Array.prototype));
  assert.throws(() => encodeRewardCasTypedValue(customBytePrototype), /canonical Buffer or Uint8Array/u);
});

test("a finalized round atomically persists the round, shared ledger, consumption marker, and exact proof", () => {
  const store = roundStore();
  const before = store.snapshot();
  const result = finalizeRewardCapacityRoundCas(finalizationInput(store));
  const after = store.snapshot();
  assert.equal(validateRewardCasSnapshot(after), after);
  assert.equal(after.head.commitSequence, 1n);
  assert.notEqual(after.head.headCommitSha256, REWARD_CAS_ZERO_SHA256);
  assert.equal(result.roundRecord.revision, 1n);
  assert.equal(result.ledgerRecord.revision, 1n);
  assert.equal(result.commit.changes.length, 2);
  assert.equal(result.proofRecord.commitSha256, result.commit.commitSha256);
  assert.equal(
    result.proofRecord.proofBundleSha256,
    rewardAllocatorProofBundleSha256(result.proofBundle),
  );
  assert.deepEqual(store.readRoundConsumption(FUNDING_ROUND), result.roundConsumption);
  assert.deepEqual(store.readRoundProof(FUNDING_ROUND), result.proofRecord);
  assert.deepEqual(store.readCommit(1n), result.commit);
  assert.deepEqual(store.readHead(), after.head);
  assert.equal(before.head.commitSequence, 0n);
  assert.equal(after.roundConsumptions.length, 1);
  assert.equal(after.roundProofs.length, 1);
  const missingPersistenceMarkers = structuredClone(after);
  missingPersistenceMarkers.roundConsumptions = [];
  missingPersistenceMarkers.roundProofs = [];
  assert.throws(
    () => validateRewardCasSnapshot(missingPersistenceMarkers),
    /FINALIZE_COMMIT_REQUIRES_CONSUMPTION_AND_PROOF/u,
  );
});

test("same-round replay and cross-round stale-ledger CAS both fail without changing the snapshot", () => {
  const firstRound = sealedRound();
  const secondFundingRound = FUNDING_ROUND + UTC_DAY_SECONDS;
  const secondRound = sealedRound({
    fundingRoundAtUnixSeconds: secondFundingRound,
    obligations: [obligation(secondFundingRound, 2)],
  });
  const reverseStore = roundStore({ rounds: [firstRound, secondRound] });
  const reverseBefore = reverseStore.snapshot();
  assert.throws(
    () => finalizeRewardCapacityRoundCas(finalizationInput(reverseStore, secondFundingRound)),
    /EARLIER_PENDING_ROUND_EXISTS/u,
  );
  assert.deepEqual(reverseStore.snapshot(), reverseBefore);
  const store = roundStore({ rounds: [firstRound, secondRound] });
  const firstInput = finalizationInput(store);
  const staleSecondInput = finalizationInput(store, secondFundingRound);
  finalizeRewardCapacityRoundCas(firstInput);
  const committed = store.snapshot();
  assert.throws(() => finalizeRewardCapacityRoundCas(firstInput), /ROUND_ALREADY_CONSUMED/u);
  assert.deepEqual(store.snapshot(), committed);
  assert.throws(
    () => finalizeRewardCapacityRoundCas(staleSecondInput),
    /STALE_VERSION_OR_DIGEST/u,
  );
  assert.deepEqual(store.snapshot(), committed);
  const currentSecondInput = finalizationInput(store, secondFundingRound);
  assert.throws(
    () => finalizeRewardCapacityRoundCas(currentSecondInput),
    /SEALED_LEDGER_SNAPSHOT_STALE/u,
  );
  assert.deepEqual(store.snapshot(), committed);
});

test("every injected round and Premium commit fault leaves the full snapshot byte-for-byte unchanged", () => {
  for (const point of ["AFTER_MARKER", "AFTER_PROOF", "AFTER_FIRST_ENTITY", "BEFORE_HEAD"]) {
    const store = roundStore({ testOnlyFault: point });
    const before = store.snapshot();
    assert.throws(
      () => finalizeRewardCapacityRoundCas(finalizationInput(store)),
      new RegExp(`TEST_ONLY_REWARD_CAS_FAULT_${point}`, "u"),
    );
    assert.deepEqual(store.snapshot(), before);
  }
  for (const point of ["AFTER_MARKER", "AFTER_FIRST_ENTITY", "BEFORE_HEAD"]) {
    const store = rewardStore({ testOnlyFault: point });
    const before = store.snapshot();
    assert.throws(
      () => recordPremiumUpgradeCas(upgradeInput(store)),
      new RegExp(`TEST_ONLY_REWARD_CAS_FAULT_${point}`, "u"),
    );
    assert.deepEqual(store.snapshot(), before);
  }
});

test("Premium upgrade is one-shot, rejects exact and alternate replay, and is fully recoverable by reads", () => {
  const store = rewardStore();
  const input = upgradeInput(store);
  const result = recordPremiumUpgradeCas(input);
  const committed = store.snapshot();
  assert.equal(validateRewardCasSnapshot(committed), committed);
  assert.equal(result.rewardRecord.value.latestSubscriptionType, "Premium");
  assert.equal(result.rewardRecord.value.upgradeTranche.amount, 900n);
  assert.deepEqual(store.readUpgradeAttempt(input.rewardId), result.upgradeAttempt);
  assert.deepEqual(store.readEntity(REWARD_CAS_ENTITY_KIND.X_REWARD, input.rewardId), result.rewardRecord);
  assert.deepEqual(store.readCommit(1n), result.commit);
  assert.throws(() => recordPremiumUpgradeCas(input), /UPGRADE_ATTEMPT_ALREADY_RECORDED/u);
  assert.deepEqual(store.snapshot(), committed);
  assert.throws(
    () => recordPremiumUpgradeCas({ ...input, premiumEvidenceSha256: "cd".repeat(32) }),
    /UPGRADE_ATTEMPT_ALREADY_RECORDED/u,
  );
  assert.deepEqual(store.snapshot(), committed);
  const missingAttempt = structuredClone(committed);
  missingAttempt.upgradeAttempts = [];
  assert.throws(
    () => validateRewardCasSnapshot(missingAttempt),
    /UPGRADE_COMMIT_REQUIRES_ATTEMPT/u,
  );
});

test("identical initial snapshots and inputs replay to exact commits, proofs, and heads", () => {
  const firstRoundStore = roundStore();
  const secondRoundStore = roundStore();
  assert.deepEqual(
    finalizeRewardCapacityRoundCas(finalizationInput(firstRoundStore)),
    finalizeRewardCapacityRoundCas(finalizationInput(secondRoundStore)),
  );
  assert.deepEqual(firstRoundStore.snapshot(), secondRoundStore.snapshot());
  const firstRewardStore = rewardStore();
  const secondRewardStore = rewardStore();
  assert.deepEqual(
    recordPremiumUpgradeCas(upgradeInput(firstRewardStore)),
    recordPremiumUpgradeCas(upgradeInput(secondRewardStore)),
  );
  assert.deepEqual(firstRewardStore.snapshot(), secondRewardStore.snapshot());
});

test("Daily Law is validated before every exported commit path and leaves state unchanged", () => {
  const round = roundStore();
  const roundBefore = round.snapshot();
  assert.throws(
    () => finalizeRewardCapacityRoundCas({ ...finalizationInput(round), dailyLawState: LOCKED_LAW }),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.deepEqual(round.snapshot(), roundBefore);
  const reward = rewardStore();
  const rewardBefore = reward.snapshot();
  assert.throws(
    () => recordPremiumUpgradeCas({ ...upgradeInput(reward), dailyLawState: LOCKED_LAW }),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.deepEqual(reward.snapshot(), rewardBefore);
  assert.throws(() => createRewardCasCommit({
    dailyLawState: {},
    head: {},
    operation: "FORGED",
    changes: [],
    evidenceSha256: "not-a-digest",
  }), /INVALID_IAT_DAILY_LAW_STATE/u);
  let laterFieldRead = false;
  const poisonCommitInput = {
    dailyLawState: {},
    get head() {
      laterFieldRead = true;
      throw new Error("HEAD_WAS_READ_BEFORE_DAILY_LAW");
    },
  };
  assert.throws(() => createRewardCasCommit(poisonCommitInput), /INVALID_IAT_DAILY_LAW_STATE/u);
  assert.equal(laterFieldRead, false);
  assert.throws(
    () => round[REWARD_CAS_STORE_ADAPTER].finalizeRound({
      dailyLawState: {},
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
    }),
    /INVALID_IAT_DAILY_LAW_STATE/u,
  );
  assert.deepEqual(round.snapshot(), roundBefore);
});

test("commit/head hashes are immutable, validated, clone-isolated, unauthenticated, and held", () => {
  const store = roundStore();
  const result = finalizeRewardCapacityRoundCas(finalizationInput(store));
  const head = store.readHead();
  assert.equal(validateRewardCasHead(head), head);
  assert.equal(validateRewardCasCommit(result.commit), result.commit);
  for (const artifact of [
    head,
    result.commit,
    result.roundConsumption,
    result.proofRecord,
    result.roundRecord,
    result.ledgerRecord,
  ]) {
    assert.equal(artifact.runtimeAuthenticationVerified, false);
    assert.equal(artifact.rollbackProtectionVerified, false);
    assert.equal(artifact.activationReady, false);
    assert.equal(artifact.mainnetStatus, "HOLD");
  }
  assert.equal(head.rollbackProtectionVerified, false);
  assert.equal(head.mainnetStatus, REWARD_CAS_MAINNET_STATUS);
  assert.equal(result.commit.status, REWARD_CAS_STATUS);
  assert.equal(result.commit.rollbackProtectionVerified, false);
  assert.equal(result.commit.mainnetStatus, "HOLD");
  assert.equal(result.commit.operation, REWARD_CAS_OPERATION.FINALIZE_ROUND);
  const committed = store.snapshot();
  result.commit.changes[0].nextStateSha256 = "ff".repeat(32);
  head.headCommitSha256 = "ee".repeat(32);
  assert.deepEqual(store.snapshot(), committed);
  const tampered = structuredClone(committed);
  tampered.commits[0].previousCommitSha256 = "dd".repeat(32);
  assert.throws(() => validateRewardCasSnapshot(tampered), /CHAIN_MISMATCH|DIGEST_MISMATCH/u);
  assert.equal(createInitialRewardCasHead().headCommitSha256, REWARD_CAS_ZERO_SHA256);
});
