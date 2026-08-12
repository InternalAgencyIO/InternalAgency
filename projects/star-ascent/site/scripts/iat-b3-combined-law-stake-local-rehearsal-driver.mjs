#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  createApproveCheckedInstruction,
  createExecuteInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAccount,
  getExtensionData,
  getExtensionTypes,
  getExtraAccountMetaAddress,
  getMint,
  getTransferHook,
} from "@solana/spl-token";
import {
  DRAW_DENOMINATOR,
  ENTROPY_LAG_SLOTS,
  deriveSolanaDraw,
  matchesCustomError,
  packDecisionIntoLawState,
  parseLawState,
  protocolLocalDay,
} from "./iat-b3-local-rehearsal-driver.mjs";

const SCHEMA = "iat-b3-combined-law-stake-local-validator/v1";
const LAW_PROGRAM_ID = new PublicKey("D6UucuMprPAYyCmr5UPU5h9YhRf2ZNtn23JTS32EjdjY");
const ECONOMY_PROGRAM_ID = new PublicKey("GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU");
const NETWORK_GENESIS_HASH = Buffer.alloc(32, 0x91);
const LAW_NAMESPACE = Buffer.from("IATB3LAW", "ascii");
const TOKEN_DECIMALS = 9;
const TOTAL_SUPPLY_BASE_UNITS = 1_000_000_000_000_000_000n;
const CONFIRMED = Object.freeze({ commitment: "confirmed", preflightCommitment: "confirmed" });

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
  const bytes = JSON.parse(readFileSync(path, "utf8"));
  assert(Array.isArray(bytes) && bytes.length === 64, "keypair must contain 64 bytes");
  assert(bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255));
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function u64le(value) {
  const output = Buffer.alloc(8);
  output.writeBigUInt64LE(BigInt(value));
  return output;
}

function u64be(value) {
  const output = Buffer.alloc(8);
  output.writeBigUInt64BE(BigInt(value));
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
  assert(bytes.length >= 8 + Number(count) * 40, "SlotHashes sysvar is truncated");
  return Array.from({ length: Number(count) }, (_, index) => {
    const offset = 8 + index * 40;
    return Object.freeze({
      slot: bytes.readBigUInt64LE(offset),
      hash: Buffer.from(bytes.subarray(offset + 8, offset + 40)),
    });
  });
}

async function clock(connection) {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
  assert(info, "Clock sysvar is absent");
  return parseClock(info.data);
}

async function transaction(connection, signature) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`confirmed transaction ${signature} is unavailable`);
}

let transactionSequence = 0;
async function send(connection, payer, instructions) {
  transactionSequence += 1;
  const value = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 + transactionSequence }),
    ...instructions,
  );
  const signature = await sendAndConfirmTransaction(connection, value, [payer], CONFIRMED);
  const confirmed = await transaction(connection, signature);
  assert(confirmed.meta && confirmed.meta.err === null, "confirmed transaction failed");
  return Object.freeze({ signature, logs: confirmed.meta.logMessages ?? [], slot: confirmed.slot });
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

