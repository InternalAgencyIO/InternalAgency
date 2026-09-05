#!/usr/bin/env node

import { createHash } from "node:crypto";
import { Connection } from "@solana/web3.js";
import {
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  createIatV2DeploymentPlan,
} from "../programs/iat_v2/client.mjs";
import {
  IAT_V2_ROUND_LAYOUT,
  IAT_V2_ROUND_STATUS,
  parseRoundAccount,
} from "../programs/iat_v2/feature-instructions.mjs";
import {
  DEVNET_FEATURE_MINT_SEED,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
  deriveDeterministicDevnetMint,
  inspectReviewedUpgradeableProgramArtifact,
  parseUpgradeableProgramAccounts,
  parseUpgradeableProgramData,
  parseV2ConfigAccount,
} from "../programs/iat_v2/instructions.mjs";

const DEVNET_RPC = "https://api.devnet.solana.com";
const SECONDS_PER_DAY = 86_400n;
const SECONDS_PER_WEEK = 604_800n;
const FEATURE_START_WEEK = 7n;
const BOUNDARY_LEAD_SECONDS = 7_200n;

function json(value) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "bigint") return item.toString();
    if (item?.toBase58) return item.toBase58();
    return item;
  }, 2);
}

function unixNow() {
  return BigInt(Math.floor(Date.now() / 1000));
}

function timing(genesisTimestamp, now = unixNow()) {
  const age = now - genesisTimestamp;
  if (age < 0n) throw new Error("Feature rehearsal Genesis timestamp is in the future");
  const currentWeek = age / SECONDS_PER_WEEK;
  const firstCccAt = genesisTimestamp + SECONDS_PER_DAY;
  const currentCccRound = now < firstCccAt
    ? null
    : (now - firstCccAt) / SECONDS_PER_WEEK;
  const nextWeekAt = genesisTimestamp + ((currentWeek + 1n) * SECONDS_PER_WEEK);
  const nextCccRound = currentCccRound === null ? 0n : currentCccRound + 1n;
  const nextCccAt = firstCccAt + (nextCccRound * SECONDS_PER_WEEK);
  return {
    genesisTimestamp,
    genesisAtUtc: new Date(Number(genesisTimestamp) * 1000).toISOString(),
    currentWeek,
    currentCccRound,
    nextWeekAtUtc: new Date(Number(nextWeekAt) * 1000).toISOString(),
    nextCccAtUtc: new Date(Number(nextCccAt) * 1000).toISOString(),
    standardPositionEarliestSettlement: "NEXT_POLICY_WEEK_AFTER_POSITION_OPEN",
    cccPositionEarliestSettlement: "MATCHING_CCC_ROUND_NOT_EARLIER_THAN_24_HOURS_AFTER_NEXT_POLICY_WEEK",
  };
}

const connection = new Connection(DEVNET_RPC, "confirmed");
const mint = await deriveDeterministicDevnetMint({ seed: DEVNET_FEATURE_MINT_SEED });
const plan = createIatV2DeploymentPlan({
  network: "devnet",
  mint,
  programId: IAT_V2_PROGRAM_ID,
  randomnessProgramId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  rehearsal: true,
});
const [programInfo, programDataInfo, mintInfo, configInfo] = await connection.getMultipleAccountsInfo(
  [IAT_V2_PROGRAM_ID, IAT_V2_PROGRAM_DATA_ADDRESS, mint, plan.config],
  "confirmed",
);
if (!programInfo?.executable || !programDataInfo) {
  throw new Error("Verified IAT V2 program deployment is not readable on devnet");
}
parseUpgradeableProgramAccounts({
  programData: programInfo.data,
  programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS,
});
const programData = parseUpgradeableProgramData(programDataInfo.data);
if (!programData.upgradeAuthority.equals(IAT_V2_PROGRAM_ADMIN)) {
  throw new Error("IAT V2 devnet program is not controlled by the reviewed Model T address");
}
const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
const deployedRegionSha256 = hashBytes(programData.programBytes);
const migrationArtifactBound =
  Number.isSafeInteger(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES)
  && IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES > 0
  && /^[0-9a-f]{64}$/u.test(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256 ?? "")
  && /^[0-9a-f]{40}$/u.test(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD ?? "")
  && Number.isSafeInteger(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID)
  && IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID > 0;
const deployedArtifact = migrationArtifactBound
  ? await inspectReviewedUpgradeableProgramArtifact({
      programBytes: programData.programBytes,
      sha256Hex: async (bytes) => hashBytes(bytes),
      expectedArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
      expectedArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
    })
  : {
      artifactBytes: null,
      artifactSha256: null,
      loaderPaddingBytes: null,
      loaderPaddingIsZero: false,
      loaderRegionBytes: programData.programBytes.length,
      matchesReviewedArtifact: false,
    };

const adminLamports = await connection.getBalance(IAT_V2_PROGRAM_ADMIN, "confirmed");
const participantLamports = await connection.getBalance(
  plan.allocationDestinations.community.owner,
  "confirmed",
);
const proposedGenesisTimestamp = unixNow()
  - ((FEATURE_START_WEEK + 1n) * SECONDS_PER_WEEK)
  + BOUNDARY_LEAD_SECONDS;
const config = configInfo ? parseV2ConfigAccount(configInfo.data) : null;
const selectedTiming = timing(config?.genesisTimestamp ?? proposedGenesisTimestamp);
const featureInstanceStatus = config?.active
  ? "FEATURE_INSTANCE_ACTIVE"
  : mintInfo
    ? "FEATURE_INSTANCE_PARTIAL"
    : "READY_TO_INITIALIZE";
