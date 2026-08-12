import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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

const SCHEMA = "iat-b3-close-position-production-handler-loopback/v1";
const PROGRAM_ID = new PublicKey(Buffer.alloc(32, 0xe7));
const LAW_PROGRAM_ID = new PublicKey(Buffer.alloc(32, 0xb3));
const MINT = new PublicKey(Buffer.alloc(32, 0x22));
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);
const RANDOMNESS_PROGRAM_ID = new PublicKey(Buffer.alloc(32, 0x44));
const NETWORK = Buffer.alloc(32, 0x11);
const MAINNET_SUPPLY = 1_000_000_000_000_000_000n;
const LAW_STATE_LEN = 160;
const CONFIG_ACCOUNT_LEN = 272;
const POSITION_ACCOUNT_LEN = 176;
const LANE_ACCOUNT_LEN = 176;
const POSITION_ID = 42n;
const USER_TERM_WEEKS = 52n;
const FULL_SETTLEMENT_MASK = (1n << USER_TERM_WEEKS) - 1n;
const CLOSE_POSITION_OPCODE = 11;
const COMPUTE_UNIT_LIMIT = 1_400_000;
const LAW_REJECTED_BEFORE_DECODE = 910;
const INJECTED_AFTER_HANDLER_SUCCESS = 912;
const RESERVATIONS = Object.freeze({ treasury: 11n, ecosystem: 17n, liquidity: 23n });
const LANE_RESERVED = Object.freeze({ treasury: 101n, ecosystem: 107n, liquidity: 113n });

function parseArgs(argv) {
  const result = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("invalid arguments");
    result.set(key.slice(2), value);
  }
  return result;
}

function required(args, name) {
  const value = args.get(name);
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readKeypair(path) {
  const bytes = JSON.parse(readFileSync(path, "utf8"));
  assert(Array.isArray(bytes) && bytes.length === 64, "keypair must contain 64 bytes");
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function deriveAddresses(caller) {
  const [lawState, lawBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("law-state")],
    LAW_PROGRAM_ID,
  );
  const [config, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), MINT.toBuffer()],
    PROGRAM_ID,
  );
  const [, vaultAuthorityBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault-authority"), config.toBuffer()],
    PROGRAM_ID,
  );
  const [stakeToken] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake-token"), config.toBuffer()],
    PROGRAM_ID,
  );
  const [position, positionBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), config.toBuffer(), caller.toBuffer(), u64le(POSITION_ID)],
    PROGRAM_ID,
  );
  const lane = (ordinal) => {
    const byte = Buffer.from([ordinal]);
    const [key, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lane"), config.toBuffer(), byte],
      PROGRAM_ID,
    );
    const [token, tokenBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("lane-token"), config.toBuffer(), byte],
      PROGRAM_ID,
    );
    return Object.freeze({ ordinal, key, bump, token, tokenBump });
  };
  return Object.freeze({
    lawState,
    lawBump,
    config,
    configBump,
    vaultAuthorityBump,
    stakeToken,
    position,
    positionBump,
    treasury: lane(1),
    ecosystem: lane(2),
    liquidity: lane(4),
  });
}

function u64le(value) {
  const output = Buffer.alloc(8);
  output.writeBigUInt64LE(BigInt(value));
  return output;
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
  throw new Error("no synthetic OPEN decision found");
}

function packLaw(addresses) {
  const base = Buffer.alloc(LAW_STATE_LEN);
  Buffer.from("IATB3S01").copy(base, 0);
  base[8] = 1;
  base[9] = addresses.lawBump;
  MINT.toBuffer().copy(base, 16);
  NETWORK.copy(base, 48);
  const localDay = protocolLocalDay(BigInt(Math.floor(Date.now() / 1000)));
  return Object.freeze({ data: packDecisionIntoLawState(base, openDecision(localDay)), localDay });
}

function packActiveConfig(addresses, admin) {
  const data = Buffer.alloc(CONFIG_ACCOUNT_LEN);
  Buffer.from("IATB3CFG").copy(data, 0);
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
  data.writeBigUInt64LE(MAINNET_SUPPLY, offset + 8);
  data.writeBigUInt64LE(0n, offset + 16);
  data.writeUInt32LE(0, offset + 24);
  data[offset + 28] = 0;
  data[offset + 29] = 1;
  data[offset + 30] = 0b1_1110;
  data[offset + 31] = 1;
  data[offset + 32] = addresses.configBump;
  data[offset + 33] = addresses.vaultAuthorityBump;
  assert.equal(offset + 34, 258);
  return data;
}

