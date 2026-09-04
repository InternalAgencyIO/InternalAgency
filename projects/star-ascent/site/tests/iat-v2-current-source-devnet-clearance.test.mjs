import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  createIatV2DeploymentPlan,
  deriveRoundAddress,
} from "../programs/iat_v2/client.mjs";
import {
  IAT_V2_ROUND_ACCOUNT_DISCRIMINATOR,
  IAT_V2_ROUND_STATUS,
  buildBackfillHistoricalNeutralRoundInstruction,
  buildCommitRoundInstruction,
  buildExpireRoundInstruction,
  buildMigrateLegacyRoundInstruction,
  buildSettlePositionWeekInstruction,
  buildSettleRoundInstruction,
} from "../programs/iat_v2/feature-instructions.mjs";
import {
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
  IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
} from "../programs/iat_v2/ceremony-horizon.mjs";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  BPF_UPGRADEABLE_LOADER_ID,
  DEVNET_FEATURE_MINT_SEED,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
  deriveDeterministicDevnetMint,
} from "../programs/iat_v2/instructions.mjs";
import {
  CurrentSourceClearanceError,
  decodeCompleteRehearsalRoster,
  observeCompleteRehearsalPostState,
} from "../scripts/lib/iat-v2-current-source-devnet-clearance.mjs";

const QUEUE = new PublicKey("EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7");
const HISTORICAL_RANDOMNESS = new PublicKey("Edfx7Zo289rkt4HczWsLK5TuUkoYbmHkr2rsirSEqEb8");
const MIGRATED_ROUND_PINS = Object.freeze({
  7: {
    commitSlot: 480_122_945n,
    randomness: Buffer.from("3036d2bbcd0f00efffe055c20dbe272e9aa774039811957422f83362a4281cf0", "hex"),
  },
  8: {
    commitSlot: 480_373_914n,
    randomness: Buffer.from("91edf1d6f8a02d17bc059c077fdb3bcf46712b0c3047eec490335e2eee38abf9", "hex"),
  },
});
const blockhash = Keypair.generate().publicKey.toBase58();
const sha256Bytes = (bytes) => createHash("sha256").update(bytes).digest();

function parsedTransaction(instructions, extraSigners = []) {
  const transaction = new Transaction({
    feePayer: IAT_V2_PROGRAM_ADMIN,
    recentBlockhash: blockhash,
  }).add(...instructions);
  transaction.setSigners(IAT_V2_PROGRAM_ADMIN, ...extraSigners);
  transaction.signatures.forEach((entry) => { entry.signature = Buffer.alloc(64, 1); });
  return Transaction.from(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }));
}

