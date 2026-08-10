import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Connection, PublicKey } from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getExtensionData,
  getExtensionTypes,
  getExtraAccountMetaAddress,
  getTransferHook,
  unpackAccount,
  unpackMint,
} from "@solana/spl-token";

export const DEVNET_RPC = "https://api.devnet.solana.com";
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const READ_ONLY_FINALIZE_CONFIRMATION =
  "CONFIRMED_READ_ONLY_DEVNET_FINAL_EVIDENCE";
export const EXPECTED_ARTIFACT_SHA256 =
  "927f22cbb431caf1fe9a1cd3782194c20e292f40d72757e7b7dcdf62e8f0381c";
export const EXPECTED_ARTIFACT_SIZE = 154_952;
export const EXPECTED_DEPLOYMENT_ATTEMPT_HEAD =
  "494e924fde3a8650379dd1af60a8dd9521eb1cc4";
export const EXPECTED_LAW_RESUME_DRIVER_HEAD =
  "6a4c35bc52bdfff168ae179bab43240caedc09ed";
export const EXPECTED_ATTEMPT_EVIDENCE_SHA256 =
  "046dc2e713b9d2e10c45d1e964a7cdcc00084fe8cdcf90fe1e8bf74851b38a11";
export const EXPECTED_ATTEMPT_EVIDENCE_SIZE = 10_453;
export const EXPECTED_ATTEMPT_EVIDENCE_RECORDS = 20;

const SCHEMA = "iat-b3-devnet-rehearsal/v1";
const FINALIZER_SCHEMA = "iat-b3-devnet-final-evidence/v1";
const EXPLORER = "https://explorer.solana.com";
const ENTROPY_LAG_SLOTS = 150n;
const IAT_PROTOCOL_OFFSET_SECONDS = 10_800n;
const DAILY_DECISION_LOCAL_SECOND = 60n;
const SECONDS_PER_DAY = 86_400n;
const DRAW_DENOMINATOR = 10_000n;
const NORMAL_DAY_LOCKDOWN_NUMERATOR = 100n;
const FRIDAY_LOCKDOWN_NUMERATOR = 6_667n;
const SOLANA_DAILY_LAW_ID = Buffer.from("IAT_B3_SOLANA_DAILY_LAW_V1", "ascii");
const LAW_NAMESPACE = Buffer.from("IATB3LAW", "ascii");
const LAW_STATE_MAGIC = Buffer.from("IATB3S01", "ascii");
const LAW_STATE_LEN = 160;
const IAT_TOTAL_BASE_UNITS = 1_000_000_000_000_000_000n;
const EXPECTED_HISTORY_ENTRIES = 169;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map(
  [...BASE58_ALPHABET].map((character, index) => [character, BigInt(index)]),
);
const UPGRADEABLE_LOADER_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);
const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey(
  "ComputeBudget111111111111111111111111111111",
);
const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

export const EXPECTED_PUBLIC_INPUTS = Object.freeze({
  payer: "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4",
  recipient: "CKHwTkJTZgRnKQ2btSsf4JwySEW2DNLWGcGgGF8JTT7b",
  program: "FSh75Nh67AvXravbH4XbW1gMKbZeWNCWHtVcM7MXnzfd",
  mint: "BNciP7GwnAEDtpr1W1n5sGBGcvCbvan5KcvScPe3L1Bz",
  payerHistoryBoundary:
    "GWXV9Wh3q4QiCRaLqipgVURzUhk8mqFkPA6U2BKvFLH99WBxLZfNQ7KZJyTwgqceqPKuYzCcA7Xvobdm6unpAg2",
});

export const EXPECTED_LAW_SIGNATURES = Object.freeze({
  initializeLaw:
    "3uoSVvDecrmjwg3XT7xpoVfLSKMAbTnJZfnrRZvqXzfb6wtdo1unyzpFXAv4Kj3nRHAnHahTwfD1AvgWX3vF7st9",
  missingDecision:
    "pTGYnS2siffpDP4HWTweePBWc3vPbtgoPTurBoPqgkwrJkHe47nv5ZfDdfjQJB54WmJNEJGHeCW5BtJvCuDNRbq",
  directBypass:
    "pAXhdJj6HsTnKmktpuGikztuMsjrX5Q9ZPuer1iThm9TtZpntiiUorpx81qmsnGxg79VA1aJLxyT6pxDW7iQtfS",
  finalizeDay:
    "3MFRs67Y8m6bzUSX8CBGZDbJCQ2LfaftW24UNRYMQoKSaAvgWwarfyLVi7WgNWaLDnQNaHEhjv2m8ewYmYpNVbBm",
  sameDayReroll:
    "62LfhStcxgkMx89q3nkb6zWpkSicyjX41BGMYtMePmG1rPGKTDtRX6n9S9kjqfKkcvGGqPyY7PBcw12b2jHU7HrM",
  selectedDayTransfer:
    "2b9MHcDAYyNwzpnuvR9rAwswX4WjJ7YPk1iUK1qt9ja2eSxvrZjFjV1pn3mLzs75R5fAXkkjvWuv7bR9muBRaM2U",
});

const ARGUMENT_TO_SIGNATURE = Object.freeze({
  "initialize-law-signature": "initializeLaw",
  "missing-decision-signature": "missingDecision",
  "direct-bypass-signature": "directBypass",
  "finalize-day-signature": "finalizeDay",
  "same-day-reroll-signature": "sameDayReroll",
  "selected-day-transfer-signature": "selectedDayTransfer",
});