async function expectCustomFailure(connection, label, code, action) {
  try {
    await action();
  } catch (error) {
    const text = await failureText(connection, error);
    assert(matchesCustomError(text, code), `${label} expected custom error ${code}:\n${text}`);
    return Object.freeze({ label, rejected: true, customError: code });
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

async function tokenSnapshot(connection, addresses) {
  const entries = await Promise.all(addresses.map(async (address) => {
    const [raw, parsed] = await Promise.all([
      connection.getAccountInfo(address, "confirmed"),
      getAccount(connection, address, "confirmed", TOKEN_2022_PROGRAM_ID),
    ]);
    assert(raw, `missing token account ${address.toBase58()}`);
    return [address.toBase58(), Object.freeze({
      amount: parsed.amount,
      delegate: parsed.delegate?.toBase58() ?? null,
      delegatedAmount: parsed.delegatedAmount,
      rawDataSha256: sha256(raw.data),
      lamports: raw.lamports,
      owner: raw.owner.toBase58(),
    })];
  }));
  return Object.freeze(Object.fromEntries(entries));
}

function assertSnapshotEqual(actual, expected, label) {
  assert.deepEqual(actual, expected, `${label} did not roll back exact token bytes and balances`);
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

function findSyntheticDecision({ localDay, mint, locked }) {
  for (let entropySlot = 1n; entropySlot <= 100_000n; entropySlot += 1n) {
    const ancestorSlotHash = createHash("sha256")
      .update("IAT_B3_COMBINED_SYNTHETIC_GATE_VECTOR_V1", "ascii")
      .update(u64be(entropySlot))
      .digest();
    const decision = deriveSolanaDraw({
      ancestorSlotHash,
      localDay,
      entropySlot,
      networkGenesisHash: NETWORK_GENESIS_HASH,
      mint,
    });
    if (decision.locked === locked) return decision;
  }
  throw new Error(`unable to derive synthetic ${locked ? "locked" : "open"} decision`);
}

async function prepareFixtures({
  connection,
  fixtureDir,
  mint,
  source,
  recipient,
  vault,
  ingress,
  validation,
  lawState,
  localDay,
}) {
  const addresses = [mint, source, recipient, vault, ingress, validation, lawState];
  const infos = await connection.getMultipleAccountsInfo(addresses, "confirmed");
  assert(infos.every(Boolean), "one or more rehearsal fixture accounts are absent");
  const [mintInfo, sourceInfo, recipientInfo, vaultInfo, ingressInfo, validationInfo, lawInfo] = infos;
  const base = parseLawState(lawInfo.data);
  assert.equal(base.decision, null);
  assert(base.mint.equals(mint));
  assert(base.networkGenesisHash.equals(NETWORK_GENESIS_HASH));
  for (const [name, key, info] of [
    ["mint.json", mint, mintInfo],
    ["source.json", source, sourceInfo],
    ["recipient.json", recipient, recipientInfo],
    ["vault.json", vault, vaultInfo],
    ["ingress.json", ingress, ingressInfo],
    ["validation.json", validation, validationInfo],
  ]) writeJson(join(fixtureDir, name), accountFixture(key, info));

  const open = findSyntheticDecision({ localDay, mint, locked: false });
  const locked = findSyntheticDecision({ localDay, mint, locked: true });
  const stale = findSyntheticDecision({ localDay: localDay - 1n, mint, locked: false });
  const forged = { ...open, drawBucket: (open.drawBucket + 1n) % DRAW_DENOMINATOR };
  for (const [name, decision] of new Map([
    ["missing", null],
    ["stale", stale],
    ["open", open],
    ["locked", locked],
    ["forged", forged],
  ])) {
    writeJson(
      join(fixtureDir, `law-${name}.json`),
      accountFixture(lawState, lawInfo, packDecisionIntoLawState(lawInfo.data, decision)),
    );
  }
  writeFileSync(join(fixtureDir, "accounts.env"), [
    `MINT=${mint.toBase58()}`,
    `SOURCE=${source.toBase58()}`,
    `RECIPIENT_TOKEN=${recipient.toBase58()}`,
    `STAKE_VAULT=${vault.toBase58()}`,
    `INGRESS_AUTHORITY=${ingress.toBase58()}`,
    `VALIDATION=${validation.toBase58()}`,
    `LAW_STATE=${lawState.toBase58()}`,
    "",
  ].join("\n"), "utf8");
  return Object.freeze({
    labels: "DETERMINISTIC_SYNTHETIC_GATE_VARIANTS_NOT_FINALIZER_PROVENANCE",
    variants: ["missing", "stale", "open", "locked", "forged"],
    openBucket: open.drawBucket.toString(),
    lockedBucket: locked.drawBucket.toString(),
    staleDay: stale.localDay.toString(),
  });
}

function initializeLawInstruction(owner, mint, lawState, validation) {
  return new TransactionInstruction({
    programId: LAW_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: lawState, isSigner: false, isWritable: true },
      { pubkey: validation, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([LAW_NAMESPACE, Buffer.from([0]), NETWORK_GENESIS_HASH]),
  });
}

function finalizeLawInstruction(mint, lawState) {
  return new TransactionInstruction({
    programId: LAW_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: lawState, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([LAW_NAMESPACE, Buffer.from([1])]),
  });
}

function initializeVaultInstruction(owner, mint, vault) {
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]),
  });
}

