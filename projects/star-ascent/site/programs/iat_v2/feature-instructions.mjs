import { Buffer } from "buffer";
import {
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  deriveAgencyAddress,
  deriveAgencyOwnerIndexAddress,
  deriveIatV2Addresses,
  derivePositionAddress,
  deriveRoundAddress,
} from "./client.mjs";
import {
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_ID,
} from "./instructions.mjs";

export const IAT_V2_ROLE = Object.freeze({
  STANDARD: 0,
  CCC_AGENT: 1,
  CCC_ASSOCIATE: 2,
});

export const IAT_V2_ROUND_STATUS = Object.freeze({
  PENDING: 0,
  SETTLED: 1,
  EXPIRED_NEUTRAL: 2,
});

export const IAT_V2_FEATURE_DISCRIMINATORS = Object.freeze({
  registerAgency: [102, 193, 24, 185, 91, 84, 85, 245],
  setEligibility: [101, 95, 132, 213, 175, 252, 123, 46],
  openPosition: [135, 128, 47, 77, 15, 152, 240, 49],
  settlePositionWeek: [246, 190, 213, 115, 87, 124, 128, 63],
  settleCoreWeek: [219, 71, 131, 167, 24, 103, 23, 251],
  claimLanePrincipal: [247, 121, 210, 241, 142, 234, 218, 133],
  withdrawPositionPrincipal: [81, 181, 244, 15, 138, 202, 156, 190],
  closePosition: [123, 134, 81, 0, 49, 68, 98, 98],
  commitRound: [229, 102, 157, 34, 152, 217, 15, 70],
  settleRound: [40, 101, 18, 1, 31, 129, 52, 77],
  expireRound: [238, 222, 71, 141, 104, 222, 76, 248],
});

function key(value, label) {
  try {
    return value instanceof PublicKey ? value : new PublicKey(value);
  } catch {
    throw new Error(`${label} is not a usable Solana public key`);
  }
}

function account(pubkey, isSigner = false, isWritable = false) {
  return { pubkey: key(pubkey, "Instruction account"), isSigner, isWritable };
}

function discriminator(name) {
  return Buffer.from(IAT_V2_FEATURE_DISCRIMINATORS[name]);
}

function unsigned(value, bits, label) {
  let normalized;
  try {
    normalized = BigInt(value);
  } catch {
    throw new Error(`${label} must be an unsigned ${bits}-bit integer`);
  }
  if (normalized < 0n || normalized >= 2n ** BigInt(bits)) {
    throw new Error(`${label} must fit an unsigned ${bits}-bit integer`);
  }
  return normalized;
}

function u64(value, label) {
  const data = Buffer.alloc(8);
  data.writeBigUInt64LE(unsigned(value, 64, label));
  return data;
}

function u32(value, label) {
  const normalized = unsigned(value, 32, label);
  const data = Buffer.alloc(4);
  data.writeUInt32LE(Number(normalized));
  return data;
}

function optionU32(value, label) {
  return value === null || value === undefined
    ? Buffer.from([0])
    : Buffer.concat([Buffer.from([1]), u32(value, label)]);
}

function roleByte(role) {
  if (!Object.values(IAT_V2_ROLE).includes(role)) {
    throw new Error("Eligibility role must be STANDARD, CCC_AGENT, or CCC_ASSOCIATE");
  }
  return Buffer.from([role]);
}

function laneAccounts(mint, programId) {
  const mintKey = key(mint, "Mint");
  const programKey = key(programId, "IAT V2 program");
  return {
    mint: mintKey,
    programId: programKey,
    ...deriveIatV2Addresses({ mint: mintKey, programId: programKey }),
  };
}

export function deriveEligibilityAddress({
  config,
  wallet,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("eligibility"),
      key(config, "Config").toBuffer(),
      key(wallet, "Eligible wallet").toBuffer(),
    ],
    key(programId, "IAT V2 program"),
  )[0];
}

