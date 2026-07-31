/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import { generateProgramEventVectors } from "../generate-program-event-vectors.mjs";
import {
  decodeProgramEvent,
  deriveEventDiscriminatorHex,
  encodeProgramEvent,
  eventEncodedLength,
} from "../program-event-codec.mjs";
import {
  loadProgramEventValidationBundle,
  validateProgramEventInterface,
} from "../validate-program-event-interface.mjs";

const bundle = loadProgramEventValidationBundle();
const clone = (value) => structuredClone(value);

test("the event interface and all public vectors pass every HOLD and privacy guard", () => {
  assert.deepEqual(validateProgramEventInterface(bundle), []);
  assert.deepEqual(generateProgramEventVectors(bundle.definition), bundle.vectors);
  assert.equal(bundle.definition.status.network, "NONE");
  assert.equal(bundle.definition.status.programId, null);
  assert.equal(bundle.definition.status.deployable, false);
  assert.equal(bundle.definition.status.eventInterfaceApplied, false);
});

test("all thirteen composed instructions have exact successful-outcome event coverage", () => {
  const triggered = new Set(bundle.definition.events.map((event) => event.trigger.instruction));
  assert.deepEqual(
    [...triggered].sort(),
    bundle.preview.instructions.map((instruction) => instruction.name).sort(),
  );
  assert.equal(bundle.definition.events.length, 14);
  assert.equal(bundle.definition.events.filter((event) => event.trigger.instruction === "settle_pair").length, 2);
});

test("event discriminators are domain-derived and collision-free", () => {
  const discriminators = [];
  for (const event of bundle.definition.events) {
    assert.equal(event.discriminatorHex, deriveEventDiscriminatorHex(event.name, bundle.definition));
    discriminators.push(event.discriminatorHex);
  }
  assert.equal(new Set(discriminators).size, discriminators.length);
});

test("every event vector encodes, decodes, and has one exact fixed length", () => {
  assert.equal(bundle.vectors.vectors.length, bundle.definition.events.length);
  for (const vector of bundle.vectors.vectors) {
    const encoded = encodeProgramEvent(vector.name, vector.data, bundle.definition);
    assert.equal(encoded.toString("hex"), vector.expectedHex, vector.name);
    assert.equal(encoded.length, eventEncodedLength(vector.name, bundle.definition), vector.name);
    assert.deepEqual(decodeProgramEvent(encoded, bundle.definition), {
      name: vector.name,
      data: vector.data,
    });
  }
});

test("event encoding rejects missing, extra, numeric, malformed, and overflowing fields", () => {
  const vector = bundle.vectors.vectors.find((candidate) => candidate.name === "PairSettled");
  const missing = clone(vector.data);
  delete missing.campaign;
  assert.throws(() => encodeProgramEvent(vector.name, missing, bundle.definition), /EVENT_DATA_FIELDS_MISMATCH/);
  assert.throws(
    () => encodeProgramEvent(vector.name, { ...vector.data, extra: "0" }, bundle.definition),
    /EVENT_DATA_FIELDS_MISMATCH/,
  );
  assert.throws(
    () => encodeProgramEvent(vector.name, { ...vector.data, completed_pairs: 7 }, bundle.definition),
    /INVALID_INTEGER_completed_pairs/,
  );
  assert.throws(
    () => encodeProgramEvent(vector.name, { ...vector.data, campaign: "ff" }, bundle.definition),
    /INVALID_PUBKEY_campaign/,
  );
  assert.throws(
    () => encodeProgramEvent(vector.name, { ...vector.data, completed_pairs: "65536" }, bundle.definition),
    /INTEGER_OUT_OF_RANGE_completed_pairs/,
  );
});

test("event decoding rejects unknown discriminators, every truncation, and trailing bytes", () => {
  for (const vector of bundle.vectors.vectors) {
    const bytes = Buffer.from(vector.expectedHex, "hex");
    for (let length = 0; length < bytes.length; length += 1) {
      assert.throws(() => decodeProgramEvent(bytes.subarray(0, length), bundle.definition));
    }
    assert.throws(
      () => decodeProgramEvent(Buffer.concat([bytes, Buffer.from([0])]), bundle.definition),
      /TRAILING_EVENT_DATA/,
    );
  }
  assert.throws(() => decodeProgramEvent(Buffer.alloc(8, 0xff), bundle.definition), /UNKNOWN_EVENT_DISCRIMINATOR/);
});

test("identity events expose commitments and public wallets but no raw X identity or handle", () => {
  const identityEvents = bundle.definition.events.filter((event) =>
    ["HeroNominated", "PairSettled"].includes(event.name),
  );
  for (const event of identityEvents) {
    const names = event.fields.map((field) => field.name);
    assert.equal(names.some((name) => /x_user_id|x_handle|oauth/i.test(name)), false);
    for (const name of names.filter((fieldName) => fieldName.includes("_x_identity_"))) {
      assert.equal(name.endsWith("_commitment"), true);
    }
  }
  assert.equal(bundle.definition.auditRules.identityCommitmentsOnly, true);
});

