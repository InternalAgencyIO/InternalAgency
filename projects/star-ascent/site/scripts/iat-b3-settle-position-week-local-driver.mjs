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
  getAccount,
  getExtensionData,
  getExtensionTypes,
  getExtraAccountMetaAddress,
  getExtraAccountMetas,
  getMint,
  getTransferHook,
  getTransferHookAccount,
  createApproveCheckedInstruction,
  createExecuteInstruction,
  createInitializeAccount3Instruction,
  createRevokeInstruction,
  getAccountLenForMint,
} from "@solana/spl-token";
import {
  deriveSolanaDraw,
  protocolLocalDay,
} from "./iat-b3-local-rehearsal-driver.mjs";

const SCHEMA = "iat-b3-settle-position-week-production-executor-loopback/v1";
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
const MAIN_POSITION_ID = 7n;
const ZERO_SKIP_POSITION_ID = 8n;
const SETTLEMENT_WEEK = 4n;
const LANE = Object.freeze({ treasury: 1, ecosystem: 2, liquidity: 4 });
const LANE_FUNDING = 20_000n;
const CONTROL_TLV_LEN = 46;
const CONTROL_DISCRIMINATOR = Buffer.from("IATB3CTL", "ascii");
const CONTROL_PAYLOAD_LEN = 34;
const CONTROL_VERSION = 1;
const ZERO_SKIP_TRANSFERS = Object.freeze([0n, 10_000n, 0n]);
const MAIN_TRANSFERS = Object.freeze([6_000n, 3_000n, 1_000n]);

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

