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
  buildProgramDataExtensionTransaction,
} from "../tools/iat-v2-admin-console/program-extension-attended.mjs";
import {
  EXTEND_PROGRAM_CHECKED_FEATURE_ID,
  FEATURE_PROGRAM_ID,
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
const upgradeAttendedSource = readFileSync(
  "tools/iat-v2-admin-console/ProgramUpgradeAttendedActions.jsx",
  "utf8",
);
const attendedTransactionBoundarySource = readFileSync(
  "tools/iat-v2-admin-console/attended-transaction-boundary.mjs",
  "utf8",
);
const upgradeBoundarySource = `${upgradeConsoleSource}\n${upgradeAttendedSource}`;
const adminConsoleSource = readFileSync(
  "tools/iat-v2-admin-console/main.jsx",
  "utf8",
);

test("retained randomness cannot shorten the source-bound attended roster", () => {
  const keySource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("function exactFeatureStorageBinding"),
    featureConsoleSource.indexOf("function loadEvidence"),
  );
  assert.match(keySource, /createIatV2DevnetProgramCeremonyEvidenceBinding\(\{/u);
  assert.match(keySource, /binding: ATTENDED_CEREMONY_BINDING/u);
  assert.match(keySource, /mint\.toBase58\(\)/u);
  assert.match(
    keySource,
    /const exact = exactFeatureStorageBinding\(mint\);[\s\S]*exact\.sourceCommit,[\s\S]*exact\.programArtifactSha256,[\s\S]*exact\.mint,/u,
  );
  assert.doesNotMatch(keySource, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD/u);

  const evidenceLoadSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("function loadEvidence"),
    featureConsoleSource.indexOf("function storedRandomnessContinuity"),
  );
  assert.match(evidenceLoadSource, /featureEvidenceStorageKey\(mint\)/u);
  assert.doesNotMatch(evidenceLoadSource, /LEGACY_FEATURE_EVIDENCE_KEY/u);

  const retainedRecordSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("function storedRandomnessContinuity"),
    featureConsoleSource.indexOf("function bitIsSet"),
  );
  assert.match(retainedRecordSource, /parseRandomnessContinuityRecord/u);
  assert.match(retainedRecordSource, /exactFeatureStorageBinding\(mint\)/u);
  assert.doesNotMatch(retainedRecordSource, /new PublicKey\(value\)|removeItem/u);

  const continuitySource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("const retainedRandomness = storedRandomnessContinuity"),
    featureConsoleSource.indexOf("const addresses = ["),
  );
  assert.match(continuitySource, /connection\.getTransaction\(retainedRandomness\.createSignature/u);
  assert.match(continuitySource, /commitment: FINALIZED_COMMITMENT/u);
  assert.match(continuitySource, /verifyFinalizedRandomnessContinuity/u);
  assert.match(continuitySource, /retainedCreateReceipt/u);
  assert.match(continuitySource, /predecessorTransactionResponse: predecessorTransaction/u);
  assert.match(continuitySource, /expectedParticipant: COMMUNITY_CUSTODY/u);
  assert.match(continuitySource, /expectedDestinationTokens: plan\.allocationDestinations\.community\.tokenAccount/u);
  assert.match(continuitySource, /minimumCreationSlot: sourceDeploymentSlot/u);

  const discardSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("function discardRetainedRandomnessAddress"),
    featureConsoleSource.indexOf("return (", featureConsoleSource.indexOf("function discardRetainedRandomnessAddress")),
  );
  assert.match(discardSource, /inspectCanonicalRandomnessDiscardEligibility/u);
  assert.match(discardSource, /!randomnessDiscardEligible \|\| !freshInspection\.discardEligible/u);
  assert.match(discardSource, /localStorage\.removeItem\(randomnessStorageKey\)/u);
  assert.match(discardSource, /localStorage\.getItem\(randomnessStorageKey\) !== null/u);
  assert.match(discardSource, /setRetainedRandomnessSerialized\(null\)/u);
  assert.doesNotMatch(discardSource, /FEATURE_EVIDENCE_KEY|setEvidence|refresh\(|sendRawTransaction|signTransaction/u);

  const firstRenderGateSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("let canonicalRandomnessDiscardInspection"),
    featureConsoleSource.indexOf("let retainedRandomnessSource"),
  );
  assert.match(firstRenderGateSource, /canonicalCreateRecorded: null,[\s\S]*discardEligible: false/u);
  assert.match(firstRenderGateSource, /inspectCanonicalRandomnessDiscardEligibility\(\{[\s\S]*storage: localStorage,[\s\S]*expectedBinding: exactStorageBinding/u);
  assert.match(firstRenderGateSource, /state\?\.randomnessContinuity[\s\S]*evidence\.length === 0[\s\S]*canonicalRandomnessDiscardInspection\.discardEligible/u);

  assert.match(
    featureConsoleSource,
    /onClick=\{discardRetainedRandomnessAddress\}[\s\S]*disabled=\{!randomnessDiscardEligible\}/u,
  );
  assert.match(
    featureConsoleSource,
    /disabled=\{evidence\.length === 0 \|\| busy \|\| Boolean\(pending\) \|\| retainedRandomnessExists\}/u,
  );
  assert.match(
    featureConsoleSource,
    /canonicalRandomnessCreateJournal\(\{[\s\S]*createSignature: encodeSolanaSignature\(pending\.signed\.signature\),[\s\S]*createMessageSha256: pending\.messageSha256/u,
  );
  assert.match(featureConsoleSource, /persistRandomnessCreateJournal\(localStorage, stagedCreateJournal\)/u);
  assert.doesNotMatch(
    featureConsoleSource,
    /localStorage\.setItem\(randomnessStorageKey,\s*pending\.randomnessAddress/u,
  );
  assert.doesNotMatch(featureConsoleSource, /FEATURE_RANDOMNESS_KEY/u);
});

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

test("feature action selection uses finalized account contexts and finalized chain time", () => {
  const loaderSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("async function loadFeatureState"),
    featureConsoleSource.indexOf("function nextFeatureAction"),
  );
  assert.match(loaderSource, /finalizedParentSnapshotSlot\([\s\S]*const configReadFloor = Math\.max\(parentSlot, minimumFinalizedSlot\)[\s\S]*getAccountInfoAndContext\([\s\S]*commitment: FINALIZED_COMMITMENT,[\s\S]*minContextSlot: configReadFloor/u);
  assert.match(
    loaderSource,
    /parseV2ConfigAccount\(configInfo\.data\)[\s\S]*config\.admin\.equals\(IAT_V2_PROGRAM_ADMIN\)[\s\S]*config\.mint\.equals\(mint\)[\s\S]*config\.randomnessProgram\.equals\(SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID\)[\s\S]*config\.rehearsalMode[\s\S]*config\.active/u,
  );
  assert.match(loaderSource, /const continuityReadFloor = Math\.max\([\s\S]*configSlot,[\s\S]*randomnessContinuity\?\.accountContextSlot \?\? 0[\s\S]*getMultipleAccountsInfoAndContext\(addresses,[\s\S]*minContextSlot: continuityReadFloor[\s\S]*getBalanceAndContext\(COMMUNITY_CUSTODY,[\s\S]*minContextSlot: stateSlot[\s\S]*getMultipleAccountsInfoAndContext\(linkedRoundAddresses,[\s\S]*minContextSlot: participantBalanceSlot/u);
  assert.match(loaderSource, /finalObservationSlot = linkedRoundResult[\s\S]*finalizedBlockTimestamp\(finalObservationSlot, "Final feature observation"\)[\s\S]*currentIatV2Week\(genesisTimestamp, nowTimestamp\) !== currentWeek[\s\S]*return \{[\s\S]*finalObservationSlot/u);
  assert.match(
    loaderSource,
    /configWeek = currentIatV2Week[\s\S]*configCccRound = currentIatV2CccRound[\s\S]*assertIatV2DevnetCeremonyHorizon\(\{[\s\S]*policyWeek: configWeek,[\s\S]*cccRound: configCccRound,[\s\S]*nowTimestamp: configTimestamp/u,
  );
  assert.match(
    loaderSource,
    /currentWeek = currentIatV2Week[\s\S]*currentCccRound = currentIatV2CccRound[\s\S]*assertIatV2DevnetCeremonyHorizon\(\{[\s\S]*policyWeek: currentWeek,[\s\S]*cccRound: currentCccRound,[\s\S]*nowTimestamp: stateTimestamp/u,
  );
  assert.match(
    loaderSource,
    /Final feature observation[\s\S]*const ceremonyHorizon = assertIatV2DevnetCeremonyHorizon\(\{[\s\S]*nowTimestamp,[\s\S]*return \{[\s\S]*ceremonyHorizon/u,
  );
  assert.match(loaderSource, /Finalized Devnet time crossed a feature boundary; refresh before signing/u);
  assert.doesNotMatch(loaderSource, /Date\.now\(|["']confirmed["']/u);
});

test("attended feature signing and broadcast reattest exact finalized deployment and action truth", () => {
  const deploymentBindingSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("function migrationDeploymentObservation"),
    featureConsoleSource.indexOf("function featureActionBinding"),
  );
  assert.match(
    deploymentBindingSource,
    /programId\?\.equals\(IAT_V2_PROGRAM_ID\)[\s\S]*programDataAddress\?\.equals\(IAT_V2_PROGRAM_DATA_ADDRESS\)[\s\S]*upgradeAuthority\?\.equals\(IAT_V2_PROGRAM_ADMIN\)[\s\S]*artifactSha256 !== IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256[\s\S]*programBytes !== IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES[\s\S]*contextSlot < minContextSlot/u,
  );
  const actionBindingSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("function featureActionBinding"),
    featureConsoleSource.indexOf("function sameBinding"),
  );
  assert.match(actionBindingSource, /ceremonyHorizon: state\.ceremonyHorizon[\s\S]*coreDestination: state\.coreDestination[\s\S]*liquidityDestination: state\.liquidityDestination[\s\S]*randomnessAddress: state\.randomnessAddress[\s\S]*currentRoundRandomnessAccount: state\.currentRound\?\.randomnessAccount/u);

  const boundarySource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("async function loadFreshAttendedBoundary"),
    featureConsoleSource.indexOf("const refresh = useCallback"),
  );
  const parentRefresh = boundarySource.indexOf("await loadFeatureParentSnapshot(readFloor)");
  const childRefresh = boundarySource.indexOf("await loadFeatureState(parentSnapshot, parentSlot, {");
  const deploymentRefresh = boundarySource.indexOf(
    "await verifyMigrationDeployment(childState.finalObservationSlot)",
  );
  assert.ok(parentRefresh >= 0, "fresh parent snapshot is missing");
  assert.ok(childRefresh > parentRefresh, "child state was read before the fresh parent snapshot");
  assert.ok(deploymentRefresh > childRefresh, "deployment was not the final boundary observation");
  assert.match(boundarySource, /finalizedParentSnapshotSlot\([\s\S]*readFloor[\s\S]*!parentSnapshot\.complete[\s\S]*!parentSnapshot\.active[\s\S]*sameBinding\(parentBinding, reviewedParentBinding\)/u);
  assert.match(boundarySource, /migrationDeploymentObservation\([\s\S]*childState\.finalObservationSlot/u);

  const signerSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("async function simulateAndRequestSignature"),
    featureConsoleSource.indexOf("async function broadcastSigned"),
  );
  const buildBoundary = signerSource.indexOf("await loadFreshAttendedBoundary(");
  const hardwareConnection = signerSource.indexOf("await getHardwareProvider(currentAction.signer)");
  const transactionBuild = signerSource.indexOf("await buildActionTransaction");
  const simulationRpc = signerSource.indexOf(
    "await connection.simulateTransaction(simulationTransaction",
  );
  const promptBoundary = signerSource.indexOf("await loadFreshAttendedBoundary(simulationSlot)");
  const hardwarePrompt = signerSource.indexOf("await requestFeatureModelTSignature({");
  assert.ok(buildBoundary >= 0, "signing path lacks a fresh attended boundary");
  assert.ok(hardwareConnection > buildBoundary, "hardware was loaded before deployment re-attestation");
  assert.ok(transactionBuild > hardwareConnection, "transaction construction order drifted");
  assert.ok(simulationRpc > transactionBuild, "exact-message simulation is missing");
  assert.ok(promptBoundary > simulationRpc, "simulation slot did not feed the prompt boundary");
  assert.ok(hardwarePrompt > promptBoundary, "hardware prompt preceded the final deployment re-attestation");
  assert.match(signerSource, /sameBinding\(currentActionBinding, reviewedActionBinding\)/u);
  assert.match(signerSource, /featureActionBinding\(action, state\)[\s\S]*featureActionBinding\(currentAction, current\)/u);
  assert.match(signerSource, /buildActionTransaction\([\s\S]*buildBoundary\.parentSnapshot,[\s\S]*\);/u);
  assert.doesNotMatch(
    signerSource,
    /buildActionTransaction\(\s*currentAction,\s*current,\s*buildBoundary\.parentSnapshot,\s*provider/u,
  );
  assert.match(signerSource, /getLatestBlockhashAndContext\(\{[\s\S]*minContextSlot: buildBoundary\.finalObservationSlot/u);
  assert.match(signerSource, /new VersionedTransaction\(built\.transaction\.compileMessage\(\)\)[\s\S]*sameBytes\(simulationTransaction\.message\.serialize\(\), reviewedMessageBytes\)[\s\S]*simulateTransaction\(simulationTransaction, \{[\s\S]*commitment: FINALIZED_COMMITMENT,[\s\S]*minContextSlot: latestContextSlot,[\s\S]*replaceRecentBlockhash: false,[\s\S]*sigVerify: false/u);
  assert.match(signerSource, /const simulationSlot = finalizedContextSlot\([\s\S]*latestContextSlot[\s\S]*sameBytes\(postSimulationMessageBytes, reviewedMessageBytes\)[\s\S]*sha256Hex\(postSimulationMessageBytes\) !== messageSha256[\s\S]*loadFreshAttendedBoundary\(simulationSlot\)/u);
  assert.doesNotMatch(signerSource, /simulateTransaction\(built\.transaction/u);
  assert.match(signerSource, /sameBinding\(promptBoundary\.deploymentBinding, buildBoundary\.deploymentBinding\)/u);
  assert.match(signerSource, /actionBinding: promptActionBinding[\s\S]*parentBinding: promptBoundary\.parentBinding[\s\S]*deploymentBinding: promptBoundary\.deploymentBinding[\s\S]*finalObservationSlot: promptBoundary\.finalObservationSlot/u);

  const broadcastSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("async function broadcastSigned"),
    featureConsoleSource.indexOf("function discardPending"),
  );
  const broadcastBoundary = broadcastSource.indexOf(
    "await loadFreshAttendedBoundary(pending.finalObservationSlot)",
  );
  const actionMatch = broadcastSource.indexOf("currentAction.id !== pending.action");
  const deploymentMatch = broadcastSource.indexOf(
    "sameBinding(boundary.deploymentBinding, pending.deploymentBinding)",
  );
  const messageMatch = broadcastSource.indexOf(
    "await sha256Hex(pending.signed.serializeMessage())",
  );
  const blockhashCheck = broadcastSource.indexOf("await connection.isBlockhashValid");
  const send = broadcastSource.indexOf("await connection.sendRawTransaction");
  assert.ok(broadcastBoundary >= 0, "broadcast path lacks a fresh attended boundary");
  assert.ok(actionMatch > broadcastBoundary, "signed action is not reselected from fresh state");
  assert.ok(deploymentMatch > actionMatch, "deployment binding is not compared after action selection");
  assert.ok(messageMatch > deploymentMatch, "signed message is not rehashed after deployment checks");
  assert.ok(blockhashCheck > messageMatch, "blockhash freshness is not checked after message validation");
  assert.ok(send > blockhashCheck, "broadcast occurs before all fail-closed checks finish");
  assert.match(broadcastSource, /sameBinding\(currentActionBinding, pending\.actionBinding\)[\s\S]*sameBinding\(boundary\.parentBinding, pending\.parentBinding\)[\s\S]*sameBinding\(boundary\.deploymentBinding, pending\.deploymentBinding\)/u);
  assert.match(broadcastSource, /featureActionBinding\(currentAction, boundary\.state\)/u);
  assert.match(broadcastSource, /pending\.signed\.recentBlockhash !== pending\.latest\.blockhash[\s\S]*isBlockhashValid\([\s\S]*minContextSlot: boundary\.finalObservationSlot/u);
  assert.match(broadcastSource, /!broadcastBoundaryValidated[\s\S]*setPending\(null\)[\s\S]*SIGNED TRANSACTION DISCARDED BEFORE BROADCAST/u);

  assert.match(adminConsoleSource, /async function loadChainSnapshot\(minContextSlot = 0\)[\s\S]*verifyProgramDeployment\(minContextSlot\)/u);
  assert.match(adminConsoleSource, /programId: IAT_V2_PROGRAM_ID,[\s\S]*programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS/u);
  assert.match(adminConsoleSource, /loadFeatureParentSnapshot=\{loadChainSnapshot\}[\s\S]*verifyMigrationDeployment=\{verifyProgramDeployment\}/u);
});

test("seven-stage initialization is mode-exact and selected only from finalized truth", () => {
  assert.match(adminConsoleSource, /const FINALIZED_COMMITMENT = "finalized"/u);
  assert.match(
    adminConsoleSource,
    /const ACTIVE_PROGRAM_ARTIFACT_BYTES = FEATURE_MODE[\s\S]*IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES[\s\S]*IAT_V2_PROGRAM_ARTIFACT_BYTES/u,
  );
  assert.match(
    adminConsoleSource,
    /const ACTIVE_PROGRAM_ARTIFACT_SHA256 = FEATURE_MODE[\s\S]*IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256[\s\S]*IAT_V2_PROGRAM_ARTIFACT_SHA256/u,
  );
  const deploymentSource = adminConsoleSource.slice(
    adminConsoleSource.indexOf("async function verifyProgramDeployment"),
    adminConsoleSource.indexOf("function assertKey"),
  );
  assert.match(deploymentSource, /getMultipleAccountsInfoAndContext/u);
  assert.match(deploymentSource, /commitment: FINALIZED_COMMITMENT/u);
  assert.match(deploymentSource, /minContextSlot/u);
  assert.match(deploymentSource, /expectedArtifactBytes: ACTIVE_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(deploymentSource, /expectedArtifactSha256: ACTIVE_PROGRAM_ARTIFACT_SHA256/u);
  assert.match(deploymentSource, /exact migration artifact required by feature mode/u);
  assert.match(deploymentSource, /exact pre-upgrade artifact required by initialization mode/u);

  const snapshotSource = adminConsoleSource.slice(
    adminConsoleSource.indexOf("async function loadChainSnapshot"),
    adminConsoleSource.indexOf("async function buildStageTransaction"),
  );
  assert.match(snapshotSource, /getMultipleAccountsInfoAndContext\(trackedAddresses, \{[\s\S]*minContextSlot: deployment\.contextSlot/u);
  assert.match(snapshotSource, /getBalanceAndContext\(IAT_V2_PROGRAM_ADMIN, \{[\s\S]*minContextSlot: trackedSlot/u);
  assert.match(snapshotSource, /getMultipleAccountsInfoAndContext\(\[[\s\S]*allocationEntries[\s\S]*minContextSlot: finalObservationSlot/u);
  assert.match(snapshotSource, /const freshDeployment = await verifyProgramDeployment\(finalObservationSlot\);[\s\S]*finalObservationSlot = freshDeployment\.contextSlot/u);
  assert.match(snapshotSource, /deployment: freshDeployment,[\s\S]*finalizedContextSlot: finalObservationSlot/u);
  assert.match(snapshotSource, /finalizedBlockTimestamp\([\s\S]*finalObservationSlot,[\s\S]*"Final initialization observation"/u);
  assert.match(snapshotSource, /finalizedContextSlot: finalObservationSlot[\s\S]*finalizedTimestamp/u);
  assert.doesNotMatch(snapshotSource, /Date\.now\(|["']confirmed["']/u);

  const stageSource = adminConsoleSource.slice(
    adminConsoleSource.indexOf("async function buildStageTransaction"),
    adminConsoleSource.indexOf("function loadEvidence"),
  );
  assert.match(stageSource, /Stage construction requires a finalized context slot and block time/u);
  assert.match(stageSource, /getFeatureGenesisTimestamp\(snapshot\.finalizedTimestamp\)/u);
  assert.match(stageSource, /BigInt\(snapshot\.finalizedTimestamp - 2\)/u);
  assert.match(stageSource, /getMinimumBalanceForRentExemption\([\s\S]*FINALIZED_COMMITMENT/u);
  assert.doesNotMatch(stageSource, /Date\.now\(|["']confirmed["']/u);

  const signerSource = adminConsoleSource.slice(
    adminConsoleSource.indexOf("async function simulateAndSign"),
    adminConsoleSource.indexOf("async function broadcastSigned"),
  );
  assert.match(signerSource, /\|\| pending\s*\|\| busy\s*\|\| signingInFlight\.current/u);
  assert.match(signerSource, /signingInFlight\.current = true;[\s\S]*finally \{[\s\S]*signingInFlight\.current = false;/u);
  const finalizedRefresh = signerSource.indexOf("await loadChainSnapshot()");
  const hardwareRequest = signerSource.indexOf("await getHardwareProvider()");
  const transactionBuild = signerSource.indexOf("await buildStageTransaction");
  assert.ok(finalizedRefresh >= 0, "initialization signer lacks a fresh finalized snapshot");
  assert.ok(hardwareRequest > finalizedRefresh, "initialization hardware loaded before finalized selection");
  assert.ok(transactionBuild > hardwareRequest, "initialization transaction order drifted");
  assert.match(signerSource, /getLatestBlockhashAndContext\(\{[\s\S]*minContextSlot: current\.finalizedContextSlot/u);
  assert.match(signerSource, /simulateExactLegacyTransaction\(\{[\s\S]*minContextSlot: latestContextSlot,[\s\S]*transaction,/u);
  assert.doesNotMatch(signerSource, /simulateTransaction\(transaction/u);
  const exactSimulation = signerSource.indexOf("await simulateExactLegacyTransaction");
  const promptBoundary = signerSource.indexOf("await loadChainSnapshot(simulationSlot)");
  const hardwarePrompt = signerSource.indexOf("await provider.signTransaction(transaction)");
  assert.ok(exactSimulation >= 0, "initialization signer lacks exact-message simulation");
  assert.ok(promptBoundary > exactSimulation, "initialization prompt boundary precedes simulation");
  assert.ok(hardwarePrompt > promptBoundary, "initialization hardware prompt precedes its fresh finalized boundary");
  assert.match(signerSource, /initializationSnapshotBinding\(promptSnapshot\) !== snapshotBinding/u);
  assert.match(signerSource, /assertSignedLegacyTransaction\(\{[\s\S]*expectedMessageBytes: messageBytes,[\s\S]*expectedMessageSha256: messageSha256/u);

  const broadcastSource = adminConsoleSource.slice(
    adminConsoleSource.indexOf("async function broadcastSigned"),
    adminConsoleSource.indexOf("function discardSigned"),
  );
  const preSendRefresh = broadcastSource.indexOf("await loadChainSnapshot(pending.finalObservationSlot)");
  const preSendMessageCheck = broadcastSource.indexOf("await assertSignedLegacyTransaction");
  const preSendBlockhashCheck = broadcastSource.indexOf("await assertFreshFinalizedBlockhash");
  const rawSend = broadcastSource.indexOf("await connection.sendRawTransaction");
  assert.ok(preSendRefresh >= 0, "initialization broadcast lacks a fresh finalized state boundary");
  assert.ok(preSendMessageCheck > preSendRefresh, "initialization signed-message check precedes state refresh");
  assert.ok(preSendBlockhashCheck > preSendMessageCheck, "initialization blockhash check precedes message check");
  assert.ok(rawSend > preSendBlockhashCheck, "initialization raw send precedes its pre-send checks");
  assert.match(broadcastSource, /initializationSnapshotBinding\(current\) !== pending\.snapshotBinding/u);
  assert.match(broadcastSource, /if \(!broadcastBoundaryValidated\) \{[\s\S]*setPending\(null\);/u);
  assert.match(broadcastSource, /await loadChainSnapshot\(confirmationSlot\)/u);
  assert.doesNotMatch(adminConsoleSource, /Date\.now\(|["']confirmed["']/u);
});

test("feature mode fail-closes the legacy seven-stage evidence export", () => {
  const exportSource = adminConsoleSource.slice(
    adminConsoleSource.indexOf("function downloadEvidence"),
    adminConsoleSource.indexOf("const nextStage"),
  );
  const modeGuard = exportSource.indexOf("if (FEATURE_MODE)");
  const guardReturn = exportSource.indexOf("return;", modeGuard);
  const payloadBuild = exportSource.indexOf("const payload =");
  assert.ok(modeGuard >= 0, "legacy export lacks a feature-mode guard");
  assert.ok(guardReturn > modeGuard, "feature-mode guard does not stop export");
  assert.ok(payloadBuild > guardReturn, "feature-mode guard runs after payload construction");
  assert.match(exportSource, /LEGACY SEVEN-STAGE EXPORT DISABLED IN POST-UPGRADE MODE/u);
  assert.match(exportSource, /Historical initialization receipts cannot be rebound to the migration artifact/u);
  assert.match(exportSource, /rehearsalScope: "PRIMARY_INITIALIZATION"/u);
  assert.match(exportSource, /anchor\.download = "iat-v2-devnet-rehearsal-evidence\.json"/u);
  assert.doesNotMatch(exportSource, /BACKDATED_FEATURE_INSTANCE_INITIALIZATION|iat-v2-devnet-feature-initialization-evidence\.json/u);

  const evidenceUi = adminConsoleSource.slice(
    adminConsoleSource.indexOf('<section className="evidence">'),
    adminConsoleSource.indexOf("<footer>"),
  );
  assert.match(evidenceUi, /FEATURE_MODE \? \([\s\S]*LEGACY SEVEN-STAGE EXPORT DISABLED[\s\S]*\) : \([\s\S]*onClick=\{downloadEvidence\}/u);
  assert.match(featureConsoleSource, /function downloadAggregateEvidence\(\)[\s\S]*EXPORT COMPLETE ATTENDED BUNDLE/u);
  assert.match(adminConsoleSource, /DEVNET V2 ACTIVE \/\/ EXPORT ATTENDED RECEIPTS; AUTOMATED EVIDENCE STILL REQUIRED/u);
  assert.doesNotMatch(adminConsoleSource, /EXPORT SOURCE-BOUND AUTOMATED EVIDENCE/u);
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
  assert.match(migrationConsoleSource, /simulateExactLegacyTransaction\([\s\S]*requestRoundModelTSignature/u);
  assert.match(migrationConsoleSource, /assertSignedLegacyTransaction\([\s\S]*messageSha256/u);
  assert.match(attendedTransactionBoundarySource, /new VersionedTransaction\(transaction\.compileMessage\(\)\)/u);
  assert.match(
    attendedTransactionBoundarySource,
    /simulateTransaction\(simulationTransaction, \{[\s\S]*minContextSlot,[\s\S]*replaceRecentBlockhash: false,[\s\S]*sigVerify: false/u,
  );
  assert.match(attendedTransactionBoundarySource, /signed\.verifySignatures\(\)/u);
  assert.match(migrationConsoleSource, /const FINALIZED_COMMITMENT = "finalized"/u);
  assert.match(migrationConsoleSource, /confirmTransaction\([\s\S]*FINALIZED_COMMITMENT\)/u);
  const loaderSource = migrationConsoleSource.slice(
    migrationConsoleSource.indexOf("async function loadMigrationSnapshot"),
    migrationConsoleSource.indexOf("export default function LegacyRoundMigration"),
  );
  const roundInventory = loaderSource.indexOf("const hardenedResult = await connection.getProgramAccounts");
  const clockObservation = loaderSource.indexOf("const chainTimestampValue = await connection.getBlockTime");
  const finalDeployment = loaderSource.indexOf("const finalProgramResult = await connection.getMultipleAccountsInfoAndContext");
  assert.ok(roundInventory >= 0, "migration snapshot lacks the hardened round inventory");
  assert.ok(clockObservation > roundInventory, "migration clock was observed before the round inventory");
  assert.ok(finalDeployment > clockObservation, "deployment was not re-attested after rounds and clock");
  assert.match(
    loaderSource,
    /finalProgramResult = await connection\.getMultipleAccountsInfoAndContext\([\s\S]*?minContextSlot: chainSlot/u,
  );
  assert.match(loaderSource, /finalProgramSlot = finalizedContextSlot\([\s\S]*?finalProgramResult[\s\S]*?chainSlot/u);
  assert.match(loaderSource, /const programRows = finalProgramResult\.value/u);
  assert.match(loaderSource, /const deploymentBinding = \{[\s\S]*artifactSha256: artifact\.artifactSha256/u);
  assert.match(loaderSource, /deploymentBinding,[\s\S]*finalizedContextSlot: finalProgramSlot/u);
  assert.match(migrationConsoleSource, /deployment: snapshot\.deploymentBinding/u);
  const broadcastSource = migrationConsoleSource.slice(
    migrationConsoleSource.indexOf("async function broadcastSigned"),
  );
  assert.match(
    broadcastSource,
    /loadMigrationSnapshot\(sha256Hex, pending\.finalizedContextSlot\)[\s\S]*attendedRoundBinding\(pending\.kind, current, round\)[\s\S]*assertExactTransactionMessage\([\s\S]*assertSignedLegacyTransaction\([\s\S]*assertFreshFinalizedBlockhash\([\s\S]*sendRawTransaction/u,
  );
  assert.match(
    broadcastSource,
    /if \(!broadcastBoundaryValidated\) \{[\s\S]*setPending\(null\)[\s\S]*DISCARDED BEFORE BROADCAST/u,
  );
});

test("source-bound historical weeks 9 through 12 use fail-closed rehearsal-only neutral recovery", () => {
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

  assert.match(
    migrationConsoleSource,
    /HISTORICAL_NEUTRAL_WEEKS = Object\.freeze\([\s\S]*IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS\.map\(\(week\) => BigInt\(week\)\)/u,
  );
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

test("migration and feature consoles enforce the policy-13 CCC-13 horizon before hardware", () => {
  assert.match(featureConsoleSource, /IAT_V2_DEVNET_CEREMONY_POLICY_WEEK/u);
  assert.match(featureConsoleSource, /IAT_V2_DEVNET_CEREMONY_CCC_ROUND/u);
  assert.match(featureConsoleSource, /IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_UTC/u);
  assert.match(featureConsoleSource, /SOURCE-BOUND CEREMONY HORIZON/u);

  const migrationLoader = migrationConsoleSource.slice(
    migrationConsoleSource.indexOf("async function loadMigrationSnapshot"),
    migrationConsoleSource.indexOf("export default function LegacyRoundMigration"),
  );
  const clock = migrationLoader.indexOf("const chainTimestampValue = await connection.getBlockTime");
  const horizon = migrationLoader.indexOf("const ceremonyHorizon = assertIatV2DevnetCeremonyHorizon");
  const recoveries = migrationLoader.indexOf("const recoveries = HISTORICAL_NEUTRAL_WEEKS.map");
  assert.ok(clock >= 0, "migration horizon lacks finalized chain time");
  assert.ok(horizon > clock, "migration horizon was checked before finalized chain time");
  assert.ok(recoveries > horizon, "migration recovery inventory preceded the horizon gate");
  assert.match(
    migrationLoader,
    /policyWeek = currentIatV2Week[\s\S]*currentRound = currentIatV2CccRound[\s\S]*assertIatV2DevnetCeremonyHorizon\(\{[\s\S]*policyWeek,[\s\S]*cccRound: currentRound,[\s\S]*nowTimestamp: chainTimestampValue/u,
  );
  assert.match(migrationConsoleSource, /ceremonyHorizon: snapshot\.ceremonyHorizon/u);
  assert.match(migrationConsoleSource, /SOURCE-BOUND CEREMONY HORIZON/u);

  for (const functionName of ["simulateAndSignMigration", "simulateAndSignBackfill"]) {
    const start = migrationConsoleSource.indexOf(`async function ${functionName}`);
    const next = migrationConsoleSource.indexOf("\n  async function ", start + 1);
    const source = migrationConsoleSource.slice(start, next < 0 ? undefined : next);
    assert.ok(source.indexOf("await loadMigrationSnapshot") >= 0, `${functionName} lacks a fresh horizon-bound snapshot`);
    assert.ok(
      source.indexOf("await getHardwareProvider") > source.indexOf("await loadMigrationSnapshot"),
      `${functionName} loaded hardware before the horizon-bound snapshot`,
    );
  }
});

test("program upgrade and legacy migration share one CI artifact and finalized handoff", () => {
  assert.match(upgradeBoundarySource, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(upgradeBoundarySource, /IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256/u);
  assert.doesNotMatch(upgradeBoundarySource, /\bIAT_V2_PROGRAM_ARTIFACT_(?:BYTES|SHA256)\b/u);
  assert.match(upgradeBoundarySource, /expectedArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(upgradeBoundarySource, /expectedArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256/u);
  assert.match(upgradeBoundarySource, /const FINALIZED_COMMITMENT = "finalized"/u);
  assert.doesNotMatch(upgradeBoundarySource, /confirmTransaction\(/u);
  assert.match(
    upgradeAttendedSource,
    /getSignatureStatuses\([\s\S]*searchTransactionHistory: true[\s\S]*getTransaction\([\s\S]*commitment: finalizedCommitment/u,
  );
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
  assert.match(upgradeBoundarySource, /action: "extend-program"/u);
  assert.match(upgradeBoundarySource, /getMinimumBalanceForRentExemption/u);
  assert.match(upgradeBoundarySource, /SIMULATE \+ SIGN SEPARATE CAPACITY EXTENSION/u);
  assert.match(upgradeBoundarySource, /BROADCAST SIGNED CAPACITY EXTENSION/u);
  assert.match(upgradeBoundarySource, /EXACT RENT TOP-UP/u);
  assert.match(upgradeBoundarySource, /CAPACITY EXTENSION FINALIZED \/\/ BUFFER UPLOAD REMAINS A SEPARATE STEP/u);
  assert.match(upgradeBoundarySource, /No buffer upload or upgrade was auto-started/u);
  assert.match(upgradeBoundarySource, /preflightCommitment: finalizedCommitment/u);
  const mountEffect = upgradeConsoleSource.slice(
    upgradeConsoleSource.indexOf("useEffect(() =>"),
    upgradeConsoleSource.indexOf("return ("),
  );
  assert.doesNotMatch(mountEffect, /(?:simulateAndSign|broadcastSigned|setAttendedLoaded)\s*\(/u);
});

test("program upgrade serializes read-only inspection with attended sign and broadcast actions", () => {
  assert.match(upgradeConsoleSource, /inspectionBusy=\{busy\}/u);
  assert.match(upgradeAttendedSource, /\binspectionBusy\b/u);
  assert.match(
    upgradeAttendedSource,
    /!snapshot[\s\S]*?\|\| busy[\s\S]*?\|\| inspectionBusy[\s\S]*?\) return;/u,
  );
  assert.match(
    upgradeAttendedSource,
    /if \(!pending \|\| broadcastAttempt \|\| broadcastBlocked \|\| busy \|\| inspectionBusy\) return;/u,
  );
  assert.match(
    upgradeAttendedSource,
    /onClick=\{simulateAndSign\}[\s\S]*?disabled=\{busy \|\| inspectionBusy/u,
  );
  assert.match(
    upgradeAttendedSource,
    /onClick=\{broadcastSigned\}[\s\S]*disabled=\{busy \|\| inspectionBusy \|\| broadcastBlocked \|\| !broadcastWindowReady\}/u,
  );
  assert.match(
    upgradeConsoleSource,
    /loadBufferSnapshot\(minContextSlot = 0\)[\s\S]*getMultipleAccountsInfoAndContext\([\s\S]*minContextSlot[\s\S]*finalizedContextSlot/u,
  );
  const broadcastSource = upgradeAttendedSource.slice(
    upgradeAttendedSource.indexOf("async function broadcastSigned"),
  );
  assert.match(
    broadcastSource,
    /loadBufferSnapshot\(pending\.finalizedContextSlot\)[\s\S]*upgradeActionBinding\(current\)[\s\S]*buildAttendedProgramTransaction\([\s\S]*assertExactTransactionMessage\([\s\S]*assertSignedLegacyTransaction\([\s\S]*observeSignedBlockhashWindow\([\s\S]*sendRawTransaction/u,
  );
  assert.match(
    broadcastSource,
    /preSendEntered && storageError === null[\s\S]*withNoAttendedProgramBroadcastAttempts\(\{[\s\S]*"PRE_SEND_FAILURE"[\s\S]*setPending\(null\)[\s\S]*DISCARDED BEFORE BROADCAST/u,
  );
});
