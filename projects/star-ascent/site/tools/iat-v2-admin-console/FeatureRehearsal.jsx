import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  deriveAgencyAddress,
  derivePositionAddress,
  deriveRoundAddress,
} from "../../programs/iat_v2/client.mjs";
import {
  IAT_V2_ROLE,
  IAT_V2_ROUND_LAYOUT,
  buildClaimLanePrincipalInstruction,
  buildCommitRoundInstruction,
  buildExpireRoundInstruction,
  buildOpenPositionInstruction,
  buildRegisterAgencyInstruction,
  buildSetEligibilityInstruction,
  buildSettleCoreWeekInstruction,
  buildSettlePositionWeekInstruction,
  buildSettleRoundInstruction,
  deriveEligibilityAddress,
  parseCoreRewardAccount,
  parseEligibilityAccount,
  parseLaneVaultAccount,
  parsePositionAccount,
  parseRoundAccount,
} from "../../programs/iat_v2/feature-instructions.mjs";
import {
  currentIatV2CccRound,
  currentIatV2Week,
  earliestDueIatV2PositionWeek,
  formatRehearsalWait,
  iterateUnsetIatV2PositionWeeks,
  selectIatV2FeatureDuePositionSettlement,
  secondsUntilIatV2CccRound,
  secondsUntilIatV2RoundRecovery,
  secondsUntilIatV2Week,
} from "../../programs/iat_v2/feature-rehearsal.mjs";
import {
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_UTC,
  IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
  assertIatV2DevnetCeremonyHorizon,
} from "../../programs/iat_v2/ceremony-horizon.mjs";
import {
  DEVNET_FEATURE_MINT_SEED,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
  parseV2ConfigAccount,
} from "../../programs/iat_v2/instructions.mjs";
import {
  createIatV2DevnetProgramCeremonyEvidenceBinding,
  parseIatV2DevnetProgramCeremonyBinding,
} from "../../programs/iat_v2/ceremony-binding.mjs";
import ceremonyRuntimeBindingJson from "../../scripts/data/iat-v2-devnet-program-ceremony-runtime-binding.json";
import {
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
} from "../../programs/iat_v2/client.mjs";
import {
  assertCanonicalAttendedNextActionFromReceiptSet,
  loadAttendedReceiptSet,
  parseAttendedReceiptSet,
  persistAttendedReceipt,
} from "./attended-evidence.mjs";
import { buildCompleteAttendedBundle } from "./attended-evidence-bundle.mjs";
import {
  IAT_V2_RANDOMNESS_CREATE_TITLE,
  canonicalRandomnessCreateJournal,
  encodeSolanaSignature,
  inspectCanonicalRandomnessDiscardEligibility,
  loadRandomnessCreateJournal,
  parseRandomnessContinuityRecord,
  persistRandomnessCreateJournal,
  randomnessCreateJournalStorageKey,
  randomnessJournalContinuityRecord,
  randomnessJournalReceiptStub,
  reconcileVerifiedRandomnessCreateJournal,
  verifyFinalizedRandomnessContinuity,
} from "./feature-randomness-continuity.mjs";
import {
  attendedPromptLatchKey,
  createAttendedModelTPromptCoordinator,
} from "./attended-prompt-coordinator.mjs";

const DEVNET_RPC = "https://api.devnet.solana.com";
const FINALIZED_COMMITMENT = "finalized";
const connection = new Connection(DEVNET_RPC, FINALIZED_COMMITMENT);
const COMMUNITY_CUSTODY = new PublicKey("7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH");
const ATTENDED_CEREMONY_BINDING = parseIatV2DevnetProgramCeremonyBinding(
  ceremonyRuntimeBindingJson,
);

function signerRole(signer) {
  if (signer.equals(IAT_V2_PROGRAM_ADMIN) && signer.equals(COMMUNITY_CUSTODY)) {
    return "MAIN TREZOR COLD WALLET // PROTOCOL ADMIN + COMMUNITY CUSTODY";
  }
  if (signer.equals(IAT_V2_PROGRAM_ADMIN)) {
    return "MAIN TREZOR COLD WALLET // PROTOCOL ADMIN";
  }
  if (signer.equals(COMMUNITY_CUSTODY)) {
    return "COMMUNITY CUSTODY // PARTICIPANT";
  }
  return "REQUIRED WALLET";
}
const CORE_BENEFICIARY = new PublicKey("2yBK1NkeUoTToE4cfz33WRckho4Qr2BV1ZtCTrw3AHyB");
const LIQUIDITY_BENEFICIARY = new PublicKey("2d41i3afUpWuo2LqpuKao5D1ToEU88aBokiQ3z8HQtPC");
const FEATURE_AGENCY_OWNERS = Object.freeze([
  new PublicKey("Ge2c3puY5YwsiLhFJWdoXpRbE55k7omLw37pvJVCBkja"),
  new PublicKey("HpqX8EU3FSEPwdurSE8PudsjzpcZLJoaVB8R1Y1HfC6X"),
]);
const FEATURE_POSITION_IDS = Object.freeze([1, 2, 3]);
const FEATURE_POSITION_PRINCIPAL = 10_000_000_000n;
const PARTICIPANT_RENT_TARGET_LAMPORTS = 30_000_000;
const LEGACY_FEATURE_EVIDENCE_KEY_V2 =
  `iat-v2-devnet-feature-action-evidence/${DEVNET_FEATURE_MINT_SEED}/v2`;
const LEGACY_FEATURE_EVIDENCE_KEY = "iat-v2-devnet-feature-action-evidence/v1";

function exactFeatureStorageBinding(mint) {
  return createIatV2DevnetProgramCeremonyEvidenceBinding({
    binding: ATTENDED_CEREMONY_BINDING,
    mint: mint.toBase58(),
  });
}

function featureSourceBoundStorageKey(namespace, mint, version) {
  const exact = exactFeatureStorageBinding(mint);
  return [
    namespace,
    exact.sourceCommit,
    exact.programArtifactSha256,
    exact.mint,
    version,
  ].join("/");
}

function featureEvidenceStorageKey(mint) {
  return featureSourceBoundStorageKey(
    "iat-v2-devnet-feature-action-evidence",
    mint,
    "v3",
  );
}

function featureRandomnessStorageKey(mint) {
  return featureSourceBoundStorageKey(
    "iat-v2-devnet-switchboard-randomness-account",
    mint,
    "v4",
  );
}

function loadEvidence(mint) {
  try {
    const serialized = localStorage.getItem(featureEvidenceStorageKey(mint)) ?? "[]";
    const value = JSON.parse(serialized);
    return Array.isArray(value)
      ? value.filter((entry) => (
        typeof entry?.action === "string"
        && typeof entry?.signature === "string"
        && typeof entry?.messageSha256 === "string"
      ))
      : [];
  } catch {
    return [];
  }
}

function storedRandomnessContinuity(mint) {
  const binding = exactFeatureStorageBinding(mint);
  const value = localStorage.getItem(featureRandomnessStorageKey(mint));
  const retained = value ? parseRandomnessContinuityRecord(value, binding) : null;
  const journal = loadRandomnessCreateJournal(localStorage, binding);
  const journalContinuity = journal ? randomnessJournalContinuityRecord(journal) : null;
  if (retained && journalContinuity && !sameBinding(retained, journalContinuity)) {
    throw new Error("Retained randomness continuity conflicts with its CREATE recovery journal");
  }
  return retained ?? journalContinuity;
}

function retainedRandomnessCreateInputs(mint, evidence) {
  const binding = exactFeatureStorageBinding(mint);
  const retained = storedRandomnessContinuity(mint);
  const journal = loadRandomnessCreateJournal(localStorage, binding);
  const evidenceReceipt = evidence.find(
    ({ action }) => action === "CREATE_SWITCHBOARD_RANDOMNESS",
  ) ?? null;
  const retainedStub = journal
    ? randomnessJournalReceiptStub(journal)
    : retained
      ? {
          action: "CREATE_SWITCHBOARD_RANDOMNESS",
          signature: retained.createSignature,
          messageSha256: retained.createMessageSha256,
        }
      : null;
  if (
    evidenceReceipt
    && retainedStub
    && (
      evidenceReceipt.signature !== retainedStub.signature
      || evidenceReceipt.messageSha256 !== retainedStub.messageSha256
    )
  ) {
    throw new Error("Source-bound feature CREATE receipt conflicts with retained randomness continuity");
  }
  if (!retained) {
    return { retainedCreateReceipt: null, retainedCreatePredecessorReceipt: null };
  }
  const receiptSet = loadAttendedReceiptSet(localStorage, binding);
  const createIndex = receiptSet.receipts.findIndex(
    ({ action }) => action === "CREATE_SWITCHBOARD_RANDOMNESS",
  );
  const predecessorIndex = createIndex === -1
    ? receiptSet.receipts.length - 1
    : createIndex - 1;
  return {
    retainedCreateReceipt: evidenceReceipt ?? retainedStub,
    retainedCreatePredecessorReceipt: receiptSet.receipts[predecessorIndex] ?? null,
  };
}

function bitIsSet(value, ordinal) {
  return (value & (1n << BigInt(ordinal))) !== 0n;
}

function roleMatches(eligibility, role, agencyIndex = null) {
  if (!eligibility || eligibility.role !== role) return false;
  if (role === IAT_V2_ROLE.STANDARD) return eligibility.agencyIndex === 0xffff_ffff;
  return eligibility.agencyIndex === agencyIndex;
}