function packPosition(addresses, caller) {
  const data = Buffer.alloc(POSITION_ACCOUNT_LEN);
  Buffer.from("IATB3POS").copy(data, 0);
  data[8] = 1;
  addresses.config.toBuffer().copy(data, 16);
  caller.toBuffer().copy(data, 48);
  data.writeBigUInt64LE(POSITION_ID, 80);
  data.writeBigUInt64LE(1_000_000n, 88);
  data.writeBigUInt64LE(0n, 96);
  data.writeBigUInt64LE(1n, 104);
  data.writeBigUInt64LE(USER_TERM_WEEKS, 112);
  data.writeBigUInt64LE(1_000n, 120);
  data.writeBigUInt64LE(RESERVATIONS.treasury, 128);
  data.writeBigUInt64LE(RESERVATIONS.ecosystem, 136);
  data.writeBigUInt64LE(RESERVATIONS.liquidity, 144);
  data.writeBigUInt64LE(60_000n, 152);
  data.writeBigUInt64LE(FULL_SETTLEMENT_MASK, 160);
  data.writeUInt32LE(0xffff_ffff, 168);
  data[172] = 0;
  data[173] = 1;
  data[174] = 0;
  data[175] = addresses.positionBump;
  return data;
}

function packLane(addresses, lane, reserved, paid) {
  const data = Buffer.alloc(LANE_ACCOUNT_LEN);
  Buffer.from("IATB3LAN").copy(data, 0);
  data[8] = 1;
  addresses.config.toBuffer().copy(data, 16);
  lane.token.toBuffer().copy(data, 48);
  Buffer.alloc(32, lane.ordinal).copy(data, 80);
  data.writeBigUInt64LE(1_000_000n, 112);
  data.writeBigUInt64LE(100_000n, 120);
  data.writeBigUInt64LE(0n, 128);
  data.writeBigUInt64LE(104n, 136);
  data.writeBigUInt64LE(reserved, 144);
  data.writeBigUInt64LE(paid, 152);
  data.writeBigUInt64LE(0n, 160);
  data[168] = lane.ordinal;
  data[169] = 1;
  data[170] = lane.bump;
  data[171] = lane.tokenBump;
  return data;
}

function accountFixture(pubkey, owner, data, lamports = 10_000_000) {
  return {
    pubkey: pubkey.toBase58(),
    account: {
      lamports,
      data: [data.toString("base64"), "base64"],
      owner: owner.toBase58(),
      executable: false,
      rentEpoch: 0,
      space: data.length,
    },
  };
}

function writeFixture(path, record) {
  writeFileSync(path, `${JSON.stringify(record)}\n`, "utf8");
}

function prepareFixture(args) {
  const fixtureDir = resolve(required(args, "fixture-dir"));
  const envPath = resolve(required(args, "env"));
  const payer = new PublicKey(required(args, "payer-pubkey"));
  const caller = new PublicKey(required(args, "caller-pubkey"));
  const addresses = deriveAddresses(caller);
  const law = packLaw(addresses);
  const records = Object.freeze({
    law: accountFixture(addresses.lawState, LAW_PROGRAM_ID, law.data, 2_000_000),
    config: accountFixture(addresses.config, PROGRAM_ID, packActiveConfig(addresses, payer)),
    position: accountFixture(addresses.position, PROGRAM_ID, packPosition(addresses, caller)),
    treasury: accountFixture(
      addresses.treasury.key,
      PROGRAM_ID,
      packLane(addresses, addresses.treasury, LANE_RESERVED.treasury, 3n),
    ),
    ecosystem: accountFixture(
      addresses.ecosystem.key,
      PROGRAM_ID,
      packLane(addresses, addresses.ecosystem, LANE_RESERVED.ecosystem, 5n),
    ),
    liquidity: accountFixture(
      addresses.liquidity.key,
      PROGRAM_ID,
      packLane(addresses, addresses.liquidity, LANE_RESERVED.liquidity, 7n),
    ),
  });
  mkdirSync(fixtureDir, { recursive: true });
  for (const [name, record] of Object.entries(records)) {
    writeFixture(join(fixtureDir, `${name}.json`), record);
  }
  writeFileSync(envPath, [
    `PROGRAM_ID=${PROGRAM_ID.toBase58()}`,
    `LAW_STATE=${addresses.lawState.toBase58()}`,
    `CONFIG=${addresses.config.toBase58()}`,
    `POSITION=${addresses.position.toBase58()}`,
    `TREASURY=${addresses.treasury.key.toBase58()}`,
    `ECOSYSTEM=${addresses.ecosystem.key.toBase58()}`,
    `LIQUIDITY=${addresses.liquidity.key.toBase58()}`,
    "",
  ].join("\n"), "utf8");
  emit({
    schema: SCHEMA,
    status: "PASS",
    phase: "fixture",
    protocolLocalDay: law.localDay.toString(),
    exactFixtureAccountCount: 6,
    syntheticDailyLawFixture: true,
    syntheticProductionActiveConfigFixture: true,
    fixtureOnlyIdentities: true,
    publicNetworkWrites: false,
    mainnetStatus: "HOLD",
  });
}