export function buildRegisterAgencyInstruction({
  admin = IAT_V2_PROGRAM_ADMIN,
  mint,
  agencyOwner,
  agencyIndex,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const adminKey = key(admin, "Program administrator");
  const ownerKey = key(agencyOwner, "Agency owner");
  const derived = laneAccounts(mint, programId);
  const agency = deriveAgencyAddress({
    config: derived.config,
    programId: derived.programId,
    index: Number(unsigned(agencyIndex, 32, "Agency index")),
  });
  const ownerIndex = deriveAgencyOwnerIndexAddress({
    config: derived.config,
    programId: derived.programId,
    owner: ownerKey,
  });
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(adminKey, true, true),
      account(derived.config, false, true),
      account(ownerKey),
      account(agency, false, true),
      account(ownerIndex, false, true),
      account(SystemProgram.programId),
    ],
    data: discriminator("registerAgency"),
  });
}

export function buildSetEligibilityInstruction({
  admin = IAT_V2_PROGRAM_ADMIN,
  mint,
  wallet,
  role,
  agencyIndex = null,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const adminKey = key(admin, "Program administrator");
  const walletKey = key(wallet, "Eligible wallet");
  const derived = laneAccounts(mint, programId);
  if (role === IAT_V2_ROLE.STANDARD && agencyIndex !== null && agencyIndex !== undefined) {
    throw new Error("Standard eligibility cannot link an agency");
  }
  if (role !== IAT_V2_ROLE.STANDARD && (agencyIndex === null || agencyIndex === undefined)) {
    throw new Error("CCC eligibility must link an agency");
  }
  const eligibility = deriveEligibilityAddress({
    config: derived.config,
    wallet: walletKey,
    programId: derived.programId,
  });
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(adminKey, true, true),
      account(derived.config),
      account(walletKey),
      account(eligibility, false, true),
      account(SystemProgram.programId),
    ],
    data: Buffer.concat([
      discriminator("setEligibility"),
      roleByte(role),
      optionU32(agencyIndex, "Agency index"),
    ]),
  });
}

export function buildOpenPositionInstruction({
  owner,
  mint,
  ownerTokens,
  positionId,
  principal,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const ownerKey = key(owner, "Position owner");
  const derived = laneAccounts(mint, programId);
  const positionNumber = Number(unsigned(positionId, 53, "Position ID"));
  const eligibility = deriveEligibilityAddress({
    config: derived.config,
    wallet: ownerKey,
    programId: derived.programId,
  });
  const position = derivePositionAddress({
    config: derived.config,
    programId: derived.programId,
    owner: ownerKey,
    positionId: positionNumber,
  });
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(ownerKey, true, true),
      account(derived.config, false, true),
      account(eligibility),
      account(derived.mint),
      account(ownerTokens, false, true),
      account(derived.stakeTokenAccount, false, true),
      account(derived.lanes.treasury.state, false, true),
      account(derived.lanes.ecosystem.state, false, true),
      account(derived.lanes.liquidity.state, false, true),
      account(position, false, true),
      account(TOKEN_PROGRAM_ID),
      account(SystemProgram.programId),
    ],
    data: Buffer.concat([
      discriminator("openPosition"),
      u64(positionId, "Position ID"),
      u64(principal, "Position principal"),
    ]),
  });
}

export function buildSettlePositionWeekInstruction({
  caller,
  mint,
  positionOwner,
  positionId,
  destinationTokens,
  week,
  round = null,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const callerKey = key(caller, "Settlement caller");
  const ownerKey = key(positionOwner, "Position owner");
  const derived = laneAccounts(mint, programId);
  const position = derivePositionAddress({
    config: derived.config,
    programId: derived.programId,
    owner: ownerKey,
    positionId: Number(unsigned(positionId, 53, "Position ID")),
  });
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(callerKey, true),
      account(derived.config),
      account(position, false, true),
      account(round ?? derived.programId),
      account(derived.mint),
      account(derived.vaultAuthority),
      account(derived.lanes.treasury.state, false, true),
      account(derived.lanes.treasury.tokenAccount, false, true),
      account(derived.lanes.ecosystem.state, false, true),
      account(derived.lanes.ecosystem.tokenAccount, false, true),
      account(derived.lanes.liquidity.state, false, true),
      account(derived.lanes.liquidity.tokenAccount, false, true),
      account(destinationTokens, false, true),
      account(TOKEN_PROGRAM_ID),
    ],
    data: Buffer.concat([
      discriminator("settlePositionWeek"),
      u64(week, "Settlement week"),
    ]),
  });
}

