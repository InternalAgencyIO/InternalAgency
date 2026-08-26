import { Buffer } from "buffer";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
} from "@solana/spl-token";
import { getCreateMetadataAccountV3InstructionDataSerializer } from
  "@metaplex-foundation/mpl-token-metadata";
import {
  METADATA_PROGRAM_ID,
  TOKEN_DECIMALS,
  deriveMetadataAddress,
} from "../../app/mint/ceremony.mjs";
import {
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  createIatV2DeploymentPlan,
  deriveIatV2Addresses,
} from "./client.mjs";

export const IAT_V2_PROGRAM_ID = new PublicKey("62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj");
export const IAT_V2_PROGRAM_DATA_ADDRESS = new PublicKey(
  "6DaESYUqB7th7kkfYAhsqiYfzmdnCFeFeoxDi5WkejTP",
);
export const IAT_V2_PROGRAM_ADMIN = new PublicKey("7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH");
export const IAT_V2_PROGRAM_ARTIFACT_SHA256 =
  "634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7";
export const IAT_V2_PROGRAM_ARTIFACT_BYTES = 597_336;
export const IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_SHA256 =
  "d437be9a78aeaa09eeef419554bd0c0598a18239edeb226912c79a973f24d2a4";
export const IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_BYTES = 579_480;
export const IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_SOURCE_HEAD =
  "dd3cb28f6b985c84fddcb971beaa9f00126f5d99";
export const IAT_V2_CURRENT_REVIEWED_PROGRAM_ARTIFACT_BUILD_RUN_ID = 31_372_599_971;
// Exact migration-capable artifact from the successful public CI build. The
// target binary and evidence manifest remain operator-supplied, untracked
// inputs; these constants are pins, not embedded deployment material.
export const IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256 =
  "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01";
export const IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES = 649_680;
export const IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD =
  "bb09bd292bab546b3585806fc475c3747dbb8011";
export const IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID = 32_943_011_981;
export const BPF_UPGRADEABLE_LOADER_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);
export const DEVNET_MINT_SEED = "iat-v2-devnet-ba885350-v1";
export const DEVNET_FEATURE_MINT_SEED = "iat-v2-features-cold7xz-v3";
export const IAT_V2_REHEARSAL_SUPPLY = 1_000_000_000_000n;

export const IAT_V2_ADMIN_STAGE_ORDER = Object.freeze([
  "CREATE_MINT_AND_IMMUTABLE_METADATA",
  "INITIALIZE_V2_CONFIG",
  "INITIALIZE_FOUR_LANES_AND_STAKE_VAULT",
  "MINT_EXACT_REHEARSAL_ALLOCATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
  "ACTIVATE_V2",
]);

const DISCRIMINATORS = Object.freeze({
  initializeConfig: [208, 127, 21, 1, 194, 190, 196, 70],
  initializeLaneVault: [242, 187, 92, 202, 76, 41, 212, 104],
  initializeStakeVault: [125, 55, 104, 34, 35, 179, 67, 3],
  activate: [194, 203, 35, 100, 151, 55, 170, 82],
});

