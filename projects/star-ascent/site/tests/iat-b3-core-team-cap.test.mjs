import assert from "node:assert/strict";
import test from "node:test";

import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";
import {
  CORE_CAP_WITHDRAWAL_DISPOSITION,
  I64_MAX,
  U64_MAX,
  CORE_TEAM_CAP_DENOMINATOR,
  CORE_TEAM_CAP_NUMERATOR,
  coreCapLocalDay,
  coreWithdrawalDisposition,
  postBurnCoreCapHolds,
  reconcileCoreCapAndFinalizeDailyLaw,
  requiredCoreCustodyBurn,
} from "../programs/iat_b3_reference/core-team-cap.mjs";

const IAT = 1_000_000_000n;
const LOCAL_MIDNIGHT_UTC = 1_786_050_000n;
const TEST_SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_MIDNIGHT_UTC - 86_460n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-testnet-1",
});
const PREVIOUS_DAILY_LAW_DAY = protocolLocalDay(LOCAL_MIDNIGHT_UTC);
const PREVIOUS_OPEN_DECISION = createLockdownDecision({
  localDay: PREVIOUS_DAILY_LAW_DAY,
  randomnessOutputHex: "00".repeat(32),
  schedule: TEST_SCHEDULE,
});
const OPEN_PREVIOUS_DAILY_LAW_STATE = createDailyLawState({
  protocolHeight: 86_460n,
  schedule: TEST_SCHEDULE,
  currentDecision: PREVIOUS_OPEN_DECISION,
});
const CURRENT_UNFINALIZED_DAILY_LAW_STATE = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: null,
  previousDecision: PREVIOUS_OPEN_DECISION,
});

test("core-cap day rolls at exactly 00:00 fixed UTC+03:00", () => {
  assert.equal(coreCapLocalDay(LOCAL_MIDNIGHT_UTC - 1n), 20_671n);
  assert.equal(coreCapLocalDay(LOCAL_MIDNIGHT_UTC), 20_672n);
});

test("the original 100M core vault is exactly within a 1B live supply", () => {
  assert.equal(
    requiredCoreCustodyBurn({
      mintSupply: 1_000_000_000n * IAT,
      coreCustodyBalance: 100_000_000n * IAT,
    }),
    0n,
  );
});

test("burn math uses post-burn supply and chooses the smallest valid integer", () => {
  const supply = 900_000_000n * IAT;
  const core = 100_000_000n * IAT;
  const burn = requiredCoreCustodyBurn({
    mintSupply: supply,
    coreCustodyBalance: core,
  });

  assert.equal(burn, 11_111_111_111_111_112n);
  assert.equal(
    postBurnCoreCapHolds({
      mintSupply: supply,
      coreCustodyBalance: core,
      burnAmount: burn,
    }),
    true,
  );
  assert.equal(
    postBurnCoreCapHolds({
      mintSupply: supply,
      coreCustodyBalance: core,
      burnAmount: burn - 1n,
    }),
    false,
  );
});

test("daily reconciliation conserves the exact burn and is idempotent", () => {
  const transition = reconcileCoreCapAndFinalizeDailyLaw({
    unixTimestamp: LOCAL_MIDNIGHT_UTC + 60n,
    lastReconciledLocalDay: 20_671n,
    mintSupply: 900_000_000n * IAT,
    coreCustodyBalance: 100_000_000n * IAT,
    dailyLawState: CURRENT_UNFINALIZED_DAILY_LAW_STATE,
    randomnessOutputHex: "00".repeat(32),
  });
  const result = transition.reconciliation;

  assert.equal(result.localDay, 20_672n);
  assert.equal(
    result.postBurnMintSupply + result.burnAmount,
    900_000_000n * IAT,
  );
  assert.equal(
    result.postBurnCoreCustodyBalance + result.burnAmount,
    100_000_000n * IAT,
  );
  assert.throws(
    () =>
      reconcileCoreCapAndFinalizeDailyLaw({
        unixTimestamp: LOCAL_MIDNIGHT_UTC + 60n,
        lastReconciledLocalDay: result.localDay,
        mintSupply: result.postBurnMintSupply,
        coreCustodyBalance: result.postBurnCoreCustodyBalance,
        dailyLawState: CURRENT_UNFINALIZED_DAILY_LAW_STATE,
        randomnessOutputHex: "00".repeat(32),
      }),
    /CORE_CAP_DAY_ALREADY_RECONCILED/u,
  );
});

