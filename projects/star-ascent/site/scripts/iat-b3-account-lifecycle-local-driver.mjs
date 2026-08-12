import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  deriveSolanaDraw,
  packDecisionIntoLawState,
  protocolLocalDay,
} from "./iat-b3-local-rehearsal-driver.mjs";

const SCHEMA = "iat-b3-account-lifecycle-local-validator/v1";
const PROGRAM_ID = new PublicKey(Buffer.alloc(32, 0xe6));
const LAW_PROGRAM_ID = new PublicKey(Buffer.alloc(32, 0xb3));
const MINT = new PublicKey(Buffer.alloc(32, 0x22));
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const RANDOMNESS_PROGRAM_ID = new PublicKey(Buffer.alloc(32, 0x44));
const NETWORK = Buffer.alloc(32, 0x11);
const OPERATORS = Object.freeze({
  zero: Buffer.alloc(32, 0xa1),
  prefunded: Buffer.alloc(32, 0xa2),
  rollbackOne: Buffer.alloc(32, 0xa3),
  setValidVacant: Buffer.alloc(32, 0xb1),
  setValidPrefunded: Buffer.alloc(32, 0xb2),
  setInvalidVacant3: Buffer.alloc(32, 0xb3),
  setInvalidVacant255: Buffer.alloc(32, 0xb4),
  setInvalidPrefunded3: Buffer.alloc(32, 0xb5),
  setInvalidPrefunded255: Buffer.alloc(32, 0xb6),
  setExisting: Buffer.alloc(32, 0xb7),
  setLawRejection: Buffer.alloc(32, 0xb8),
});
const INSTRUCTION_NAMESPACE = Buffer.from("IATB3LC1", "ascii");
const PRODUCTION_INSTRUCTION_NAMESPACE = Buffer.from("IATB3EC1", "ascii");
const SET_ELIGIBILITY_OPCODE = 5;
const LAW_STATE_LEN = 160;
const CONFIG_ACCOUNT_LEN = 272;
const ELIGIBILITY_ACCOUNT_LEN = 96;
const ELIGIBILITY_MAGIC = Buffer.from("IATB3ELG", "ascii");
const MAINNET_SUPPLY = 1_000_000_000_000_000_000n;
const UNKNOWN_ROLE_ERROR = 911;
const LAW_BEFORE_DECODE_ERROR = 910;
const SET_ELIGIBILITY_COMPUTE_UNIT_LIMIT = 1_400_000;
const SYSTEM_CPI_LOG = `Program ${SystemProgram.programId.toBase58()} invoke`;

function args() {
  const output = new Map();
  for (let index = 2; index < process.argv.length; index += 2) {
    const flag = process.argv[index];
    const value = process.argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error("invalid arguments");
    output.set(flag.slice(2), value);
  }
  return Object.fromEntries(output);
}

function required(values, key) {
  const value = values[key];
  if (!value) throw new Error(`missing --${key}`);
  return value;
}

function keypair(path) {
  const bytes = JSON.parse(readFileSync(path, "utf8"));
  assert(Array.isArray(bytes) && bytes.length === 64, "payer keypair must contain 64 bytes");
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function deriveAddresses() {
  const [lawState, lawBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("law-state", "ascii")],
    LAW_PROGRAM_ID,
  );
  const [config, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config", "ascii"), MINT.toBuffer()],
    PROGRAM_ID,
  );
  const [, vaultAuthorityBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault-authority", "ascii"), config.toBuffer()],
    PROGRAM_ID,
  );
  const [stakeToken] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake-token", "ascii"), config.toBuffer()],
    PROGRAM_ID,
  );
  const eligibility = (operator) => {
    const wallet = new PublicKey(operator);
    const [key, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("eligibility", "ascii"), config.toBuffer(), operator],
      PROGRAM_ID,
    );
    return Object.freeze({ wallet, key, bump });
  };
  return Object.freeze({
    lawState,
    lawBump,
    config,
    configBump,
    vaultAuthorityBump,
    stakeToken,
    zero: eligibility(OPERATORS.zero).key,
    prefunded: eligibility(OPERATORS.prefunded).key,
    rollbackOne: eligibility(OPERATORS.rollbackOne).key,
    set: Object.freeze({
      validVacant: eligibility(OPERATORS.setValidVacant),
      validPrefunded: eligibility(OPERATORS.setValidPrefunded),
      invalidVacant3: eligibility(OPERATORS.setInvalidVacant3),
      invalidVacant255: eligibility(OPERATORS.setInvalidVacant255),
      invalidPrefunded3: eligibility(OPERATORS.setInvalidPrefunded3),
      invalidPrefunded255: eligibility(OPERATORS.setInvalidPrefunded255),
      existing: eligibility(OPERATORS.setExisting),
      lawRejection: eligibility(OPERATORS.setLawRejection),
    }),
  });
}