async function exactRoster({ createRandomness = true, reveal = false } = {}) {
  const mint = await deriveDeterministicDevnetMint({ seed: DEVNET_FEATURE_MINT_SEED });
  const plan = createIatV2DeploymentPlan({
    network: "devnet",
    mint,
    programId: IAT_V2_PROGRAM_ID,
    randomnessProgramId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    rehearsal: true,
  });
  const randomness = Keypair.generate().publicKey;
  const oracle = Keypair.generate().publicKey;
  const buffer = Keypair.generate().publicKey;
  const upgrade = new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_ID,
    data: Buffer.from([3, 0, 0, 0]),
    keys: [
      { pubkey: IAT_V2_PROGRAM_DATA_ADDRESS, isSigner: false, isWritable: true },
      { pubkey: IAT_V2_PROGRAM_ID, isSigner: false, isWritable: true },
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: IAT_V2_PROGRAM_ADMIN, isSigner: true, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: IAT_V2_PROGRAM_ADMIN, isSigner: true, isWritable: true },
    ],
  });
  const settle = (positionId, week) => buildSettlePositionWeekInstruction({
    caller: IAT_V2_PROGRAM_ADMIN,
    mint,
    positionOwner: IAT_V2_PROGRAM_ADMIN,
    positionId,
    destinationTokens: plan.allocationDestinations.community.tokenAccount,
    week,
    round: positionId === 1 ? null : deriveRoundAddress({ config: plan.config, programId: IAT_V2_PROGRAM_ID, week }),
  });
  const switchboardCommit = new TransactionInstruction({
    programId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    data: Buffer.from("34aa98c9b385f28d", "hex"),
    keys: [
      { pubkey: randomness, isSigner: false, isWritable: true },
      { pubkey: QUEUE, isSigner: false, isWritable: false },
      { pubkey: oracle, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_SLOT_HASHES_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: IAT_V2_PROGRAM_ADMIN, isSigner: true, isWritable: true },
    ],
  });
  const state = PublicKey.findProgramAddressSync([Buffer.from("STATE")], SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID)[0];
  const recentSlot = 700;
  const lutSigner = PublicKey.findProgramAddressSync(
    [Buffer.from("LutSigner"), randomness.toBuffer()],
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  )[0];
  const lut = AddressLookupTableProgram.createLookupTable({ authority: lutSigner, payer: PublicKey.default, recentSlot })[1];
  const rewardEscrow = getAssociatedTokenAddressSync(NATIVE_MINT, randomness);
  const initData = Buffer.alloc(16);
  Buffer.from("0909cc213274710f", "hex").copy(initData);
  initData.writeBigUInt64LE(BigInt(recentSlot), 8);
  const switchboardInit = new TransactionInstruction({
    programId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    data: initData,
    keys: [
      { pubkey: randomness, isSigner: true, isWritable: true },
      { pubkey: QUEUE, isSigner: false, isWritable: true },
      { pubkey: IAT_V2_PROGRAM_ADMIN, isSigner: true, isWritable: true },
      { pubkey: IAT_V2_PROGRAM_ADMIN, isSigner: true, isWritable: true },
      { pubkey: rewardEscrow, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: NATIVE_MINT, isSigner: false, isWritable: false },
      { pubkey: state, isSigner: false, isWritable: false },
      { pubkey: lutSigner, isSigner: false, isWritable: false },
      { pubkey: lut, isSigner: false, isWritable: true },
      { pubkey: AddressLookupTableProgram.programId, isSigner: false, isWritable: false },
    ],
  });
  const stats = PublicKey.findProgramAddressSync(
    [Buffer.from("OracleRandomnessStats"), oracle.toBuffer()],
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  )[0];
  const revealData = Buffer.alloc(105);
  Buffer.from("c5b5bb0a1e3a1449", "hex").copy(revealData);
  revealData[73] = 1;
  const switchboardReveal = new TransactionInstruction({
    programId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    data: revealData,
    keys: [
      { pubkey: randomness, isSigner: false, isWritable: true },
      { pubkey: oracle, isSigner: false, isWritable: false },
      { pubkey: QUEUE, isSigner: false, isWritable: false },
      { pubkey: stats, isSigner: false, isWritable: true },
      { pubkey: IAT_V2_PROGRAM_ADMIN, isSigner: true, isWritable: true },
      { pubkey: IAT_V2_PROGRAM_ADMIN, isSigner: true, isWritable: true },
      { pubkey: SYSVAR_SLOT_HASHES_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: rewardEscrow, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: NATIVE_MINT, isSigner: false, isWritable: false },
      { pubkey: state, isSigner: false, isWritable: false },
    ],
  });
  const raw = [
    ["UPGRADE_PROGRAM", [upgrade]],
    ["MIGRATE_LEGACY_ROUND_WEEK_7", [buildMigrateLegacyRoundInstruction({ mint, week: 7 })]],
    ["MIGRATE_LEGACY_ROUND_WEEK_8", [buildMigrateLegacyRoundInstruction({ mint, week: 8 })]],
    ["BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_9", [buildBackfillHistoricalNeutralRoundInstruction({ mint, week: 9 })]],
    ["BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_10", [buildBackfillHistoricalNeutralRoundInstruction({ mint, week: 10 })]],
    ["BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_11", [buildBackfillHistoricalNeutralRoundInstruction({ mint, week: 11 })]],
    ["SETTLE_STANDARD_POSITION_WEEK_10", [settle(1, 10)]],
    ["SETTLE_STANDARD_POSITION_WEEK_11", [settle(1, 11)]],
    ["SETTLE_STANDARD_POSITION_WEEK_12", [settle(1, 12)]],
    ["SETTLE_STANDARD_POSITION_WEEK_13", [settle(1, 13)]],
    ["SETTLE_LINKED_POSITION_2_WEEK_9", [settle(2, 9)]],
    ["SETTLE_LINKED_POSITION_2_WEEK_10", [settle(2, 10)]],
    ["SETTLE_LINKED_POSITION_2_WEEK_11", [settle(2, 11)]],
    ["SETTLE_LINKED_POSITION_3_WEEK_9", [settle(3, 9)]],
    ["SETTLE_LINKED_POSITION_3_WEEK_10", [settle(3, 10)]],
    ["SETTLE_LINKED_POSITION_3_WEEK_11", [settle(3, 11)]],
    ...(createRandomness ? [["CREATE_SWITCHBOARD_RANDOMNESS", [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
      switchboardInit,
    ], [randomness]]] : []),
    ["COMMIT_CCC_ROUND_12", [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
      switchboardCommit,
      buildCommitRoundInstruction({ payer: IAT_V2_PROGRAM_ADMIN, mint, randomnessAccount: randomness, week: 12 }),
    ]],
    reveal
      ? ["REVEAL_CCC_ROUND_12", [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
          switchboardReveal,
          buildSettleRoundInstruction({ mint, randomnessAccount: randomness, week: 12 }),
        ]]
      : ["EXPIRE_CCC_ROUND_12", [buildExpireRoundInstruction({ mint, week: 12 })]],
    ["SETTLE_LINKED_POSITION_2_WEEK_12", [settle(2, 12)]],
    ["SETTLE_LINKED_POSITION_3_WEEK_12", [settle(3, 12)]],
  ];
  return {
    artifactBytes: 200_000,
    conditions: {
      programDataExtensionRequired: false,
      preUpgradeProgramDataCapacityBytes: 200_000,
      switchboardRandomnessCreationRequired: createRandomness,
      policyWeek: IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
      cccRound: IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
      cccRoundTerminalAction: reveal ? "REVEAL_CCC_ROUND_12" : "EXPIRE_CCC_ROUND_12",
    },
    entries: raw.map(([action, instructions, extraSigners]) => ({ action, transaction: parsedTransaction(instructions, extraSigners) })),
  };
}