function finalizedContextSlot(result, label, minContextSlot = 0) {
  const slot = result?.context?.slot;
  if (!Number.isSafeInteger(slot) || slot < minContextSlot) {
    throw new Error(`${label} did not return a valid finalized context slot`);
  }
  return slot;
}

async function finalizedBlockTimestamp(slot, label) {
  const timestamp = await connection.getBlockTime(slot);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error(`${label} did not return a valid finalized block time`);
  }
  return timestamp;
}

function finalizedParentSnapshotSlot(snapshot, label, minContextSlot = 0) {
  const slot = snapshot?.finalizedContextSlot;
  if (!Number.isSafeInteger(slot) || slot <= 0 || slot < minContextSlot) {
    throw new Error(`${label} does not carry a monotonic finalized context slot`);
  }
  return slot;
}

function featureParentBinding(snapshot) {
  return {
    mint: snapshot.mint.toBase58(),
    config: snapshot.plan.config.toBase58(),
    communityTokenAccount: snapshot.plan.allocationDestinations.community.tokenAccount.toBase58(),
    supply: String(snapshot.supply),
    active: snapshot.active,
    complete: snapshot.complete,
  };
}

function migrationDeploymentObservation(deployment, minContextSlot) {
  if (
    !deployment?.programId?.equals(IAT_V2_PROGRAM_ID)
    || !deployment?.programDataAddress?.equals(IAT_V2_PROGRAM_DATA_ADDRESS)
    || !deployment?.upgradeAuthority?.equals(IAT_V2_PROGRAM_ADMIN)
    || deployment?.artifactSha256 !== IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256
    || deployment?.programBytes !== IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES
    || !Number.isSafeInteger(deployment?.contextSlot)
    || deployment.contextSlot < minContextSlot
  ) {
    throw new Error("Finalized deployment is not the exact reviewed migration Program/ProgramData artifact and authority");
  }
  return {
    contextSlot: deployment.contextSlot,
    binding: {
      programId: deployment.programId.toBase58(),
      programDataAddress: deployment.programDataAddress.toBase58(),
      artifactSha256: deployment.artifactSha256,
      programBytes: deployment.programBytes,
      upgradeAuthority: deployment.upgradeAuthority.toBase58(),
    },
  };
}

function featureActionBinding(action, state) {
  return {
    id: action.id,
    signer: action.signer.toBase58(),
    lamports: action.lamports ?? null,
    week: action.week ?? null,
    positionIndex: action.positionIndex ?? null,
    ordinal: action.ordinal ?? null,
    roundAddress: action.roundAddress?.toBase58() ?? null,
    createsEphemeralProtocolSigner: action.createsEphemeralProtocolSigner === true,
    ceremonyHorizon: state.ceremonyHorizon,
    transactionState: {
      coreDestination: state.coreDestination.toBase58(),
      liquidityDestination: state.liquidityDestination.toBase58(),
      randomnessAddress: state.randomnessAddress?.toBase58() ?? null,
      currentRoundAddress: state.currentRoundAddress?.toBase58() ?? null,
      currentRoundLayoutVersion: state.currentRound?.layoutVersion ?? null,
      currentRoundRandomnessAccount: state.currentRound?.randomnessAccount?.toBase58() ?? null,
      currentRoundStatus: state.currentRound?.status ?? null,
    },
  };
}