export function buildSettleCoreWeekInstruction({
  caller,
  mint,
  destinationTokens,
  ordinal,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const callerKey = key(caller, "Settlement caller");
  const derived = laneAccounts(mint, programId);
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(callerKey, true),
      account(derived.config),
      account(derived.mint),
      account(derived.vaultAuthority),
      account(derived.coreReward, false, true),
      account(derived.lanes.treasury.state, false, true),
      account(derived.lanes.treasury.tokenAccount, false, true),
      account(derived.lanes.ecosystem.state, false, true),
      account(derived.lanes.ecosystem.tokenAccount, false, true),
      account(derived.lanes.liquidity.state, false, true),
      account(derived.lanes.liquidity.tokenAccount, false, true),
      account(destinationTokens, false, true),
      account(TOKEN_PROGRAM_ID),
    ],
    data: Buffer.concat([
      discriminator("settleCoreWeek"),
      u64(ordinal, "Core reward ordinal"),
    ]),
  });
}

export function buildClaimLanePrincipalInstruction({
  caller,
  mint,
  destinationTokens,
  lane,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  if (!Number.isInteger(lane) || lane < 1 || lane > 4) {
    throw new Error("Claim lane must be an integer from 1 through 4");
  }
  const callerKey = key(caller, "Claim caller");
  const derived = laneAccounts(mint, programId);
  const laneName = ["treasury", "ecosystem", "coreTeam", "liquidity"][lane - 1];
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(callerKey, true),
      account(derived.config),
      account(derived.mint),
      account(derived.vaultAuthority),
      account(derived.lanes[laneName].state, false, true),
      account(derived.lanes[laneName].tokenAccount, false, true),
      account(destinationTokens, false, true),
      account(TOKEN_PROGRAM_ID),
    ],
    data: Buffer.concat([
      discriminator("claimLanePrincipal"),
      Buffer.from([lane]),
    ]),
  });
}

export function buildWithdrawPositionPrincipalInstruction({
  caller,
  mint,
  positionOwner,
  positionId,
  destinationTokens,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const callerKey = key(caller, "Withdrawal caller");
  const ownerKey = key(positionOwner, "Position owner");
  const derived = laneAccounts(mint, programId);
  const position = derivePositionAddress({
    config: derived.config,
    programId: derived.programId,
    owner: ownerKey,
    positionId: Number(unsigned(positionId, 53, "Position ID")),
  });
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(callerKey, true),
      account(derived.config, false, true),
      account(position, false, true),
      account(derived.mint),
      account(derived.vaultAuthority),
      account(derived.stakeTokenAccount, false, true),
      account(destinationTokens, false, true),
      account(TOKEN_PROGRAM_ID),
    ],
    data: discriminator("withdrawPositionPrincipal"),
  });
}

export function buildClosePositionInstruction({
  caller,
  mint,
  positionOwner,
  positionId,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const callerKey = key(caller, "Close caller");
  const ownerKey = key(positionOwner, "Position owner");
  const derived = laneAccounts(mint, programId);
  const position = derivePositionAddress({
    config: derived.config,
    programId: derived.programId,
    owner: ownerKey,
    positionId: Number(unsigned(positionId, 53, "Position ID")),
  });
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(callerKey, true),
      account(derived.config),
      account(position, false, true),
      account(derived.lanes.treasury.state, false, true),
      account(derived.lanes.ecosystem.state, false, true),
      account(derived.lanes.liquidity.state, false, true),
    ],
    data: discriminator("closePosition"),
  });
}

export function buildCommitRoundInstruction({
  payer,
  mint,
  randomnessAccount,
  week,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const payerKey = key(payer, "Round payer");
  const derived = laneAccounts(mint, programId);
  const round = deriveRoundAddress({
    config: derived.config,
    programId: derived.programId,
    week: Number(unsigned(week, 53, "CCC week")),
  });
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(payerKey, true, true),
      account(derived.config),
      account(randomnessAccount),
      account(SYSVAR_INSTRUCTIONS_PUBKEY),
      account(round, false, true),
      account(SystemProgram.programId),
    ],
    data: Buffer.concat([
      discriminator("commitRound"),
      u64(week, "CCC week"),
    ]),
  });
}

export function buildSettleRoundInstruction({
  mint,
  randomnessAccount,
  week,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const derived = laneAccounts(mint, programId);
  const round = deriveRoundAddress({
    config: derived.config,
    programId: derived.programId,
    week: Number(unsigned(week, 53, "CCC week")),
  });
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(derived.config),
      account(round, false, true),
      account(randomnessAccount),
    ],
    data: discriminator("settleRound"),
  });
}

