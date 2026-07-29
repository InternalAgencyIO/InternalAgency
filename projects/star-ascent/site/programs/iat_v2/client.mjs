import { PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import policy from "../../engagement/iat-economic-policy.v2.json" with { type: "json" };

export const NONDEPLOYABLE_SENTINEL_PROGRAM_ID = new PublicKey("6T8qyz4ZSEK8x72hTK1c8rqvEfUX6zGbUsHDUUjpw6tY");
export const SWITCHBOARD_ON_DEMAND_MAINNET_PROGRAM_ID = new PublicKey(
  "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv",
);
export const SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID = new PublicKey(
  "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2",
);
export const V2_STAGE_ORDER = Object.freeze([
  "DEPLOY_PROGRAM_WITHOUT_IAT",
  "TRANSFER_UPGRADE_AUTHORITY_TO_MODEL_T",
  "CREATE_INITIALIZE_IMMUTABLE_MINT_AND_METADATA",
  "INITIALIZE_CONFIG_LANE_VAULTS_AND_STAKE_VAULT",
  "MINT_COMMUNITY_AND_FOUR_PROGRAM_VAULT_ALLOCATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
  "ACTIVATE_AFTER_RANDOMNESS_BUILD_AND_REVIEW_GATES",
]);

function key(value, label) {
  try {
    return value instanceof PublicKey ? value : new PublicKey(value);
  } catch {
    throw new Error(`${label} is not a usable Solana public key`);
  }
}

function pda(programId, seeds) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function scaledAmount(value, rehearsal) {
  const amount = BigInt(value);
  return rehearsal ? amount / 1_000_000n : amount;
}

export function deriveIatV2Addresses({ mint, programId }) {
  const mintKey = key(mint, "Mint");
  const programKey = key(programId, "IAT V2 program");
  const config = pda(programKey, [Buffer.from("config"), mintKey.toBuffer()]);
  const vaultAuthority = pda(programKey, [Buffer.from("vault-authority"), config.toBuffer()]);
  const lanes = Object.fromEntries(["treasury", "ecosystem", "coreTeam", "liquidity"].map((name, offset) => {
    const lane = offset + 1;
    const laneByte = Buffer.from([lane]);
    return [name, {
      index: lane,
      state: pda(programKey, [Buffer.from("lane"), config.toBuffer(), laneByte]),
      tokenAccount: pda(programKey, [Buffer.from("lane-token"), config.toBuffer(), laneByte]),
    }];
  }));
  return {
    config,
    vaultAuthority,
    lanes,
    stakeTokenAccount: pda(programKey, [Buffer.from("stake-token"), config.toBuffer()]),
    coreReward: pda(programKey, [Buffer.from("core-reward"), config.toBuffer()]),
  };
}

export function deriveAgencyAddress({ config, programId, index }) {
  if (!Number.isSafeInteger(index) || index < 0 || index > 0xffff_ffff) {
    throw new Error("Agency index must fit an unsigned 32-bit integer");
  }
  const indexBytes = Buffer.alloc(4);
  indexBytes.writeUInt32LE(index);
  return pda(key(programId, "IAT V2 program"), [Buffer.from("agency"), key(config, "Config").toBuffer(), indexBytes]);
}

export function deriveAgencyOwnerIndexAddress({ config, programId, owner }) {
  return pda(key(programId, "IAT V2 program"), [
    Buffer.from("agency-owner"),
    key(config, "Config").toBuffer(),
    key(owner, "Agency owner").toBuffer(),
  ]);
}

export function derivePositionAddress({ config, programId, owner, positionId }) {
  if (!Number.isSafeInteger(positionId) || positionId < 0) {
    throw new Error("Position ID must be a non-negative safe integer");
  }
  const positionBytes = Buffer.alloc(8);
  positionBytes.writeBigUInt64LE(BigInt(positionId));
  return pda(key(programId, "IAT V2 program"), [
    Buffer.from("position"),
    key(config, "Config").toBuffer(),
    key(owner, "Position owner").toBuffer(),
    positionBytes,
  ]);
}

export function deriveRoundAddress({ config, programId, week }) {
  if (!Number.isSafeInteger(week) || week < 0) throw new Error("Round week must be a non-negative safe integer");
  const weekBytes = Buffer.alloc(8);
  weekBytes.writeBigUInt64LE(BigInt(week));
  return pda(key(programId, "IAT V2 program"), [Buffer.from("round"), key(config, "Config").toBuffer(), weekBytes]);
}

export function createIatV2DeploymentPlan({
  network,
  mint,
  programId,
  randomnessProgramId,
  rehearsal = network === "devnet",
}) {
  if (!["devnet", "mainnet-beta", "localnet"].includes(network)) throw new Error("Unsupported deployment-plan network");
  const mintKey = key(mint, "Mint");
  const programKey = key(programId, "IAT V2 program");
  const randomnessKey = key(randomnessProgramId, "Randomness program");
  const expectedRandomnessKey = network === "mainnet-beta"
    ? SWITCHBOARD_ON_DEMAND_MAINNET_PROGRAM_ID
    : SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID;
  if (network === "mainnet-beta" && programKey.equals(NONDEPLOYABLE_SENTINEL_PROGRAM_ID)) {
    throw new Error("NONDEPLOYABLE_SENTINEL_PROGRAM_ID");
  }
  if (!randomnessKey.equals(expectedRandomnessKey)) {
    throw new Error("WRONG_SWITCHBOARD_ON_DEMAND_PROGRAM_ID");
  }
  if (programKey.equals(TOKEN_PROGRAM_ID)) {
    throw new Error("IAT program identity must not substitute the SPL Token Program");
  }
  const derived = deriveIatV2Addresses({ mint: mintKey, programId: programKey });
  const communityOwner = key(policy.publicRoles.communityCustody, "Community custody");
  const communityTokenAccount = getAssociatedTokenAddressSync(
    mintKey,
    communityOwner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const allocationDestinations = {
    community: {
      owner: communityOwner,
      tokenAccount: communityTokenAccount,
      amount: scaledAmount(policy.allocations.community.baseUnitAmount, rehearsal),
      custody: "HARDWARE_WALLET_ATA",
    },
    treasury: {
      owner: derived.vaultAuthority,
      tokenAccount: derived.lanes.treasury.tokenAccount,
      amount: scaledAmount(policy.allocations.treasury.baseUnitAmount, rehearsal),
      custody: "PROGRAM_VAULT_PDA",
    },
    ecosystem: {
      owner: derived.vaultAuthority,
      tokenAccount: derived.lanes.ecosystem.tokenAccount,
      amount: scaledAmount(policy.allocations.ecosystem.baseUnitAmount, rehearsal),
      custody: "PROGRAM_VAULT_PDA",
    },
    coreTeam: {
      owner: derived.vaultAuthority,
      tokenAccount: derived.lanes.coreTeam.tokenAccount,
      amount: scaledAmount(policy.allocations.coreTeam.baseUnitAmount, rehearsal),
      custody: "PROGRAM_VAULT_PDA",
    },
    liquidity: {
      owner: derived.vaultAuthority,
      tokenAccount: derived.lanes.liquidity.tokenAccount,
      amount: scaledAmount(policy.allocations.liquidity.baseUnitAmount, rehearsal),
      custody: "PROGRAM_VAULT_PDA",
    },
  };
  const total = Object.values(allocationDestinations).reduce((sum, allocation) => sum + allocation.amount, 0n);
  const expected = rehearsal ? 1_000_000_000_000n : 1_000_000_000_000_000_000n;
  if (total !== expected) throw new Error("Deployment plan does not total the expected fixed supply");
  return {
    schema: "iat-v2-unsigned-deployment-plan/v1",
    status: "HOLD",
    network,
    rehearsal,
    signingOrBroadcastCapability: false,
    mint: mintKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    programId: programKey,
    randomnessProgramId: randomnessKey,
    intendedUpgradeAuthority: key(policy.publicRoles.programAdmin, "Program administrator"),
    stageOrder: [...V2_STAGE_ORDER],
    ...derived,
    allocationDestinations,
    expectedSupplyBaseUnits: expected,
  };
}

export function serializePlan(plan) {
  return JSON.stringify(plan, (_key, value) => {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof PublicKey) return value.toBase58();
    return value;
  }, 2);
}
