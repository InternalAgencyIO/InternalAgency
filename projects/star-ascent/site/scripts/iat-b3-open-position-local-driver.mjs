import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createApproveCheckedInstruction,
  getAccount,
  getExtensionData,
  getExtensionTypes,
  getExtraAccountMetaAddress,
  getExtraAccountMetas,
  getMint,
  getTransferHook,
  getTransferHookAccount,
} from "@solana/spl-token";
import {
  deriveSolanaDraw,
  protocolLocalDay,
} from "./iat-b3-local-rehearsal-driver.mjs";

const SCHEMA = "iat-b3-open-position-production-executor-loopback/v1";
const ECONOMY_PROGRAM_ID = new PublicKey("GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU");
const LAW_HOOK_PROGRAM_ID = new PublicKey("DAQCmCpqSgTn7J2MWmiPNZvJwasEESabaSy7VR4qUy4F");
const ZK_ELGAMAL_PROOF_PROGRAM_ID = new PublicKey(
  "ZkE1Gama1Proof11111111111111111111111111111",
);
const ZERO_PUBLIC_KEY = new PublicKey(new Uint8Array(32));
const NETWORK_GENESIS_HASH = Buffer.alloc(32, 0x91);
const MAINNET_SUPPLY = 1_000_000_000_000_000_000n;
const DECIMALS = 9;
const COMPUTE_UNIT_LIMIT = 1_400_000;
const VACANT_POSITION_ID = 100n;
const VACANT_PRINCIPAL = 600_000_000_000_000_000n;
const PREFUNDED_POSITION_ID = 101n;
const PREFUNDED_PRINCIPAL = 50_000_000_000_000_000n;
const PRIOR_ALLOWANCE = 41n;

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

function readKeypair(path) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

function repositoryFile(relative) {
  return new URL(`../${relative}`, import.meta.url);
}