function economyIngressInstruction({ owner, source, mint, vault, ingress, priorDelegate, validation, lawState, amount }) {
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: ingress, isSigner: false, isWritable: false },
      { pubkey: priorDelegate, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: LAW_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: validation, isSigner: false, isWritable: false },
      { pubkey: lawState, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([1]), u64le(amount)]),
  });
}

async function ordinaryTransfer(connection, source, mint, destination, authority, amount = 1n) {
  return createTransferCheckedWithTransferHookInstruction(
    connection,
    source,
    mint,
    destination,
    authority,
    amount,
    TOKEN_DECIMALS,
    [],
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
}

function assertLawInvocation(logs, label) {
  const marker = `Program ${LAW_PROGRAM_ID.toBase58()} invoke`;
  assert(logs.some((line) => line.includes(marker)), `${label} did not invoke the exact Law ELF`);
}

async function setup(args) {
  const connection = new Connection(required(args, "rpc"), "confirmed");
  const owner = readKeypair(required(args, "owner"));
  const mint = new PublicKey(required(args, "mint"));
  const source = new PublicKey(required(args, "source"));
  const recipient = new PublicKey(required(args, "recipient-token"));
  const priorDelegate = new PublicKey(required(args, "prior-delegate"));
  const fixtureDir = required(args, "fixture-dir");
  const lawSha256 = required(args, "law-sha256");
  const economySha256 = required(args, "economy-sha256");
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), mint.toBuffer()], ECONOMY_PROGRAM_ID);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("stake-token"), config.toBuffer()], ECONOMY_PROGRAM_ID);
  const [ingress] = PublicKey.findProgramAddressSync([Buffer.from("stake-ingress"), config.toBuffer()], ECONOMY_PROGRAM_ID);
  const [lawState, lawBump] = PublicKey.findProgramAddressSync([Buffer.from("law-state"), mint.toBuffer()], LAW_PROGRAM_ID);
  const validation = getExtraAccountMetaAddress(mint, LAW_PROGRAM_ID);

  const [lawProgram, economyProgram] = await connection.getMultipleAccountsInfo(
    [LAW_PROGRAM_ID, ECONOMY_PROGRAM_ID], "confirmed",
  );
  assert(lawProgram?.executable && economyProgram?.executable, "fixture programs are not executable");

  let mintState = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  let hook = getTransferHook(mintState);
  const extensionTypes = getExtensionTypes(mintState.tlvData);
  assert.equal(mintState.decimals, TOKEN_DECIMALS);
  assert.equal(mintState.supply, TOTAL_SUPPLY_BASE_UNITS);
  assert.equal(mintState.mintAuthority, null);
  assert.equal(mintState.freezeAuthority, null);
  assert.deepEqual(
    [...extensionTypes].sort((a, b) => a - b),
    [ExtensionType.ConfidentialTransferMint, ExtensionType.TransferHook].sort((a, b) => a - b),
  );
  assert(hook?.programId.equals(LAW_PROGRAM_ID));
  assert(hook?.authority.equals(owner.publicKey));
  let confidential = Buffer.from(getExtensionData(ExtensionType.ConfidentialTransferMint, mintState.tlvData));
  assert(confidential.subarray(0, 32).equals(owner.publicKey.toBuffer()));
  assert.equal(confidential[32], 1);
  assert(confidential.subarray(33, 65).every((byte) => byte === 0));

  const initialized = await send(connection, owner, [
    initializeLawInstruction(owner.publicKey, mint, lawState, validation),
  ]);
  const lawInfo = await connection.getAccountInfo(lawState, "confirmed");
  assert(lawInfo?.owner.equals(LAW_PROGRAM_ID));
  const initializedState = parseLawState(lawInfo.data);
  assert.equal(initializedState.bump, lawBump);
  assert.equal(initializedState.decision, null);
  assert(initializedState.networkGenesisHash.equals(NETWORK_GENESIS_HASH));
  assert((await connection.getAccountInfo(validation, "confirmed"))?.owner.equals(LAW_PROGRAM_ID));
  mintState = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  hook = getTransferHook(mintState);
  confidential = Buffer.from(getExtensionData(ExtensionType.ConfidentialTransferMint, mintState.tlvData));
  assert(hook?.programId.equals(LAW_PROGRAM_ID));
  assert(hook?.authority.equals(PublicKey.default));
  assert(confidential.subarray(0, 32).every((byte) => byte === 0));
  assert.equal(confidential[32], 1);

  const vaultInitialization = await send(connection, owner, [
    initializeVaultInstruction(owner.publicKey, mint, vault),
  ]);
  assert.equal((await getAccount(connection, vault, "confirmed", TOKEN_2022_PROGRAM_ID)).amount, 0n);
  assert.equal(await connection.getAccountInfo(ingress, "confirmed"), null);
  const ingressLamports = 1_000_000;
  const ingressFunding = await send(connection, owner, [SystemProgram.transfer({
    fromPubkey: owner.publicKey,
    toPubkey: ingress,
    lamports: ingressLamports,
  })]);
  const ingressInfo = await connection.getAccountInfo(ingress, "confirmed");
  assert(ingressInfo, "funded ingress PDA is absent");
  assert.equal(ingressInfo.lamports, ingressLamports);
  assert(ingressInfo.owner.equals(SystemProgram.programId));
  assert.equal(ingressInfo.data.length, 0);
  assert.equal(ingressInfo.executable, false);

  const setupDay = protocolLocalDay((await clock(connection)).unixTimestamp);
  const fixtures = await prepareFixtures({
    connection, fixtureDir, mint, source, recipient, vault, ingress, validation, lawState,
    localDay: setupDay,
  });

  const beforeUnfinalized = await tokenSnapshot(connection, [source, vault]);
  const unfinalizedIngress = await expectCustomFailure(
    connection,
    "actual initialized but unfinalized law rejects ingress",
    0xB30C,
    async () => send(connection, owner, [economyIngressInstruction({
      owner: owner.publicKey, source, mint, vault, ingress, priorDelegate, validation, lawState,
      amount: 5n,
    })]),
  );
  assertSnapshotEqual(await tokenSnapshot(connection, [source, vault]), beforeUnfinalized, "unfinalized ingress");

  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (BigInt(await connection.getSlot("confirmed")) > ENTROPY_LAG_SLOTS + 5n) break;
    if (attempt === 599) throw new Error("validator did not produce enough entropy slots");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const finalized = await send(connection, owner, [finalizeLawInstruction(mint, lawState)]);
  const finalizedInfo = await connection.getAccountInfo(lawState, "confirmed");
  assert(finalizedInfo);
  const finalizedState = parseLawState(finalizedInfo.data);
  assert(finalizedState.decision, "permissionless finalizer did not write a decision");
  const decision = finalizedState.decision;
  const recomputed = deriveSolanaDraw({
    ancestorSlotHash: decision.ancestorSlotHash,
    localDay: decision.localDay,
    entropySlot: decision.entropySlot,
    networkGenesisHash: finalizedState.networkGenesisHash,
    mint,
  });
  assert.deepEqual(decision, recomputed);
  const slotHashes = await connection.getAccountInfo(SYSVAR_SLOT_HASHES_PUBKEY, "confirmed");
  assert(slotHashes, "SlotHashes sysvar is absent");
  const target = BigInt(finalized.slot) - ENTROPY_LAG_SLOTS;
  const selected = parseSlotHashes(slotHashes.data).find((entry) => entry.slot <= target);
  assert(selected, "lagged entropy slot was not found");
  assert.equal(decision.entropySlot, selected.slot);
  assert(decision.ancestorSlotHash.equals(selected.hash));
  assert.equal(decision.localDay, protocolLocalDay((await clock(connection)).unixTimestamp));

  emit({
    schema: SCHEMA,
    status: "PASS",
    mode: "actual-initialize-and-finalize",
    rpcScope: "loopback-only",
    publicNetworkWrites: false,
    artifact: {
      oneLawElf: true,
      lawSha256,
      economyFixtureSha256: economySha256,
      lawFinalizerAndHookSha256Equal: true,
      cargoFeature: "production-combined-hook",
      productionCandidate: false,
    },
    fixtureIdentities: {
      lawProgram: LAW_PROGRAM_ID.toBase58(),
      economyProgram: ECONOMY_PROGRAM_ID.toBase58(),
      mint: mint.toBase58(),
      productionIdentities: false,
    },
    checks: {
      initializeSignature: initialized.signature,
      extensionAuthoritiesSealedAtomically: true,
      vaultInitializationSignature: vaultInitialization.signature,
      ingressFundingSignature: ingressFunding.signature,
      ingressPdaFundedStatelessAdversary: true,
      ingressPdaLamports: ingressLamports,
      unfinalizedIngress,
      rawAndBalanceRollbackAsserted: true,
      permissionlessFinalizeSignature: finalized.signature,
      finalizerAuthoritySignerRequired: false,
      decisionRecomputed: true,
      slotHashSelectionMatched: true,
      actualFinalizedDisposition: decision.locked ? "locked" : "open",
      actualFinalizedLocalDay: decision.localDay.toString(),
    },
    syntheticFixtures: fixtures,
    holds: {
      fixtureProductionCandidate: false,
      ownerManifestAccepted: false,
      productionEconomyEntrypoint: false,
      productionEconomyDispatcher: false,
      retainedV2PersistenceComplete: false,
      all15Adapters: false,
      finalBinary: false,
      devnetExecuted: false,
      mainnetExecuted: false,
      graphNodeCompleted: false,
      releaseAuthorized: false,
      mainnetExecutionAuthorized: false,
      status: "HOLD",
    },
  });
}

