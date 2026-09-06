import { Buffer } from "buffer";
import { sha256 } from "@noble/hashes/sha256";
import { PublicKey, Transaction } from "@solana/web3.js";

const SCHEMA = "iat-v2-current-source-program-signed-pending/v2";
const STORAGE_PREFIX = "iat-v2-current-source-program-signed-pending";
const PROGRAM_ACTIONS = Object.freeze({
  EXTEND_PROGRAM_DATA: "extend-program",
  UPGRADE_PROGRAM: "upgrade",
});
const REMOVE_REASONS = new Set([
  "EXPLICIT_DISCARD",
  "PRE_SEND_FAILURE",
  "FINALIZED_SUCCESS",
]);
const RECORD_FIELDS = Object.freeze([
  "schema",
  "sourceCommit",
  "programArtifactSha256",
  "mint",
  "action",
  "messageSha256",
  "signer",
  "actionBinding",
  "finalizedContextSlot",
  "blockhash",
  "lastValidBlockHeight",
  "messageBytesHex",
  "signedWireHex",
  "preUpgradeProgramDataCapacityBytes",
]);
const EXPECTED_BINDING_FIELDS = Object.freeze([
  "sourceCommit",
  "programArtifactSha256",
  "mint",
  "action",
]);
const ACTION_BINDING_FIELDS = Object.freeze([
  "action",
  "programId",
  "programDataAddress",
  "programAdmin",
  "buffer",
  "bufferAuthority",
  "bufferHash",
  "deployedHash",
  "deployedRegionHash",
  "loaderZeroPaddingBytes",
  "loaderZeroPaddingVerified",
  "alreadyUpgraded",
  "programDataDeploymentSlot",
  "programDataCapacityBytes",
  "targetProgramDataCapacityBytes",
  "additionalProgramDataBytes",
  "targetProgramDataAccountBytes",
  "currentProgramDataLamports",
  "targetProgramDataRentLamports",
  "rentTopUpLamports",
  "extendProgramChecked",
  "extendProgramCheckedActivationSlot",
  "sourceCommit",
  "programArtifactSha256",
  "mint",
]);
const hex40 = /^[0-9a-f]{40}$/u;
const hex64 = /^[0-9a-f]{64}$/u;
const hexBytes = /^(?:[0-9a-f]{2})+$/u;
const decimal = /^(?:0|[1-9][0-9]*)$/u;

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

function nullablePublicKey(value, label) {
  if (value === null) return null;
  return exactPublicKey(value, label);
}

function nullableHex64(value, label) {
  check(value === null || hex64.test(value), `${label} must be null or an exact lowercase SHA-256`);
  return value;
}

function decimalText(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  check(typeof value === "string" && decimal.test(value), `${label} is not an exact decimal string`);
  const number = BigInt(value);
  check(number <= BigInt(Number.MAX_SAFE_INTEGER), `${label} exceeds the reviewed safe integer range`);
  return number;
}

function safePositiveInteger(value, label) {
  check(Number.isSafeInteger(value) && value > 0, `${label} must be a positive safe integer`);
  return value;
}

function exactAction(action) {
  check(Object.hasOwn(PROGRAM_ACTIONS, action), "Signed pending action is outside the canonical program roster");
  return action;
}

function exactExpectedBinding(value) {
  exactKeys(value, EXPECTED_BINDING_FIELDS, "signed pending expected binding");
  check(hex40.test(value.sourceCommit ?? ""), "Signed pending source commit is not exact");
  check(hex64.test(value.programArtifactSha256 ?? ""), "Signed pending artifact SHA-256 is not exact");
  exactPublicKey(value.mint, "Signed pending mint");
  exactAction(value.action);
  return Object.freeze({ ...value });
}