function registryHash() {
  const owners = [
    new PublicKey("Ge2c3puY5YwsiLhFJWdoXpRbE55k7omLw37pvJVCBkja"),
    new PublicKey("HpqX8EU3FSEPwdurSE8PudsjzpcZLJoaVB8R1Y1HfC6X"),
  ];
  let current = Buffer.alloc(32);
  owners.forEach((owner, index) => {
    const indexBytes = Buffer.alloc(4);
    indexBytes.writeUInt32LE(index);
    current = sha256Bytes(Buffer.concat([Buffer.from("IAT_AGENCY_REGISTRY_V1"), current, indexBytes, owner.toBuffer()]));
  });
  return current;
}

function contextHash(config, week, registry) {
  const weekBytes = Buffer.alloc(8);
  weekBytes.writeBigUInt64LE(BigInt(week));
  return sha256Bytes(Buffer.concat([Buffer.from("IAT_CCC_WEEKLY_TIEBREAK_V1"), config.toBuffer(), weekBytes, registry]));
}

function randomnessForWinner(decisionContext, winner) {
  const counter = Buffer.alloc(4);
  for (let candidate = 1; candidate < 10_000; candidate += 1) {
    const randomness = Buffer.alloc(32);
    randomness.writeUInt32LE(candidate);
    const sample = sha256Bytes(Buffer.concat([
      Buffer.from("IAT_TIEBREAK_V1"),
      decisionContext,
      randomness,
      counter,
    ]));
    if (sample[31] % 2 === winner) return randomness;
  }
  throw new Error(`unable to construct deterministic winner ${winner} fixture`);
}