function packActiveConfig(addresses, admin) {
  const data = Buffer.alloc(CONFIG_ACCOUNT_LEN);
  Buffer.from("IATB3CFG", "ascii").copy(data, 0);
  data[8] = 1;
  data[9] = 2;
  let offset = 32;
  for (const key of [
    admin,
    MINT,
    TOKEN_2022_PROGRAM_ID,
    RANDOMNESS_PROGRAM_ID,
    addresses.stakeToken,
  ]) {
    key.toBuffer().copy(data, offset);
    offset += 32;
  }
  offset += 32;
  data.writeBigInt64LE(0n, offset);
  offset += 8;
  data.writeBigUInt64LE(MAINNET_SUPPLY, offset);
  offset += 8;
  data.writeBigUInt64LE(0n, offset);
  offset += 8;
  data.writeUInt32LE(0, offset);
  offset += 4;
  data[offset] = 0;
  data[offset + 1] = 1;
  data[offset + 2] = 0b1_1110;
  data[offset + 3] = 1;
  data[offset + 4] = addresses.configBump;
  data[offset + 5] = addresses.vaultAuthorityBump;
  assert.equal(offset + 6, 258, "config codec offset mismatch");
  return data;
}

function openDecision(localDay) {
  for (let entropySlot = 1n; entropySlot <= 100_000n; entropySlot += 1n) {
    const ancestorSlotHash = Buffer.alloc(32);
    ancestorSlotHash.writeBigUInt64BE(entropySlot, 24);
    const decision = deriveSolanaDraw({
      ancestorSlotHash,
      localDay,
      entropySlot,
      networkGenesisHash: NETWORK,
      mint: MINT,
    });
    if (!decision.locked) return decision;
  }
  throw new Error("no synthetic open decision found");
}

function prepareFixture(values) {
  const fixture = required(values, "fixture");
  const configFixture = required(values, "config-fixture");
  const environment = required(values, "env");
  const payer = new PublicKey(required(values, "payer-pubkey"));
  const addresses = deriveAddresses();
  const base = Buffer.alloc(LAW_STATE_LEN);
  Buffer.from("IATB3S01", "ascii").copy(base, 0);
  base[8] = 1;
  base[9] = addresses.lawBump;
  MINT.toBuffer().copy(base, 16);
  NETWORK.copy(base, 48);
  const localDay = protocolLocalDay(BigInt(Math.floor(Date.now() / 1000)));
  const data = packDecisionIntoLawState(base, openDecision(localDay));
  const account = {
    pubkey: addresses.lawState.toBase58(),
    account: {
      lamports: 2_000_000,
      data: [data.toString("base64"), "base64"],
      owner: LAW_PROGRAM_ID.toBase58(),
      executable: false,
      rentEpoch: 0,
      space: data.length,
    },
  };
  const configData = packActiveConfig(addresses, payer);
  const configAccount = {
    pubkey: addresses.config.toBase58(),
    account: {
      lamports: 10_000_000,
      data: [configData.toString("base64"), "base64"],
      owner: PROGRAM_ID.toBase58(),
      executable: false,
      rentEpoch: 0,
      space: configData.length,
    },
  };
  mkdirSync(dirname(fixture), { recursive: true });
  writeFileSync(fixture, `${JSON.stringify(account)}\n`, "utf8");
  writeFileSync(configFixture, `${JSON.stringify(configAccount)}\n`, "utf8");
  writeFileSync(environment, [
    `PROGRAM_ID=${PROGRAM_ID.toBase58()}`,
    `LAW_STATE=${addresses.lawState.toBase58()}`,
    `CONFIG=${addresses.config.toBase58()}`,
    `TARGET_ZERO=${addresses.zero.toBase58()}`,
    `TARGET_PREFUNDED=${addresses.prefunded.toBase58()}`,
    `TARGET_ROLLBACK_ONE=${addresses.rollbackOne.toBase58()}`,
    "",
  ].join("\n"), "utf8");
  process.stdout.write(`${JSON.stringify({
    schema: SCHEMA,
    status: "PASS",
    phase: "fixture",
    syntheticDailyLawFixture: true,
    syntheticProductionActiveConfigFixture: true,
    protocolLocalDay: localDay.toString(),
    publicNetworkWrites: false,
    mainnetStatus: "HOLD",
  })}\n`);
}

