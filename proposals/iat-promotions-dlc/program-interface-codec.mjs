/**
 * Deterministic network-free instruction codec for the draft interface.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const interfacePath = fileURLToPath(new URL("./program-interface.v0.json", import.meta.url));
const FIXED_TYPE_BYTES = Object.freeze({ bytes32: 32, i64: 8, u16: 2, u32: 4, u64: 8 });

function fail(code) {
  throw new Error(code);
}

export function loadProgramInterface() {
  return JSON.parse(readFileSync(interfacePath, "utf8"));
}

export function deriveDiscriminatorHex(kind, name, definition = loadProgramInterface()) {
  return createHash("sha256")
    .update(`${definition.codec.discriminatorDomain}:${kind}:${name}`)
    .digest("hex")
    .slice(0, definition.codec.discriminatorBytes * 2);
}

function requireExactDataKeys(data, fields) {
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("INSTRUCTION_DATA_NOT_OBJECT");
  const keys = Object.keys(data).sort();
  const expected = fields.map((field) => field.name).sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    fail("INSTRUCTION_DATA_FIELDS_MISMATCH");
  }
}

function requireInteger(value, bits, signed, fieldName) {
  let integer;
  try {
    if (typeof value === "number" && !Number.isSafeInteger(value)) fail("INTEGER_NOT_SAFE");
    integer = BigInt(value);
  } catch {
    fail(`INVALID_INTEGER_${fieldName}`);
  }
  const width = BigInt(bits);
  const minimum = signed ? -(1n << (width - 1n)) : 0n;
  const maximum = signed ? (1n << (width - 1n)) - 1n : (1n << width) - 1n;
  if (integer < minimum || integer > maximum) fail(`INTEGER_OUT_OF_RANGE_${fieldName}`);
  return integer;
}

function encodeField(field, value) {
  if (field.type === "bytes32") {
    if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
      fail(`INVALID_BYTES32_${field.name}`);
    }
    return Buffer.from(value, "hex");
  }
  const size = FIXED_TYPE_BYTES[field.type];
  if (!size) fail(`UNSUPPORTED_INSTRUCTION_TYPE_${field.type}`);
  const buffer = Buffer.alloc(size);
  const signed = field.type === "i64";
  const integer = requireInteger(value, size * 8, signed, field.name);
  if (field.type === "u16") buffer.writeUInt16LE(Number(integer));
  else if (field.type === "u32") buffer.writeUInt32LE(Number(integer));
  else if (field.type === "u64") buffer.writeBigUInt64LE(integer);
  else if (field.type === "i64") buffer.writeBigInt64LE(integer);
  return buffer;
}

function decodeField(field, buffer, offset) {
  const size = FIXED_TYPE_BYTES[field.type];
  if (!size) fail(`UNSUPPORTED_INSTRUCTION_TYPE_${field.type}`);
  const end = offset + size;
  if (end > buffer.length) fail("TRUNCATED_INSTRUCTION_DATA");
  const slice = buffer.subarray(offset, end);
  let value;
  if (field.type === "bytes32") value = slice.toString("hex");
  else if (field.type === "u16") value = String(slice.readUInt16LE(0));
  else if (field.type === "u32") value = String(slice.readUInt32LE(0));
  else if (field.type === "u64") value = String(slice.readBigUInt64LE(0));
  else if (field.type === "i64") value = String(slice.readBigInt64LE(0));
  return { value, offset: end };
}

export function encodeInstruction(name, data, definition = loadProgramInterface()) {
  const instruction = definition.instructions.find((candidate) => candidate.name === name);
  if (!instruction) fail("UNKNOWN_INSTRUCTION");
  requireExactDataKeys(data, instruction.data);
  const parts = [Buffer.from(instruction.discriminatorHex, "hex")];
  for (const field of instruction.data) parts.push(encodeField(field, data[field.name]));
  return Buffer.concat(parts);
}

export function decodeInstruction(bytes, definition = loadProgramInterface()) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const discriminatorBytes = definition.codec.discriminatorBytes;
  if (buffer.length < discriminatorBytes) fail("TRUNCATED_INSTRUCTION_DISCRIMINATOR");
  const discriminatorHex = buffer.subarray(0, discriminatorBytes).toString("hex");
  const instruction = definition.instructions.find(
    (candidate) => candidate.discriminatorHex === discriminatorHex,
  );
  if (!instruction) fail("UNKNOWN_INSTRUCTION_DISCRIMINATOR");
  let offset = discriminatorBytes;
  const data = {};
  for (const field of instruction.data) {
    const decoded = decodeField(field, buffer, offset);
    data[field.name] = decoded.value;
    offset = decoded.offset;
  }
  if (offset !== buffer.length) fail("TRAILING_INSTRUCTION_DATA");
  return { name: instruction.name, data };
}

export function instructionEncodedLength(name, definition = loadProgramInterface()) {
  const instruction = definition.instructions.find((candidate) => candidate.name === name);
  if (!instruction) fail("UNKNOWN_INSTRUCTION");
  return definition.codec.discriminatorBytes + instruction.data.reduce((total, field) => {
    const size = FIXED_TYPE_BYTES[field.type];
    if (!size) fail(`UNSUPPORTED_INSTRUCTION_TYPE_${field.type}`);
    return total + size;
  }, 0);
}
