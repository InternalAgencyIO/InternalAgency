#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import {
  bindAllocationPlanJson,
  bindAnchorConfig,
  bindPolicyJson,
  bindProgramSource,
  validateDeployableProgramId,
} from "../programs/iat_v2/program-id-binding.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, ...rest] = entry.replace(/^--/, "").split("=");
  return [key, rest.join("=")];
}));

if (!args.program || args.write !== "yes" || Object.keys(args).some((key) => !["program", "write"].includes(key))) {
  console.error(
    "Usage: node scripts/bind-iat-v2-program-id.mjs --program=<PUBLIC_PROGRAM_ID> --write=yes",
  );
  console.error("This command accepts a public address only. Never pass a keypair or secret.");
  process.exit(2);
}

const programId = validateDeployableProgramId(args.program);
const targets = [
  {
    path: "programs/iat_v2/src/lib.rs",
    transform: bindProgramSource,
  },
  {
    path: "Anchor.toml",
    transform: bindAnchorConfig,
  },
  {
    path: "engagement/iat-economic-policy.v2.json",
    transform: bindPolicyJson,
  },
  {
    path: "launch/iat-v2-allocation-plan.template.json",
    transform: bindAllocationPlanJson,
  },
];

const changes = targets.map(({ path, transform }) => ({
  path,
  content: transform(readFileSync(path, "utf8"), programId),
}));
for (const change of changes) {
  writeFileSync(change.path, change.content, "utf8");
}

console.log(`Bound IAT V2 public program ID ${programId} in:`);
changes.forEach(({ path }) => console.log(`- ${path}`));
console.log("No keypair was read or created. Re-run all locked gates before committing.");