function instructionData(opcode) {
  const data = Buffer.alloc(16);
  INSTRUCTION_NAMESPACE.copy(data, 0);
  data[8] = 1;
  data[9] = opcode;
  return data;
}

function buildInstruction(lawState, payer, targets, opcode) {
  const keys = opcode >= 3
    ? [
        { pubkey: lawState, isSigner: false, isWritable: false },
        { pubkey: targets[0], isSigner: false, isWritable: true },
      ]
    : [
        { pubkey: lawState, isSigner: false, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        ...targets.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true })),
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: instructionData(opcode),
  });
}

function setEligibilityInstructionData(role, malformed = false) {
  if (malformed) return Buffer.from(PRODUCTION_INSTRUCTION_NAMESPACE);
  const data = Buffer.alloc(32);
  PRODUCTION_INSTRUCTION_NAMESPACE.copy(data, 0);
  data[8] = 1;
  data[9] = SET_ELIGIBILITY_OPCODE;
  data[16] = role;
  return data;
}

function buildSetEligibilityInstruction({
  lawState,
  payer,
  config,
  identity,
  role,
  malformed = false,
}) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: lawState, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: identity.wallet, isSigner: false, isWritable: false },
      { pubkey: identity.key, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: setEligibilityInstructionData(role, malformed),
  });
}

function expectedEligibilityData(addresses, identity) {
  const data = Buffer.alloc(ELIGIBILITY_ACCOUNT_LEN);
  ELIGIBILITY_MAGIC.copy(data, 0);
  data[8] = 1;
  addresses.config.toBuffer().copy(data, 16);
  identity.wallet.toBuffer().copy(data, 48);
  data.writeUInt32LE(0xffff_ffff, 80);
  data[84] = 0;
  data[85] = identity.bump;
  return data;
}

function assertAccountSnapshotEqual(actual, expected, label) {
  if (expected === null) {
    assert.equal(actual, null, `${label} unexpectedly exists`);
    return;
  }
  assert(actual, `${label} disappeared`);
  assert.equal(actual.lamports, expected.lamports, `${label} lamports changed`);
  assert(actual.owner.equals(expected.owner), `${label} owner changed`);
  assert(actual.data.equals(expected.data), `${label} data changed`);
}

async function finalizedResult(connection, signature, lastValidBlockHeight) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = (await connection.getSignatureStatuses(
      [signature],
      { searchTransactionHistory: true },
    )).value[0];
    if (status?.confirmationStatus === "finalized" || status?.confirmations === null) {
      const transaction = await connection.getTransaction(signature, {
        commitment: "finalized",
        maxSupportedTransactionVersion: 0,
      });
      if (transaction) return transaction;
    }
    const height = await connection.getBlockHeight("processed");
    if (!status && height > lastValidBlockHeight) throw new Error("transaction expired unseen");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("transaction did not finalize");
}

async function send(connection, payer, instruction, expectFailure, computeUnitLimit = null) {
  const latest = await connection.getLatestBlockhashAndContext("finalized");
  const transaction = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: latest.value.blockhash,
  });
  if (computeUnitLimit !== null) {
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit }));
  }
  transaction.add(instruction);
  transaction.sign(payer);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: expectFailure,
    maxRetries: 0,
    preflightCommitment: "finalized",
  });
  return {
    signature,
    transaction: await finalizedResult(connection, signature, latest.value.lastValidBlockHeight),
  };
}

