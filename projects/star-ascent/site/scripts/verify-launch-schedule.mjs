#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { GENESIS_SCHEDULED_AT_UTC } from "../app/launch-clock-state.mjs";

const EXPECTED_UTC = "2026-07-30T03:45:00Z";
const EXPECTED_UTC_DISPLAY = "03:45:00 UTC";
const EXPECTED_ISTANBUL_DISPLAY = "06:45:00";

const disclosureFiles = readdirSync(resolve("archive/public-disclosures/source"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile())
  .map((entry) => join("archive/public-disclosures/source", entry.name));

const activeFiles = [
  "app/LaunchClock.tsx",
  "app/page.tsx",
  "app/launch/page.tsx",
  "app/mint/page.tsx",
  "app/ActivationTerminal.tsx",
  "app/press/PressCopyDeck.tsx",
  "launch/BROADCAST_CALL_SHEET.md",
  "launch/DEVNET_REHEARSAL_SCENARIO.md",
  "launch/FIRST_HOUR_SOCIAL_PACK.md",
  "launch/GENESIS_COMMAND_CENTER.md",
  "launch/GENESIS_OPERATIONS_CARD.md",
  "launch/GENESIS_SOCIAL_SEQUENCE.md",
  "launch/LAUNCH_DAY_CARD.md",
  "launch/LIVE_BROADCAST_OPERATOR_CARD.md",
  "launch/OPERATOR_ACTIONS_ISTANBUL.txt",
  ...disclosureFiles,
];

const textExtensions = new Set([".json", ".md", ".mjs", ".ts", ".tsx", ".txt"]);
const staleClaims = [
  {
    pattern:
      /2026-07-28|28 JULY(?: 2026)?|28 July(?: 2026)?|28 TEMMUZ(?: 2026)?|28 Temmuz(?: 2026)?/u,
    description: "the elapsed 28 July launch window",
  },
  {
    pattern:
      /2026-07-29T15:00:00Z|29 JULY 2026|29 July 2026|29 TEMMUZ 2026|29 Temmuz 2026|\b15:00:00 UTC\b|\b18:00:00 (?:Istanbul|İstanbul|ISTANBUL|İSTANBUL)\b/u,
    description: "the elapsed 29 July launch window",
  },
  {
    pattern:
      /\b13:30 UTC\b|\b14:00 UTC\b|\b16:30\b|\b17:00\b|\b14:07:16\b|\b17:07:16\b/u,
    description: "an expired fixed launch time",
  },
  {
    pattern:
      /NEXT WINDOW(?: \/\/)? NOT SCHEDULED|SONRAKİ PENCERE(?: \/\/)? PLANLANMADI|next (?:STAR ASCENT |broadcast and Genesis )?window (?:is|are) not scheduled|sonraki (?:STAR ASCENT |yayın ve Başlangıç )?penceresi planlanmadı/iu,
    description: "an unscheduled-window claim",
  },
];

const failures = [];

if (GENESIS_SCHEDULED_AT_UTC !== EXPECTED_UTC) {
  failures.push(
    `launch clock target is ${GENESIS_SCHEDULED_AT_UTC}; expected ${EXPECTED_UTC}`,
  );
}

for (const file of activeFiles) {
  if (!textExtensions.has(extname(file))) continue;
  const source = readFileSync(resolve(file), "utf8");
  for (const claim of staleClaims) {
    if (claim.pattern.test(source)) {
      failures.push(`${file} still presents ${claim.description}`);
    }
  }
}

const requiredMarkers = new Map([
  [
    "app/LaunchClock.tsx",
    [
      EXPECTED_UTC_DISPLAY,
      `${EXPECTED_ISTANBUL_DISPLAY} İSTANBUL`,
      "OPEN-SOURCE CEREMONY // COUNTDOWN",
      "AÇIK KAYNAK TÖREN // GERİ SAYIM",
      "HUMAN-APPROVED EXECUTION MAY BEGIN",
    ],
  ],
  [
    "app/page.tsx",
    [EXPECTED_UTC_DISPLAY, `${EXPECTED_ISTANBUL_DISPLAY} İSTANBUL`],
  ],
  [
    "app/launch/page.tsx",
    [EXPECTED_UTC_DISPLAY, `${EXPECTED_ISTANBUL_DISPLAY} İSTANBUL`],
  ],
  [
    "app/mint/page.tsx",
    [EXPECTED_UTC_DISPLAY, `${EXPECTED_ISTANBUL_DISPLAY} ISTANBUL`],
  ],
  [
    "launch/GENESIS_COMMAND_CENTER.md",
    [EXPECTED_UTC_DISPLAY, `${EXPECTED_ISTANBUL_DISPLAY} Istanbul`],
  ],
]);

for (const [file, markers] of requiredMarkers) {
  const source = readFileSync(resolve(file), "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`${file} is missing ${marker}`);
    }
  }
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log(
  `Launch schedule is fixed at ${EXPECTED_UTC} across ${activeFiles.length} active operator and public files.`,
);
