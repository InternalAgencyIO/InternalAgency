#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { V2_STAGE_ORDER } from "../programs/iat_v2/client.mjs";

const policy = JSON.parse(readFileSync("engagement/iat-economic-policy.v2.json", "utf8"));
const rehearsal = JSON.parse(
  readFileSync("launch/iat-v2-devnet-rehearsal.template.json", "utf8"),
);
const mintPage = readFileSync("app/mint/page.tsx", "utf8");

if (
  rehearsal.schema !== "iat-v2-devnet-rehearsal/v1"
  || rehearsal.status !== "PLANNED"
  || rehearsal.network !== "devnet"
) {
  throw new Error("the canonical V2 rehearsal must remain PLANNED on devnet");
}
if (rehearsal.requiredScenarios.length < 20) {
  throw new Error("the V2 rehearsal scenario matrix is incomplete");
}
for (const marker of [
  "const V2_MINT_ONLY_PATH_SUPERSEDED = true;",
  "SUPERSEDED // DO NOT SIGN",
  "disabled={V2_MINT_ONLY_PATH_SUPERSEDED}",
  "It has no wallet provider, signer, transaction builder, or",
]) {
  if (!mintPage.includes(marker)) {
    throw new Error(`app/mint/page.tsx is missing fail-closed marker ${marker}`);
  }
}

const cardPaths = [
  "launch/GENESIS_OPERATIONS_CARD.md",
  "launch/LAUNCH_DAY_CARD.md",
  "launch/LIVE_BROADCAST_OPERATOR_CARD.md",
];
const cards = new Map(
  cardPaths.map((path) => [path, readFileSync(path, "utf8")]),
);
const gateStatusPatterns = [
  [/launch\/release-snapshot\.generated\.json.{0,100}`HOLD`/s, "HOLD release snapshot"],
  [/launch\/mainnet-handoff\.template\.json.{0,100}`APPROVED`/s, "legacy APPROVED handoff boundary"],
  [/launch\/release-packet\.template\.json.{0,100}`READY`/s, "legacy READY packet boundary"],
];

for (const [path, content] of cards) {
  if (!content.includes("HOLD")) {
    throw new Error(`${path} must retain an explicit HOLD boundary`);
  }
  for (const [pattern, label] of gateStatusPatterns) {
    if (!pattern.test(content)) {
      throw new Error(`${path} must distinguish the ${label}`);
    }
  }
  if (/follow the exact four-transaction|execute exactly four|use .*\/mint.*sign/i.test(content)) {
    throw new Error(`${path} still instructs the superseded mint-only ceremony`);
  }
}

for (const path of [
  "launch/GENESIS_OPERATIONS_CARD.md",
  "launch/LIVE_BROADCAST_OPERATOR_CARD.md",
]) {
  const content = cards.get(path);
  let previousIndex = -1;
  for (const stage of V2_STAGE_ORDER) {
    const marker = `\`${stage}\``;
    const matches = [...content.matchAll(new RegExp(marker, "g"))];
    if (matches.length !== 1) {
      throw new Error(`${path} must contain V2 stage ${marker} exactly once`);
    }
    if (matches[0].index <= previousIndex) {
      throw new Error(`${path} does not preserve the V2 stage order`);
    }
    previousIndex = matches[0].index;
  }
  if (!/Publication is a separate human/i.test(content)) {
    throw new Error(`${path} must separate publication from protocol execution`);
  }
}

const launchDayCard = cards.get("launch/LAUNCH_DAY_CARD.md");
if (
  !launchDayCard.includes("V2 runbook")
  || !launchDayCard.includes("launch/GENESIS_OPERATIONS_CARD.md")
  || !launchDayCard.includes("launch/DEVNET_REHEARSAL_SCENARIO.md")
) {
  throw new Error("launch/LAUNCH_DAY_CARD.md must delegate to the V2 runbooks");
}

const operationsCard = cards.get("launch/GENESIS_OPERATIONS_CARD.md");
const requiredArtifacts = [
  "engagement/iat-economic-policy.v2.json",
  "launch/iat-v2-allocation-plan.template.json",
  "launch/iat-v2-devnet-rehearsal.template.json",
  "docs/IAT_V2_PROGRAM_ARCHITECTURE.md",
  "programs/iat_v2/README.md",
  "scripts/bind-iat-v2-program-id.mjs",
  "scripts/verify-iat-v2-sbf.sh",
  "launch/release-snapshot.generated.json",
  "launch/mainnet-handoff.template.json",
  "launch/release-packet.template.json",
  "launch/PUBLICATION_PAYLOAD.template.md",
];
for (const path of requiredArtifacts) {
  if (!operationsCard.includes(`\`${path}\``)) {
    throw new Error(`launch/GENESIS_OPERATIONS_CARD.md must name ${path}`);
  }
}

const expectedBaseUnits = Object.values(policy.allocations).map(
  ({ baseUnitAmount }) => baseUnitAmount,
);
for (const amount of expectedBaseUnits) {
  if (!operationsCard.includes(`\`${amount}\``)) {
    throw new Error(`operations card must preserve allocation amount ${amount}`);
  }
}
const totalBaseUnits = expectedBaseUnits
  .reduce((total, amount) => total + BigInt(amount), 0n)
  .toString();
if (!operationsCard.includes(`\`${totalBaseUnits}\``)) {
  throw new Error(`operations card must preserve allocation total ${totalBaseUnits}`);
}

console.log(
  "OK: operator cards enforce the V2 stage order, disable the superseded mint path, preserve allocation math, and retain HOLD boundaries",
);
