import { createHash } from "node:crypto";
import {
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  createIatV2DeploymentPlan,
  derivePositionAddress,
  deriveRoundAddress,
} from "../../programs/iat_v2/client.mjs";
import {
  IAT_V2_ROUND_LAYOUT,
  IAT_V2_ROUND_STATUS,
  buildBackfillHistoricalNeutralRoundInstruction,
  buildCommitRoundInstruction,
  buildExpireRoundInstruction,
  buildMigrateLegacyRoundInstruction,
  buildSettlePositionWeekInstruction,
  buildSettleRoundInstruction,
  parseCoreRewardAccount,
  parseLaneVaultAccount,
  parsePositionAccount,
  parseRoundAccount,
} from "../../programs/iat_v2/feature-instructions.mjs";
import {
  IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS,
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
  IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP,
  IAT_V2_DEVNET_CEREMONY_LINKED_HISTORICAL_WEEKS,
  IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
  iatV2DevnetCeremonyTerminalActions,
} from "../../programs/iat_v2/ceremony-horizon.mjs";
import {
  BPF_UPGRADEABLE_LOADER_ID,
  DEVNET_FEATURE_MINT_SEED,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
  deriveDeterministicDevnetMint,
  parseV2ConfigAccount,
} from "../../programs/iat_v2/instructions.mjs";

const SWITCHBOARD_QUEUE = new PublicKey("EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7");
const CORE_BENEFICIARY = new PublicKey("2yBK1NkeUoTToE4cfz33WRckho4Qr2BV1ZtCTrw3AHyB");
const LIQUIDITY_BENEFICIARY = new PublicKey("2d41i3afUpWuo2LqpuKao5D1ToEU88aBokiQ3z8HQtPC");
const FEATURE_AGENCY_OWNERS = [
  new PublicKey("Ge2c3puY5YwsiLhFJWdoXpRbE55k7omLw37pvJVCBkja"),
  new PublicKey("HpqX8EU3FSEPwdurSE8PudsjzpcZLJoaVB8R1Y1HfC6X"),
];
const FEATURE_GENESIS_TIMESTAMP = BigInt(IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP);
const REHEARSAL_SUPPLY = 1_000_000_000_000n;
const POSITION_PRINCIPAL = 10_000_000_000n;
const POSITION_FIRST_ACCRUAL_WEEK = 8;
const STANDARD_POSITION_SETTLED_MASK =
  (1n << BigInt(IAT_V2_DEVNET_CEREMONY_POLICY_WEEK - POSITION_FIRST_ACCRUAL_WEEK + 1)) - 1n;
const LINKED_POSITION_SETTLED_MASK =
  (1n << BigInt(IAT_V2_DEVNET_CEREMONY_CCC_ROUND - POSITION_FIRST_ACCRUAL_WEEK + 1)) - 1n;
const CORE_WEEK_ZERO_PAID = 326_923_076n;
const CCC_TERMINAL_ACTIONS = iatV2DevnetCeremonyTerminalActions();
const CCC_COMMIT_ACTION = `COMMIT_CCC_ROUND_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`;
const CCC_REVEAL_ACTION = `REVEAL_CCC_ROUND_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`;
const CCC_EXPIRE_ACTION = `EXPIRE_CCC_ROUND_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`;
const RANDOMNESS_INIT_DISCRIMINATOR = Buffer.from("0909cc213274710f", "hex");
const RANDOMNESS_COMMIT_DISCRIMINATOR = Buffer.from("34aa98c9b385f28d", "hex");
const RANDOMNESS_REVEAL_DISCRIMINATOR = Buffer.from("c5b5bb0a1e3a1449", "hex");
// Immutable payloads copied from the finalized public snapshots
// v2-features-20260731T101732Z
// (SHA-256 4c81fe0dc4e5ec92bf8ac24d73e0c923eff02159d8f03674c13909c82b4d6b85)
// and v2-features-20260801T053340Z
// (SHA-256 7b460bee7a644452c6710cff7a5b81a3a3769a1d2daf4d3813913d7524a9b6f9).
const MIGRATED_LEGACY_ROUND_PINS = Object.freeze({
  7: Object.freeze({
    randomnessAccount: "Edfx7Zo289rkt4HczWsLK5TuUkoYbmHkr2rsirSEqEb8",
    commitSlot: 480_122_945n,
    commitTimestamp: 0n,
    randomnessHex: "3036d2bbcd0f00efffe055c20dbe272e9aa774039811957422f83362a4281cf0",
    agencyRegistryHashSnapshotHex: "66b3a3b1560a418eeeb8a073bc48300561bf2e468f246c8ff3bac64ed6fb80d0",
    decisionContextHex: "cbca6fbc6fce5f1050ab7d9391539a067ad51f2cf5a26c45b814c7b1f3b01374",
    agencyCountSnapshot: 2,
    selectedAgencyIndex: 1,
    derivationCounter: 0,
    status: IAT_V2_ROUND_STATUS.SETTLED,
    bump: 253,
  }),
  8: Object.freeze({
    randomnessAccount: "Edfx7Zo289rkt4HczWsLK5TuUkoYbmHkr2rsirSEqEb8",
    commitSlot: 480_373_914n,
    commitTimestamp: 0n,
    randomnessHex: "91edf1d6f8a02d17bc059c077fdb3bcf46712b0c3047eec490335e2eee38abf9",
    agencyRegistryHashSnapshotHex: "66b3a3b1560a418eeeb8a073bc48300561bf2e468f246c8ff3bac64ed6fb80d0",
    decisionContextHex: "92c2193b537a81e4d70f3067a6ee178d9d994a98577af8338e9637dedc67b664",
    agencyCountSnapshot: 2,
    selectedAgencyIndex: 1,
    derivationCounter: 0,
    status: IAT_V2_ROUND_STATUS.SETTLED,
    bump: 253,
  }),
});
const sha256 = (bytes) => createHash("sha256").update(bytes).digest();

export class CurrentSourceClearanceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CurrentSourceClearanceError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new CurrentSourceClearanceError(code, message);
}

