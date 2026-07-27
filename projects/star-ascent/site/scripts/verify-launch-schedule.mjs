#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checks = [
  ["app/LaunchClock.tsx", "2026-07-28T14:00:00Z", "canonical UTC launch instant"],
  ["app/LaunchClock.tsx", "28 JULY \u00b7 14:00 UTC", "clock label"],
  ["app/LaunchClock.tsx", "28 TEMMUZ \u00b7 14:00 UTC", "Turkish clock label"],
  ["app/LaunchClock.tsx", "GENESIS PENCERESİ // CANLI", "Turkish live clock label"],
  ["app/LaunchClock.tsx", "SİNYAL AÇIK.", "Turkish live clock copy"],
  // app/page.tsx repairs legacy-encoded copy per rendered string. These exact
  // dateTime attributes are ASCII and are checked directly, but a whole-file
  // mojibake scan would incorrectly reject that compatibility source.
  ["app/page.tsx", "dateTime=\"2026-07-28T14:00:00Z\"", "English launch time element", { allowLegacyEncoding: true }],
  ["app/page.tsx", "dateTime=\"2026-07-28T13:30:00Z\"", "English broadcast time element", { allowLegacyEncoding: true }],
  ["app/ActivationTerminal.tsx", "28 JULY 2026 \u00b7 13:30 UTC", "English broadcast copy"],
  ["app/ActivationTerminal.tsx", "28 TEMMUZ 2026 \u00b7 13:30 UTC", "Turkish broadcast copy"],
  ["archive/public-disclosures/source/star-ascent-broadcast-pack-en.txt", "Genesis opens at 14:00 UTC.", "English broadcast pack"],
  ["archive/public-disclosures/source/star-ascent-broadcast-pack-tr.txt", "Ba\u015flang\u0131\u00e7 14:00 UTC'de a\u00e7\u0131l\u0131r.", "Turkish broadcast pack"],
  ["archive/public-disclosures/source/star-ascent-genesis-run-sheet-en.txt", "14:00 UTC \u2014 GENESIS", "English run sheet"],
  ["archive/public-disclosures/source/star-ascent-genesis-run-sheet-tr.txt", "14:00 UTC \u2014 BA\u015eLANGI\u00c7", "Turkish run sheet"],
];

let failed = false;
// These sequences indicate UTF-8 text was decoded and saved through a legacy
// single-byte encoding. A matching schedule is not publishable if a reader
// would see corrupt Turkish text on any checked public surface.
const mojibake = /(?:\u00C3.|\u00C2.|\u00E2\u20AC|\u00E2\u02C6|\u00C5.|\u00C4.)/;

for (const [file, requiredText, label, options = {}] of checks) {
  const source = readFileSync(resolve(root, file), "utf8");
  if (source.includes(requiredText)) console.log(`OK: ${label}`);
  else { console.error(`FAIL: ${label} does not match the confirmed schedule`); failed = true; }
  if (!options.allowLegacyEncoding && mojibake.test(source)) {
    console.error(`FAIL: ${label} contains corrupt text encoding`);
    failed = true;
  } else {
    console.log(`OK: ${label} text encoding is intact`);
  }
}

if (failed) {
  console.error("\nSchedule is not safe to publish. Fix the conflicting surface before launch.");
  process.exitCode = 1;
} else {
  console.log("\nLaunch schedule matches 28 July 2026, broadcast 13:30 UTC, Genesis 14:00 UTC.");
}
