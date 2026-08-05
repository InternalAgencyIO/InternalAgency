#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GENESIS_SCHEDULED_AT_UTC } from "../app/launch-clock-state.mjs";

const activeFiles = [
  "app/ActivationTerminal.tsx",
  "app/LaunchClock.tsx",
  "app/page.tsx",
  "app/launch/page.tsx",
  "app/mint/page.tsx",
  "launch/BROADCAST_CALL_SHEET.md",
  "launch/FIRST_HOUR_SOCIAL_PACK.md",
  "launch/GENESIS_COMMAND_CENTER.md",
  "launch/GENESIS_OPERATIONS_CARD.md",
  "launch/GENESIS_SOCIAL_SEQUENCE.md",
  "launch/LAUNCH_DAY_CARD.md",
  "launch/LIVE_BROADCAST_OPERATOR_CARD.md",
  "launch/OPERATOR_ACTIONS_ISTANBUL.txt",
];
const staleActionableSchedule = /30 JUL(?:Y)? 2026|30 July 2026|30 TEM(?:MUZ)? 2026|03:45:00 UTC|06:45:00 (?:ISTANBUL|Istanbul|İSTANBUL|İstanbul)|EXACT WINDOW SCHEDULED/u;
const failures = [];

if (GENESIS_SCHEDULED_AT_UTC !== null) {
  failures.push(`launch clock must be unscheduled; found ${GENESIS_SCHEDULED_AT_UTC}`);
}

for (const file of activeFiles) {
  const source = readFileSync(resolve(file), "utf8");
  if (staleActionableSchedule.test(source)) {
    failures.push(`${file} still presents the expired ceremony time`);
  }
  if (!/HOLD|BEKLET|UNSCHEDULED|PLANLANMADI/u.test(source)) {
    failures.push(`${file} is missing an explicit non-live boundary`);
  }
}

const requiredMarkers = new Map([
  [
    "app/LaunchClock.tsx",
    [
      "GENESIS // UNSCHEDULED · MAINNET HOLD",
      "REPLACEMENT UTC WINDOW · NOT PUBLISHED",
      'data-scheduled-at="UNSCHEDULED"',
    ],
  ],
  [
    "launch/GENESIS_COMMAND_CENTER.md",
    ["**Schedule:** UNSCHEDULED", "mainnet remains **HOLD**"],
  ],
]);

for (const [file, markers] of requiredMarkers) {
  const source = readFileSync(resolve(file), "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${file} is missing ${marker}`);
  }
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log(`Launch schedule is UNSCHEDULED_HOLD across ${activeFiles.length} active operator and public files; expired time is non-actionable.`);