function check(condition, code, message) {
  if (!condition) fail(code, message);
}

const address = (value) => value instanceof PublicKey ? value.toBase58() : new PublicKey(value).toBase58();
const meta = (pubkey, isSigner = false, isWritable = false) => ({
  pubkey: address(pubkey), isSigner, isWritable,
});

function normalizedExpectedKeys(instruction, { feePayer, additionalWritable = [] } = {}) {
  const payer = address(feePayer);
  const writable = new Set(additionalWritable.map(address));
  return instruction.keys.map((item) => {
    const pubkey = item.pubkey.toBase58();
    return meta(
      pubkey,
      item.isSigner || pubkey === payer,
      item.isWritable || pubkey === payer || writable.has(pubkey),
    );
  });
}

function assertInstruction(instruction, expected, label) {
  check(instruction.programId.toBase58() === address(expected.programId), "WIRE_PROGRAM_HOLD", `${label} program ID drifted`);
  check(Buffer.from(instruction.data).equals(Buffer.from(expected.data)), "WIRE_DATA_HOLD", `${label} instruction data drifted`);
  const actualKeys = instruction.keys.map((item) => meta(item.pubkey, item.isSigner, item.isWritable));
  check(JSON.stringify(actualKeys) === JSON.stringify(expected.keys), "WIRE_ACCOUNTS_HOLD", `${label} account metas drifted`);
}

function assertInstructionCount(transaction, count, label) {
  check(transaction.instructions.length === count, "WIRE_INSTRUCTION_COUNT_HOLD", `${label} must contain exactly ${count} instruction${count === 1 ? "" : "s"}`);
}

function assertSignerSet(transaction, signers, label) {
  const actual = transaction.signatures.map((entry) => entry.publicKey.toBase58());
  check(JSON.stringify(actual) === JSON.stringify(signers.map(address)), "WIRE_SIGNERS_HOLD", `${label} signer set/order drifted`);
}

function assertExpectedIatInstruction(instruction, expectedInstruction, label, options = {}) {
  assertInstruction(instruction, {
    programId: expectedInstruction.programId,
    data: expectedInstruction.data,
    keys: normalizedExpectedKeys(expectedInstruction, options),
  }, label);
}

function computeBudgetInstruction(units) {
  const instruction = ComputeBudgetProgram.setComputeUnitLimit({ units });
  return {
    programId: instruction.programId,
    data: instruction.data,
    keys: [],
  };
}

function switchboardState() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("STATE")],
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  )[0];
}

function lutSigner(randomness) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("LutSigner"), randomness.toBuffer()],
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  )[0];
}

function lutAddress(signer, recentSlot) {
  return AddressLookupTableProgram.createLookupTable({
    authority: signer,
    payer: PublicKey.default,
    recentSlot,
  })[1];
}

function statsAddress(oracle) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("OracleRandomnessStats"), oracle.toBuffer()],
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  )[0];
}

function assertCreateRandomness(transaction, context) {
  assertInstructionCount(transaction, 2, "CREATE_SWITCHBOARD_RANDOMNESS");
  const randomness = transaction.signatures[1]?.publicKey;
  check(randomness instanceof PublicKey, "WIRE_SIGNERS_HOLD", "randomness creation requires the ephemeral account signer");
  assertSignerSet(transaction, [context.signer, randomness], "CREATE_SWITCHBOARD_RANDOMNESS");
  assertInstruction(transaction.instructions[0], computeBudgetInstruction(500_000), "randomness-create compute budget");
  const instruction = transaction.instructions[1];
  check(instruction.data.length === 16 && instruction.data.subarray(0, 8).equals(RANDOMNESS_INIT_DISCRIMINATOR), "WIRE_DATA_HOLD", "randomness-init data/discriminator drifted");
  const recentSlotBig = instruction.data.readBigUInt64LE(8);
  check(recentSlotBig > 0n && recentSlotBig <= BigInt(Number.MAX_SAFE_INTEGER), "WIRE_DATA_HOLD", "randomness-init recent slot is invalid");
  const signer = lutSigner(randomness);
  const lut = lutAddress(signer, Number(recentSlotBig));
  const rewardEscrow = getAssociatedTokenAddressSync(NATIVE_MINT, randomness);
  assertInstruction(instruction, {
    programId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    data: instruction.data,
    keys: [
      meta(randomness, true, true),
      meta(SWITCHBOARD_QUEUE, false, true),
      meta(context.signer, true, true),
      meta(context.signer, true, true),
      meta(rewardEscrow, false, true),
      meta(SystemProgram.programId),
      meta(TOKEN_PROGRAM_ID),
      meta(ASSOCIATED_TOKEN_PROGRAM_ID),
      meta(NATIVE_MINT),
      meta(switchboardState()),
      meta(signer),
      meta(lut, false, true),
      meta(AddressLookupTableProgram.programId),
    ],
  }, "randomness-init");
  context.randomness = randomness;
}

function assertSwitchboardCommit(instruction, context) {
  check(instruction.data.equals(RANDOMNESS_COMMIT_DISCRIMINATOR), "WIRE_DATA_HOLD", "randomness-commit discriminator/data drifted");
  const oracle = instruction.keys[2]?.pubkey;
  check(oracle instanceof PublicKey, "WIRE_ACCOUNTS_HOLD", "randomness-commit oracle is missing");
  assertInstruction(instruction, {
    programId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    data: RANDOMNESS_COMMIT_DISCRIMINATOR,
    keys: [
      meta(context.randomness, false, true),
      meta(SWITCHBOARD_QUEUE),
      meta(oracle, false, true),
      meta(SYSVAR_SLOT_HASHES_PUBKEY),
      meta(context.signer, true, true),
    ],
  }, "randomness-commit");
  context.oracle = oracle;
}