const METADATA = Object.freeze({
  name: "Internal Agency Token",
  symbol: "IAT",
  uri: "https://internalagency.io/metadata/iat.json",
  sellerFeeBasisPoints: 0,
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
  return Buffer.from(DISCRIMINATORS[name]);
}

function signedI64(value, label) {
  let normalized;
  try {
    normalized = BigInt(value);
  } catch {
    throw new Error(`${label} must be a signed 64-bit integer`);
  }
  if (normalized < -(2n ** 63n) || normalized >= 2n ** 63n) {
    throw new Error(`${label} must fit a signed 64-bit integer`);
  }
  const data = Buffer.alloc(8);
  data.writeBigInt64LE(normalized);
  return data;
}

export async function deriveDeterministicDevnetMint({
  admin = IAT_V2_PROGRAM_ADMIN,
  seed = DEVNET_MINT_SEED,
} = {}) {
  if (typeof seed !== "string" || new TextEncoder().encode(seed).length > 32 || seed.length === 0) {
    throw new Error("Deterministic mint seed must contain 1-32 UTF-8 bytes");
  }
  return PublicKey.createWithSeed(key(admin, "Program administrator"), seed, TOKEN_PROGRAM_ID);
}

export async function buildCreateMintAndMetadataTransaction({
  feePayer = IAT_V2_PROGRAM_ADMIN,
  seed = DEVNET_MINT_SEED,
  rentLamports,
} = {}) {
  if (!Number.isSafeInteger(rentLamports) || rentLamports <= 0) {
    throw new Error("Mint rent must be a positive safe integer");
  }
  const payer = key(feePayer, "Fee payer");
  const mint = await deriveDeterministicDevnetMint({ admin: payer, seed });
  const metadataAddress = deriveMetadataAddress(mint);
  const metadataData = Buffer.from(
    getCreateMetadataAccountV3InstructionDataSerializer().serialize({
      data: {
        name: METADATA.name,
        symbol: METADATA.symbol,
        uri: METADATA.uri,
        sellerFeeBasisPoints: METADATA.sellerFeeBasisPoints,
        creators: null,
        collection: null,
        uses: null,
      },
      isMutable: false,
      collectionDetails: null,
    }),
  );
  const metadataInstruction = new TransactionInstruction({
    programId: METADATA_PROGRAM_ID,
    keys: [
      account(metadataAddress, false, true),
      account(mint),
      account(payer, true),
      account(payer, true, true),
      account(payer),
      account(SystemProgram.programId),
    ],
    data: metadataData,
  });
  return {
    mint,
    metadataAddress,
    transaction: new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer,
        newAccountPubkey: mint,
        basePubkey: payer,
        seed,
        lamports: rentLamports,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint,
        TOKEN_DECIMALS,
        payer,
        payer,
        TOKEN_PROGRAM_ID,
      ),
      metadataInstruction,
    ),
  };
}