function encodeSettlePositionWeek() {
  const data = Buffer.alloc(32);
  data.set(Buffer.from("IATB3EC1"), 0);
  data[8] = 1;
  data[9] = 7;
  data.writeBigUInt64LE(SETTLEMENT_WEEK, 16);
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

function decodeValidationControl(data) {
  assert(data.length > CONTROL_TLV_LEN, "validation account lacks Execute list");
  const offset = data.length - CONTROL_TLV_LEN;
  const control = data.subarray(offset);
  assert(control.subarray(0, 8).equals(CONTROL_DISCRIMINATOR));
  assert.equal(control.readUInt32LE(8), CONTROL_PAYLOAD_LEN);
  assert.equal(control[12], CONTROL_VERSION);
  assert(control[13] <= 3);
  return Object.freeze({
    executeList: Buffer.from(data.subarray(0, offset)),
    ordinal: control[13],
    controller: new PublicKey(control.subarray(14, 46)),
    ordinalOffset: offset + 13,
  });
}

function assertSingleReadOnlyLawMeta(validation, lawState) {
  const metas = getExtraAccountMetas(validation);
  assert.equal(metas.length, 1);
  assert.equal(metas[0].discriminator, 0);
  assert(Buffer.from(metas[0].addressConfig).equals(lawState.toBuffer()));
  assert.equal(metas[0].isSigner, false);
  assert.equal(metas[0].isWritable, false);
  return metas;
}

function assertExactControlMutation(before, after, expectedOrdinal, expectedController) {
  assert.equal(after.owner.toBase58(), before.owner.toBase58());
  assert.equal(after.lamports, before.lamports);
  assert.equal(after.executable, before.executable);
  const left = decodeValidationControl(before.data);
  const right = decodeValidationControl(after.data);
  assert(left.executeList.equals(right.executeList), "Execute ExtraAccountMetaList changed");
  assert(left.controller.equals(expectedController));
  assert(right.controller.equals(expectedController));
  assert.equal(right.ordinal, expectedOrdinal);
  const expected = Buffer.from(before.data);
  expected[right.ordinalOffset] = expectedOrdinal;
  assert(after.data.equals(expected), "validation changed beyond the control ordinal");
}

function assertLawUnchanged(before, after, label) {
  assert.deepEqual(compactRaw(after), compactRaw(before), `${label} changed authenticated Law bytes`);
}

async function rawAccountSnapshot(connection, keys, label) {
  const infos = await connection.getMultipleAccountsInfo(keys, "finalized");
  assert(infos.every((value) => value !== null), `${label} account missing`);
  return infos.map(compactRaw);
}

async function assertRawAccountsUnchanged(connection, keys, before, label) {
  assert.deepEqual(
    await rawAccountSnapshot(connection, keys, label),
    before,
    `${label} changed account bytes or metadata`,
  );
}

async function snapshot(connection, addresses, position) {
  const keys = [
    addresses.owner,
    addresses.config,
    position,
    addresses.treasury,
    addresses.ecosystem,
    addresses.liquidity,
    addresses.destination,
    addresses.treasuryToken,
    addresses.ecosystemToken,
    addresses.liquidityToken,
    addresses.lawState,
    addresses.validation,
  ];
  const infos = await connection.getMultipleAccountsInfo(keys, "finalized");
  assert(infos.every((value) => value !== null), "settlement snapshot account missing");
  const tokens = await Promise.all([
    getAccount(connection, addresses.destination, "finalized", TOKEN_2022_PROGRAM_ID),
    getAccount(connection, addresses.treasuryToken, "finalized", TOKEN_2022_PROGRAM_ID),
    getAccount(connection, addresses.ecosystemToken, "finalized", TOKEN_2022_PROGRAM_ID),
    getAccount(connection, addresses.liquidityToken, "finalized", TOKEN_2022_PROGRAM_ID),
  ]);
  return Object.freeze({
    owner: compactRaw(infos[0]),
    config: compactRaw(infos[1]),
    position: compactRaw(infos[2]),
    treasury: compactRaw(infos[3]),
    ecosystem: compactRaw(infos[4]),
    liquidity: compactRaw(infos[5]),
    destinationRaw: compactRaw(infos[6]),
    treasuryTokenRaw: compactRaw(infos[7]),
    ecosystemTokenRaw: compactRaw(infos[8]),
    liquidityTokenRaw: compactRaw(infos[9]),
    lawState: compactRaw(infos[10]),
    validation: compactRaw(infos[11]),
    destinationToken: compactToken(tokens[0]),
    treasuryToken: compactToken(tokens[1]),
    ecosystemToken: compactToken(tokens[2]),
    liquidityToken: compactToken(tokens[3]),
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

function executeHookInstruction(addresses, { authority, amount, signer = false, destination }) {
  const instruction = createExecuteInstruction(
    LAW_HOOK_PROGRAM_ID,
    addresses.destination,
    addresses.mint,
    destination ?? addresses.treasuryToken,
    authority,
    addresses.validation,
    amount,
  );
  instruction.keys[3].isSigner = signer;
  instruction.keys.push({ pubkey: addresses.lawState, isSigner: false, isWritable: false });
  return instruction;
}

async function createFixtureTokenAccount(connection, sponsor, mint, tokenOwner) {
  const token = Keypair.generate();
  const mintState = await getMint(connection, mint, "finalized", TOKEN_2022_PROGRAM_ID);
  const length = getAccountLenForMint(mintState);
  const lamports = await connection.getMinimumBalanceForRentExemption(length, "finalized");
  const result = requireSuccess(await submit(connection, sponsor, [token], [
    SystemProgram.createAccount({
      fromPubkey: sponsor.publicKey,
      newAccountPubkey: token.publicKey,
      lamports,
      space: length,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeAccount3Instruction(token.publicKey, mint, tokenOwner, TOKEN_2022_PROGRAM_ID),
  ]), "create hostile fixture token account");
  return Object.freeze({ address: token.publicKey, result });
}

async function assertTokenAccountsUnchanged(connection, keys, before, label) {
  const after = await connection.getMultipleAccountsInfo(keys, "finalized");
  assert(after.every((value) => value !== null), `${label} account missing`);
  assert.deepEqual(after.map(compactRaw), before, `${label} changed token-account bytes`);
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
  const laneState = (lane) => PublicKey.findProgramAddressSync(
    [Buffer.from("lane"), config.toBuffer(), Buffer.from([lane])],
    ECONOMY_PROGRAM_ID,
  )[0];
  const laneToken = (lane) => PublicKey.findProgramAddressSync(
    [Buffer.from("lane-token"), config.toBuffer(), Buffer.from([lane])],
    ECONOMY_PROGRAM_ID,
  )[0];
  const position = (positionId) => PublicKey.findProgramAddressSync(
    [Buffer.from("position"), config.toBuffer(), owner.toBuffer(), u64le(positionId)],
    ECONOMY_PROGRAM_ID,
  )[0];
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
    treasury: laneState(LANE.treasury),
    ecosystem: laneState(LANE.ecosystem),
    liquidity: laneState(LANE.liquidity),
    treasuryToken: laneToken(LANE.treasury),
    ecosystemToken: laneToken(LANE.ecosystem),
    liquidityToken: laneToken(LANE.liquidity),
    mainPosition: position(MAIN_POSITION_ID),
    zeroSkipPosition: position(ZERO_SKIP_POSITION_ID),
    lawState,
    validation: getExtraAccountMetaAddress(mint, LAW_HOOK_PROGRAM_ID),
  });
}

function lawInstruction({ authority, mint, lawState, validation = null, opcode, mode = null, ancestor = null }) {
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
  assert(opcode === 1 || opcode === 3);
  if (opcode === 3) {
    assert(validation instanceof PublicKey);
    return new TransactionInstruction({
      programId: LAW_HOOK_PROGRAM_ID,
      keys: [
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: validation, isSigner: false, isWritable: true },
        { pubkey: lawState, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([3, mode]),
    });
  }
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

function initializeLaneTokenInstruction(addresses, payer, lane, token) {
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: addresses.mint, isSigner: false, isWritable: false },
      { pubkey: token, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0, lane]),
  });
}

function seedStateInstruction(addresses, payer) {
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: addresses.mint, isSigner: false, isWritable: false },
      { pubkey: addresses.config, isSigner: false, isWritable: true },
      { pubkey: addresses.treasury, isSigner: false, isWritable: true },
      { pubkey: addresses.ecosystem, isSigner: false, isWritable: true },
      { pubkey: addresses.liquidity, isSigner: false, isWritable: true },
      { pubkey: addresses.mainPosition, isSigner: false, isWritable: true },
      { pubkey: addresses.zeroSkipPosition, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: addresses.lawState, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

function settleInstruction(
  addresses,
  position,
  mode,
  { hostileLaw = false, malformedInstruction = false } = {},
) {
  const keys = [
    { pubkey: addresses.owner, isSigner: true, isWritable: false },
    { pubkey: addresses.config, isSigner: false, isWritable: false },
    { pubkey: position, isSigner: false, isWritable: true },
    { pubkey: addresses.mint, isSigner: false, isWritable: false },
    { pubkey: addresses.vaultAuthority, isSigner: false, isWritable: false },
    { pubkey: addresses.treasury, isSigner: false, isWritable: true },
    { pubkey: addresses.treasuryToken, isSigner: false, isWritable: true },
    { pubkey: addresses.ecosystem, isSigner: false, isWritable: true },
    { pubkey: addresses.ecosystemToken, isSigner: false, isWritable: true },
    { pubkey: addresses.liquidity, isSigner: false, isWritable: true },
    { pubkey: addresses.liquidityToken, isSigner: false, isWritable: true },
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
      Buffer.from([2, mode]),
      malformedInstruction ? Buffer.alloc(32, 0xff) : encodeSettlePositionWeek(),
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
  return Object.freeze({
    config: decodeConfig(Buffer.from(snapshot.config.dataBase64, "base64")),
    position: decodePosition(Buffer.from(snapshot.position.dataBase64, "base64")),
    lanes: [snapshot.treasury, snapshot.ecosystem, snapshot.liquidity]
      .map((raw) => decodeLane(Buffer.from(raw.dataBase64, "base64"))),
  });
}

function assertTokenInvokeCount(result, expected) {
  const observed = result.logs.filter((line) =>
    line.includes(`Program ${TOKEN_2022_PROGRAM_ID.toBase58()} invoke`)).length;
  assert.equal(observed, expected, `expected ${expected} ordered Token-2022 CPI(s), observed ${observed}`);
}

function assertRawMetadataStable(before, after) {
  for (const key of [
    "owner", "config", "position", "treasury", "ecosystem", "liquidity",
    "destinationRaw", "treasuryTokenRaw", "ecosystemTokenRaw", "liquidityTokenRaw", "lawState",
  ]) {
    assert.equal(after[key].owner, before[key].owner, `${key} owner changed`);
    assert.equal(after[key].lamports, before[key].lamports, `${key} lamports changed`);
    assert.equal(after[key].executable, before[key].executable, `${key} executable changed`);
  }
}

function assertExactSettlementDelta(before, after, transfers) {
  const left = decodedEconomic(before);
  const right = decodedEconomic(after);
  const total = transfers.reduce((sum, amount) => sum + amount, 0n);
  assert.equal(right.position.paid - left.position.paid, total);
  assert.equal(right.position.settledMask, left.position.settledMask | 1n);
  const beforeReservations = [
    left.position.treasuryReserved,
    left.position.ecosystemReserved,
    left.position.liquidityReserved,
  ];
  const afterReservations = [
    right.position.treasuryReserved,
    right.position.ecosystemReserved,
    right.position.liquidityReserved,
  ];
  for (let index = 0; index < 3; index += 1) {
    assert.equal(afterReservations[index], beforeReservations[index] - transfers[index]);
    assert.equal(right.lanes[index].reserved, left.lanes[index].reserved - transfers[index]);
    assert.equal(right.lanes[index].paid, left.lanes[index].paid + transfers[index]);
  }
  const positionExpected = Buffer.from(before.position.dataBase64, "base64");
  for (let index = 0; index < 3; index += 1) {
    positionExpected.writeBigUInt64LE(beforeReservations[index] - transfers[index], 128 + index * 8);
  }
  positionExpected.writeBigUInt64LE(left.position.paid + total, 152);
  positionExpected.writeBigUInt64LE(left.position.settledMask | 1n, 160);
  assert(Buffer.from(after.position.dataBase64, "base64").equals(positionExpected));

  for (const [index, key] of ["treasury", "ecosystem", "liquidity"].entries()) {
    const expected = Buffer.from(before[key].dataBase64, "base64");
    expected.writeBigUInt64LE(left.lanes[index].reserved - transfers[index], 144);
    expected.writeBigUInt64LE(left.lanes[index].paid + transfers[index], 152);
    assert(Buffer.from(after[key].dataBase64, "base64").equals(expected));
  }
  const tokenKeys = ["treasuryToken", "ecosystemToken", "liquidityToken"];
  const tokenRawKeys = ["treasuryTokenRaw", "ecosystemTokenRaw", "liquidityTokenRaw"];
  let sourceDebit = 0n;
  for (let index = 0; index < 3; index += 1) {
    const beforeAmount = BigInt(before[tokenKeys[index]].amount);
    const afterAmount = BigInt(after[tokenKeys[index]].amount);
    assert.equal(beforeAmount - afterAmount, transfers[index]);
    sourceDebit += transfers[index];
    const expected = Buffer.from(before[tokenRawKeys[index]].dataBase64, "base64");
    expected.writeBigUInt64LE(beforeAmount - transfers[index], 64);
    assert(Buffer.from(after[tokenRawKeys[index]].dataBase64, "base64").equals(expected));
  }
  const destinationBefore = BigInt(before.destinationToken.amount);
  const destinationAfter = BigInt(after.destinationToken.amount);
  assert.equal(destinationAfter - destinationBefore, total);
  assert.equal(sourceDebit, destinationAfter - destinationBefore);
  const destinationExpected = Buffer.from(before.destinationRaw.dataBase64, "base64");
  destinationExpected.writeBigUInt64LE(destinationBefore + total, 64);
  assert(Buffer.from(after.destinationRaw.dataBase64, "base64").equals(destinationExpected));
  for (const key of ["owner", "config", "lawState"]) {
    assert.deepEqual(after[key], before[key], `${key} changed during settlement`);
  }
  assertRawMetadataStable(before, after);
}

async function assertReservationConservation(connection, addresses) {
  const infos = await connection.getMultipleAccountsInfo([
    addresses.treasury,
    addresses.ecosystem,
    addresses.liquidity,
    addresses.mainPosition,
    addresses.zeroSkipPosition,
  ], "finalized");
  assert(infos.every((value) => value !== null));
  const lanes = infos.slice(0, 3).map(({ data }) => decodeLane(data));
  const positions = infos.slice(3).map(({ data }) => decodePosition(data));
  for (let index = 0; index < 3; index += 1) {
    const reserved = positions.reduce((sum, position) => sum + [
      position.treasuryReserved,
      position.ecosystemReserved,
      position.liquidityReserved,
    ][index], 0n);
    assert.equal(lanes[index].reserved, reserved, `lane ${index} reservation conservation failed`);
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
  for (const [label, lane, token] of [
    ["treasury", LANE.treasury, base.treasuryToken],
    ["ecosystem", LANE.ecosystem, base.ecosystemToken],
    ["liquidity", LANE.liquidity, base.liquidityToken],
  ]) {
    requireSuccess(record(`initialize-${label}-token`, await submit(connection, sponsor, [owner], [
      initializeLaneTokenInstruction(base, owner.publicKey, lane, token),
    ])), `initialize ${label} lane token`);
  }
  const validation = await connection.getAccountInfo(base.validation, "finalized");
  assert(validation);
  assert(validation.owner.equals(LAW_HOOK_PROGRAM_ID));
  const metas = assertSingleReadOnlyLawMeta(validation, base.lawState);
  const validationBaseline = compactRaw(validation);
  const validationControlBaseline = decodeValidationControl(validation.data);
  assert.equal(validationControlBaseline.ordinal, 0);
  assert(validationControlBaseline.controller.equals(owner.publicKey));
  const lawAccount = await connection.getAccountInfo(base.lawState, "finalized");
  assert(lawAccount?.owner.equals(LAW_HOOK_PROGRAM_ID));

  const controlAccounts = [owner.publicKey, mint, base.validation, base.lawState];
  let controlHostileBefore = await rawAccountSnapshot(
    connection,
    controlAccounts,
    "unsigned controller hostile",
  );
  const unsignedControl = lawInstruction({
    authority: owner.publicKey,
    mint,
    validation: base.validation,
    lawState: base.lawState,
    opcode: 3,
    mode: 1,
  });
  unsignedControl.keys[0].isSigner = false;
  requireFailure(record("set-control-unsigned-controller-rejected", await submit(
    connection,
    sponsor,
    [],
    [unsignedControl],
  )), "unsigned control authority", /custom program error: 0xe411\b/iu);
  await assertRawAccountsUnchanged(
    connection,
    controlAccounts,
    controlHostileBefore,
    "unsigned controller hostile",
  );

  controlHostileBefore = await rawAccountSnapshot(
    connection,
    controlAccounts,
    "wrong validation hostile",
  );
  requireFailure(record("set-control-wrong-validation-rejected", await submit(
    connection,
    sponsor,
    [owner],
    [lawInstruction({
      authority: owner.publicKey,
      mint,
      validation: owner.publicKey,
      lawState: base.lawState,
      opcode: 3,
      mode: 1,
    })],
  )), "wrong validation address and owner", /custom program error: 0xe411\b/iu);
  await assertRawAccountsUnchanged(
    connection,
    controlAccounts,
    controlHostileBefore,
    "wrong validation hostile",
  );

  controlHostileBefore = await rawAccountSnapshot(
    connection,
    controlAccounts,
    "invalid ordinal hostile",
  );
  requireFailure(record("set-control-invalid-ordinal-rejected", await submit(
    connection,
    sponsor,
    [owner],
    [lawInstruction({
      authority: owner.publicKey,
      mint,
      validation: base.validation,
      lawState: base.lawState,
      opcode: 3,
      mode: 4,
    })],
  )), "invalid control ordinal", /custom program error: 0xe410\b/iu);
  await assertRawAccountsUnchanged(
    connection,
    controlAccounts,
    controlHostileBefore,
    "invalid ordinal hostile",
  );
  for (const token of [base.treasuryToken, base.ecosystemToken, base.liquidityToken]) {
    const account = await getAccount(connection, token, "finalized", TOKEN_2022_PROGRAM_ID);
    assertCanonicalTokenAccount(account, mint, base.vaultAuthority);
    assert.equal(account.amount, 0n);
  }

  requireSuccess(record("seed-standard-state", await submit(connection, sponsor, [owner], [
    seedStateInstruction(base, owner.publicKey),
  ])), "seed ACTIVE Config, exact three lanes, and two standard Positions");

  // Fixture-only owner-authorized funding uses the actual Token-2022 hook. The
  // hook interface deliberately presents the authority as a nonsigner.
  const { createTransferCheckedWithTransferHookInstruction } = await import("@solana/spl-token");
  const hostileDestinationCreation = await createFixtureTokenAccount(
    connection,
    sponsor,
    mint,
    owner.publicKey,
  );
  record("create-hostile-destination", hostileDestinationCreation.result);
  const hostileDestination = hostileDestinationCreation.address;
  const hostileKeys = [destination, base.treasuryToken, hostileDestination];
  const hostileBeforeInfos = await connection.getMultipleAccountsInfo(hostileKeys, "finalized");
  assert(hostileBeforeInfos.every((value) => value !== null), "hostile account missing");
  const hostileBefore = hostileBeforeInfos.map(compactRaw);
  const directNonsigner = requireFailure(record(
    "direct-hook-nonsigner-rejected",
    await submit(connection, sponsor, [], [
      executeHookInstruction(base, { authority: owner.publicKey, amount: 1n }),
    ]),
  ), "direct nonsigner hook Execute bypass", /custom program error: 0xe412\b/iu);
  const directSigner = requireFailure(record(
    "direct-hook-signer-rejected",
    await submit(connection, sponsor, [owner], [
      executeHookInstruction(base, { authority: owner.publicKey, amount: 1n, signer: true }),
    ]),
  ), "direct signer hook Execute bypass", /custom program error: 0xe412\b/iu);
  assertTokenInvokeCount(directNonsigner, 0);
  assertTokenInvokeCount(directSigner, 0);
  await assertTokenAccountsUnchanged(
    connection,
    hostileKeys,
    hostileBefore,
    "direct hook bypasses",
  );

  const zeroTransfer = requireFailure(record(
    "zero-funding-rejected",
    await submit(connection, sponsor, [owner], [
      await createTransferCheckedWithTransferHookInstruction(
        connection, destination, mint, base.treasuryToken, owner.publicKey, 0n,
        DECIMALS, [], "finalized", TOKEN_2022_PROGRAM_ID,
      ),
    ]),
  ), "zero synthetic funding", /custom program error: 0xe413\b/iu);
  assertTokenInvokeCount(zeroTransfer, 1);
  await assertTokenAccountsUnchanged(connection, hostileKeys, hostileBefore, "zero funding");

  const nonLaneTransfer = requireFailure(record(
    "nonlane-funding-rejected",
    await submit(connection, sponsor, [owner], [
      await createTransferCheckedWithTransferHookInstruction(
        connection, destination, mint, hostileDestination, owner.publicKey, 1n,
        DECIMALS, [], "finalized", TOKEN_2022_PROGRAM_ID,
      ),
    ]),
  ), "non-lane synthetic funding", /custom program error: 0xe413\b/iu);
  assertTokenInvokeCount(nonLaneTransfer, 1);
  await assertTokenAccountsUnchanged(connection, hostileKeys, hostileBefore, "non-lane funding");

  const delegate = Keypair.generate();
  requireSuccess(record("approve-hostile-delegate", await submit(connection, sponsor, [owner], [
    createApproveCheckedInstruction(
      destination, mint, delegate.publicKey, owner.publicKey, 1n, DECIMALS, [],
      TOKEN_2022_PROGRAM_ID,
    ),
  ])), "approve hostile delegate");
  const delegatedBeforeInfos = await connection.getMultipleAccountsInfo(hostileKeys, "finalized");
  assert(delegatedBeforeInfos.every((value) => value !== null), "delegated account missing");
  const delegatedBefore = delegatedBeforeInfos.map(compactRaw);
  const delegateTransfer = requireFailure(record(
    "delegate-funding-rejected",
    await submit(connection, sponsor, [delegate], [
      await createTransferCheckedWithTransferHookInstruction(
        connection, destination, mint, base.treasuryToken, delegate.publicKey, 1n,
        DECIMALS, [], "finalized", TOKEN_2022_PROGRAM_ID,
      ),
    ]),
  ), "delegated synthetic funding", /custom program error: 0xe413\b/iu);
  assertTokenInvokeCount(delegateTransfer, 1);
  await assertTokenAccountsUnchanged(
    connection,
    hostileKeys,
    delegatedBefore,
    "delegated funding",
  );
  requireSuccess(record("revoke-hostile-delegate", await submit(connection, sponsor, [owner], [
    createRevokeInstruction(destination, owner.publicKey, [], TOKEN_2022_PROGRAM_ID),
  ])), "revoke hostile delegate");
  assertCanonicalTokenAccount(
    await getAccount(connection, destination, "finalized", TOKEN_2022_PROGRAM_ID),
    mint,
    owner.publicKey,
  );

  for (const [label, token] of [
    ["treasury", base.treasuryToken],
    ["ecosystem", base.ecosystemToken],
    ["liquidity", base.liquidityToken],
  ]) {
    const [sourceRawBefore, laneRawBefore] = await connection.getMultipleAccountsInfo(
      [destination, token],
      "finalized",
    );
    assert(sourceRawBefore && laneRawBefore, `missing raw ${label} funding account`);
    const sourceBefore = await getAccount(connection, destination, "finalized", TOKEN_2022_PROGRAM_ID);
    const laneBefore = await getAccount(connection, token, "finalized", TOKEN_2022_PROGRAM_ID);
    requireSuccess(record(`fund-${label}-lane`, await submit(connection, sponsor, [owner], [
      await createTransferCheckedWithTransferHookInstruction(
        connection, destination, mint, token, owner.publicKey, LANE_FUNDING,
        DECIMALS, [], "finalized", TOKEN_2022_PROGRAM_ID,
      ),
    ])), `fund ${label} lane through fixture hook`);
    const sourceAfter = await getAccount(connection, destination, "finalized", TOKEN_2022_PROGRAM_ID);
    const laneAfter = await getAccount(connection, token, "finalized", TOKEN_2022_PROGRAM_ID);
    assert.equal(sourceBefore.amount - sourceAfter.amount, LANE_FUNDING);
    assert.equal(laneAfter.amount - laneBefore.amount, LANE_FUNDING);
    const [sourceRawAfter, laneRawAfter] = await connection.getMultipleAccountsInfo(
      [destination, token],
      "finalized",
    );
    assert(sourceRawAfter && laneRawAfter, `missing raw post-${label} funding account`);
    const sourceExpected = Buffer.from(sourceRawBefore.data);
    sourceExpected.writeBigUInt64LE(sourceBefore.amount - LANE_FUNDING, 64);
    const laneExpected = Buffer.from(laneRawBefore.data);
    laneExpected.writeBigUInt64LE(laneBefore.amount + LANE_FUNDING, 64);
    assert(sourceRawAfter.data.equals(sourceExpected), `${label} source changed beyond amount`);
    assert(laneRawAfter.data.equals(laneExpected), `${label} lane changed beyond amount`);
    for (const [before, after, accountLabel] of [
      [sourceRawBefore, sourceRawAfter, "source"],
      [laneRawBefore, laneRawAfter, "lane"],
    ]) {
      assert(before.owner.equals(after.owner), `${label} ${accountLabel} owner changed`);
      assert.equal(after.lamports, before.lamports, `${label} ${accountLabel} lamports changed`);
      assert.equal(after.executable, before.executable, `${label} ${accountLabel} executable changed`);
    }
  }
  await assertReservationConservation(connection, base);

  const localDay = await validatorProtocolDay(connection);
  const lockedAncestor = findLockedAncestor(mint, localDay);
  requireSuccess(record("lock-law-for-precedence", await submit(connection, sponsor, [owner], [
    lawInstruction({
      authority: owner.publicKey,
      mint,
      lawState: base.lawState,
      opcode: 1,
      mode: 1,
      ancestor: lockedAncestor,
    }),
  ])), "lock Daily Law for precedence proof");
  const lockedControlBefore = await snapshot(connection, base, base.mainPosition);
  requireFailure(record("set-control-locked-law-rejected", await submit(
    connection,
    sponsor,
    [owner],
    [lawInstruction({
      authority: owner.publicKey,
      mint,
      validation: base.validation,
      lawState: base.lawState,
      opcode: 3,
      mode: 1,
    })],
  )), "control update under locked Daily Law", /custom program error: 0xe416\b/iu);
  assertRollback(
    lockedControlBefore,
    await snapshot(connection, base, base.mainPosition),
    "locked-Law control rejection",
  );
  const lawFirstBefore = await snapshot(connection, base, base.mainPosition);
  const lawFirst = requireFailure(record("law-first-malformed-production", await submit(
    connection,
    sponsor,
    [owner],
    [settleInstruction(base, base.mainPosition, 0, { malformedInstruction: true })],
  )), "Law authentication before malformed production decode", /custom program error: 0xb30d\b/iu);
  assertTokenInvokeCount(lawFirst, 0);
  assertRollback(
    lawFirstBefore,
    await snapshot(connection, base, base.mainPosition),
    "law-first malformed-production rejection",
  );
  requireSuccess(record("reopen-law", await submit(connection, sponsor, [owner], [
    lawInstruction({
      authority: owner.publicKey,
      mint,
      lawState: base.lawState,
      opcode: 1,
      mode: 0,
    }),
  ])), "restore open Daily Law");

  const zeroBefore = await snapshot(connection, base, base.zeroSkipPosition);
  const zeroSuccess = requireSuccess(record("zero-skip-success", await submit(
    connection,
    sponsor,
    [owner],
    [settleInstruction(base, base.zeroSkipPosition, 0)],
  )), "standard settlement with zero Treasury/Liquidity CPIs skipped");
  assertTokenInvokeCount(zeroSuccess, 1);
  const zeroAfter = await snapshot(connection, base, base.zeroSkipPosition);
  assertExactSettlementDelta(zeroBefore, zeroAfter, ZERO_SKIP_TRANSFERS);
  await assertReservationConservation(connection, base);

  for (let ordinal = 1; ordinal <= 3; ordinal += 1) {
    const [controlBefore, controlLawBefore] = await connection.getMultipleAccountsInfo(
      [base.validation, base.lawState],
      "finalized",
    );
    assert(controlBefore && controlLawBefore);
    requireSuccess(record(`set-hook-rejection-${ordinal}`, await submit(connection, sponsor, [owner], [
      lawInstruction({
        authority: owner.publicKey,
        mint,
        validation: base.validation,
        lawState: base.lawState,
        opcode: 3,
        mode: ordinal,
      }),
    ])), `set synthetic hook rejection ordinal ${ordinal}`);
    const [controlAfter, controlLawAfter] = await connection.getMultipleAccountsInfo(
      [base.validation, base.lawState],
      "finalized",
    );
    assert(controlAfter && controlLawAfter);
    assertSingleReadOnlyLawMeta(controlAfter, base.lawState);
    assertExactControlMutation(controlBefore, controlAfter, ordinal, owner.publicKey);
    assertLawUnchanged(controlLawBefore, controlLawAfter, `set ordinal ${ordinal}`);
    const before = await snapshot(connection, base, base.mainPosition);
    const failure = requireFailure(record(`ordered-hook-rejection-${ordinal}`, await submit(
      connection,
      sponsor,
      [owner],
      [settleInstruction(base, base.mainPosition, 0)],
    )), `ordered transfer ${ordinal} hook rejection`, /custom program error: 0xe415\b/iu);
    assertTokenInvokeCount(failure, ordinal);
    assertRollback(
      before,
      await snapshot(connection, base, base.mainPosition),
      `ordered hook rejection ${ordinal}`,
    );
    const [clearBefore, clearLawBefore] = await connection.getMultipleAccountsInfo(
      [base.validation, base.lawState],
      "finalized",
    );
    assert(clearBefore && clearLawBefore);
    requireSuccess(record(`clear-hook-rejection-${ordinal}`, await submit(
      connection,
      sponsor,
      [owner],
      [lawInstruction({
        authority: owner.publicKey,
        mint,
        validation: base.validation,
        lawState: base.lawState,
        opcode: 3,
        mode: 0,
      })],
    )), `clear synthetic hook rejection ordinal ${ordinal}`);
    const [clearAfter, clearLawAfter] = await connection.getMultipleAccountsInfo(
      [base.validation, base.lawState],
      "finalized",
    );
    assert(clearAfter && clearLawAfter);
    assertSingleReadOnlyLawMeta(clearAfter, base.lawState);
    assertExactControlMutation(clearBefore, clearAfter, 0, owner.publicKey);
    assertLawUnchanged(clearLawBefore, clearLawAfter, `clear ordinal ${ordinal}`);
    assert.deepEqual(
      compactRaw(clearAfter),
      validationBaseline,
      `clear ordinal ${ordinal} did not restore exact validation baseline`,
    );
    await assertReservationConservation(connection, base);
  }

  const lateBefore = await snapshot(connection, base, base.mainPosition);
  const lateFailure = requireFailure(record("post-success-wrapper-rollback", await submit(connection, sponsor, [owner], [
    settleInstruction(base, base.mainPosition, 1),
  ])), "failure injected after real executor success", /custom program error: 0xe304\b/iu);
  assertTokenInvokeCount(lateFailure, 3);
  assertRollback(
    lateBefore,
    await snapshot(connection, base, base.mainPosition),
    "post-success wrapper failure",
  );
  await assertReservationConservation(connection, base);

  const successBefore = await snapshot(connection, base, base.mainPosition);
  const success = requireSuccess(record("settle-success", await submit(connection, sponsor, [owner], [
    settleInstruction(base, base.mainPosition, 0),
  ])), "exact 17-account standard production settlement");
  assertTokenInvokeCount(success, 3);
  const successAfter = await snapshot(connection, base, base.mainPosition);
  assertExactSettlementDelta(successBefore, successAfter, MAIN_TRANSFERS);
  await assertReservationConservation(connection, base);

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
      syntheticLaneFundingHookBypass: true,
      syntheticFundingAuthorizationReliesOnToken2022OuterTransfer: true,
      syntheticFundingAuthorityAppearsNonsignerInsideHook: true,
      laneToLaneHostileIsClassifierOnly: true,
      syntheticValidationPdaControlTlv: true,
      syntheticValidationControlOrdinalFailureFlag: true,
      standardOnlyCccRoundOmitted: true,
    },
    fixture: {
      productionCandidate: false,
      economyProgramId: ECONOMY_PROGRAM_ID.toBase58(),
      lawHookProgramId: LAW_HOOK_PROGRAM_ID.toBase58(),
      economyArtifactSha256,
      lawArtifactSha256,
      economySourceSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-settle-position-week/economy/src/lib.rs")),
      lawHookSourceSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-settle-position-week/law-hook/src/lib.rs")),
      driverSha256: sha256File(import.meta.filename),
      cargoLockSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-settle-position-week/Cargo.lock")),
      economyBuildLogSha256: sha256File(economyBuildLog),
      lawBuildLogSha256: sha256File(lawBuildLog),
    },
    productionSource: {
      settleExecutorSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/production_settle_position_week_executor.rs")),
      settlePreflightSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/production_settle_position_week.rs")),
      stakeIngressRuntimeSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/stake_ingress_runtime.rs")),
      nativeAdapterSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/native_adapter.rs")),
      runtimeAdapterSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/runtime_adapter.rs")),
      runtimeWriteAdapterSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/runtime_write_adapter.rs")),
      token2022RuntimeSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/token_2022_runtime.rs")),
      productionInstructionSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/production_instruction.rs")),
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
      controlDiscriminator: CONTROL_DISCRIMINATOR.toString("ascii"),
      controlPayloadLength: CONTROL_PAYLOAD_LEN,
      controlVersion: CONTROL_VERSION,
      controlController: validationControlBaseline.controller.toBase58(),
      controlBaselineOrdinal: validationControlBaseline.ordinal,
      executeListSha256: sha256Bytes(validationControlBaseline.executeList),
    },
    observed: {
      realProductionSettlePositionWeekExecutorInvoked: true,
      exactProductionInstructionCodecPassedThrough: true,
      exactSeventeenAccountStandardSuccess: true,
      cccRoundAccountOmitted: true,
      canonicalToken2022MintAuthenticated: true,
      exactHookLawGraphResolved: true,
      exactlyOneLawMetaInvariantAcrossControlUpdates: true,
      authenticatedLawBytesInvariantAcrossControlUpdates: true,
      executeMetaListBytesInvariantAcrossControlUpdates: true,
      onlyValidationControlOrdinalMutatedAndClearedToBaseline: true,
      hostileControlUpdatesRejectedWithoutAccountMutation: true,
      directSignerAndNonsignerHookBypassesRejected: true,
      delegatedFundingRejectedWithExactRollback: true,
      zeroAndNonLaneFundingRejectedWithExactRollback: true,
      positiveOwnerFundingExactDeltasObserved: true,
      lawAuthenticationPrecededMalformedInstructionDecode: true,
      firstHookFailureRolledBackAllPriorEffects: true,
      secondHookFailureRolledBackFirstCpiAndAllState: true,
      thirdHookFailureRolledBackFirstTwoCpisAndAllState: true,
      lateWrapperFailureRolledBackThreeCpisAndFourStateCas: true,
      zeroAmountTreasuryAndLiquidityCpisSkipped: true,
      exactPositionAndThreeLaneRawPostimagesObserved: true,
      exactThreeSourceAndDestinationTokenRawPostimagesObserved: true,
      exactEconomicConservationObserved: true,
      aggregateLaneReservationConservationObserved: true,
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
      productionHandlerComplete: false,
      productionFinalCombinedBinaryProven: false,
      buildSourceClosureVerified: false,
      reproducibleBinaryProven: false,
      productionLaneFundingProven: false,
      productionValidationControlAbiProven: false,
      productionFailureInjectionControlProven: false,
      cccRoundSettlementProven: false,
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