function closeInstructionData() {
  const data = Buffer.alloc(32);
  Buffer.from("IATB3EC1").copy(data, 0);
  data[8] = 1;
  data[9] = CLOSE_POSITION_OPCODE;
  return data;
}

function raw(account) {
  assert(account, "fixture account missing");
  return Object.freeze({
    lamports: account.lamports,
    owner: account.owner.toBase58(),
    executable: account.executable,
    data: Buffer.from(account.data),
    dataSha256: sha256(account.data),
  });
}

function assertRawEqual(actual, expected, label) {
  assert.equal(actual.lamports, expected.lamports, `${label} lamports changed`);
  assert.equal(actual.owner, expected.owner, `${label} owner changed`);
  assert.equal(actual.executable, expected.executable, `${label} executable changed`);
  assert(actual.data.equals(expected.data), `${label} raw bytes changed`);
}

async function stateSnapshot(connection, addresses, sponsor, caller) {
  const infos = await connection.getMultipleAccountsInfo(
    [addresses.position, addresses.treasury.key, addresses.ecosystem.key, addresses.liquidity.key],
    "finalized",
  );
  const [sponsorBalance, callerBalance] = await Promise.all([
    connection.getBalance(sponsor, "finalized"),
    connection.getBalance(caller, "finalized"),
  ]);
  return Object.freeze({
    sponsorBalance,
    callerBalance,
    position: raw(infos[0]),
    treasury: raw(infos[1]),
    ecosystem: raw(infos[2]),
    liquidity: raw(infos[3]),
  });
}

function transactionInstruction({ addresses, caller, lawState, data, injectLateFailure }) {
  const keys = [
    { pubkey: lawState, isSigner: false, isWritable: false },
    { pubkey: caller, isSigner: true, isWritable: false },
    { pubkey: addresses.config, isSigner: false, isWritable: false },
    { pubkey: addresses.position, isSigner: false, isWritable: true },
    { pubkey: addresses.treasury.key, isSigner: false, isWritable: true },
    { pubkey: addresses.ecosystem.key, isSigner: false, isWritable: true },
    { pubkey: addresses.liquidity.key, isSigner: false, isWritable: true },
  ];
  if (injectLateFailure) {
    keys.push({ pubkey: SystemProgram.programId, isSigner: false, isWritable: false });
  }
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

async function finalizedTransaction(connection, signature, lastValidBlockHeight) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const transaction = await connection.getTransaction(signature, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
    if (transaction?.meta) return transaction;
    const height = await connection.getBlockHeight("processed");
    if (height > lastValidBlockHeight) throw new Error(`transaction expired: ${signature}`);
    await delay(100);
  }
  throw new Error(`finalized transaction unavailable: ${signature}`);
}

async function submit(connection, sponsor, caller, instruction, expectFailure) {
  const latest = await connection.getLatestBlockhash("finalized");
  const transaction = new Transaction({
    feePayer: sponsor.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }).add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
    instruction,
  );
  transaction.sign(sponsor, caller);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: expectFailure,
    maxRetries: 0,
    preflightCommitment: "finalized",
  });
  return Object.freeze({
    signature,
    transaction: await finalizedTransaction(connection, signature, latest.lastValidBlockHeight),
  });
}

