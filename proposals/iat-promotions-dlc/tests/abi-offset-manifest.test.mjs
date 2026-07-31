/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  generateAbiOffsetManifest,
  loadAbiOffsetBundle,
} from "../generate-abi-offset-manifest.mjs";
import { validateAbiOffsetManifest } from "../validate-abi-offset-manifest.mjs";

const bundle = loadAbiOffsetBundle();
const clone = (value) => structuredClone(value);

test("the ABI offset manifest is deterministic and client-binding only", () => {
  assert.deepEqual(validateAbiOffsetManifest(bundle), []);
  assert.deepEqual(
    generateAbiOffsetManifest(bundle.preview, bundle.composedVectors),
    bundle.manifest,
  );
  assert.equal(bundle.manifest.status.deployable, false);
  assert.equal(bundle.manifest.status.amendmentApplied, false);
  assert.equal(bundle.manifest.status.compositionApplied, false);
  assert.equal(bundle.manifest.status.clientBindingOnly, true);
});

test("every account field is contiguous after its discriminator and ends at exact account size", () => {
  for (const account of bundle.manifest.accounts) {
    let offset = bundle.manifest.encoding.discriminatorBytes;
    for (const field of account.fields) {
      assert.equal(field.offsetBytes, offset, `${account.name}.${field.name}`);
      assert.equal(field.endOffsetBytes, field.offsetBytes + field.sizeBytes);
      offset = field.endOffsetBytes;
    }
    assert.equal(offset, account.sizeBytes, account.name);
  }
});

test("every instruction field is contiguous and total length matches its public vector", () => {
  assert.equal(bundle.manifest.instructions.length, 13);
  for (const instruction of bundle.manifest.instructions) {
    let offset = bundle.manifest.encoding.discriminatorBytes;
    for (const field of instruction.data) {
      assert.equal(field.offsetBytes, offset, `${instruction.name}.${field.name}`);
      offset = field.endOffsetBytes;
    }
    assert.equal(offset, instruction.encodedLengthBytes, instruction.name);
  }
});

test("account-meta indices and flags preserve the complete composed instruction order", () => {
  for (const instruction of bundle.manifest.instructions) {
    const previewInstruction = bundle.preview.instructions.find(
      (candidate) => candidate.name === instruction.name,
    );
    assert.deepEqual(
      instruction.accountMetas,
      previewInstruction.accounts.map((account, index) => ({
        index,
        name: account.name,
        signer: account.signer === true,
        writable: account.writable === true,
        optional: account.optional === true,
      })),
    );
  }
});

test("language-neutral fixtures cover all ABI scalar and byte field types", () => {
  assert.deepEqual(
    bundle.manifest.scalarFixtures.map((fixture) => fixture.type),
    ["u8", "u16", "u32", "u64", "i64", "bytes32", "pubkey", "bytes"],
  );
  for (const fixture of bundle.manifest.scalarFixtures) {
    assert.equal(fixture.expectedLittleEndianHex.length, fixture.sizeBytes * 2);
    if (!["bytes", "bytes32", "pubkey"].includes(fixture.type)) {
      assert.equal(typeof fixture.value, "string");
    }
  }
});

test("a changed composed preview cannot pass against a stale ABI manifest", () => {
  const mutated = clone(bundle);
  mutated.preview.instructions[0].guards.push("UNREVIEWED_GUARD");
  const errors = validateAbiOffsetManifest(mutated);
  assert.ok(errors.includes("ABI manifest differs from deterministic generation"));
  assert.ok(errors.includes("ABI source preview digest mismatch"));
});

test("account gaps, overlaps, final-size drift, and digest drift are rejected", () => {
  const mutated = clone(bundle);
  const account = mutated.manifest.accounts[0];
  account.fields[1].offsetBytes += 1;
  account.fields[2].endOffsetBytes -= 1;
  account.sizeBytes += 1;
  account.layoutCanonicalSha256 = "00".repeat(32);
  const errors = validateAbiOffsetManifest(mutated);
  assert.ok(errors.includes("ABI manifest differs from deterministic generation"));
  assert.ok(errors.some((error) => error.includes("offset gap or overlap")));
  assert.ok(errors.some((error) => error.includes("end offset mismatch")));
  assert.ok(errors.includes(`${account.name} final size mismatch`));
  assert.ok(errors.includes(`${account.name} layout digest mismatch`));
});

test("instruction data, account-meta order, vector length, and layout digest drift are rejected", () => {
  const mutated = clone(bundle);
  const instruction = mutated.manifest.instructions.find(
    (candidate) => candidate.name === "initialize_campaign",
  );
  instruction.data[0].offsetBytes += 1;
  instruction.accountMetas[0].index = 9;
  instruction.encodedLengthBytes += 1;
  instruction.layoutCanonicalSha256 = "11".repeat(32);
  const errors = validateAbiOffsetManifest(mutated);
  assert.ok(errors.includes("initialize_campaign.campaign_id offset gap or overlap"));
  assert.ok(errors.includes("initialize_campaign account-meta index drift"));
  assert.ok(errors.includes("initialize_campaign ABI/vector length mismatch"));
  assert.ok(errors.includes("initialize_campaign layout digest mismatch"));
});

test("numeric JSON values and changed scalar bytes fail language-neutral fixture validation", () => {
  const numeric = clone(bundle);
  numeric.manifest.scalarFixtures.find((fixture) => fixture.type === "u64").value = 42;
  assert.ok(
    validateAbiOffsetManifest(numeric).some((error) =>
      error.includes("integer fixture must be a decimal string: u64"),
    ),
  );

  const changed = clone(bundle);
  changed.manifest.scalarFixtures.find((fixture) => fixture.type === "i64").expectedLittleEndianHex =
    "ffffffffffffffff";
  assert.ok(validateAbiOffsetManifest(changed).includes("i64 scalar fixture mismatch"));
});

test("deployment claims and released application gates invalidate ABI evidence", () => {
  const mutated = clone(bundle);
  mutated.manifest.status.network = "mainnet-beta";
  mutated.manifest.status.programId = "11111111111111111111111111111111";
  mutated.manifest.status.deployable = true;
  mutated.manifest.status.amendmentApplied = true;
  mutated.manifest.status.compositionApplied = true;
  mutated.manifest.status.clientBindingOnly = false;
  const errors = validateAbiOffsetManifest(mutated);
  assert.ok(errors.includes("ABI manifest must remain network-free"));
  assert.ok(errors.includes("ABI manifest must not claim a program ID"));
  assert.ok(errors.includes("ABI manifest must remain undeployable"));
  assert.ok(errors.includes("ABI manifest must preserve unapplied amendment state"));
  assert.ok(errors.includes("ABI manifest must preserve unapplied composition state"));
  assert.ok(errors.includes("ABI manifest must remain client-binding evidence only"));
});

test("manifest generation refuses a deployable or applied composition preview", () => {
  for (const field of ["deployable", "amendmentApplied", "compositionApplied"]) {
    const mutated = clone(bundle.preview);
    mutated.status[field] = true;
    assert.throws(
      () => generateAbiOffsetManifest(mutated, bundle.composedVectors),
      /ABI manifest requires a held, unapplied composition preview/,
    );
  }
});
