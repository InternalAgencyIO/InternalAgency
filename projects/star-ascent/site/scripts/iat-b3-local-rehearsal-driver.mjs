import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createExecuteInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getExtensionTypes,
  getExtraAccountMetaAddress,
  getMint,
  getTransferHook,
} from "@solana/spl-token";

export const LAW_STATE_LEN = 160;
export const ENTROPY_LAG_SLOTS = 150n;
export const IAT_PROTOCOL_OFFSET_SECONDS = 10_800n;
export const DAILY_DECISION_LOCAL_SECOND = 60n;
export const SECONDS_PER_DAY = 86_400n;
export const DRAW_DENOMINATOR = 10_000n;
export const NORMAL_DAY_LOCKDOWN_NUMERATOR = 100n;
export const FRIDAY_LOCKDOWN_NUMERATOR = 6_667n;
export const SOLANA_DAILY_LAW_ID = Buffer.from("IAT_B3_SOLANA_DAILY_LAW_V1", "ascii");

const LAW_NAMESPACE = Buffer.from("IATB3LAW", "ascii");
const LAW_STATE_MAGIC = Buffer.from("IATB3S01", "ascii");
const LOCAL_NETWORK_ID = Buffer.from(
  createHash("sha256").update("IAT_B3_DISPOSABLE_LOCAL_REHEARSAL_V1").digest(),
);
const IAT_TOTAL_BASE_UNITS = 1_000_000_000_000_000_000n;
const UPGRADEABLE_LOADER_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const CONFIRMED = Object.freeze({
  commitment: "confirmed",
  preflightCommitment: "confirmed",
});

function parseArgs(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new TypeError(`invalid argument near ${key ?? "<end>"}`);
    }
    parsed.set(key.slice(2), value);
  }
  return parsed;
}

function required(args, key) {
  const value = args.get(key);
  if (!value) throw new TypeError(`missing --${key}`);
  return value;
}

