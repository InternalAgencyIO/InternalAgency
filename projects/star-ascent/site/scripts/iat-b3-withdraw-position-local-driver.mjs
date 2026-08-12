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
  createRevokeInstruction,
} from "@solana/spl-token";
import {
  deriveSolanaDraw,
  protocolLocalDay,
} from "./iat-b3-local-rehearsal-driver.mjs";

const SCHEMA = "iat-b3-withdraw-position-production-executor-loopback/v1";
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
const WITHDRAW_POSITION_ID = 7n;
const WITHDRAW_PRINCIPAL = 17n;

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

function encodeWithdrawPosition() {
  const data = Buffer.alloc(32);
  data.set(Buffer.from("IATB3EC1"), 0);
  data[8] = 1;
  data[9] = 10;
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
    addresses.position,
    addresses.destination,
    addresses.stake,
  ];
  const infos = await connection.getMultipleAccountsInfo(keys, "finalized");
  const [source, stake] = await Promise.all([
    getAccount(connection, addresses.destination, "finalized", TOKEN_2022_PROGRAM_ID),
    getAccount(connection, addresses.stake, "finalized", TOKEN_2022_PROGRAM_ID),
  ]);
  return Object.freeze({
    owner: compactRaw(infos[0]),
    config: compactRaw(infos[1]),
    position: compactRaw(infos[2]),
    destinationRaw: compactRaw(infos[3]),
    stakeRaw: compactRaw(infos[4]),
    destination: compactToken(source),
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

function deriveAddresses(mint, owner, destination) {
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
  const [position] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), config.toBuffer(), owner.toBuffer(), u64le(WITHDRAW_POSITION_ID)],
    ECONOMY_PROGRAM_ID,
  );
  const [lawState] = PublicKey.findProgramAddressSync(
    [Buffer.from("law-state"), mint.toBuffer()],
    LAW_HOOK_PROGRAM_ID,
  );
  return Object.freeze({
    owner,
    mint,
    destination,
    config,
    vaultAuthority,
    stake,
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

function seedWithdrawInstruction(addresses, payer) {
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: addresses.config, isSigner: false, isWritable: true },
      { pubkey: addresses.position, isSigner: false, isWritable: true },
      { pubkey: addresses.mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: addresses.lawState, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([2]),
  });
}

