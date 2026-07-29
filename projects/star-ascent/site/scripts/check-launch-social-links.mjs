#!/usr/bin/env node

import { readFileSync } from "node:fs";

const documents = {
  "launch/FIRST_HOUR_SOCIAL_PACK.md": {
    required: ["internalagency.io/proof"],
    forbidden: ["dossier/read/genesis-proof"],
  },
  "launch/GENESIS_SOCIAL_SEQUENCE.md": {
    required: ["internalagency.io/proof", "ileriakil.com/proof"],
    forbidden: ["dossier/read/genesis-proof"],
  },
  "launch/LAUNCH_DAY_CARD.md": {
    required: ["`/proof`"],
    forbidden: ["dossier/read/genesis-proof"],
  },
  "launch/POST_GENESIS_PUBLIC_UPDATE.md": {
    required: ["internalagency.io/proof", "ileriakil.com/proof"],
    forbidden: ["dossier/read/genesis-proof"],
  },
};

let failed = false;
for (const [path, rules] of Object.entries(documents)) {
  const content = readFileSync(path, "utf8");
  let documentFailed = false;
  for (const value of rules.required) {
    if (!content.includes(value)) {
      console.error(`FAIL: ${path} must link to canonical Proof Board reference ${value}`);
      failed = true;
      documentFailed = true;
    }
  }
  for (const value of rules.forbidden) {
    if (content.includes(value)) {
      console.error(`FAIL: ${path} must not link to retired proof route ${value}`);
      failed = true;
      documentFailed = true;
    }
  }
  if (!documentFailed) console.log(`OK: ${path} uses only canonical Proof Board routes`);
}

if (failed) {
  console.error("\nLaunch social-link check failed. Keep all public proof references on the canonical Proof Board.");
  process.exitCode = 1;
} else {
  console.log("\nLaunch social-link check passes.");
}
