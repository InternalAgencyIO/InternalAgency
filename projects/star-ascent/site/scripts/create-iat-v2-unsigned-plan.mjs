#!/usr/bin/env node

import {
  createIatV2DeploymentPlan,
  serializePlan,
} from "../programs/iat_v2/client.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, ...rest] = entry.replace(/^--/, "").split("=");
  return [key, rest.join("=")];
}));

if (!args.network || !args.mint || !args.program || !args.randomnessProgram) {
  console.error("Usage: node scripts/create-iat-v2-unsigned-plan.mjs --network=devnet --mint=<PUBLIC_KEY> --program=<PUBLIC_KEY> --randomnessProgram=<PUBLIC_KEY>");
  process.exit(2);
}

const plan = createIatV2DeploymentPlan({
  network: args.network,
  mint: args.mint,
  programId: args.program,
  randomnessProgramId: args.randomnessProgram,
});

console.log(serializePlan(plan));