function assertSwitchboardReveal(instruction, context) {
  check(instruction.data.length === 105 && instruction.data.subarray(0, 8).equals(RANDOMNESS_REVEAL_DISCRIMINATOR), "WIRE_DATA_HOLD", "randomness-reveal data layout/discriminator drifted");
  check(instruction.data[72] <= 3, "WIRE_DATA_HOLD", "randomness-reveal recovery ID is invalid");
  check(instruction.data.subarray(73).some((byte) => byte !== 0), "WIRE_DATA_HOLD", "randomness-reveal value is all zero");
  const rewardEscrow = getAssociatedTokenAddressSync(NATIVE_MINT, context.randomness);
  assertInstruction(instruction, {
    programId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    data: instruction.data,
    keys: [
      meta(context.randomness, false, true),
      meta(context.oracle),
      meta(SWITCHBOARD_QUEUE),
      meta(statsAddress(context.oracle), false, true),
      meta(context.signer, true, true),
      meta(context.signer, true, true),
      meta(SYSVAR_SLOT_HASHES_PUBKEY),
      meta(SystemProgram.programId),
      meta(rewardEscrow, false, true),
      meta(TOKEN_PROGRAM_ID),
      meta(NATIVE_MINT),
      meta(switchboardState()),
    ],
  }, "randomness-reveal");
}

function assertExtension(transaction, context, conditions) {
  assertInstructionCount(transaction, 1, "EXTEND_PROGRAM_DATA");
  assertSignerSet(transaction, [context.signer], "EXTEND_PROGRAM_DATA");
  const instruction = transaction.instructions[0];
  const additionalBytes = context.artifactBytes - conditions.preUpgradeProgramDataCapacityBytes;
  check(additionalBytes > 0 && additionalBytes <= 0xffff_ffff, "WIRE_DATA_HOLD", "extension byte delta is invalid");
  const discriminant = instruction.data.readUInt32LE(0);
  check(instruction.data.length === 8 && [6, 9].includes(discriminant) && instruction.data.readUInt32LE(4) === additionalBytes, "WIRE_DATA_HOLD", "extension loader data drifted");
  const checked = discriminant === 9;
  assertInstruction(instruction, {
    programId: BPF_UPGRADEABLE_LOADER_ID,
    data: instruction.data,
    keys: checked
      ? [
          meta(IAT_V2_PROGRAM_DATA_ADDRESS, false, true),
          meta(IAT_V2_PROGRAM_ID, false, true),
          meta(context.signer, true, true),
          meta(SystemProgram.programId),
          meta(context.signer, true, true),
        ]
      : [
          meta(IAT_V2_PROGRAM_DATA_ADDRESS, false, true),
          meta(IAT_V2_PROGRAM_ID, false, true),
          meta(SystemProgram.programId),
          meta(context.signer, true, true),
        ],
  }, "ProgramData extension");
}

function assertUpgrade(transaction, context) {
  assertInstructionCount(transaction, 1, "UPGRADE_PROGRAM");
  assertSignerSet(transaction, [context.signer], "UPGRADE_PROGRAM");
  const instruction = transaction.instructions[0];
  check(instruction.keys[2]?.pubkey instanceof PublicKey, "WIRE_ACCOUNTS_HOLD", "upgrade buffer is missing");
  assertInstruction(instruction, {
    programId: BPF_UPGRADEABLE_LOADER_ID,
    data: Buffer.from([3, 0, 0, 0]),
    keys: [
      meta(IAT_V2_PROGRAM_DATA_ADDRESS, false, true),
      meta(IAT_V2_PROGRAM_ID, false, true),
      meta(instruction.keys[2].pubkey, false, true),
      meta(context.signer, true, true),
      meta(SYSVAR_RENT_PUBKEY),
      meta(SYSVAR_CLOCK_PUBKEY),
      meta(context.signer, true, true),
    ],
  }, "program upgrade");
  context.buffer = instruction.keys[2].pubkey;
}

function parseActionNumber(action, pattern, label) {
  const match = pattern.exec(action);
  check(match, "ROSTER_ACTION_HOLD", `${label} action ID is malformed`);
  return Number(match[1]);
}

function assertOneIatInstruction(transaction, expected, label, context, options = {}) {
  assertInstructionCount(transaction, 1, label);
  assertSignerSet(transaction, [context.signer], label);
  assertExpectedIatInstruction(transaction.instructions[0], expected, label, {
    feePayer: context.signer,
    ...options,
  });
}