test("PairSettled publishes both destinations, all identity bindings, exact rewards, and committed counters", () => {
  const event = bundle.definition.events.find((candidate) => candidate.name === "PairSettled");
  for (const field of [
    "settlement_receipt",
    "hero_wallet",
    "proposer_wallet",
    "hero_node_commitment",
    "proposer_node_commitment",
    "hero_x_identity_commitment",
    "proposer_x_identity_commitment",
    "hero_reward_base_units",
    "proposer_reward_base_units",
    "completed_pairs",
    "vault_balance_base_units",
  ]) {
    assert.equal(event.fields.some((candidate) => candidate.name === field), true, field);
  }
  assert.ok(event.semanticGuards.includes("HERO_REWARD_EQUALS_120000000000"));
  assert.ok(event.semanticGuards.includes("PROPOSER_REWARD_EQUALS_60000000000"));
  assert.ok(event.semanticGuards.includes("EVENT_EMITTED_AFTER_BOTH_TRANSFERS_SUCCEED"));
});

test("exhaustion is one terminal event and invalidates pending nominations without impossible bulk writes", () => {
  const event = bundle.definition.events.find((candidate) => candidate.name === "CampaignExhausted");
  assert.equal(event.trigger.cardinality, "ONCE_WHEN_COMPLETED_PAIRS_REACH_1000");
  assert.ok(event.semanticGuards.includes("COMPLETED_PAIRS_EQUALS_1000"));
  assert.ok(event.semanticGuards.includes("TOTAL_PAID_EQUALS_180000000000000"));
  assert.ok(
    event.semanticGuards.includes(
      "PENDING_NOMINATIONS_INVALIDATED_BY_CAMPAIGN_STATUS_WITHOUT_BULK_WRITES",
    ),
  );
  assert.equal(bundle.definition.auditRules.exhaustionInvalidatesPendingWithoutBulkAccountMutation, true);
});

test("all verifier events publish previous/new hash heads and bind the registry", () => {
  for (const event of bundle.definition.events.filter((candidate) => candidate.name.startsWith("Verifier"))) {
    const fields = new Set(event.fields.map((field) => field.name));
    for (const field of ["verifier_registry", "occurred_at", "previous_event_hash", "event_hash"]) {
      assert.equal(fields.has(field), true, `${event.name}.${field}`);
    }
    assert.ok(event.semanticGuards.includes("EVENT_HASH_EQUALS_REGISTRY_LAST_EVENT_HASH"));
  }
});

test("deployment, source, audit-rule, privacy-field, and economic-guard mutations fail validation", () => {
  const mutated = clone(bundle);
  mutated.definition.status.network = "mainnet-beta";
  mutated.definition.status.programId = "11111111111111111111111111111111";
  mutated.definition.status.deployable = true;
  mutated.definition.status.eventInterfaceApplied = true;
  mutated.definition.sourcePreview.canonicalSha256 = "00".repeat(32);
  mutated.definition.auditRules.failedInstructionEmitsNothing = false;
  mutated.definition.events.find((event) => event.name === "HeroNominated").fields.push({
    name: "raw_x_user_id",
    type: "bytes32",
  });
  mutated.definition.events.find((event) => event.name === "PairSettled").semanticGuards = [];
  const errors = validateProgramEventInterface(mutated);
  assert.ok(errors.includes("event interface must remain network-free"));
  assert.ok(errors.includes("event interface must not claim a program ID"));
  assert.ok(errors.includes("event interface must remain undeployable"));
  assert.ok(errors.includes("event interface must remain unapplied"));
  assert.ok(errors.includes("event source preview digest mismatch"));
  assert.ok(errors.includes("event audit rule missing: failedInstructionEmitsNothing"));
  assert.ok(errors.includes("HeroNominated private field leak"));
  assert.ok(errors.includes("PairSettled guard missing: HERO_REWARD_EQUALS_120000000000"));
});

test("stale vector bytes and event schema drift cannot pass deterministic generation", () => {
  const stale = clone(bundle);
  stale.vectors.vectors[0].expectedHex += "00";
  const staleErrors = validateProgramEventInterface(stale);
  assert.ok(staleErrors.includes("event vectors differ from deterministic generation"));
  assert.ok(staleErrors.includes("CampaignInitialized vector bytes drift"));
  assert.ok(staleErrors.includes("CampaignInitialized vector length drift"));

  const drift = clone(bundle);
  drift.definition.events[0].fields[1].type = "bytes32";
  assert.ok(validateProgramEventInterface(drift).includes("event vectors differ from deterministic generation"));
});
