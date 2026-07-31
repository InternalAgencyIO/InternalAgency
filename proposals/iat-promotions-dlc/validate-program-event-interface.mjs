/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateProgramEventVectors, loadProgramEventBundle } from "./generate-program-event-vectors.mjs";
import {
  decodeProgramEvent,
  deriveEventDiscriminatorHex,
  encodeProgramEvent,
  eventEncodedLength,
} from "./program-event-codec.mjs";

const PREVIEW_PATH = fileURLToPath(
  new URL("./program-interface-composition-preview.v1.json", import.meta.url),
);
const STATUS_LABELS = [
  "DRAFT",
  "INACTIVE",
  "NOT PART OF GENESIS",
  "NOT DEPLOYED",
  "NO CLAIM ROUTE",
];
const EVENT_NAMES = [
  "CampaignInitialized",
  "CampaignFunded",
  "CampaignActivated",
  "CampaignCancelledPreActivation",
  "HeroNominated",
  "NominationCancelled",
  "PairSettled",
  "CampaignExhausted",
  "ExhaustedSurplusFinalized",
  "VerifierRegistryInitialized",
  "VerifierKeyRotationScheduled",
  "VerifierKeyRotationActivated",
  "VerifierKeyRetirementFinalized",
  "VerifierRegistryEmergencyDisabled",
];
const FORBIDDEN_FIELD_PATTERN = /(raw_x|x_user_id|x_handle|oauth|private|secret|mnemonic|seed_phrase)/i;
const TYPE_BYTES = Object.freeze({ u8: 1, u16: 2, u32: 4, u64: 8, i64: 8, pubkey: 32, bytes32: 32 });

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireFields(event, names, errors) {
  const actual = new Set(event?.fields?.map((field) => field.name) ?? []);
  for (const name of names) if (!actual.has(name)) errors.push(`${event?.name} field missing: ${name}`);
}

function requireGuards(event, guards, errors) {
  for (const guard of guards) {
    if (!event?.semanticGuards?.includes(guard)) errors.push(`${event?.name} guard missing: ${guard}`);
  }
}

export function loadProgramEventValidationBundle() {
  return {
    ...loadProgramEventBundle(),
    preview: JSON.parse(readFileSync(PREVIEW_PATH, "utf8")),
  };
}