const [legacyRoundRows, hardenedRoundRows] = await Promise.all([
  connection.getProgramAccounts(IAT_V2_PROGRAM_ID, {
    commitment: "confirmed",
    filters: [{ dataSize: IAT_V2_ROUND_LAYOUT.LEGACY_V1_BYTES }],
  }),
  connection.getProgramAccounts(IAT_V2_PROGRAM_ID, {
    commitment: "confirmed",
    filters: [{ dataSize: IAT_V2_ROUND_LAYOUT.HARDENED_V2_BYTES }],
  }),
]);
const inspectRoundRows = (rows) => rows.map(({ pubkey, account }) => {
  const parsed = parseRoundAccount(account.data);
  return {
    address: pubkey,
    layoutVersion: parsed.layoutVersion,
    accountBytes: parsed.accountBytes,
    config: parsed.config,
    week: parsed.week,
    status: parsed.status,
    migrationSafe:
      parsed.config.equals(plan.config)
      && parsed.status === IAT_V2_ROUND_STATUS.SETTLED,
  };
});
const legacyRounds = inspectRoundRows(legacyRoundRows);
const hardenedRounds = inspectRoundRows(hardenedRoundRows);
const everyLegacyRoundMigrationSafe = legacyRounds.every((round) => round.migrationSafe);
const currentSourceUpgradeCompatibility = {
  status: everyLegacyRoundMigrationSafe
    ? "SOURCE_PRESERVES_FEATURES_WITH_SETTLED_ROUND_MIGRATION"
    : "BLOCKED_UNSAFE_LEGACY_ROUND_STATE",
  publicUpgradeAuthorized: false,
  preservesActiveV2Features: everyLegacyRoundMigrationSafe,
  cccDlcGenesisEnabled: true,
  deployedRoundAccountBytes: IAT_V2_ROUND_LAYOUT.LEGACY_V1_BYTES,
  reviewedRoundAccountBytes: IAT_V2_ROUND_LAYOUT.HARDENED_V2_BYTES,
  roundAccountMigrationAvailable: true,
  legacyRoundMigrationComplete: legacyRounds.length === 0,
  legacyRounds,
  hardenedRounds,
};
const report = {
  schema: "iat-v2-feature-rehearsal-preflight/v1",
  status: !migrationArtifactBound
    ? "HOLD_MIGRATION_ARTIFACT_NOT_CI_BOUND"
    : !deployedArtifact.matchesReviewedArtifact
      ? "HOLD_MIGRATION_ARTIFACT_NOT_DEPLOYED"
    : legacyRounds.length > 0
      ? "HOLD_LEGACY_ROUND_MIGRATION_REQUIRED"
      : featureInstanceStatus,
  featureInstanceStatus,
  readyForSignedFeatureRehearsal:
    migrationArtifactBound
    && deployedArtifact.matchesReviewedArtifact
    && currentSourceUpgradeCompatibility.preservesActiveV2Features
    && currentSourceUpgradeCompatibility.legacyRoundMigrationComplete,
  network: "devnet",
  rpc: DEVNET_RPC,
  mainnetStatus: "HOLD",
  signingOrBroadcastPerformed: false,
  program: {
    programId: IAT_V2_PROGRAM_ID,
    programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS,
    upgradeAuthority: programData.upgradeAuthority,
    deployedArtifactBytes: deployedArtifact.artifactBytes,
    deployedArtifactSha256: deployedArtifact.artifactSha256,
    deployedRegionBytes: deployedArtifact.loaderRegionBytes,
    deployedRegionSha256,
    loaderZeroPaddingBytes: deployedArtifact.loaderPaddingBytes,
    loaderZeroPaddingVerified: deployedArtifact.loaderPaddingIsZero,
    migrationArtifactBound,
    reviewedArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
    reviewedArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
    reviewedArtifactSourceHead: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
    reviewedArtifactBuildRunId: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  },
  currentSourceUpgradeCompatibility,
  hardwareOperator: {
    address: IAT_V2_PROGRAM_ADMIN,
    balanceLamports: adminLamports,
    balanceSol: adminLamports / 1_000_000_000,
  },
  participant: {
    address: plan.allocationDestinations.community.owner,
    balanceLamports: participantLamports,
    balanceSol: participantLamports / 1_000_000_000,
    rentFundingRequired: participantLamports < 30_000_000,
    rehearsalRentTargetLamports: 30_000_000,
  },
  featureInstance: {
    deterministicMintSeed: DEVNET_FEATURE_MINT_SEED,
    mint,
    config: plan.config,
    vaultAuthority: plan.vaultAuthority,
    stakeVault: plan.stakeTokenAccount,
    coreReward: plan.coreReward,
    lanes: plan.lanes,
    allocations: plan.allocationDestinations,
  },
  timing: selectedTiming,
  gates: {
    initializeSecondScaledMint: !mintInfo,
    programRemainsExactDeployedArtifact: deployedArtifact.matchesReviewedArtifact,
    currentSourcePreservesActiveV2Features:
      currentSourceUpgradeCompatibility.preservesActiveV2Features,
    liveSwitchboardCommitRevealRequired: true,
    participantHardwareSignatureRequiredForStake: true,
    automatedFeatureDirectEvidenceRequired: true,
    humanFeatureReviewerRequired: false,
    noSelfAttestation: true,
    cccLinkedSettlementCannotCompleteSameDay: true,
  },
};

console.log(json(report));