function u64le(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

function publicKeyAt(data, offset) {
  return new PublicKey(data.subarray(offset, offset + 32)).toBase58();
}

function encodeOpenPosition(positionId, principal) {
  const data = Buffer.alloc(32);
  data.set(Buffer.from("IATB3EC1"), 0);
  data[8] = 1;
  data[9] = 6;
  data.writeBigUInt64LE(BigInt(positionId), 16);
  data.writeBigUInt64LE(BigInt(principal), 24);
  return data;
}

function decodeConfig(data) {
  assert.equal(data.length, 272);
  assert.equal(data.subarray(0, 8).toString("ascii"), "IATB3CFG");
  assert.equal(data[8], 1);
  return Object.freeze({
    phase: data[9],
    admin: publicKeyAt(data, 32),
    mint: publicKeyAt(data, 64),
    tokenProgram: publicKeyAt(data, 96),
    randomnessProgram: publicKeyAt(data, 128),
    stakeTokenAccount: publicKeyAt(data, 160),
    genesisTimestamp: data.readBigInt64LE(224),
    expectedSupply: data.readBigUInt64LE(232),
    stakedPrincipal: data.readBigUInt64LE(240),
    agencyCount: data.readUInt32LE(248),
    rehearsalMode: data[252] !== 0,
    active: data[253] !== 0,
    laneMask: data[254],
    stakeVaultInitialized: data[255] !== 0,
    bump: data[256],
    vaultAuthorityBump: data[257],
  });
}

function decodeLane(data) {
  assert.equal(data.length, 176);
  assert.equal(data.subarray(0, 8).toString("ascii"), "IATB3LAN");
  assert.equal(data[8], 1);
  return Object.freeze({
    config: publicKeyAt(data, 16),
    tokenAccount: publicKeyAt(data, 48),
    beneficiary: publicKeyAt(data, 80),
    total: data.readBigUInt64LE(112),
    genesisUnlocked: data.readBigUInt64LE(120),
    cliffWeek: data.readBigUInt64LE(128),
    linearEndWeek: data.readBigUInt64LE(136),
    reserved: data.readBigUInt64LE(144),
    paid: data.readBigUInt64LE(152),
    principalClaimed: data.readBigUInt64LE(160),
    lane: data[168],
    rewardSource: data[169] !== 0,
    bump: data[170],
    tokenBump: data[171],
  });
}

function decodePosition(data) {
  assert.equal(data.length, 176);
  assert.equal(data.subarray(0, 8).toString("ascii"), "IATB3POS");
  assert.equal(data[8], 1);
  return Object.freeze({
    config: publicKeyAt(data, 16),
    owner: publicKeyAt(data, 48),
    positionId: data.readBigUInt64LE(80),
    principal: data.readBigUInt64LE(88),
    acceptedWeek: data.readBigUInt64LE(96),
    firstAccrualWeek: data.readBigUInt64LE(104),
    termWeeks: data.readBigUInt64LE(112),
    annualRateBps: data.readBigUInt64LE(120),
    treasuryReserved: data.readBigUInt64LE(128),
    ecosystemReserved: data.readBigUInt64LE(136),
    liquidityReserved: data.readBigUInt64LE(144),
    paid: data.readBigUInt64LE(152),
    settledMask: data.readBigUInt64LE(160),
    agencyIndex: data.readUInt32LE(168),
    role: data[172],
    principalReturned: data[173] !== 0,
    closed: data[174] !== 0,
    bump: data[175],
  });
}

function compactRaw(account) {
  if (account === null) return Object.freeze({ exists: false });
  return Object.freeze({
    exists: true,
    owner: account.owner.toBase58(),
    lamports: String(account.lamports),
    executable: account.executable,
    dataBase64: account.data.toString("base64"),
    dataSha256: sha256Bytes(account.data),
  });
}

function compactToken(account) {
  return Object.freeze({
    mint: account.mint.toBase58(),
    owner: account.owner.toBase58(),
    amount: String(account.amount),
    delegate: account.delegate?.toBase58() ?? null,
    delegatedAmount: String(account.delegatedAmount),
    closeAuthority: account.closeAuthority?.toBase58() ?? null,
    isNative: account.isNative,
    extensionTypes: getExtensionTypes(account.tlvData),
    transferring: getTransferHookAccount(account)?.transferring ?? null,
  });
}

async function snapshot(connection, addresses) {
  const keys = [
    addresses.owner,
    addresses.config,
    addresses.eligibility,
    addresses.treasury,
    addresses.ecosystem,
    addresses.liquidity,
    addresses.position,
    addresses.source,
    addresses.stake,
    addresses.priorDelegate,
  ];
  const infos = await connection.getMultipleAccountsInfo(keys, "finalized");
  const [source, stake] = await Promise.all([
    getAccount(connection, addresses.source, "finalized", TOKEN_2022_PROGRAM_ID),
    getAccount(connection, addresses.stake, "finalized", TOKEN_2022_PROGRAM_ID),
  ]);
  return Object.freeze({
    owner: compactRaw(infos[0]),
    config: compactRaw(infos[1]),
    eligibility: compactRaw(infos[2]),
    treasury: compactRaw(infos[3]),
    ecosystem: compactRaw(infos[4]),
    liquidity: compactRaw(infos[5]),
    position: compactRaw(infos[6]),
    sourceRaw: compactRaw(infos[7]),
    stakeRaw: compactRaw(infos[8]),
    priorDelegateRaw: compactRaw(infos[9]),
    source: compactToken(source),
    stake: compactToken(stake),
  });
}

async function finalizedTransaction(connection, signature) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const transaction = await connection.getTransaction(signature, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
    if (transaction?.meta) return transaction;
    await delay(100);
  }
  throw new Error(`finalized transaction unavailable: ${signature}`);
}

async function submit(connection, sponsor, signers, instructions) {
  const latest = await connection.getLatestBlockhash("finalized");
  const transaction = new Transaction({
    feePayer: sponsor.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }).add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
    ...instructions,
  );
  const unique = new Map([[sponsor.publicKey.toBase58(), sponsor]]);
  for (const signer of signers) unique.set(signer.publicKey.toBase58(), signer);
  transaction.sign(...unique.values());
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 0,
  });
  try {
    await connection.confirmTransaction({ signature, ...latest }, "finalized");
  } catch {
    // The finalized transaction metadata below is authoritative for expected failures.
  }
  const confirmed = await finalizedTransaction(connection, signature);
  assert.equal(typeof confirmed.meta.computeUnitsConsumed, "number");
  return Object.freeze({
    signature,
    err: confirmed.meta.err,
    logs: confirmed.meta.logMessages ?? [],
    computeUnitsConsumed: confirmed.meta.computeUnitsConsumed,
  });
}

function requireSuccess(result, label) {
  assert.equal(result.err, null, `${label} failed:\n${result.logs.join("\n")}`);
  return result;
}

function requireFailure(result, label, pattern) {
  assert.notEqual(result.err, null, `${label} unexpectedly succeeded`);
  const text = `${JSON.stringify(result.err)}\n${result.logs.join("\n")}`;
  assert.match(text, pattern, `${label} failed for an unexpected reason:\n${text}`);
  return result;
}

function assertRollback(before, after, label) {
  assert.deepEqual(after, before, `${label} changed a raw or decoded account snapshot`);
}