export function buildInitializeConfigInstruction({
  admin = IAT_V2_PROGRAM_ADMIN,
  mint,
  rehearsalGenesisTimestamp,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const adminKey = key(admin, "Program administrator");
  const mintKey = key(mint, "Mint");
  const programKey = key(programId, "IAT V2 program");
  const { config, vaultAuthority } = deriveIatV2Addresses({
    mint: mintKey,
    programId: programKey,
  });
  const data = Buffer.concat([
    discriminator("initializeConfig"),
    Buffer.from([1, 1]),
    signedI64(rehearsalGenesisTimestamp, "Rehearsal genesis timestamp"),
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID.toBuffer(),
  ]);
  return new TransactionInstruction({
    programId: programKey,
    keys: [
      account(adminKey, true, true),
      account(mintKey),
      account(config, false, true),
      account(vaultAuthority),
      account(TOKEN_PROGRAM_ID),
      account(SystemProgram.programId),
    ],
    data,
  });
}

export function buildInitializeLaneVaultInstruction({
  admin = IAT_V2_PROGRAM_ADMIN,
  mint,
  lane,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  if (!Number.isInteger(lane) || lane < 1 || lane > 4) {
    throw new Error("V2 program lane must be an integer from 1 through 4");
  }
  const adminKey = key(admin, "Program administrator");
  const mintKey = key(mint, "Mint");
  const programKey = key(programId, "IAT V2 program");
  const derived = deriveIatV2Addresses({ mint: mintKey, programId: programKey });
  const laneName = ["treasury", "ecosystem", "coreTeam", "liquidity"][lane - 1];
  const laneAccounts = derived.lanes[laneName];
  return new TransactionInstruction({
    programId: programKey,
    keys: [
      account(adminKey, true, true),
      account(derived.config, false, true),
      account(mintKey),
      account(derived.vaultAuthority),
      account(laneAccounts.state, false, true),
      account(laneAccounts.tokenAccount, false, true),
      account(TOKEN_PROGRAM_ID),
      account(SystemProgram.programId),
    ],
    data: Buffer.concat([discriminator("initializeLaneVault"), Buffer.from([lane])]),
  });
}

export function buildInitializeStakeVaultInstruction({
  admin = IAT_V2_PROGRAM_ADMIN,
  mint,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const adminKey = key(admin, "Program administrator");
  const mintKey = key(mint, "Mint");
  const programKey = key(programId, "IAT V2 program");
  const derived = deriveIatV2Addresses({ mint: mintKey, programId: programKey });
  return new TransactionInstruction({
    programId: programKey,
    keys: [
      account(adminKey, true, true),
      account(derived.config, false, true),
      account(mintKey),
      account(derived.vaultAuthority),
      account(derived.stakeTokenAccount, false, true),
      account(TOKEN_PROGRAM_ID),
      account(SystemProgram.programId),
    ],
    data: discriminator("initializeStakeVault"),
  });
}

export function buildInitializeConfigTransaction(options) {
  return new Transaction().add(buildInitializeConfigInstruction(options));
}

export function buildInitializeVaultsTransaction({
  admin = IAT_V2_PROGRAM_ADMIN,
  mint,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const transaction = new Transaction();
  for (let lane = 1; lane <= 4; lane += 1) {
    transaction.add(buildInitializeLaneVaultInstruction({ admin, mint, lane, programId }));
  }
  return transaction.add(buildInitializeStakeVaultInstruction({ admin, mint, programId }));
}

export function buildMintRehearsalAllocationsTransaction({
  admin = IAT_V2_PROGRAM_ADMIN,
  mint,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const adminKey = key(admin, "Program administrator");
  const mintKey = key(mint, "Mint");
  const plan = createIatV2DeploymentPlan({
    network: "devnet",
    mint: mintKey,
    programId,
    randomnessProgramId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    rehearsal: true,
  });
  const transaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      adminKey,
      plan.allocationDestinations.community.tokenAccount,
      plan.allocationDestinations.community.owner,
      mintKey,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );
  for (const allocation of Object.values(plan.allocationDestinations)) {
    transaction.add(createMintToCheckedInstruction(
      mintKey,
      allocation.tokenAccount,
      adminKey,
      allocation.amount,
      TOKEN_DECIMALS,
      [],
      TOKEN_PROGRAM_ID,
    ));
  }
  return { transaction, plan };
}

export function buildRevokeV2AuthorityTransaction({
  admin = IAT_V2_PROGRAM_ADMIN,
  mint,
  authorityType,
} = {}) {
  if (![AuthorityType.MintTokens, AuthorityType.FreezeAccount].includes(authorityType)) {
    throw new Error("V2 ceremony can revoke only mint or freeze authority");
  }
  return new Transaction().add(createSetAuthorityInstruction(
    key(mint, "Mint"),
    key(admin, "Program administrator"),
    authorityType,
    null,
    [],
    TOKEN_PROGRAM_ID,
  ));
}

export function buildActivateInstruction({
  admin = IAT_V2_PROGRAM_ADMIN,
  mint,
  programId = IAT_V2_PROGRAM_ID,
} = {}) {
  const adminKey = key(admin, "Program administrator");
  const mintKey = key(mint, "Mint");
  const programKey = key(programId, "IAT V2 program");
  const plan = createIatV2DeploymentPlan({
    network: "devnet",
    mint: mintKey,
    programId: programKey,
    randomnessProgramId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    rehearsal: true,
  });
  return new TransactionInstruction({
    programId: programKey,
    keys: [
      account(adminKey, true, true),
      account(plan.config, false, true),
      account(mintKey),
      account(plan.vaultAuthority),
      account(plan.allocationDestinations.community.tokenAccount),
      account(plan.stakeTokenAccount),
      account(plan.lanes.treasury.state, false, true),
      account(plan.lanes.treasury.tokenAccount),
      account(plan.lanes.ecosystem.state, false, true),
      account(plan.lanes.ecosystem.tokenAccount),
      account(plan.lanes.coreTeam.state),
      account(plan.lanes.coreTeam.tokenAccount),
      account(plan.lanes.liquidity.state, false, true),
      account(plan.lanes.liquidity.tokenAccount),
      account(plan.coreReward, false, true),
      account(SystemProgram.programId),
    ],
    data: discriminator("activate"),
  });
}

export function buildActivateTransaction(options) {
  return new Transaction().add(buildActivateInstruction(options));
}

export function parseV2ConfigAccount(data) {
  const bytes = Buffer.from(data);
  if (bytes.length < 234) throw new Error("V2 config account is shorter than the reviewed layout");
  return {
    admin: new PublicKey(bytes.subarray(8, 40)),
    mint: new PublicKey(bytes.subarray(40, 72)),
    tokenProgram: new PublicKey(bytes.subarray(72, 104)),
    randomnessProgram: new PublicKey(bytes.subarray(104, 136)),
    stakeTokenAccount: new PublicKey(bytes.subarray(136, 168)),
    agencyRegistryHash: bytes.subarray(168, 200),
    genesisTimestamp: bytes.readBigInt64LE(200),
    expectedSupply: bytes.readBigUInt64LE(208),
    stakedPrincipal: bytes.readBigUInt64LE(216),
    agencyCount: bytes.readUInt32LE(224),
    rehearsalMode: bytes[228] === 1,
    active: bytes[229] === 1,
    laneMask: bytes[230],
    stakeVaultInitialized: bytes[231] === 1,
    bump: bytes[232],
    vaultAuthorityBump: bytes[233],
  };
}

export function parseUpgradeableProgramAccounts({
  programData,
  programDataAddress,
} = {}) {
  const programBytes = Buffer.from(programData);
  if (programBytes.length !== 36 || programBytes.readUInt32LE(0) !== 2) {
    throw new Error("Program account is not the reviewed upgradeable Program state");
  }
  const derivedProgramDataAddress = new PublicKey(programBytes.subarray(4, 36));
  const expectedProgramDataAddress = key(programDataAddress, "Expected ProgramData address");
  if (!derivedProgramDataAddress.equals(expectedProgramDataAddress)) {
    throw new Error("Program account points at an unexpected ProgramData address");
  }
  return { programDataAddress: derivedProgramDataAddress };
}

export function parseUpgradeableProgramData(data) {
  const bytes = Buffer.from(data);
  if (bytes.length < 45 || bytes.readUInt32LE(0) !== 3 || bytes[12] !== 1) {
    throw new Error("ProgramData account has no reviewed upgrade authority");
  }
  return {
    slot: bytes.readBigUInt64LE(4),
    upgradeAuthority: new PublicKey(bytes.subarray(13, 45)),
    programBytes: bytes.subarray(45),
  };
}

export async function inspectReviewedUpgradeableProgramArtifact({
  programBytes,
  sha256Hex,
  expectedArtifactBytes = IAT_V2_PROGRAM_ARTIFACT_BYTES,
  expectedArtifactSha256 = IAT_V2_PROGRAM_ARTIFACT_SHA256,
} = {}) {
  const loaderRegion = Buffer.from(programBytes ?? []);
  if (!Number.isSafeInteger(expectedArtifactBytes) || expectedArtifactBytes <= 0) {
    throw new Error("Expected program artifact byte length must be a positive safe integer");
  }
  if (!/^[0-9a-f]{64}$/u.test(expectedArtifactSha256)) {
    throw new Error("Expected program artifact SHA-256 must be lowercase hexadecimal");
  }
  if (loaderRegion.length < expectedArtifactBytes) {
    throw new Error(
      `ProgramData region contains ${loaderRegion.length} bytes, expected at least ${expectedArtifactBytes}`,
    );
  }
  if (typeof sha256Hex !== "function") {
    throw new Error("Program artifact inspection requires a SHA-256 function");
  }

  const artifactBytes = loaderRegion.subarray(0, expectedArtifactBytes);
  const loaderPadding = loaderRegion.subarray(expectedArtifactBytes);
  const loaderPaddingIsZero = loaderPadding.every((value) => value === 0);
  const artifactSha256 = await sha256Hex(artifactBytes);
  return {
    artifactBytes: artifactBytes.length,
    artifactSha256,
    loaderPaddingBytes: loaderPadding.length,
    loaderPaddingIsZero,
    loaderRegionBytes: loaderRegion.length,
    matchesReviewedArtifact:
      artifactSha256 === expectedArtifactSha256 && loaderPaddingIsZero,
  };
}

export { AuthorityType, MINT_SIZE, TOKEN_PROGRAM_ID };