function expectedPositionPaid(outcome) {
  if (outcome === "expired") {
    return [115_384_615n, 161_538_461n, 76_923_076n];
  }
  if (outcome === "winner0") {
    return [115_384_615n, 134_615_384n, 96_153_846n];
  }
  if (outcome === "winner1") {
    return [115_384_615n, 188_461_538n, 57_692_307n];
  }
  throw new Error(`unsupported terminal outcome ${outcome}`);
}

function owned(owner, bytes) {
  return { owner: owner.toBase58(), data: [bytes.toString("base64"), "base64"] };
}

function tokenAccount(mint, owner, amount) {
  const bytes = Buffer.alloc(165);
  mint.toBuffer().copy(bytes, 0);
  owner.toBuffer().copy(bytes, 32);
  bytes.writeBigUInt64LE(amount, 64);
  return owned(TOKEN_PROGRAM_ID, bytes);
}

async function exactPostState(decoded, { outcome = "expired" } = {}) {
  const mint = new PublicKey(decoded.mint);
  const configAddress = new PublicKey(decoded.config);
  const randomness = new PublicKey(decoded.randomness);
  const plan = createIatV2DeploymentPlan({
    network: "devnet",
    mint,
    programId: IAT_V2_PROGRAM_ID,
    randomnessProgramId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    rehearsal: true,
  });
  const registry = registryHash();
  const mintBytes = Buffer.alloc(82);
  mintBytes.writeBigUInt64LE(1_000_000_000_000n, 36);
  mintBytes[44] = 9;
  mintBytes[45] = 1;
  const config = Buffer.alloc(234);
  IAT_V2_PROGRAM_ADMIN.toBuffer().copy(config, 8);
  mint.toBuffer().copy(config, 40);
  TOKEN_PROGRAM_ID.toBuffer().copy(config, 72);
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID.toBuffer().copy(config, 104);
  plan.stakeTokenAccount.toBuffer().copy(config, 136);
  registry.copy(config, 168);
  config.writeBigInt64LE(1_780_636_775n, 200);
  config.writeBigUInt64LE(1_000_000_000_000n, 208);
  config.writeBigUInt64LE(30_000_000_000n, 216);
  config.writeUInt32LE(2, 224);
  config[228] = 1;
  config[229] = 1;
  config[230] = 0b1_1110;
  config[231] = 1;
  const paid = expectedPositionPaid(outcome);
  const rates = [1_000n, 2_800n, 2_000n];
  const maximum = [1_000_000_000n, 2_800_000_000n, 2_000_000_000n];
  const positions = paid.map((paidAmount, index) => {
    const bytes = Buffer.alloc(168);
    configAddress.toBuffer().copy(bytes, 8);
    IAT_V2_PROGRAM_ADMIN.toBuffer().copy(bytes, 40);
    bytes.writeBigUInt64LE(BigInt(index + 1), 72);
    bytes.writeBigUInt64LE(10_000_000_000n, 80);
    bytes.writeBigUInt64LE(7n, 88);
    bytes.writeBigUInt64LE(8n, 96);
    bytes.writeBigUInt64LE(52n, 104);
    bytes.writeBigUInt64LE(rates[index], 112);
    bytes.writeBigUInt64LE(maximum[index] - paidAmount, 120);
    bytes.writeBigUInt64LE(paidAmount, 144);
    bytes.writeBigUInt64LE(index === 0 ? 63n : 31n, 152);
    bytes.writeUInt32LE(index === 0 ? 0xffff_ffff : index - 1, 160);
    bytes[164] = index;
    return owned(IAT_V2_PROGRAM_ID, bytes);
  });
  const rounds = [7, 8, 9, 10, 11, 12].map((week) => {
    const migrated = MIGRATED_ROUND_PINS[week] ?? null;
    const bytes = Buffer.alloc(206);
    const live = week === 12;
    const liveDecisionContext = contextHash(configAddress, week, registry);
    const winner = outcome === "winner0" ? 0 : outcome === "winner1" ? 1 : null;
    const liveRandomness = winner === null
      ? Buffer.alloc(32)
      : randomnessForWinner(liveDecisionContext, winner);
    Buffer.from(IAT_V2_ROUND_ACCOUNT_DISCRIMINATOR).copy(bytes, 0);
    configAddress.toBuffer().copy(bytes, 8);
    (live ? randomness : (migrated ? HISTORICAL_RANDOMNESS : SystemProgram.programId)).toBuffer().copy(bytes, 40);
    bytes.writeBigUInt64LE(BigInt(week), 72);
    bytes.writeBigUInt64LE(live ? 999n : (migrated?.commitSlot ?? 0n), 80);
    bytes.writeBigInt64LE(week >= 9 && week <= 11
      ? 1_780_636_775n + 86_400n + BigInt(week) * 604_800n
      : (live ? 1_788_000_000n : 0n), 88);
    registry.copy(bytes, 128);
    liveDecisionContext.copy(bytes, 160);
    if (migrated) migrated.randomness.copy(bytes, 96);
    if (live) liveRandomness.copy(bytes, 96);
    bytes.writeUInt32LE(2, 192);
    bytes.writeUInt32LE(live && winner !== null ? winner : (week >= 9 ? 0xffff_ffff : 1), 196);
    bytes.writeUInt32LE(live && winner !== null ? 0 : (week >= 9 ? 0xffff_ffff : 0), 200);
    bytes[204] = live && winner !== null
      ? IAT_V2_ROUND_STATUS.SETTLED
      : (week >= 9 ? IAT_V2_ROUND_STATUS.EXPIRED_NEUTRAL : IAT_V2_ROUND_STATUS.SETTLED);
    bytes[205] = migrated ? 253 : 0;
    return owned(IAT_V2_PROGRAM_ID, bytes);
  });
  const core = Buffer.alloc(113);
  configAddress.toBuffer().copy(core, 8);
  core.writeBigUInt64LE(100_000_000_000n, 40);
  core.writeBigUInt64LE(1_700n, 48);
  core.writeBigUInt64LE(104n, 56);
  core.writeBigUInt64LE(33_673_076_924n, 64);
  core.writeBigUInt64LE(326_923_076n, 88);
  core.writeBigUInt64LE(1n, 96);
  const totalPositionPaid = paid.reduce((sum, amount) => sum + amount, 0n);
  const treasuryPaid = 326_923_076n + totalPositionPaid;
  const treasuryReserved = 33_673_076_924n
    + maximum.reduce((sum, amount, index) => sum + amount - paid[index], 0n);
  const exactLanes = [
    [200_000_000_000n, 50_000_000_000n, 52n, 208n, treasuryReserved, treasuryPaid, 0n, 1, 1],
    [150_000_000_000n, 37_500_000_000n, 26n, 104n, 0n, 0n, 0n, 2, 1],
    [100_000_000_000n, 0n, 26n, 104n, 0n, 0n, 0n, 3, 0],
    [50_000_000_000n, 12_500_000_000n, 26n, 104n, 0n, 0n, 12_500_000_000n, 4, 1],
  ];
  const laneStates = exactLanes.map((values, index) => {
    const bytes = Buffer.alloc(164);
    configAddress.toBuffer().copy(bytes, 8);
    plan.lanes[["treasury", "ecosystem", "coreTeam", "liquidity"][index]].tokenAccount.toBuffer().copy(bytes, 40);
    values.slice(0, 7).forEach((amount, valueIndex) => bytes.writeBigUInt64LE(amount, 104 + valueIndex * 8));
    bytes[160] = values[7];
    bytes[161] = values[8];
    return owned(IAT_V2_PROGRAM_ID, bytes);
  });
  const laneAmounts = [
    200_000_000_000n - treasuryPaid,
    150_000_000_000n,
    100_000_000_000n,
    37_500_000_000n,
  ];
  const laneTokens = laneAmounts.map((amount) => tokenAccount(
    mint,
    plan.vaultAuthority,
    amount,
  ));
  return [
    owned(TOKEN_PROGRAM_ID, mintBytes),
    owned(IAT_V2_PROGRAM_ID, config),
    ...positions,
    ...rounds,
    owned(IAT_V2_PROGRAM_ID, core),
    ...laneStates,
    ...laneTokens,
    tokenAccount(mint, plan.vaultAuthority, 30_000_000_000n),
    tokenAccount(mint, IAT_V2_PROGRAM_ADMIN, 470_000_000_000n + totalPositionPaid),
    tokenAccount(mint, new PublicKey("2yBK1NkeUoTToE4cfz33WRckho4Qr2BV1ZtCTrw3AHyB"), 326_923_076n),
    tokenAccount(mint, new PublicKey("2d41i3afUpWuo2LqpuKao5D1ToEU88aBokiQ3z8HQtPC"), 12_500_000_000n),
    owned(SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID, Buffer.alloc(64, 1)),
  ];
}

