import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import {
  TOKEN_2022_PROGRAM_ID,
  unpackAccount,
  unpackMint,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export const IAT_B3_PRODUCTION_LOOPBACK_ADAPTER_KIND = "SOURCE_BOUND_LOOPBACK";
export const IAT_B3_PRODUCTION_LOOPBACK_TEST_ADAPTER_KIND = "TEST_INJECTED_LOOPBACK";
export const IAT_B3_PRODUCTION_LOOPBACK_COMMITMENT = "confirmed";

const OFFICIAL_LOOPBACK_ADAPTERS = new WeakSet();

const UPGRADEABLE_LOADER_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));
const ALLOWED_RPC_METHODS = new Set([
  "getGenesisHash",
  "getAccountInfo",
  "getMultipleAccounts",
  "getLatestBlockhash",
  "sendTransaction",
  "getSignatureStatuses",
  "getTransaction",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fail(code) {
  throw new TypeError(`IAT_B3_PRODUCTION_LOOPBACK_${code}_HOLD`);
}

function exactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(`${code}_SHAPE`);
  }
}

function publicKey(value, code = "PUBLIC_KEY") {
  try {
    const key = new PublicKey(value);
    if (typeof value === "string" && key.toBase58() !== value) fail(code);
    return key;
  } catch {
    fail(code);
  }
}

function canonicalBase64(value, code = "BASE64") {
  if (typeof value !== "string") fail(code);
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) fail(code);
  return bytes;
}

function safeRpcInteger(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
}

function rpcUnsignedString(value, code) {
  if (Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^(?:0|[1-9][0-9]*)$/u.test(value)) return value;
  fail(code);
}

function parseLosslessRpcJson(text) {
  if (typeof text !== "string" || text.length === 0 || text.length > 64 * 1024 * 1024) {
    fail("RPC_JSON_BYTES");
  }
  assertNoDuplicateJsonMembers(text);
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length;) {
    const character = text[index];
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
      index += 1;
      continue;
    }
    if (character === "\"") {
      inString = true;
      output += character;
      index += 1;
      continue;
    }
    const match = text.slice(index).match(/^-?(?:0|[1-9][0-9]*)(?![.eE0-9])/u);
    if (match) {
      const token = match[0];
      const value = BigInt(token);
      output += value > BigInt(Number.MAX_SAFE_INTEGER)
        || value < BigInt(Number.MIN_SAFE_INTEGER) ? JSON.stringify(token) : token;
      index += token.length;
      continue;
    }
    output += character;
    index += 1;
  }
  if (inString || escaped) fail("RPC_JSON_BYTES");
  try {
    return JSON.parse(output);
  } catch {
    fail("RPC_JSON_BYTES");
  }
}

function assertNoDuplicateJsonMembers(text) {
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const syntax = () => fail("RPC_JSON_BYTES");
  const parseStringToken = () => {
    if (text[index] !== "\"") syntax();
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\"") {
        index += 1;
        try {
          return JSON.parse(text.slice(start, index));
        } catch {
          syntax();
        }
      }
      if (character === "\\") index += 2;
      else {
        if (character < " ") syntax();
        index += 1;
      }
    }
    syntax();
  };
  const parseValue = () => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") { index += 1; return; }
      while (index < text.length) {
        skipWhitespace();
        const key = parseStringToken();
        if (keys.has(key)) fail("RPC_JSON_DUPLICATE_MEMBER");
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") syntax();
        index += 1;
        parseValue();
        skipWhitespace();
        if (text[index] === "}") { index += 1; return; }
        if (text[index] !== ",") syntax();
        index += 1;
      }
      syntax();
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") { index += 1; return; }
      while (index < text.length) {
        parseValue();
        skipWhitespace();
        if (text[index] === "]") { index += 1; return; }
        if (text[index] !== ",") syntax();
        index += 1;
      }
      syntax();
    }
    if (text[index] === "\"") { parseStringToken(); return; }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) syntax();
    try {
      JSON.parse(text.slice(start, index));
    } catch {
      syntax();
    }
  };
  skipWhitespace();
  parseValue();
  skipWhitespace();
  if (index !== text.length) syntax();
}

function boolByte(bytes, offset, code) {
  if (bytes[offset] === 0) return false;
  if (bytes[offset] === 1) return true;
  fail(code);
}

function zeroRange(bytes, start, end, code) {
  if (bytes.subarray(start, end).some((byte) => byte !== 0)) fail(code);
}

function keyAt(bytes, offset) {
  return new PublicKey(bytes.subarray(offset, offset + 32)).toBase58();
}

function u64At(bytes, offset) {
  return bytes.readBigUInt64LE(offset).toString();
}

function i64At(bytes, offset) {
  return bytes.readBigInt64LE(offset).toString();
}

function requireEnvelope(bytes, { length, magic, reserved = [] }) {
  if (bytes.length !== length || bytes.subarray(0, 8).toString("ascii") !== magic
    || bytes[8] !== 1) {
    fail(`CODEC_${magic}`);
  }
  for (const [start, end] of reserved) zeroRange(bytes, start, end, `CODEC_${magic}_RESERVED`);
}

