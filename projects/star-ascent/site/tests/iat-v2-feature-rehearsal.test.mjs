import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  IAT_V2_SECONDS_PER_DAY,
  IAT_V2_POSITION_TERM_WEEKS,
  IAT_V2_SECONDS_PER_WEEK,
  assertIatV2RehearsalAllocationBalances,
  currentIatV2CccRound,
  currentIatV2Week,
  earliestDueIatV2PositionWeek,
  formatRehearsalWait,
  isIatV2LinkedRoundReadyForSettlement,
  iterateUnsetIatV2PositionWeeks,
  selectIatV2FeatureDuePositionSettlement,
  secondsUntilIatV2CccRound,
  secondsUntilIatV2RoundRecovery,
  secondsUntilIatV2Week,
} from "../programs/iat_v2/feature-rehearsal.mjs";
import {
  BPF_UPGRADEABLE_LOADER_ID,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
} from "../programs/iat_v2/instructions.mjs";
import {
  EXTEND_PROGRAM_CHECKED_FEATURE_ID,
  FEATURE_PROGRAM_ID,
  buildProgramDataExtensionTransaction,
  computeProgramDataExtension,
  inspectExtendProgramCheckedFeature,
} from "../tools/iat-v2-admin-console/program-extension.mjs";

const featureConsoleSource = readFileSync(
  "tools/iat-v2-admin-console/FeatureRehearsal.jsx",
  "utf8",
);
const migrationConsoleSource = readFileSync(
  "tools/iat-v2-admin-console/LegacyRoundMigration.jsx",
  "utf8",
);
const upgradeConsoleSource = readFileSync(
  "tools/iat-v2-admin-console/ProgramUpgrade.jsx",
  "utf8",
);
const adminConsoleSource = readFileSync(
  "tools/iat-v2-admin-console/main.jsx",
  "utf8",
);

const allocations = {
  community: { amount: 500n },
  treasury: { amount: 200n },
  ecosystem: { amount: 150n },
  coreTeam: { amount: 100n },
  liquidity: { amount: 50n },
};

test("allocation verification permits only legitimate post-activation outflows", () => {
  const exact = {
    community: 500n,
    treasury: 200n,
    ecosystem: 150n,
    coreTeam: 100n,
    liquidity: 50n,
  };
  assert.doesNotThrow(() => assertIatV2RehearsalAllocationBalances({
    balances: exact,
    allocationDestinations: allocations,
    active: false,
  }));
  assert.throws(
    () => assertIatV2RehearsalAllocationBalances({
      balances: { ...exact, community: 470n },
      allocationDestinations: allocations,
      active: false,
    }),
    /community balance is 470, expected 500/,
  );
  assert.doesNotThrow(() => assertIatV2RehearsalAllocationBalances({
    balances: {
      community: 470n,
      treasury: 199n,
      ecosystem: 150n,
      coreTeam: 100n,
      liquidity: 37n,
    },
    allocationDestinations: allocations,
    active: true,
  }));
  assert.throws(
    () => assertIatV2RehearsalAllocationBalances({
      balances: { ...exact, treasury: 201n },
      allocationDestinations: allocations,
      active: true,
    }),
    /treasury balance is 201, above original allocation 200/,
  );
});

test("policy weeks and CCC rounds preserve the reviewed 24-hour offset", () => {
  const genesis = 1_800_000_000;
  assert.equal(currentIatV2Week(genesis, genesis), 0);
  assert.equal(currentIatV2CccRound(genesis, genesis), null);
  assert.equal(currentIatV2CccRound(genesis, genesis + IAT_V2_SECONDS_PER_DAY), 0);
  assert.equal(
    currentIatV2Week(genesis, genesis + IAT_V2_SECONDS_PER_WEEK),
    1,
  );
  assert.equal(
    currentIatV2CccRound(genesis, genesis + IAT_V2_SECONDS_PER_WEEK),
    0,
  );
  assert.equal(
    currentIatV2CccRound(
      genesis,
      genesis + IAT_V2_SECONDS_PER_DAY + IAT_V2_SECONDS_PER_WEEK,
    ),
    1,
  );
});