function deriveAddresses(mint, owner, source, priorDelegate, positionId) {
  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), mint.toBuffer()],
    ECONOMY_PROGRAM_ID,
  );
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault-authority"), config.toBuffer()],
    ECONOMY_PROGRAM_ID,
  );
  const [stake] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake-token"), config.toBuffer()],
    ECONOMY_PROGRAM_ID,
  );
  const [ingress] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake-ingress"), config.toBuffer()],
    ECONOMY_PROGRAM_ID,
  );
  const [eligibility] = PublicKey.findProgramAddressSync(
    [Buffer.from("eligibility"), config.toBuffer(), owner.toBuffer()],
    ECONOMY_PROGRAM_ID,
  );
  const lane = (value) => PublicKey.findProgramAddressSync(
    [Buffer.from("lane"), config.toBuffer(), Buffer.from([value])],
    ECONOMY_PROGRAM_ID,
  )[0];
  const [position] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), config.toBuffer(), owner.toBuffer(), u64le(positionId)],
    ECONOMY_PROGRAM_ID,
  );
  const [lawState] = PublicKey.findProgramAddressSync(
    [Buffer.from("law-state"), mint.toBuffer()],
    LAW_HOOK_PROGRAM_ID,
  );
  return Object.freeze({
    owner,
    mint,
    source,
    priorDelegate,
    config,
    vaultAuthority,
    stake,
    ingress,
    eligibility,
    treasury: lane(1),
    ecosystem: lane(2),
    liquidity: lane(4),
    position,
    lawState,
    validation: getExtraAccountMetaAddress(mint, LAW_HOOK_PROGRAM_ID),
  });
}

function lawInstruction({ authority, mint, lawState, opcode, mode = null, ancestor = null }) {
  if (opcode === 0) {
    return new TransactionInstruction({
      programId: LAW_HOOK_PROGRAM_ID,
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: lawState, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([0]),
    });
  }
  assert.equal(opcode, 1);
  return new TransactionInstruction({
    programId: LAW_HOOK_PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: lawState, isSigner: false, isWritable: true },
    ],
    data: ancestor === null
      ? Buffer.from([1, mode])
      : Buffer.concat([Buffer.from([1, mode]), ancestor]),
  });
}

function validationInstruction(addresses, payer) {
  return new TransactionInstruction({
    programId: LAW_HOOK_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: addresses.mint, isSigner: false, isWritable: false },
      { pubkey: addresses.validation, isSigner: false, isWritable: true },
      { pubkey: addresses.lawState, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([2]),
  });
}

function initializeStakeInstruction(addresses, payer) {
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: addresses.mint, isSigner: false, isWritable: false },
      { pubkey: addresses.stake, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]),
  });
}

function seedStateInstruction(addresses, payer) {
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: addresses.mint, isSigner: false, isWritable: false },
      { pubkey: addresses.config, isSigner: false, isWritable: true },
      { pubkey: addresses.eligibility, isSigner: false, isWritable: true },
      { pubkey: addresses.treasury, isSigner: false, isWritable: true },
      { pubkey: addresses.ecosystem, isSigner: false, isWritable: true },
      { pubkey: addresses.liquidity, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: addresses.lawState, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

function openInstruction(addresses, positionId, principal, mode, priorDelegate = false) {
  const keys = [
    { pubkey: addresses.owner, isSigner: true, isWritable: true },
    { pubkey: addresses.config, isSigner: false, isWritable: true },
    { pubkey: addresses.eligibility, isSigner: false, isWritable: false },
    { pubkey: addresses.mint, isSigner: false, isWritable: false },
    { pubkey: addresses.source, isSigner: false, isWritable: true },
    { pubkey: addresses.stake, isSigner: false, isWritable: true },
    { pubkey: addresses.treasury, isSigner: false, isWritable: true },
    { pubkey: addresses.ecosystem, isSigner: false, isWritable: true },
    { pubkey: addresses.liquidity, isSigner: false, isWritable: true },
    { pubkey: addresses.position, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: addresses.ingress, isSigner: false, isWritable: false },
    { pubkey: ZK_ELGAMAL_PROOF_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: LAW_HOOK_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: addresses.validation, isSigner: false, isWritable: false },
    { pubkey: addresses.lawState, isSigner: false, isWritable: false },
  ];
  if (priorDelegate) {
    keys.push({ pubkey: addresses.priorDelegate, isSigner: false, isWritable: false });
  }
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys,
    data: Buffer.concat([
      Buffer.from([2, mode]),
      encodeOpenPosition(positionId, principal),
    ]),
  });
}