function decodeLawState(bytes) {
  requireEnvelope(bytes, {
    length: 160,
    magic: "IATB3S01",
    reserved: [[12, 16], [142, 160]],
  });
  const decisionTag = bytes[10];
  let decision = null;
  if (decisionTag === 0) {
    if (bytes[11] !== 0) fail("CODEC_LAW_DECISION");
    zeroRange(bytes, 80, 142, "CODEC_LAW_DECISION");
  } else if (decisionTag === 1) {
    decision = {
      locked: boolByte(bytes, 11, "CODEC_LAW_LOCKED"),
      localDay: i64At(bytes, 80),
      entropySlot: u64At(bytes, 88),
      ancestorSlotHash: bytes.subarray(96, 128).toString("hex"),
      drawCounter: u64At(bytes, 128),
      drawBucket: bytes.readUInt16LE(136),
      chanceNumerator: bytes.readUInt16LE(138),
      chanceDenominator: bytes.readUInt16LE(140),
    };
  } else {
    fail("CODEC_LAW_DECISION");
  }
  return {
    codec: "LAW_STATE_V1",
    bump: bytes[9],
    mint: keyAt(bytes, 16),
    compiledLawDomainGenesisHash: new PublicKey(bytes.subarray(48, 80)).toBase58(),
    decision,
  };
}

function decodeConfig(bytes) {
  requireEnvelope(bytes, {
    length: 272,
    magic: "IATB3CFG",
    reserved: [[10, 32], [258, 272]],
  });
  const phase = bytes[9];
  if (![0, 1, 2].includes(phase)) fail("CODEC_CONFIG_PHASE");
  const rehearsalMode = boolByte(bytes, 252, "CODEC_CONFIG_REHEARSAL");
  const active = boolByte(bytes, 253, "CODEC_CONFIG_ACTIVE");
  const laneMask = bytes[254];
  if ((laneMask & ~0b1_1110) !== 0 || active !== (phase === 2)) fail("CODEC_CONFIG_CANONICAL");
  return {
    codec: "ECONOMY_CONFIG_V1",
    phase,
    admin: keyAt(bytes, 32),
    mint: keyAt(bytes, 64),
    tokenProgram: keyAt(bytes, 96),
    randomnessProgram: keyAt(bytes, 128),
    stakeTokenAccount: keyAt(bytes, 160),
    agencyRegistryHash: bytes.subarray(192, 224).toString("hex"),
    genesisTimestamp: i64At(bytes, 224),
    expectedSupply: u64At(bytes, 232),
    stakedPrincipal: u64At(bytes, 240),
    agencyCount: bytes.readUInt32LE(248),
    rehearsalMode,
    active,
    laneMask,
    stakeVaultInitialized: boolByte(bytes, 255, "CODEC_CONFIG_STAKE_VAULT"),
    bump: bytes[256],
    vaultAuthorityBump: bytes[257],
  };
}

function decodePosition(bytes) {
  requireEnvelope(bytes, { length: 176, magic: "IATB3POS", reserved: [[9, 16]] });
  const role = bytes[172];
  if (role > 2) fail("CODEC_POSITION_ROLE");
  return {
    codec: "ECONOMY_POSITION_V1",
    config: keyAt(bytes, 16),
    owner: keyAt(bytes, 48),
    positionId: u64At(bytes, 80),
    principal: u64At(bytes, 88),
    acceptedWeek: u64At(bytes, 96),
    firstAccrualWeek: u64At(bytes, 104),
    termWeeks: u64At(bytes, 112),
    annualRateBps: u64At(bytes, 120),
    treasuryReserved: u64At(bytes, 128),
    ecosystemReserved: u64At(bytes, 136),
    liquidityReserved: u64At(bytes, 144),
    paid: u64At(bytes, 152),
    settledMask: u64At(bytes, 160),
    agencyIndex: bytes.readUInt32LE(168),
    role,
    principalReturned: boolByte(bytes, 173, "CODEC_POSITION_PRINCIPAL_RETURNED"),
    closed: boolByte(bytes, 174, "CODEC_POSITION_CLOSED"),
    bump: bytes[175],
  };
}

function decodeLane(bytes) {
  requireEnvelope(bytes, {
    length: 176,
    magic: "IATB3LAN",
    reserved: [[9, 16], [172, 176]],
  });
  const lane = bytes[168];
  if (![1, 2, 3, 4].includes(lane)) fail("CODEC_LANE_DISCRIMINANT");
  return {
    codec: "ECONOMY_LANE_V1",
    config: keyAt(bytes, 16),
    tokenAccount: keyAt(bytes, 48),
    beneficiary: keyAt(bytes, 80),
    total: u64At(bytes, 112),
    genesisUnlocked: u64At(bytes, 120),
    cliffWeek: u64At(bytes, 128),
    linearEndWeek: u64At(bytes, 136),
    reserved: u64At(bytes, 144),
    paid: u64At(bytes, 152),
    principalClaimed: u64At(bytes, 160),
    lane,
    rewardSource: boolByte(bytes, 169, "CODEC_LANE_REWARD_SOURCE"),
    bump: bytes[170],
    tokenBump: bytes[171],
  };
}

