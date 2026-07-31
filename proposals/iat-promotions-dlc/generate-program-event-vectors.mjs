/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { encodeProgramEvent } from "./program-event-codec.mjs";

const INTERFACE_PATH = fileURLToPath(new URL("./program-event-interface.v1.json", import.meta.url));
const VECTORS_PATH = fileURLToPath(new URL("./program-event-vectors.v1.json", import.meta.url));

function hashFixture(domain) {
  return createHash("sha256").update(domain).digest("hex");
}

function integerFixture(eventName, fieldName, eventIndex, fieldIndex) {
  const fixed = {
    version: "1",
    maximum_budget_base_units: "180000000000000",
    maximum_completed_pairs: "1000",
    hero_reward_base_units: "120000000000",
    proposer_reward_base_units: "60000000000",
    completed_pairs: eventName === "CampaignExhausted" ? "1000" : "7",
    total_paid_base_units: "180000000000000",
    reason: "1",
    sequence: "7",
  };
  if (fixed[fieldName]) return fixed[fieldName];
  if (fieldName.endsWith("_at") || fieldName.endsWith("_timestamp")) {
    return String(1_800_000_000 + eventIndex * 100 + fieldIndex);
  }
  return String(1_000_000_000 + eventIndex * 100 + fieldIndex);
}

function fixtureData(event, eventIndex) {
  return Object.fromEntries(event.fields.map((field, fieldIndex) => {
    let value;
    if (field.type === "pubkey" || field.type === "bytes32") {
      value = hashFixture(`${field.type}:${event.name}:${field.name}`);
    } else {
      value = integerFixture(event.name, field.name, eventIndex, fieldIndex);
    }
    return [field.name, value];
  }));
}

export function generateProgramEventVectors(definition) {
  if (
    definition?.status?.deployable !== false ||
    definition?.status?.compositionApplied !== false ||
    definition?.status?.eventInterfaceApplied !== false
  ) {
    throw new Error("event vectors require a held, unapplied event interface");
  }
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-event-vectors-v1",
    status: { ...definition.status },
    sourceInterface: {
      path: "program-event-interface.v1.json",
      canonicalSha256: canonicalSha256(definition),
    },
    vectors: definition.events.map((event, eventIndex) => {
      const data = fixtureData(event, eventIndex);
      return {
        name: event.name,
        data,
        expectedHex: encodeProgramEvent(event.name, data, definition).toString("hex"),
      };
    }),
  };
}

export function loadProgramEventBundle() {
  const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
  return { definition: parse(INTERFACE_PATH), vectors: parse(VECTORS_PATH) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const definition = JSON.parse(readFileSync(INTERFACE_PATH, "utf8"));
  const rendered = `${JSON.stringify(generateProgramEventVectors(definition), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    writeFileSync(VECTORS_PATH, rendered, "utf8");
    console.log("Wrote deterministic event vectors; no network or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}