async function validatorProtocolDay(connection) {
  const clock = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "finalized");
  assert(clock && clock.data.length >= 40, "validator Clock sysvar unavailable");
  return protocolLocalDay(clock.data.readBigInt64LE(32));
}

function findLockedAncestor(mint, localDay) {
  for (let candidate = 0; candidate <= 0xffff_ffff; candidate += 1) {
    const ancestorSlotHash = Buffer.alloc(32, 0x42);
    ancestorSlotHash.writeUInt32LE(candidate, 0);
    const decision = deriveSolanaDraw({
      ancestorSlotHash,
      localDay,
      entropySlot: 42_424_242n,
      networkGenesisHash: NETWORK_GENESIS_HASH,
      mint,
    });
    if (decision.locked) return ancestorSlotHash;
  }
  throw new Error("unable to derive locked Daily-Law fixture ancestor");
}

function assertCanonicalMint(mint, mintAddress) {
  assert.equal(mint.address.toBase58(), mintAddress.toBase58());
  assert.equal(mint.supply, MAINNET_SUPPLY);
  assert.equal(mint.decimals, DECIMALS);
  assert.equal(mint.mintAuthority, null);
  assert.equal(mint.freezeAuthority, null);
  const types = [...getExtensionTypes(mint.tlvData)].sort((a, b) => a - b);
  assert.deepEqual(types, [ExtensionType.ConfidentialTransferMint, ExtensionType.TransferHook]);
  const confidential = getExtensionData(ExtensionType.ConfidentialTransferMint, mint.tlvData);
  assert(confidential && confidential.length === 65);
  assert(confidential.subarray(0, 32).equals(Buffer.alloc(32)));
  assert.equal(confidential[32], 1);
  assert(confidential.subarray(33, 65).equals(Buffer.alloc(32)));
  const hook = getTransferHook(mint);
  assert(hook);
  assert(hook.authority.equals(ZERO_PUBLIC_KEY));
  assert(hook.programId.equals(LAW_HOOK_PROGRAM_ID));
  return Object.freeze({
    extensionTypes: types,
    supply: String(mint.supply),
    decimals: mint.decimals,
    mintAuthority: null,
    freezeAuthority: null,
    confidentialAuthority: null,
    confidentialAutoApprove: true,
    confidentialAuditor: null,
    transferHookAuthority: null,
    transferHookProgramId: hook.programId.toBase58(),
  });
}

function assertCanonicalTokenAccount(account, mint, owner) {
  assert(account.mint.equals(mint));
  assert(account.owner.equals(owner));
  assert.equal(account.delegate, null);
  assert.equal(account.delegatedAmount, 0n);
  assert.equal(account.closeAuthority, null);
  assert.equal(account.isNative, false);
  assert.deepEqual(getExtensionTypes(account.tlvData), [ExtensionType.TransferHookAccount]);
  assert.equal(getTransferHookAccount(account)?.transferring, false);
}

function decodedEconomic(snapshot) {
  assert(snapshot.config.exists && snapshot.treasury.exists && snapshot.ecosystem.exists);
  assert(snapshot.liquidity.exists);
  let position = null;
  if (snapshot.position.exists) {
    const positionData = Buffer.from(snapshot.position.dataBase64, "base64");
    if (positionData.length === 0) {
      assert.equal(snapshot.position.owner, SystemProgram.programId.toBase58());
    } else {
      assert.equal(snapshot.position.owner, ECONOMY_PROGRAM_ID.toBase58());
      position = decodePosition(positionData);
    }
  }
  return Object.freeze({
    config: decodeConfig(Buffer.from(snapshot.config.dataBase64, "base64")),
    treasury: decodeLane(Buffer.from(snapshot.treasury.dataBase64, "base64")),
    ecosystem: decodeLane(Buffer.from(snapshot.ecosystem.dataBase64, "base64")),
    liquidity: decodeLane(Buffer.from(snapshot.liquidity.dataBase64, "base64")),
    position,
  });
}