function decodeEligibility(bytes) {
  requireEnvelope(bytes, {
    length: 96,
    magic: "IATB3ELG",
    reserved: [[9, 16], [86, 96]],
  });
  const role = bytes[84];
  if (role > 2) fail("CODEC_ELIGIBILITY_ROLE");
  return {
    codec: "ECONOMY_ELIGIBILITY_V1",
    config: keyAt(bytes, 16),
    wallet: keyAt(bytes, 48),
    agencyIndex: bytes.readUInt32LE(80),
    role,
    bump: bytes[85],
  };
}

function tokenAccountInfo(owner, bytes) {
  return {
    data: bytes,
    executable: false,
    lamports: 0,
    owner: publicKey(owner),
    rentEpoch: 0,
  };
}

function decodeTokenMint(pubkeyValue, owner, bytes) {
  const value = unpackMint(
    publicKey(pubkeyValue),
    tokenAccountInfo(owner, bytes),
    TOKEN_2022_PROGRAM_ID,
  );
  return {
    codec: "TOKEN_2022_MINT",
    mintAuthority: value.mintAuthority?.toBase58() ?? null,
    supply: value.supply.toString(),
    decimals: value.decimals,
    isInitialized: value.isInitialized,
    freezeAuthority: value.freezeAuthority?.toBase58() ?? null,
    tlvDataSha256: sha256(value.tlvData),
    tlvDataLength: value.tlvData.length,
  };
}

function decodeTokenAccount(pubkeyValue, owner, bytes) {
  const value = unpackAccount(
    publicKey(pubkeyValue),
    tokenAccountInfo(owner, bytes),
    TOKEN_2022_PROGRAM_ID,
  );
  return {
    codec: "TOKEN_2022_ACCOUNT",
    mint: value.mint.toBase58(),
    owner: value.owner.toBase58(),
    amount: value.amount.toString(),
    delegate: value.delegate?.toBase58() ?? null,
    delegatedAmount: value.delegatedAmount.toString(),
    isInitialized: value.isInitialized,
    isFrozen: value.isFrozen,
    isNative: value.isNative,
    rentExemptReserve: value.rentExemptReserve?.toString() ?? null,
    closeAuthority: value.closeAuthority?.toBase58() ?? null,
    tlvDataSha256: sha256(value.tlvData),
    tlvDataLength: value.tlvData.length,
  };
}

export function decodeIatB3ProductionFixtureState({
  codec,
  pubkey: pubkeyValue,
  owner,
  dataBase64,
}) {
  const bytes = canonicalBase64(dataBase64, "FIXTURE_BASE64");
  publicKey(pubkeyValue, "FIXTURE_PUBLIC_KEY");
  publicKey(owner, "FIXTURE_OWNER");
  if (owner === TOKEN_2022_PROGRAM_ID.toBase58()
    && !["TOKEN_2022_MINT", "TOKEN_2022_ACCOUNT"].includes(codec)) {
    fail("TOKEN_2022_CODEC_REQUIRED");
  }
  switch (codec) {
    case "LAW_STATE_V1":
      return decodeLawState(bytes);
    case "ECONOMY_CONFIG_V1":
      return decodeConfig(bytes);
    case "ECONOMY_POSITION_V1":
      return decodePosition(bytes);
    case "ECONOMY_LANE_V1":
      return decodeLane(bytes);
    case "ECONOMY_ELIGIBILITY_V1":
      return decodeEligibility(bytes);
    case "TOKEN_2022_MINT":
      if (owner !== TOKEN_2022_PROGRAM_ID.toBase58()) fail("TOKEN_MINT_OWNER");
      return decodeTokenMint(pubkeyValue, owner, bytes);
    case "TOKEN_2022_ACCOUNT":
      if (owner !== TOKEN_2022_PROGRAM_ID.toBase58()) fail("TOKEN_ACCOUNT_OWNER");
      return decodeTokenAccount(pubkeyValue, owner, bytes);
    case "SYSTEM_VACANT":
      if (owner !== SystemProgram.programId.toBase58() || bytes.length !== 0) {
        fail("SYSTEM_VACANT_CODEC");
      }
      return { codec: "SYSTEM_VACANT", dataLength: 0 };
    case "UPGRADEABLE_PROGRAM":
      if (owner !== UPGRADEABLE_LOADER_ID.toBase58() || bytes.length !== 36
        || bytes.readUInt32LE(0) !== 2) {
        fail("UPGRADEABLE_PROGRAM_CODEC");
      }
      return { codec: "UPGRADEABLE_PROGRAM", programDataAddress: keyAt(bytes, 4) };
    case "BYTE_BOUND":
      if ([
        "IATB3S01",
        "IATB3CFG",
        "IATB3POS",
        "IATB3LAN",
        "IATB3ELG",
        "IATB3RND",
        "IATB3CRW",
        "IATB3AGN",
        "IATB3AOI",
      ].includes(bytes.subarray(0, 8).toString("ascii"))) {
        fail("SEMANTIC_CODEC_REQUIRED");
      }
      return {
        codec: "BYTE_BOUND",
        owner,
        dataLength: bytes.length,
        dataSha256: sha256(bytes),
      };
    default:
      fail("FIXTURE_CODEC_UNSUPPORTED");
  }
}