const LAW_TRANSACTION_SPECS = Object.freeze([
  Object.freeze({
    key: "initializeLaw",
    label: "initialize-law",
    slot: 482_592_803,
    blockTime: 1_786_350_137,
    sequence: 1,
    feeLamports: 5_000,
    computeUnitsConsumed: 29_530,
    expectedCustomError: null,
    shape: "initialize",
  }),
  Object.freeze({
    key: "missingDecision",
    label: "missing-decision-hooked-transfer",
    slot: 482_592_838,
    blockTime: 1_786_350_148,
    sequence: 2,
    feeLamports: 5_000,
    computeUnitsConsumed: 22_418,
    expectedCustomError: 7,
    shape: "transfer",
  }),
  Object.freeze({
    key: "directBypass",
    label: "direct-hook-bypass",
    slot: 482_592_872,
    blockTime: 1_786_350_159,
    sequence: 3,
    feeLamports: 5_000,
    computeUnitsConsumed: 8_644,
    expectedCustomError: 12,
    shape: "direct",
  }),
  Object.freeze({
    key: "finalizeDay",
    label: "finalize-day",
    slot: 482_592_906,
    blockTime: 1_786_350_170,
    sequence: 4,
    feeLamports: 5_000,
    computeUnitsConsumed: 36_674,
    expectedCustomError: null,
    shape: "finalize",
  }),
  Object.freeze({
    key: "sameDayReroll",
    label: "same-day-reroll",
    slot: 482_592_940,
    blockTime: 1_786_350_181,
    sequence: 5,
    feeLamports: 5_000,
    computeUnitsConsumed: 34_866,
    expectedCustomError: 9,
    shape: "finalize",
  }),
  Object.freeze({
    key: "selectedDayTransfer",
    label: "selected-day-hooked-transfer",
    slot: 482_592_974,
    blockTime: 1_786_350_191,
    sequence: 6,
    feeLamports: 5_000,
    computeUnitsConsumed: 52_492,
    expectedCustomError: null,
    shape: "transfer",
  }),
]);

let currentPhase = "argument_gate";

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256(...parts) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest();
}

function decodeBase58(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  let magnitude = 0n;
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) return null;
    magnitude = magnitude * 58n + digit;
  }
  const bytes = [];
  while (magnitude > 0n) {
    bytes.push(Number(magnitude & 0xffn));
    magnitude >>= 8n;
  }
  bytes.reverse();
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return Uint8Array.from([...new Array(leadingZeroes).fill(0), ...bytes]);
}

export function signatureCandidate(value) {
  return typeof value === "string"
    && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/u.test(value)
    && decodeBase58(value)?.length === 64;
}

function parseArgs(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !key.startsWith("--") || value === undefined || parsed.has(key.slice(2))) {
      throw new TypeError("invalid or duplicate command argument");
    }
    parsed.set(key.slice(2), value);
  }
  return parsed;
}

function required(args, key) {
  const value = args.get(key);
  if (!value) throw new TypeError("missing required finalizer argument");
  return value;
}

export function parseReadOnlyInputs(argv) {
  const args = parseArgs(argv);
  assert.equal(args.size, 14, "unexpected read-only finalizer arguments");
  assert.equal(
    required(args, "read-only-finalize"),
    READ_ONLY_FINALIZE_CONFIRMATION,
    "explicit read-only finalization confirmation missing",
  );
  const signatures = {};
  for (const [argument, key] of Object.entries(ARGUMENT_TO_SIGNATURE)) {
    const signature = required(args, argument);
    assert(signatureCandidate(signature), "invalid law transaction signature");
    assert.equal(signature, EXPECTED_LAW_SIGNATURES[key], "law transaction signature mismatch");
    signatures[key] = signature;
  }
  assert.equal(new Set(Object.values(signatures)).size, 6, "law transaction signatures collided");
  const publicInputs = {
    payer: new PublicKey(required(args, "payer-pubkey")),
    recipient: new PublicKey(required(args, "recipient-pubkey")),
    program: new PublicKey(required(args, "program-id")),
    mint: new PublicKey(required(args, "mint")),
    payerHistoryBoundary: required(args, "payer-history-before"),
  };
  for (const key of ["payer", "recipient", "program", "mint"]) {
    assert.equal(
      publicInputs[key].toBase58(),
      EXPECTED_PUBLIC_INPUTS[key],
      "public finalization identity mismatch",
    );
  }
  assert(signatureCandidate(publicInputs.payerHistoryBoundary), "invalid payer history boundary");
  assert.equal(
    publicInputs.payerHistoryBoundary,
    EXPECTED_PUBLIC_INPUTS.payerHistoryBoundary,
    "payer history boundary mismatch",
  );
  return Object.freeze({
    artifact: required(args, "artifact"),
    attemptEvidence: required(args, "attempt-evidence"),
    ...publicInputs,
    signatures: Object.freeze(signatures),
  });
}

function accountExplorerUrl(address) {
  const id = new PublicKey(address).toBase58();
  return EXPLORER + "/address/" + id + "?cluster=devnet";
}

function transactionExplorerUrl(signature) {
  assert(signatureCandidate(signature), "invalid transaction signature");
  return EXPLORER + "/tx/" + signature + "?cluster=devnet";
}

function publicAccount(address) {
  const id = new PublicKey(address).toBase58();
  return Object.freeze({ address: id, explorerUrl: accountExplorerUrl(id) });
}

function assertEvidenceSafe(value) {
  const forbiddenKeys = /^(?:path|cwd|home|config|secret|secretKey|privateKey|keypair|seed|mnemonic)$/iu;
  const visit = (node) => {
    if (typeof node === "string") {
      assert(!/(?<![A-Za-z])[A-Za-z]:[\\/]/u.test(node), "evidence contains a local path");
      assert(!/\/(?:home|Users|mnt|tmp)\//u.test(node), "evidence contains a local path");
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        assert(!forbiddenKeys.test(key), "evidence contains a forbidden field");
        visit(child);
      }
    }
  };
  visit(value);
  return value;
}

function emit(payload) {
  assertEvidenceSafe(payload);
  process.stdout.write(JSON.stringify(payload) + "\n");
}