test("complete decoder admits the exact reviewed fresh-randomness expiry roster wire semantics", async () => {
  const value = await exactRoster();
  const decoded = await decodeCompleteRehearsalRoster(value);
  assert.equal(decoded.transactionCount, 21);
  assert.equal(decoded.policyWeek, 13);
  assert.equal(decoded.cccRound, 12);
  assert.ok(decoded.oracle);
  assert.ok(decoded.randomness);
  assert.equal(decoded.wireSemantics, "EXACT_DISCRIMINATOR_DATA_ACCOUNT_METAS_AND_CANONICAL_IDENTITIES");
});

test("complete decoder admits exact Switchboard creation and reveal wire semantics", async () => {
  const value = await exactRoster({ createRandomness: true, reveal: true });
  const decoded = await decodeCompleteRehearsalRoster(value);
  assert.equal(decoded.transactionCount, 21);
  assert.ok(decoded.oracle);
  assert.ok(decoded.randomness);
});

test("complete decoder rejects the old no-create randomness shortcut", async () => {
  const value = await exactRoster({ createRandomness: false });
  await assert.rejects(
    decodeCompleteRehearsalRoster(value),
    (error) => error instanceof CurrentSourceClearanceError && error.code === "COMPLETE_ROSTER_HOLD",
  );
});