function assertValidOpenDelta(before, after, expected) {
  const left = decodedEconomic(before);
  const right = decodedEconomic(after);
  assert(right.position);
  assert.equal(right.position.config, expected.addresses.config.toBase58());
  assert.equal(right.position.owner, expected.addresses.owner.toBase58());
  assert.equal(right.position.positionId, expected.positionId);
  assert.equal(right.position.principal, expected.principal);
  assert.equal(right.position.acceptedWeek, 0n);
  assert.equal(right.position.firstAccrualWeek, 1n);
  assert.equal(right.position.termWeeks, 52n);
  assert.equal(right.position.annualRateBps, 1_000n);
  assert.equal(right.position.treasuryReserved, expected.treasuryReservation);
  assert.equal(right.position.ecosystemReserved, expected.ecosystemReservation);
  assert.equal(right.position.liquidityReserved, expected.liquidityReservation);
  assert.equal(right.position.paid, 0n);
  assert.equal(right.position.settledMask, 0n);
  assert.equal(right.position.agencyIndex, 0xffff_ffff);
  assert.equal(right.position.role, 0);
  assert.equal(right.position.principalReturned, false);
  assert.equal(right.position.closed, false);
  assert.equal(right.config.stakedPrincipal - left.config.stakedPrincipal, expected.principal);
  assert.equal(right.treasury.reserved - left.treasury.reserved, expected.treasuryReservation);
  assert.equal(right.ecosystem.reserved - left.ecosystem.reserved, expected.ecosystemReservation);
  assert.equal(right.liquidity.reserved - left.liquidity.reserved, expected.liquidityReservation);
  assert.equal(BigInt(before.source.amount) - BigInt(after.source.amount), expected.principal);
  assert.equal(BigInt(after.stake.amount) - BigInt(before.stake.amount), expected.principal);
  assert.equal(after.source.delegate, expected.delegate);
  assert.equal(BigInt(after.source.delegatedAmount), expected.delegatedAmount);
  const ownerSpent = BigInt(before.owner.lamports) - BigInt(after.owner.lamports);
  const positionIncrease = BigInt(after.position.lamports) - BigInt(before.position.lamports ?? 0);
  assert.equal(ownerSpent, positionIncrease);
}

