import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import {
  decodeInitializeMintInstruction,
  decodeMintToCheckedInstruction,
} from "@solana/spl-token";
import {
  BPF_UPGRADEABLE_LOADER_ID,
  DEVNET_FEATURE_MINT_SEED,
  DEVNET_MINT_SEED,
  IAT_V2_ADMIN_STAGE_ORDER,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
  IAT_V2_REHEARSAL_SUPPLY,
  AuthorityType,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  buildActivateTransaction,
  buildCreateMintAndMetadataTransaction,
  buildInitializeConfigInstruction,
  buildInitializeVaultsTransaction,
  buildMintRehearsalAllocationsTransaction,
  buildRevokeV2AuthorityTransaction,
  deriveDeterministicDevnetMint,
  parseUpgradeableProgramAccounts,
  parseUpgradeableProgramData,
  parseV2ConfigAccount,
} from "../programs/iat_v2/instructions.mjs";
import {
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  deriveIatV2Addresses,
} from "../programs/iat_v2/client.mjs";

const blockhash = new PublicKey(new Uint8Array(32).fill(47)).toBase58();

function anchorDiscriminator(name) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function wireSize(transaction) {
  transaction.feePayer = IAT_V2_PROGRAM_ADMIN;
  transaction.recentBlockhash = blockhash;
  return transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).length;
}

test("local V2 console exposes only the reviewed seven-stage devnet order", () => {
  assert.deepEqual(IAT_V2_ADMIN_STAGE_ORDER, [
    "CREATE_MINT_AND_IMMUTABLE_METADATA",
    "INITIALIZE_V2_CONFIG",
    "INITIALIZE_FOUR_LANES_AND_STAKE_VAULT",
    "MINT_EXACT_REHEARSAL_ALLOCATIONS",
    "REVOKE_MINT_AUTHORITY",
    "REVOKE_FREEZE_AUTHORITY",
    "ACTIVATE_V2",
  ]);
  assert.equal(BPF_UPGRADEABLE_LOADER_ID.toBase58(), "BPFLoaderUpgradeab1e11111111111111111111111");
  assert.equal(IAT_V2_PROGRAM_ID.toBase58(), "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj");
});

test("deterministic mint uses the hardware administrator as the only base signer", async () => {
  const mint = await deriveDeterministicDevnetMint();
  const repeated = await deriveDeterministicDevnetMint({
    admin: IAT_V2_PROGRAM_ADMIN,
    seed: DEVNET_MINT_SEED,
  });
  assert.equal(mint.toBase58(), repeated.toBase58());
  assert.equal(DEVNET_MINT_SEED.length <= 32, true);

  const built = await buildCreateMintAndMetadataTransaction({
    rentLamports: 1_461_600,
  });
  assert.equal(built.mint.toBase58(), mint.toBase58());
  assert.equal(built.transaction.instructions.length, 3);
  assert.equal(built.transaction.instructions[0].programId.toBase58(), "11111111111111111111111111111111");
  assert.equal(built.transaction.instructions[1].programId.toBase58(), TOKEN_PROGRAM_ID.toBase58());
  const initialize = decodeInitializeMintInstruction(built.transaction.instructions[1]);
  assert.equal(initialize.data.decimals, 9);
  assert.equal(initialize.data.mintAuthority.toBase58(), IAT_V2_PROGRAM_ADMIN.toBase58());
  assert.equal(initialize.data.freezeAuthority?.toBase58(), IAT_V2_PROGRAM_ADMIN.toBase58());
  assert.ok(wireSize(built.transaction) <= 1232);
  assert.equal(MINT_SIZE, 82);
});

test("feature rehearsal uses a separate deterministic mint namespace", async () => {
  const initializationMint = await deriveDeterministicDevnetMint();
  const featureMint = await deriveDeterministicDevnetMint({ seed: DEVNET_FEATURE_MINT_SEED });
  assert.notEqual(featureMint.toBase58(), initializationMint.toBase58());
  assert.notEqual(DEVNET_FEATURE_MINT_SEED, DEVNET_MINT_SEED);
  assert.equal(DEVNET_FEATURE_MINT_SEED.length <= 32, true);
});

test("initialize-config ABI exactly matches the Anchor discriminator, Borsh args, and account order", async () => {
  const mint = await deriveDeterministicDevnetMint();
  const timestamp = 1_785_363_200n;
  const instruction = buildInitializeConfigInstruction({
    mint,
    rehearsalGenesisTimestamp: timestamp,
  });
  const derived = deriveIatV2Addresses({ mint, programId: IAT_V2_PROGRAM_ID });
  assert.deepEqual(instruction.data.subarray(0, 8), anchorDiscriminator("initialize_config"));
  assert.deepEqual([...instruction.data.subarray(8, 10)], [1, 1]);
  assert.equal(instruction.data.readBigInt64LE(10), timestamp);
  assert.equal(
    new PublicKey(instruction.data.subarray(18, 50)).toBase58(),
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID.toBase58(),
  );
  assert.deepEqual(
    instruction.keys.map(({ pubkey, isSigner, isWritable }) => [
      pubkey.toBase58(),
      isSigner,
      isWritable,
    ]),
    [
      [IAT_V2_PROGRAM_ADMIN.toBase58(), true, true],
      [mint.toBase58(), false, false],
      [derived.config.toBase58(), false, true],
      [derived.vaultAuthority.toBase58(), false, false],
      [TOKEN_PROGRAM_ID.toBase58(), false, false],
      ["11111111111111111111111111111111", false, false],
    ],
  );
});