async function executeSetEligibility(values) {
  const mode = required(values, "mode");
  const connection = new Connection(required(values, "rpc"), "finalized");
  const payer = keypair(required(values, "payer"));
  const lawState = new PublicKey(required(values, "law-state"));
  const config = new PublicKey(required(values, "config"));
  const addresses = deriveAddresses();
  assert(lawState.equals(addresses.lawState), "law state mismatch");
  assert(config.equals(addresses.config), "config mismatch");

  const specifications = Object.freeze({
    "set-valid-vacant": {
      identity: addresses.set.validVacant,
      role: 0,
      prefunded: false,
      existing: false,
      expectedError: null,
      expectedSystemCpis: 1,
    },
    "set-valid-prefunded": {
      identity: addresses.set.validPrefunded,
      role: 0,
      prefunded: true,
      existing: false,
      expectedError: null,
      expectedSystemCpis: 3,
    },
    "set-invalid-vacant-3": {
      identity: addresses.set.invalidVacant3,
      role: 3,
      prefunded: false,
      existing: false,
      expectedError: UNKNOWN_ROLE_ERROR,
      expectedSystemCpis: 1,
    },
    "set-invalid-vacant-255": {
      identity: addresses.set.invalidVacant255,
      role: 255,
      prefunded: false,
      existing: false,
      expectedError: UNKNOWN_ROLE_ERROR,
      expectedSystemCpis: 1,
    },
    "set-invalid-prefunded-3": {
      identity: addresses.set.invalidPrefunded3,
      role: 3,
      prefunded: true,
      existing: false,
      expectedError: UNKNOWN_ROLE_ERROR,
      expectedSystemCpis: 3,
    },
    "set-invalid-prefunded-255": {
      identity: addresses.set.invalidPrefunded255,
      role: 255,
      prefunded: true,
      existing: false,
      expectedError: UNKNOWN_ROLE_ERROR,
      expectedSystemCpis: 3,
    },
    "set-existing-seed": {
      identity: addresses.set.existing,
      role: 0,
      prefunded: false,
      existing: false,
      expectedError: null,
      expectedSystemCpis: 1,
    },
    "set-existing-invalid-3": {
      identity: addresses.set.existing,
      role: 3,
      prefunded: false,
      existing: true,
      expectedError: UNKNOWN_ROLE_ERROR,
      expectedSystemCpis: 0,
    },
    "set-existing-invalid-255": {
      identity: addresses.set.existing,
      role: 255,
      prefunded: false,
      existing: true,
      expectedError: UNKNOWN_ROLE_ERROR,
      expectedSystemCpis: 0,
    },
    "set-law-rejection": {
      identity: addresses.set.lawRejection,
      role: 3,
      prefunded: false,
      existing: false,
      malformed: true,
      wrongLaw: true,
      expectedError: LAW_BEFORE_DECODE_ERROR,
      expectedSystemCpis: 0,
    },
  });
  const specification = specifications[mode];
  if (!specification) throw new Error(`unknown SetEligibility mode: ${mode}`);

  const rent = await connection.getMinimumBalanceForRentExemption(
    ELIGIBILITY_ACCOUNT_LEN,
    "finalized",
  );
  const initiallyObserved = await connection.getAccountInfo(specification.identity.key, "finalized");
  if (specification.existing) {
    assert(initiallyObserved, `${mode} requires the seeded existing account`);
  } else {
    assert.equal(initiallyObserved, null, `${mode} target already exists`);
  }

  if (specification.prefunded) {
    const vacantRent = await connection.getMinimumBalanceForRentExemption(0, "finalized");
    assert(vacantRent > 0 && vacantRent < rent, "vacant-account rent boundary is invalid");
    const prefund = await send(
      connection,
      payer,
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: specification.identity.key,
        lamports: vacantRent,
      }),
      false,
    );
    assert.equal(prefund.transaction.meta.err, null, "prefund transfer failed");
  }

  const beforePayer = await connection.getBalance(payer.publicKey, "finalized");
  const beforeTarget = await connection.getAccountInfo(specification.identity.key, "finalized");
  const instruction = buildSetEligibilityInstruction({
    lawState: specification.wrongLaw ? payer.publicKey : lawState,
    payer: payer.publicKey,
    config,
    identity: specification.identity,
    role: specification.role,
    malformed: specification.malformed,
  });
  const result = await send(
    connection,
    payer,
    instruction,
    specification.expectedError !== null,
    SET_ELIGIBILITY_COMPUTE_UNIT_LIMIT,
  );
  const afterPayer = await connection.getBalance(payer.publicKey, "finalized");
  const afterTarget = await connection.getAccountInfo(specification.identity.key, "finalized");
  const logs = result.transaction.meta.logMessages ?? [];
  const systemCpiCount = logs.filter((line) => line.includes(SYSTEM_CPI_LOG)).length;
  const computeUnitsConsumed = result.transaction.meta.computeUnitsConsumed;
  assert(
    Number.isInteger(computeUnitsConsumed)
      && computeUnitsConsumed > 0
      && computeUnitsConsumed <= SET_ELIGIBILITY_COMPUTE_UNIT_LIMIT,
    `${mode} compute consumption is missing or out of bounds`,
  );
  assert.equal(systemCpiCount, specification.expectedSystemCpis, `${mode} System CPI count mismatch`);

  if (specification.expectedError !== null) {
    assert.deepEqual(result.transaction.meta.err, {
      InstructionError: [1, { Custom: specification.expectedError }],
    });
    assertAccountSnapshotEqual(afterTarget, beforeTarget, `${mode} target rollback`);
    assert.equal(afterPayer, beforePayer - result.transaction.meta.fee, `${mode} payer rollback mismatch`);
  } else {
    assert.equal(result.transaction.meta.err, null, `${mode} transaction failed`);
    assert(afterTarget, `${mode} did not create the Eligibility account`);
    assert(afterTarget.owner.equals(PROGRAM_ID), `${mode} owner mismatch`);
    assert.equal(afterTarget.lamports, rent, `${mode} rent mismatch`);
    assert(
      afterTarget.data.equals(expectedEligibilityData(addresses, specification.identity)),
      `${mode} exact postimage mismatch`,
    );
    const priorLamports = beforeTarget?.lamports ?? 0;
    assert.equal(
      afterPayer,
      beforePayer - (rent - priorLamports) - result.transaction.meta.fee,
      `${mode} payer debit mismatch`,
    );
  }

  process.stdout.write(`${JSON.stringify({
    schema: SCHEMA,
    status: "PASS",
    phase: mode,
    signature: result.signature,
    role: specification.role,
    systemCpiCount,
    requestedComputeUnitLimit: SET_ELIGIBILITY_COMPUTE_UNIT_LIMIT,
    computeUnitsConsumed,
    productionComputeBudgetProven: false,
    lawAuthenticatedBeforeProductionDecode: true,
    productionSetEligibilityInstructionCodecExercised: !specification.malformed,
    setEligibilityRollbackPrerequisiteExercised: !specification.wrongLaw,
    productionSetEligibilityExecutorInvoked: !specification.wrongLaw,
    productionSetEligibilityExecutorSbfExecutionProven: !specification.wrongLaw,
    localProductionSetEligibilityExecutorSbfExecutionObserved: !specification.wrongLaw,
    productionFinalArtifactStackSafeProven: false,
    syntheticProgramErrorMapping: true,
    productionProgramErrorAbiProven: false,
    exactTransactionRollbackObserved: specification.expectedError === UNKNOWN_ROLE_ERROR,
    realProductionSetEligibilityRollbackObserved:
      specification.expectedError === UNKNOWN_ROLE_ERROR,
    existingInvalidRoleZeroCpiNoWriteObserved:
      specification.existing && specification.expectedError === UNKNOWN_ROLE_ERROR,
    lawRejectionBeforeDecodeAndCpiObserved: specification.expectedError === LAW_BEFORE_DECODE_ERROR,
    syntheticDailyLawFixture: true,
    syntheticProductionActiveConfigFixture: true,
    publicNetworkWrites: false,
    productionDispatcherExposed: false,
    productionEntrypointProven: false,
    finalBinaryDevnetRollbackProven: false,
    fullFeatureDevnetRehearsalComplete: false,
    activationReady: false,
    mainnetStatus: "HOLD",
  })}\n`);
}

