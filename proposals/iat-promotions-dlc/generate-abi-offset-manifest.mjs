/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Generates a language-neutral ABI offset manifest from the held composed
 * interface preview. It has no network, wallet, signing, transaction, or
 * deployment capability.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";

const PREVIEW_PATH = fileURLToPath(
  new URL("./program-interface-composition-preview.v1.json", import.meta.url),
);
const MANIFEST_PATH = fileURLToPath(
  new URL("./program-interface-abi-offsets.v1.json", import.meta.url),
);
const COMPOSED_VECTORS_PATH = fileURLToPath(
  new URL("./program-interface-composition-vectors.v1.json", import.meta.url),
);

const STATUS_LABELS = [
  "DRAFT",
  "INACTIVE",
  "NOT PART OF GENESIS",
  "NOT DEPLOYED",
  "NO CLAIM ROUTE",
];

const TYPE_SIZES = Object.freeze({
  u8: 1,
  u16: 2,
  u32: 4,
  u64: 8,
  i64: 8,
  pubkey: 32,
  bytes32: 32,
});

const SCALAR_FIXTURES = Object.freeze([
  { type: "u8", value: "165", sizeBytes: 1, expectedLittleEndianHex: "a5" },
  { type: "u16", value: "4660", sizeBytes: 2, expectedLittleEndianHex: "3412" },
  {
    type: "u32",
    value: "305419896",
    sizeBytes: 4,
    expectedLittleEndianHex: "78563412",
  },
  {
    type: "u64",
    value: "72623859790382856",
    sizeBytes: 8,
    expectedLittleEndianHex: "0807060504030201",
  },
  {
    type: "i64",
    value: "-2",
    sizeBytes: 8,
    expectedLittleEndianHex: "feffffffffffffff",
  },
  {
    type: "bytes32",
    value: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    sizeBytes: 32,
    expectedLittleEndianHex:
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  },
  {
    type: "pubkey",
    value: "fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0efeeedecebeae9e8e7e6e5e4e3e2e1e0",
    sizeBytes: 32,
    expectedLittleEndianHex:
      "fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0efeeedecebeae9e8e7e6e5e4e3e2e1e0",
  },
  { type: "bytes", value: "a1b2c3d4", sizeBytes: 4, expectedLittleEndianHex: "a1b2c3d4" },
]);

function fieldSize(field) {
  const fixedSize = TYPE_SIZES[field.type];
  if (field.type !== "bytes" && fixedSize === undefined) {
    throw new Error(`unsupported ABI field type: ${field.type}`);
  }
  const sizeBytes = field.type === "bytes" ? field.sizeBytes : fixedSize;
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error(`invalid ABI field size: ${field.name}`);
  }
  if (field.sizeBytes !== undefined && field.sizeBytes !== sizeBytes) {
    throw new Error(`declared ABI field size mismatch: ${field.name}`);
  }
  return sizeBytes;
}

function layoutFields(fields, initialOffset) {
  let offsetBytes = initialOffset;
  return fields.map((field) => {
    const sizeBytes = fieldSize(field);
    const entry = {
      name: field.name,
      type: field.type,
      offsetBytes,
      sizeBytes,
      endOffsetBytes: offsetBytes + sizeBytes,
    };
    offsetBytes = entry.endOffsetBytes;
    return entry;
  });
}

function accountLayout(account, discriminatorBytes) {
  const fields = layoutFields(account.fields, discriminatorBytes);
  const result = {
    name: account.name,
    compositionSource: account.compositionSource,
    codecDomain: account.codecDomain,
    discriminatorHex: account.discriminatorHex,
    sizeBytes: account.sizeBytes,
    discriminator: {
      offsetBytes: 0,
      sizeBytes: discriminatorBytes,
      endOffsetBytes: discriminatorBytes,
    },
    fields,
  };
  return {
    ...result,
    layoutCanonicalSha256: canonicalSha256(result),
  };
}

function instructionLayout(instruction, discriminatorBytes) {
  const data = layoutFields(instruction.data, discriminatorBytes);
  const encodedLengthBytes = data.at(-1)?.endOffsetBytes ?? discriminatorBytes;
  const result = {
    name: instruction.name,
    compositionSource: instruction.compositionSource,
    codecDomain: instruction.codecDomain,
    discriminatorHex: instruction.discriminatorHex,
    encodedLengthBytes,
    discriminator: {
      offsetBytes: 0,
      sizeBytes: discriminatorBytes,
      endOffsetBytes: discriminatorBytes,
    },
    data,
    accountMetas: instruction.accounts.map((account, index) => ({
      index,
      name: account.name,
      signer: account.signer === true,
      writable: account.writable === true,
      optional: account.optional === true,
    })),
  };
  return {
    ...result,
    layoutCanonicalSha256: canonicalSha256(result),
  };
}

export function generateAbiOffsetManifest(preview, composedVectors) {
  if (
    preview?.status?.deployable !== false ||
    preview?.status?.amendmentApplied !== false ||
    preview?.status?.compositionApplied !== false
  ) {
    throw new Error("ABI manifest requires a held, unapplied composition preview");
  }
  const discriminatorBytes = preview.codec.discriminatorBytes;
  return {
    manifestVersion: 1,
    manifestId: "iat-promotions-dlc-composed-abi-offsets-v1",
    status: {
      labels: STATUS_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      amendmentApplied: false,
      compositionApplied: false,
      clientBindingOnly: true,
    },
    sourcePreview: {
      path: "program-interface-composition-preview.v1.json",
      canonicalSha256: canonicalSha256(preview),
    },
    sourceVectors: {
      path: "program-interface-composition-vectors.v1.json",
      canonicalSha256: canonicalSha256(composedVectors),
    },
    encoding: {
      discriminatorBytes,
      integerEndian: "little",
      fixedWidth: true,
      variableLengthFields: false,
      integerJsonRepresentation: "decimal-string",
      byteStringRepresentation: "lowercase-hex",
    },
    scalarFixtures: SCALAR_FIXTURES.map((fixture) => ({ ...fixture })),
    accounts: preview.accounts.map((account) => accountLayout(account, discriminatorBytes)),
    instructions: preview.instructions.map((instruction) =>
      instructionLayout(instruction, discriminatorBytes),
    ),
  };
}

export function loadAbiOffsetBundle() {
  const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
  return {
    preview: parse(PREVIEW_PATH),
    composedVectors: parse(COMPOSED_VECTORS_PATH),
    manifest: parse(MANIFEST_PATH),
  };
}

export function renderAbiOffsetManifest(preview, composedVectors) {
  return `${JSON.stringify(generateAbiOffsetManifest(preview, composedVectors), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const preview = JSON.parse(readFileSync(PREVIEW_PATH, "utf8"));
  const composedVectors = JSON.parse(readFileSync(COMPOSED_VECTORS_PATH, "utf8"));
  const rendered = renderAbiOffsetManifest(preview, composedVectors);
  if (process.argv.includes("--write")) {
    writeFileSync(MANIFEST_PATH, rendered, "utf8");
    console.log("Wrote deterministic ABI offset manifest; no network or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}