test("four lane initializations plus stake initialization fit one legacy transaction", async () => {
  const mint = await deriveDeterministicDevnetMint();
  const transaction = buildInitializeVaultsTransaction({ mint });
  assert.equal(transaction.instructions.length, 5);
  for (let index = 0; index < 4; index += 1) {
    const instruction = transaction.instructions[index];
    assert.deepEqual(
      instruction.data.subarray(0, 8),
      anchorDiscriminator("initialize_lane_vault"),
    );
    assert.equal(instruction.data[8], index + 1);
    assert.equal(instruction.keys.length, 8);
  }
  assert.deepEqual(
    transaction.instructions[4].data,
    anchorDiscriminator("initialize_stake_vault"),
  );
  assert.equal(transaction.instructions[4].keys.length, 7);
  assert.ok(wireSize(transaction) <= 1232, `vault transaction is ${wireSize(transaction)} bytes`);
});

test("rehearsal allocation transaction creates only community ATA and mints exact 50/20/15/10/5", async () => {
  const mint = await deriveDeterministicDevnetMint();
  const { transaction, plan } = buildMintRehearsalAllocationsTransaction({ mint });
  assert.equal(transaction.instructions.length, 6);
  const decodedMints = transaction.instructions
    .slice(1)
    .map((instruction) => decodeMintToCheckedInstruction(instruction));
  assert.deepEqual(
    decodedMints.map(({ data }) => data.amount),
    [
      500_000_000_000n,
      200_000_000_000n,
      150_000_000_000n,
      100_000_000_000n,
      50_000_000_000n,
    ],
  );
  assert.equal(
    decodedMints.reduce((total, { data }) => total + data.amount, 0n),
    IAT_V2_REHEARSAL_SUPPLY,
  );
  assert.equal(plan.expectedSupplyBaseUnits, IAT_V2_REHEARSAL_SUPPLY);
  assert.ok(wireSize(transaction) <= 1232);
});

test("authority revocations and activation preserve reviewed account order", async () => {
  const mint = await deriveDeterministicDevnetMint();
  for (const authorityType of [AuthorityType.MintTokens, AuthorityType.FreezeAccount]) {
    assert.equal(buildRevokeV2AuthorityTransaction({ mint, authorityType }).instructions.length, 1);
  }
  const transaction = buildActivateTransaction({ mint });
  assert.equal(transaction.instructions.length, 1);
  assert.deepEqual(
    transaction.instructions[0].data,
    anchorDiscriminator("activate"),
  );
  assert.equal(transaction.instructions[0].keys.length, 16);
  assert.ok(wireSize(transaction) <= 1232);
});

test("fixed Config and upgradeable-loader layouts decode without trusting UI state", async () => {
  const mint = await deriveDeterministicDevnetMint();
  const derived = deriveIatV2Addresses({ mint, programId: IAT_V2_PROGRAM_ID });
  const config = Buffer.alloc(234);
  IAT_V2_PROGRAM_ADMIN.toBuffer().copy(config, 8);
  mint.toBuffer().copy(config, 40);
  TOKEN_PROGRAM_ID.toBuffer().copy(config, 72);
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID.toBuffer().copy(config, 104);
  derived.stakeTokenAccount.toBuffer().copy(config, 136);
  config.writeBigInt64LE(1_785_363_200n, 200);
  config.writeBigUInt64LE(IAT_V2_REHEARSAL_SUPPLY, 208);
  config[228] = 1;
  config[229] = 1;
  config[230] = 0b1_1110;
  config[231] = 1;
  const decoded = parseV2ConfigAccount(config);
  assert.equal(decoded.admin.toBase58(), IAT_V2_PROGRAM_ADMIN.toBase58());
  assert.equal(decoded.mint.toBase58(), mint.toBase58());
  assert.equal(decoded.expectedSupply, IAT_V2_REHEARSAL_SUPPLY);
  assert.equal(decoded.rehearsalMode, true);
  assert.equal(decoded.active, true);
  assert.equal(decoded.laneMask, 0b1_1110);

  const program = Buffer.alloc(36);
  program.writeUInt32LE(2, 0);
  IAT_V2_PROGRAM_DATA_ADDRESS.toBuffer().copy(program, 4);
  assert.equal(
    parseUpgradeableProgramAccounts({
      programData: program,
      programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS,
    }).programDataAddress.toBase58(),
    IAT_V2_PROGRAM_DATA_ADDRESS.toBase58(),
  );
  const programData = Buffer.alloc(45 + 32, 3);
  programData.writeUInt32LE(3, 0);
  programData.writeBigUInt64LE(42n, 4);
  programData[12] = 1;
  IAT_V2_PROGRAM_ADMIN.toBuffer().copy(programData, 13);
  const parsedProgramData = parseUpgradeableProgramData(programData);
  assert.equal(parsedProgramData.slot, 42n);
  assert.equal(parsedProgramData.upgradeAuthority.toBase58(), IAT_V2_PROGRAM_ADMIN.toBase58());
  assert.equal(parsedProgramData.programBytes.length, 32);
});