export function validateIatB3ProductionLoopbackUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("RPC_URL");
  }
  const port = Number(url.port);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1"
    || url.username !== "" || url.password !== "" || url.pathname !== "/"
    || url.search !== "" || url.hash !== "" || !Number.isInteger(port)
    || port < 1024 || port > 65_535) {
    fail("RPC_LOOPBACK_ONLY");
  }
  return url.toString();
}

export function createIatB3ProductionLoopbackJsonRpcTransport({
  rpcUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
} = {}) {
  const url = validateIatB3ProductionLoopbackUrl(rpcUrl);
  if (typeof fetchImpl !== "function" || !Number.isSafeInteger(timeoutMs)
    || timeoutMs < 1 || timeoutMs > 30_000) {
    fail("RPC_TRANSPORT_CONFIG");
  }
  let requestId = 0;
  return Object.freeze({
    rpcUrl: url,
    async call(method, params) {
      if (!ALLOWED_RPC_METHODS.has(method) || !Array.isArray(params)) fail("RPC_METHOD");
      requestId += 1;
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response || response.ok !== true
        || (typeof response.url === "string" && response.url.length > 0 && response.url !== url)) {
        fail("RPC_HTTP");
      }
      const contentType = response.headers?.get?.("content-type");
      if (typeof contentType !== "string"
        || !/^application\/json(?:\s*;|$)/iu.test(contentType)) {
        fail("RPC_HTTP_CONTENT_TYPE");
      }
      if (typeof response.text !== "function") fail("RPC_HTTP_BODY");
      const body = parseLosslessRpcJson(await response.text());
      if (!body || body.jsonrpc !== "2.0" || body.id !== requestId
        || Object.hasOwn(body, "error") || !Object.hasOwn(body, "result")) {
        fail("RPC_RESPONSE");
      }
      return body.result;
    },
  });
}

function decodeRpcAccount(value, expectedPubkey) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !Array.isArray(value.data) || value.data.length !== 2 || value.data[1] !== "base64"
    || typeof value.executable !== "boolean" || typeof value.owner !== "string") {
    fail("RPC_ACCOUNT");
  }
  publicKey(expectedPubkey);
  publicKey(value.owner);
  const lamports = rpcUnsignedString(value.lamports, "RPC_ACCOUNT_LAMPORTS");
  const rentEpoch = rpcUnsignedString(value.rentEpoch, "RPC_ACCOUNT_RENT_EPOCH");
  canonicalBase64(value.data[0]);
  return {
    pubkey: expectedPubkey,
    owner: value.owner,
    executable: value.executable,
    lamports,
    rentEpoch,
    dataBase64: value.data[0],
  };
}

function contextValue(result, code) {
  if (!result || typeof result !== "object" || Array.isArray(result)
    || !result.context || typeof result.context !== "object") {
    fail(code);
  }
  safeRpcInteger(result.context.slot, `${code}_SLOT`);
  return result;
}

function parseCanonicalSignerBytes(raw) {
  if (!Buffer.isBuffer(raw) || raw.length < 129 || raw.length > 258) fail("SIGNER_FILE_BYTES");
  const values = [];
  let index = 0;
  const expect = (byte) => {
    if (raw[index] !== byte) fail("SIGNER_FILE_CANONICAL_JSON");
    index += 1;
  };
  expect(0x5b);
  while (values.length < 64) {
    const digitStart = index;
    let value = 0;
    let digits = 0;
    while (index < raw.length && raw[index] >= 0x30 && raw[index] <= 0x39) {
      value = (value * 10) + raw[index] - 0x30;
      digits += 1;
      index += 1;
    }
    if (digits === 0 || digits > 3 || value > 255
      || (digits > 1 && raw[digitStart] === 0x30)) {
      fail("SIGNER_FILE_CANONICAL_JSON");
    }
    values.push(value);
    expect(values.length === 64 ? 0x5d : 0x2c);
  }
  if (index < raw.length && raw[index] === 0x0a) index += 1;
  if (index !== raw.length) fail("SIGNER_FILE_CANONICAL_JSON");
  return Uint8Array.from(values);
}

function isWithin(parent, candidate) {
  const suffix = relative(parent, candidate);
  return suffix === "" || (!suffix.startsWith("..") && !isAbsolute(suffix));
}

const SIGNER_FILE_SYSTEM = Object.freeze({
  close: closeSync,
  fstat: fstatSync,
  lstat: lstatSync,
  open: openSync,
  read: readSync,
  realpath: realpathSync.native,
});

