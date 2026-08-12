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

const SCHEMA = "iat-b3-claim-lane-principal-production-executor-loopback/v1";
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
const LANE = Object.freeze({ treasury: 1, ecosystem: 2, core: 3, liquidity: 4 });
const CLAIMABLE = 100n;
const LANE_FUNDING = CLAIMABLE;
const BENEFICIARY = Object.freeze({
  treasury: new PublicKey(Uint8Array.from([176,234,210,80,127,82,123,19,225,61,194,50,57,247,40,109,9,38,213,31,165,236,251,141,147,125,148,145,25,227,197,39])),
  ecosystem: new PublicKey(Uint8Array.from([252,72,216,255,0,242,145,139,196,26,113,42,243,23,174,180,208,191,67,37,34,38,169,209,135,22,220,186,2,253,190,11])),
  core: new PublicKey(Uint8Array.from([29,63,222,204,73,139,41,10,235,128,228,15,47,185,171,204,237,167,250,94,65,128,197,208,62,251,138,246,23,206,112,130])),
  liquidity: new PublicKey(Uint8Array.from([24,24,0,128,110,46,22,67,50,225,22,170,229,182,166,239,134,210,52,26,159,168,204,64,224,169,227,240,150,80,123,107])),
});
const CONTROL_TLV_LEN = 46;
const CONTROL_DISCRIMINATOR = Buffer.from("IATB3CTL", "ascii");
const CONTROL_PAYLOAD_LEN = 34;
const CONTROL_VERSION = 1;
const CONFIG_PHASE_OFFSET = 9;
const CONFIG_ACTIVE_OFFSET = 253;
const GENESIS_PHASE_STAGING = 1;
const GENESIS_PHASE_ACTIVE = 2;

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

function publicKeyAt(data, offset) {
  return new PublicKey(data.subarray(offset, offset + 32)).toBase58();
}