test("core withdrawals fail closed until the current day is reconciled", () => {
  assert.equal(
    coreWithdrawalDisposition({
      unixTimestamp: LOCAL_MIDNIGHT_UTC,
      lastReconciledLocalDay: 20_671n,
      dailyLawState: OPEN_PREVIOUS_DAILY_LAW_STATE,
    }),
    CORE_CAP_WITHDRAWAL_DISPOSITION.RECONCILIATION_REQUIRED,
  );
  assert.equal(
    coreWithdrawalDisposition({
      unixTimestamp: LOCAL_MIDNIGHT_UTC,
      lastReconciledLocalDay: 20_672n,
      dailyLawState: OPEN_PREVIOUS_DAILY_LAW_STATE,
    }),
    CORE_CAP_WITHDRAWAL_DISPOSITION.RECONCILIATION_REQUIRED,
  );
  assert.equal(
    coreWithdrawalDisposition({
      unixTimestamp: LOCAL_MIDNIGHT_UTC,
      lastReconciledLocalDay: 20_673n,
      dailyLawState: OPEN_PREVIOUS_DAILY_LAW_STATE,
    }),
    CORE_CAP_WITHDRAWAL_DISPOSITION.STATE_CORRUPT,
  );
});

test("00:00 cannot perform the sole atomic reconciliation/finalization transition", () => {
  assert.throws(
    () =>
      reconcileCoreCapAndFinalizeDailyLaw({
        unixTimestamp: LOCAL_MIDNIGHT_UTC,
        lastReconciledLocalDay: 20_671n,
        mintSupply: 1_000_000_000n * IAT,
        coreCustodyBalance: 100_000_000n * IAT,
        dailyLawState: CURRENT_UNFINALIZED_DAILY_LAW_STATE,
        randomnessOutputHex: "00".repeat(32),
      }),
    /CORE_CAP_DAILY_LAW_DAY_MISMATCH/u,
  );
});

test("invalid balances and future reconciliation state fail closed", () => {
  assert.throws(
    () =>
      requiredCoreCustodyBurn({
        mintSupply: 10n,
        coreCustodyBalance: 11n,
      }),
    /cannot exceed mintSupply/u,
  );
  assert.throws(
    () =>
      reconcileCoreCapAndFinalizeDailyLaw({
        unixTimestamp: LOCAL_MIDNIGHT_UTC + 60n,
        lastReconciledLocalDay: 20_673n,
        mintSupply: 10n,
        coreCustodyBalance: 1n,
        dailyLawState: CURRENT_UNFINALIZED_DAILY_LAW_STATE,
        randomnessOutputHex: "00".repeat(32),
      }),
    /CORE_CAP_STATE_FROM_FUTURE_DAY/u,
  );
});

test("the cap constants are immutable one tenth", () => {
  assert.equal(CORE_TEAM_CAP_NUMERATOR, 1n);
  assert.equal(CORE_TEAM_CAP_DENOMINATOR, 10n);
});

test("reference inputs fail closed outside Solana integer ranges", () => {
  assert.throws(
    () =>
      requiredCoreCustodyBurn({
        mintSupply: U64_MAX + 1n,
        coreCustodyBalance: 0n,
      }),
    /exceeds u64/u,
  );
  assert.throws(() => coreCapLocalDay(I64_MAX + 1n), /exceeds i64/u);
});