function sameBinding(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameBytes(left, right) {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

async function loadFeatureState(
  baseSnapshot,
  minimumFinalizedSlot = 0,
  {
    retainedCreateReceipt = null,
    retainedCreatePredecessorReceipt = null,
    sha256Hex = null,
  } = {},
) {
  if (!Number.isSafeInteger(minimumFinalizedSlot) || minimumFinalizedSlot < 0) {
    throw new Error("Feature state minimum finalized slot is invalid");
  }
  const parentSlot = finalizedParentSnapshotSlot(
    baseSnapshot,
    "Parent initialization snapshot",
  );
  const configReadFloor = Math.max(parentSlot, minimumFinalizedSlot);
  const { mint, plan } = baseSnapshot;
  const configResult = await connection.getAccountInfoAndContext(
    plan.config,
    {
      commitment: FINALIZED_COMMITMENT,
      minContextSlot: configReadFloor,
    },
  );
  const configSlot = finalizedContextSlot(configResult, "Feature config", configReadFloor);
  const configInfo = configResult.value;
  if (!configInfo || !configInfo.owner.equals(IAT_V2_PROGRAM_ID)) {
    throw new Error("Feature config is missing from finalized Devnet state or has the wrong owner");
  }
  const config = parseV2ConfigAccount(configInfo.data);
  if (
    !config.admin.equals(IAT_V2_PROGRAM_ADMIN)
    || !config.mint.equals(mint)
    || !config.randomnessProgram.equals(SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID)
    || !config.rehearsalMode
    || !config.active
  ) {
    throw new Error("Finalized feature config is not the reviewed active Devnet rehearsal");
  }
  const genesisTimestamp = Number(config.genesisTimestamp);
  if (!Number.isSafeInteger(genesisTimestamp)) {
    throw new Error("Feature Genesis timestamp is outside the browser's safe range");
  }
  const configTimestamp = await finalizedBlockTimestamp(configSlot, "Feature config");
  const configWeek = currentIatV2Week(genesisTimestamp, configTimestamp);
  const configCccRound = currentIatV2CccRound(genesisTimestamp, configTimestamp);
  assertIatV2DevnetCeremonyHorizon({
    policyWeek: configWeek,
    cccRound: configCccRound,
    nowTimestamp: configTimestamp,
  });
  const eligibilityAddress = deriveEligibilityAddress({
    config: plan.config,
    wallet: COMMUNITY_CUSTODY,
  });
  const agencyAddresses = FEATURE_AGENCY_OWNERS.map((_owner, index) => deriveAgencyAddress({
    config: plan.config,
    programId: IAT_V2_PROGRAM_ID,
    index,
  }));
  const positionAddresses = FEATURE_POSITION_IDS.map((positionId) => derivePositionAddress({
    config: plan.config,
    programId: IAT_V2_PROGRAM_ID,
    owner: COMMUNITY_CUSTODY,
    positionId,
  }));
  const coreDestination = getAssociatedTokenAddressSync(mint, CORE_BENEFICIARY);
  const liquidityDestination = getAssociatedTokenAddressSync(mint, LIQUIDITY_BENEFICIARY);
  const currentRoundAddress = configCccRound === null
    ? null
    : deriveRoundAddress({
        config: plan.config,
        programId: IAT_V2_PROGRAM_ID,
        week: configCccRound,
      });
  const retainedRandomness = storedRandomnessContinuity(mint);
  let randomnessAddress = null;
  let randomnessContinuity = null;
  if (retainedRandomness) {
    if (!retainedCreateReceipt) {
      throw new Error(
        "A retained source-bound randomness record has no exact CREATE receipt; use the pre-ceremony discard control",
      );
    }
    const observedAddress = new PublicKey(retainedRandomness.address);
    if (!retainedCreatePredecessorReceipt) {
      throw new Error("A retained source-bound randomness record has no canonical predecessor receipt");
    }
    const [createTransaction, predecessorTransaction, randomnessAccountResult] = await Promise.all([
      connection.getTransaction(retainedRandomness.createSignature, {
        commitment: FINALIZED_COMMITMENT,
        maxSupportedTransactionVersion: 0,
      }),
      connection.getTransaction(retainedCreatePredecessorReceipt.signature, {
        commitment: FINALIZED_COMMITMENT,
        maxSupportedTransactionVersion: 0,
      }),
      connection.getAccountInfoAndContext(observedAddress, {
        commitment: FINALIZED_COMMITMENT,
        minContextSlot: configSlot,
      }),
    ]);
    const randomnessAccountSlot = finalizedContextSlot(
      randomnessAccountResult,
      "Retained randomness account",
      configSlot,
    );
    const sourceDeploymentSlot = baseSnapshot?.deployment?.slot;
    const sourceDeploymentSlotIsExact = typeof sourceDeploymentSlot === "bigint"
      ? sourceDeploymentSlot > 0n
      : Number.isSafeInteger(sourceDeploymentSlot) && sourceDeploymentSlot > 0;
    if (!sourceDeploymentSlotIsExact) {
      throw new Error("Reviewed source deployment slot is unavailable for randomness continuity");
    }
    const continuity = await verifyFinalizedRandomnessContinuity({
      record: retainedRandomness,
      createReceipt: retainedCreateReceipt,
      predecessorReceipt: retainedCreatePredecessorReceipt,
      predecessorTransactionResponse: predecessorTransaction,
      transactionResponse: createTransaction,
      observedAddress,
      accountInfo: randomnessAccountResult.value,
      accountContextSlot: randomnessAccountSlot,
      expectedAdmin: IAT_V2_PROGRAM_ADMIN,
      expectedParticipant: COMMUNITY_CUSTODY,
      expectedDestinationTokens: plan.allocationDestinations.community.tokenAccount,
      minimumCreationSlot: sourceDeploymentSlot,
      sha256Hex,
    });
    randomnessAddress = continuity.address;
    randomnessContinuity = continuity;
  }
  const addresses = [
    ...agencyAddresses,
    eligibilityAddress,
    ...positionAddresses,
    plan.coreReward,
    plan.lanes.liquidity.state,
    coreDestination,
    liquidityDestination,
    ...(currentRoundAddress ? [currentRoundAddress] : []),
    ...(randomnessAddress ? [randomnessAddress] : []),
  ];
  const continuityReadFloor = Math.max(
    configSlot,
    randomnessContinuity?.accountContextSlot ?? 0,
  );
  const stateResult = await connection.getMultipleAccountsInfoAndContext(addresses, {
    commitment: FINALIZED_COMMITMENT,
    minContextSlot: continuityReadFloor,
  });
  const stateSlot = finalizedContextSlot(stateResult, "Feature state", continuityReadFloor);
  const stateTimestamp = await finalizedBlockTimestamp(stateSlot, "Feature state");
  const currentWeek = currentIatV2Week(genesisTimestamp, stateTimestamp);
  const currentCccRound = currentIatV2CccRound(genesisTimestamp, stateTimestamp);
  assertIatV2DevnetCeremonyHorizon({
    policyWeek: currentWeek,
    cccRound: currentCccRound,
    nowTimestamp: stateTimestamp,
  });
  if (currentWeek !== configWeek || currentCccRound !== configCccRound) {
    throw new Error("Finalized Devnet time crossed a feature boundary; refresh before signing");
  }
  const infos = stateResult.value;
  const participantBalanceResult = await connection.getBalanceAndContext(COMMUNITY_CUSTODY, {
    commitment: FINALIZED_COMMITMENT,
    minContextSlot: stateSlot,
  });
  const participantBalanceSlot = finalizedContextSlot(
    participantBalanceResult,
    "Participant balance",
    stateSlot,
  );
  const participantBalanceLamports = participantBalanceResult.value;
  let cursor = 0;
  const agencyInfos = infos.slice(cursor, cursor += agencyAddresses.length);
  const eligibilityInfo = infos[cursor++];
  const positionInfos = infos.slice(cursor, cursor += positionAddresses.length);
  const coreRewardInfo = infos[cursor++];
  const liquidityStateInfo = infos[cursor++];
  const coreDestinationInfo = infos[cursor++];
  const liquidityDestinationInfo = infos[cursor++];
  const currentRoundInfo = currentRoundAddress ? infos[cursor++] : null;
  const randomnessInfo = randomnessAddress ? infos[cursor++] : null;
  if (currentRoundInfo && !currentRoundInfo.owner.equals(IAT_V2_PROGRAM_ID)) {
    throw new Error("Current CCC round has the wrong owner");
  }
  const currentRound = currentRoundInfo ? parseRoundAccount(currentRoundInfo.data) : null;
  if (currentRound && !randomnessAddress) {
    throw new Error(
      "An existing finalized CCC round has no verified source-bound randomness continuity",
    );
  }
  if (randomnessInfo && !randomnessInfo.owner.equals(SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID)) {
    throw new Error("Stored randomness account is not owned by the pinned Switchboard devnet program");
  }
  if (randomnessAddress && !randomnessInfo) {
    throw new Error(
      "The retained source-bound randomness account is absent; stop and use the pre-ceremony discard control",
    );
  }
  if (
    currentRound
    && randomnessAddress
    && !currentRound.randomnessAccount.equals(randomnessAddress)
  ) {
    throw new Error("Current CCC round randomness disagrees with verified source-bound continuity");
  }
  const positions = positionInfos.map((info) => {
    if (!info) return null;
    if (!info.owner.equals(IAT_V2_PROGRAM_ID)) throw new Error("Feature position has the wrong owner");
    return parsePositionAccount(info.data);
  });

  const duePositionSettlements = positions.map((position) => (
    position
      ? earliestDueIatV2PositionWeek({
        firstAccrualWeek: position.firstAccrualWeek,
        settledMask: position.settledMask,
        currentWeek,
      })
      : null
  ));
  const linkedRoundWeeks = [...new Set(
    duePositionSettlements
      .map((settlement, index) => (
        settlement && positions[index].role !== IAT_V2_ROLE.STANDARD
          ? settlement.week
          : null
      ))
      .filter((week) => week !== null),
  )];
  const linkedRoundAddresses = linkedRoundWeeks.map((week) => deriveRoundAddress({
    config: plan.config,
    programId: IAT_V2_PROGRAM_ID,
    week,
  }));
  const linkedRoundResult = linkedRoundAddresses.length
    ? await connection.getMultipleAccountsInfoAndContext(linkedRoundAddresses, {
        commitment: FINALIZED_COMMITMENT,
        minContextSlot: participantBalanceSlot,
      })
    : null;
  const finalObservationSlot = linkedRoundResult
    ? finalizedContextSlot(linkedRoundResult, "Linked rounds", participantBalanceSlot)
    : participantBalanceSlot;
  const linkedRoundInfos = linkedRoundResult?.value ?? [];
  const linkedRounds = Object.fromEntries(linkedRoundWeeks.map((week, index) => {
    const info = linkedRoundInfos[index];
    if (!info) return [week, null];
    if (!info.owner.equals(IAT_V2_PROGRAM_ID)) throw new Error("CCC round has the wrong owner");
    return [week, parseRoundAccount(info.data)];
  }));
  const nowTimestamp = await finalizedBlockTimestamp(finalObservationSlot, "Final feature observation");
  if (
    currentIatV2Week(genesisTimestamp, nowTimestamp) !== currentWeek
    || currentIatV2CccRound(genesisTimestamp, nowTimestamp) !== currentCccRound
  ) {
    throw new Error("Finalized Devnet time crossed a feature boundary; refresh before signing");
  }
  const ceremonyHorizon = assertIatV2DevnetCeremonyHorizon({
    policyWeek: currentWeek,
    cccRound: currentCccRound,
    nowTimestamp,
  });

  return {
    finalObservationSlot,
    nowTimestamp,
    genesisTimestamp,
    currentWeek,
    currentCccRound,
    ceremonyHorizon,
    agencyAddresses,
    agenciesRegistered: agencyInfos.filter(Boolean).length,
    participantBalanceLamports,
    eligibilityAddress,
    eligibility: eligibilityInfo ? parseEligibilityAccount(eligibilityInfo.data) : null,
    positionAddresses,
    positions,
    coreReward: coreRewardInfo ? parseCoreRewardAccount(coreRewardInfo.data) : null,
    liquidity: liquidityStateInfo ? parseLaneVaultAccount(liquidityStateInfo.data) : null,
    coreDestination,
    coreDestinationExists: Boolean(coreDestinationInfo),
    liquidityDestination,
    liquidityDestinationExists: Boolean(liquidityDestinationInfo),
    randomnessAddress: randomnessInfo ? randomnessAddress : null,
    randomnessContinuity,
    currentRoundAddress,
    currentRound,
    linkedRounds,
  };
}

function nextFeatureAction(state) {
  if (state.agenciesRegistered < 1) {
    return {
      id: "REGISTER_AGENCY_0",
      title: "Register FDF Guard agency",
      detail: "Creates agency index 0 from the already published verifier address.",
      signer: IAT_V2_PROGRAM_ADMIN,
    };
  }
  if (state.agenciesRegistered < 2) {
    return {
      id: "REGISTER_AGENCY_1",
      title: "Register publication-operator agency",
      detail: "Creates agency index 1 so the CCC draw has a real multi-agency set.",
      signer: IAT_V2_PROGRAM_ADMIN,
    };
  }
  if (!state.positions[0] && !roleMatches(state.eligibility, IAT_V2_ROLE.STANDARD)) {
    return {
      id: "SET_STANDARD_ELIGIBILITY",
      title: "Certify standard staking role",
      detail: "Sets the community custody wallet to the public 10% standard role.",
      signer: IAT_V2_PROGRAM_ADMIN,
    };
  }
  if (!state.positions[0] && state.participantBalanceLamports < PARTICIPANT_RENT_TARGET_LAMPORTS) {
    return {
      id: "FUND_PARTICIPANT_RENT",
      title: "Fund participant account rent",
      detail: "Transfers only enough devnet SOL to bring the staking owner to 0.03 SOL for three position accounts and fees.",
      signer: IAT_V2_PROGRAM_ADMIN,
      lamports: PARTICIPANT_RENT_TARGET_LAMPORTS - state.participantBalanceLamports,
    };
  }
  if (!state.positions[0]) {
    return {
      id: "OPEN_STANDARD_POSITION",
      title: "Open 10 IAT standard position",
      detail: "Transfers real devnet IAT into the program stake vault and reserves its full reward obligation.",
      signer: COMMUNITY_CUSTODY,
    };
  }
  if (!state.positions[1] && !roleMatches(state.eligibility, IAT_V2_ROLE.CCC_AGENT, 0)) {
    return {
      id: "SET_CCC_AGENT_ELIGIBILITY",
      title: "Certify CCC-agent staking role",
      detail: "Links the participant to agency index 0 at the published 28% role.",
      signer: IAT_V2_PROGRAM_ADMIN,
    };
  }
  if (!state.positions[1]) {
    return {
      id: "OPEN_CCC_AGENT_POSITION",
      title: "Open 10 IAT CCC-agent position",
      detail: "Locks role and agency at acceptance; later eligibility edits cannot rewrite this position.",
      signer: COMMUNITY_CUSTODY,
    };
  }
  if (!state.positions[2] && !roleMatches(state.eligibility, IAT_V2_ROLE.CCC_ASSOCIATE, 1)) {
    return {
      id: "SET_CCC_ASSOCIATE_ELIGIBILITY",
      title: "Certify CCC-associate staking role",
      detail: "Links the participant to agency index 1 at the published 20% role.",
      signer: IAT_V2_PROGRAM_ADMIN,
    };
  }
  if (!state.positions[2]) {
    return {
      id: "OPEN_CCC_ASSOCIATE_POSITION",
      title: "Open 10 IAT CCC-associate position",
      detail: "Creates the third role-specific position and proves ordered APY reservation.",
      signer: COMMUNITY_CUSTODY,
    };
  }
  if (state.coreReward && !bitIsSet(state.coreReward.settledLow, 0)) {
    return {
      id: "SETTLE_CORE_WEEK_0",
      title: "Settle core-team APY week 0",
      detail: "Pays the first fixed 17% weekly slice to the hardware-owned core beneficiary.",
      signer: IAT_V2_PROGRAM_ADMIN,
    };
  }
  if (state.liquidity && state.liquidity.principalClaimed === 0n) {
    return {
      id: "CLAIM_LIQUIDITY_GENESIS_UNLOCK",
      title: "Claim unlocked liquidity principal",
      detail: "Disperses only the 25% Genesis-unlocked liquidity amount to its hardware beneficiary.",
      signer: IAT_V2_PROGRAM_ADMIN,
    };
  }
  const dueSettlement = selectIatV2FeatureDuePositionSettlement({
    positions: state.positions,
    currentWeek: state.currentWeek,
    linkedRounds: state.linkedRounds,
  });
  if (dueSettlement?.positionIndex === 0) {
    return {
      id: `SETTLE_STANDARD_POSITION_WEEK_${dueSettlement.week}`,
      title: `Settle standard position week ${dueSettlement.week}`,
      detail: "Pays one exact 10% annualized weekly slice from the reserved ordered lanes.",
      signer: IAT_V2_PROGRAM_ADMIN,
      positionIndex: 0,
      ordinal: dueSettlement.ordinal,
      week: dueSettlement.week,
    };
  }
  if (dueSettlement) {
    const position = state.positions[dueSettlement.positionIndex];
    return {
      id: `SETTLE_LINKED_POSITION_${dueSettlement.positionIndex + 1}_WEEK_${dueSettlement.week}`,
      title: `Settle ${position.role === 1 ? "CCC-agent" : "CCC-associate"} week ${dueSettlement.week}`,
      detail: dueSettlement.round.status === 1
        ? "Applies the settled CCC result: the selected agency is paused and every other linked position is paid."
        : "Applies terminal neutral recovery: no agency is selected and each linked position receives the floor of its fair expected reward.",
      signer: IAT_V2_PROGRAM_ADMIN,
      positionIndex: dueSettlement.positionIndex,
      ordinal: dueSettlement.ordinal,
      week: dueSettlement.week,
      roundAddress: deriveRoundAddress({
        config: position.config,
        programId: IAT_V2_PROGRAM_ID,
        week: dueSettlement.week,
      }),
    };
  }
  if (!state.randomnessAddress) {
    return {
      id: "CREATE_SWITCHBOARD_RANDOMNESS",
      title: "Create ephemeral Switchboard account",
      detail: "A user click generates a non-custodial protocol signer in memory, initializes its account, then destroys the secret bytes.",
      signer: IAT_V2_PROGRAM_ADMIN,
      createsEphemeralProtocolSigner: true,
    };
  }
  if (state.currentCccRound !== null && !state.currentRound) {
    return {
      id: `COMMIT_CCC_ROUND_${state.currentCccRound}`,
      title: `Commit CCC round ${state.currentCccRound}`,
      detail: "Switchboard commit is immediately followed by the IAT round commit in one atomic transaction.",
      signer: IAT_V2_PROGRAM_ADMIN,
      week: state.currentCccRound,
    };
  }
  if (state.currentRound && state.currentRound.status === 0) {
    if (state.currentRound.layoutVersion === IAT_V2_ROUND_LAYOUT.LEGACY_V1) {
      return {
        id: `REVEAL_CCC_ROUND_${state.currentCccRound}`,
        title: `Reveal and settle legacy CCC round ${state.currentCccRound}`,
        detail: "The deployed 198-byte V1 round has no timestamp or neutral-expiry instruction. Reveal is its only reviewed terminal path.",
        signer: IAT_V2_PROGRAM_ADMIN,
        week: state.currentCccRound,
      };
    }
    const recoveryWait = secondsUntilIatV2RoundRecovery(
      Number(state.currentRound.commitTimestamp),
      state.nowTimestamp,
    );
    if (recoveryWait === 0) {
      return {
        id: `EXPIRE_CCC_ROUND_${state.currentCccRound}`,
        title: `Finalize unavailable CCC round ${state.currentCccRound}`,
        detail: "Permanently resolves the missing reveal without a replacement roll; every linked position receives the floor of its fair expected weekly reward.",
        signer: IAT_V2_PROGRAM_ADMIN,
        week: state.currentCccRound,
      };
    }
    return {
      id: `REVEAL_CCC_ROUND_${state.currentCccRound}`,
      title: `Reveal and settle CCC round ${state.currentCccRound}`,
      detail: `Fetches the enclave reveal and settles the unbiased agency index in the same transaction. Neutral recovery opens in ${formatRehearsalWait(recoveryWait)}.`,
      signer: IAT_V2_PROGRAM_ADMIN,
      week: state.currentCccRound,
    };
  }
  return null;
}

function waitDescription(state) {
  const nextSettlement = state.positions
    .map((position, positionIndex) => {
      if (!position) return null;
      const next = iterateUnsetIatV2PositionWeeks({
        firstAccrualWeek: position.firstAccrualWeek,
        settledMask: position.settledMask,
      }).next();
      return next.done ? null : { position, positionIndex, ...next.value };
    })
    .filter(Boolean)
    .sort((left, right) => left.week - right.week || left.positionIndex - right.positionIndex)[0];
  if (!nextSettlement) {
    return "Immediate feature path complete. Long-term maturity remains a deterministic production-host time-gate proof; Devnet wall-clock time is not warped.";
  }
  const { position, week } = nextSettlement;
  if (position.role === IAT_V2_ROLE.STANDARD) {
    const seconds = secondsUntilIatV2Week(state.genesisTimestamp, week, state.nowTimestamp);
    return `Standard settlement opens in ${formatRehearsalWait(seconds)} at policy week ${week}.`;
  }
  const seconds = secondsUntilIatV2CccRound(state.genesisTimestamp, week, state.nowTimestamp);
  return `CCC-linked settlement needs real round ${week}, opening in ${formatRehearsalWait(seconds)}.`;
}

function switchboardBuildOnlyWallet(publicKey) {
  const rejectDirectSigning = async () => {
    throw new Error("Switchboard transaction builders cannot invoke the Model T signing provider");
  };
  return {
    publicKey,
    signTransaction: rejectDirectSigning,
    signAllTransactions: rejectDirectSigning,
  };
}

let switchboardModulePromise;

function loadSwitchboardModule() {
  switchboardModulePromise ??= import("@switchboard-xyz/on-demand");
  return switchboardModulePromise;
}

async function switchboardProgram(publicKey) {
  const switchboard = await loadSwitchboardModule();
  const program = await switchboard.AnchorUtils.loadProgramFromConnection(
    connection,
    switchboardBuildOnlyWallet(publicKey),
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  );
  return { program, switchboard };
}

async function buildActionTransaction(action, state, baseSnapshot) {
  const { mint, plan } = baseSnapshot;
  const transaction = new Transaction();
  let ephemeralKeypair = null;
  let randomnessAddress = null;
  switch (action.id) {
    case "REGISTER_AGENCY_0":
    case "REGISTER_AGENCY_1": {
      const agencyIndex = action.id.endsWith("_0") ? 0 : 1;
      transaction.add(buildRegisterAgencyInstruction({
        mint,
        agencyOwner: FEATURE_AGENCY_OWNERS[agencyIndex],
        agencyIndex,
      }));
      break;
    }
    case "SET_STANDARD_ELIGIBILITY":
      transaction.add(buildSetEligibilityInstruction({
        mint,
        wallet: COMMUNITY_CUSTODY,
        role: IAT_V2_ROLE.STANDARD,
      }));
      break;
    case "SET_CCC_AGENT_ELIGIBILITY":
      transaction.add(buildSetEligibilityInstruction({
        mint,
        wallet: COMMUNITY_CUSTODY,
        role: IAT_V2_ROLE.CCC_AGENT,
        agencyIndex: 0,
      }));
      break;
    case "SET_CCC_ASSOCIATE_ELIGIBILITY":
      transaction.add(buildSetEligibilityInstruction({
        mint,
        wallet: COMMUNITY_CUSTODY,
        role: IAT_V2_ROLE.CCC_ASSOCIATE,
        agencyIndex: 1,
      }));
      break;
    case "FUND_PARTICIPANT_RENT":
      transaction.add(SystemProgram.transfer({
        fromPubkey: action.signer,
        toPubkey: COMMUNITY_CUSTODY,
        lamports: action.lamports,
      }));
      break;
    case "OPEN_STANDARD_POSITION":
    case "OPEN_CCC_AGENT_POSITION":
    case "OPEN_CCC_ASSOCIATE_POSITION": {
      const positionId = action.id === "OPEN_STANDARD_POSITION"
        ? FEATURE_POSITION_IDS[0]
        : action.id === "OPEN_CCC_AGENT_POSITION"
          ? FEATURE_POSITION_IDS[1]
          : FEATURE_POSITION_IDS[2];
      transaction.add(buildOpenPositionInstruction({
        owner: COMMUNITY_CUSTODY,
        mint,
        ownerTokens: plan.allocationDestinations.community.tokenAccount,
        positionId,
        principal: FEATURE_POSITION_PRINCIPAL,
      }));
      break;
    }
    case "SETTLE_CORE_WEEK_0":
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          action.signer,
          state.coreDestination,
          CORE_BENEFICIARY,
          mint,
        ),
        buildSettleCoreWeekInstruction({
          caller: action.signer,
          mint,
          destinationTokens: state.coreDestination,
          ordinal: 0,
        }),
      );
      break;
    case "CLAIM_LIQUIDITY_GENESIS_UNLOCK":
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          action.signer,
          state.liquidityDestination,
          LIQUIDITY_BENEFICIARY,
          mint,
        ),
        buildClaimLanePrincipalInstruction({
          caller: action.signer,
          mint,
          destinationTokens: state.liquidityDestination,
          lane: 4,
        }),
      );
      break;
    case "CREATE_SWITCHBOARD_RANDOMNESS": {
      ephemeralKeypair = Keypair.generate();
      randomnessAddress = ephemeralKeypair.publicKey;
      const { program, switchboard } = await switchboardProgram(action.signer);
      const [, initializeIx] = await switchboard.Randomness.create(
        program,
        ephemeralKeypair,
        switchboard.ON_DEMAND_DEVNET_QUEUE,
        action.signer,
      );
      transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }), initializeIx);
      break;
    }
    default:
      if (action.id.startsWith("COMMIT_CCC_ROUND_")) {
        const { program, switchboard } = await switchboardProgram(action.signer);
        const randomness = new switchboard.Randomness(program, state.randomnessAddress);
        const commitIx = await randomness.commitIx(
          switchboard.ON_DEMAND_DEVNET_QUEUE,
          action.signer,
        );
        transaction.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
          commitIx,
          buildCommitRoundInstruction({
            payer: action.signer,
            mint,
            randomnessAccount: state.randomnessAddress,
            week: action.week,
          }),
        );
      } else if (action.id.startsWith("REVEAL_CCC_ROUND_")) {
        const { program, switchboard } = await switchboardProgram(action.signer);
        const randomness = new switchboard.Randomness(program, state.randomnessAddress);
        const revealIx = await randomness.revealIx(action.signer);
        transaction.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
          revealIx,
          buildSettleRoundInstruction({
            mint,
            randomnessAccount: state.randomnessAddress,
            week: action.week,
          }),
        );
      } else if (action.id.startsWith("EXPIRE_CCC_ROUND_")) {
        if (state.currentRound?.layoutVersion === IAT_V2_ROUND_LAYOUT.LEGACY_V1) {
          throw new Error("The deployed 198-byte V1 round has no neutral-expiry instruction");
        }
        transaction.add(buildExpireRoundInstruction({
          mint,
          week: action.week,
        }));
      } else if (
        action.id.startsWith("SETTLE_STANDARD_POSITION_WEEK_")
        || action.id.startsWith("SETTLE_LINKED_POSITION_")
      ) {
        transaction.add(buildSettlePositionWeekInstruction({
          caller: action.signer,
          mint,
          positionOwner: COMMUNITY_CUSTODY,
          positionId: FEATURE_POSITION_IDS[action.positionIndex],
          destinationTokens: plan.allocationDestinations.community.tokenAccount,
          week: action.week,
          round: action.roundAddress ?? null,
        }));
      } else {
        throw new Error(`No transaction builder exists for ${action.id}`);
      }
  }
  return { transaction, ephemeralKeypair, randomnessAddress };
}