export async function decodeCompleteRehearsalRoster({ entries, artifactBytes, conditions }) {
  check(
    conditions?.switchboardRandomnessCreationRequired === true,
    "COMPLETE_ROSTER_HOLD",
    "the canonical rehearsal requires a fresh source-bound Switchboard randomness creation receipt",
  );
  check(
    conditions?.policyWeek === IAT_V2_DEVNET_CEREMONY_POLICY_WEEK
    && conditions?.cccRound === IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
    "COMPLETE_ROSTER_HOLD",
    "the complete roster does not carry the exact source-frozen policy/CCC horizon",
  );
  check(
    CCC_TERMINAL_ACTIONS.includes(conditions?.cccRoundTerminalAction),
    "COMPLETE_ROSTER_HOLD",
    `the complete roster requires exactly one reviewed round ${IAT_V2_DEVNET_CEREMONY_CCC_ROUND} terminal action`,
  );
  const signer = IAT_V2_PROGRAM_ADMIN;
  const mint = await deriveDeterministicDevnetMint({ seed: DEVNET_FEATURE_MINT_SEED });
  const plan = createIatV2DeploymentPlan({
    network: "devnet",
    mint,
    programId: IAT_V2_PROGRAM_ID,
    randomnessProgramId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    rehearsal: true,
  });
  const context = {
    signer,
    mint,
    plan,
    artifactBytes,
    randomness: null,
    randomnessCreated: false,
    oracle: null,
    buffer: null,
  };

  for (const entry of entries) {
    const { action, transaction } = entry;
    if (action === "EXTEND_PROGRAM_DATA") {
      assertExtension(transaction, context, conditions);
    } else if (action === "UPGRADE_PROGRAM") {
      assertUpgrade(transaction, context);
    } else if (action.startsWith("MIGRATE_LEGACY_ROUND_WEEK_")) {
      const week = parseActionNumber(action, /^MIGRATE_LEGACY_ROUND_WEEK_([0-9]+)$/u, "migration");
      assertOneIatInstruction(transaction, buildMigrateLegacyRoundInstruction({ mint, week }), action, context);
    } else if (action.startsWith("BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_")) {
      const week = parseActionNumber(action, /^BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_([0-9]+)$/u, "backfill");
      assertOneIatInstruction(transaction, buildBackfillHistoricalNeutralRoundInstruction({ mint, week }), action, context);
    } else if (action.startsWith("SETTLE_STANDARD_POSITION_WEEK_")) {
      const week = parseActionNumber(action, /^SETTLE_STANDARD_POSITION_WEEK_([0-9]+)$/u, "standard settlement");
      const expected = buildSettlePositionWeekInstruction({
        caller: signer,
        mint,
        positionOwner: signer,
        positionId: 1,
        destinationTokens: plan.allocationDestinations.community.tokenAccount,
        week,
      });
      assertOneIatInstruction(transaction, expected, action, context);
    } else if (action.startsWith("SETTLE_LINKED_POSITION_")) {
      const match = /^SETTLE_LINKED_POSITION_([23])_WEEK_([0-9]+)$/u.exec(action);
      check(match, "ROSTER_ACTION_HOLD", "linked settlement action ID is malformed");
      const positionId = Number(match[1]);
      const week = Number(match[2]);
      const expected = buildSettlePositionWeekInstruction({
        caller: signer,
        mint,
        positionOwner: signer,
        positionId,
        destinationTokens: plan.allocationDestinations.community.tokenAccount,
        week,
        round: deriveRoundAddress({ config: plan.config, programId: IAT_V2_PROGRAM_ID, week }),
      });
      assertOneIatInstruction(transaction, expected, action, context);
    } else if (action === "CREATE_SWITCHBOARD_RANDOMNESS") {
      assertCreateRandomness(transaction, context);
      context.randomnessCreated = true;
    } else if (action === CCC_COMMIT_ACTION) {
      assertInstructionCount(transaction, 3, action);
      assertSignerSet(transaction, [context.signer], action);
      assertInstruction(transaction.instructions[0], computeBudgetInstruction(500_000), "commit compute budget");
      const iat = transaction.instructions[2];
      const randomness = iat.keys[2]?.pubkey;
      check(randomness instanceof PublicKey, "WIRE_ACCOUNTS_HOLD", "commit randomness account is missing");
      if (context.randomness) check(context.randomness.equals(randomness), "WIRE_ACCOUNTS_HOLD", "created and committed randomness accounts differ");
      context.randomness = randomness;
      assertSwitchboardCommit(transaction.instructions[1], context);
      const expected = buildCommitRoundInstruction({
        payer: signer,
        mint,
        randomnessAccount: randomness,
        week: IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
      });
      assertExpectedIatInstruction(iat, expected, action, { feePayer: signer, additionalWritable: [randomness] });
    } else if (action === CCC_REVEAL_ACTION) {
      check(
        conditions.cccRoundTerminalAction === action,
        "COMPLETE_ROSTER_HOLD",
        "decoded reveal action disagrees with the declared CCC terminal branch",
      );
      assertInstructionCount(transaction, 3, action);
      assertSignerSet(transaction, [context.signer], action);
      check(context.randomness && context.oracle, "WIRE_ACCOUNTS_HOLD", "reveal is not chained to the exact commit");
      assertInstruction(transaction.instructions[0], computeBudgetInstruction(600_000), "reveal compute budget");
      assertSwitchboardReveal(transaction.instructions[1], context);
      const expected = buildSettleRoundInstruction({
        mint,
        randomnessAccount: context.randomness,
        week: IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
      });
      assertExpectedIatInstruction(transaction.instructions[2], expected, action, {
        feePayer: signer,
        additionalWritable: [context.randomness],
      });
    } else if (action === CCC_EXPIRE_ACTION) {
      check(
        conditions.cccRoundTerminalAction === action,
        "COMPLETE_ROSTER_HOLD",
        "decoded expiry action disagrees with the declared CCC terminal branch",
      );
      assertOneIatInstruction(
        transaction,
        buildExpireRoundInstruction({ mint, week: IAT_V2_DEVNET_CEREMONY_CCC_ROUND }),
        action,
        context,
      );
    } else {
      fail("ROSTER_ACTION_HOLD", `unreviewed complete-roster action: ${action}`);
    }
  }
  check(context.randomnessCreated === true, "COMPLETE_ROSTER_HOLD", "complete roster omitted the mandatory fresh randomness creation");
  check(context.randomness instanceof PublicKey, "WIRE_ACCOUNTS_HOLD", "complete roster did not bind a randomness account");
  return Object.freeze({
    mint: mint.toBase58(),
    config: plan.config.toBase58(),
    policyWeek: IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
    cccRound: IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
    randomness: context.randomness.toBase58(),
    oracle: context.oracle?.toBase58() ?? null,
    buffer: context.buffer?.toBase58() ?? null,
    transactionCount: entries.length,
    wireSemantics: "EXACT_DISCRIMINATOR_DATA_ACCOUNT_METAS_AND_CANONICAL_IDENTITIES",
  });
}

function decodedAccount(value, expectedOwner, label) {
  check(value && Array.isArray(value.data) && value.data[1] === "base64", "POST_STATE_ACCOUNT_HOLD", `${label} is missing`);
  check(value.owner === address(expectedOwner), "POST_STATE_ACCOUNT_HOLD", `${label} owner drifted`);
  return Buffer.from(value.data[0], "base64");
}

function parseTokenAccount(data, mint, owner, label) {
  check(data.length === 165, "POST_STATE_BALANCE_HOLD", `${label} token account length drifted`);
  check(new PublicKey(data.subarray(0, 32)).equals(mint), "POST_STATE_BALANCE_HOLD", `${label} mint drifted`);
  check(new PublicKey(data.subarray(32, 64)).equals(owner), "POST_STATE_BALANCE_HOLD", `${label} owner drifted`);
  return data.readBigUInt64LE(64);
}