async function execute(values) {
  const mode = required(values, "mode");
  if (mode.startsWith("set-")) {
    await executeSetEligibility(values);
    return;
  }
  const connection = new Connection(required(values, "rpc"), "finalized");
  const payer = keypair(required(values, "payer"));
  const lawState = new PublicKey(required(values, "law-state"));
  const addresses = deriveAddresses();
  assert(lawState.equals(addresses.lawState), "law state mismatch");
  const rent = await connection.getMinimumBalanceForRentExemption(ELIGIBILITY_ACCOUNT_LEN, "finalized");

  let targets;
  let opcode;
  if (mode === "zero") {
    targets = [addresses.zero];
    opcode = 0;
  } else if (mode === "prefunded") {
    targets = [addresses.prefunded];
    opcode = 1;
    const existing = await connection.getAccountInfo(addresses.prefunded, "finalized");
    assert.equal(existing, null, "prefunded target already exists");
    const vacantRent = await connection.getMinimumBalanceForRentExemption(0, "finalized");
    assert(vacantRent > 0 && vacantRent < rent, "vacant-account rent boundary is invalid");
    const prefund = await send(
      connection,
      payer,
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: addresses.prefunded,
        lamports: vacantRent,
      }),
      false,
    );
    assert.equal(prefund.transaction.meta.err, null, "prefund transfer failed");
  } else if (mode === "rollback") {
    targets = [addresses.rollbackOne];
    opcode = 2;
  } else if (mode === "update") {
    targets = [addresses.zero];
    opcode = 3;
  } else if (mode === "update-rollback") {
    targets = [addresses.zero];
    opcode = 4;
  } else {
    throw new Error(`unknown mode: ${mode}`);
  }

  const beforePayer = await connection.getBalance(payer.publicKey, "finalized");
  const beforeTargets = await connection.getMultipleAccountsInfo(targets, "finalized");
  const existingMode = mode === "update" || mode === "update-rollback";
  const expectedFailure = mode === "rollback" || mode === "update-rollback";
  const result = await send(
    connection,
    payer,
    buildInstruction(lawState, payer.publicKey, targets, opcode),
    expectedFailure,
  );
  const afterPayer = await connection.getBalance(payer.publicKey, "finalized");
  const afterTargets = await connection.getMultipleAccountsInfo(targets, "finalized");
  const logs = result.transaction.meta.logMessages ?? [];
  const systemCpiCount = logs.filter((line) => line.includes(SYSTEM_CPI_LOG)).length;

  if (existingMode) {
    assert(beforeTargets[0], "existing CAS target is missing");
    assert(afterTargets[0], "existing CAS target disappeared");
    assert.equal(systemCpiCount, 0, "existing CAS unexpectedly invoked the System Program");
    assert.equal(afterPayer, beforePayer - result.transaction.meta.fee, "CAS payer fee mismatch");
    if (expectedFailure) {
      assert.deepEqual(result.transaction.meta.err, { InstructionError: [0, { Custom: 909 }] });
      assert(
        afterTargets[0].data.equals(beforeTargets[0].data),
        "failed CAS write was not rolled back",
      );
    } else {
      assert.equal(result.transaction.meta.err, null, "existing CAS transaction failed");
      assert(!afterTargets[0].data.equals(beforeTargets[0].data), "CAS postimage did not change");
      assert.equal(afterTargets[0].data.readUInt32LE(80), 0, "CAS agency index mismatch");
      assert.equal(afterTargets[0].data[84], 1, "CAS role mismatch");
      assert.equal(afterTargets[0].lamports, beforeTargets[0].lamports);
      assert(afterTargets[0].owner.equals(PROGRAM_ID));
    }
  } else if (expectedFailure) {
    assert.deepEqual(result.transaction.meta.err, { InstructionError: [0, { Custom: 909 }] });
    assert(beforeTargets.every((account) => account === null));
    assert(afterTargets.every((account) => account === null), "rollback target survived");
    assert(systemCpiCount >= 1, "rollback did not execute a System CPI before failure");
    assert.equal(afterPayer, beforePayer - result.transaction.meta.fee, "rollback payer delta mismatch");
  } else {
    assert.equal(result.transaction.meta.err, null, "lifecycle transaction failed");
    assert.equal(afterTargets.length, 1);
    const account = afterTargets[0];
    assert(account, "created target is missing");
    assert(account.owner.equals(PROGRAM_ID), "created target owner mismatch");
    assert.equal(account.lamports, rent, "created target rent mismatch");
    assert.equal(account.data.length, ELIGIBILITY_ACCOUNT_LEN, "created target length mismatch");
    assert(account.data.subarray(0, 8).equals(ELIGIBILITY_MAGIC), "sealed postimage magic mismatch");
    const priorLamports = beforeTargets[0]?.lamports ?? 0;
    assert.equal(
      afterPayer,
      beforePayer - (rent - priorLamports) - result.transaction.meta.fee,
      "payer debit mismatch",
    );
    assert(systemCpiCount >= (mode === "zero" ? 1 : 3), "expected System CPIs were not observed");
  }

  process.stdout.write(`${JSON.stringify({
    schema: SCHEMA,
    status: "PASS",
    phase: mode,
    signature: result.signature,
    systemCpiCount,
    canonicalPdaSignerObserved: !existingMode,
    existingStateCasObserved: existingMode && !expectedFailure,
    sealedPostimageObserved: !expectedFailure,
    rollbackObserved: expectedFailure,
    syntheticDailyLawFixture: true,
    publicNetworkWrites: false,
    productionInstructionAbiFrozen: false,
    anyHandlerComplete: false,
    activationReady: false,
    mainnetStatus: "HOLD",
  })}\n`);
}

const values = args();
if (values.mode === "prepare-fixture") {
  prepareFixture(values);
} else {
  execute(values).catch((error) => {
    process.stderr.write(`${SCHEMA}: ${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