function secureReadSignerFile(binding, signerRoot, fileSystem = SIGNER_FILE_SYSTEM) {
  if (!isAbsolute(binding.path) || resolve(binding.path) !== binding.path) fail("SIGNER_PATH");
  const root = fileSystem.realpath(signerRoot);
  const suffix = relative(root, binding.path);
  let current = root;
  if (suffix.startsWith("..") || isAbsolute(suffix)) fail("SIGNER_PATH_POLICY");
  for (const component of suffix.split(/[\\/]/u).filter(Boolean)) {
    current = resolve(current, component);
    if (fileSystem.lstat(current).isSymbolicLink()) fail("SIGNER_PATH_POLICY");
  }
  const canonicalBefore = fileSystem.realpath(binding.path);
  if (!isWithin(root, canonicalBefore) || canonicalBefore !== binding.path) {
    fail("SIGNER_PATH_POLICY");
  }
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  const descriptor = fileSystem.open(binding.path, fsConstants.O_RDONLY | noFollow);
  let bytes = null;
  try {
    const before = fileSystem.fstat(descriptor);
    if (!before.isFile() || before.size < 129 || before.size > 258) fail("SIGNER_FILE_BYTES");
    bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fileSystem.read(descriptor, bytes, offset, bytes.length - offset, offset);
      if (!Number.isInteger(count) || count <= 0) fail("SIGNER_FILE_RACE");
      offset += count;
    }
    const after = fileSystem.fstat(descriptor);
    const pathAfter = fileSystem.lstat(binding.path);
    const canonicalAfter = fileSystem.realpath(binding.path);
    if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino
      || before.size !== after.size || before.mtimeMs !== after.mtimeMs
      || after.dev !== pathAfter.dev || after.ino !== pathAfter.ino
      || canonicalAfter !== canonicalBefore || !isWithin(root, canonicalAfter)) {
      fail("SIGNER_FILE_RACE");
    }
    return bytes;
  } catch (error) {
    bytes?.fill(0);
    throw error;
  } finally {
    fileSystem.close(descriptor);
  }
}

export function readIatB3ProductionEphemeralSignerFile(binding, signerRoot, fileSystem) {
  return secureReadSignerFile(binding, signerRoot, fileSystem);
}

const defaultConfirmationDelay = async () =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, 250));

function decodeBase58(value) {
  if (typeof value !== "string" || value.length === 0) fail("BASE58");
  const bytes = [0];
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) fail("BASE58");
    let carry = digit;
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let index = 0; index < value.length - 1 && value[index] === "1"; index += 1) {
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
}

function encodeBase58(value) {
  const input = Buffer.from(value);
  if (input.length === 0) return "";
  const digits = [0];
  for (const byte of input) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let output = "1".repeat(input.findIndex((byte) => byte !== 0) === -1
    ? input.length : input.findIndex((byte) => byte !== 0));
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    output += BASE58_ALPHABET[digits[index]];
  }
  return output;
}

function transactionErrorCode(error) {
  if (error === null) return null;
  const custom = error?.InstructionError?.[1]?.Custom;
  if (!Number.isSafeInteger(custom) || custom < 0 || custom > 0xffff_ffff) {
    fail("TRANSACTION_ERROR_SHAPE");
  }
  return custom;
}

function accountKeysFromTransaction(transaction, meta) {
  const staticKeys = transaction.compileMessage().accountKeys.map((key) => key.toBase58());
  const loaded = meta?.loadedAddresses;
  const writable = loaded?.writable ?? [];
  const readonly = loaded?.readonly ?? [];
  if (![writable, readonly].every((keys) => Array.isArray(keys)
    && keys.every((key) => typeof key === "string"))) {
    fail("TRANSACTION_LOADED_KEYS");
  }
  return [...staticKeys, ...writable, ...readonly].map((key) => publicKey(key).toBase58());
}

function decodeInnerCpi(transaction, meta) {
  const keys = accountKeysFromTransaction(transaction, meta);
  const groups = meta.innerInstructions ?? [];
  if (!Array.isArray(groups)) fail("INNER_CPI_GROUPS");
  const output = [];
  for (const group of groups) {
    if (!Number.isSafeInteger(group?.index) || group.index < 0 || !Array.isArray(group.instructions)) {
      fail("INNER_CPI_GROUP");
    }
    for (const instruction of group.instructions) {
      if (!Number.isSafeInteger(instruction?.programIdIndex)
        || typeof instruction.data !== "string" || !Array.isArray(instruction.accounts)
        || instruction.accounts.some((index) => !Number.isSafeInteger(index) || !keys[index])
        || !keys[instruction.programIdIndex]) {
        fail("INNER_CPI_INSTRUCTION");
      }
      output.push({
        instructionIndex: group.index,
        programId: keys[instruction.programIdIndex],
        dataSha256: sha256(decodeBase58(instruction.data)),
        accountPubkeys: instruction.accounts.map((index) => keys[index]),
      });
    }
  }
  return output;
}