async function variant(args) {
  const connection = new Connection(required(args, "rpc"), "confirmed");
  const owner = readKeypair(required(args, "owner"));
  const mint = new PublicKey(required(args, "mint"));
  const source = new PublicKey(required(args, "source"));
  const recipient = new PublicKey(required(args, "recipient-token"));
  const vault = new PublicKey(required(args, "stake-vault"));
  const ingress = new PublicKey(required(args, "ingress-authority"));
  const priorDelegate = new PublicKey(required(args, "prior-delegate"));
  const validation = new PublicKey(required(args, "validation"));
  const lawState = new PublicKey(required(args, "law-state"));
  const lawSha256 = required(args, "law-sha256");
  const economySha256 = required(args, "economy-sha256");
  const name = required(args, "variant");
  assert(["missing", "stale", "open", "locked", "forged"].includes(name));
  const lawInfo = await connection.getAccountInfo(lawState, "confirmed");
  assert(lawInfo?.owner.equals(LAW_PROGRAM_ID));
  const state = parseLawState(lawInfo.data);
  const currentDay = protocolLocalDay((await clock(connection)).unixTimestamp);
  if (name === "missing") assert.equal(state.decision, null);
  if (name === "stale") assert(state.decision && state.decision.localDay !== currentDay);
  if (["open", "locked", "forged"].includes(name)) assert.equal(state.decision?.localDay, currentDay);
  if (name === "open") assert.equal(state.decision?.locked, false);
  if (name === "locked") assert.equal(state.decision?.locked, true);
  const ingressInfo = await connection.getAccountInfo(ingress, "confirmed");
  assert(ingressInfo && ingressInfo.lamports === 1_000_000);
  assert(ingressInfo.owner.equals(SystemProgram.programId));
  assert.equal(ingressInfo.data.length, 0);
  assert.equal(ingressInfo.executable, false);

  const expectedHookError = new Map([["missing", 7], ["stale", 7], ["locked", 8], ["forged", 11]]);
  const expectedIngressError = new Map([
    ["missing", 0xB30C], ["stale", 0xB30C], ["locked", 0xB30D], ["forged", 0xB30B],
  ]);
  const ordinaryBefore = await tokenSnapshot(connection, [source, recipient, vault]);
  let ordinary;
  if (name === "open") {
    ordinary = await send(connection, owner, [
      await ordinaryTransfer(connection, source, mint, recipient, owner.publicKey),
    ]);
    assertLawInvocation(ordinary.logs, "ordinary OPEN transfer");
    const after = await tokenSnapshot(connection, [source, recipient, vault]);
    assert.equal(after[source.toBase58()].amount, ordinaryBefore[source.toBase58()].amount - 1n);
    assert.equal(after[recipient.toBase58()].amount, ordinaryBefore[recipient.toBase58()].amount + 1n);
    assert.deepEqual(after[vault.toBase58()], ordinaryBefore[vault.toBase58()]);
  } else {
    ordinary = await expectCustomFailure(
      connection,
      `${name} ordinary transfer`,
      expectedHookError.get(name),
      async () => send(connection, owner, [
        await ordinaryTransfer(connection, source, mint, recipient, owner.publicKey),
      ]),
    );
    assertSnapshotEqual(
      await tokenSnapshot(connection, [source, recipient, vault]),
      ordinaryBefore,
      `${name} ordinary transfer`,
    );
  }

  if (name !== "open") {
    const before = await tokenSnapshot(connection, [source, vault]);
    const ingressFailure = await expectCustomFailure(
      connection,
      `${name} production-source ingress`,
      expectedIngressError.get(name),
      async () => send(connection, owner, [economyIngressInstruction({
        owner: owner.publicKey, source, mint, vault, ingress, priorDelegate, validation, lawState,
        amount: 5n,
      })]),
    );
    assertSnapshotEqual(await tokenSnapshot(connection, [source, vault]), before, `${name} ingress`);
    emit({
      schema: SCHEMA,
      status: "PASS",
      mode: "deterministic-synthetic-gate-variant",
      stateSource: name === "missing"
        ? "initialized-empty-state-not-finalizer-provenance"
        : name === "forged"
          ? "deterministic-kernel-vector-with-tampered-bucket-not-finalizer-provenance"
          : "deterministic-kernel-vector-not-finalizer-provenance",
      variant: name,
      currentProtocolDay: currentDay.toString(),
      artifact: { oneLawElf: true, lawSha256, economyFixtureSha256: economySha256 },
      checks: {
        ordinaryTransfer: ordinary,
        productionSourceIngress: ingressFailure,
        ingressPdaFundedStatelessAdversary: true,
        balanceRollbackAsserted: true,
        rawTokenBytesRollbackAsserted: true,
      },
      publicNetworkWrites: false,
      productionCandidate: false,
      finalBinary: false,
      devnetExecuted: false,
      mainnetExecuted: false,
      mainnetExecutionAuthorized: false,
      statusGate: "HOLD",
    });
    return;
  }

  const beforeBypass = await tokenSnapshot(connection, [source, vault]);
  const bypass = createExecuteInstruction(
    LAW_PROGRAM_ID, source, mint, vault, owner.publicKey, validation, 1n,
  );
  bypass.keys.push({ pubkey: lawState, isSigner: false, isWritable: false });
  const directBypass = await expectCustomFailure(
    connection,
    "direct hook invocation without Token-2022 transfer context",
    12,
    async () => send(connection, owner, [bypass]),
  );
  assertSnapshotEqual(await tokenSnapshot(connection, [source, vault]), beforeBypass, "direct hook bypass");

  const beforeDonation = await tokenSnapshot(connection, [source, vault]);
  const donation = await expectCustomFailure(
    connection,
    "owner-authorized canonical stake-vault donation",
    1,
    async () => send(connection, owner, [
      await ordinaryTransfer(connection, source, mint, vault, owner.publicKey, 3n),
    ]),
  );
  assertSnapshotEqual(await tokenSnapshot(connection, [source, vault]), beforeDonation, "direct stake donation");

  const noDelegateBefore = await tokenSnapshot(connection, [source, vault]);
  assert.equal(noDelegateBefore[source.toBase58()].delegate, null);
  const noDelegate = await send(connection, owner, [economyIngressInstruction({
    owner: owner.publicKey, source, mint, vault, ingress, priorDelegate, validation, lawState,
    amount: 7n,
  })]);
  assertLawInvocation(noDelegate.logs, "no-delegate stake ingress");
  const noDelegateAfter = await tokenSnapshot(connection, [source, vault]);
  assert.equal(noDelegateAfter[source.toBase58()].amount, noDelegateBefore[source.toBase58()].amount - 7n);
  assert.equal(noDelegateAfter[vault.toBase58()].amount, noDelegateBefore[vault.toBase58()].amount + 7n);
  assert.equal(noDelegateAfter[source.toBase58()].delegate, null);
  assert.equal(noDelegateAfter[source.toBase58()].delegatedAmount, 0n);

  const priorAllowance = 41n;
  await send(connection, owner, [createApproveCheckedInstruction(
    source, mint, priorDelegate, owner.publicKey, priorAllowance, TOKEN_DECIMALS, [], TOKEN_2022_PROGRAM_ID,
  )]);
  const priorBefore = await tokenSnapshot(connection, [source, vault]);
  assert.equal(priorBefore[source.toBase58()].delegate, priorDelegate.toBase58());
  assert.equal(priorBefore[source.toBase58()].delegatedAmount, priorAllowance);
  const restoration = await send(connection, owner, [economyIngressInstruction({
    owner: owner.publicKey, source, mint, vault, ingress, priorDelegate, validation, lawState,
    amount: 11n,
  })]);
  assertLawInvocation(restoration.logs, "prior-delegate restoration ingress");
  const restorationAfter = await tokenSnapshot(connection, [source, vault]);
  assert.equal(restorationAfter[source.toBase58()].amount, priorBefore[source.toBase58()].amount - 11n);
  assert.equal(restorationAfter[vault.toBase58()].amount, priorBefore[vault.toBase58()].amount + 11n);
  assert.equal(restorationAfter[source.toBase58()].delegate, priorDelegate.toBase58());
  assert.equal(restorationAfter[source.toBase58()].delegatedAmount, priorAllowance);

  emit({
    schema: SCHEMA,
    status: "PASS",
    mode: "deterministic-synthetic-gate-variant",
    stateSource: "deterministic-kernel-vector-not-finalizer-provenance",
    variant: "open",
    currentProtocolDay: currentDay.toString(),
    artifact: {
      oneLawElf: true,
      lawSha256,
      economyFixtureSha256: economySha256,
      lawFinalizerAndHookSha256Equal: true,
      productionSourceIngressExecutor: true,
    },
    checks: {
      ordinaryTransferAccepted: ordinary.signature,
      directHookBypassRejected: directBypass,
      directStakeVaultDonationRejected: donation,
      noDelegateIngressAccepted: noDelegate.signature,
      noDelegateConsumedAndCleared: true,
      priorDelegateRestorationAccepted: restoration.signature,
      priorDelegateRestoredExactly: true,
      ingressPdaFundedStatelessAdversary: true,
      realToken2022TransferHookContext: true,
      exactLawElfObservedInAllSuccessLogs: true,
      failedTransactionsBalanceRollbackAsserted: true,
      failedTransactionsRawTokenBytesRollbackAsserted: true,
    },
    publicNetworkWrites: false,
    productionCandidate: false,
    retainedV2PersistenceComplete: false,
    finalBinary: false,
    devnetExecuted: false,
    mainnetExecuted: false,
    mainnetExecutionAuthorized: false,
    statusGate: "HOLD",
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = required(args, "mode");
  if (mode === "setup") return setup(args);
  if (mode === "variant") return variant(args);
  throw new TypeError(`unknown mode: ${mode}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`IAT B3 combined Law/stake rehearsal driver failed: ${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
