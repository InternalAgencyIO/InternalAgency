#!/usr/bin/env node

import { readFileSync } from "node:fs";

const releaseEvidenceOrder = [
  "CREATE_MINT",
  "MINT_ALLOCATION_DESTINATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
  "PUBLISH_EVIDENCE",
];
const ceremonyTransactionOrder = [
  "CREATE_INITIALIZE_IMMUTABLE_METADATA",
  "MINT_FIVE_ALLOCATION_DESTINATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
];

const manifestPath = "launch/genesis-manifest.template.json";
const rehearsalPath = "launch/devnet-rehearsal.template.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const rehearsal = JSON.parse(readFileSync(rehearsalPath, "utf8"));

if (
  JSON.stringify(manifest.releaseEvidence?.transactionOrder) !==
  JSON.stringify(releaseEvidenceOrder)
) {
  throw new Error(
    `${manifestPath} no longer contains the fixed release-evidence order`,
  );
}
if (
  JSON.stringify(rehearsal.mainnetPlan?.transactionOrder) !==
  JSON.stringify(ceremonyTransactionOrder)
) {
  throw new Error(
    `${rehearsalPath} no longer contains the exact four-transaction ceremony`,
  );
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
  [/launch\/mainnet-handoff\.template\.json.{0,100}`APPROVED`/s, "APPROVED mainnet handoff"],
  [/launch\/release-packet\.template\.json.{0,100}`READY`/s, "READY release packet"],
];

for (const [path, content] of cards) {
  if (!content.includes("HOLD")) {
    throw new Error(`${path} must retain an explicit HOLD boundary`);
  }
  for (const [pattern, label] of gateStatusPatterns) {
    if (!pattern.test(content)) {
      throw new Error(`${path} must distinguish the ${label} state`);
    }
  }
  if (/five[- ]transaction|fifth transaction is publication/i.test(content)) {
    throw new Error(`${path} must not describe publication as a transaction`);
  }
}

for (const path of [
  "launch/GENESIS_OPERATIONS_CARD.md",
  "launch/LIVE_BROADCAST_OPERATOR_CARD.md",
]) {
  const content = cards.get(path);
  let previousIndex = -1;
  for (const transaction of ceremonyTransactionOrder) {
    const marker = `\`${transaction}\``;
    const matches = [...content.matchAll(new RegExp(marker, "g"))];
    if (matches.length !== 1) {
      throw new Error(
        `${path} must contain ceremony transaction ${marker} exactly once`,
      );
    }
    if (matches[0].index <= previousIndex) {
      throw new Error(`${path} does not preserve the ceremony transaction order`);
    }
    previousIndex = matches[0].index;
  }
  if (!/publication is a separate human/i.test(content)) {
    throw new Error(`${path} must separate publication from the four transactions`);
  }
}

const launchDayCard = cards.get("launch/LAUNCH_DAY_CARD.md");
if (
  !launchDayCard.includes("exact four-transaction ceremony") ||
  !launchDayCard.includes("launch/GENESIS_OPERATIONS_CARD.md")
) {
  throw new Error(
    "launch/LAUNCH_DAY_CARD.md must delegate to the exact four-transaction operations card",
  );
}

const operationsCard = cards.get("launch/GENESIS_OPERATIONS_CARD.md");
const requiredArtifacts = [
  "launch/token-metadata.template.json",
  "launch/allocation-lock-plan.template.json",
  "launch/genesis-manifest.template.json",
  "launch/devnet-rehearsal.template.json",
  "launch/genesis-signing-checklist.template.json",
  "launch/release-snapshot.generated.json",
  "launch/mainnet-handoff.template.json",
  "launch/release-packet.template.json",
  "launch/pre-publication-packet-proof.generated.json",
  "launch/PUBLICATION_PAYLOAD.template.md",
];
for (const path of requiredArtifacts) {
  if (!operationsCard.includes(`\`${path}\``)) {
    throw new Error(
      `launch/GENESIS_OPERATIONS_CARD.md must name canonical artifact ${path}`,
    );
  }
}

if (operationsCard.includes("genesis-manifest.json")) {
  throw new Error(
    "launch/GENESIS_OPERATIONS_CARD.md must not name the retired non-canonical manifest",
  );
}

const expectedBaseUnits = Object.values(manifest.allocations).map(
  ({ baseUnitAmount }) => baseUnitAmount,
);
for (const amount of expectedBaseUnits) {
  if (!operationsCard.includes(`\`${amount}\``)) {
    throw new Error(
      `launch/GENESIS_OPERATIONS_CARD.md must preserve allocation amount ${amount}`,
    );
  }
}
const totalBaseUnits = expectedBaseUnits
  .reduce((total, amount) => total + BigInt(amount), 0n)
  .toString();
if (!operationsCard.includes(`\`${totalBaseUnits}\``)) {
  throw new Error(
    `launch/GENESIS_OPERATIONS_CARD.md must preserve allocation total ${totalBaseUnits}`,
  );
}

console.log(
  "OK: operator cards separate the exact four-transaction ceremony from the five-stage evidence workflow, preserve allocation math, and retain HOLD boundaries",
);