test("complete decoder rejects temporal-horizon and terminal-branch substitution", async (t) => {
  await t.test("policy week drift", async () => {
    const value = await exactRoster();
    value.conditions.policyWeek = 12;
    await assert.rejects(
      decodeCompleteRehearsalRoster(value),
      (error) => error instanceof CurrentSourceClearanceError && error.code === "COMPLETE_ROSTER_HOLD",
    );
  });
  await t.test("CCC round drift", async () => {
    const value = await exactRoster();
    value.conditions.cccRound = 13;
    await assert.rejects(
      decodeCompleteRehearsalRoster(value),
      (error) => error instanceof CurrentSourceClearanceError && error.code === "COMPLETE_ROSTER_HOLD",
    );
  });
  await t.test("declared reveal with expiry wire", async () => {
    const value = await exactRoster();
    value.conditions.cccRoundTerminalAction = "REVEAL_CCC_ROUND_12";
    await assert.rejects(
      decodeCompleteRehearsalRoster(value),
      (error) => error instanceof CurrentSourceClearanceError && error.code === "COMPLETE_ROSTER_HOLD",
    );
  });
});

test("wire decoder rejects mislabeled actions and mutated discriminators/account identities", async (t) => {
  await t.test("mislabeled position semantics", async () => {
    const value = await exactRoster();
    value.entries[10].action = "SETTLE_LINKED_POSITION_3_WEEK_9";
    await assert.rejects(decodeCompleteRehearsalRoster(value), (error) => error instanceof CurrentSourceClearanceError && error.code === "WIRE_ACCOUNTS_HOLD");
  });
  await t.test("backfill previous-round account", async () => {
    const value = await exactRoster();
    value.entries[3].transaction.instructions[0].keys[3].pubkey = Keypair.generate().publicKey;
    await assert.rejects(decodeCompleteRehearsalRoster(value), (error) => error instanceof CurrentSourceClearanceError && error.code === "WIRE_ACCOUNTS_HOLD");
  });
  await t.test("backfill week bytes", async () => {
    const value = await exactRoster();
    value.entries[4].transaction.instructions[0].data.writeBigUInt64LE(9n, 8);
    await assert.rejects(decodeCompleteRehearsalRoster(value), (error) => error instanceof CurrentSourceClearanceError && error.code === "WIRE_DATA_HOLD");
  });
  await t.test("Switchboard commit discriminator", async () => {
    const value = await exactRoster();
    const commit = value.entries.find((entry) => entry.action === "COMMIT_CCC_ROUND_12");
    commit.transaction.instructions[1].data[0] ^= 0xff;
    await assert.rejects(decodeCompleteRehearsalRoster(value), (error) => error instanceof CurrentSourceClearanceError && error.code === "WIRE_DATA_HOLD");
  });
});