function assertRollback(after, before) {
  for (const name of ["position", "treasury", "ecosystem", "liquidity"]) {
    assertRawEqual(after[name], before[name], `${name} rollback`);
  }
}

function expectedSuccess(before) {
  const position = Buffer.from(before.position.data);
  position.writeBigUInt64LE(0n, 128);
  position.writeBigUInt64LE(0n, 136);
  position.writeBigUInt64LE(0n, 144);
  position[174] = 1;
  const lane = (source, release) => {
    const data = Buffer.from(source.data);
    data.writeBigUInt64LE(data.readBigUInt64LE(144) - release, 144);
    return data;
  };
  return Object.freeze({
    position,
    treasury: lane(before.treasury, RESERVATIONS.treasury),
    ecosystem: lane(before.ecosystem, RESERVATIONS.ecosystem),
    liquidity: lane(before.liquidity, RESERVATIONS.liquidity),
  });
}

async function execute(args) {
  const mode = required(args, "mode");
  const connection = new Connection(required(args, "rpc"), "finalized");
  const sponsor = readKeypair(required(args, "payer"));
  const caller = readKeypair(required(args, "caller"));
  const lawState = new PublicKey(required(args, "law-state"));
  const addresses = deriveAddresses(caller.publicKey);
  assert(lawState.equals(addresses.lawState), "law-state address mismatch");
  const before = await stateSnapshot(
    connection,
    addresses,
    sponsor.publicKey,
    caller.publicKey,
  );

  const lawFirst = mode === "law-first";
  const lateFailure = mode === "late-failure";
  if (!lawFirst && !lateFailure && mode !== "success") throw new Error(`unknown mode: ${mode}`);
  const instruction = transactionInstruction({
    addresses,
    caller: caller.publicKey,
    lawState: lawFirst ? SystemProgram.programId : lawState,
    data: lawFirst ? Buffer.from("malformed-close") : closeInstructionData(),
    injectLateFailure: lateFailure,
  });
  const result = await submit(connection, sponsor, caller, instruction, lawFirst || lateFailure);
  const after = await stateSnapshot(
    connection,
    addresses,
    sponsor.publicKey,
    caller.publicKey,
  );
  const logs = result.transaction.meta.logMessages ?? [];
  const systemCpiCount = logs.filter((line) => line.includes(`Program ${SystemProgram.programId} invoke`)).length;
  const computeUnitsConsumed = result.transaction.meta.computeUnitsConsumed;
  assert(Number.isInteger(computeUnitsConsumed) && computeUnitsConsumed > 0);
  assert(computeUnitsConsumed <= COMPUTE_UNIT_LIMIT);
  assert.equal(systemCpiCount, 0, "close-position unexpectedly invoked System Program CPI");
  assert.equal(after.callerBalance, before.callerBalance, "readonly caller balance changed");
  assert.equal(
    after.sponsorBalance,
    before.sponsorBalance - result.transaction.meta.fee,
    "sponsor balance changed beyond exact fee",
  );

  if (lawFirst) {
    assert.deepEqual(result.transaction.meta.err, {
      InstructionError: [1, { Custom: LAW_REJECTED_BEFORE_DECODE }],
    });
    assertRollback(after, before);
  } else if (lateFailure) {
    assert.deepEqual(result.transaction.meta.err, {
      InstructionError: [1, { Custom: INJECTED_AFTER_HANDLER_SUCCESS }],
    });
    assertRollback(after, before);
  } else {
    assert.equal(result.transaction.meta.err, null, "production close-position handler failed");
    const expected = expectedSuccess(before);
    for (const name of ["position", "treasury", "ecosystem", "liquidity"]) {
      assert(after[name].data.equals(expected[name]), `${name} exact postimage mismatch`);
      assert.equal(after[name].lamports, before[name].lamports, `${name} lamports changed`);
      assert.equal(after[name].owner, before[name].owner, `${name} owner changed`);
      assert.equal(after[name].executable, before[name].executable, `${name} executable changed`);
    }
  }

  emit({
    schema: SCHEMA,
    status: "PASS",
    phase: mode,
    signature: result.signature,
    computeUnitsConsumed,
    requestedComputeUnitLimit: COMPUTE_UNIT_LIMIT,
    exactProductionInstructionCodecExercised: !lawFirst,
    runtimeDailyLawAuthenticatedBeforeDecode: lawFirst,
    productionActiveConfigAuthenticated: !lawFirst,
    actualProductionClosePositionHandlerInvoked: !lawFirst,
    exactFourStateCasObserved: mode === "success",
    exactFourStateLateFailureRollbackObserved: lateFailure,
    rawBytesAndBalancesChecked: true,
    tokenCpiObserved: false,
    systemCpiObserved: false,
    syntheticDailyLawFixture: true,
    syntheticProductionActiveConfigFixture: true,
    syntheticFixtureEntrypoint: true,
    syntheticProgramErrorMapping: true,
    productionProgramErrorAbiProven: false,
    productionDispatcherProven: false,
    productionEntrypointProven: false,
    productionFinalBinaryProven: false,
    publicDevnetExecuted: false,
    publicNetworkWrites: false,
    all15HandlersComplete: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
  });
}