function exactActionBinding(serialized, outer) {
  check(
    typeof serialized === "string" && serialized.length > 0 && serialized.length <= 16_384,
    "Signed pending action binding is unavailable or oversized",
  );
  let value;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("Signed pending action binding is not valid JSON");
  }
  exactKeys(value, ACTION_BINDING_FIELDS, "signed pending action binding");
  check(JSON.stringify(value) === serialized, "Signed pending action binding is not exact canonical JSON");
  check(value.action === PROGRAM_ACTIONS[outer.action], "Signed pending action binding names a different action");
  exactPublicKey(value.programId, "Signed pending program ID");
  exactPublicKey(value.programDataAddress, "Signed pending ProgramData address");
  exactPublicKey(value.programAdmin, "Signed pending program admin");
  nullablePublicKey(value.buffer, "Signed pending buffer");
  nullablePublicKey(value.bufferAuthority, "Signed pending buffer authority");
  nullableHex64(value.bufferHash, "Signed pending buffer hash");
  nullableHex64(value.deployedHash, "Signed pending deployed hash");
  nullableHex64(value.deployedRegionHash, "Signed pending deployed-region hash");
  decimalText(value.loaderZeroPaddingBytes, "Signed pending loader padding", { nullable: true });
  check(typeof value.loaderZeroPaddingVerified === "boolean", "Signed pending loader padding flag is invalid");
  check(typeof value.alreadyUpgraded === "boolean", "Signed pending already-upgraded flag is invalid");
  decimalText(value.programDataDeploymentSlot, "Signed pending ProgramData deployment slot");
  const currentCapacity = decimalText(value.programDataCapacityBytes, "Signed pending ProgramData capacity");
  const targetCapacity = decimalText(value.targetProgramDataCapacityBytes, "Signed pending target capacity");
  const additionalBytes = decimalText(value.additionalProgramDataBytes, "Signed pending additional bytes");
  decimalText(value.targetProgramDataAccountBytes, "Signed pending target account bytes");
  decimalText(value.currentProgramDataLamports, "Signed pending current ProgramData lamports");
  decimalText(value.targetProgramDataRentLamports, "Signed pending target ProgramData rent");
  decimalText(value.rentTopUpLamports, "Signed pending rent top-up");
  check(typeof value.extendProgramChecked === "boolean", "Signed pending checked-feature flag is invalid");
  decimalText(
    value.extendProgramCheckedActivationSlot,
    "Signed pending checked-feature activation slot",
    { nullable: true },
  );
  check(value.sourceCommit === outer.sourceCommit, "Signed pending action binding source commit drifted");
  check(
    value.programArtifactSha256 === outer.programArtifactSha256,
    "Signed pending action binding artifact SHA-256 drifted",
  );
  check(value.mint === outer.mint, "Signed pending action binding mint drifted");
  check(value.programAdmin === outer.signer, "Signed pending action binding signer drifted");
  check(
    currentCapacity === BigInt(outer.preUpgradeProgramDataCapacityBytes),
    "Signed pending pre-upgrade ProgramData capacity drifted",
  );
  if (outer.action === "EXTEND_PROGRAM_DATA") {
    check(additionalBytes > 0n, "Signed extension must add a positive byte count");
    check(currentCapacity + additionalBytes === targetCapacity, "Signed extension capacity arithmetic drifted");
  }
  return serialized;
}

function exactWire(record) {
  check(
    typeof record.messageBytesHex === "string"
      && record.messageBytesHex.length <= 2_464
      && hexBytes.test(record.messageBytesHex),
    "Signed pending message bytes are not exact lowercase hex",
  );
  check(
    typeof record.signedWireHex === "string"
      && record.signedWireHex.length <= 2_464
      && hexBytes.test(record.signedWireHex),
    "Signed pending wire is not exact lowercase hex",
  );
  const messageBytes = Buffer.from(record.messageBytesHex, "hex");
  check(
    Buffer.from(sha256(messageBytes)).toString("hex") === record.messageSha256,
    "Signed pending message SHA-256 does not match its bytes",
  );
  let signed;
  try {
    signed = Transaction.from(Buffer.from(record.signedWireHex, "hex"));
  } catch {
    throw new Error("Signed pending wire is not a canonical legacy Solana transaction");
  }
  check(
    Buffer.from(signed.serializeMessage()).equals(messageBytes),
    "Signed pending wire carries different message bytes",
  );
  check(signed.recentBlockhash === record.blockhash, "Signed pending wire carries a different blockhash");
  check(signed.feePayer?.toBase58() === record.signer, "Signed pending fee payer is not the reviewed signer");
  check(signed.signatures.length === 1, "Signed pending program wire must contain exactly one signer");
  check(
    signed.signatures[0].publicKey.toBase58() === record.signer && signed.signatures[0].signature !== null,
    "Signed pending wire does not contain the reviewed signature",
  );
  check(signed.verifySignatures(), "Signed pending wire signature verification failed");
  let canonicalWire;
  try {
    canonicalWire = Buffer.from(signed.serialize()).toString("hex");
  } catch {
    throw new Error("Signed pending wire cannot be serialized canonically");
  }
  check(canonicalWire === record.signedWireHex, "Signed pending wire encoding is not canonical");
}

