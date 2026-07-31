/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  generateAbiOffsetManifest,
  loadAbiOffsetBundle,
} from "./generate-abi-offset-manifest.mjs";

const STATUS_LABELS = [
  "DRAFT",
  "INACTIVE",
  "NOT PART OF GENESIS",
  "NOT DEPLOYED",
  "NO CLAIM ROUTE",
];

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function encodeFixture(fixture) {
  if (["bytes", "bytes32", "pubkey"].includes(fixture.type)) {
    if (
      typeof fixture.value !== "string" ||
      !/^[0-9a-f]+$/.test(fixture.value) ||
      fixture.value.length !== fixture.sizeBytes * 2
    ) {
      throw new Error(`invalid ${fixture.type} fixture`);
    }
    return Buffer.from(fixture.value, "hex");
  }
  if (typeof fixture.value !== "string" || !/^-?[0-9]+$/.test(fixture.value)) {
    throw new Error(`integer fixture must be a decimal string: ${fixture.type}`);
  }
  const value = BigInt(fixture.value);
  const buffer = Buffer.alloc(fixture.sizeBytes);
  if (fixture.type === "u8") buffer.writeUInt8(Number(value));
  else if (fixture.type === "u16") buffer.writeUInt16LE(Number(value));
  else if (fixture.type === "u32") buffer.writeUInt32LE(Number(value));
  else if (fixture.type === "u64") buffer.writeBigUInt64LE(value);
  else if (fixture.type === "i64") buffer.writeBigInt64LE(value);
  else throw new Error(`unsupported scalar fixture: ${fixture.type}`);
  return buffer;
}

function validateContiguousLayout(entry, fields, initialOffset, finalSize, errors, label) {
  let expectedOffset = initialOffset;
  for (const field of fields) {
    if (field.offsetBytes !== expectedOffset) errors.push(`${label}.${field.name} offset gap or overlap`);
    if (field.endOffsetBytes !== field.offsetBytes + field.sizeBytes) {
      errors.push(`${label}.${field.name} end offset mismatch`);
    }
    if (!Number.isInteger(field.sizeBytes) || field.sizeBytes <= 0) {
      errors.push(`${label}.${field.name} invalid field size`);
    }
    expectedOffset = field.endOffsetBytes;
  }
  if (expectedOffset !== finalSize) errors.push(`${label} final size mismatch`);
}

export function validateAbiOffsetManifest(bundle) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };

  let expected;
  try {
    expected = generateAbiOffsetManifest(bundle.preview, bundle.composedVectors);
  } catch (error) {
    errors.push(`ABI generation failed: ${error.message}`);
    return errors;
  }
  expect(jsonEqual(bundle.manifest, expected), "ABI manifest differs from deterministic generation");

  const status = bundle.manifest?.status ?? {};
  expect(jsonEqual(status.labels, STATUS_LABELS), "ABI public status labels mismatch");
  expect(status.network === "NONE", "ABI manifest must remain network-free");
  expect(status.programId === null, "ABI manifest must not claim a program ID");
  expect(status.deployable === false, "ABI manifest must remain undeployable");
  expect(status.amendmentApplied === false, "ABI manifest must preserve unapplied amendment state");
  expect(status.compositionApplied === false, "ABI manifest must preserve unapplied composition state");
  expect(status.clientBindingOnly === true, "ABI manifest must remain client-binding evidence only");
  expect(
    bundle.manifest?.sourcePreview?.canonicalSha256 === canonicalSha256(bundle.preview),
    "ABI source preview digest mismatch",
  );
  expect(
    bundle.manifest?.sourceVectors?.canonicalSha256 === canonicalSha256(bundle.composedVectors),
    "ABI source vector digest mismatch",
  );
  expect(bundle.manifest?.encoding?.integerEndian === "little", "ABI integer endian mismatch");
  expect(bundle.manifest?.encoding?.fixedWidth === true, "ABI fixed-width gate missing");
  expect(
    bundle.manifest?.encoding?.variableLengthFields === false,
    "ABI variable-length fields must remain disabled",
  );
  expect(
    bundle.manifest?.encoding?.integerJsonRepresentation === "decimal-string",
    "ABI integer JSON representation mismatch",
  );

  const discriminatorBytes = bundle.manifest?.encoding?.discriminatorBytes;
  for (const account of bundle.manifest?.accounts ?? []) {
    expect(account.discriminator.offsetBytes === 0, `${account.name} discriminator offset mismatch`);
    expect(
      account.discriminator.endOffsetBytes === discriminatorBytes,
      `${account.name} discriminator end mismatch`,
    );
    validateContiguousLayout(
      account,
      account.fields,
      discriminatorBytes,
      account.sizeBytes,
      errors,
      account.name,
    );
    const withoutDigest = { ...account };
    delete withoutDigest.layoutCanonicalSha256;
    expect(
      account.layoutCanonicalSha256 === canonicalSha256(withoutDigest),
      `${account.name} layout digest mismatch`,
    );
  }

  const vectorMap = new Map(
    bundle.composedVectors.vectors.map((vector) => [vector.name, vector]),
  );
  expect(
    bundle.manifest?.instructions?.length === vectorMap.size,
    "ABI instruction/vector count mismatch",
  );
  for (const instruction of bundle.manifest?.instructions ?? []) {
    expect(instruction.discriminator.offsetBytes === 0, `${instruction.name} discriminator offset mismatch`);
    validateContiguousLayout(
      instruction,
      instruction.data,
      discriminatorBytes,
      instruction.encodedLengthBytes,
      errors,
      instruction.name,
    );
    for (const [index, account] of instruction.accountMetas.entries()) {
      expect(account.index === index, `${instruction.name} account-meta index drift`);
      expect(typeof account.signer === "boolean", `${instruction.name}.${account.name} signer flag invalid`);
      expect(
        typeof account.writable === "boolean",
        `${instruction.name}.${account.name} writable flag invalid`,
      );
      expect(typeof account.optional === "boolean", `${instruction.name}.${account.name} optional flag invalid`);
    }
    const vector = vectorMap.get(instruction.name);
    expect(Boolean(vector), `${instruction.name} ABI vector missing`);
    expect(
      vector?.expectedHex.length / 2 === instruction.encodedLengthBytes,
      `${instruction.name} ABI/vector length mismatch`,
    );
    const withoutDigest = { ...instruction };
    delete withoutDigest.layoutCanonicalSha256;
    expect(
      instruction.layoutCanonicalSha256 === canonicalSha256(withoutDigest),
      `${instruction.name} layout digest mismatch`,
    );
  }

  for (const fixture of bundle.manifest?.scalarFixtures ?? []) {
    try {
      const encoded = encodeFixture(fixture).toString("hex");
      expect(encoded === fixture.expectedLittleEndianHex, `${fixture.type} scalar fixture mismatch`);
      expect(encoded.length === fixture.sizeBytes * 2, `${fixture.type} scalar fixture size mismatch`);
    } catch (error) {
      errors.push(`scalar fixture failure: ${error.message}`);
    }
  }

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateAbiOffsetManifest(loadAbiOffsetBundle());
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("ABI offsets and cross-language fixtures match the held composed preview.");
  }
}