test("wait helpers expose the unavoidable CCC-linked settlement delay", () => {
  const genesis = 1_800_000_000;
  const justBeforeWeekEight = genesis + (8 * IAT_V2_SECONDS_PER_WEEK) - 3_600;
  assert.equal(secondsUntilIatV2Week(genesis, 8, justBeforeWeekEight), 3_600);
  assert.equal(
    secondsUntilIatV2CccRound(genesis, 8, justBeforeWeekEight),
    IAT_V2_SECONDS_PER_DAY + 3_600,
  );
  assert.equal(formatRehearsalWait(IAT_V2_SECONDS_PER_DAY + 3_600), "1d 1h 0m");
});

test("round recovery wait flips only at the exact 24-hour reveal timeout", () => {
  const committedAt = 1_900_000_000;
  assert.equal(
    secondsUntilIatV2RoundRecovery(committedAt, committedAt + IAT_V2_SECONDS_PER_DAY - 1),
    1,
  );
  assert.equal(
    secondsUntilIatV2RoundRecovery(committedAt, committedAt + IAT_V2_SECONDS_PER_DAY),
    0,
  );
  assert.throws(
    () => secondsUntilIatV2RoundRecovery(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    /outside the safe integer range/,
  );
});

test("the 52-bit iterator preserves ordinal zero and finds the earliest gap", () => {
  assert.equal(IAT_V2_POSITION_TERM_WEEKS, 52);
  assert.deepEqual(
    [...iterateUnsetIatV2PositionWeeks({
      firstAccrualWeek: 9n,
      settledMask: 0n,
    })].slice(0, 3),
    [
      { ordinal: 0, week: 9 },
      { ordinal: 1, week: 10 },
      { ordinal: 2, week: 11 },
    ],
  );
  assert.deepEqual(
    [...iterateUnsetIatV2PositionWeeks({
      firstAccrualWeek: 9n,
      settledMask: 0b0101n,
    })].slice(0, 2),
    [
      { ordinal: 1, week: 10 },
      { ordinal: 3, week: 12 },
    ],
  );
  assert.deepEqual(
    [...iterateUnsetIatV2PositionWeeks({
      firstAccrualWeek: 9n,
      settledMask: (1n << 52n) - 1n,
    })],
    [],
  );
});

test("due-week selection rejects future weeks and malformed masks", () => {
  assert.equal(earliestDueIatV2PositionWeek({
    firstAccrualWeek: 9n,
    settledMask: 0n,
    currentWeek: 8,
  }), null);
  assert.deepEqual(earliestDueIatV2PositionWeek({
    firstAccrualWeek: 9n,
    settledMask: 0n,
    currentWeek: 9,
  }), { ordinal: 0, week: 9 });
  assert.equal(earliestDueIatV2PositionWeek({
    firstAccrualWeek: 9n,
    settledMask: 1n,
    currentWeek: 9,
  }), null);
  assert.deepEqual(earliestDueIatV2PositionWeek({
    firstAccrualWeek: 9n,
    settledMask: 1n,
    currentWeek: 10,
  }), { ordinal: 1, week: 10 });
  for (const hostileMask of [-1n, 1n << 52n, 0]) {
    assert.throws(
      () => [...iterateUnsetIatV2PositionWeeks({
        firstAccrualWeek: 9n,
        settledMask: hostileMask,
      })],
      /unsigned 52-bit bigint/u,
    );
  }
});

test("linked weekly settlement accepts only terminal round states", () => {
  assert.equal(isIatV2LinkedRoundReadyForSettlement({ status: 0 }), false);
  assert.equal(isIatV2LinkedRoundReadyForSettlement({ status: 1 }), true);
  assert.equal(isIatV2LinkedRoundReadyForSettlement({ status: 2 }), true);
  assert.equal(isIatV2LinkedRoundReadyForSettlement({ status: 3 }), false);
  assert.equal(isIatV2LinkedRoundReadyForSettlement({ status: "1" }), false);
  assert.equal(isIatV2LinkedRoundReadyForSettlement(null), false);
});

test("a due standard week 9 blocks linked work and the CCC round 9 commit", () => {
  const positions = [
    { firstAccrualWeek: 9n, settledMask: 0n },
    { firstAccrualWeek: 9n, settledMask: 0n },
    { firstAccrualWeek: 9n, settledMask: 0n },
  ];
  assert.deepEqual(selectIatV2FeatureDuePositionSettlement({
    positions,
    currentWeek: 9,
    linkedRounds: { 9: { status: 1 } },
  }), {
    positionIndex: 0,
    ordinal: 0,
    week: 9,
    round: null,
  });

  const plannerSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("function nextFeatureAction"),
    featureConsoleSource.indexOf("function waitDescription"),
  );
  const settlementPriority = plannerSource.indexOf(
    "const dueSettlement = selectIatV2FeatureDuePositionSettlement",
  );
  const randomnessCreation = plannerSource.indexOf("if (!state.randomnessAddress)");
  const roundCommit = plannerSource.indexOf(
    "if (state.currentCccRound !== null && !state.currentRound)",
  );
  assert.ok(settlementPriority >= 0, "due settlement selector is missing");
  assert.ok(randomnessCreation > settlementPriority, "randomness creation jumped ahead of settlement");
  assert.ok(roundCommit > settlementPriority, "CCC commit jumped ahead of due standard settlement");
  assert.match(
    plannerSource.slice(settlementPriority, randomnessCreation),
    /SETTLE_STANDARD_POSITION_WEEK_\$\{dueSettlement\.week\}[\s\S]*ordinal: dueSettlement\.ordinal/u,
  );

  assert.deepEqual(selectIatV2FeatureDuePositionSettlement({
    positions: [
      { firstAccrualWeek: 8n, settledMask: 1n },
      { firstAccrualWeek: 8n, settledMask: 1n },
      { firstAccrualWeek: 8n, settledMask: 1n },
    ],
    currentWeek: 9,
    linkedRounds: { 9: { status: 1 } },
  }), {
    positionIndex: 0,
    ordinal: 1,
    week: 9,
    round: null,
  }, "the exact live week-8/bit-0 state must advance to week 9/ordinal 1");
});