function readKeypair(path) {
  const secret = JSON.parse(readFileSync(path, "utf8"));
  assert(Array.isArray(secret) && secret.length === 64, "keypair must contain 64 bytes");
  assert(secret.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function sha256(...parts) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest();
}

function u64be(value) {
  const output = Buffer.alloc(8);
  output.writeBigUInt64BE(BigInt(value));
  return output;
}

function floorDiv(dividend, divisor) {
  const quotient = dividend / divisor;
  const remainder = dividend % divisor;
  return remainder < 0n ? quotient - 1n : quotient;
}

function floorMod(dividend, divisor) {
  const remainder = dividend % divisor;
  return remainder < 0n ? remainder + divisor : remainder;
}

export function protocolLocalDay(unixTimestamp) {
  return floorDiv(
    BigInt(unixTimestamp) + IAT_PROTOCOL_OFFSET_SECONDS - DAILY_DECISION_LOCAL_SECOND,
    SECONDS_PER_DAY,
  );
}

function chanceNumerator(localDay) {
  return floorMod(BigInt(localDay), 7n) === 1n
    ? FRIDAY_LOCKDOWN_NUMERATOR
    : NORMAL_DAY_LOCKDOWN_NUMERATOR;
}

export function deriveSolanaDraw({
  ancestorSlotHash,
  localDay,
  entropySlot,
  networkGenesisHash,
  mint,
}) {
  const day = BigInt(localDay);
  const slot = BigInt(entropySlot);
  const ancestor = Buffer.from(ancestorSlotHash);
  const network = Buffer.from(networkGenesisHash);
  const mintBytes = mint instanceof PublicKey ? mint.toBuffer() : Buffer.from(mint);
  assert.equal(ancestor.length, 32);
  assert.equal(network.length, 32);
  assert.equal(mintBytes.length, 32);

  const unbiasedLimit = (1n << 256n) - ((1n << 256n) % DRAW_DENOMINATOR);
  const numerator = chanceNumerator(day);
  for (let counter = 0n; counter <= 0xffff_ffff_ffff_ffffn; counter += 1n) {
    const digest = sha256(
      SOLANA_DAILY_LAW_ID,
      Buffer.from([0]),
      network,
      Buffer.from([0]),
      mintBytes,
      Buffer.from([0]),
      Buffer.from(day.toString(10), "ascii"),
      Buffer.from([0]),
      u64be(slot),
      Buffer.from([0]),
      ancestor,
      u64be(counter),
    );
    const sample = BigInt(`0x${digest.toString("hex")}`);
    if (sample >= unbiasedLimit) continue;
    const bucket = sample % DRAW_DENOMINATOR;
    return Object.freeze({
      localDay: day,
      entropySlot: slot,
      ancestorSlotHash: ancestor,
      drawCounter: counter,
      drawBucket: bucket,
      chanceNumerator: numerator,
      chanceDenominator: DRAW_DENOMINATOR,
      locked: bucket < numerator,
    });
  }
  throw new RangeError("draw counter exhausted");
}

export function parseLawState(data) {
  const bytes = Buffer.from(data);
  assert.equal(bytes.length, LAW_STATE_LEN, "law state length mismatch");
  assert(bytes.subarray(0, 8).equals(LAW_STATE_MAGIC), "law state magic mismatch");
  assert.equal(bytes[8], 1, "law state version mismatch");
  assert(bytes.subarray(12, 16).every((byte) => byte === 0), "reserved prefix is nonzero");
  assert(bytes.subarray(142).every((byte) => byte === 0), "reserved suffix is nonzero");
  const present = bytes[10];
  assert(present === 0 || present === 1, "invalid decision presence byte");
  if (present === 0) {
    assert(bytes.subarray(11, 12).every((byte) => byte === 0));
    assert(bytes.subarray(80, 142).every((byte) => byte === 0));
  }
  const decision = present === 0
    ? null
    : Object.freeze({
        localDay: bytes.readBigInt64LE(80),
        entropySlot: bytes.readBigUInt64LE(88),
        ancestorSlotHash: Buffer.from(bytes.subarray(96, 128)),
        drawCounter: bytes.readBigUInt64LE(128),
        drawBucket: BigInt(bytes.readUInt16LE(136)),
        chanceNumerator: BigInt(bytes.readUInt16LE(138)),
        chanceDenominator: BigInt(bytes.readUInt16LE(140)),
        locked: bytes[11] === 1,
      });
  if (present === 1) assert(bytes[11] === 0 || bytes[11] === 1, "invalid locked byte");
  return Object.freeze({
    bump: bytes[9],
    mint: new PublicKey(bytes.subarray(16, 48)),
    networkGenesisHash: Buffer.from(bytes.subarray(48, 80)),
    decision,
  });
}

export function packDecisionIntoLawState(baseData, decision) {
  const output = Buffer.from(baseData);
  assert.equal(output.length, LAW_STATE_LEN);
  output.fill(0, 80, 142);
  if (decision === null) {
    output[10] = 0;
    output[11] = 0;
    return output;
  }
  output[10] = 1;
  output[11] = Number(decision.locked);
  output.writeBigInt64LE(BigInt(decision.localDay), 80);
  output.writeBigUInt64LE(BigInt(decision.entropySlot), 88);
  Buffer.from(decision.ancestorSlotHash).copy(output, 96);
  output.writeBigUInt64LE(BigInt(decision.drawCounter), 128);
  output.writeUInt16LE(Number(decision.drawBucket), 136);
  output.writeUInt16LE(Number(decision.chanceNumerator), 138);
  output.writeUInt16LE(Number(decision.chanceDenominator), 140);
  return output;
}

function parseClock(data) {
  const bytes = Buffer.from(data);
  assert(bytes.length >= 40, "Clock sysvar is too short");
  return Object.freeze({
    slot: bytes.readBigUInt64LE(0),
    unixTimestamp: bytes.readBigInt64LE(32),
  });
}

function parseSlotHashes(data) {
  const bytes = Buffer.from(data);
  assert(bytes.length >= 8, "SlotHashes sysvar is too short");
  const count = bytes.readBigUInt64LE(0);
  assert(count <= 100_000n, "SlotHashes count is unreasonable");
  assert(bytes.length >= 8 + Number(count) * 40, "SlotHashes data is truncated");
  const entries = [];
  for (let index = 0; index < Number(count); index += 1) {
    const offset = 8 + index * 40;
    entries.push(Object.freeze({
      slot: bytes.readBigUInt64LE(offset),
      hash: Buffer.from(bytes.subarray(offset + 8, offset + 40)),
    }));
  }
  return entries;
}

async function getClock(connection) {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
  assert(info, "Clock sysvar is missing");
  return parseClock(info.data);
}

async function inspectProgramDeployment(connection, program) {
  if (!program.owner.equals(UPGRADEABLE_LOADER_ID)) {
    return Object.freeze({
      owner: program.owner.toBase58(),
      loaderProfile: "non-upgradeable-loader",
      upgradeAuthority: null,
    });
  }
  const bytes = Buffer.from(program.data);
  assert.equal(bytes.length, 36, "upgradeable program account length mismatch");
  assert.equal(bytes.readUInt32LE(0), 2, "upgradeable program discriminator mismatch");
  const programDataAddress = new PublicKey(bytes.subarray(4, 36));
  const programData = await connection.getAccountInfo(programDataAddress, "confirmed");
  assert(programData?.owner.equals(UPGRADEABLE_LOADER_ID));
  assert(programData.data.length >= 13, "program-data account is too short");
  assert.equal(programData.data.readUInt32LE(0), 3, "program-data discriminator mismatch");
  assert.equal(programData.data[12], 0, "local Genesis program unexpectedly has an upgrade authority");
  return Object.freeze({
    owner: program.owner.toBase58(),
    loaderProfile: "upgradeable-loader-with-frozen-program-data",
    programData: programDataAddress.toBase58(),
    upgradeAuthority: null,
  });
}

async function getTransaction(connection, signature) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const transaction = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (transaction) return transaction;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("confirmed transaction was not available through RPC");
}