test("clearance reward oracle mirrors Rust cumulative-difference reward_for_week semantics", () => {
  const policySource = readFileSync(
    new URL("../programs/iat_v2/src/policy.rs", import.meta.url),
    "utf8",
  );
  assert.match(
    policySource,
    /pub fn reward_for_week[\s\S]*let after = maximum_reward[\s\S]*let before = maximum_reward[\s\S]*after\.checked_sub\(before\)/u,
  );
  assert.deepEqual(expectedPositionPaid("expired"), [
    115_384_615n,
    161_538_461n,
    76_923_076n,
  ]);
  assert.deepEqual(expectedPositionPaid("winner0"), [
    115_384_615n,
    134_615_384n,
    96_153_846n,
  ]);
  assert.deepEqual(expectedPositionPaid("winner1"), [
    115_384_615n,
    188_461_538n,
    57_692_307n,
  ]);
});

test("post-state verifier fails closed on absent finalized canonical accounts", async () => {
  const value = await exactRoster();
  const decoded = await decodeCompleteRehearsalRoster(value);
  await assert.rejects(
    observeCompleteRehearsalPostState({
      decoded,
      conditions: value.conditions,
      rpcCall: async () => ({ value: [] }),
    }),
    (error) => error instanceof CurrentSourceClearanceError && error.code === "POST_STATE_ACCOUNT_HOLD",
  );
});