export function buildExpireRoundInstruction({
  mint,
  week,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const derived = laneAccounts(mint, programId);
  const round = deriveRoundAddress({
    config: derived.config,
    programId: derived.programId,
    week: Number(unsigned(week, 53, "CCC week")),
  });
  return new TransactionInstruction({
    programId: derived.programId,
    keys: [
      account(derived.config),
      account(round, false, true),
    ],
    data: discriminator("expireRound"),
  });
}

function bytes(value, minimum, label) {
  const data = Buffer.from(value);
  if (data.length < minimum) throw new Error(`${label} is shorter than the reviewed layout`);
  return data;
}

export function parseLaneVaultAccount(data) {
  const value = bytes(data, 164, "Lane vault");
  return {
    config: new PublicKey(value.subarray(8, 40)),
    tokenAccount: new PublicKey(value.subarray(40, 72)),
    beneficiary: new PublicKey(value.subarray(72, 104)),
    total: value.readBigUInt64LE(104),
    genesisUnlocked: value.readBigUInt64LE(112),
    cliffWeek: value.readBigUInt64LE(120),
    linearEndWeek: value.readBigUInt64LE(128),
    reserved: value.readBigUInt64LE(136),
    paid: value.readBigUInt64LE(144),
    principalClaimed: value.readBigUInt64LE(152),
    lane: value[160],
    rewardSource: value[161] === 1,
    bump: value[162],
    tokenBump: value[163],
  };
}

export function parseCoreRewardAccount(data) {
  const value = bytes(data, 113, "Core reward");
  return {
    config: new PublicKey(value.subarray(8, 40)),
    principal: value.readBigUInt64LE(40),
    annualRateBps: value.readBigUInt64LE(48),
    termWeeks: value.readBigUInt64LE(56),
    treasuryReserved: value.readBigUInt64LE(64),
    ecosystemReserved: value.readBigUInt64LE(72),
    liquidityReserved: value.readBigUInt64LE(80),
    paid: value.readBigUInt64LE(88),
    settledLow: value.readBigUInt64LE(96),
    settledHigh: value.readBigUInt64LE(104),
    bump: value[112],
  };
}

export function parseEligibilityAccount(data) {
  const value = bytes(data, 78, "Eligibility");
  return {
    config: new PublicKey(value.subarray(8, 40)),
    wallet: new PublicKey(value.subarray(40, 72)),
    agencyIndex: value.readUInt32LE(72),
    role: value[76],
    bump: value[77],
  };
}

export function parsePositionAccount(data) {
  const value = bytes(data, 168, "Position");
  return {
    config: new PublicKey(value.subarray(8, 40)),
    owner: new PublicKey(value.subarray(40, 72)),
    positionId: value.readBigUInt64LE(72),
    principal: value.readBigUInt64LE(80),
    acceptedWeek: value.readBigUInt64LE(88),
    firstAccrualWeek: value.readBigUInt64LE(96),
    termWeeks: value.readBigUInt64LE(104),
    annualRateBps: value.readBigUInt64LE(112),
    treasuryReserved: value.readBigUInt64LE(120),
    ecosystemReserved: value.readBigUInt64LE(128),
    liquidityReserved: value.readBigUInt64LE(136),
    paid: value.readBigUInt64LE(144),
    settledMask: value.readBigUInt64LE(152),
    agencyIndex: value.readUInt32LE(160),
    role: value[164],
    principalReturned: value[165] === 1,
    closed: value[166] === 1,
    bump: value[167],
  };
}

export function parseRoundAccount(data) {
  const value = bytes(data, 206, "CCC round");
  return {
    config: new PublicKey(value.subarray(8, 40)),
    randomnessAccount: new PublicKey(value.subarray(40, 72)),
    week: value.readBigUInt64LE(72),
    commitSlot: value.readBigUInt64LE(80),
    commitTimestamp: value.readBigInt64LE(88),
    randomness: value.subarray(96, 128),
    agencyRegistryHashSnapshot: value.subarray(128, 160),
    decisionContext: value.subarray(160, 192),
    agencyCountSnapshot: value.readUInt32LE(192),
    selectedAgencyIndex: value.readUInt32LE(196),
    derivationCounter: value.readUInt32LE(200),
    status: value[204],
    bump: value[205],
  };
}