function finalizeEvidence(args) {
  const output = resolve(required(args, "output"));
  const siteRoot = resolve(required(args, "site-root"));
  const input = readFileSync(0, "utf8").trim();
  const records = input.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(records.map((record) => record.phase), [
    "fixture",
    "law-first",
    "late-failure",
    "success",
  ]);
  assert(records.every((record) => record.schema === SCHEMA && record.status === "PASS"));
  const sourcePaths = [
    "programs/iat_b3_economy/src/production_close_position.rs",
    "tests/fixtures/iat-b3-close-position/Cargo.toml",
    "tests/fixtures/iat-b3-close-position/Cargo.lock",
    "tests/fixtures/iat-b3-close-position/src/lib.rs",
    "scripts/iat-b3-close-position-local-driver.mjs",
    "scripts/run-iat-b3-close-position-local.sh",
    "tests/iat-b3-close-position-local-rehearsal.test.mjs",
  ];
  const sourceLedger = sourcePaths.map((path) => {
    const bytes = readFileSync(resolve(siteRoot, path));
    return Object.freeze({ path, bytes: bytes.length, sha256: sha256(bytes) });
  });
  const evidence = {
    schema: SCHEMA,
    status: "PASS",
    generatedAt: new Date().toISOString(),
    gitHead: required(args, "git-head"),
    artifact: {
      bytes: Number(required(args, "artifact-bytes")),
      sha256: required(args, "artifact-sha256"),
    },
    sourceLedger,
    phases: records,
    exactProductionClosePositionSourceImported: true,
    productionClosePositionHandlerSbfExecutionObserved: true,
    runtimeDailyLawBeforeDecodeObserved: true,
    syntheticProductionActiveConfigAuthenticated: true,
    exactFourStateCasObserved: true,
    lateFailureFourStateTransactionRollbackObserved: true,
    exactRawBytesOwnerLamportsAndBalanceChecksObserved: true,
    loopbackRpcOnly: true,
    temporaryLedgerRemoved: true,
    validatorStopped: true,
    generatedKeyMaterialRemoved: true,
    buildSourceClosureVerified: false,
    productionComputeBudgetProven: false,
    productionProgramErrorAbiProven: false,
    productionDispatcherProven: false,
    productionEntrypointProven: false,
    productionFinalCombinedBinaryProven: false,
    productionIdentitiesFrozen: false,
    publicDevnetExecuted: false,
    adversarialFinalBinaryDevnetComplete: false,
    all15HandlersComplete: false,
    releaseGraphNodeComplete: false,
    activationReady: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  emit({
    schema: SCHEMA,
    status: "PASS",
    phase: "evidence",
    output: relative(siteRoot, output).replaceAll("\\", "/"),
    sourceCount: sourceLedger.length,
    mainnetStatus: "HOLD",
  });
}

function emit(record) {
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

const args = parseArgs(process.argv.slice(2));
const mode = required(args, "mode");
try {
  if (mode === "prepare-fixture") prepareFixture(args);
  else if (mode === "finalize-evidence") finalizeEvidence(args);
  else await execute(args);
} catch (error) {
  process.stderr.write(`${SCHEMA}: ${error.stack ?? error.message}\n`);
  process.exitCode = 1;
}
