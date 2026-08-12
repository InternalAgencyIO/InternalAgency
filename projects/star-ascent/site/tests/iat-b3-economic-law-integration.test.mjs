import assert from "node:assert/strict";
import test from "node:test";

import {
  CORE_CAP_WITHDRAWAL_DISPOSITION,
  coreCapLocalDay,
  coreWithdrawalDisposition,
  reconcileCoreCapAndFinalizeDailyLaw,
} from "../programs/iat_b3_reference/core-team-cap.mjs";
import * as coreCapModule from "../programs/iat_b3_reference/core-team-cap.mjs";
import {
  FRIDAY_LOCKDOWN_NUMERATOR,
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";
import { applyAllegianceChange } from "../programs/iat_b3_reference/factions.mjs";

const LOCAL_0000_UTC = 1_786_050_000n;
const LOCAL_0001_UTC = LOCAL_0000_UTC + 60n;
const IAT = 1_000_000_000n;
const TEST_SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0000_UTC - 86_460n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-testnet-1",
});
const PREVIOUS_DAY = protocolLocalDay(LOCAL_0000_UTC);
const CURRENT_DAY = protocolLocalDay(LOCAL_0001_UTC);
const PREVIOUS_OPEN_DECISION = createLockdownDecision({
  localDay: PREVIOUS_DAY,
  randomnessOutputHex: "00".repeat(32),
  schedule: TEST_SCHEDULE,
});
const CURRENT_LOCKED_DECISION = createLockdownDecision({
  localDay: CURRENT_DAY,
  randomnessOutputHex: `${"00".repeat(31)}01`,
  schedule: TEST_SCHEDULE,
});
const CURRENT_OPEN_DECISION = createLockdownDecision({
  localDay: CURRENT_DAY,
  randomnessOutputHex: "00".repeat(32),
  schedule: TEST_SCHEDULE,
});
const PREVIOUS_OPEN_STATE = createDailyLawState({
  protocolHeight: 86_460n,
  schedule: TEST_SCHEDULE,
  currentDecision: PREVIOUS_OPEN_DECISION,
});
const CURRENT_UNFINALIZED_STATE = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: null,
  previousDecision: PREVIOUS_OPEN_DECISION,
});
const CURRENT_LOCKED_STATE = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: CURRENT_LOCKED_DECISION,
  previousDecision: PREVIOUS_OPEN_DECISION,
});
const CURRENT_OPEN_STATE = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: CURRENT_OPEN_DECISION,
  previousDecision: PREVIOUS_OPEN_DECISION,
});

test("00:00 cap day leads the 00:01 lockdown day by exactly one minute", () => {
  assert.equal(coreCapLocalDay(LOCAL_0000_UTC), 20_672n);
  assert.equal(protocolLocalDay(LOCAL_0000_UTC), 20_671n);
  assert.equal(coreCapLocalDay(LOCAL_0001_UTC - 1n), 20_672n);
  assert.equal(protocolLocalDay(LOCAL_0001_UTC - 1n), 20_671n);
  assert.equal(protocolLocalDay(LOCAL_0001_UTC), 20_672n);
});

test("the 00:00 standalone preliminary reconciliation path is inaccessible", () => {
  assert.equal("reconcileCoreCapDay" in coreCapModule, false);
  assert.equal(
    coreWithdrawalDisposition({
      unixTimestamp: LOCAL_0000_UTC,
      lastReconciledLocalDay: CURRENT_DAY,
      dailyLawState: PREVIOUS_OPEN_STATE,
    }),
    CORE_CAP_WITHDRAWAL_DISPOSITION.RECONCILIATION_REQUIRED,
  );
});

test("one atomic sequence reconciles the cap before creating the 00:01 decision", () => {
  const result = reconcileCoreCapAndFinalizeDailyLaw({
    unixTimestamp: LOCAL_0001_UTC,
    lastReconciledLocalDay: PREVIOUS_DAY,
    mintSupply: 1_000_000_000n * IAT,
    coreCustodyBalance: 100_000_000n * IAT,
    dailyLawState: CURRENT_UNFINALIZED_STATE,
    randomnessOutputHex: `${"00".repeat(31)}01`,
  });

  assert.equal(result.reconciliation.localDay, CURRENT_DAY);
  assert.equal(result.lockdownDecision.localDay, CURRENT_DAY);
  assert.equal(result.lockdownDecision.locked, true);
  assert.equal(result.lockdownDecision.chanceNumerator, FRIDAY_LOCKDOWN_NUMERATOR);
});