function sanitizedFailureDetail(error) {
  return String(error?.message ?? "read-only invariant failed")
    .replace(/(?<![A-Za-z])[A-Za-z]:[\\/][^\s"']+/gu, "[redacted-path]")
    .replace(/\/(?:home|Users|mnt|tmp)\/[^\s"']+/gu, "[redacted-path]")
    .replace(/\[(?:\s*\d+\s*,){15,}\s*\d+\s*\]/gu, "[redacted-key-material]")
    .slice(0, 200);
}

function extractSignatures(value) {
  const signatures = new Set();
  const visit = (node, key = "") => {
    if (signatureCandidate(node) && /signature|transactionId|txid|result/iu.test(key)) {
      signatures.add(node);
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, key);
    } else if (node && typeof node === "object") {
      for (const [childKey, child] of Object.entries(node)) visit(child, childKey);
    }
  };
  visit(value);
  return [...signatures];
}

export function inspectAttemptEvidence(bytes) {
  const raw = Buffer.from(bytes);
  assert.equal(raw.length, EXPECTED_ATTEMPT_EVIDENCE_SIZE, "attempt evidence size mismatch");
  assert.equal(
    sha256Bytes(raw),
    EXPECTED_ATTEMPT_EVIDENCE_SHA256,
    "attempt evidence digest mismatch",
  );
  assert(!raw.includes(0x0d), "attempt evidence contains noncanonical CR bytes");
  assert.equal(raw.at(-1), 0x0a, "attempt evidence lacks terminal LF");
  const text = raw.toString("utf8");
  assert.equal(Buffer.from(text, "utf8").length, raw.length, "attempt evidence is not canonical UTF-8");
  const lines = text.slice(0, -1).split("\n");
  assert.equal(lines.length, EXPECTED_ATTEMPT_EVIDENCE_RECORDS, "attempt record count mismatch");
  const records = lines.map((line) => JSON.parse(line));
  assert.equal(records[0]?.status, "READY_FOR_FIRST_PUBLIC_WRITE");
  assert.equal(records[9]?.status, "FAIL");
  assert.equal(
    records[9]?.phase,
    "token_2022_shape_verification_before_law_initialization",
  );
  assert.equal(records[10]?.status, "PARTIAL_PUBLIC_ARTIFACT_LOCATORS");
  assert.equal(records[19]?.status, "FAIL");
  assert.equal(records[19]?.phase, "immutable_program_and_law_rehearsal_driver");
  for (const record of [records[9], records[10]]) {
    const addresses = record.publicAddresses;
    assert.equal(addresses?.payer?.address, EXPECTED_PUBLIC_INPUTS.payer);
    assert.equal(addresses?.recipient?.address, EXPECTED_PUBLIC_INPUTS.recipient);
    assert.equal(addresses?.program?.address, EXPECTED_PUBLIC_INPUTS.program);
    assert.equal(addresses?.mint?.address, EXPECTED_PUBLIC_INPUTS.mint);
  }
  const labels = new Map();
  for (const record of records) {
    if (typeof record.label !== "string") continue;
    for (const signature of extractSignatures(record)) labels.set(signature, record.label);
  }
  return Object.freeze({
    sha256: EXPECTED_ATTEMPT_EVIDENCE_SHA256,
    bytes: EXPECTED_ATTEMPT_EVIDENCE_SIZE,
    records: EXPECTED_ATTEMPT_EVIDENCE_RECORDS,
    recordObjects: Object.freeze(records),
    signatureLabels: labels,
  });
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
    const sample = BigInt("0x" + digest.toString("hex"));
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
    assert.equal(bytes[11], 0);
    assert(bytes.subarray(80, 142).every((byte) => byte === 0));
  }
  if (present === 1) assert(bytes[11] === 0 || bytes[11] === 1, "invalid locked byte");
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
  return Object.freeze({
    bump: bytes[9],
    mint: new PublicKey(bytes.subarray(16, 48)),
    networkGenesisHash: Buffer.from(bytes.subarray(48, 80)),
    decision,
  });
}

async function readWithRetry(operation, attempts = 8) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        const delay = Math.min(5_000, 750 * (2 ** attempt));
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError ?? new Error("read-only RPC operation failed");
}

function programDataAddressFromAccount(programInfo) {
  assert(programInfo && programInfo.executable, "law program is absent or not executable");
  assert(programInfo.owner.equals(UPGRADEABLE_LOADER_ID), "unexpected program loader");
  const bytes = Buffer.from(programInfo.data);
  assert.equal(bytes.length, 36, "upgradeable program account length mismatch");
  assert.equal(bytes.readUInt32LE(0), 2, "upgradeable program discriminator mismatch");
  return new PublicKey(bytes.subarray(4, 36));
}

function verifyFrozenProgramData(programId, programDataAddress, programDataInfo, artifactBytes) {
  assert(programDataInfo && programDataInfo.owner.equals(UPGRADEABLE_LOADER_ID));
  assert(programDataInfo.data.length >= 13, "program-data account is too short");
  assert.equal(programDataInfo.data.readUInt32LE(0), 3, "program-data discriminator mismatch");
  assert.equal(programDataInfo.data[12], 0, "program upgrade authority remains");
  const metadataBytes = 45;
  assert(
    programDataInfo.data.length >= metadataBytes + artifactBytes.length,
    "deployed program data is shorter than the pinned artifact",
  );
  const deployedArtifact = Buffer.from(
    programDataInfo.data.subarray(metadataBytes, metadataBytes + artifactBytes.length),
  );
  assert(deployedArtifact.equals(artifactBytes), "deployed program bytes differ from pinned artifact");
  assert(
    programDataInfo.data.subarray(metadataBytes + artifactBytes.length).every((byte) => byte === 0),
    "deployed program has unexpected nonzero trailing bytes",
  );
  return Object.freeze({
    id: programId.toBase58(),
    programData: programDataAddress.toBase58(),
    executable: true,
    upgradeAuthority: null,
    deployedArtifactSha256: sha256Bytes(deployedArtifact),
    deployedArtifactBytes: deployedArtifact.length,
  });
}

function extensionAuthorityIsNull(data) {
  return Buffer.from(data).subarray(0, 32).every((byte) => byte === 0);
}

function inspectMintShape(mintState, programId) {
  const extensionTypes = getExtensionTypes(mintState.tlvData);
  assert.deepEqual(
    [...extensionTypes].sort((a, b) => a - b),
    [ExtensionType.ConfidentialTransferMint, ExtensionType.TransferHook].sort((a, b) => a - b),
    "Token-2022 mint extension shape is not exact",
  );
  assert.equal(mintState.decimals, 9, "mint decimals mismatch");
  assert.equal(mintState.supply, IAT_TOTAL_BASE_UNITS, "mint supply mismatch");
  assert.equal(mintState.mintAuthority, null, "mint authority remains");
  assert.equal(mintState.freezeAuthority, null, "freeze authority remains");
  const transferHook = getTransferHook(mintState);
  assert(transferHook && transferHook.programId.equals(programId), "transfer-hook program mismatch");
  assert(transferHook.authority.equals(PublicKey.default), "transfer-hook authority remains");
  const confidential = getExtensionData(
    ExtensionType.ConfidentialTransferMint,
    mintState.tlvData,
  );
  assert(confidential, "confidential-transfer mint extension is absent");
  const confidentialBytes = Buffer.from(confidential);
  assert.equal(confidentialBytes.length, 65, "confidential-transfer mint layout length mismatch");
  assert(extensionAuthorityIsNull(confidentialBytes), "confidential-transfer authority remains");
  assert.equal(confidentialBytes[32], 1, "confidential accounts are not auto-approved");
  assert(
    confidentialBytes.subarray(33, 65).every((byte) => byte === 0),
    "confidential-transfer auditor key is not null",
  );
  return Object.freeze({
    autoApproveNewAccounts: true,
    auditorElGamalPubkey: null,
  });
}

function messageAccountKeys(message) {
  const keys = message.staticAccountKeys ?? message.accountKeys;
  assert(Array.isArray(keys), "transaction account keys are unavailable");
  return keys.map((key) => new PublicKey(key));
}

function messageInstructions(message) {
  const instructions = message.compiledInstructions ?? message.instructions;
  assert(Array.isArray(instructions), "compiled instructions are unavailable");
  return instructions;
}

function instructionIndexes(instruction) {
  const indexes = instruction.accountKeyIndexes ?? instruction.accounts;
  assert(indexes !== undefined, "instruction account indexes are unavailable");
  return Array.from(indexes, Number);
}

function instructionData(instruction) {
  if (typeof instruction.data === "string") {
    const decoded = decodeBase58(instruction.data);
    assert(decoded, "instruction data is not canonical base58");
    return Buffer.from(decoded);
  }
  return Buffer.from(instruction.data);
}

function computeLimitData(sequence) {
  const output = Buffer.alloc(5);
  output[0] = 2;
  output.writeUInt32LE(400_000 + sequence, 1);
  return output;
}

function expectedInstruction(spec, addresses, genesisHashBytes) {
  if (spec.shape === "initialize") {
    return Object.freeze({
      programId: addresses.program,
      accounts: [
        addresses.payer,
        addresses.mint,
        addresses.lawState,
        addresses.validation,
        SYSTEM_PROGRAM_ID,
        TOKEN_2022_PROGRAM_ID,
      ],
      data: Buffer.concat([LAW_NAMESPACE, Buffer.from([0]), genesisHashBytes]),
    });
  }
  if (spec.shape === "finalize") {
    return Object.freeze({
      programId: addresses.program,
      accounts: [addresses.mint, addresses.lawState],
      data: Buffer.concat([LAW_NAMESPACE, Buffer.from([1])]),
    });
  }
  if (spec.shape === "direct") {
    return Object.freeze({
      programId: addresses.program,
      accounts: [
        addresses.source,
        addresses.mint,
        addresses.destination,
        addresses.payer,
        addresses.validation,
        addresses.lawState,
      ],
      data: Buffer.from("692565c54bfb661a0100000000000000", "hex"),
    });
  }
  assert.equal(spec.shape, "transfer");
  return Object.freeze({
    programId: TOKEN_2022_PROGRAM_ID,
    accounts: [
      addresses.source,
      addresses.mint,
      addresses.destination,
      addresses.payer,
      addresses.lawState,
      addresses.program,
      addresses.validation,
    ],
    data: Buffer.from("0c010000000000000009", "hex"),
  });
}

function assertExactCustomError(error, expectedCode) {
  assert(error && typeof error === "object", "expected transaction failure is absent");
  const instructionError = error.InstructionError;
  assert(Array.isArray(instructionError) && instructionError.length === 2);
  assert.equal(instructionError[0], 1, "unexpected failing instruction index");
  assert.equal(instructionError[1]?.Custom, expectedCode, "unexpected custom program error");
}

function tokenBalanceAmount(transaction, phase, account, addresses) {
  const balances = transaction.meta?.[phase + "TokenBalances"];
  assert(Array.isArray(balances), "token balance metadata is unavailable");
  const keys = messageAccountKeys(transaction.transaction.message);
  const index = keys.findIndex((key) => key.equals(account));
  assert(index >= 0, "token account is absent from transaction keys");
  const balance = balances.find((candidate) => candidate.accountIndex === index);
  assert(balance, "token balance entry is absent");
  assert.equal(balance.mint, addresses.mint.toBase58());
  assert.equal(balance.uiTokenAmount?.decimals, 9);
  return BigInt(balance.uiTokenAmount.amount);
}

function assertTransferBalances(spec, transaction, addresses) {
  if (spec.key !== "missingDecision" && spec.key !== "selectedDayTransfer") return;
  const preSource = tokenBalanceAmount(transaction, "pre", addresses.source, addresses);
  const preDestination = tokenBalanceAmount(transaction, "pre", addresses.destination, addresses);
  const postSource = tokenBalanceAmount(transaction, "post", addresses.source, addresses);
  const postDestination = tokenBalanceAmount(transaction, "post", addresses.destination, addresses);
  assert.equal(preSource, IAT_TOTAL_BASE_UNITS);
  assert.equal(preDestination, 0n);
  if (spec.key === "missingDecision") {
    assert.equal(postSource, preSource);
    assert.equal(postDestination, preDestination);
  } else {
    assert.equal(postSource, preSource - 1n);
    assert.equal(postDestination, preDestination + 1n);
  }
}

function assertLawTransaction(spec, signature, transaction, addresses, genesisHashBytes) {
  assert(transaction, "finalized law transaction is unavailable");
  assert.equal(transaction.slot, spec.slot, "law transaction slot mismatch");
  assert.equal(transaction.blockTime, spec.blockTime, "law transaction block time mismatch");
  assert(
    transaction.version === undefined || transaction.version === "legacy",
    "law transaction is not legacy",
  );
  const signed = transaction.transaction?.signatures;
  assert(Array.isArray(signed) && signed.length === 1, "unexpected law transaction signatures");
  assert.equal(signed[0], signature, "law transaction signature mismatch");
  const message = transaction.transaction.message;
  assert.equal(message.header?.numRequiredSignatures, 1, "payer is not the sole signer");
  assert.equal(message.header?.numReadonlySignedAccounts, 0, "payer signature is read-only");
  const keys = messageAccountKeys(message);
  assert(keys[0].equals(addresses.payer), "unexpected law transaction fee payer");
  const instructions = messageInstructions(message);
  assert.equal(instructions.length, 2, "law transaction instruction count mismatch");
  const compute = instructions[0];
  assert(keys[compute.programIdIndex].equals(COMPUTE_BUDGET_PROGRAM_ID));
  assert.equal(instructionIndexes(compute).length, 0);
  assert(instructionData(compute).equals(computeLimitData(spec.sequence)));
  const expected = expectedInstruction(spec, addresses, genesisHashBytes);
  const lawInstruction = instructions[1];
  assert(keys[lawInstruction.programIdIndex].equals(expected.programId));
  const actualAccounts = instructionIndexes(lawInstruction).map((index) => keys[index]);
  assert.deepEqual(
    actualAccounts.map((key) => key.toBase58()),
    expected.accounts.map((key) => key.toBase58()),
    "law transaction account ABI mismatch",
  );
  assert(instructionData(lawInstruction).equals(expected.data), "law instruction ABI mismatch");
  assert.equal(transaction.meta?.fee, spec.feeLamports, "law transaction fee mismatch");
  assert.equal(
    Number(transaction.meta?.computeUnitsConsumed),
    spec.computeUnitsConsumed,
    "law transaction compute units mismatch",
  );
  if (spec.expectedCustomError === null) {
    assert.equal(transaction.meta?.err, null, spec.label + " unexpectedly failed");
  } else {
    assertExactCustomError(transaction.meta?.err, spec.expectedCustomError);
  }
  assertTransferBalances(spec, transaction, addresses);
  return Object.freeze({
    label: spec.label,
    signature,
    slot: spec.slot,
    blockTime: spec.blockTime,
    feeLamports: spec.feeLamports,
    computeUnitsConsumed: spec.computeUnitsConsumed,
    succeeded: spec.expectedCustomError === null,
    expectedCustomError: spec.expectedCustomError,
    instructionAbiMatched: true,
    explorerUrl: transactionExplorerUrl(signature),
  });
}

export function buildSignatureOnlyHistory(entries, metrics, attemptSignatureLabels) {
  const metricsBySignature = new Map(metrics.map((metric) => [metric.signature, metric]));
  const seen = new Map();
  const history = entries.map((entry) => {
    assert(signatureCandidate(entry.signature), "payer history contains an invalid signature");
    assert(Number.isSafeInteger(entry.slot) && entry.slot > 0, "payer history slot is invalid");
    assert(
      entry.confirmationStatus === undefined || entry.confirmationStatus === "finalized",
      "payer history contains a non-finalized transaction",
    );
    seen.set(entry.signature, (seen.get(entry.signature) ?? 0) + 1);
    const metric = metricsBySignature.get(entry.signature) ?? null;
    if (metric) assert.equal(entry.err === null, metric.succeeded);
    return Object.freeze({
      label: metric?.label
        ?? attemptSignatureLabels.get(entry.signature)
        ?? "payer-history-unlabeled",
      signature: entry.signature,
      slot: entry.slot,
      feeLamports: metric?.feeLamports ?? null,
      computeUnitsConsumed: metric?.computeUnitsConsumed ?? null,
      succeeded: entry.err === null,
      rpcMetadataExposed: metric !== null,
      explorerUrl: transactionExplorerUrl(entry.signature),
    });
  });
  for (const signature of Object.values(EXPECTED_LAW_SIGNATURES)) {
    assert.equal(seen.get(signature), 1, "known law transaction is absent or duplicated in payer history");
  }
  assert.equal(seen.size, entries.length, "payer history contains duplicate signatures");
  return Object.freeze(history);
}

export function closeBoundedHistoryRange(entries, selectedMetric) {
  assert.equal(
    entries.length,
    EXPECTED_HISTORY_ENTRIES - 1,
    "bounded payer history entry count mismatch",
  );
  assert(
    !entries.some((entry) => entry.signature === selectedMetric.signature),
    "bounded payer history unexpectedly includes its upper boundary",
  );
  assert(
    entries.every((entry) => entry.slot <= selectedMetric.slot),
    "bounded payer history contains a transaction newer than its upper boundary",
  );
  return Object.freeze([
    Object.freeze({
      signature: selectedMetric.signature,
      slot: selectedMetric.slot,
      err: selectedMetric.succeeded
        ? null
        : { InstructionError: [1, { Custom: selectedMetric.expectedCustomError }] },
      memo: null,
      blockTime: selectedMetric.blockTime,
      confirmationStatus: "finalized",
    }),
    ...entries,
  ]);
}

export function summarizePayerTransactionHistory(
  history,
  upperBoundaryExclusive,
  lowerBoundaryExclusive,
) {
  assert.equal(history.length, EXPECTED_HISTORY_ENTRIES, "validated payer history count mismatch");
  assert(signatureCandidate(upperBoundaryExclusive));
  assert(signatureCandidate(lowerBoundaryExclusive));
  assert.equal(
    history[0]?.signature,
    upperBoundaryExclusive,
    "pinned upper boundary was not reintroduced as the newest validated entry",
  );
  assert(
    !history.some((entry) => entry.signature === lowerBoundaryExclusive),
    "exclusive lower boundary appears in validated payer history",
  );
  const orderedSignatures = history.map((entry) => entry.signature);
  assert(
    orderedSignatures.every((signature) => signatureCandidate(signature)),
    "validated payer history contains a noncanonical signature",
  );
  assert.equal(
    new Set(orderedSignatures).size,
    orderedSignatures.length,
    "validated payer history contains duplicate signatures",
  );
  assert(
    Object.values(EXPECTED_LAW_SIGNATURES).every((signature) =>
      orderedSignatures.includes(signature)),
    "validated payer history is missing a pinned law transaction",
  );
  const succeededCount = history.filter((entry) => entry.succeeded).length;
  return Object.freeze({
    count: history.length,
    newestSignature: orderedSignatures[0],
    oldestSignature: orderedSignatures.at(-1),
    succeededCount,
    failedCount: history.length - succeededCount,
    signaturesSha256: sha256Bytes(Buffer.from(orderedSignatures.join("\n") + "\n", "ascii")),
    signaturesHashEncoding: "ORDERED_NEWEST_TO_OLDEST_LF_TERMINATED_ASCII",
    allSixPinnedLawTransactionsPresent: true,
    upperBoundaryExclusive,
    upperBoundaryReintroducedAsPinnedNewestEntry: true,
    lowerBoundaryExclusive,
  });
}

async function run(argv) {
  const inputs = parseReadOnlyInputs(argv);
  currentPhase = "local_source_binding";
  const artifactBytes = readFileSync(inputs.artifact);
  assert.equal(artifactBytes.length, EXPECTED_ARTIFACT_SIZE, "optimized artifact size is not pinned");
  assert.equal(sha256Bytes(artifactBytes), EXPECTED_ARTIFACT_SHA256, "optimized artifact digest is not pinned");
  const attempt = inspectAttemptEvidence(readFileSync(inputs.attemptEvidence));
  const finalizerSourceSha256 = sha256Bytes(readFileSync(fileURLToPath(import.meta.url)));

  const addresses = {
    payer: inputs.payer,
    recipient: inputs.recipient,
    program: inputs.program,
    mint: inputs.mint,
  };
  addresses.source = getAssociatedTokenAddressSync(
    addresses.mint,
    addresses.payer,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  addresses.destination = getAssociatedTokenAddressSync(
    addresses.mint,
    addresses.recipient,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const [lawState, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("law-state", "ascii"), addresses.mint.toBuffer()],
    addresses.program,
  );
  addresses.lawState = lawState;
  addresses.validation = getExtraAccountMetaAddress(addresses.mint, addresses.program);

  currentPhase = "canonical_devnet_identity";
  const connection = new Connection(DEVNET_RPC, "finalized");
  const genesisHash = await readWithRetry(() => connection.getGenesisHash());
  assert.equal(genesisHash, DEVNET_GENESIS_HASH, "RPC did not identify as canonical Devnet");
  const genesisHashBytes = new PublicKey(genesisHash).toBuffer();

  currentPhase = "final_program_and_account_state";
  const programInfo = await readWithRetry(() =>
    connection.getAccountInfo(addresses.program, "finalized"));
  const programDataAddress = programDataAddressFromAccount(programInfo);
  const accountInfos = await readWithRetry(async () => {
    const infos = await connection.getMultipleAccountsInfo(
      [
        programDataAddress,
        addresses.mint,
        addresses.source,
        addresses.destination,
        addresses.lawState,
        addresses.validation,
      ],
      "finalized",
    );
    if (infos.some((info) => info === null)) throw new Error("required finalized account is absent");
    return infos;
  });
  const [programDataInfo, mintInfo, sourceInfo, destinationInfo, lawInfo, validationInfo] = accountInfos;
  const program = verifyFrozenProgramData(
    addresses.program,
    programDataAddress,
    programDataInfo,
    artifactBytes,
  );
  const mintState = unpackMint(addresses.mint, mintInfo, TOKEN_2022_PROGRAM_ID);
  const mintShape = inspectMintShape(mintState, addresses.program);
  const sourceState = unpackAccount(addresses.source, sourceInfo, TOKEN_2022_PROGRAM_ID);
  const destinationState = unpackAccount(
    addresses.destination,
    destinationInfo,
    TOKEN_2022_PROGRAM_ID,
  );
  assert(sourceState.mint.equals(addresses.mint));
  assert(destinationState.mint.equals(addresses.mint));
  assert(sourceState.owner.equals(addresses.payer));
  assert(destinationState.owner.equals(addresses.recipient));
  assert.equal(sourceState.amount, IAT_TOTAL_BASE_UNITS - 1n);
  assert.equal(destinationState.amount, 1n);
  assert.equal(sourceState.isFrozen, false);
  assert.equal(destinationState.isFrozen, false);
  assert.equal(sourceState.delegate, null);
  assert.equal(destinationState.delegate, null);
  assert.equal(sourceState.closeAuthority, null);
  assert.equal(destinationState.closeAuthority, null);
  assert(lawInfo.owner.equals(addresses.program), "law state owner mismatch");
  assert(validationInfo.owner.equals(addresses.program), "validation state owner mismatch");
  assert(validationInfo.data.length > 0, "validation state is empty");
  const law = parseLawState(lawInfo.data);
  assert.equal(law.bump, bump);
  assert(law.mint.equals(addresses.mint));
  assert(law.networkGenesisHash.equals(genesisHashBytes));
  assert(law.decision, "finalized law decision is absent");
  const decision = law.decision;
  assert.equal(decision.localDay, 20_675n);
  assert.equal(decision.entropySlot, 482_592_756n);
  assert.equal(decision.drawCounter, 0n);
  assert.equal(decision.drawBucket, 5_279n);
  assert.equal(decision.chanceNumerator, 100n);
  assert.equal(decision.chanceDenominator, 10_000n);
  assert.equal(decision.locked, false);
  const recomputed = deriveSolanaDraw({
    ancestorSlotHash: decision.ancestorSlotHash,
    localDay: decision.localDay,
    entropySlot: decision.entropySlot,
    networkGenesisHash: law.networkGenesisHash,
    mint: addresses.mint,
  });
  assert.equal(decision.drawCounter, recomputed.drawCounter);
  assert.equal(decision.drawBucket, recomputed.drawBucket);
  assert.equal(decision.chanceNumerator, recomputed.chanceNumerator);
  assert.equal(decision.chanceDenominator, recomputed.chanceDenominator);
  assert.equal(decision.locked, recomputed.locked);

  currentPhase = "known_law_transaction_verification";
  const signatures = LAW_TRANSACTION_SPECS.map((spec) => inputs.signatures[spec.key]);
  const lawTransactions = [];
  for (const signature of signatures) {
    const transaction = await readWithRetry(async () => {
      const landed = await connection.getTransaction(signature, {
        commitment: "finalized",
        maxSupportedTransactionVersion: 0,
      });
      if (landed === null) throw new Error("known finalized law transaction is unavailable");
      return landed;
    });
    lawTransactions.push(transaction);
    if (lawTransactions.length < signatures.length) {
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  const metrics = LAW_TRANSACTION_SPECS.map((spec, index) =>
    assertLawTransaction(spec, signatures[index], lawTransactions[index], addresses, genesisHashBytes));
  for (let index = 1; index < metrics.length; index += 1) {
    assert(metrics[index - 1].slot < metrics[index].slot, "law transaction order mismatch");
  }
  const finalizeMetric = metrics[3];
  assert.equal(
    decision.entropySlot,
    BigInt(finalizeMetric.slot) - ENTROPY_LAG_SLOTS,
    "lagged entropy slot mismatch",
  );
  assert.equal(
    decision.localDay,
    protocolLocalDay(BigInt(finalizeMetric.blockTime)),
    "finalize transaction local day mismatch",
  );

  currentPhase = "payer_history_boundary_verification";
  const boundaryTransaction = await readWithRetry(() =>
    connection.getTransaction(inputs.payerHistoryBoundary, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    }));
  assert(boundaryTransaction, "payer history boundary transaction is unavailable");
  assert.equal(boundaryTransaction.meta?.err, null, "payer history boundary failed");
  assert(
    boundaryTransaction.transaction.signatures.includes(inputs.payerHistoryBoundary),
    "payer history boundary signature mismatch",
  );
  assert(
    messageAccountKeys(boundaryTransaction.transaction.message)[0].equals(addresses.payer),
    "payer history boundary fee payer mismatch",
  );
  assert(boundaryTransaction.slot < metrics[0].slot, "payer history boundary is not before law execution");

  currentPhase = "complete_payer_transaction_history_collection";
  const boundedEntries = await readWithRetry(() => connection.getSignaturesForAddress(
    addresses.payer,
    {
      before: inputs.signatures.selectedDayTransfer,
      until: inputs.payerHistoryBoundary,
      limit: 1_000,
    },
    "finalized",
  ));
  const entries = closeBoundedHistoryRange(boundedEntries, metrics[5]);
  assert.equal(entries.length, EXPECTED_HISTORY_ENTRIES);
  assert.equal(entries[0].signature, inputs.signatures.selectedDayTransfer);
  assert(!entries.some((entry) => entry.signature === inputs.payerHistoryBoundary));
  const payerTransactionHistory = buildSignatureOnlyHistory(
    entries,
    metrics,
    attempt.signatureLabels,
  );
  const payerTransactionHistorySummary = summarizePayerTransactionHistory(
    payerTransactionHistory,
    inputs.signatures.selectedDayTransfer,
    inputs.payerHistoryBoundary,
  );

  currentPhase = "final_observation_binding";
  const observedFinalizedSlot = await readWithRetry(() => connection.getSlot("finalized"));
  assert(Number.isSafeInteger(observedFinalizedSlot));
  assert(observedFinalizedSlot >= metrics.at(-1).slot);
  const observedAtUtc = new Date().toISOString();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(observedAtUtc));
  assert.equal(new Date(observedAtUtc).toISOString(), observedAtUtc);

  currentPhase = "sanitized_read_only_evidence_emission";
  const publicAddresses = {
    payer: publicAccount(addresses.payer),
    recipient: publicAccount(addresses.recipient),
    program: publicAccount(addresses.program),
    programData: publicAccount(programDataAddress),
    mint: publicAccount(addresses.mint),
    sourceTokenAccount: publicAccount(addresses.source),
    destinationTokenAccount: publicAccount(addresses.destination),
    lawState: publicAccount(addresses.lawState),
    extraAccountMetaList: publicAccount(addresses.validation),
    token2022Program: publicAccount(TOKEN_2022_PROGRAM_ID),
  };
  emit({
    schema: SCHEMA,
    finalizerSchema: FINALIZER_SCHEMA,
    status: "PASS",
    evidenceMode: "READ_ONLY_FINALIZATION",
    publicNetworkWrites: false,
    network: "solana-devnet",
    rpc: DEVNET_RPC,
    genesisHash,
    observedAtUtc,
    observedFinalizedSlot,
    fundingMode: "REUSED_V2_DEVNET_PAYER",
    payerHistoryBoundary: inputs.payerHistoryBoundary,
    sourceBinding: {
      deploymentAttemptHead: EXPECTED_DEPLOYMENT_ATTEMPT_HEAD,
      lawResumeDriverHead: EXPECTED_LAW_RESUME_DRIVER_HEAD,
      finalizerSourceSha256,
      attemptEvidenceSha256: attempt.sha256,
      attemptEvidenceBytes: attempt.bytes,
      attemptEvidenceRecords: attempt.records,
    },
    executionReconciliation: {
      writeAttemptRecordedStatus: attempt.recordObjects[19].status,
      writeAttemptRecordedPhase: attempt.recordObjects[19].phase,
      writeDriverRecordedFailurePhase: attempt.recordObjects[9].phase,
      writeDriverRecordedFailureWasBeforeLawInitialization: true,
      laterPublicLawTransactionsVerifiedIndividually: true,
      finalEvidenceClosedByReadOnlyFinalizer: true,
    },
    artifact: {
      sha256: EXPECTED_ARTIFACT_SHA256,
      bytes: EXPECTED_ARTIFACT_SIZE,
      deployedSha256: program.deployedArtifactSha256,
      deployedBytes: program.deployedArtifactBytes,
    },
    publicAddresses,
    authorities: {
      programUpgrade: null,
      mint: null,
      freeze: null,
      transferHookAuthority: null,
      confidentialTransferMint: null,
    },
    mintShape: {
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
      decimals: mintState.decimals,
      supplyBaseUnits: mintState.supply.toString(),
      extensions: ["ConfidentialTransferMint", "TransferHook"],
      transferHookProgram: addresses.program.toBase58(),
      autoApproveNewConfidentialAccounts: mintShape.autoApproveNewAccounts,
      confidentialTransferAuditorElGamalPubkey: mintShape.auditorElGamalPubkey,
    },
    terminalTokenState: {
      sourceAmountBaseUnits: sourceState.amount.toString(),
      destinationAmountBaseUnits: destinationState.amount.toString(),
      selectedTransferDeltaBaseUnits: "1",
    },
    finality: "finalized",
    decision: {
      localDay: decision.localDay.toString(),
      entropySlot: decision.entropySlot.toString(),
      finalizeSlot: finalizeMetric.slot,
      drawCounter: decision.drawCounter.toString(),
      drawBucket: decision.drawBucket.toString(),
      chanceNumerator: decision.chanceNumerator.toString(),
      chanceDenominator: decision.chanceDenominator.toString(),
      locked: decision.locked,
      recomputed: true,
      storedDecisionRecomputed: true,
      historicalSlotHashesValueUnavailableAfterRollingRetention: true,
    },
    failClosed: {
      missingDecisionCustomError: 7,
      sameDayRerollCustomError: 9,
      directBypassCustomError: 12,
      selectedLockedDayCustomError: null,
    },
    transactions: metrics,
    payerHistoryMetadataMode: "SIGNATURE_ONLY_EXCEPT_SIX_PINNED_LAW_TRANSACTIONS",
    payerTransactionHistory: payerTransactionHistorySummary,
    dailyLawOnlyDevnetRehearsalComplete: true,
    fullFeatureDevnetRehearsalComplete: false,
    activationReady: false,
    mainnetExecutionAuthorized: false,
    fullFeature: false,
    activation: false,
    mainnetStatus: "HOLD",
    limits: {
      proves: "immutable native Daily-Law adapter on public Solana Devnet",
      doesNotProve: [
        "retained V2 feature parity",
        "full-feature B3 Devnet",
        "privacy vault",
        "Mainnet readiness",
      ],
    },
  });
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === "--offline-import-preflight") {
    emit({
      schema: SCHEMA,
      finalizerSchema: FINALIZER_SCHEMA,
      status: "PREFLIGHT_PASS",
      network: "solana-devnet",
      rpc: DEVNET_RPC,
      publicNetworkWrites: false,
      dailyLawOnlyDevnetRehearsalComplete: false,
      fullFeatureDevnetRehearsalComplete: false,
      activationReady: false,
      mainnetExecutionAuthorized: false,
      fullFeature: false,
      activation: false,
      mainnetStatus: "HOLD",
    });
    return;
  }
  try {
    await run(process.argv.slice(2));
  } catch (error) {
    emit({
      schema: SCHEMA,
      finalizerSchema: FINALIZER_SCHEMA,
      status: "FAIL",
      evidenceMode: "READ_ONLY_FINALIZATION",
      publicNetworkWrites: false,
      priorPublicArtifactsMayRemain: true,
      network: "solana-devnet",
      rpc: DEVNET_RPC,
      phase: currentPhase,
      failure: "read_only_invariant_or_rpc_operation_failed",
      errorType: String(error?.name ?? "Error").replace(/[^A-Za-z]/gu, "").slice(0, 32),
      failureDetail: sanitizedFailureDetail(error),
      dailyLawOnlyDevnetRehearsalComplete: false,
      fullFeatureDevnetRehearsalComplete: false,
      activationReady: false,
      mainnetExecutionAuthorized: false,
      fullFeature: false,
      activation: false,
      mainnetStatus: "HOLD",
    });
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) await main();
