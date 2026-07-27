#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checks = [
  ["app/LaunchClock.tsx", "2026-07-28T14:00:00Z", "canonical UTC launch instant"],
  ["app/page.tsx", "dateTime=\"2026-07-28T14:00:00Z\"", "English launch time element"],
  ["app/page.tsx", "dateTime=\"2026-07-28T13:30:00Z\"", "English broadcast time element"],
  ["app/ActivationTerminal.tsx", "28 JULY 2026 · 13:30 UTC", "English broadcast copy"],
  ["app/ActivationTerminal.tsx", "28 TEMMUZ 2026 · 13:30 UTC", "Turkish broadcast copy"],
  ["archive/public-disclosures/source/star-ascent-broadcast-pack-en.txt", "Genesis opens at 14:00 UTC.", "English broadcast pack"],
  ["archive/public-disclosures/source/star-ascent-broadcast-pack-tr.txt", "Başlangıç 14:00 UTC'de açılır.", "Turkish broadcast pack"],
  ["archive/public-disclosures/source/star-ascent-genesis-run-sheet-en.txt", "14:00 UTC — GENESIS", "English run sheet"],
  ["archive/public-disclosures/source/star-ascent-genesis-run-sheet-tr.txt", "14:00 UTC — BAŞLANGIÇ", "Turkish run sheet"],
];

let failed = false;
for (const [file, requiredText, label] of checks) {
  const source = readFileSync(resolve(root, file), "utf8");
  if (source.includes(requiredText)) console.log(`OK: ${label}`);
  else { console.error(`FAIL: ${label} does not match the confirmed schedule`); failed = true; }
}
if (failed) {
  console.error("\nSchedule is not safe to publish. Fix the conflicting surface before launch.");
  process.exitCode = 1;
} else console.log("\nLaunch schedule matches 28 July 2026, broadcast 13:30 UTC, Genesis 14:00 UTC.");