test("an inbound custody change before finalization is included in the atomic burn", () => {
  const balanceObservedAtMidnight = 100_000_000n * IAT;
  const inboundBeforeFinalization = 10_000_000n * IAT;
  const result = reconcileCoreCapAndFinalizeDailyLaw({
    unixTimestamp: LOCAL_0001_UTC,
    lastReconciledLocalDay: PREVIOUS_DAY,
    mintSupply: 1_000_000_000n * IAT,
    coreCustodyBalance: balanceObservedAtMidnight + inboundBeforeFinalization,
    dailyLawState: CURRENT_UNFINALIZED_STATE,
    randomnessOutputHex: "00".repeat(32),
  });

  assert.equal(result.reconciliation.burnAmount, 11_111_111_111_111_112n);
  assert.equal(
    result.reconciliation.postBurnCoreCustodyBalance,
    balanceObservedAtMidnight + inboundBeforeFinalization - result.reconciliation.burnAmount,
  );
});

test("the atomic transition cannot rerun and withdrawal stays blocked after a selected lock", () => {
  assert.throws(
    () =>
      reconcileCoreCapAndFinalizeDailyLaw({
        unixTimestamp: LOCAL_0001_UTC,
        lastReconciledLocalDay: PREVIOUS_DAY,
        mintSupply: 1_000_000_000n * IAT,
        coreCustodyBalance: 100_000_000n * IAT,
        dailyLawState: CURRENT_LOCKED_STATE,
        randomnessOutputHex: "00".repeat(32),
      }),
    /IAT_DAY_ALREADY_FINALIZED/u,
  );
  assert.throws(
    () =>
      coreWithdrawalDisposition({
        unixTimestamp: LOCAL_0001_UTC,
        lastReconciledLocalDay: CURRENT_DAY,
        dailyLawState: CURRENT_LOCKED_STATE,
      }),
    /IAT_DAILY_LOCKDOWN/u,
  );
});

test("locked and unfinalized canonical days both reject faction writes", () => {
  for (const [dailyLawState, expectedError] of [
    [CURRENT_LOCKED_STATE, /IAT_DAILY_LOCKDOWN/u],
    [CURRENT_UNFINALIZED_STATE, /IAT_DAY_UNFINALIZED/u],
  ]) {
    assert.throws(
      () =>
        applyAllegianceChange({
          operator: "operator-law-boundary",
          nextFactionId: "radiance",
          unixTimestamp: LOCAL_0001_UTC,
          dailyLawState,
        }),
      expectedError,
    );
  }
});

test("forged ALLOWED state and forged open decisions cannot bypass Daily Law", () => {
  for (const dailyLawState of [
    "ALLOWED",
    { disposition: "ALLOWED" },
    { ...CURRENT_OPEN_STATE },
  ]) {
    assert.throws(
      () =>
        applyAllegianceChange({
          operator: "operator-forged-law",
          nextFactionId: "radiance",
          unixTimestamp: LOCAL_0001_UTC,
          dailyLawState,
        }),
      /INVALID_IAT_DAILY_LAW_STATE/u,
    );
  }
  assert.throws(
    () =>
      createDailyLawState({
        protocolHeight: 86_520n,
        schedule: TEST_SCHEDULE,
        currentDecision: { ...CURRENT_LOCKED_DECISION, locked: false },
      }),
    /invalid lockdown decision field: locked/u,
  );
});

test("a canonical open decision still requires current-day cap reconciliation", () => {
  assert.equal(
    coreWithdrawalDisposition({
      unixTimestamp: LOCAL_0001_UTC,
      lastReconciledLocalDay: PREVIOUS_DAY,
      dailyLawState: CURRENT_OPEN_STATE,
    }),
    CORE_CAP_WITHDRAWAL_DISPOSITION.RECONCILIATION_REQUIRED,
  );
});