export function validateProgramEventInterface(bundle) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const definition = bundle.definition;
  expect(definition?.eventInterfaceVersion === 1, "event interface version mismatch");
  expect(definition?.eventInterfaceId === "iat-promotions-dlc-events-v1", "event interface ID mismatch");
  const status = definition?.status ?? {};
  expect(jsonEqual(status.labels, STATUS_LABELS), "event public status labels mismatch");
  expect(status.network === "NONE", "event interface must remain network-free");
  expect(status.programId === null, "event interface must not claim a program ID");
  expect(status.deployable === false, "event interface must remain undeployable");
  expect(status.compositionApplied === false, "event interface must preserve unapplied composition state");
  expect(status.eventInterfaceApplied === false, "event interface must remain unapplied");
  expect(
    definition?.sourcePreview?.canonicalSha256 === canonicalSha256(bundle.preview),
    "event source preview digest mismatch",
  );
  expect(definition?.codec?.discriminatorBytes === 8, "event discriminator size mismatch");
  expect(definition?.codec?.integerEndian === "little", "event endian mismatch");
  expect(definition?.codec?.variableLengthFields === false, "event fields must remain fixed-width");
  expect(
    definition?.codec?.integerJsonRepresentation === "decimal-string",
    "event integer JSON representation mismatch",
  );

  const rules = definition?.auditRules ?? {};
  for (const rule of [
    "emitOnlyAfterSuccessfulInstruction",
    "failedInstructionEmitsNothing",
    "eventRollsBackWithTransaction",
    "accountsAndReceiptsRemainAuthoritative",
    "eventsCannotAuthorizeStateChange",
    "rawXUserIdForbidden",
    "mutableXHandleForbidden",
    "identityCommitmentsOnly",
    "exhaustionInvalidatesPendingWithoutBulkAccountMutation",
    "verifierEventsAdvanceRegistryHashChain",
  ]) {
    expect(rules[rule] === true, `event audit rule missing: ${rule}`);
  }

  const names = definition?.events?.map((event) => event.name) ?? [];
  expect(jsonEqual(names, EVENT_NAMES), "event set or order mismatch");
  expect(new Set(names).size === names.length, "duplicate event name");
  const discriminators = new Set();
  const instructionNames = new Set(bundle.preview.instructions.map((instruction) => instruction.name));
  for (const event of definition?.events ?? []) {
    expect(
      event.discriminatorHex === deriveEventDiscriminatorHex(event.name, definition),
      `${event.name} discriminator mismatch`,
    );
    expect(!discriminators.has(event.discriminatorHex), `${event.name} discriminator collision`);
    discriminators.add(event.discriminatorHex);
    expect(instructionNames.has(event?.trigger?.instruction), `${event.name} trigger instruction missing`);
    expect(typeof event?.trigger?.cardinality === "string", `${event.name} trigger cardinality missing`);
    const fieldNames = event.fields.map((field) => field.name);
    expect(new Set(fieldNames).size === fieldNames.length, `${event.name} duplicate field`);
    expect(
      event.fields[0]?.name === "version" && event.fields[0]?.type === "u8",
      `${event.name} version prefix missing`,
    );
    expect(fieldNames.every((name) => !FORBIDDEN_FIELD_PATTERN.test(name)), `${event.name} private field leak`);
    for (const field of event.fields) {
      expect(Boolean(TYPE_BYTES[field.type]), `${event.name}.${field.name} unsupported fixed type`);
      if (field.name.includes("_x_identity_")) {
        expect(field.name.endsWith("_commitment"), `${event.name}.${field.name} exposes X identity`);
      }
    }
    try {
      expect(eventEncodedLength(event.name, definition) > 8, `${event.name} encoded length invalid`);
    } catch (error) {
      errors.push(`${event.name} codec failure: ${error.message}`);
    }
  }

  const event = (name) => definition.events.find((candidate) => candidate.name === name);
  requireFields(event("PairSettled"), [
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
  ], errors);
  requireGuards(event("PairSettled"), [
    "HERO_REWARD_EQUALS_120000000000",
    "PROPOSER_REWARD_EQUALS_60000000000",
    "RECEIPT_AND_COUNTER_ALREADY_COMMITTED",
    "EVENT_EMITTED_AFTER_BOTH_TRANSFERS_SUCCEED",
  ], errors);
  requireGuards(event("CampaignExhausted"), [
    "COMPLETED_PAIRS_EQUALS_1000",
    "TOTAL_PAID_EQUALS_180000000000000",
    "CAMPAIGN_STATUS_IS_TERMINAL_EXHAUSTED",
    "PENDING_NOMINATIONS_INVALIDATED_BY_CAMPAIGN_STATUS_WITHOUT_BULK_WRITES",
  ], errors);
  expect(
    event("CampaignExhausted")?.trigger?.cardinality === "ONCE_WHEN_COMPLETED_PAIRS_REACH_1000",
    "exhaustion event cardinality mismatch",
  );
  const verifierEvents = definition.events.filter((candidate) => candidate.name.startsWith("Verifier"));
  for (const verifierEvent of verifierEvents) {
    requireFields(verifierEvent, ["verifier_registry", "occurred_at", "previous_event_hash", "event_hash"], errors);
    requireGuards(verifierEvent, ["EVENT_HASH_EQUALS_REGISTRY_LAST_EVENT_HASH"], errors);
  }

  let expectedVectors;
  try {
    expectedVectors = generateProgramEventVectors(definition);
  } catch (error) {
    errors.push(`event vector generation failed: ${error.message}`);
  }
  if (expectedVectors) {
    expect(jsonEqual(bundle.vectors, expectedVectors), "event vectors differ from deterministic generation");
  }
  const vectorMap = new Map((bundle.vectors?.vectors ?? []).map((vector) => [vector.name, vector]));
  expect(vectorMap.size === EVENT_NAMES.length, "event vector count mismatch");
  for (const name of EVENT_NAMES) {
    const vector = vectorMap.get(name);
    expect(Boolean(vector), `${name} vector missing`);
    if (!vector) continue;
    try {
      const encoded = encodeProgramEvent(name, vector.data, definition);
      expect(encoded.toString("hex") === vector.expectedHex, `${name} vector bytes drift`);
      expect(
        vector.expectedHex.length / 2 === eventEncodedLength(name, definition),
        `${name} vector length drift`,
      );
      expect(encoded.length === eventEncodedLength(name, definition), `${name} vector length drift`);
      expect(
        jsonEqual(decodeProgramEvent(encoded, definition), { name, data: vector.data }),
        `${name} vector round-trip drift`,
      );
    } catch (error) {
      errors.push(`${name} vector codec failure: ${error.message}`);
    }
  }

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateProgramEventInterface(loadProgramEventValidationBundle());
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Program event layouts and vectors are fixed, private-safe, and remain unapplied.");
  }
}