function withdrawInstruction(addresses, mode, { hostileLaw = false } = {}) {
  const keys = [
    { pubkey: addresses.owner, isSigner: true, isWritable: false },
    { pubkey: addresses.config, isSigner: false, isWritable: true },
    { pubkey: addresses.position, isSigner: false, isWritable: true },
    { pubkey: addresses.mint, isSigner: false, isWritable: false },
    { pubkey: addresses.vaultAuthority, isSigner: false, isWritable: false },
    { pubkey: addresses.stake, isSigner: false, isWritable: true },
    { pubkey: addresses.destination, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ZK_ELGAMAL_PROOF_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: LAW_HOOK_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: addresses.validation, isSigner: false, isWritable: false },
    { pubkey: hostileLaw ? SystemProgram.programId : addresses.lawState, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys,
    data: Buffer.concat([
      Buffer.from([3, mode]),
      hostileLaw ? Buffer.alloc(32, 0xff) : encodeWithdrawPosition(),
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

async function awaitCanonicalMint(connection, mintAddress) {
  let observed;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    observed = await getMint(connection, mintAddress, "finalized", TOKEN_2022_PROGRAM_ID);
    if (observed.mintAuthority === null && observed.freezeAuthority === null) {
      return assertCanonicalMint(observed, mintAddress);
    }
    await delay(100);
  }
  return assertCanonicalMint(observed, mintAddress);
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
  assert(snapshot.config.exists && snapshot.position.exists);
  return Object.freeze({
    config: decodeConfig(Buffer.from(snapshot.config.dataBase64, "base64")),
    position: decodePosition(Buffer.from(snapshot.position.dataBase64, "base64")),
  });
}

function assertValidWithdrawDelta(before, after) {
  const left = decodedEconomic(before);
  const right = decodedEconomic(after);
  assert.equal(left.config.stakedPrincipal, WITHDRAW_PRINCIPAL);
  assert.equal(right.config.stakedPrincipal, 0n);
  assert.equal(left.position.principalReturned, false);
  assert.equal(right.position.principalReturned, true);
  assert.equal(right.position.closed, false);
  assert.equal(BigInt(before.stake.amount) - BigInt(after.stake.amount), WITHDRAW_PRINCIPAL);
  assert.equal(BigInt(after.destination.amount) - BigInt(before.destination.amount), WITHDRAW_PRINCIPAL);
  const configExpected = Buffer.from(before.config.dataBase64, "base64");
  configExpected.writeBigUInt64LE(0n, 240);
  const positionExpected = Buffer.from(before.position.dataBase64, "base64");
  positionExpected[173] = 1;
  const stakeExpected = Buffer.from(before.stakeRaw.dataBase64, "base64");
  stakeExpected.writeBigUInt64LE(BigInt(before.stake.amount) - WITHDRAW_PRINCIPAL, 64);
  const destinationExpected = Buffer.from(before.destinationRaw.dataBase64, "base64");
  destinationExpected.writeBigUInt64LE(BigInt(before.destination.amount) + WITHDRAW_PRINCIPAL, 64);
  assert(Buffer.from(after.config.dataBase64, "base64").equals(configExpected));
  assert(Buffer.from(after.position.dataBase64, "base64").equals(positionExpected));
  assert(Buffer.from(after.stakeRaw.dataBase64, "base64").equals(stakeExpected));
  assert(Buffer.from(after.destinationRaw.dataBase64, "base64").equals(destinationExpected));
  for (const key of ["owner", "config", "position", "destinationRaw", "stakeRaw"]) {
    assert.equal(after[key].owner, before[key].owner, `${key} owner changed`);
    assert.equal(after[key].lamports, before[key].lamports, `${key} lamports changed`);
    assert.equal(after[key].executable, before[key].executable, `${key} executable changed`);
  }
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
  const destination = new PublicKey(required(args, "source"));
  const candidatePath = required(args, "candidate");
  const gitHead = required(args, "git-head");
  assert.match(gitHead, /^[0-9a-f]{40}$/u);
  const economyArtifactSha256 = required(args, "economy-artifact-sha256");
  const lawArtifactSha256 = required(args, "law-artifact-sha256");
  const economyBuildLog = required(args, "economy-build-log");
  const lawBuildLog = required(args, "law-build-log");

  const base = deriveAddresses(mint, owner.publicKey, destination);
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

  const canonicalMint = await awaitCanonicalMint(connection, mint);
  const initialSource = await getAccount(connection, destination, "finalized", TOKEN_2022_PROGRAM_ID);
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

  requireSuccess(record("seed-withdraw-state", await submit(connection, sponsor, [owner], [
    seedWithdrawInstruction(base, owner.publicKey),
  ])), "seed exact mature Position and Config");
  // The fixture uses the actual hooked Token-2022 transfer into the canonical stake PDA.
  const { createTransferCheckedWithTransferHookInstruction } = await import("@solana/spl-token");
  requireSuccess(record("transfer-to-stake", await submit(connection, sponsor, [owner], [
    await createTransferCheckedWithTransferHookInstruction(
      connection, destination, mint, base.stake, owner.publicKey, WITHDRAW_PRINCIPAL,
      DECIMALS, [], "finalized", TOKEN_2022_PROGRAM_ID,
    ),
  ])), "fund stake through hook");

  const lawFirstBefore = await snapshot(connection, base);
  requireFailure(record("law-first", await submit(connection, sponsor, [owner], [
    withdrawInstruction(base, 0, { hostileLaw: true }),
  ])), "Law authentication before malformed production decode", /custom program error: 0xb30b\b/iu);
  assertRollback(lawFirstBefore, await snapshot(connection, base), "law-first rejection");

  const hookBefore = await snapshot(connection, base);
  requireFailure(record("hook-rejection", await submit(connection, sponsor, [owner], [
    createApproveCheckedInstruction(
      destination, mint, sponsor.publicKey, owner.publicKey, 1n,
      DECIMALS, [], TOKEN_2022_PROGRAM_ID,
    ),
    withdrawInstruction(base, 0),
  ])), "fixture-marked hook rejection", /custom program error: 0xe415\b/iu);
  assertRollback(hookBefore, await snapshot(connection, base), "hook rejection");
  requireSuccess(record("clear-hook-fixture-marker", await submit(connection, sponsor, [owner], [
    createRevokeInstruction(destination, owner.publicKey, [], TOKEN_2022_PROGRAM_ID),
  ])), "clear fixture-only hook rejection marker");

  const lateBefore = await snapshot(connection, base);
  requireFailure(record("post-success-wrapper-rollback", await submit(connection, sponsor, [owner], [
    withdrawInstruction(base, 1),
  ])), "failure injected after real executor success", /custom program error: 0xe304\b/iu);
  assertRollback(lateBefore, await snapshot(connection, base), "post-success wrapper failure");

  const successBefore = await snapshot(connection, base);
  requireSuccess(record("withdraw-success", await submit(connection, sponsor, [owner], [
    withdrawInstruction(base, 0),
  ])), "exact 12-account production withdrawal");
  const successAfter = await snapshot(connection, base);
  assertValidWithdrawDelta(successBefore, successAfter);

  const evidence = {
    schema: SCHEMA,
    status: "PASS",
    gitHead,
    generatedAt: new Date().toISOString(),
    scope: {
      rpc: required(args, "rpc"),
      loopbackOnly: true,
      publicNetworkWrites: false,
      syntheticFixtureInstructionWrapper: true,
      syntheticProgramErrorMapping: true,
      syntheticStakeFundingHookBypass: true,
    },
    fixture: {
      productionCandidate: false,
      economyProgramId: ECONOMY_PROGRAM_ID.toBase58(),
      lawHookProgramId: LAW_HOOK_PROGRAM_ID.toBase58(),
      economyArtifactSha256,
      lawArtifactSha256,
      economySourceSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-withdraw-position/economy/src/lib.rs")),
      lawHookSourceSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-withdraw-position/law-hook/src/lib.rs")),
      driverSha256: sha256File(import.meta.filename),
      cargoLockSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-withdraw-position/Cargo.lock")),
      economyBuildLogSha256: sha256File(economyBuildLog),
      lawBuildLogSha256: sha256File(lawBuildLog),
    },
    productionSource: {
      withdrawExecutorSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/production_withdraw_position_executor.rs")),
      withdrawPreflightSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/production_withdraw_position.rs")),
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
      realProductionWithdrawPositionExecutorInvoked: true,
      exactProductionInstructionCodecPassedThrough: true,
      exactTwelveAccountSuccess: true,
      canonicalToken2022MintAuthenticated: true,
      exactHookLawGraphResolved: true,
      lawAuthenticationPrecededMalformedInstructionDecode: true,
      hookFailureRolledBackDelegateConfigPositionAndTokens: true,
      lateWrapperFailureRolledBackConfigPositionAndTokens: true,
      exactConfigPositionCasObserved: true,
      exactStakeToDestinationTransferObserved: true,
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
      buildSourceClosureVerified: false,
      reproducibleBinaryProven: false,
      productionStakeIngressProven: false,
      productionIdentitiesFrozen: false,
      productionGenesisTokenDistributionConservationProven: false,
      activationLifecycleProven: false,
      fundingCeremonyProven: false,
      adversarialDevnetProven: false,
      publicDevnetExecuted: false,
      all15HandlersComplete: false,
      releaseGraphNodeComplete: false,
      activationReady: false,
      mainnetExecutionAuthorized: false,
      mainnetHold: true,
    },
    mainnetStatus: "HOLD",
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