function tiebreakContext(config, week, registryHash) {
  const weekBytes = Buffer.alloc(8);
  weekBytes.writeBigUInt64LE(BigInt(week));
  return sha256(Buffer.concat([
    Buffer.from("IAT_CCC_WEEKLY_TIEBREAK_V1"),
    config.toBuffer(),
    weekBytes,
    registryHash,
  ]));
}

function exactAgencyRegistryHash() {
  let current = Buffer.alloc(32);
  for (let index = 0; index < FEATURE_AGENCY_OWNERS.length; index += 1) {
    const indexBytes = Buffer.alloc(4);
    indexBytes.writeUInt32LE(index);
    current = sha256(Buffer.concat([
      Buffer.from("IAT_AGENCY_REGISTRY_V1"),
      current,
      indexBytes,
      FEATURE_AGENCY_OWNERS[index].toBuffer(),
    ]));
  }
  return current;
}

function assertRoundCommon(round, { config, registryHash, week }) {
  check(round.layoutVersion === IAT_V2_ROUND_LAYOUT.HARDENED_V2 && round.accountBytes === 206, "POST_STATE_ROUND_HOLD", `round ${week} is not hardened V2`);
  check(round.config.equals(config) && round.week === BigInt(week), "POST_STATE_ROUND_HOLD", `round ${week} identity drifted`);
  check(round.agencyCountSnapshot === 2 && round.agencyRegistryHashSnapshot.equals(registryHash), "POST_STATE_ROUND_HOLD", `round ${week} agency snapshot drifted`);
  check(round.decisionContext.equals(tiebreakContext(config, week, registryHash)), "POST_STATE_ROUND_HOLD", `round ${week} decision context drifted`);
}

function assertMigratedLegacyRoundPayload(round, week) {
  const pin = MIGRATED_LEGACY_ROUND_PINS[week];
  check(pin, "POST_STATE_ROUND_HOLD", `migrated round ${week} has no reviewed payload pin`);
  check(
    round.randomnessAccount.equals(new PublicKey(pin.randomnessAccount))
    && round.commitSlot === pin.commitSlot
    && round.commitTimestamp === pin.commitTimestamp
    && round.randomness.equals(Buffer.from(pin.randomnessHex, "hex"))
    && round.agencyRegistryHashSnapshot.equals(Buffer.from(pin.agencyRegistryHashSnapshotHex, "hex"))
    && round.decisionContext.equals(Buffer.from(pin.decisionContextHex, "hex"))
    && round.agencyCountSnapshot === pin.agencyCountSnapshot
    && round.selectedAgencyIndex === pin.selectedAgencyIndex
    && round.derivationCounter === pin.derivationCounter
    && round.status === pin.status
    && round.bump === pin.bump,
    "POST_STATE_ROUND_HOLD",
    `migrated round ${week} payload differs from the exact finalized legacy record`,
  );
}

function maximumPositionReward(annualRateBps, accruedWeeks) {
  return POSITION_PRINCIPAL
    * BigInt(annualRateBps)
    * BigInt(accruedWeeks)
    / (10_000n * 52n);
}

function positionRewardForOrdinal(annualRateBps, ordinal) {
  return maximumPositionReward(annualRateBps, ordinal + 1)
    - maximumPositionReward(annualRateBps, ordinal);
}

function neutralTwoAgencyReward(fullReward) {
  return fullReward / 2n;
}

function paidOutcome(round) {
  const standard = maximumPositionReward(
    1_000,
    IAT_V2_DEVNET_CEREMONY_POLICY_WEEK - POSITION_FIRST_ACCRUAL_WEEK + 1,
  );
  const linkedHistoricalOrdinals = IAT_V2_DEVNET_CEREMONY_LINKED_HISTORICAL_WEEKS
    .map((week) => week - POSITION_FIRST_ACCRUAL_WEEK);
  const agentBeforeCurrentRound = positionRewardForOrdinal(2_800, 0)
    + linkedHistoricalOrdinals.reduce(
      (sum, ordinal) => sum + neutralTwoAgencyReward(positionRewardForOrdinal(2_800, ordinal)),
      0n,
    );
  const associateBeforeCurrentRound = linkedHistoricalOrdinals.reduce(
    (sum, ordinal) => sum + neutralTwoAgencyReward(positionRewardForOrdinal(2_000, ordinal)),
    0n,
  );
  const currentOrdinal = IAT_V2_DEVNET_CEREMONY_CCC_ROUND - POSITION_FIRST_ACCRUAL_WEEK;
  const agentFull = positionRewardForOrdinal(2_800, currentOrdinal);
  const associateFull = positionRewardForOrdinal(2_000, currentOrdinal);
  if (round.status === IAT_V2_ROUND_STATUS.EXPIRED_NEUTRAL) {
    return {
      standard,
      agent: agentBeforeCurrentRound + neutralTwoAgencyReward(agentFull),
      associate: associateBeforeCurrentRound + neutralTwoAgencyReward(associateFull),
    };
  }
  check(
    round.status === IAT_V2_ROUND_STATUS.SETTLED && [0, 1].includes(round.selectedAgencyIndex),
    "POST_STATE_ROUND_HOLD",
    `round ${IAT_V2_DEVNET_CEREMONY_CCC_ROUND} terminal winner is invalid`,
  );
  return round.selectedAgencyIndex === 0
    ? { standard, agent: agentBeforeCurrentRound, associate: associateBeforeCurrentRound + associateFull }
    : { standard, agent: agentBeforeCurrentRound + agentFull, associate: associateBeforeCurrentRound };
}

function assertExactTwoAgencyTiebreak(round) {
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(0);
  const sample = sha256(Buffer.concat([
    Buffer.from("IAT_TIEBREAK_V1"),
    round.decisionContext,
    round.randomness,
    counter,
  ]));
  const expectedIndex = sample[31] % 2;
  check(
    round.derivationCounter === 0 && round.selectedAgencyIndex === expectedIndex,
    "POST_STATE_ROUND_HOLD",
    `round ${IAT_V2_DEVNET_CEREMONY_CCC_ROUND} selected agency does not replay the exact two-agency uniform tiebreak`,
  );
}