test("the browser loads only exact due linked-round PDAs", () => {
  const loaderSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("async function loadFeatureState"),
    featureConsoleSource.indexOf("function nextFeatureAction"),
  );
  const dueSelection = loaderSource.indexOf("const duePositionSettlements = positions.map");
  const linkedSelection = loaderSource.indexOf("const linkedRoundWeeks =");
  const linkedAddresses = loaderSource.indexOf("const linkedRoundAddresses =");
  assert.ok(dueSelection >= 0, "due position settlements are not computed");
  assert.ok(linkedSelection > dueSelection, "linked weeks are not derived from due settlements");
  assert.ok(linkedAddresses > linkedSelection, "linked Round PDAs are not derived after due weeks");
  const linkedSelectionSource = loaderSource.slice(linkedSelection, linkedAddresses);
  assert.match(linkedSelectionSource, /duePositionSettlements[\s\S]*settlement\.week/u);
  assert.doesNotMatch(linkedSelectionSource, /firstAccrualWeek/u);
});

test("the UI exposes exactly one action through separate user clicks", () => {
  assert.match(featureConsoleSource, /ONE VERIFIED ACTION \/\/ EXPLICIT USER STEPS ONLY/u);
  assert.match(featureConsoleSource, /<button onClick=\{simulateAndRequestSignature\}/u);
  assert.match(featureConsoleSource, /<button onClick=\{broadcastSigned\}/u);
  const effectsSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("useEffect(() =>"),
    featureConsoleSource.indexOf("async function simulateAndRequestSignature"),
  );
  assert.doesNotMatch(
    effectsSource,
    /(?:simulateAndRequestSignature|broadcastSigned)\s*\(/u,
  );
  assert.match(
    featureConsoleSource,
    /Long-term maturity remains a deterministic production-host time-gate proof; Devnet wall-clock time is not warped\./u,
  );
  assert.doesNotMatch(featureConsoleSource, /validator time-warp proof/u);
});