function encodeClaimLanePrincipal(lane) {
  const data = Buffer.alloc(32);
  data.set(Buffer.from("IATB3EC1"), 0);
  data[8] = 1;
  data[9] = 9;
  data[16] = lane;
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

async function snapshot(connection, addresses, laneName, destination) {
  const laneState = addresses[laneName];
  const laneToken = addresses[`${laneName}Token`];
  const keys = [
    addresses.owner,
    addresses.config,
    laneState,
    laneToken,
    destination,
    addresses.lawState,
    addresses.validation,
  ];
  const infos = await connection.getMultipleAccountsInfo(keys, "finalized");
  assert(infos.every((value) => value !== null), "claim snapshot account missing");
  const tokens = await Promise.all([
    getAccount(connection, laneToken, "finalized", TOKEN_2022_PROGRAM_ID),
    getAccount(connection, destination, "finalized", TOKEN_2022_PROGRAM_ID),
  ]);
  return Object.freeze({
    owner: compactRaw(infos[0]),
    config: compactRaw(infos[1]),
    lane: compactRaw(infos[2]),
    sourceRaw: compactRaw(infos[3]),
    destinationRaw: compactRaw(infos[4]),
    lawState: compactRaw(infos[5]),
    validation: compactRaw(infos[6]),
    sourceToken: compactToken(tokens[0]),
    destinationToken: compactToken(tokens[1]),
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

function assertExactFixtureConfigLifecycleMutation(
  before,
  after,
  expectedPhase,
  expectedActive,
  label,
) {
  for (const key of [
    "owner", "lane", "sourceRaw", "destinationRaw", "lawState", "validation",
    "sourceToken", "destinationToken",
  ]) assert.deepEqual(after[key], before[key], `${label} changed ${key}`);

  assert.equal(after.config.owner, before.config.owner, `${label} changed Config owner`);
  assert.equal(after.config.lamports, before.config.lamports, `${label} changed Config lamports`);
  assert.equal(after.config.executable, before.config.executable, `${label} changed Config executable`);
  const expected = Buffer.from(before.config.dataBase64, "base64");
  expected[CONFIG_PHASE_OFFSET] = expectedPhase;
  expected[CONFIG_ACTIVE_OFFSET] = Number(expectedActive);
  assert(
    Buffer.from(after.config.dataBase64, "base64").equals(expected),
    `${label} changed Config beyond phase and active`,
  );
  const decoded = decodeConfig(expected);
  assert.equal(decoded.phase, expectedPhase, `${label} phase mismatch`);
  assert.equal(decoded.active, expectedActive, `${label} active mismatch`);
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
    core: laneState(LANE.core),
    liquidity: laneState(LANE.liquidity),
    treasuryToken: laneToken(LANE.treasury),
    ecosystemToken: laneToken(LANE.ecosystem),
    coreToken: laneToken(LANE.core),
    liquidityToken: laneToken(LANE.liquidity),
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
      { pubkey: addresses.core, isSigner: false, isWritable: true },
      { pubkey: addresses.liquidity, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: addresses.lawState, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

function configActiveInstruction(addresses, authority, active) {
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: addresses.config, isSigner: false, isWritable: true },
      { pubkey: addresses.mint, isSigner: false, isWritable: false },
      { pubkey: addresses.lawState, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([3, Number(active)]),
  });
}

function claimInstruction(
  addresses,
  laneName,
  destination,
  mode,
  {
    malformedInstruction = false,
    mint = addresses.mint,
    laneState = addresses[laneName],
    laneToken = addresses[`${laneName}Token`],
    tokenProgram = TOKEN_2022_PROGRAM_ID,
    hookProgram = LAW_HOOK_PROGRAM_ID,
    validation = addresses.validation,
    lawState = addresses.lawState,
  } = {},
) {
  const lane = LANE[laneName];
  const keys = [
    { pubkey: addresses.owner, isSigner: true, isWritable: false },
    { pubkey: addresses.config, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: addresses.vaultAuthority, isSigner: false, isWritable: false },
    { pubkey: laneState, isSigner: false, isWritable: true },
    { pubkey: laneToken, isSigner: false, isWritable: true },
    { pubkey: destination, isSigner: false, isWritable: true },
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
    { pubkey: ZK_ELGAMAL_PROOF_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: hookProgram, isSigner: false, isWritable: false },
    { pubkey: validation, isSigner: false, isWritable: false },
    { pubkey: lawState, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    programId: ECONOMY_PROGRAM_ID,
    keys,
    data: Buffer.concat([
      Buffer.from([2, mode]),
      malformedInstruction ? Buffer.alloc(32, 0xff) : encodeClaimLanePrincipal(lane),
    ]),
  });
}

function claimGraphKeys(addresses, beneficiaryDestinations) {
  return [
    addresses.owner,
    addresses.config,
    addresses.mint,
    addresses.destination,
    addresses.treasury,
    addresses.ecosystem,
    addresses.core,
    addresses.liquidity,
    addresses.treasuryToken,
    addresses.ecosystemToken,
    addresses.coreToken,
    addresses.liquidityToken,
    beneficiaryDestinations.treasury,
    beneficiaryDestinations.ecosystem,
    beneficiaryDestinations.core,
    beneficiaryDestinations.liquidity,
    addresses.validation,
    addresses.lawState,
  ];
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
    lane: decodeLane(Buffer.from(snapshot.lane.dataBase64, "base64")),
  });
}

function assertTokenInvokeCount(result, expected) {
  const observed = result.logs.filter((line) =>
    line.includes(`Program ${TOKEN_2022_PROGRAM_ID.toBase58()} invoke`)).length;
  assert.equal(observed, expected, `expected ${expected} ordered Token-2022 CPI(s), observed ${observed}`);
}

function assertRawMetadataStable(before, after) {
  for (const key of [
    "owner", "config", "lane", "sourceRaw", "destinationRaw", "lawState",
  ]) {
    assert.equal(after[key].owner, before[key].owner, `${key} owner changed`);
    assert.equal(after[key].lamports, before[key].lamports, `${key} lamports changed`);
    assert.equal(after[key].executable, before[key].executable, `${key} executable changed`);
  }
}

function assertExactClaimDelta(before, after, expectedClaimable = CLAIMABLE) {
  const left = decodedEconomic(before);
  const right = decodedEconomic(after);
  assert.equal(right.lane.principalClaimed - left.lane.principalClaimed, expectedClaimable);
  const laneExpected = Buffer.from(before.lane.dataBase64, "base64");
  laneExpected.writeBigUInt64LE(left.lane.principalClaimed + expectedClaimable, 160);
  assert(Buffer.from(after.lane.dataBase64, "base64").equals(laneExpected));
  const sourceBefore = BigInt(before.sourceToken.amount);
  const sourceAfter = BigInt(after.sourceToken.amount);
  assert.equal(sourceBefore - sourceAfter, expectedClaimable);
  const sourceExpected = Buffer.from(before.sourceRaw.dataBase64, "base64");
  sourceExpected.writeBigUInt64LE(sourceBefore - expectedClaimable, 64);
  assert(Buffer.from(after.sourceRaw.dataBase64, "base64").equals(sourceExpected));
  const destinationBefore = BigInt(before.destinationToken.amount);
  const destinationAfter = BigInt(after.destinationToken.amount);
  assert.equal(destinationAfter - destinationBefore, expectedClaimable);
  assert.equal(sourceBefore - sourceAfter, destinationAfter - destinationBefore);
  const destinationExpected = Buffer.from(before.destinationRaw.dataBase64, "base64");
  destinationExpected.writeBigUInt64LE(destinationBefore + expectedClaimable, 64);
  assert(Buffer.from(after.destinationRaw.dataBase64, "base64").equals(destinationExpected));
  for (const key of ["owner", "config", "lawState"]) {
    assert.deepEqual(after[key], before[key], `${key} changed during claim`);
  }
  assertRawMetadataStable(before, after);
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
  const wrongController = Keypair.generate();
  const mint = new PublicKey(required(args, "mint"));
  const destination = new PublicKey(required(args, "source"));
  const beneficiaryDestinations = Object.freeze({
    treasury: new PublicKey(required(args, "treasury-destination")),
    ecosystem: new PublicKey(required(args, "ecosystem-destination")),
    core: new PublicKey(required(args, "core-destination")),
    liquidity: new PublicKey(required(args, "liquidity-destination")),
  });
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

  requireSuccess(record("fund-wrong-config-controller", await submit(connection, sponsor, [], [
    SystemProgram.transfer({
      fromPubkey: sponsor.publicKey,
      toPubkey: wrongController.publicKey,
      lamports: 1_000_000,
    }),
  ])), "fund distinct readonly fixture Config controller hostile");

  const canonicalMint = await awaitCanonicalMint(connection, mint);
  const initialSource = await getAccount(connection, destination, "finalized", TOKEN_2022_PROGRAM_ID);
  assertCanonicalTokenAccount(initialSource, mint, owner.publicKey);
  assert.equal(initialSource.amount, MAINNET_SUPPLY);
  for (const laneName of ["treasury", "ecosystem", "core", "liquidity"]) {
    const account = await getAccount(
      connection,
      beneficiaryDestinations[laneName],
      "finalized",
      TOKEN_2022_PROGRAM_ID,
    );
    assertCanonicalTokenAccount(account, mint, BENEFICIARY[laneName]);
    assert.equal(account.amount, 0n);
  }

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
    ["core", LANE.core, base.coreToken],
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
  for (const token of [base.treasuryToken, base.ecosystemToken, base.coreToken, base.liquidityToken]) {
    const account = await getAccount(connection, token, "finalized", TOKEN_2022_PROGRAM_ID);
    assertCanonicalTokenAccount(account, mint, base.vaultAuthority);
    assert.equal(account.amount, 0n);
  }

  requireSuccess(record("seed-claim-state", await submit(connection, sponsor, [owner], [
    seedStateInstruction(base, owner.publicKey),
  ])), "seed ACTIVE Config and exact four lanes");

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
    ["core", base.coreToken],
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
  const lockedControlBefore = await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury);
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
    await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury),
    "locked-Law control rejection",
  );
  const lawFirstBefore = await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury);
  const lawFirst = requireFailure(record("law-first-malformed-production", await submit(
    connection,
    sponsor,
    [owner],
    [claimInstruction(base, "treasury", beneficiaryDestinations.treasury, 0, { malformedInstruction: true })],
  )), "Law authentication before malformed production decode", /custom program error: 0xb30d\b/iu);
  assertTokenInvokeCount(lawFirst, 0);
  assertRollback(
    lawFirstBefore,
    await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury),
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

  const controllerAccounts = [base.config, base.lawState];
  const wrongControllerBefore = await rawAccountSnapshot(
    connection,
    controllerAccounts,
    "wrong Config controller",
  );
  requireFailure(record("set-config-wrong-controller-rejected", await submit(
    connection,
    sponsor,
    [wrongController],
    [configActiveInstruction(base, wrongController.publicKey, false)],
  )), "wrong fixture Config controller", /custom program error: 0xe301\b/iu);
  await assertRawAccountsUnchanged(
    connection,
    controllerAccounts,
    wrongControllerBefore,
    "wrong Config controller",
  );

  const inactiveBefore = await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury);
  requireSuccess(record("set-config-inactive", await submit(connection, sponsor, [owner], [
    configActiveInstruction(base, owner.publicKey, false),
  ])), "set synthetic Config inactive");
  const inactiveBaseline = await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury);
  assertExactFixtureConfigLifecycleMutation(
    inactiveBefore,
    inactiveBaseline,
    GENESIS_PHASE_STAGING,
    false,
    "synthetic Config inactive pair",
  );
  const inactiveFailure = requireFailure(record("inactive-config-rejected", await submit(
    connection,
    sponsor,
    [owner],
    [claimInstruction(base, "treasury", beneficiaryDestinations.treasury, 0)],
  )), "inactive Config", /custom program error: 0xe303\b/iu);
  assertTokenInvokeCount(inactiveFailure, 0);
  assertRollback(inactiveBaseline, await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury), "inactive Config");
  requireSuccess(record("restore-config-active", await submit(connection, sponsor, [owner], [
    configActiveInstruction(base, owner.publicKey, true),
  ])), "restore Config ACTIVE");
  const restoredActive = await snapshot(
    connection,
    base,
    "treasury",
    beneficiaryDestinations.treasury,
  );
  assertExactFixtureConfigLifecycleMutation(
    inactiveBaseline,
    restoredActive,
    GENESIS_PHASE_ACTIVE,
    true,
    "synthetic Config ACTIVE pair",
  );
  assertRollback(inactiveBefore, restoredActive, "Config restore baseline");

  const wrongBeneficiaryBefore = await snapshot(
    connection,
    base,
    "treasury",
    beneficiaryDestinations.ecosystem,
  );
  const wrongBeneficiary = requireFailure(record(
    "wrong-beneficiary-rejected",
    await submit(connection, sponsor, [owner], [
      claimInstruction(base, "treasury", beneficiaryDestinations.ecosystem, 0),
    ]),
  ), "wrong beneficiary", /custom program error: 0xe303\b/iu);
  assertTokenInvokeCount(wrongBeneficiary, 0);
  assertRollback(
    wrongBeneficiaryBefore,
    await snapshot(connection, base, "treasury", beneficiaryDestinations.ecosystem),
    "wrong beneficiary",
  );

  const coreBefore = await snapshot(connection, base, "core", beneficiaryDestinations.core);
  const coreFailure = requireFailure(record(
    "core-policy-rejected",
    await submit(connection, sponsor, [owner], [
      claimInstruction(base, "core", beneficiaryDestinations.core, 0),
    ]),
  ), "core custody policy", /custom program error: 0xe303\b/iu);
  assertTokenInvokeCount(coreFailure, 0);
  assertRollback(
    coreBefore,
    await snapshot(connection, base, "core", beneficiaryDestinations.core),
    "core custody policy",
  );

  const graphKeys = claimGraphKeys(base, beneficiaryDestinations);
  for (const [label, overrides, expectedError] of [
    ["wrong-lane-state-rejected", { laneState: base.ecosystem }, /custom program error: 0xe303\b/iu],
    ["wrong-source-pda-rejected", { laneToken: base.ecosystemToken }, /custom program error: 0xe303\b/iu],
    ["wrong-mint-rejected", { mint: destination }, /custom program error: 0xb30b\b/iu],
    ["wrong-hook-program-rejected", { hookProgram: SystemProgram.programId }, /custom program error: 0xe303\b/iu],
    ["wrong-validation-rejected", { validation: destination }, /custom program error: 0xe303\b/iu],
    ["wrong-law-rejected", { lawState: SystemProgram.programId }, /custom program error: 0xb30b\b/iu],
  ]) {
    const before = await rawAccountSnapshot(connection, graphKeys, `${label} graph`);
    const failure = requireFailure(record(label, await submit(
      connection,
      sponsor,
      [owner],
      [claimInstruction(base, "treasury", beneficiaryDestinations.treasury, 0, overrides)],
    )), label, expectedError);
    assertTokenInvokeCount(failure, 0);
    await assertRawAccountsUnchanged(connection, graphKeys, before, `${label} graph`);
  }

  const shadowReboundBefore = await rawAccountSnapshot(
    connection,
    graphKeys,
    "synthetic shadow Law digest mismatch",
  );
  const shadowRebound = requireFailure(record(
    "synthetic-shadow-law-capability-mismatch-rejected",
    await submit(connection, sponsor, [owner], [
      claimInstruction(base, "treasury", beneficiaryDestinations.treasury, 3),
    ]),
  ), "synthetic shadow Law capability digest mismatch", /custom program error: 0xe305\b/iu);
  assertTokenInvokeCount(shadowRebound, 0);
  await assertRawAccountsUnchanged(
    connection,
    graphKeys,
    shadowReboundBefore,
    "synthetic shadow Law digest mismatch",
  );

  const wrongProgramBefore = await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury);
  const wrongProgram = requireFailure(record("wrong-program-identity-rejected", await submit(
    connection, sponsor, [owner], [
      claimInstruction(base, "treasury", beneficiaryDestinations.treasury, 2),
    ],
  )), "wrong production program identity", /custom program error: 0xe303\b/iu);
  assertTokenInvokeCount(wrongProgram, 0);
  assertRollback(wrongProgramBefore, await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury), "wrong program identity");

  for (const laneName of ["treasury", "ecosystem", "liquidity"]) {
    const [controlBefore, controlLawBefore] = await connection.getMultipleAccountsInfo(
      [base.validation, base.lawState],
      "finalized",
    );
    assert(controlBefore && controlLawBefore);
    requireSuccess(record(`set-hook-rejection-${laneName}`, await submit(connection, sponsor, [owner], [
      lawInstruction({
        authority: owner.publicKey,
        mint,
        validation: base.validation,
        lawState: base.lawState,
        opcode: 3,
        mode: 1,
      }),
    ])), `set synthetic hook rejection for ${laneName}`);
    const [controlAfter, controlLawAfter] = await connection.getMultipleAccountsInfo(
      [base.validation, base.lawState],
      "finalized",
    );
    assert(controlAfter && controlLawAfter);
    assertSingleReadOnlyLawMeta(controlAfter, base.lawState);
    assertExactControlMutation(controlBefore, controlAfter, 1, owner.publicKey);
    assertLawUnchanged(controlLawBefore, controlLawAfter, `set hook rejection ${laneName}`);
    const before = await snapshot(connection, base, laneName, beneficiaryDestinations[laneName]);
    const failure = requireFailure(record(`hook-rejection-${laneName}`, await submit(
      connection,
      sponsor,
      [owner],
      [claimInstruction(base, laneName, beneficiaryDestinations[laneName], 0)],
    )), `${laneName} hook rejection`, /custom program error: 0xe415\b/iu);
    assertTokenInvokeCount(failure, 1);
    assertRollback(
      before,
      await snapshot(connection, base, laneName, beneficiaryDestinations[laneName]),
      `${laneName} hook rejection`,
    );
    const [clearBefore, clearLawBefore] = await connection.getMultipleAccountsInfo(
      [base.validation, base.lawState],
      "finalized",
    );
    assert(clearBefore && clearLawBefore);
    requireSuccess(record(`clear-hook-rejection-${laneName}`, await submit(
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
    )), `clear synthetic hook rejection for ${laneName}`);
    const [clearAfter, clearLawAfter] = await connection.getMultipleAccountsInfo(
      [base.validation, base.lawState],
      "finalized",
    );
    assert(clearAfter && clearLawAfter);
    assertSingleReadOnlyLawMeta(clearAfter, base.lawState);
    assertExactControlMutation(clearBefore, clearAfter, 0, owner.publicKey);
    assertLawUnchanged(clearLawBefore, clearLawAfter, `clear hook rejection ${laneName}`);
    assert.deepEqual(
      compactRaw(clearAfter),
      validationBaseline,
      `clear ${laneName} did not restore exact validation baseline`,
    );
  }

  const lateBefore = await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury);
  const lateFailure = requireFailure(record("post-success-wrapper-rollback", await submit(connection, sponsor, [owner], [
    claimInstruction(base, "treasury", beneficiaryDestinations.treasury, 1),
  ])), "failure injected after real executor success", /custom program error: 0xe304\b/iu);
  assertTokenInvokeCount(lateFailure, 1);
  assertRollback(
    lateBefore,
    await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury),
    "post-success wrapper failure",
  );
  for (const [laneName, successLabel] of [
    ["treasury", "claim-success-treasury"],
    ["ecosystem", "claim-success-ecosystem"],
    ["liquidity", "claim-success-liquidity"],
  ]) {
    const before = await snapshot(connection, base, laneName, beneficiaryDestinations[laneName]);
    const success = requireSuccess(record(successLabel, await submit(connection, sponsor, [owner], [
      claimInstruction(base, laneName, beneficiaryDestinations[laneName], 0),
    ])), `exact 12-account production ${laneName} claim`);
    assertTokenInvokeCount(success, 1);
    const after = await snapshot(connection, base, laneName, beneficiaryDestinations[laneName]);
    assertExactClaimDelta(before, after);
  }
  const zeroBefore = await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury);
  const zeroFailure = requireFailure(record("nothing-vested-rejected", await submit(connection, sponsor, [owner], [
    claimInstruction(base, "treasury", beneficiaryDestinations.treasury, 0),
  ])), "nothing vested after full claim", /custom program error: 0xe303\b/iu);
  assertTokenInvokeCount(zeroFailure, 0);
  assertRollback(zeroBefore, await snapshot(connection, base, "treasury", beneficiaryDestinations.treasury), "nothing vested");

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
      syntheticFixtureAdminConfigControl: true,
      syntheticShadowLawCapabilityDigestMismatch: true,
      realStaleLawAccountReboundClaimed: false,
      nonCoreClaimsOnly: true,
      coreCustodyPolicyUnresolved: true,
    },
    fixture: {
      productionCandidate: false,
      economyProgramId: ECONOMY_PROGRAM_ID.toBase58(),
      lawHookProgramId: LAW_HOOK_PROGRAM_ID.toBase58(),
      economyArtifactSha256,
      lawArtifactSha256,
      economySourceSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-claim-lane-principal/economy/src/lib.rs")),
      lawHookSourceSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-claim-lane-principal/law-hook/src/lib.rs")),
      driverSha256: sha256File(import.meta.filename),
      cargoLockSha256: sha256File(repositoryFile("tests/fixtures/iat-b3-claim-lane-principal/Cargo.lock")),
      economyBuildLogSha256: sha256File(economyBuildLog),
      lawBuildLogSha256: sha256File(lawBuildLog),
    },
    productionSource: {
      claimExecutorSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/production_claim_lane_principal_executor.rs")),
      claimPreflightSha256: sha256File(repositoryFile("programs/iat_b3_economy/src/production_claim_lane_principal.rs")),
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
      realProductionClaimLanePrincipalExecutorInvoked: true,
      exactProductionInstructionCodecPassedThrough: true,
      exactTwelveAccountGraphObserved: true,
      allThreeNonCoreLanesClaimed: true,
      coreLaneRejectedWithoutCpiOrWrites: true,
      canonicalToken2022MintAuthenticated: true,
      exactHookLawGraphResolved: true,
      exactlyOneLawMetaInvariantAcrossControlUpdates: true,
      authenticatedLawBytesInvariantAcrossControlUpdates: true,
      executeMetaListBytesInvariantAcrossControlUpdates: true,
      onlyValidationControlOrdinalMutatedAndClearedToBaseline: true,
      hostileControlUpdatesRejectedWithoutAccountMutation: true,
      wrongFixtureConfigControllerRejectedWithoutAccountMutation: true,
      directSignerAndNonsignerHookBypassesRejected: true,
      delegatedFundingRejectedWithExactRollback: true,
      zeroAndNonLaneFundingRejectedWithExactRollback: true,
      positiveOwnerFundingExactDeltasObserved: true,
      lawAuthenticationPrecededMalformedInstructionDecode: true,
      accountGraphHostilesRejectedBeforeCpiWithoutWrites: true,
      syntheticShadowLawCapabilityDigestMismatchRejectedBeforeCpiReloadAndCas: true,
      eachNonCoreHookFailureRejectedCpiBeforeReloadAndCasWithExactRawStateUnchanged: true,
      lateWrapperFailureRolledBackOneCpiAndOneLaneCas: true,
      nothingVestedRejectedBeforeCpiWithoutWrites: true,
      exactOneLaneRawPostimagePerClaimObserved: true,
      exactOneSourceAndDestinationTokenRawPostimagesPerClaimObserved: true,
      exactEconomicConservationObserved: true,
      oneLaneClaimConservationObserved: true,
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
      coreLaneClaimProven: false,
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
