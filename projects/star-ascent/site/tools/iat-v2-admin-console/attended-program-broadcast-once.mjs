import { PublicKey } from "@solana/web3.js";

const SCHEMA = "iat-v2-current-source-program-broadcast-attempt/v2";
const STORAGE_PREFIX = "iat-v2-current-source-program-broadcast-attempt";
const GLOBAL_LOCK_NAME = "iat-v2-current-source-program-broadcast/global/v2";
const PROGRAM_ACTIONS = new Set(["EXTEND_PROGRAM_DATA", "UPGRADE_PROGRAM"]);
const RECORD_FIELDS = Object.freeze([
  "schema",
  "sourceCommit",
  "programArtifactSha256",
  "mint",
  "action",
  "messageSha256",
  "signer",
  "localSignature",
  "blockhash",
  "lastValidBlockHeight",
]);
const STORAGE_BINDING_FIELDS = Object.freeze([
  "sourceCommit",
  "programArtifactSha256",
  "mint",
  "action",
]);
const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/u;
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const hex40 = /^[0-9a-f]{40}$/u;
const hex64 = /^[0-9a-f]{64}$/u;

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, expected, label) {
  check(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  check(JSON.stringify(Object.keys(value)) === JSON.stringify(expected), `${label} fields are not exact`);
}

function exactPublicKey(value, label) {
  check(typeof value === "string", `${label} must be a string`);
  let publicKey;
  try {
    publicKey = new PublicKey(value);
  } catch {
    throw new Error(`${label} is not a canonical public key`);
  }
  check(publicKey.toBase58() === value, `${label} is not canonical`);
  return value;
}

function base58Bytes(value) {
  check(typeof value === "string" && base58.test(value), "Broadcast attempt signature is not base58");
  let number = 0n;
  for (const character of value) {
    number = number * 58n + BigInt(base58Alphabet.indexOf(character));
  }
  const reversed = [];
  while (number > 0n) {
    reversed.push(Number(number & 0xffn));
    number >>= 8n;
  }
  let zeroes = 0;
  while (zeroes < value.length && value[zeroes] === "1") zeroes += 1;
  return Uint8Array.from([
    ...new Array(zeroes).fill(0),
    ...reversed.reverse(),
  ]);
}

function encodeBase58(bytes) {
  let number = 0n;
  for (const byte of bytes) number = (number << 8n) + BigInt(byte);
  let encoded = "";
  while (number > 0n) {
    encoded = base58Alphabet[Number(number % 58n)] + encoded;
    number /= 58n;
  }
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes += 1;
  return `${"1".repeat(zeroes)}${encoded}`;
}

function exactSignature(value) {
  const bytes = base58Bytes(value);
  check(bytes.length === 64, "Broadcast attempt signature is not exactly 64 bytes");
  check(bytes.some((byte) => byte !== 0), "Broadcast attempt signature cannot be all zeroes");
  check(encodeBase58(bytes) === value, "Broadcast attempt signature encoding is not canonical");
  return value;
}

function exactAction(action) {
  check(PROGRAM_ACTIONS.has(action), "Broadcast attempt action is outside the canonical program roster");
  return action;
}

function exactStorageBinding(value) {
  exactKeys(value, STORAGE_BINDING_FIELDS, "broadcast attempt storage binding");
  check(hex40.test(value.sourceCommit ?? ""), "Broadcast attempt source commit is not exact");
  check(hex64.test(value.programArtifactSha256 ?? ""), "Broadcast attempt artifact SHA-256 is not exact");
  exactPublicKey(value.mint, "Broadcast attempt mint");
  exactAction(value.action);
  return Object.freeze({ ...value });
}

function canonicalAttempt(value) {
  exactKeys(value, RECORD_FIELDS, "broadcast attempt record");
  check(value.schema === SCHEMA, "Broadcast attempt schema is not reviewed v2");
  check(hex40.test(value.sourceCommit ?? ""), "Broadcast attempt source commit is not exact");
  check(hex64.test(value.programArtifactSha256 ?? ""), "Broadcast attempt artifact SHA-256 is not exact");
  exactPublicKey(value.mint, "Broadcast attempt mint");
  exactAction(value.action);
  check(hex64.test(value.messageSha256 ?? ""), "Broadcast attempt message SHA-256 is not exact");
  exactPublicKey(value.signer, "Broadcast attempt signer");
  exactSignature(value.localSignature);
  exactPublicKey(value.blockhash, "Broadcast attempt blockhash");
  check(
    Number.isSafeInteger(value.lastValidBlockHeight) && value.lastValidBlockHeight > 0,
    "Broadcast attempt last-valid block height is invalid",
  );
  return Object.freeze({ ...value });
}

function storageBindingForAttempt(attempt) {
  return Object.fromEntries(STORAGE_BINDING_FIELDS.map((field) => [field, attempt[field]]));
}

function parseAttempt(value, expectedBinding) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new Error("Broadcast attempt record is not valid JSON");
  }
  const exact = canonicalAttempt(parsed);
  const expected = exactStorageBinding(expectedBinding);
  for (const field of STORAGE_BINDING_FIELDS) {
    check(exact[field] === expected[field], `Broadcast attempt ${field} drifted from its storage binding`);
  }
  return exact;
}