function parseMintAccount(data) {
  check(data.length === 82, "POST_STATE_BALANCE_HOLD", "mint account length drifted");
  check(data.readUInt32LE(0) === 0 && data.readUInt32LE(46) === 0, "POST_STATE_CONFIG_HOLD", "mint or freeze authority was not revoked");
  check(data.readBigUInt64LE(36) === REHEARSAL_SUPPLY, "POST_STATE_BALANCE_HOLD", "mint supply drifted");
  check(data[44] === 9 && data[45] === 1, "POST_STATE_CONFIG_HOLD", "mint decimals/initialization drifted");
  return data.readBigUInt64LE(36);
}

export async function observeCompleteRehearsalPostState({ rpcCall, decoded, conditions, minContextSlot = null }) {
  const mint = new PublicKey(decoded.mint);
  const configAddress = new PublicKey(decoded.config);
  const signer = IAT_V2_PROGRAM_ADMIN;
  const plan = createIatV2DeploymentPlan({
    network: "devnet",
    mint,
    programId: IAT_V2_PROGRAM_ID,
    randomnessProgramId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    rehearsal: true,
  });
  const positionAddresses = [1, 2, 3].map((positionId) => derivePositionAddress({
    config: configAddress, programId: IAT_V2_PROGRAM_ID, owner: signer, positionId,
  }));
  const roundWeeks = Array.from(
    { length: IAT_V2_DEVNET_CEREMONY_CCC_ROUND - 7 + 1 },
    (_unused, index) => index + 7,
  );
  const roundAddresses = roundWeeks.map((week) => deriveRoundAddress({
    config: configAddress, programId: IAT_V2_PROGRAM_ID, week,
  }));
  const laneNames = ["treasury", "ecosystem", "coreTeam", "liquidity"];
  const coreDestination = getAssociatedTokenAddressSync(mint, CORE_BENEFICIARY);
  const liquidityDestination = getAssociatedTokenAddressSync(mint, LIQUIDITY_BENEFICIARY);
  const addresses = [
    mint,
    configAddress,
    ...positionAddresses,
    ...roundAddresses,
    plan.coreReward,
    ...laneNames.map((name) => plan.lanes[name].state),
    ...laneNames.map((name) => plan.lanes[name].tokenAccount),
    plan.stakeTokenAccount,
    plan.allocationDestinations.community.tokenAccount,
    coreDestination,
    liquidityDestination,
    new PublicKey(decoded.randomness),
  ];
  const result = await rpcCall("getMultipleAccounts", [
    addresses.map((item) => item.toBase58()),
    {
      commitment: "finalized",
      encoding: "base64",
      ...(minContextSlot === null ? {} : { minContextSlot }),
    },
  ]);
  const contextSlot = Number.isSafeInteger(result?.context?.slot)
    ? result.context.slot
    : null;
  if (minContextSlot !== null) {
    check(
      contextSlot !== null && contextSlot >= minContextSlot,
      "POST_STATE_CONTEXT_HOLD",
      "finalized post-state context slot is absent or below minContextSlot",
    );
  }
  check(Array.isArray(result?.value) && result.value.length === addresses.length, "POST_STATE_ACCOUNT_HOLD", "finalized post-state account response is incomplete");
  let cursor = 0;
  const mintSupply = parseMintAccount(decodedAccount(result.value[cursor++], TOKEN_PROGRAM_ID, "mint"));
  const config = parseV2ConfigAccount(decodedAccount(result.value[cursor++], IAT_V2_PROGRAM_ID, "config"));
  check(config.admin.equals(signer) && config.mint.equals(mint), "POST_STATE_CONFIG_HOLD", "config admin/mint drifted");
  check(config.tokenProgram.equals(TOKEN_PROGRAM_ID) && config.randomnessProgram.equals(SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID), "POST_STATE_CONFIG_HOLD", "config program identities drifted");
  check(config.stakeTokenAccount.equals(plan.stakeTokenAccount), "POST_STATE_CONFIG_HOLD", "config stake vault drifted");
  check(config.genesisTimestamp === FEATURE_GENESIS_TIMESTAMP && config.expectedSupply === REHEARSAL_SUPPLY, "POST_STATE_CONFIG_HOLD", "config genesis/supply drifted");
  check(config.stakedPrincipal === 30_000_000_000n && config.agencyCount === 2, "POST_STATE_CONFIG_HOLD", "config stake/agency totals drifted");
  check(config.agencyRegistryHash.equals(exactAgencyRegistryHash()), "POST_STATE_CONFIG_HOLD", "config agency registry hash drifted");
  check(config.rehearsalMode && config.active && config.laneMask === 0b1_1110 && config.stakeVaultInitialized, "POST_STATE_CONFIG_HOLD", "config feature gates drifted");

  const positions = positionAddresses.map((_item, index) => parsePositionAccount(
    decodedAccount(result.value[cursor++], IAT_V2_PROGRAM_ID, `position ${index + 1}`),
  ));
  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    check(position.config.equals(configAddress) && position.owner.equals(signer) && position.positionId === BigInt(index + 1), "POST_STATE_POSITION_HOLD", `position ${index + 1} identity drifted`);
    check(position.principal === POSITION_PRINCIPAL && position.acceptedWeek === 7n && position.firstAccrualWeek === 8n && position.termWeeks === 52n, "POST_STATE_POSITION_HOLD", `position ${index + 1} terms drifted`);
    const expectedMask = index === 0 ? STANDARD_POSITION_SETTLED_MASK : LINKED_POSITION_SETTLED_MASK;
    check(
      position.settledMask === expectedMask,
      "POST_STATE_POSITION_HOLD",
      `position ${index + 1} settled mask is not exactly ${expectedMask}`,
    );
    check(!position.principalReturned && !position.closed, "POST_STATE_POSITION_HOLD", `position ${index + 1} lifecycle drifted`);
  }
  check(positions[0].role === 0 && positions[0].agencyIndex === 0xffff_ffff && positions[0].annualRateBps === 1_000n, "POST_STATE_POSITION_HOLD", "standard position role/rate drifted");
  check(positions[1].role === 1 && positions[1].agencyIndex === 0 && positions[1].annualRateBps === 2_800n, "POST_STATE_POSITION_HOLD", "CCC-agent position role/rate drifted");
  check(positions[2].role === 2 && positions[2].agencyIndex === 1 && positions[2].annualRateBps === 2_000n, "POST_STATE_POSITION_HOLD", "CCC-associate position role/rate drifted");

  const rounds = roundAddresses.map((_item, index) => parseRoundAccount(
    decodedAccount(result.value[cursor++], IAT_V2_PROGRAM_ID, `round ${index + 7}`),
  ));
  rounds.forEach((round, index) => assertRoundCommon(round, {
    config: configAddress,
    registryHash: config.agencyRegistryHash,
    week: index + 7,
  }));
  assertMigratedLegacyRoundPayload(rounds[0], 7);
  assertMigratedLegacyRoundPayload(rounds[1], 8);
  for (const week of IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS) {
    const index = week - 7;
    const round = rounds[index];
    const selectionTimestamp = FEATURE_GENESIS_TIMESTAMP + 86_400n + BigInt(week) * 604_800n;
    check(
      round.status === IAT_V2_ROUND_STATUS.EXPIRED_NEUTRAL
      && round.randomnessAccount.equals(SystemProgram.programId)
      && round.commitSlot === 0n
      && round.commitTimestamp === selectionTimestamp
      && round.randomness.every((byte) => byte === 0)
      && round.selectedAgencyIndex === 0xffff_ffff
      && round.derivationCounter === 0xffff_ffff,
      "POST_STATE_ROUND_HOLD",
      `historical neutral round ${week} markers drifted`,
    );
    check(round.agencyRegistryHashSnapshot.equals(rounds[index - 1].agencyRegistryHashSnapshot), "POST_STATE_ROUND_HOLD", `historical neutral round ${week} did not chain the prior snapshot`);
  }
  check(
    conditions?.policyWeek === IAT_V2_DEVNET_CEREMONY_POLICY_WEEK
    && conditions?.cccRound === IAT_V2_DEVNET_CEREMONY_CCC_ROUND
    && CCC_TERMINAL_ACTIONS.includes(conditions?.cccRoundTerminalAction),
    "POST_STATE_ROUND_HOLD",
    "post-state conditions drifted from the exact source-frozen ceremony horizon",
  );
  const currentRound = rounds[IAT_V2_DEVNET_CEREMONY_CCC_ROUND - 7];
  check(
    currentRound.randomnessAccount.equals(new PublicKey(decoded.randomness))
    && currentRound.commitSlot > 0n
    && currentRound.commitTimestamp > 0n,
    "POST_STATE_ROUND_HOLD",
    `round ${IAT_V2_DEVNET_CEREMONY_CCC_ROUND} commit identity/timing drifted`,
  );
  if (conditions.cccRoundTerminalAction === CCC_REVEAL_ACTION) {
    check(
      currentRound.status === IAT_V2_ROUND_STATUS.SETTLED
      && currentRound.randomness.some((byte) => byte !== 0)
      && currentRound.derivationCounter < 16,
      "POST_STATE_ROUND_HOLD",
      `revealed round ${IAT_V2_DEVNET_CEREMONY_CCC_ROUND} is not exact terminal settled state`,
    );
    assertExactTwoAgencyTiebreak(currentRound);
  } else {
    check(
      currentRound.status === IAT_V2_ROUND_STATUS.EXPIRED_NEUTRAL
      && currentRound.randomness.every((byte) => byte === 0)
      && currentRound.selectedAgencyIndex === 0xffff_ffff
      && currentRound.derivationCounter === 0xffff_ffff,
      "POST_STATE_ROUND_HOLD",
      `expired round ${IAT_V2_DEVNET_CEREMONY_CCC_ROUND} is not exact terminal neutral state`,
    );
  }
  const paid = paidOutcome(currentRound);
  check(
    positions[0].paid === paid.standard
    && positions[1].paid === paid.agent
    && positions[2].paid === paid.associate,
    "POST_STATE_BALANCE_HOLD",
    `position paid balances do not match policy week ${IAT_V2_DEVNET_CEREMONY_POLICY_WEEK} / CCC round ${IAT_V2_DEVNET_CEREMONY_CCC_ROUND} outcomes`,
  );
  const maximumRewards = [1_000_000_000n, 2_800_000_000n, 2_000_000_000n];
  positions.forEach((position, index) => {
    check(
      position.treasuryReserved === maximumRewards[index] - position.paid
      && position.ecosystemReserved === 0n
      && position.liquidityReserved === 0n,
      "POST_STATE_BALANCE_HOLD",
      `position ${index + 1} exact reward reservation drifted`,
    );
  });

  const coreReward = parseCoreRewardAccount(decodedAccount(result.value[cursor++], IAT_V2_PROGRAM_ID, "core reward"));
  check(
    coreReward.config.equals(configAddress)
    && coreReward.principal === 100_000_000_000n
    && coreReward.annualRateBps === 1_700n
    && coreReward.termWeeks === 104n
    && coreReward.treasuryReserved === 34_000_000_000n - CORE_WEEK_ZERO_PAID
    && coreReward.ecosystemReserved === 0n
    && coreReward.liquidityReserved === 0n
    && coreReward.paid === CORE_WEEK_ZERO_PAID
    && coreReward.settledLow === 1n
    && coreReward.settledHigh === 0n,
    "POST_STATE_BALANCE_HOLD",
    "core reward exact week-zero state drifted",
  );
  const laneStates = laneNames.map((name) => parseLaneVaultAccount(
    decodedAccount(result.value[cursor++], IAT_V2_PROGRAM_ID, `${name} lane state`),
  ));
  const laneTokenAmounts = laneNames.map((name) => parseTokenAccount(
    decodedAccount(result.value[cursor++], TOKEN_PROGRAM_ID, `${name} lane token account`),
    mint,
    plan.vaultAuthority,
    `${name} lane`,
  ));
  const stakeAmount = parseTokenAccount(
    decodedAccount(result.value[cursor++], TOKEN_PROGRAM_ID, "stake token account"),
    mint,
    plan.vaultAuthority,
    "stake vault",
  );
  const communityAmount = parseTokenAccount(
    decodedAccount(result.value[cursor++], TOKEN_PROGRAM_ID, "community token account"),
    mint,
    signer,
    "community custody",
  );
  const coreDestinationAmount = parseTokenAccount(
    decodedAccount(result.value[cursor++], TOKEN_PROGRAM_ID, "core beneficiary token account"),
    mint,
    CORE_BENEFICIARY,
    "core beneficiary",
  );
  const liquidityDestinationAmount = parseTokenAccount(
    decodedAccount(result.value[cursor++], TOKEN_PROGRAM_ID, "liquidity beneficiary token account"),
    mint,
    LIQUIDITY_BENEFICIARY,
    "liquidity beneficiary",
  );
  decodedAccount(result.value[cursor++], SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID, "randomness account");
  check(stakeAmount === config.stakedPrincipal, "POST_STATE_BALANCE_HOLD", "stake token balance disagrees with config principal");
  for (let index = 0; index < laneStates.length; index += 1) {
    const lane = laneStates[index];
    check(lane.config.equals(configAddress) && lane.tokenAccount.equals(plan.lanes[laneNames[index]].tokenAccount), "POST_STATE_BALANCE_HOLD", `${laneNames[index]} lane identity drifted`);
    check(laneTokenAmounts[index] === lane.total - lane.paid - lane.principalClaimed, "POST_STATE_BALANCE_HOLD", `${laneNames[index]} token/state conservation drifted`);
  }
  const exactLaneStates = [
    { total: 200_000_000_000n, genesisUnlocked: 50_000_000_000n, cliffWeek: 52n, linearEndWeek: 208n, paid: CORE_WEEK_ZERO_PAID + positions.reduce((sum, item) => sum + item.paid, 0n), principalClaimed: 0n, lane: 1, rewardSource: true },
    { total: 150_000_000_000n, genesisUnlocked: 37_500_000_000n, cliffWeek: 26n, linearEndWeek: 104n, paid: 0n, principalClaimed: 0n, lane: 2, rewardSource: true },
    { total: 100_000_000_000n, genesisUnlocked: 0n, cliffWeek: 26n, linearEndWeek: 104n, paid: 0n, principalClaimed: 0n, lane: 3, rewardSource: false },
    { total: 50_000_000_000n, genesisUnlocked: 12_500_000_000n, cliffWeek: 26n, linearEndWeek: 104n, paid: 0n, principalClaimed: 12_500_000_000n, lane: 4, rewardSource: true },
  ];
  laneStates.forEach((lane, index) => {
    const expected = exactLaneStates[index];
    for (const field of ["total", "genesisUnlocked", "cliffWeek", "linearEndWeek", "paid", "principalClaimed", "lane", "rewardSource"]) {
      check(lane[field] === expected[field], "POST_STATE_BALANCE_HOLD", `${laneNames[index]} exact ${field} drifted`);
    }
  });
  const rewardLanes = [0, 1, 3];
  const reservationSums = [
    positions.reduce((sum, item) => sum + item.treasuryReserved, coreReward.treasuryReserved),
    positions.reduce((sum, item) => sum + item.ecosystemReserved, coreReward.ecosystemReserved),
    positions.reduce((sum, item) => sum + item.liquidityReserved, coreReward.liquidityReserved),
  ];
  rewardLanes.forEach((laneIndex, index) => {
    check(laneStates[laneIndex].reserved === reservationSums[index], "POST_STATE_BALANCE_HOLD", `${laneNames[laneIndex]} reservation ledger drifted`);
  });
  const totalPositionPaid = positions.reduce((sum, item) => sum + item.paid, 0n);
  const expectedCommunity = plan.allocationDestinations.community.amount - config.stakedPrincipal + totalPositionPaid;
  check(communityAmount === expectedCommunity, "POST_STATE_BALANCE_HOLD", "community token balance does not reconcile principal and rewards");
  check(coreDestinationAmount === CORE_WEEK_ZERO_PAID, "POST_STATE_BALANCE_HOLD", "core beneficiary balance drifted");
  check(liquidityDestinationAmount === 12_500_000_000n, "POST_STATE_BALANCE_HOLD", "liquidity beneficiary balance drifted");
  const observedSupply = laneTokenAmounts.reduce((sum, amount) => sum + amount, 0n)
    + stakeAmount + communityAmount + coreDestinationAmount + liquidityDestinationAmount;
  check(observedSupply === mintSupply, "POST_STATE_BALANCE_HOLD", "reviewed custody balances do not conserve the fixed mint supply");

  return Object.freeze({
    contextSlot,
    config: configAddress.toBase58(),
    mint: mint.toBase58(),
    policyWeek: IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
    cccRound: IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
    mintSupply: mintSupply.toString(),
    genesisTimestamp: config.genesisTimestamp.toString(),
    agencyCount: config.agencyCount,
    stakedPrincipal: config.stakedPrincipal.toString(),
    positionSettledMasks: positions.map((item) => item.settledMask.toString()),
    positionPaid: positions.map((item) => item.paid.toString()),
    roundLayouts: rounds.map((item) => item.layoutVersion),
    roundStatuses: rounds.map((item) => item.status),
    laneTokenAmounts: laneTokenAmounts.map((item) => item.toString()),
    laneReserved: laneStates.map((item) => item.reserved.toString()),
    stakeAmount: stakeAmount.toString(),
    communityAmount: communityAmount.toString(),
    coreDestinationAmount: coreDestinationAmount.toString(),
    liquidityDestinationAmount: liquidityDestinationAmount.toString(),
    verification: "FINALIZED_CONFIG_ROUNDS_POSITIONS_LANES_AND_TOKEN_BALANCES_EXACT",
  });
}