test("post-state verifier admits only the complete exact finalized state and rejects balance/mask bypasses", async (t) => {
  const value = await exactRoster();
  const decoded = await decodeCompleteRehearsalRoster(value);
  const accounts = await exactPostState(decoded);
  const verify = (nextAccounts) => observeCompleteRehearsalPostState({
    decoded,
    conditions: value.conditions,
    rpcCall: async (method) => {
      assert.equal(method, "getMultipleAccounts");
      return { value: nextAccounts };
    },
  });
  const observed = await verify(accounts);
  assert.equal(observed.policyWeek, 13);
  assert.equal(observed.cccRound, 12);
  assert.equal(observed.contextSlot, null);
  assert.deepEqual(observed.positionSettledMasks, ["63", "31", "31"]);
  assert.deepEqual(observed.positionPaid, ["115384615", "161538461", "76923076"]);
  assert.equal(observed.mintSupply, "1000000000000");

  await t.test("revealed winner 0 accounting", async () => {
    const revealValue = await exactRoster({ reveal: true });
    const revealDecoded = await decodeCompleteRehearsalRoster(revealValue);
    const revealAccounts = await exactPostState(revealDecoded, { outcome: "winner0" });
    const result = await observeCompleteRehearsalPostState({
      decoded: revealDecoded,
      conditions: revealValue.conditions,
      rpcCall: async () => ({ value: revealAccounts }),
    });
    assert.deepEqual(result.positionPaid, ["115384615", "134615384", "96153846"]);
    assert.equal(result.laneTokenAmounts[0], "199326923079");
    assert.equal(result.communityAmount, "470346153845");
  });

  await t.test("revealed winner 1 accounting", async () => {
    const revealValue = await exactRoster({ reveal: true });
    const revealDecoded = await decodeCompleteRehearsalRoster(revealValue);
    const revealAccounts = await exactPostState(revealDecoded, { outcome: "winner1" });
    const result = await observeCompleteRehearsalPostState({
      decoded: revealDecoded,
      conditions: revealValue.conditions,
      rpcCall: async () => ({ value: revealAccounts }),
    });
    assert.deepEqual(result.positionPaid, ["115384615", "188461538", "57692307"]);
    assert.equal(result.laneTokenAmounts[0], "199311538464");
    assert.equal(result.communityAmount, "470361538460");
  });

  await t.test("position settled mask", async () => {
    const mutated = structuredClone(accounts);
    const position = Buffer.from(mutated[2].data[0], "base64");
    position.writeBigUInt64LE(7n, 152);
    mutated[2].data[0] = position.toString("base64");
    await assert.rejects(verify(mutated), (error) => error instanceof CurrentSourceClearanceError && error.code === "POST_STATE_POSITION_HOLD");
  });
  await t.test("lane token conservation", async () => {
    const mutated = structuredClone(accounts);
    const token = Buffer.from(mutated[16].data[0], "base64");
    token.writeBigUInt64LE(token.readBigUInt64LE(64) + 1n, 64);
    mutated[16].data[0] = token.toString("base64");
    await assert.rejects(verify(mutated), (error) => error instanceof CurrentSourceClearanceError && error.code === "POST_STATE_BALANCE_HOLD");
  });
  await t.test("migrated week-7 commit slot", async () => {
    const mutated = structuredClone(accounts);
    const round = Buffer.from(mutated[5].data[0], "base64");
    round.writeBigUInt64LE(480_122_946n, 80);
    mutated[5].data[0] = round.toString("base64");
    await assert.rejects(verify(mutated), (error) => error instanceof CurrentSourceClearanceError && error.code === "POST_STATE_ROUND_HOLD");
  });
  await t.test("migrated week-8 preserved randomness", async () => {
    const mutated = structuredClone(accounts);
    const round = Buffer.from(mutated[6].data[0], "base64");
    round[96] ^= 0xff;
    mutated[6].data[0] = round.toString("base64");
    await assert.rejects(verify(mutated), (error) => error instanceof CurrentSourceClearanceError && error.code === "POST_STATE_ROUND_HOLD");
  });
  await t.test("migrated week-8 inserted timestamp", async () => {
    const mutated = structuredClone(accounts);
    const round = Buffer.from(mutated[6].data[0], "base64");
    round.writeBigInt64LE(1n, 88);
    mutated[6].data[0] = round.toString("base64");
    await assert.rejects(verify(mutated), (error) => error instanceof CurrentSourceClearanceError && error.code === "POST_STATE_ROUND_HOLD");
  });
  await t.test("post-state minContextSlot", async () => {
    await assert.rejects(
      observeCompleteRehearsalPostState({
        decoded,
        conditions: value.conditions,
        minContextSlot: 900,
        rpcCall: async () => ({ context: { slot: 899 }, value: accounts }),
      }),
      (error) => error instanceof CurrentSourceClearanceError && error.code === "POST_STATE_CONTEXT_HOLD",
    );
    const contextBound = await observeCompleteRehearsalPostState({
      decoded,
      conditions: value.conditions,
      minContextSlot: 900,
      rpcCall: async () => ({ context: { slot: 901 }, value: accounts }),
    });
    assert.equal(contextBound.contextSlot, 901);
  });
});
