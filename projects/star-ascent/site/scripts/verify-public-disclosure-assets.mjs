#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requiredPairs = [
  "iat-allocation-authority-checklist",
  "iat-genesis-evidence-record",
  "iat-litepaper",
  "iat-solana-technical-spec",
  "iat-token-implementation-manifest",
  "iat-tokenomics-v1",
  "star-ascent-broadcast-pack",
  "star-ascent-communications-kit",
  "star-ascent-genesis-run-sheet",
  "star-ascent-genesis-social-kit",
  "star-ascent-incident-response",
  "star-ascent-launch-rehearsal",
  "star-ascent-readiness-scorecard",
  "star-ascent-whitepaper-v2",
];
const requiredSingles = [
  "iat-allocation-validator.mjs",
  "iat-authority-plan-validator.mjs",
  "star-ascent-publication-audit.mjs",
  "star-ascent-release-packet-validator.mjs",
  "star-ascent-evidence-ledger-validator.mjs",
  "star-ascent-readiness-snapshot-validator.mjs",
  "star-ascent-rehearsal-trace-validator.mjs",
  "star-ascent-change-freeze-validator.mjs",
  "star-ascent-launch-handoff-validator.mjs",
];

let failed = false;
for (const name of requiredPairs) {
  for (const language of ["en", "tr"]) {
    const path = resolve(root, "archive", "public-disclosures", "source", `${name}-${language}.txt`);
    if (existsSync(path)) console.log(`OK: ${name}-${language}.txt`);
    else { console.error(`FAIL: missing ${name}-${language}.txt`); failed = true; }
  }
}
for (const name of requiredSingles) {
  const path = resolve(root, "archive", "public-disclosures", "source", name);
  if (existsSync(path)) console.log(`OK: ${name}`);
  else { console.error(`FAIL: missing ${name}`); failed = true; }
}

if (failed) {
  console.error("\nDo not publish a document-index update until all required assets exist.");
  process.exitCode = 1;
} else {
  console.log("\nAll required canonical disclosure sources are present locally.");
}