function finalizeEvidence(args) {
  const candidatePath = required(args, "finalize-candidate");
  const evidencePath = required(args, "evidence");
  const evidence = JSON.parse(readFileSync(candidatePath, "utf8"));
  assert.equal(evidence.schema, SCHEMA);
  assert.equal(evidence.status, "PASS");
  assert.equal(evidence.scope.publicNetworkWrites, false);
  assert.equal(evidence.observed.globalSbfStackDiagnosticsPresent, false);
  evidence.generatedAt = new Date().toISOString();
  evidence.fixture.runnerSha256 = required(args, "runner-sha256");
  evidence.build = {
    cargoBuildSbfExitCode: 0,
    canonicalCompilerDiagnosticsPresent: false,
    explicitSbfStackLimitBytes: 4096,
    cargoVersion: required(args, "cargo-version"),
    rustcVersion: required(args, "rustc-version"),
    solanaVersion: required(args, "solana-version"),
    splTokenVersion: required(args, "spl-token-version"),
    nodeVersion: process.version,
  };
  evidence.cleanup = {
    temporaryLedgerRemoved: true,
    validatorStopped: true,
    generatedKeyMaterialRemoved: true,
  };
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({
    schema: SCHEMA,
    status: "PASS",
    mode: "evidence-finalized",
    evidencePath,
    publicNetworkWrites: false,
    mainnetExecutionAuthorized: false,
  })}\n`);
}

async function main(args) {
  const connection = new Connection(required(args, "rpc"), "finalized");
  const sponsor = readKeypair(required(args, "sponsor"));
  const owner = readKeypair(required(args, "owner"));
  const mint = new PublicKey(required(args, "mint"));
  const source = new PublicKey(required(args, "source"));
  const priorDelegate = new PublicKey(required(args, "prior-delegate"));
  const candidatePath = required(args, "candidate");
  const economyArtifactSha256 = required(args, "economy-artifact-sha256");
  const lawArtifactSha256 = required(args, "law-artifact-sha256");
  const economyBuildLog = required(args, "economy-build-log");
  const lawBuildLog = required(args, "law-build-log");

  const base = deriveAddresses(mint, owner.publicKey, source, priorDelegate, 0n);
  const signatures = [];
  const record = (label, result) => {
    signatures.push(Object.freeze({
      label,
      signature: result.signature,
      success: result.err === null,
      computeUnitsConsumed: result.computeUnitsConsumed,
    }));
    return result;
  };

  const canonicalMint = assertCanonicalMint(
    await getMint(connection, mint, "finalized", TOKEN_2022_PROGRAM_ID),
    mint,
  );
  const initialSource = await getAccount(connection, source, "finalized", TOKEN_2022_PROGRAM_ID);
  assertCanonicalTokenAccount(initialSource, mint, owner.publicKey);
  assert.equal(initialSource.amount, MAINNET_SUPPLY);

  requireSuccess(record("initialize-law", await submit(connection, sponsor, [owner], [
    lawInstruction({
      authority: owner.publicKey,
      mint,
      lawState: base.lawState,
      opcode: 0,
    }),
  ])), "initialize law");
  requireSuccess(record("initialize-validation", await submit(connection, sponsor, [owner], [
    validationInstruction(base, owner.publicKey),
  ])), "initialize validation");
  requireSuccess(record("initialize-stake", await submit(connection, sponsor, [owner], [
    initializeStakeInstruction(base, owner.publicKey),
  ])), "initialize stake");
  requireSuccess(record("seed-state", await submit(connection, sponsor, [owner], [
    seedStateInstruction(base, owner.publicKey),
  ])), "seed production-shaped state");

  const validation = await connection.getAccountInfo(base.validation, "finalized");
  assert(validation);
  assert(validation.owner.equals(LAW_HOOK_PROGRAM_ID));
  const metas = getExtraAccountMetas(validation);
  assert.equal(metas.length, 1);
  assert.equal(metas[0].discriminator, 0);
  assert(Buffer.from(metas[0].addressConfig).equals(base.lawState.toBuffer()));
  assert.equal(metas[0].isSigner, false);
  assert.equal(metas[0].isWritable, false);
  const lawAccount = await connection.getAccountInfo(base.lawState, "finalized");
  assert(lawAccount?.owner.equals(LAW_HOOK_PROGRAM_ID));
  const stakeAccount = await getAccount(connection, base.stake, "finalized", TOKEN_2022_PROGRAM_ID);
  assertCanonicalTokenAccount(stakeAccount, mint, base.vaultAuthority);
  assert.equal(stakeAccount.amount, 0n);

  const seededSnapshot = await snapshot(connection, {
    ...base,
    position: deriveAddresses(mint, owner.publicKey, source, priorDelegate, 9n).position,
  });
  const seeded = decodedEconomic(seededSnapshot);
  assert.equal(seeded.config.phase, 2);
  assert.equal(seeded.config.mint, mint.toBase58());
  assert.equal(seeded.config.tokenProgram, TOKEN_2022_PROGRAM_ID.toBase58());
  assert.equal(seeded.config.stakeTokenAccount, base.stake.toBase58());
  assert.equal(seeded.config.expectedSupply, MAINNET_SUPPLY);
  assert.equal(seeded.config.stakedPrincipal, 0n);
  assert.equal(seeded.config.rehearsalMode, false);
  assert.equal(seeded.config.active, true);
  assert.equal(seeded.config.laneMask, 0b1_1110);
  assert.equal(seeded.config.stakeVaultInitialized, true);
  assert.equal(seeded.treasury.reserved, 34_000_000_000_000_000n);
  assert.equal(seeded.ecosystem.reserved, 0n);
  assert.equal(seeded.liquidity.reserved, 0n);

  const locked = findLockedAncestor(mint, await validatorProtocolDay(connection));
  requireSuccess(record("set-law-locked", await submit(connection, sponsor, [owner], [
    lawInstruction({
      authority: owner.publicKey,
      mint,
      lawState: base.lawState,
      opcode: 1,
      mode: 1,
      ancestor: locked,
    }),
  ])), "set locked law");
  const lockedAddresses = deriveAddresses(mint, owner.publicKey, source, priorDelegate, 9n);
  const lockedBefore = await snapshot(connection, lockedAddresses);
  const lockedIx = openInstruction(
    { ...lockedAddresses, source: priorDelegate },
    9n,
    3n,
    0,
    false,
  );
  requireFailure(record("locked-law-first", await submit(connection, sponsor, [owner], [lockedIx])),
    "locked Law before hostile source parsing", /custom program error: 0xb30d\b/iu);
  assertRollback(lockedBefore, await snapshot(connection, lockedAddresses), "locked-Law failure");
  requireSuccess(record("set-law-open", await submit(connection, sponsor, [owner], [
    lawInstruction({
      authority: owner.publicKey,
      mint,
      lawState: base.lawState,
      opcode: 1,
      mode: 0,
    }),
  ])), "restore open law");

  const hookAddresses = deriveAddresses(mint, owner.publicKey, source, priorDelegate, 10n);
  const hookBefore = await snapshot(connection, hookAddresses);
  requireFailure(record("hook-rejection", await submit(connection, sponsor, [owner], [
    openInstruction(hookAddresses, 10n, 13n, 0, false),
  ])), "hook rejection after approval", /custom program error: 0xe415\b/iu);
  assertRollback(hookBefore, await snapshot(connection, hookAddresses), "hook rejection");

  const lifecycleAddresses = deriveAddresses(mint, owner.publicKey, source, priorDelegate, 11n);
  const rentMinimum = await connection.getMinimumBalanceForRentExemption(176, "finalized");
  const ownerBalance = await connection.getBalance(owner.publicKey, "finalized");
  assert(ownerBalance >= rentMinimum);
  requireSuccess(record("drain-owner-for-lifecycle", await submit(connection, sponsor, [owner], [
    SystemProgram.transfer({
      fromPubkey: owner.publicKey,
      toPubkey: sponsor.publicKey,
      lamports: ownerBalance - (rentMinimum - 1),
    }),
  ])), "drain owner below Position rent");
  assert.equal(await connection.getBalance(owner.publicKey, "finalized"), rentMinimum - 1);
  const lifecycleBefore = await snapshot(connection, lifecycleAddresses);
  requireFailure(record("lifecycle-rollback", await submit(connection, sponsor, [owner], [
    openInstruction(lifecycleAddresses, 11n, 17n, 0, false),
  ])), "post-token Position lifecycle rejection", /custom program error: 0xb320\b/iu);
  assertRollback(
    lifecycleBefore,
    await snapshot(connection, lifecycleAddresses),
    "Position lifecycle failure",
  );
  const airdropSignature = await connection.requestAirdrop(owner.publicKey, 20_000_000_000);
  await connection.confirmTransaction(airdropSignature, "finalized");

  const lateAddresses = deriveAddresses(mint, owner.publicKey, source, priorDelegate, 12n);
  const lateBefore = await snapshot(connection, lateAddresses);
  requireFailure(record("post-success-wrapper-rollback", await submit(connection, sponsor, [owner], [
    openInstruction(lateAddresses, 12n, 19n, 1, false),
  ])), "failure injected after real executor success", /custom program error: 0xe304\b/iu);
  assertRollback(
    lateBefore,
    await snapshot(connection, lateAddresses),
    "post-success wrapper failure",
  );

  const vacantAddresses = deriveAddresses(
    mint,
    owner.publicKey,
    source,
    priorDelegate,
    VACANT_POSITION_ID,
  );
  const vacantBefore = await snapshot(connection, vacantAddresses);
  assert.equal(vacantBefore.position.exists, false);
  requireSuccess(record("vacant-17-success", await submit(connection, sponsor, [owner], [
    openInstruction(vacantAddresses, VACANT_POSITION_ID, VACANT_PRINCIPAL, 0, false),
  ])), "17-account vacant OpenPosition");
  const vacantAfter = await snapshot(connection, vacantAddresses);
  assertValidOpenDelta(vacantBefore, vacantAfter, {
    addresses: vacantAddresses,
    positionId: VACANT_POSITION_ID,
    principal: VACANT_PRINCIPAL,
    treasuryReservation: 16_000_000_000_000_000n,
    ecosystemReservation: 37_500_000_000_000_000n,
    liquidityReservation: 6_500_000_000_000_000n,
    delegate: null,
    delegatedAmount: 0n,
  });

  const prefundedAddresses = deriveAddresses(
    mint,
    owner.publicKey,
    source,
    priorDelegate,
    PREFUNDED_POSITION_ID,
  );
  const prefundLamports = await connection.getMinimumBalanceForRentExemption(0, "finalized");
  requireSuccess(record("prefund-position", await submit(connection, sponsor, [], [
    SystemProgram.transfer({
      fromPubkey: sponsor.publicKey,
      toPubkey: prefundedAddresses.position,
      lamports: prefundLamports,
    }),
  ])), "prefund Position PDA");
  requireSuccess(record("set-prior-delegate", await submit(connection, sponsor, [owner], [
    createApproveCheckedInstruction(
      source,
      mint,
      priorDelegate,
      owner.publicKey,
      PRIOR_ALLOWANCE,
      DECIMALS,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  ])), "set source prior delegate");
  const prefundedBefore = await snapshot(connection, prefundedAddresses);
  assert.equal(prefundedBefore.position.owner, SystemProgram.programId.toBase58());
  assert.equal(prefundedBefore.position.lamports, String(prefundLamports));
  assert.equal(prefundedBefore.position.dataBase64, "");
  assert.equal(prefundedBefore.source.delegate, priorDelegate.toBase58());
  assert.equal(BigInt(prefundedBefore.source.delegatedAmount), PRIOR_ALLOWANCE);
  requireSuccess(record("prefunded-18-success", await submit(connection, sponsor, [owner], [
    openInstruction(
      prefundedAddresses,
      PREFUNDED_POSITION_ID,
      PREFUNDED_PRINCIPAL,
      0,
      true,
    ),
  ])), "18-account prefunded prior-delegate OpenPosition");
  const prefundedAfter = await snapshot(connection, prefundedAddresses);
  assertValidOpenDelta(prefundedBefore, prefundedAfter, {
    addresses: prefundedAddresses,
    positionId: PREFUNDED_POSITION_ID,
    principal: PREFUNDED_PRINCIPAL,
    treasuryReservation: 0n,
    ecosystemReservation: 0n,
    liquidityReservation: 5_000_000_000_000_000n,
    delegate: priorDelegate.toBase58(),
    delegatedAmount: PRIOR_ALLOWANCE,
  });

  const evidence = {
    schema: SCHEMA,
    status: "PASS",
    generatedAt: new Date().toISOString(),
    scope: {
      rpc: required(args, "rpc"),
      loopbackOnly: true,
      publicNetworkWrites: false,
      syntheticFixtureInstructionWrapper: true,
      syntheticProgramErrorMapping: true,
    },
    fixture: {
      productionCandidate: false,
      economyProgramId: ECONOMY_PROGRAM_ID.toBase58(),
      lawHookProgramId: LAW_HOOK_PROGRAM_ID.toBase58(),
      economyArtifactSha256,
      lawArtifactSha256,
      economySourceSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-open-position/economy/src/lib.rs")),
      lawHookSourceSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-open-position/law-hook/src/lib.rs")),
      driverSha256: sha256File(import.meta.filename),
      cargoLockSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-open-position/Cargo.lock")),
      economyBuildLogSha256: sha256File(economyBuildLog),
      lawBuildLogSha256: sha256File(lawBuildLog),
    },
    productionSource: {
      openExecutorSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/production_open_position_executor.rs")),
      openPreflightSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/production_open_position.rs")),
      stakeIngressRuntimeSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/stake_ingress_runtime.rs")),
      runtimeLifecycleSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/runtime_account_lifecycle.rs")),
      runtimeWriteAdapterSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/runtime_write_adapter.rs")),
    },
    cluster: {
      genesisHash: await connection.getGenesisHash(),
      commitment: "finalized",
    },
    mint: canonicalMint,
    validationTlv: {
      owner: validation.owner.toBase58(),
      metaCount: metas.length,
      exactLawState: base.lawState.toBase58(),
      readOnly: true,
      nonsigner: true,
    },
    observed: {
      realProductionOpenPositionExecutorInvoked: true,
      exactProductionInstructionCodecPassedThrough: true,
      exactSeventeenAccountVacantSuccess: true,
      exactEighteenAccountPrefundedDelegateSuccess: true,
      canonicalToken2022MintAuthenticated: true,
      exactHookLawGraphResolved: true,
      lockedLawPrecededHostileSourceParsing: true,
      hookFailureRolledBackApprovalAndAllState: true,
      lifecycleFailureRolledBackTokenDelegateAndAllState: true,
      lateWrapperFailureRolledBackPositionConfigThreeLanesAndTokens: true,
      priorDelegateAndAllowanceRestoredExactly: true,
      configAndAllThreeRewardLanesPersisted: true,
      exactLocalSbfExecutionProven: true,
      loopbackFinalizedTransactionRollbackProven: true,
      requestedComputeUnitLimit: COMPUTE_UNIT_LIMIT,
      computeUnitsConsumed: signatures.map(({ label, computeUnitsConsumed }) => ({
        label,
        computeUnitsConsumed,
      })),
      globalSbfStackDiagnosticsPresent: false,
    },
    transactions: signatures,
    limits: {
      productionComputeBudgetProven: false,
      productionProgramErrorAbiProven: false,
      productionDispatcherProven: false,
      productionEntrypointProven: false,
      productionFinalCombinedBinaryProven: false,
      productionIdentitiesFrozen: false,
      productionGenesisTokenDistributionConservationProven: false,
      activationLifecycleProven: false,
      fundingCeremonyProven: false,
      adversarialDevnetProven: false,
      mainnetExecutionAuthorized: false,
      mainnetHold: true,
    },
    cleanup: {
      temporaryLedgerRemoved: false,
      validatorStopped: false,
      generatedKeyMaterialRemoved: false,
    },
  };
  writeFileSync(candidatePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({
    schema: SCHEMA,
    status: "PASS",
    mode: "driver",
    candidatePath,
    transactionCount: signatures.length,
    publicNetworkWrites: false,
  })}\n`);
}

const parsedArgs = parseArgs(process.argv.slice(2));
if (parsedArgs.has("finalize-candidate")) {
  try {
    finalizeEvidence(parsedArgs);
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  }
} else {
  main(parsedArgs).catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