export function createIatB3ProductionLoopbackAdapter({
  rpcUrl,
  signerRoot,
  signerBindings,
  fixtureCodecs,
  transport = null,
  readSignerFile = secureReadSignerFile,
  confirmationPolls = 20,
  confirmationDelay = defaultConfirmationDelay,
} = {}) {
  const url = validateIatB3ProductionLoopbackUrl(rpcUrl);
  if (!isAbsolute(signerRoot) || resolve(signerRoot) !== signerRoot
    || !Array.isArray(signerBindings) || !Array.isArray(fixtureCodecs)
    || typeof readSignerFile !== "function" || typeof confirmationDelay !== "function"
    || !Number.isSafeInteger(confirmationPolls) || confirmationPolls < 1 || confirmationPolls > 40) {
    fail("ADAPTER_CONFIG");
  }
  const rpc = transport ?? createIatB3ProductionLoopbackJsonRpcTransport({ rpcUrl: url });
  if (rpc.rpcUrl !== url || typeof rpc.call !== "function") fail("TRANSPORT_BINDING");
  const signerByRole = new Map();
  for (const binding of signerBindings) {
    exactKeys(binding, ["role", "path", "expectedPubkey"], "SIGNER_BINDING");
    if (typeof binding.role !== "string" || binding.role.length === 0 || signerByRole.has(binding.role)
      || !isAbsolute(binding.path) || publicKey(binding.expectedPubkey).toBase58() !== binding.expectedPubkey) {
      fail("SIGNER_BINDING");
    }
    signerByRole.set(binding.role, Object.freeze({ ...binding }));
  }
  const codecByPubkey = new Map();
  for (const binding of fixtureCodecs) {
    exactKeys(binding, ["pubkey", "codec"], "FIXTURE_CODEC_BINDING");
    if (codecByPubkey.has(binding.pubkey) || typeof binding.codec !== "string") {
      fail("FIXTURE_CODEC_BINDING");
    }
    codecByPubkey.set(publicKey(binding.pubkey).toBase58(), binding.codec);
  }
  const liveSigners = new Map();
  const pendingSignerSecretHashes = new Map();
  const testOnlyInjection = transport !== null
    || readSignerFile !== secureReadSignerFile
    || confirmationDelay !== defaultConfirmationDelay;

  async function accountInfo(pubkeyValue, { minContextSlot = null } = {}) {
    const config = { encoding: "base64", commitment: IAT_B3_PRODUCTION_LOOPBACK_COMMITMENT };
    if (minContextSlot !== null) config.minContextSlot = minContextSlot;
    const result = contextValue(await rpc.call("getAccountInfo", [pubkeyValue, config]), "ACCOUNT_INFO");
    if (result.value === null) fail("ACCOUNT_MISSING");
    return { slot: result.context.slot, account: decodeRpcAccount(result.value, pubkeyValue) };
  }

  const adapter = {
    kind: testOnlyInjection
      ? IAT_B3_PRODUCTION_LOOPBACK_TEST_ADAPTER_KIND
      : IAT_B3_PRODUCTION_LOOPBACK_ADAPTER_KIND,
    rpcUrl: url,
    async assertExecutionPlanBinding({ executionPlan, input }) {
      if (!executionPlan || !input
        || input.rpc?.url !== url
        || input.executionBoundary?.ephemeralSignerDirectory !== signerRoot
        || !Array.isArray(executionPlan.signers)
        || !Array.isArray(executionPlan.accountFixtures)) {
        fail("EXECUTION_PLAN_BINDING");
      }
      const expectedSigners = [...signerByRole.values()]
        .map(({ role, expectedPubkey }) => ({ role, expectedPubkey }))
        .sort((left, right) => left.role.localeCompare(right.role));
      const observedSigners = executionPlan.signers
        .map(({ role, expectedPubkey }) => ({ role, expectedPubkey }))
        .sort((left, right) => left.role.localeCompare(right.role));
      const expectedCodecs = [...codecByPubkey]
        .map(([pubkeyValue, codec]) => ({ pubkey: pubkeyValue, codec }))
        .sort((left, right) => left.pubkey.localeCompare(right.pubkey));
      const observedCodecs = executionPlan.accountFixtures
        .map(({ pubkey: pubkeyValue, codec }) => ({ pubkey: pubkeyValue, codec }))
        .sort((left, right) => left.pubkey.localeCompare(right.pubkey));
      if (JSON.stringify(expectedSigners) !== JSON.stringify(observedSigners)
        || JSON.stringify(expectedCodecs) !== JSON.stringify(observedCodecs)) {
        fail("EXECUTION_PLAN_BINDING");
      }
    },
    async observeGenesisHash() {
      const value = await rpc.call("getGenesisHash", []);
      return publicKey(value, "GENESIS_HASH").toBase58();
    },
    async observeProgramDeployment(programId) {
      const program = await accountInfo(publicKey(programId).toBase58());
      const programBytes = canonicalBase64(program.account.dataBase64);
      if (program.account.owner !== UPGRADEABLE_LOADER_ID.toBase58()
        || program.account.executable !== true || programBytes.length !== 36
        || programBytes.readUInt32LE(0) !== 2) {
        fail("PROGRAM_ACCOUNT");
      }
      const programDataAddress = keyAt(programBytes, 4);
      const programData = await accountInfo(programDataAddress, { minContextSlot: program.slot });
      if (programData.account.owner !== UPGRADEABLE_LOADER_ID.toBase58()
        || programData.account.executable !== false) {
        fail("PROGRAMDATA_ACCOUNT");
      }
      return {
        programId,
        programAccountOwner: program.account.owner,
        programAccountExecutable: program.account.executable,
        programAccountDataBase64: program.account.dataBase64,
        programDataAddress,
        programDataOwner: programData.account.owner,
        programDataExecutable: programData.account.executable,
        programDataBase64: programData.account.dataBase64,
      };
    },
    async observeAccount(pubkeyValue) {
      return (await accountInfo(publicKey(pubkeyValue).toBase58())).account;
    },
    async decodeFixtureState({ codec: expectedCodec, pubkey: pubkeyValue, owner, dataBase64 }) {
      const configuredCodec = codecByPubkey.get(pubkeyValue);
      if (configuredCodec === undefined || configuredCodec !== expectedCodec) {
        fail("FIXTURE_CODEC_MISSING");
      }
      return decodeIatB3ProductionFixtureState({
        codec: configuredCodec,
        pubkey: pubkeyValue,
        owner,
        dataBase64,
      });
    },
    async loadEphemeralSignerBytes({ role, expectedPubkey }) {
      const binding = signerByRole.get(role);
      if (!binding || binding.expectedPubkey !== expectedPubkey || liveSigners.has(role)
        || pendingSignerSecretHashes.has(role)) {
        fail("SIGNER_LOAD_BINDING");
      }
      const raw = await readSignerFile(binding, signerRoot);
      try {
        const secret = parseCanonicalSignerBytes(raw);
        pendingSignerSecretHashes.set(role, sha256(secret));
        return secret;
      } finally {
        if (Buffer.isBuffer(raw)) raw.fill(0);
      }
    },
    async deriveEphemeralSignerPublicKey({ role, expectedPubkey, secret }) {
      const binding = signerByRole.get(role);
      if (!binding || binding.expectedPubkey !== expectedPubkey || liveSigners.has(role)
        || !(secret instanceof Uint8Array) || secret.length !== 64
        || pendingSignerSecretHashes.get(role) !== sha256(secret)) {
        fail("SIGNER_DERIVATION_BINDING");
      }
      pendingSignerSecretHashes.delete(role);
      const secretCopy = Uint8Array.from(secret);
      const { Keypair } = await import("@solana/web3.js");
      let keypair;
      try {
        keypair = Keypair.fromSecretKey(secretCopy);
      } catch {
        secretCopy.fill(0);
        fail("SIGNER_SECRET");
      }
      const observed = keypair.publicKey.toBase58();
      if (observed !== expectedPubkey) {
        secretCopy.fill(0);
        keypair.secretKey.fill(0);
        fail("SIGNER_PUBLIC_KEY");
      }
      liveSigners.set(role, { keypair, secretCopy });
      return observed;
    },
    async disposeEphemeralSigners() {
      for (const value of liveSigners.values()) {
        value.secretCopy.fill(0);
        value.keypair.secretKey.fill(0);
      }
      liveSigners.clear();
      pendingSignerSecretHashes.clear();
    },
    async snapshotAccounts(pubkeys) {
      if (!Array.isArray(pubkeys) || pubkeys.length === 0
        || pubkeys.some((value) => publicKey(value).toBase58() !== value)) {
        fail("SNAPSHOT_KEYS");
      }
      const result = contextValue(await rpc.call("getMultipleAccounts", [pubkeys, {
        encoding: "base64",
        commitment: IAT_B3_PRODUCTION_LOOPBACK_COMMITMENT,
      }]), "MULTIPLE_ACCOUNTS");
      if (!Array.isArray(result.value) || result.value.length !== pubkeys.length
        || result.value.some((value) => value === null)) {
        fail("SNAPSHOT_ACCOUNTS");
      }
      return result.value.map((value, index) => decodeRpcAccount(value, pubkeys[index]));
    },
    async executeTransaction({ caseId, instructions, signerRoles, feePayer }) {
      if (typeof caseId !== "string" || caseId.length === 0 || !Array.isArray(instructions)
        || instructions.length === 0 || !Array.isArray(signerRoles)
        || signerRoles.length === 0 || new Set(signerRoles).size !== signerRoles.length) {
        fail("EXECUTION_REQUEST");
      }
      const signing = signerRoles.map((role) => liveSigners.get(role)?.keypair);
      if (signing.some((value) => value === undefined)
        || !signing.some(({ publicKey: key }) => key.toBase58() === feePayer)) {
        fail("EXECUTION_SIGNERS");
      }
      const latest = contextValue(await rpc.call("getLatestBlockhash", [{
        commitment: IAT_B3_PRODUCTION_LOOPBACK_COMMITMENT,
      }]), "LATEST_BLOCKHASH");
      if (!latest.value || typeof latest.value.blockhash !== "string"
        || !Number.isSafeInteger(latest.value.lastValidBlockHeight)) {
        fail("LATEST_BLOCKHASH");
      }
      publicKey(latest.value.blockhash, "LATEST_BLOCKHASH");
      const transaction = new Transaction({
        feePayer: publicKey(feePayer),
        recentBlockhash: latest.value.blockhash,
      });
      transaction.add(...instructions);
      transaction.sign(...signing);
      const message = transaction.serializeMessage();
      const serialized = transaction.serialize({ requireAllSignatures: true, verifySignatures: true });
      const submittedMessageSha256 = sha256(message);
      const submittedTransactionSha256 = sha256(serialized);
      const expectedSignatureBytes = transaction.signatures[0]?.signature;
      if (!expectedSignatureBytes || expectedSignatureBytes.length !== 64) {
        serialized.fill(0);
        message.fill(0);
        fail("LOCAL_TRANSACTION_SIGNATURE");
      }
      const expectedSignature = encodeBase58(expectedSignatureBytes);
      let landedBytes = null;
      let landedMessage = null;
      try {
        const signature = await rpc.call("sendTransaction", [serialized.toString("base64"), {
          encoding: "base64",
          skipPreflight: false,
          preflightCommitment: IAT_B3_PRODUCTION_LOOPBACK_COMMITMENT,
          maxRetries: 0,
        }]);
        if (typeof signature !== "string" || decodeBase58(signature).length !== 64
          || signature !== expectedSignature) {
          fail("TRANSACTION_SIGNATURE");
        }
        let confirmed = null;
        for (let poll = 0; poll < confirmationPolls; poll += 1) {
          const statuses = await rpc.call("getSignatureStatuses", [[signature], {
            searchTransactionHistory: true,
          }]);
          if (!statuses || !Array.isArray(statuses.value) || statuses.value.length !== 1) {
            fail("SIGNATURE_STATUS");
          }
          const status = statuses.value[0];
          if (status && ["confirmed", "finalized"].includes(status.confirmationStatus)) {
            confirmed = status;
            break;
          }
          await confirmationDelay(poll);
        }
        if (confirmed === null) fail("TRANSACTION_CONFIRMATION_TIMEOUT");
        const landed = await rpc.call("getTransaction", [signature, {
          encoding: "base64",
          commitment: IAT_B3_PRODUCTION_LOOPBACK_COMMITMENT,
          maxSupportedTransactionVersion: 0,
        }]);
        if (!landed || !landed.meta || !landed.transaction
          || !Array.isArray(landed.transaction) || landed.transaction.length !== 2
          || landed.transaction[1] !== "base64"
          || !Array.isArray(landed.meta.logMessages)
          || landed.meta.logMessages.some((line) => typeof line !== "string")) {
          fail("TRANSACTION_OBSERVATION");
        }
        landedBytes = canonicalBase64(landed.transaction[0], "LANDED_TRANSACTION_BASE64");
        let landedTransaction;
        try {
          landedTransaction = Transaction.from(landedBytes);
        } catch {
          fail("LANDED_TRANSACTION_BYTES");
        }
        landedMessage = landedTransaction.serializeMessage();
        const landedTransactionSha256 = sha256(landedBytes);
        const landedMessageSha256 = sha256(landedMessage);
        const landedSignature = landedTransaction.signatures[0]?.signature;
        if (!landedBytes.equals(serialized)
          || submittedTransactionSha256 !== landedTransactionSha256
          || submittedMessageSha256 !== landedMessageSha256
          || !landedSignature || encodeBase58(landedSignature) !== expectedSignature
          || !landedTransaction.verifySignatures()) {
          fail("LANDED_TRANSACTION_BINDING");
        }
        safeRpcInteger(landed.slot, "TRANSACTION_SLOT");
        const feeLamports = rpcUnsignedString(landed.meta.fee, "TRANSACTION_FEE");
        if (feeLamports === "0") fail("TRANSACTION_FEE");
        const observedError = transactionErrorCode(landed.meta.err);
        if (transactionErrorCode(confirmed.err) !== observedError) fail("TRANSACTION_ERROR_DRIFT");
        return {
          signature,
          slot: landed.slot,
          confirmationStatus: "confirmed",
          errorCode: observedError,
          feeLamports,
          submittedMessageSha256,
          landedMessageSha256,
          submittedTransactionSha256,
          landedTransactionSha256,
          logs: [...landed.meta.logMessages],
          innerCpi: decodeInnerCpi(landedTransaction, landed.meta),
        };
      } finally {
        serialized.fill(0);
        message.fill(0);
        landedBytes?.fill(0);
        landedMessage?.fill(0);
      }
    },
  };
  if (!testOnlyInjection) OFFICIAL_LOOPBACK_ADAPTERS.add(adapter);
  return Object.freeze(adapter);
}

export function assertOfficialIatB3ProductionLoopbackAdapter(adapter) {
  if (!adapter || typeof adapter !== "object"
    || adapter.kind !== IAT_B3_PRODUCTION_LOOPBACK_ADAPTER_KIND
    || !OFFICIAL_LOOPBACK_ADAPTERS.has(adapter)) {
    fail("OFFICIAL_ADAPTER_BRAND");
  }
  return adapter;
}

export function assertIatB3ProductionLoopbackCodecBinding(binding) {
  exactKeys(binding, ["pubkey", "codec", "decodedStateSha256"], "CODEC_BINDING");
  publicKey(binding.pubkey);
  if (typeof binding.codec !== "string" || !HEX_SHA256.test(binding.decodedStateSha256)) {
    fail("CODEC_BINDING");
  }
  return binding;
}