function canonicalRecord(value) {
  exactKeys(value, RECORD_FIELDS, "signed pending record");
  check(value.schema === SCHEMA, "Signed pending schema is not reviewed");
  check(hex40.test(value.sourceCommit ?? ""), "Signed pending source commit is not exact");
  check(hex64.test(value.programArtifactSha256 ?? ""), "Signed pending artifact SHA-256 is not exact");
  exactPublicKey(value.mint, "Signed pending mint");
  exactAction(value.action);
  check(hex64.test(value.messageSha256 ?? ""), "Signed pending message SHA-256 is not exact");
  exactPublicKey(value.signer, "Signed pending signer");
  safePositiveInteger(value.finalizedContextSlot, "Signed pending finalized context slot");
  exactPublicKey(value.blockhash, "Signed pending blockhash");
  safePositiveInteger(value.lastValidBlockHeight, "Signed pending last-valid block height");
  safePositiveInteger(
    value.preUpgradeProgramDataCapacityBytes,
    "Signed pending pre-upgrade ProgramData capacity",
  );
  exactActionBinding(value.actionBinding, value);
  exactWire(value);
  return Object.freeze({ ...value });
}

function parseRecord(value, expectedBinding) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new Error("Signed pending record is not valid JSON");
  }
  const exact = canonicalRecord(parsed);
  const expected = exactExpectedBinding(expectedBinding);
  for (const field of EXPECTED_BINDING_FIELDS) {
    check(exact[field] === expected[field], `Signed pending ${field} drifted from its storage binding`);
  }
  return exact;
}

function storageKey(expectedBinding) {
  const exact = exactExpectedBinding(expectedBinding);
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
    typeof storage?.getItem === "function"
      && typeof storage?.setItem === "function"
      && typeof storage?.removeItem === "function",
    "Signed pending storage is unavailable",
  );
  return storage;
}

function readStored(storage, key) {
  try {
    return exactStorage(storage).getItem(key);
  } catch (error) {
    throw new Error("Signed pending storage is unavailable for reading", { cause: error });
  }
}

export function loadAttendedProgramSignedPending(storage, expectedBinding) {
  const key = storageKey(expectedBinding);
  const serialized = readStored(storage, key);
  return serialized === null ? null : parseRecord(serialized, expectedBinding);
}

export function persistAttendedProgramSignedPending(storage, record) {
  const exact = canonicalRecord(record);
  const expectedBinding = Object.fromEntries(
    EXPECTED_BINDING_FIELDS.map((field) => [field, exact[field]]),
  );
  const key = storageKey(expectedBinding);
  const serialized = JSON.stringify(exact);
  const retained = readStored(storage, key);
  if (retained !== null) {
    const current = parseRecord(retained, expectedBinding);
    check(JSON.stringify(current) === serialized, "Signed pending record conflicts with retained state");
    return current;
  }
  try {
    exactStorage(storage).setItem(key, serialized);
    check(storage.getItem(key) === serialized, "Signed pending storage readback disagrees with the write");
  } catch (error) {
    throw new Error("Signed pending storage is unavailable or non-durable", { cause: error });
  }
  return parseRecord(readStored(storage, key), expectedBinding);
}

export function removeAttendedProgramSignedPending(storage, expectedBinding, reason) {
  check(REMOVE_REASONS.has(reason), "Signed pending removal reason is not reviewed");
  const key = storageKey(expectedBinding);
  const serialized = readStored(storage, key);
  if (serialized === null) return null;
  const current = parseRecord(serialized, expectedBinding);
  try {
    exactStorage(storage).removeItem(key);
    check(storage.getItem(key) === null, "Signed pending storage readback disagrees with removal");
  } catch (error) {
    throw new Error("Signed pending storage is unavailable for removal", { cause: error });
  }
  return current;
}

export const IAT_V2_ATTENDED_PROGRAM_SIGNED_PENDING_SCHEMA = SCHEMA;
