import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
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
  DEVNET_FEATURE_MINT_SEED,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_ID,
} from "../../programs/iat_v2/instructions.mjs";
import {
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
} from "../../programs/iat_v2/client.mjs";

const DEVNET_RPC = "https://api.devnet.solana.com";
const connection = new Connection(DEVNET_RPC, "confirmed");
const COMMUNITY_CUSTODY = new PublicKey("7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH");

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
const FEATURE_EVIDENCE_KEY =
  `iat-v2-devnet-feature-action-evidence/${DEVNET_FEATURE_MINT_SEED}/v2`;
const LEGACY_FEATURE_EVIDENCE_KEY = "iat-v2-devnet-feature-action-evidence/v1";
const FEATURE_RANDOMNESS_KEY =
  `iat-v2-devnet-switchboard-randomness-account/${DEVNET_FEATURE_MINT_SEED}/v2`;

function loadEvidence() {
  try {
    const serialized = localStorage.getItem(FEATURE_EVIDENCE_KEY)
      ?? localStorage.getItem(LEGACY_FEATURE_EVIDENCE_KEY)
      ?? "[]";
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

function storedRandomnessAddress() {
  const value = localStorage.getItem(FEATURE_RANDOMNESS_KEY);
  if (!value) return null;
  try {
    return new PublicKey(value);
  } catch {
    localStorage.removeItem(FEATURE_RANDOMNESS_KEY);
    return null;
  }
}

function bitIsSet(value, ordinal) {
  return (value & (1n << BigInt(ordinal))) !== 0n;
}

function roleMatches(eligibility, role, agencyIndex = null) {
  if (!eligibility || eligibility.role !== role) return false;
  if (role === IAT_V2_ROLE.STANDARD) return eligibility.agencyIndex === 0xffff_ffff;
  return eligibility.agencyIndex === agencyIndex;
}

async function loadFeatureState(baseSnapshot) {
  const { mint, plan, config } = baseSnapshot;
  const genesisTimestamp = Number(config.genesisTimestamp);
  if (!Number.isSafeInteger(genesisTimestamp)) {
    throw new Error("Feature Genesis timestamp is outside the browser's safe range");
  }
  const nowTimestamp = Math.floor(Date.now() / 1_000);
  const currentWeek = currentIatV2Week(genesisTimestamp, nowTimestamp);
  const currentCccRound = currentIatV2CccRound(genesisTimestamp, nowTimestamp);
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
  const currentRoundAddress = currentCccRound === null
    ? null
    : deriveRoundAddress({
      config: plan.config,
      programId: IAT_V2_PROGRAM_ID,
      week: currentCccRound,
    });
  const randomnessAddress = storedRandomnessAddress();
  const participantBalanceLamports = await connection.getBalance(COMMUNITY_CUSTODY, "confirmed");
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
  const infos = await connection.getMultipleAccountsInfo(addresses, "confirmed");
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
  if (randomnessInfo && !randomnessInfo.owner.equals(SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID)) {
    throw new Error("Stored randomness account is not owned by the pinned Switchboard devnet program");
  }
  if (randomnessAddress && !randomnessInfo) {
    localStorage.removeItem(FEATURE_RANDOMNESS_KEY);
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
  const linkedRoundInfos = linkedRoundAddresses.length
    ? await connection.getMultipleAccountsInfo(linkedRoundAddresses, "confirmed")
    : [];
  const linkedRounds = Object.fromEntries(linkedRoundWeeks.map((week, index) => {
    const info = linkedRoundInfos[index];
    if (!info) return [week, null];
    if (!info.owner.equals(IAT_V2_PROGRAM_ID)) throw new Error("CCC round has the wrong owner");
    return [week, parseRoundAccount(info.data)];
  }));

  return {
    nowTimestamp,
    genesisTimestamp,
    currentWeek,
    currentCccRound,
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
    currentRoundAddress,
    currentRound: currentRoundInfo ? parseRoundAccount(currentRoundInfo.data) : null,
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

function switchboardWallet(provider, publicKey) {
  return {
    publicKey,
    signTransaction: (transaction) => provider.signTransaction(transaction),
    signAllTransactions: async (transactions) => {
      if (typeof provider.signAllTransactions === "function") {
        return provider.signAllTransactions(transactions);
      }
      const signed = [];
      for (const transaction of transactions) signed.push(await provider.signTransaction(transaction));
      return signed;
    },
  };
}

let switchboardModulePromise;

function loadSwitchboardModule() {
  switchboardModulePromise ??= import("@switchboard-xyz/on-demand");
  return switchboardModulePromise;
}

async function switchboardProgram(provider, publicKey) {
  const switchboard = await loadSwitchboardModule();
  const program = await switchboard.AnchorUtils.loadProgramFromConnection(
    connection,
    switchboardWallet(provider, publicKey),
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  );
  return { program, switchboard };
}

async function buildActionTransaction(action, state, baseSnapshot, provider) {
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
      const { program, switchboard } = await switchboardProgram(provider, action.signer);
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
        const { program, switchboard } = await switchboardProgram(provider, action.signer);
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
        const { program, switchboard } = await switchboardProgram(provider, action.signer);
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

export default function FeatureRehearsal({
  baseSnapshot,
  explorer,
  getHardwareProvider,
  json,
  sha256Hex,
  short,
}) {
  const [state, setState] = useState(null);
  const [evidence, setEvidence] = useState(loadEvidence);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("LOADING FEATURE STATE");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);

  const action = useMemo(() => state ? nextFeatureAction(state) : null, [state]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    setStatus("VERIFYING FEATURE ACCOUNTS");
    try {
      const next = await loadFeatureState(baseSnapshot);
      setState(next);
      const nextAction = nextFeatureAction(next);
      setStatus(nextAction ? `READY // ${nextAction.id}` : "WAIT GATE // NO SAFE ACTION YET");
      return next;
    } catch (caught) {
      setStatus("HOLD // FEATURE VERIFICATION FAILED");
      setError(caught instanceof Error ? caught.message : String(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [baseSnapshot]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(FEATURE_EVIDENCE_KEY, JSON.stringify(evidence));
  }, [evidence]);

  async function simulateAndRequestSignature() {
    if (!action || pending || busy) return;
    setBusy(true);
    setError("");
    setLogs([]);
    setStatus("BUILDING + SIMULATING // NOTHING WILL BE BROADCAST");
    let ephemeralKeypair = null;
    try {
      const current = await loadFeatureState(baseSnapshot);
      const currentAction = nextFeatureAction(current);
      if (!currentAction || currentAction.id !== action.id) {
        setState(current);
        throw new Error("Chain state advanced; review the newly computed action");
      }
      setStatus(`CONNECTING ${signerRole(action.signer)} // ${short(action.signer.toBase58(), 9)}`);
      const { provider, publicKey } = await getHardwareProvider(action.signer);
      const built = await buildActionTransaction(action, current, baseSnapshot, provider);
      ephemeralKeypair = built.ephemeralKeypair;
      const latest = await connection.getLatestBlockhash("confirmed");
      built.transaction.feePayer = publicKey;
      built.transaction.recentBlockhash = latest.blockhash;
      if (ephemeralKeypair) built.transaction.partialSign(ephemeralKeypair);
      const wireSize = built.transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }).length;
      if (wireSize > 1232) throw new Error(`Transaction is ${wireSize} bytes, above Solana's limit`);
      const messageSha256 = await sha256Hex(built.transaction.serializeMessage());
      // Legacy Transaction uses the signer-array overload in web3.js 1.x.
      // Passing a VersionedTransaction-style config object throws "Invalid arguments".
      const simulation = await connection.simulateTransaction(built.transaction);
      setLogs(simulation.value.logs ?? []);
      if (simulation.value.err) {
        throw new Error(`Simulation failed: ${json(simulation.value.err)}`);
      }
      setStatus("HARDWARE // REVIEW + SIGN; STILL NOT BROADCAST");
      const signed = await provider.signTransaction(built.transaction);
      const signedMessageSha256 = await sha256Hex(signed.serializeMessage());
      if (signedMessageSha256 !== messageSha256) {
        throw new Error("Wallet changed the reviewed transaction message");
      }
      const walletSignature = signed.signatures.find(({ publicKey: signer }) => signer.equals(publicKey));
      if (!walletSignature?.signature) throw new Error("Required hardware signature is missing");
      if (!signed.verifySignatures()) throw new Error("Signed transaction failed local signature verification");
      setPending({
        action: action.id,
        title: action.title,
        signed,
        messageSha256,
        latest,
        wireSize,
        randomnessAddress: built.randomnessAddress,
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
    setStatus("BROADCASTING USER-APPROVED DEVNET TRANSACTION");
    try {
      const signature = await connection.sendRawTransaction(pending.signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: pending.latest.blockhash,
        lastValidBlockHeight: pending.latest.lastValidBlockHeight,
      }, "confirmed");
      if (confirmation.value.err) {
        throw new Error(`Confirmation failed: ${json(confirmation.value.err)}`);
      }
      if (pending.randomnessAddress) {
        localStorage.setItem(FEATURE_RANDOMNESS_KEY, pending.randomnessAddress.toBase58());
      }
      const record = {
        action: pending.action,
        title: pending.title,
        signature,
        messageSha256: pending.messageSha256,
        explorerUrl: explorer("tx", signature),
        confirmedAtUtc: new Date().toISOString(),
      };
      setEvidence((current) => [
        ...current.filter((entry) => entry.action !== record.action),
        record,
      ]);
      setPending(null);
      const next = await loadFeatureState(baseSnapshot);
      setState(next);
      const nextAction = nextFeatureAction(next);
      setStatus(nextAction ? `CONFIRMED // NEXT ${nextAction.id}` : "CONFIRMED // WAIT GATE");
    } catch (caught) {
      setStatus("HOLD // BROADCAST OR CONFIRMATION FAILED");
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  function discardPending() {
    setPending(null);
    setStatus("SIGNED TRANSACTION DISCARDED // NOTHING BROADCAST");
  }

  function downloadEvidence() {
    if (!state) return;
    const payload = {
      schema: "iat-v2-devnet-on-chain-feature-rehearsal-evidence/v1",
      status: "PARTIAL_PENDING_ALL_TIME_GATES_AND_INDEPENDENT_REVIEW",
      network: "devnet",
      rpc: DEVNET_RPC,
      programId: IAT_V2_PROGRAM_ID,
      mint: baseSnapshot.mint,
      config: baseSnapshot.plan.config,
      genesisTimestamp: state.genesisTimestamp,
      currentWeek: state.currentWeek,
      currentCccRound: state.currentCccRound,
      agencies: FEATURE_AGENCY_OWNERS.map((owner, index) => ({ index, owner })),
      participant: COMMUNITY_CUSTODY,
      participantBalanceLamports: state.participantBalanceLamports,
      positions: state.positions,
      coreReward: state.coreReward,
      liquidityLane: state.liquidity,
      randomnessAccount: state.randomnessAddress,
      currentRound: state.currentRound,
      transactions: evidence,
      exportedAtUtc: new Date().toISOString(),
      mainnetStatus: "HOLD",
      independentReviewRequired: true,
      secretMaterialIncluded: false,
    };
    const blob = new Blob([`${json(payload)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "iat-v2-devnet-on-chain-feature-rehearsal-evidence.json";
    anchor.click();
    URL.revokeObjectURL(url);
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
              <code>MESSAGE {short(pending.messageSha256, 10)}</code>
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
      </div>
    </section>
  );
}