let transactionSequence = 0;

async function sendInstructions(connection, payer, instructions) {
  transactionSequence += 1;
  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 + transactionSequence }),
  );
  for (const instruction of instructions) transaction.add(instruction);
  return sendAndConfirmTransaction(connection, transaction, [payer], CONFIRMED);
}

async function failureText(connection, error) {
  const parts = [String(error?.message ?? error)];
  let logs = error?.logs;
  if ((!logs || logs.length === 0) && typeof error?.getLogs === "function") {
    try {
      logs = await error.getLogs(connection);
    } catch {
      // The original transaction error remains authoritative.
    }
  }
  if (logs) parts.push(...logs);
  return parts.join("\n");
}

export function matchesCustomError(text, code) {
  const hex = Number(code).toString(16);
  return new RegExp(`custom program error: 0x0*${hex}(?:\\b|$)`, "iu").test(text)
    || new RegExp(`Custom[(:\\s]+${Number(code)}(?:[)}\\s,]|$)`, "iu").test(text);
}

async function expectCustomFailure(connection, label, code, action) {
  try {
    await action();
  } catch (error) {
    const text = await failureText(connection, error);
    const observed = [
      ...text.matchAll(/custom program error: 0x([0-9a-f]+)/giu),
    ].map((match) => Number.parseInt(match[1], 16));
    assert(
      matchesCustomError(text, code),
      `${label} expected custom error ${code}; observed ${JSON.stringify(observed)}`,
    );
    return Object.freeze({ label, customError: code, rejected: true });
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

async function transferInstruction(connection, source, mint, destination, owner) {
  return createTransferCheckedWithTransferHookInstruction(
    connection,
    source,
    mint,
    destination,
    owner,
    1n,
    9,
    [],
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
}

function accountFixture(pubkey, account, data = account.data) {
  const bytes = Buffer.from(data);
  return {
    pubkey: pubkey.toBase58(),
    account: {
      lamports: account.lamports,
      data: [bytes.toString("base64"), "base64"],
      owner: account.owner.toBase58(),
      executable: account.executable,
      rentEpoch: 0,
      space: bytes.length,
    },
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value)}\n`, "utf8");
}

function findSyntheticDecision({ localDay, mint, networkGenesisHash, locked }) {
  for (let entropySlot = 1n; entropySlot <= 100_000n; entropySlot += 1n) {
    const ancestorSlotHash = sha256(
      Buffer.from("IAT_B3_SYNTHETIC_GATE_VECTOR_V1", "ascii"),
      u64be(entropySlot),
    );
    const decision = deriveSolanaDraw({
      ancestorSlotHash,
      localDay,
      entropySlot,
      networkGenesisHash,
      mint,
    });
    if (decision.locked === locked) return decision;
  }
  throw new Error(`could not derive a synthetic ${locked ? "locked" : "open"} decision`);
}

async function prepareFixtures({
  connection,
  fixtureDir,
  programId,
  mint,
  source,
  destination,
  lawState,
  validation,
  localDay,
  networkGenesisHash,
}) {
  const addresses = [mint, source, destination, lawState, validation];
  const accounts = await connection.getMultipleAccountsInfo(addresses, "confirmed");
  assert(accounts.every(Boolean), "fixture account is missing");
  const [mintInfo, sourceInfo, destinationInfo, lawInfo, validationInfo] = accounts;
  const baseState = parseLawState(lawInfo.data);
  assert.equal(baseState.decision, null);
  assert(baseState.mint.equals(mint));
  assert(baseState.networkGenesisHash.equals(networkGenesisHash));

  const shared = [
    ["mint.json", mint, mintInfo],
    ["source.json", source, sourceInfo],
    ["destination.json", destination, destinationInfo],
    ["validation.json", validation, validationInfo],
  ];
  for (const [name, pubkey, info] of shared) {
    writeJson(join(fixtureDir, name), accountFixture(pubkey, info));
  }

  const open = findSyntheticDecision({
    localDay,
    mint,
    networkGenesisHash,
    locked: false,
  });
  const locked = findSyntheticDecision({
    localDay,
    mint,
    networkGenesisHash,
    locked: true,
  });
  const stale = findSyntheticDecision({
    localDay: localDay - 1n,
    mint,
    networkGenesisHash,
    locked: false,
  });
  const forged = {
    ...open,
    drawBucket: (open.drawBucket + 1n) % DRAW_DENOMINATOR,
  };
  const variants = new Map([
    ["missing", null],
    ["stale", stale],
    ["open", open],
    ["locked", locked],
    ["forged", forged],
  ]);
  for (const [name, decision] of variants) {
    const data = packDecisionIntoLawState(lawInfo.data, decision);
    writeJson(
      join(fixtureDir, `law-${name}.json`),
      accountFixture(lawState, lawInfo, data),
    );
  }
  writeFileSync(
    join(fixtureDir, "accounts.env"),
    [
      `PROGRAM_ID=${programId.toBase58()}`,
      `MINT=${mint.toBase58()}`,
      `SOURCE=${source.toBase58()}`,
      `DESTINATION=${destination.toBase58()}`,
      `LAW_STATE=${lawState.toBase58()}`,
      `VALIDATION=${validation.toBase58()}`,
      "",
    ].join("\n"),
    "utf8",
  );
  return Object.freeze({
    openBucket: open.drawBucket.toString(),
    lockedBucket: locked.drawBucket.toString(),
    staleDay: stale.localDay.toString(),
  });
}

async function baseline(args) {
  const connection = new Connection(required(args, "rpc"), "confirmed");
  const payer = readKeypair(required(args, "payer"));
  const recipient = readKeypair(required(args, "recipient"));
  const mint = new PublicKey(required(args, "mint"));
  const programId = new PublicKey(required(args, "program-id"));
  const fixtureDir = required(args, "fixture-dir");
  const artifactSha256 = required(args, "artifact-sha256");
  const source = getAssociatedTokenAddressSync(
    mint,
    payer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const destination = getAssociatedTokenAddressSync(
    mint,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const [lawState, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("law-state", "ascii"), mint.toBuffer()],
    programId,
  );
  const validation = getExtraAccountMetaAddress(mint, programId);

  const program = await connection.getAccountInfo(programId, "confirmed");
  assert(program?.executable, "local law program is not executable");
  const programDeployment = await inspectProgramDeployment(connection, program);
  const mintState = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  const transferHook = getTransferHook(mintState);
  const extensionTypes = getExtensionTypes(mintState.tlvData);
  assert.equal(mintState.decimals, 9);
  assert.equal(mintState.supply, IAT_TOTAL_BASE_UNITS);
  assert.equal(mintState.mintAuthority, null);
  assert.equal(mintState.freezeAuthority, null);
  assert(extensionTypes.includes(ExtensionType.ConfidentialTransferMint));
  assert(extensionTypes.includes(ExtensionType.TransferHook));
  assert(transferHook?.authority.equals(payer.publicKey));
  assert(transferHook?.programId.equals(programId));

  const initialize = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: lawState, isSigner: false, isWritable: true },
      { pubkey: validation, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([LAW_NAMESPACE, Buffer.from([0]), LOCAL_NETWORK_ID]),
  });
  const initializeSignature = await sendInstructions(connection, payer, [initialize]);
  const initialized = await connection.getAccountInfo(lawState, "confirmed");
  assert(initialized?.owner.equals(programId));
  const initializedState = parseLawState(initialized.data);
  assert.equal(initializedState.bump, bump);
  assert.equal(initializedState.decision, null);
  const validationInfo = await connection.getAccountInfo(validation, "confirmed");
  assert(validationInfo?.owner.equals(programId));

  const clockAtInitialization = await getClock(connection);
  const fixtureMetadata = await prepareFixtures({
    connection,
    fixtureDir,
    programId,
    mint,
    source,
    destination,
    lawState,
    validation,
    localDay: protocolLocalDay(clockAtInitialization.unixTimestamp),
    networkGenesisHash: LOCAL_NETWORK_ID,
  });

  const missingDay = await expectCustomFailure(
    connection,
    "missing-day transfer",
    7,
    async () => sendInstructions(connection, payer, [
      await transferInstruction(connection, source, mint, destination, payer.publicKey),
    ]),
  );
  const directExecute = createExecuteInstruction(
    programId,
    source,
    mint,
    destination,
    payer.publicKey,
    validation,
    1n,
  );
  directExecute.keys.push({ pubkey: lawState, isSigner: false, isWritable: false });
  const directBypass = await expectCustomFailure(
    connection,
    "direct hook execute",
    12,
    async () => sendInstructions(connection, payer, [directExecute]),
  );

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const slot = BigInt(await connection.getSlot("confirmed"));
    if (slot > ENTROPY_LAG_SLOTS + 5n) break;
    if (attempt === 399) throw new Error("validator did not produce enough entropy slots");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  const finalize = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: lawState, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([LAW_NAMESPACE, Buffer.from([1])]),
  });
  const finalizeSignature = await sendInstructions(connection, payer, [finalize]);
  const finalizeTransaction = await getTransaction(connection, finalizeSignature);
  const finalizedInfo = await connection.getAccountInfo(lawState, "confirmed");
  assert(finalizedInfo);
  const finalizedState = parseLawState(finalizedInfo.data);
  assert(finalizedState.decision, "finalized decision is absent");
  const decision = finalizedState.decision;
  const recomputed = deriveSolanaDraw({
    ancestorSlotHash: decision.ancestorSlotHash,
    localDay: decision.localDay,
    entropySlot: decision.entropySlot,
    networkGenesisHash: finalizedState.networkGenesisHash,
    mint,
  });
  assert.equal(decision.drawCounter, recomputed.drawCounter);
  assert.equal(decision.drawBucket, recomputed.drawBucket);
  assert.equal(decision.chanceNumerator, recomputed.chanceNumerator);
  assert.equal(decision.chanceDenominator, recomputed.chanceDenominator);
  assert.equal(decision.locked, recomputed.locked);
  const slotHashesInfo = await connection.getAccountInfo(SYSVAR_SLOT_HASHES_PUBKEY, "confirmed");
  assert(slotHashesInfo, "SlotHashes sysvar is missing");
  const entries = parseSlotHashes(slotHashesInfo.data);
  const targetSlot = BigInt(finalizeTransaction.slot) - ENTROPY_LAG_SLOTS;
  const selected = entries.find((entry) => entry.slot <= targetSlot);
  assert(selected, "lagged entropy entry is absent");
  assert.equal(decision.entropySlot, selected.slot);
  assert(decision.ancestorSlotHash.equals(selected.hash));
  const clockAfterFinalization = await getClock(connection);
  assert.equal(decision.localDay, protocolLocalDay(clockAfterFinalization.unixTimestamp));

  const reroll = await expectCustomFailure(
    connection,
    "same-day reroll",
    9,
    async () => sendInstructions(connection, payer, [finalize]),
  );
  const sourceBefore = await getAccount(connection, source, "confirmed", TOKEN_2022_PROGRAM_ID);
  const destinationBefore = await getAccount(
    connection,
    destination,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
  let finalizedTransfer;
  if (decision.locked) {
    const rejected = await expectCustomFailure(
      connection,
      "selected finalized transfer",
      8,
      async () => sendInstructions(connection, payer, [
        await transferInstruction(connection, source, mint, destination, payer.publicKey),
      ]),
    );
    finalizedTransfer = { disposition: "locked", ...rejected };
  } else {
    const signature = await sendInstructions(connection, payer, [
      await transferInstruction(connection, source, mint, destination, payer.publicKey),
    ]);
    finalizedTransfer = { disposition: "open", signature, accepted: true };
  }
  const sourceAfter = await getAccount(connection, source, "confirmed", TOKEN_2022_PROGRAM_ID);
  const destinationAfter = await getAccount(
    connection,
    destination,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
  if (decision.locked) {
    assert.equal(sourceAfter.amount, sourceBefore.amount);
    assert.equal(destinationAfter.amount, destinationBefore.amount);
  } else {
    assert.equal(sourceAfter.amount, sourceBefore.amount - 1n);
    assert.equal(destinationAfter.amount, destinationBefore.amount + 1n);
  }

  emit({
    schema: "iat-b3-local-validator-rehearsal/v1",
    status: "PASS",
    mode: "baseline",
    rpcScope: "loopback-only",
    artifact: { sha256: artifactSha256 },
    program: {
      id: programId.toBase58(),
      executable: true,
      ...programDeployment,
    },
    mint: {
      id: mint.toBase58(),
      decimals: mintState.decimals,
      supplyBaseUnits: mintState.supply.toString(),
      mintAuthority: null,
      freezeAuthority: null,
      extensions: ["ConfidentialTransferMint", "TransferHook"],
      transferHookProgramId: transferHook.programId.toBase58(),
    },
    accounts: {
      lawState: lawState.toBase58(),
      validation: validation.toBase58(),
    },
    checks: {
      initializeSignature,
      missingDay,
      directBypass,
      finalizeSignature,
      finalizeSlot: finalizeTransaction.slot,
      entropySlot: decision.entropySlot.toString(),
      slotHashSelectionMatched: true,
      decisionRecomputed: true,
      localDay: decision.localDay.toString(),
      drawBucket: decision.drawBucket.toString(),
      chanceNumerator: decision.chanceNumerator.toString(),
      chanceDenominator: decision.chanceDenominator.toString(),
      locked: decision.locked,
      reroll,
      finalizedTransfer,
    },
    syntheticFixtures: {
      variants: ["missing", "stale", "open", "locked", "forged"],
      ...fixtureMetadata,
    },
  });
}

async function variant(args) {
  const connection = new Connection(required(args, "rpc"), "confirmed");
  const payer = readKeypair(required(args, "payer"));
  const mint = new PublicKey(required(args, "mint"));
  const source = new PublicKey(required(args, "source"));
  const destination = new PublicKey(required(args, "destination"));
  const programId = new PublicKey(required(args, "program-id"));
  const lawState = new PublicKey(required(args, "law-state"));
  const name = required(args, "variant");
  const stateInfo = await connection.getAccountInfo(lawState, "confirmed");
  assert(stateInfo?.owner.equals(programId));
  const state = parseLawState(stateInfo.data);
  const clock = await getClock(connection);
  const currentDay = protocolLocalDay(clock.unixTimestamp);
  if (name === "missing") assert.equal(state.decision, null);
  if (name === "stale") assert(state.decision && state.decision.localDay !== currentDay);
  if (["open", "locked", "forged"].includes(name)) {
    assert.equal(state.decision?.localDay, currentDay, "fixture crossed a protocol-day boundary");
  }
  if (name === "open") assert.equal(state.decision?.locked, false);
  if (name === "locked") assert.equal(state.decision?.locked, true);

  const sourceBefore = await getAccount(connection, source, "confirmed", TOKEN_2022_PROGRAM_ID);
  const destinationBefore = await getAccount(
    connection,
    destination,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
  const expectedErrors = new Map([
    ["missing", 7],
    ["stale", 7],
    ["locked", 8],
    ["forged", 11],
  ]);
  let transfer;
  if (name === "open") {
    const signature = await sendInstructions(connection, payer, [
      await transferInstruction(connection, source, mint, destination, payer.publicKey),
    ]);
    transfer = { accepted: true, signature };
  } else {
    const code = expectedErrors.get(name);
    assert.notEqual(code, undefined, `unknown variant: ${name}`);
    transfer = await expectCustomFailure(
      connection,
      `${name} fixture transfer`,
      code,
      async () => sendInstructions(connection, payer, [
        await transferInstruction(connection, source, mint, destination, payer.publicKey),
      ]),
    );
  }
  const sourceAfter = await getAccount(connection, source, "confirmed", TOKEN_2022_PROGRAM_ID);
  const destinationAfter = await getAccount(
    connection,
    destination,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
  if (name === "open") {
    assert.equal(sourceAfter.amount, sourceBefore.amount - 1n);
    assert.equal(destinationAfter.amount, destinationBefore.amount + 1n);
  } else {
    assert.equal(sourceAfter.amount, sourceBefore.amount);
    assert.equal(destinationAfter.amount, destinationBefore.amount);
  }

  emit({
    schema: "iat-b3-local-validator-rehearsal/v1",
    status: "PASS",
    mode: "synthetic-gate-variant",
    variant: name,
    stateSource: name === "missing"
      ? "initialized-empty-state"
      : name === "forged"
        ? "kernel-decision-with-tampered-bucket"
        : "kernel-valid-fixture",
    currentProtocolDay: currentDay.toString(),
    transfer,
    balancesChanged: name === "open",
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = required(args, "mode");
  if (mode === "baseline") return baseline(args);
  if (mode === "variant") return variant(args);
  throw new TypeError(`unknown mode: ${mode}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`IAT B3 local rehearsal driver failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
