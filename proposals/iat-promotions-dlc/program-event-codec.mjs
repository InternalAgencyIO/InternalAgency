/**
 * Fixed-width event codec.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EVENT_INTERFACE_PATH = fileURLToPath(
  new URL("./program-event-interface.v1.json", import.meta.url),
);
const TYPE_BYTES = Object.freeze({
  u8: 1,
  u16: 2,
  u32: 4,
  u64: 8,
  i64: 8,
  pubkey: 32,
  bytes32: 32,
});

function fail(code) {
  throw new Error(code);
}

export function loadProgramEventInterface() {
  return JSON.parse(readFileSync(EVENT_INTERFACE_PATH, "utf8"));
}

export function deriveEventDiscriminatorHex(name, definition = loadProgramEventInterface()) {
  return createHash("sha256")
    .update(`${definition.codec.discriminatorDomain}:event:${name}`)
    .digest("hex")
    .slice(0, definition.codec.discriminatorBytes * 2);
}

function requireExactDataKeys(data, fields) {
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("EVENT_DATA_NOT_OBJECT");
  const actual = Object.keys(data).sort();
  const expected = fields.map((field) => field.name).sort();
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    fail("EVENT_DATA_FIELDS_MISMATCH");
  }
}

function integerValue(value, field) {
  if (typeof value !== "string" || !/^-?[0-9]+$/.test(value)) {
    fail(`INVALID_INTEGER_${field.name}`);
  }
  const integer = BigInt(value);
  const size = TYPE_BYTES[field.type];
  const signed = field.type === "i64";
  const bits = BigInt(size * 8);
  const minimum = signed ? -(1n << (bits - 1n)) : 0n;
  const maximum = signed ? (1n << (bits - 1n)) - 1n : (1n << bits) - 1n;
  if (integer < minimum || integer > maximum) fail(`INTEGER_OUT_OF_RANGE_${field.name}`);
  return integer;
}

function encodeField(field, value) {
  const size = TYPE_BYTES[field.type];
  if (!size) fail(`UNSUPPORTED_EVENT_TYPE_${field.type}`);
  if (field.type === "bytes32" || field.type === "pubkey") {
    if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
      fail(`INVALID_${field.type.toUpperCase()}_${field.name}`);
    }
    return Buffer.from(value, "hex");
  }
  const integer = integerValue(value, field);
  const buffer = Buffer.alloc(size);
  if (field.type === "u8") buffer.writeUInt8(Number(integer));
  else if (field.type === "u16") buffer.writeUInt16LE(Number(integer));
  else if (field.type === "u32") buffer.writeUInt32LE(Number(integer));
  else if (field.type === "u64") buffer.writeBigUInt64LE(integer);
  else if (field.type === "i64") buffer.writeBigInt64LE(integer);
  return buffer;
}

function decodeField(field, buffer, offset) {
  const size = TYPE_BYTES[field.type];
  if (!size) fail(`UNSUPPORTED_EVENT_TYPE_${field.type}`);
  if (offset + size > buffer.length) fail("TRUNCATED_EVENT_DATA");
  const slice = buffer.subarray(offset, offset + size);
  let value;
  if (field.type === "bytes32" || field.type === "pubkey") value = slice.toString("hex");
  else if (field.type === "u8") value = String(slice.readUInt8(0));
  else if (field.type === "u16") value = String(slice.readUInt16LE(0));
  else if (field.type === "u32") value = String(slice.readUInt32LE(0));
  else if (field.type === "u64") value = String(slice.readBigUInt64LE(0));
  else if (field.type === "i64") value = String(slice.readBigInt64LE(0));
  return { value, offset: offset + size };
}

export function encodeProgramEvent(name, data, definition = loadProgramEventInterface()) {
  const event = definition.events.find((candidate) => candidate.name === name);
  if (!event) fail("UNKNOWN_EVENT");
  requireExactDataKeys(data, event.fields);
  return Buffer.concat([
    Buffer.from(event.discriminatorHex, "hex"),
    ...event.fields.map((field) => encodeField(field, data[field.name])),
  ]);
}

export function decodeProgramEvent(bytes, definition = loadProgramEventInterface()) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const discriminatorBytes = definition.codec.discriminatorBytes;
  if (buffer.length < discriminatorBytes) fail("TRUNCATED_EVENT_DISCRIMINATOR");
  const discriminatorHex = buffer.subarray(0, discriminatorBytes).toString("hex");
  const event = definition.events.find((candidate) => candidate.discriminatorHex === discriminatorHex);
  if (!event) fail("UNKNOWN_EVENT_DISCRIMINATOR");
  let offset = discriminatorBytes;
  const data = {};
  for (const field of event.fields) {
    const decoded = decodeField(field, buffer, offset);
    data[field.name] = decoded.value;
    offset = decoded.offset;
  }
  if (offset !== buffer.length) fail("TRAILING_EVENT_DATA");
  return { name: event.name, data };
}

export function eventEncodedLength(name, definition = loadProgramEventInterface()) {
  const event = definition.events.find((candidate) => candidate.name === name);
  if (!event) fail("UNKNOWN_EVENT");
  return definition.codec.discriminatorBytes + event.fields.reduce((sum, field) => {
    const size = TYPE_BYTES[field.type];
    if (!size) fail(`UNSUPPORTED_EVENT_TYPE_${field.type}`);
    return sum + size;
  }, 0);
}