async function requestFeatureModelTSignature({
  coordinator,
  binding,
  action,
  messageSha256,
  provider,
  signer,
  transaction,
  verifySigned,
}) {
  const result = await coordinator.request({
    binding,
    action,
    messageSha256,
    signer: signer.toBase58(),
    prompt: async () => {
      const signed = await provider.signTransaction(transaction);
      await verifySigned(signed);
      return signed;
    },
  });
  return result.value;
}

function assertFeaturePromptOrder(binding, nextAction) {
  const receiptSet = loadAttendedReceiptSet(localStorage, binding);
  const preUpgradeCapacity = receiptSet.preUpgradeProgramDataCapacityBytes;
  if (
    receiptSet.receipts.length === 0
    || !Number.isSafeInteger(preUpgradeCapacity)
    || preUpgradeCapacity <= 0
  ) {
    throw new Error(
      "Canonical feature prompting requires prior receipts and the frozen pre-upgrade ProgramData capacity",
    );
  }
  const programDataExtensionRequired =
    preUpgradeCapacity < IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES;
  const extensionReceiptPresent = receiptSet.receipts.some(
    ({ action }) => action === "EXTEND_PROGRAM_DATA",
  );
  if (extensionReceiptPresent !== programDataExtensionRequired) {
    throw new Error("Canonical extension receipt disagrees with the frozen pre-upgrade capacity");
  }
  return assertCanonicalAttendedNextActionFromReceiptSet({
    receiptSet,
    expectedBinding: binding,
    programDataExtensionRequired,
    nextAction,
  });
}