test("the browser never offers timestamp recovery for a deployed legacy Round", () => {
  assert.match(
    featureConsoleSource,
    /currentRound\.layoutVersion === IAT_V2_ROUND_LAYOUT\.LEGACY_V1[\s\S]*id: `REVEAL_CCC_ROUND_/u,
  );
  assert.match(
    featureConsoleSource,
    /deployed 198-byte V1 round has no timestamp or neutral-expiry instruction/u,
  );
  assert.match(
    featureConsoleSource,
    /EXPIRE_CCC_ROUND_[\s\S]*layoutVersion === IAT_V2_ROUND_LAYOUT\.LEGACY_V1[\s\S]*has no neutral-expiry instruction/u,
  );
});

test("legacy-round migration is localhost-only, CI-pinned, and requires separate clicks", () => {
  assert.match(adminConsoleSource, /get\("mode"\) === "migrate-rounds"/u);
  assert.match(migrationConsoleSource, /Legacy-round migration console is localhost-only/u);
  assert.match(migrationConsoleSource, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(migrationConsoleSource, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256/u);
  assert.match(migrationConsoleSource, /matchesReviewedArtifact/u);
  assert.match(migrationConsoleSource, /getMultipleAccountsInfo/u);
  assert.match(migrationConsoleSource, /programInfo\.executable/u);
  assert.match(migrationConsoleSource, /programInfo\.owner\.equals\(BPF_UPGRADEABLE_LOADER_ID\)/u);
  assert.match(migrationConsoleSource, /programDataInfo\.owner\.equals\(BPF_UPGRADEABLE_LOADER_ID\)/u);
  assert.match(migrationConsoleSource, /parseUpgradeableProgramAccounts/u);
  assert.match(migrationConsoleSource, /IAT_V2_ROUND_LAYOUT\.LEGACY_V1_BYTES/u);
  assert.match(migrationConsoleSource, /round\.status !== IAT_V2_ROUND_STATUS\.SETTLED/u);
  assert.match(migrationConsoleSource, /<button onClick=\{\(\) => simulateAndSignMigration\(round\.address\)\}/u);
  assert.match(migrationConsoleSource, /<button onClick=\{broadcastSigned\}/u);
  assert.match(migrationConsoleSource, /DISCARD SIGNED TRANSACTION/u);
  const effectSource = migrationConsoleSource.slice(
    migrationConsoleSource.indexOf("useEffect(() =>"),
    migrationConsoleSource.indexOf("async function simulateAndSign"),
  );
  assert.doesNotMatch(effectSource, /(?:simulateAndSign|broadcastSigned)\s*\(/u);
  assert.match(migrationConsoleSource, /simulateTransaction\(transaction\)[\s\S]*provider\.signTransaction/u);
  assert.match(migrationConsoleSource, /signed\.serializeMessage\(\)[\s\S]*messageSha256/u);
  assert.match(migrationConsoleSource, /signed\.verifySignatures\(\)/u);
  assert.match(migrationConsoleSource, /const FINALIZED_COMMITMENT = "finalized"/u);
  assert.match(migrationConsoleSource, /confirmTransaction\([\s\S]*FINALIZED_COMMITMENT\)/u);
});

test("historical weeks 9 and 10 use a fail-closed rehearsal-only neutral recovery", () => {
  const programSource = readFileSync("programs/iat_v2/src/lib.rs", "utf8");
  const policySource = readFileSync("programs/iat_v2/src/policy.rs", "utf8");
  assert.match(programSource, /pub fn backfill_historical_neutral_round/u);
  assert.match(
    programSource,
    /config\.rehearsal_mode[\s\S]*HistoricalNeutralBackfillProductionForbidden/u,
  );
  assert.match(programSource, /week < current_round/u);
  assert.match(programSource, /ccc_round_recovery_available\(canonical_selection_timestamp/u);
  assert.match(programSource, /round\.randomness_account = Pubkey::default\(\)/u);
  assert.match(programSource, /round\.commit_slot = 0/u);
  assert.match(programSource, /round\.randomness = \[0; 32\]/u);
  assert.match(programSource, /round\.selected_agency_index = u32::MAX/u);
  assert.match(programSource, /round\.derivation_counter = u32::MAX/u);
  assert.match(programSource, /round\.status = ROUND_EXPIRED_NEUTRAL/u);
  assert.match(programSource, /require_isolated_iat_instruction/u);
  assert.match(programSource, /current_instruction\.program_id,[\s\S]*crate::ID/u);
  assert.match(programSource, /wrapper_cpi_shape_and_second_iat_instruction_are_rejected/u);
  assert.match(programSource, /previous_week = week[\s\S]*checked_sub\(1\)/u);
  assert.match(programSource, /ctx\.accounts\.previous_round\.key\(\),[\s\S]*expected_previous_round/u);
  assert.match(programSource, /ROUND_SETTLED \| ROUND_EXPIRED_NEUTRAL/u);
  assert.match(programSource, /historical_neutral_snapshot_matches\([\s\S]*previous_round\.agency_count_snapshot[\s\S]*previous_round\.agency_registry_hash_snapshot[\s\S]*config\.agency_count[\s\S]*config\.agency_registry_hash/u);
  assert.match(programSource, /historical_neutral_denominator_requires_the_exact_previous_snapshot/u);
  assert.match(policySource, /pub fn ccc_round_selection_timestamp/u);

  assert.match(migrationConsoleSource, /HISTORICAL_NEUTRAL_WEEKS = Object\.freeze\(\[9n, 10n\]\)/u);
  assert.match(migrationConsoleSource, /!configState\.rehearsalMode/u);
  assert.match(migrationConsoleSource, /round\.status === IAT_V2_ROUND_STATUS\.EXPIRED_NEUTRAL/u);
  assert.match(migrationConsoleSource, /round\.randomnessAccount\.equals\(SystemProgram\.programId\)/u);
  assert.match(migrationConsoleSource, /transaction\.instructions\.length !== 1/u);
  assert.match(migrationConsoleSource, /previousProofReady/u);
  assert.match(migrationConsoleSource, /PRIOR-WEEK PROOF/u);
  assert.match(migrationConsoleSource, /buildBackfillHistoricalNeutralRoundInstruction/u);
  assert.match(migrationConsoleSource, /simulateAndSignBackfill\(round\.address\)/u);
  assert.match(migrationConsoleSource, /NO RANDOMNESS OR WINNER/u);
  const effectSource = migrationConsoleSource.slice(
    migrationConsoleSource.indexOf("useEffect(() =>"),
    migrationConsoleSource.indexOf("async function simulateAndSignMigration"),
  );
  assert.doesNotMatch(effectSource, /(?:simulateAndSignBackfill|broadcastSigned)\s*\(/u);
});

test("program upgrade and legacy migration share one CI artifact and finalized handoff", () => {
  assert.match(upgradeConsoleSource, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(upgradeConsoleSource, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256/u);
  assert.doesNotMatch(upgradeConsoleSource, /\bIAT_V2_PROGRAM_ARTIFACT_(?:BYTES|SHA256)\b/u);
  assert.match(upgradeConsoleSource, /expectedArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(upgradeConsoleSource, /expectedArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256/u);
  assert.match(upgradeConsoleSource, /const FINALIZED_COMMITMENT = "finalized"/u);
  assert.match(upgradeConsoleSource, /confirmTransaction\([\s\S]*FINALIZED_COMMITMENT/u);
  assert.match(upgradeConsoleSource, /href="\/\?mode=migrate-rounds"/u);
  assert.doesNotMatch(
    upgradeConsoleSource.slice(upgradeConsoleSource.indexOf("snapshot?.alreadyUpgraded")),
    /href="\/\?mode=features"/u,
  );
});

test("ProgramData capacity extension matches the installed loader ABI and exact rent delta", () => {
  const extension = computeProgramDataExtension({
    artifactBytes: 621_136,
    currentCapacityBytes: 597_336,
    currentAccountBytes: 597_381,
    currentLamports: 5_000_000,
    targetRentLamports: 5_200_000,
  });
  assert.deepEqual(extension, {
    artifactBytes: 621_136,
    currentCapacityBytes: 597_336,
    currentAccountBytes: 597_381,
    additionalBytes: 23_800,
    targetAccountBytes: 621_181,
    currentLamports: 5_000_000,
    targetRentLamports: 5_200_000,
    rentTopUpLamports: 200_000,
    extensionRequired: true,
  });

  const legacy = buildProgramDataExtensionTransaction({
    additionalBytes: extension.additionalBytes,
    authority: IAT_V2_PROGRAM_ADMIN,
    blockhash: "11111111111111111111111111111111",
    checked: false,
    feePayer: IAT_V2_PROGRAM_ADMIN,
    loaderProgramId: BPF_UPGRADEABLE_LOADER_ID,
    programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS,
    programId: IAT_V2_PROGRAM_ID,
  });
  const [legacyInstruction] = legacy.instructions;
  assert.equal(legacyInstruction.programId.toBase58(), BPF_UPGRADEABLE_LOADER_ID.toBase58());
  assert.equal(legacyInstruction.data.readUInt32LE(0), 6);
  assert.equal(legacyInstruction.data.readUInt32LE(4), 23_800);
  assert.deepEqual(
    legacyInstruction.keys.map(({ pubkey, isSigner, isWritable }) => ({
      pubkey: pubkey.toBase58(), isSigner, isWritable,
    })),
    [
      { pubkey: IAT_V2_PROGRAM_DATA_ADDRESS.toBase58(), isSigner: false, isWritable: true },
      { pubkey: IAT_V2_PROGRAM_ID.toBase58(), isSigner: false, isWritable: true },
      { pubkey: "11111111111111111111111111111111", isSigner: false, isWritable: false },
      { pubkey: IAT_V2_PROGRAM_ADMIN.toBase58(), isSigner: true, isWritable: true },
    ],
  );

  assert.deepEqual(inspectExtendProgramCheckedFeature(null), {
    active: false,
    activationSlot: null,
  });
  const featureData = Buffer.alloc(9);
  featureData[0] = 1;
  featureData.writeBigUInt64LE(441_000_000n, 1);
  assert.deepEqual(inspectExtendProgramCheckedFeature({
    owner: FEATURE_PROGRAM_ID,
    data: featureData,
  }), {
    active: true,
    activationSlot: 441_000_000n,
  });
  const checked = buildProgramDataExtensionTransaction({
    additionalBytes: 23_800,
    authority: IAT_V2_PROGRAM_ADMIN,
    blockhash: "11111111111111111111111111111111",
    checked: true,
    feePayer: IAT_V2_PROGRAM_ADMIN,
    loaderProgramId: BPF_UPGRADEABLE_LOADER_ID,
    programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS,
    programId: IAT_V2_PROGRAM_ID,
  }).instructions[0];
  assert.equal(checked.data.readUInt32LE(0), 9);
  assert.equal(checked.keys.length, 5);
  assert.equal(checked.keys[2].pubkey.toBase58(), IAT_V2_PROGRAM_ADMIN.toBase58());
  assert.equal(checked.keys[2].isSigner, true);
  assert.equal(checked.keys[4].pubkey.toBase58(), IAT_V2_PROGRAM_ADMIN.toBase58());
  assert.equal(checked.keys[4].isSigner, true);
  assert.equal(EXTEND_PROGRAM_CHECKED_FEATURE_ID.toBase58(), "2oMRZEDWT2tqtYMofhmmfQ8SsjqUFzT6sYXppQDavxwz");
});

test("capacity extension is an attended step and never auto-chains into upgrade", () => {
  assert.match(upgradeConsoleSource, /action: "extend-program"/u);
  assert.match(upgradeConsoleSource, /getMinimumBalanceForRentExemption/u);
  assert.match(upgradeConsoleSource, /SIMULATE \+ SIGN SEPARATE CAPACITY EXTENSION/u);
  assert.match(upgradeConsoleSource, /BROADCAST SIGNED CAPACITY EXTENSION/u);
  assert.match(upgradeConsoleSource, /EXACT RENT TOP-UP/u);
  assert.match(upgradeConsoleSource, /CAPACITY EXTENSION FINALIZED \/\/ BUFFER UPLOAD REMAINS A SEPARATE STEP/u);
  assert.match(upgradeConsoleSource, /No buffer upload or upgrade was auto-started/u);
  assert.match(upgradeConsoleSource, /preflightCommitment: FINALIZED_COMMITMENT/u);
  const mountEffect = upgradeConsoleSource.slice(
    upgradeConsoleSource.indexOf("useEffect(() =>"),
    upgradeConsoleSource.indexOf("async function simulateAndSign"),
  );
  assert.doesNotMatch(mountEffect, /(?:simulateAndSign|broadcastSigned)\s*\(/u);
});
