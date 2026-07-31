/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  decodeInstruction,
  deriveDiscriminatorHex,
  encodeInstruction,
  instructionEncodedLength,
  loadProgramInterface,
} from "../program-interface-codec.mjs";
import { validateProgramInterface } from "../validate-program-interface.mjs";

const interfaceDefinition = loadProgramInterface();
const vectorDefinition = JSON.parse(
  readFileSync(new URL("../program-interface-vectors.v0.json", import.meta.url), "utf8"),
);

function clone(value) {
  return structuredClone(value);
}

test("the undeployed interface passes every structural and isolation guard", () => {
  assert.deepEqual(validateProgramInterface(interfaceDefinition), []);
  assert.equal(interfaceDefinition.status.network, "NONE");
  assert.equal(interfaceDefinition.status.programId, null);
  assert.equal(interfaceDefinition.vaultBoundary.externalV2AccountsWritable, false);
  assert.equal(interfaceDefinition.vaultBoundary.activeWithdrawal, false);
});

test("all account and instruction discriminators are deterministic and unique", () => {
  const all = [];
  for (const account of interfaceDefinition.accounts) {
    assert.equal(
      account.discriminatorHex,
      deriveDiscriminatorHex("account", account.name, interfaceDefinition),
    );
    all.push(account.discriminatorHex);
  }
  for (const instruction of interfaceDefinition.instructions) {
    assert.equal(
      instruction.discriminatorHex,
      deriveDiscriminatorHex("instruction", instruction.name, interfaceDefinition),
    );
    all.push(instruction.discriminatorHex);
  }
  assert.equal(new Set(all).size, all.length);
});

test("published vectors encode byte-for-byte and decode without ambiguity", () => {
  assert.deepEqual(vectorDefinition.status.labels, interfaceDefinition.status.labels);
  assert.equal(vectorDefinition.status.network, "NONE");
  assert.equal(vectorDefinition.status.programId, null);
  assert.equal(vectorDefinition.vectors.length, interfaceDefinition.instructions.length);

  for (const vector of vectorDefinition.vectors) {
    const encoded = encodeInstruction(vector.name, vector.data, interfaceDefinition);
    assert.equal(encoded.toString("hex"), vector.expectedHex, vector.name);
    assert.equal(encoded.length, instructionEncodedLength(vector.name, interfaceDefinition));
    assert.deepEqual(decodeInstruction(encoded, interfaceDefinition), {
      name: vector.name,
      data: vector.data,
    });
  }
});

test("the encoder rejects missing, extra, malformed, unsafe, and overflowing fields", () => {
  const fund = vectorDefinition.vectors.find((vector) => vector.name === "fund_campaign");
  const initialize = vectorDefinition.vectors.find(
    (vector) => vector.name === "initialize_campaign",
  );

  assert.throws(() => encodeInstruction("unknown", {}), /UNKNOWN_INSTRUCTION/);
  assert.throws(() => encodeInstruction("fund_campaign", {}), /INSTRUCTION_DATA_FIELDS_MISMATCH/);
  assert.throws(
    () => encodeInstruction("fund_campaign", { ...fund.data, extra: "0" }),
    /INSTRUCTION_DATA_FIELDS_MISMATCH/,
  );
  assert.throws(
    () => encodeInstruction("fund_campaign", { amount_base_units: "-1" }),
    /INTEGER_OUT_OF_RANGE_amount_base_units/,
  );
  assert.throws(
    () => encodeInstruction("fund_campaign", { amount_base_units: "18446744073709551616" }),
    /INTEGER_OUT_OF_RANGE_amount_base_units/,
  );
  assert.throws(
    () => encodeInstruction("fund_campaign", { amount_base_units: Number.MAX_SAFE_INTEGER + 1 }),
    /INVALID_INTEGER_amount_base_units/,
  );
  assert.throws(
    () => encodeInstruction("initialize_campaign", {
      ...initialize.data,
      campaign_id: "not-a-32-byte-lowercase-hex-value",
    }),
    /INVALID_BYTES32_campaign_id/,
  );
  assert.throws(
    () => encodeInstruction("initialize_campaign", {
      ...initialize.data,
      maximum_completed_pairs: "65536",
    }),
    /INTEGER_OUT_OF_RANGE_maximum_completed_pairs/,
  );
});

test("the decoder rejects unknown, truncated, and trailing instruction bytes", () => {
  const settlement = vectorDefinition.vectors.find((vector) => vector.name === "settle_pair");
  const encoded = Buffer.from(settlement.expectedHex, "hex");

  assert.throws(() => decodeInstruction(encoded.subarray(0, 7)), /TRUNCATED_INSTRUCTION_DISCRIMINATOR/);
  assert.throws(() => decodeInstruction(Buffer.alloc(8, 0xff)), /UNKNOWN_INSTRUCTION_DISCRIMINATOR/);
  assert.throws(() => decodeInstruction(encoded.subarray(0, -1)), /TRUNCATED_INSTRUCTION_DATA/);
  assert.throws(() => decodeInstruction(Buffer.concat([encoded, Buffer.from([0])])), /TRAILING_INSTRUCTION_DATA/);
});

test("network or deployment claims invalidate the interface", () => {
  const deployed = clone(interfaceDefinition);
  deployed.status.network = "mainnet-beta";
  deployed.status.programId = "11111111111111111111111111111111";
  const errors = validateProgramInterface(deployed);

  assert.ok(errors.includes("interface must remain network-free"));
  assert.ok(errors.includes("interface must not claim a program ID"));
});

test("layout and forbidden-account mutations invalidate the interface", () => {
  const mutated = clone(interfaceDefinition);
  mutated.accounts[0].sizeBytes += 1;
  mutated.accounts[1].discriminatorHex = "0000000000000000";
  mutated.instructions.find((instruction) => instruction.name === "settle_pair").accounts.push({
    name: "treasury_source",
    writable: true,
    signer: false,
  });
  const errors = validateProgramInterface(mutated);

  assert.ok(errors.includes("Campaign size mismatch"));
  assert.ok(errors.includes("Nomination discriminator mismatch"));
  assert.ok(errors.includes("settle_pair names a forbidden V2 capability account"));
});

test("economic, vault, atomicity, and terminal guard mutations invalidate the interface", () => {
  const mutated = clone(interfaceDefinition);
  mutated.economics.maximumBudgetBaseUnits = "180000000000001";
  mutated.vaultBoundary.activeWithdrawal = true;
  mutated.vaultBoundary.externalV2AccountsWritable = true;
  const settle = mutated.instructions.find((instruction) => instruction.name === "settle_pair");
  settle.guards = settle.guards.filter(
    (guard) => ![
      "HERO_AND_PROPOSER_TRANSFERS_ATOMIC",
      "ALL_SIX_ROLE_MARKERS_ABSENT",
      "PAIR_1000_EXPIRES_ALL_REMAINING_NOMINATIONS",
    ].includes(guard),
  );
  const errors = validateProgramInterface(mutated);

  assert.ok(errors.includes("budget mismatch"));
  assert.ok(errors.includes("active withdrawal must remain impossible"));
  assert.ok(errors.includes("external V2 accounts must never be writable"));
  assert.ok(errors.includes("atomic transfer guard missing"));
  assert.ok(errors.includes("six-marker guard missing"));
  assert.ok(errors.includes("terminal expiry guard missing"));
});