function storageKey(value) {
  const exact = exactStorageBinding(value);
  return [
    STORAGE_PREFIX,
    exact.sourceCommit,
    exact.programArtifactSha256,
    exact.mint,
    exact.action,
    "v2",
  ].join("/");
}

function exactStorage(storage) {
  check(
    typeof storage?.getItem === "function" && typeof storage?.setItem === "function",
    "Broadcast attempt storage is unavailable",
  );
  return storage;
}

function readStored(storage, key) {
  try {
    return exactStorage(storage).getItem(key);
  } catch (error) {
    throw new Error("Broadcast attempt storage is unavailable for reading", { cause: error });
  }
}

function persistAttempt(storage, value) {
  const exact = canonicalAttempt(value);
  const binding = storageBindingForAttempt(exact);
  const key = storageKey(binding);
  const serialized = JSON.stringify(exact);
  const retained = readStored(storage, key);
  if (retained !== null) {
    const current = parseAttempt(retained, binding);
    check(JSON.stringify(current) === serialized, "Broadcast attempt conflicts with the permanent action reservation");
    return Object.freeze({ attempt: current, created: false });
  }
  try {
    exactStorage(storage).setItem(key, serialized);
    check(storage.getItem(key) === serialized, "Broadcast attempt storage readback disagrees with the write");
  } catch (error) {
    throw new Error("Broadcast attempt storage is unavailable or non-durable", { cause: error });
  }
  return Object.freeze({
    attempt: parseAttempt(readStored(storage, key), binding),
    created: true,
  });
}

function resolvedLocks(locks) {
  let value = locks;
  if (value === undefined) {
    try {
      value = globalThis.navigator?.locks;
    } catch (error) {
      throw new Error("Program broadcast Web Locks are unavailable", { cause: error });
    }
  }
  check(typeof value?.request === "function", "Program broadcast Web Locks are unavailable");
  return value;
}

export function loadAttendedProgramBroadcastAttempt(storage, expectedBinding) {
  const key = storageKey(expectedBinding);
  const serialized = readStored(storage, key);
  return serialized === null ? null : parseAttempt(serialized, expectedBinding);
}

export async function withNoAttendedProgramBroadcastAttempts({
  locks,
  storage,
  bindings,
  callback,
} = {}) {
  check(Array.isArray(bindings) && bindings.length > 0, "At least one program broadcast binding is required");
  check(typeof callback === "function", "Program broadcast guard callback is required");
  return resolvedLocks(locks).request(
    GLOBAL_LOCK_NAME,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      check(lock, "Another attended program broadcast owns the global Web Lock");
      const exactBindings = Object.freeze(bindings.map((binding) => exactStorageBinding(binding)));
      for (const binding of exactBindings) {
        check(
          loadAttendedProgramBroadcastAttempt(storage, binding) === null,
          `Permanent attended program broadcast attempt already exists for ${binding.action}`,
        );
      }
      return callback(exactBindings);
    },
  );
}

export async function withAttendedProgramBroadcastReconciliation({
  locks,
  storage,
  attempt,
  callback,
} = {}) {
  const exact = canonicalAttempt(attempt);
  check(typeof callback === "function", "Program broadcast reconciliation callback is required");
  return resolvedLocks(locks).request(
    GLOBAL_LOCK_NAME,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      check(lock, "Another attended program broadcast owns the global Web Lock");
      const binding = storageBindingForAttempt(exact);
      const retained = loadAttendedProgramBroadcastAttempt(storage, binding);
      check(retained !== null, "Permanent program broadcast attempt is missing during reconciliation");
      check(
        JSON.stringify(retained) === JSON.stringify(exact),
        "Broadcast attempt conflicts with the permanent action reservation",
      );
      return callback(retained);
    },
  );
}

export async function withAttendedProgramBroadcastOnce({
  locks,
  storage,
  attempt,
  beforePersist,
  afterPersist,
} = {}) {
  const exact = canonicalAttempt(attempt);
  check(
    beforePersist === undefined || typeof beforePersist === "function",
    "Program broadcast pre-reservation callback is invalid",
  );
  check(typeof afterPersist === "function", "Program broadcast continuation is required");
  return resolvedLocks(locks).request(
    GLOBAL_LOCK_NAME,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      check(lock, "Another attended program broadcast owns the global Web Lock");
      const binding = storageBindingForAttempt(exact);
      const retained = loadAttendedProgramBroadcastAttempt(storage, binding);
      if (retained !== null) {
        check(
          JSON.stringify(retained) === JSON.stringify(exact),
          "Broadcast attempt conflicts with the permanent action reservation",
        );
        return Object.freeze({
          status: "ALREADY_RESERVED",
          attempt: retained,
          value: null,
        });
      }
      if (beforePersist) await beforePersist(exact);
      const reservation = persistAttempt(storage, exact);
      check(reservation.created, "Program broadcast reservation was not newly created inside its lock");
      const value = await afterPersist(reservation.attempt);
      return Object.freeze({
        status: "RESERVED",
        attempt: reservation.attempt,
        value,
      });
    },
  );
}

export const IAT_V2_ATTENDED_PROGRAM_BROADCAST_ATTEMPT_SCHEMA = SCHEMA;