export default function FeatureRehearsal({
  baseSnapshot,
  explorer,
  getHardwareProvider,
  json,
  loadFeatureParentSnapshot,
  sha256Hex,
  short,
  verifyMigrationDeployment,
}) {
  const exactStorageBinding = exactFeatureStorageBinding(baseSnapshot.mint);
  const evidenceStorageKey = featureEvidenceStorageKey(baseSnapshot.mint);
  const randomnessStorageKey = featureRandomnessStorageKey(baseSnapshot.mint);
  const randomnessJournalKey = randomnessCreateJournalStorageKey(
    exactStorageBinding,
  );
  const [promptCoordinator] = useState(createAttendedModelTPromptCoordinator);
  const [state, setState] = useState(null);
  const [evidence, setEvidence] = useState(() => loadEvidence(baseSnapshot.mint));
  const [operatorReceiptSets, setOperatorReceiptSets] = useState([]);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("LOADING FEATURE STATE");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);
  const [retainedRandomnessSerialized, setRetainedRandomnessSerialized] = useState(
    () => localStorage.getItem(randomnessStorageKey),
  );
  const [retainedRandomnessJournalSerialized, setRetainedRandomnessJournalSerialized] = useState(
    () => localStorage.getItem(randomnessJournalKey),
  );
  const randomnessCreationReceipt = evidence.find(
    (record) => record.action === "CREATE_SWITCHBOARD_RANDOMNESS",
  ) ?? null;
  const retainedRandomnessExists = Boolean(
    retainedRandomnessSerialized || retainedRandomnessJournalSerialized,
  );
  let canonicalRandomnessDiscardInspection = Object.freeze({
    canonicalCreateRecorded: null,
    discardEligible: false,
  });
  try {
    canonicalRandomnessDiscardInspection = inspectCanonicalRandomnessDiscardEligibility({
      storage: localStorage,
      expectedBinding: exactStorageBinding,
      programArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
    });
  } catch {
    // Malformed, incomplete, or unavailable strict receipt storage keeps discard fail-closed.
  }
  const randomnessDiscardEligible = Boolean(
    retainedRandomnessSerialized
      && !retainedRandomnessJournalSerialized
      && state?.randomnessContinuity
      && evidence.length === 0
      && !busy
      && !pending
      && canonicalRandomnessDiscardInspection.discardEligible,
  );
  let retainedRandomnessSource = retainedRandomnessSerialized;
  let retainedRandomnessDisplay = null;
  try {
    if (!retainedRandomnessSource && retainedRandomnessJournalSerialized) {
      retainedRandomnessSource = JSON.stringify(randomnessJournalContinuityRecord(
        loadRandomnessCreateJournal(
          localStorage,
          exactFeatureStorageBinding(baseSnapshot.mint),
        ),
      ));
    }
    if (retainedRandomnessSource) {
      retainedRandomnessDisplay = parseRandomnessContinuityRecord(
        retainedRandomnessSource,
        exactFeatureStorageBinding(baseSnapshot.mint),
      ).address;
    }
  } catch {
    retainedRandomnessDisplay = "MALFORMED SOURCE-BOUND CONTINUITY OR RECOVERY JOURNAL";
  }

  const action = useMemo(() => state ? nextFeatureAction(state) : null, [state]);

  const recoverVerifiedRandomness = useCallback((verifiedState) => {
    const verified = verifiedState.randomnessContinuity;
    if (!verified) return null;
    const exactBinding = exactFeatureStorageBinding(baseSnapshot.mint);
    const receiptSet = loadAttendedReceiptSet(localStorage, exactBinding);
    const canonicalCreate = receiptSet.receipts.find(
      ({ action: receiptAction }) => receiptAction === "CREATE_SWITCHBOARD_RANDOMNESS",
    ) ?? null;
    const featureCreate = evidence.find(
      ({ action: receiptAction }) => receiptAction === "CREATE_SWITCHBOARD_RANDOMNESS",
    ) ?? null;
    const retained = localStorage.getItem(randomnessStorageKey);
    let journal = loadRandomnessCreateJournal(localStorage, exactBinding);
    const complete = !journal
      && retained !== null
      && canonicalCreate?.signature === verified.record.createSignature
      && canonicalCreate?.messageSha256 === verified.record.createMessageSha256
      && featureCreate?.signature === verified.record.createSignature
      && featureCreate?.messageSha256 === verified.record.createMessageSha256;
    if (complete) return null;
    if (!journal) {
      journal = canonicalRandomnessCreateJournal({
        sourceCommit: verified.record.sourceCommit,
        programArtifactSha256: verified.record.programArtifactSha256,
        mint: verified.record.mint,
        address: verified.record.address,
        createSignature: verified.record.createSignature,
        createMessageSha256: verified.record.createMessageSha256,
        title: IAT_V2_RANDOMNESS_CREATE_TITLE,
      });
      persistRandomnessCreateJournal(localStorage, journal);
      setRetainedRandomnessJournalSerialized(JSON.stringify(journal));
    }
    const recovered = reconcileVerifiedRandomnessCreateJournal({
      storage: localStorage,
      expectedBinding: exactBinding,
      journal,
      verifiedContinuity: verified,
      continuityStorageKey: randomnessStorageKey,
      featureEvidenceKey: evidenceStorageKey,
      programArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
    });
    setRetainedRandomnessSerialized(JSON.stringify(recovered.continuity));
    setRetainedRandomnessJournalSerialized(null);
    setEvidence(recovered.featureEvidence);
    return recovered;
  }, [baseSnapshot.mint, evidence, evidenceStorageKey, randomnessStorageKey]);

  async function loadFreshAttendedBoundary(minimumFinalizedSlot = 0) {
    if (!Number.isSafeInteger(minimumFinalizedSlot) || minimumFinalizedSlot < 0) {
      throw new Error("Attended boundary minimum finalized slot is invalid");
    }
    const baseSlot = finalizedParentSnapshotSlot(
      baseSnapshot,
      "Parent initialization snapshot",
    );
    const readFloor = Math.max(baseSlot, minimumFinalizedSlot);
    const reviewedParentBinding = featureParentBinding(baseSnapshot);
    const parentSnapshot = await loadFeatureParentSnapshot(readFloor);
    const parentSlot = finalizedParentSnapshotSlot(
      parentSnapshot,
      "Fresh parent initialization snapshot",
      readFloor,
    );
    const parentBinding = featureParentBinding(parentSnapshot);
    if (
      !parentSnapshot.complete
      || !parentSnapshot.active
      || !sameBinding(parentBinding, reviewedParentBinding)
    ) {
      throw new Error("Fresh finalized parent snapshot no longer matches the reviewed active deployment");
    }
    const retainedInputs = retainedRandomnessCreateInputs(baseSnapshot.mint, evidence);
    const childState = await loadFeatureState(parentSnapshot, parentSlot, {
      ...retainedInputs,
      sha256Hex,
    });
    recoverVerifiedRandomness(childState);
    const deployment = await verifyMigrationDeployment(childState.finalObservationSlot);
    const deploymentObservation = migrationDeploymentObservation(
      deployment,
      childState.finalObservationSlot,
    );
    return {
      parentSnapshot,
      parentBinding,
      state: childState,
      deploymentBinding: deploymentObservation.binding,
      finalObservationSlot: deploymentObservation.contextSlot,
    };
  }

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    setStatus("VERIFYING FEATURE ACCOUNTS");
    try {
      const retainedInputs = retainedRandomnessCreateInputs(baseSnapshot.mint, evidence);
      const next = await loadFeatureState(baseSnapshot, 0, {
        ...retainedInputs,
        sha256Hex,
      });
      recoverVerifiedRandomness(next);
      setState(next);
      const nextAction = nextFeatureAction(next);
      setStatus(nextAction ? `READY // ${nextAction.id}` : "WAIT GATE // NO SAFE ACTION YET");
      return next;
    } catch (caught) {
      setState(null);
      setStatus("HOLD // FEATURE VERIFICATION FAILED");
      setError(caught instanceof Error ? caught.message : String(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [baseSnapshot, evidence, recoverVerifiedRandomness, sha256Hex]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(evidenceStorageKey, JSON.stringify(evidence));
  }, [evidence, evidenceStorageKey]);

  async function simulateAndRequestSignature() {
    if (!action || pending || busy) return;
    setBusy(true);
    setError("");
    setLogs([]);
    setStatus("BUILDING + SIMULATING // NOTHING WILL BE BROADCAST");
    let ephemeralKeypair = null;
    try {
      const buildBoundary = await loadFreshAttendedBoundary(
        finalizedParentSnapshotSlot(baseSnapshot, "Parent initialization snapshot"),
      );
      const current = buildBoundary.state;
      const currentAction = nextFeatureAction(current);
      const reviewedActionBinding = featureActionBinding(action, state);
      const currentActionBinding = currentAction ? featureActionBinding(currentAction, current) : null;
      if (!currentAction || !sameBinding(currentActionBinding, reviewedActionBinding)) {
        setState(current);
        throw new Error("Chain state advanced; review the newly computed action");
      }
      if (currentAction.id === "CREATE_SWITCHBOARD_RANDOMNESS" && current.currentRound) {
        throw new Error(
          "An existing finalized CCC round has no source-bound randomness continuity; fresh randomness creation is blocked",
        );
      }
      const promptBinding = evidenceBinding();
      attendedPromptLatchKey({ binding: promptBinding, action: currentAction.id });
      assertFeaturePromptOrder(promptBinding, currentAction.id);
      setState(current);
      setStatus(`CONNECTING ${signerRole(currentAction.signer)} // ${short(currentAction.signer.toBase58(), 9)}`);
      const { provider, publicKey } = await getHardwareProvider(currentAction.signer);
      if (!publicKey.equals(currentAction.signer)) {
        throw new Error("Connected hardware account is not the exact reviewed feature signer");
      }
      const built = await buildActionTransaction(
        currentAction,
        current,
        buildBoundary.parentSnapshot,
      );
      ephemeralKeypair = built.ephemeralKeypair;
      const latestResult = await connection.getLatestBlockhashAndContext({
        commitment: FINALIZED_COMMITMENT,
        minContextSlot: buildBoundary.finalObservationSlot,
      });
      const latestContextSlot = finalizedContextSlot(
        latestResult,
        "Transaction blockhash",
        buildBoundary.finalObservationSlot,
      );
      const latest = latestResult.value;
      built.transaction.feePayer = publicKey;
      built.transaction.recentBlockhash = latest.blockhash;
      if (ephemeralKeypair) built.transaction.partialSign(ephemeralKeypair);
      const wireSize = built.transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }).length;
      if (wireSize > 1232) throw new Error(`Transaction is ${wireSize} bytes, above Solana's limit`);
      const reviewedMessageBytes = built.transaction.serializeMessage();
      const simulationTransaction = new VersionedTransaction(built.transaction.compileMessage());
      if (!sameBytes(simulationTransaction.message.serialize(), reviewedMessageBytes)) {
        throw new Error("Exact reviewed legacy message changed while preparing simulation");
      }
      const messageSha256 = await sha256Hex(reviewedMessageBytes);
      const simulation = await connection.simulateTransaction(simulationTransaction, {
        commitment: FINALIZED_COMMITMENT,
        minContextSlot: latestContextSlot,
        replaceRecentBlockhash: false,
        sigVerify: false,
      });
      const simulationSlot = finalizedContextSlot(
        simulation,
        "Transaction simulation",
        latestContextSlot,
      );
      setLogs(simulation.value.logs ?? []);
      if (simulation.value.err) {
        throw new Error(`Simulation failed: ${json(simulation.value.err)}`);
      }
      const postSimulationMessageBytes = built.transaction.serializeMessage();
      if (
        !sameBytes(postSimulationMessageBytes, reviewedMessageBytes)
        || await sha256Hex(postSimulationMessageBytes) !== messageSha256
      ) {
        throw new Error("Simulation changed the exact hardware-reviewed transaction message");
      }
      const promptBoundary = await loadFreshAttendedBoundary(simulationSlot);
      const promptAction = nextFeatureAction(promptBoundary.state);
      const promptActionBinding = promptAction
        ? featureActionBinding(promptAction, promptBoundary.state)
        : null;
      if (
        !promptAction
        || !sameBinding(promptActionBinding, currentActionBinding)
        || !sameBinding(promptBoundary.parentBinding, buildBoundary.parentBinding)
        || !sameBinding(promptBoundary.deploymentBinding, buildBoundary.deploymentBinding)
      ) {
        setState(promptBoundary.state);
        throw new Error("Finalized deployment or action changed before the hardware prompt");
      }
      setState(promptBoundary.state);
      setStatus("HARDWARE // REVIEW + SIGN; STILL NOT BROADCAST");
      assertFeaturePromptOrder(promptBinding, promptAction.id);
      const signed = await requestFeatureModelTSignature({
        coordinator: promptCoordinator,
        binding: promptBinding,
        action: promptAction.id,
        messageSha256,
        provider,
        signer: publicKey,
        transaction: built.transaction,
        verifySigned: async (candidate) => {
          const signedMessageSha256 = await sha256Hex(candidate.serializeMessage());
          if (signedMessageSha256 !== messageSha256) {
            throw new Error("Wallet changed the reviewed transaction message");
          }
          const walletSignature = candidate.signatures.find(
            ({ publicKey: signer }) => signer.equals(publicKey),
          );
          if (!walletSignature?.signature) {
            throw new Error("Required hardware signature is missing");
          }
          if (!candidate.verifySignatures()) {
            throw new Error("Signed transaction failed local signature verification");
          }
        },
      });
      setPending({
        action: currentAction.id,
        actionBinding: promptActionBinding,
        title: currentAction.title,
        signed,
        messageSha256,
        latest,
        wireSize,
        parentBinding: promptBoundary.parentBinding,
        deploymentBinding: promptBoundary.deploymentBinding,
        finalObservationSlot: promptBoundary.finalObservationSlot,
        randomnessAddress: built.randomnessAddress,
        week: Number.isSafeInteger(currentAction.week) ? currentAction.week : null,
      });
      setStatus("SIGNED // NOT BROADCAST — REVIEW THEN PRESS BROADCAST");
    } catch (caught) {
      setStatus("HOLD // ACTION PREPARATION STOPPED");
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (ephemeralKeypair) ephemeralKeypair.secretKey.fill(0);
      setBusy(false);
    }
  }

  async function broadcastSigned() {
    if (!pending || busy) return;
    setBusy(true);
    setError("");
    setStatus("REVERIFYING FINALIZED DEPLOYMENT + ACTION // NOTHING BROADCAST");
    let broadcastBoundaryValidated = false;
    try {
      const boundary = await loadFreshAttendedBoundary(pending.finalObservationSlot);
      const currentAction = nextFeatureAction(boundary.state);
      const currentActionBinding = currentAction
        ? featureActionBinding(currentAction, boundary.state)
        : null;
      if (
        !currentAction
        || currentAction.id !== pending.action
        || !sameBinding(currentActionBinding, pending.actionBinding)
      ) {
        throw new Error("Finalized feature action no longer matches the signed transaction");
      }
      if (
        !sameBinding(boundary.parentBinding, pending.parentBinding)
        || !sameBinding(boundary.deploymentBinding, pending.deploymentBinding)
      ) {
        throw new Error("Finalized deployment binding changed after the hardware signature");
      }
      const signedMessageSha256 = await sha256Hex(pending.signed.serializeMessage());
      if (signedMessageSha256 !== pending.messageSha256) {
        throw new Error("Signed transaction message changed after hardware review");
      }
      if (
        pending.signed.recentBlockhash !== pending.latest.blockhash
        || !pending.signed.verifySignatures()
      ) {
        throw new Error("Signed transaction or blockhash no longer matches the reviewed payload");
      }
      const blockhashValidity = await connection.isBlockhashValid(pending.latest.blockhash, {
        commitment: FINALIZED_COMMITMENT,
        minContextSlot: boundary.finalObservationSlot,
      });
      finalizedContextSlot(
        blockhashValidity,
        "Signed transaction blockhash",
        boundary.finalObservationSlot,
      );
      if (!blockhashValidity.value) {
        throw new Error("Signed transaction blockhash is no longer valid");
      }
      let stagedCreateJournal = null;
      if (pending.randomnessAddress) {
        if (pending.action !== "CREATE_SWITCHBOARD_RANDOMNESS") {
          throw new Error("Randomness signer material is attached to a non-CREATE action");
        }
        stagedCreateJournal = canonicalRandomnessCreateJournal({
          ...exactFeatureStorageBinding(baseSnapshot.mint),
          address: pending.randomnessAddress.toBase58(),
          createSignature: encodeSolanaSignature(pending.signed.signature),
          createMessageSha256: pending.messageSha256,
          title: IAT_V2_RANDOMNESS_CREATE_TITLE,
        });
        persistRandomnessCreateJournal(localStorage, stagedCreateJournal);
        setRetainedRandomnessJournalSerialized(JSON.stringify(stagedCreateJournal));
      }
      setState(boundary.state);
      broadcastBoundaryValidated = true;
      setStatus("BROADCASTING USER-APPROVED DEVNET TRANSACTION");
      const signature = await connection.sendRawTransaction(pending.signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: FINALIZED_COMMITMENT,
        maxRetries: 3,
      });
      if (stagedCreateJournal && signature !== stagedCreateJournal.createSignature) {
        throw new Error("Broadcast randomness CREATE signature disagrees with the durable recovery journal");
      }
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: pending.latest.blockhash,
        lastValidBlockHeight: pending.latest.lastValidBlockHeight,
      }, FINALIZED_COMMITMENT);
      if (confirmation.value.err) {
        throw new Error(`Confirmation failed: ${json(confirmation.value.err)}`);
      }
      const confirmationSlot = finalizedContextSlot(
        confirmation,
        "Finalized transaction confirmation",
        boundary.finalObservationSlot,
      );
      if (!stagedCreateJournal) {
        const record = {
          action: pending.action,
          title: pending.title,
          signature,
          messageSha256: pending.messageSha256,
          explorerUrl: explorer("tx", signature),
          finalizedAtUtc: new Date().toISOString(),
          week: pending.week,
        };
        persistAttendedReceipt(localStorage, evidenceBinding(), {
          ...record,
          kind: "feature",
        });
        setEvidence((current) => [
          ...current.filter((entry) => entry.action !== record.action),
          record,
        ]);
      }
      const refreshedBoundary = await loadFreshAttendedBoundary(confirmationSlot);
      setPending(null);
      setState(refreshedBoundary.state);
      const nextAction = nextFeatureAction(refreshedBoundary.state);
      setStatus(nextAction ? `CONFIRMED // NEXT ${nextAction.id}` : "CONFIRMED // WAIT GATE");
    } catch (caught) {
      if (!broadcastBoundaryValidated) {
        setPending(null);
        setStatus("HOLD // SIGNED TRANSACTION DISCARDED BEFORE BROADCAST");
      } else {
        setStatus("HOLD // BROADCAST OR CONFIRMATION FAILED");
      }
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  function discardPending() {
    setPending(null);
    setStatus("SIGNED TRANSACTION DISCARDED // NOTHING BROADCAST");
  }

  function featureEvidencePayload() {
    if (!state) return;
    return {
      schema: "iat-v2-devnet-on-chain-feature-rehearsal-evidence/v1",
      status: "PARTIAL_PENDING_ALL_TIME_GATES_AND_AUTOMATED_DIRECT_EVIDENCE",
      network: "devnet",
      rpc: DEVNET_RPC,
      programId: IAT_V2_PROGRAM_ID.toBase58(),
      mint: baseSnapshot.mint.toBase58(),
      config: baseSnapshot.plan.config,
      genesisTimestamp: state.genesisTimestamp,
      currentWeek: state.currentWeek,
      currentCccRound: state.currentCccRound,
      agencies: FEATURE_AGENCY_OWNERS.map((owner, index) => ({ index, owner })),
      participant: COMMUNITY_CUSTODY.toBase58(),
      participantBalanceLamports: state.participantBalanceLamports,
      positions: state.positions,
      coreReward: state.coreReward,
      liquidityLane: state.liquidity,
      randomnessAccount: state.randomnessAddress,
      currentRound: state.currentRound,
      transactions: evidence,
      exportedAtUtc: new Date().toISOString(),
      mainnetStatus: "HOLD",
      automatedDirectEvidenceRequired: true,
      humanReviewerRequired: false,
      noSelfAttestation: true,
      secretMaterialIncluded: false,
    };
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([`${json(payload)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadEvidence() {
    const payload = featureEvidencePayload();
    if (!payload) return;
    downloadJson(payload, "iat-v2-devnet-on-chain-feature-rehearsal-evidence.json");
  }

  function evidenceBinding() {
    return exactFeatureStorageBinding(baseSnapshot.mint);
  }

  async function importReceiptSets(event) {
    setError("");
    try {
      const files = [...(event.target.files ?? [])];
      const imported = await Promise.all(files.map(async (file) => (
        parseAttendedReceiptSet(await file.text(), evidenceBinding())
      )));
      setOperatorReceiptSets(imported);
      setStatus(`IMPORTED ${imported.length} SOURCE-BOUND RECEIPT SET${imported.length === 1 ? "" : "S"}`);
    } catch (caught) {
      setOperatorReceiptSets([]);
      setStatus("HOLD // RECEIPT IMPORT REJECTED");
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      event.target.value = "";
    }
  }

  function downloadAggregateEvidence() {
    if (!state) return;
    setError("");
    try {
      const exactBinding = evidenceBinding();
      const localReceiptSet = loadAttendedReceiptSet(localStorage, exactBinding);
      const payload = buildCompleteAttendedBundle({
        receiptSets: [localReceiptSet, ...operatorReceiptSets],
        featureExport: featureEvidencePayload(),
        expectedBinding: exactBinding,
        programId: IAT_V2_PROGRAM_ID.toBase58(),
        participant: COMMUNITY_CUSTODY.toBase58(),
      });
      downloadJson(payload, "iat-v2-current-source-attended-devnet-console-bundle.json");
      setStatus("COMPLETE ATTENDED BUNDLE EXPORTED // AUTOMATED DIRECT EVIDENCE STILL REQUIRED");
    } catch (caught) {
      setStatus("HOLD // COMPLETE BUNDLE NOT AVAILABLE");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function clearFeatureReceipts() {
    if (retainedRandomnessExists) {
      setStatus("HOLD // RETAINED RANDOMNESS CONTINUITY REQUIRES ITS CREATE RECEIPT");
      return;
    }
    localStorage.removeItem(evidenceStorageKey);
    localStorage.removeItem(LEGACY_FEATURE_EVIDENCE_KEY_V2);
    localStorage.removeItem(LEGACY_FEATURE_EVIDENCE_KEY);
    setEvidence([]);
    setStatus("LOCAL FEATURE RECEIPTS CLEARED // ON-CHAIN STATE UNCHANGED");
  }

  function discardRetainedRandomnessAddress() {
    let freshInspection;
    try {
      freshInspection = inspectCanonicalRandomnessDiscardEligibility({
        storage: localStorage,
        expectedBinding: exactStorageBinding,
        programArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
      });
    } catch (caught) {
      setStatus("HOLD // STRICT CANONICAL RECEIPTS COULD NOT AUTHORIZE RANDOMNESS DISCARD");
      setError(caught instanceof Error ? caught.message : String(caught));
      return;
    }
    if (!randomnessDiscardEligible || !freshInspection.discardEligible) {
      setStatus("HOLD // RANDOMNESS DISCARD IS NOT VERIFIED AS PRE-CEREMONY ELIGIBLE");
      return;
    }
    try {
      localStorage.removeItem(randomnessStorageKey);
      if (localStorage.getItem(randomnessStorageKey) !== null) {
        throw new Error("Retained randomness continuity remained after discard");
      }
    } catch (caught) {
      setStatus("HOLD // RETAINED RANDOMNESS CONTINUITY COULD NOT BE DISCARDED");
      setError(caught instanceof Error ? caught.message : String(caught));
      return;
    }
    setRetainedRandomnessSerialized(null);
    setState(null);
    setError("");
    setStatus(
      "RETAINED RANDOMNESS ADDRESS DISCARDED // RECEIPTS PRESERVED // REFRESH TO REQUIRE FRESH CREATE_SWITCHBOARD_RANDOMNESS",
    );
  }

  return (
    <section className="feature-rehearsal">
      <div className="section-head">
        <div>
          <p>LIVE PROGRAM FEATURES // HARDWARE-APPROVED DEVNET TRANSACTIONS</p>
          <h2>PROVE THE GAME.<br />KEEP MAINNET ON HOLD.</h2>
        </div>
        <span>{evidence.length} TX</span>
      </div>

      <div className="feature-metrics">
        <div><small>POLICY WEEK</small><strong>{state?.currentWeek ?? "—"}</strong></div>
        <div><small>CCC ROUND</small><strong>{state?.currentCccRound ?? "LOCKED"}</strong></div>
        <div><small>AGENCIES</small><strong>{state?.agenciesRegistered ?? "—"} / 2</strong></div>
        <div><small>POSITIONS</small><strong>{state?.positions.filter(Boolean).length ?? "—"} / 3</strong></div>
        <div><small>PARTICIPANT SOL</small><strong>{state ? (state.participantBalanceLamports / 1e9).toFixed(3) : "—"}</strong></div>
        <div><small>SWITCHBOARD</small><strong>{state?.randomnessAddress ? "BOUND" : "PENDING"}</strong></div>
      </div>

      <div className="address-grid">
        <div><span>PROGRAMDATA</span><code className="full-code">{IAT_V2_PROGRAM_DATA_ADDRESS.toBase58()}</code></div>
        <div><span>ADMIN / ATTENDED SIGNER</span><code className="full-code">{IAT_V2_PROGRAM_ADMIN.toBase58()}</code></div>
        <div><span>ATTENDED CEREMONY SOURCE</span><code className="full-code">{ATTENDED_CEREMONY_BINDING.sourceHeadCommit ?? "UNBOUND // HOLD"}</code></div>
        <div><span>SOURCE-BOUND CEREMONY HORIZON</span><code>POLICY {IAT_V2_DEVNET_CEREMONY_POLICY_WEEK} / CCC {IAT_V2_DEVNET_CEREMONY_CCC_ROUND}</code></div>
        <div><span>CEREMONY HORIZON CLOSE</span><code>{IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_UTC}</code></div>
        <div><span>CEREMONY CI RUN / ATTEMPT</span><code>{ATTENDED_CEREMONY_BINDING.ciRunId ?? "UNBOUND"} / {ATTENDED_CEREMONY_BINDING.ciRunAttempt ?? "HOLD"}</code></div>
        <div><span>CEREMONY RUNTIME EVIDENCE SHA-256</span><code className="full-code">{ATTENDED_CEREMONY_BINDING.runtimeEvidenceManifestSha256 ?? "UNBOUND // HOLD"}</code></div>
        <div><span>IMMUTABLE ARTIFACT SOURCE</span><code className="full-code">{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD}</code></div>
        <div><span>ARTIFACT CI RUN / ATTEMPT</span><code>{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID} / 1</code></div>
        <div><span>ARTIFACT EVIDENCE MANIFEST SHA-256</span><code className="full-code">{IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256}</code></div>
        <div><span>CI-BOUND ARTIFACT SHA-256</span><code className="full-code">{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256}</code></div>
        <div><span>CI-BOUND ARTIFACT BYTES</span><code>{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES}</code></div>
      </div>

      {retainedRandomnessExists && (
        <div className="feature-command">
          <div>
            <small>PRE-CEREMONY RANDOMNESS CONTROL // LOCAL STORAGE ONLY</small>
            <strong>{canonicalRandomnessDiscardInspection.canonicalCreateRecorded || randomnessCreationReceipt
              ? "CURRENT CEREMONY RANDOMNESS LOCKED"
              : randomnessDiscardEligible
                ? "VERIFIED PRE-CEREMONY RETAINED ADDRESS MAY BE DISCARDED"
                : "RANDOMNESS DISCARD LOCKED UNTIL STRICT PRE-CEREMONY VERIFICATION"}</strong>
            <code className="full-code">{retainedRandomnessDisplay}</code>
            <p>
              The control removes only this source-bound continuity record, preserves receipts, and performs
              no RPC, signature, broadcast, or chain action. After discard, refresh and complete a fresh
              CREATE_SWITCHBOARD_RANDOMNESS action.
            </p>
          </div>
          <button
            className="discard"
            onClick={discardRetainedRandomnessAddress}
            disabled={!randomnessDiscardEligible}
          >
            DISCARD RETAINED ADDRESS + REQUIRE FRESH CREATE
          </button>
        </div>
      )}

      <div className="feature-command">
        <div>
          <small>FEATURE STATUS</small>
          <strong>{status}</strong>
          {error && <p role="alert">{error}</p>}
        </div>
        <button className="quiet" onClick={() => refresh().catch(() => {})} disabled={busy}>
          REFRESH FEATURE STATE
        </button>
      </div>

      {action ? (
        <div className="feature-next">
          <div>
            <small>ONE VERIFIED ACTION // EXPLICIT USER STEPS ONLY</small>
            <h3>{action.title}</h3>
            <p>{action.detail}</p>
            {Number.isSafeInteger(action.week) && (
              <code>
                POLICY WEEK {action.week}
                {Number.isSafeInteger(action.ordinal) ? ` // ORDINAL ${action.ordinal}` : ""}
              </code>
            )}
            <code>SIGNER ROLE {signerRole(action.signer)}</code>
            <code>SIGNER {action.signer.toBase58()}</code>
            {action.createsEphemeralProtocolSigner && (
              <p className="ephemeral-note">
                This is not a wallet or custody key. It is generated only after your click, used to initialize
                one Switchboard protocol account, never exported, and zeroed immediately after signing.
              </p>
            )}
          </div>
          {!pending ? (
            <button onClick={simulateAndRequestSignature} disabled={busy || !state}>
              {busy
                ? "VERIFYING…"
                : action.createsEphemeralProtocolSigner
                  ? "GENERATE EPHEMERAL ACCOUNT + REQUEST SIGNATURE"
                  : `CONNECT ${short(action.signer.toBase58(), 9)} + SIMULATE + SIGN`}
            </button>
          ) : (
            <div className="broadcast-panel">
              <code className="full-code">MESSAGE {pending.messageSha256}</code>
              <code>{pending.wireSize} BYTES // SIGNATURES VERIFIED</code>
              <button onClick={broadcastSigned} disabled={busy}>BROADCAST SIGNED DEVNET TRANSACTION</button>
              <button className="discard" onClick={discardPending} disabled={busy}>DISCARD WITHOUT BROADCAST</button>
            </div>
          )}
        </div>
      ) : state ? (
        <div className="feature-wait">
          <small>REAL-TIME GATE</small>
          <strong>{waitDescription(state)}</strong>
          <p>The console will never rewrite Genesis, fake a clock, or label an unexecuted path as rehearsed.</p>
        </div>
      ) : null}

      <div className="feature-ledger">
        {evidence.map((record) => (
          <a href={record.explorerUrl} target="_blank" rel="noreferrer" key={record.action}>
            <span>{record.action}</span>
            <code>{short(record.signature, 8)} ↗</code>
          </a>
        ))}
      </div>

      {logs.length > 0 && (
        <details className="logs">
          <summary>LAST FEATURE SIMULATION // {logs.length} LINES</summary>
          <pre>{logs.join("\n")}</pre>
        </details>
      )}

      <div className="feature-export">
        <p>Evidence contains public accounts, state, message hashes, signatures, and Explorer links. No secrets.</p>
        <button onClick={downloadEvidence} disabled={!state || evidence.length === 0}>
          DOWNLOAD FEATURE EVIDENCE
        </button>
        <label className="action-link">
          IMPORT SOURCE-BOUND PROGRAM / MIGRATION RECEIPTS
          <input type="file" accept="application/json" multiple onChange={importReceiptSets} hidden />
        </label>
        <button onClick={downloadAggregateEvidence} disabled={!state || evidence.length === 0}>
          EXPORT COMPLETE ATTENDED BUNDLE
        </button>
        <button className="discard" onClick={() => setOperatorReceiptSets([])} disabled={operatorReceiptSets.length === 0}>
          DISCARD IMPORTED RECEIPTS ({operatorReceiptSets.length})
        </button>
        <button
          className="discard"
          onClick={clearFeatureReceipts}
          disabled={evidence.length === 0 || busy || Boolean(pending) || retainedRandomnessExists}
        >
          CLEAR LOCAL FEATURE RECEIPTS
        </button>
      </div>
    </section>
  );
}
