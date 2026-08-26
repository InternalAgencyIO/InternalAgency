import { spawnSync } from "node:child_process";

const options = new Set(process.argv.slice(2));
const allowedOptions = new Set(["--require-ceremony-ready"]);
const unknownOptions = [...options].filter((option) => !allowedOptions.has(option));
if (unknownOptions.length) {
  console.error(`Unknown preflight option: ${unknownOptions.join(", ")}`);
  process.exit(2);
}

const requireCeremonyReady = options.has("--require-ceremony-ready");
const entryAssessment = spawnSync(
  process.execPath,
  [
    "scripts/assess-iat-v2-mainnet-ceremony-entry.mjs",
    ...(requireCeremonyReady ? ["--require-ready"] : []),
  ],
  { stdio: "inherit" },
);
if (entryAssessment.status !== 0) process.exit(entryAssessment.status ?? 1);

// This is the V2 program ceremony preflight. The retired Original-SPL `/mint`
// packet retains its own validators and regression commands, but its legacy
// lock plan, four-transaction rehearsal, handoff, and release packet are not
// authority for — and therefore cannot block — the V2 staged ceremony.
const checks = [
  ["validate-iat-v2-policy.mjs"],
  ["validate-public-devnet-evidence.mjs"],
  ["validate-iat-v2-time-gate-proof.mjs"],
  ["validate-iat-v2-mainnet-readiness-gate.mjs"],
  ["validate-iat-v2-current-source-clearance.mjs"],
  ["validate-iat-v2-ceremony-review.mjs"],
  ["test-iat-v2-ceremony-review-regression.mjs"],
  ["test-iat-v2-mainnet-ceremony-entry-regression.mjs"],
  ["test-iat-v2-canonical-json-regression.mjs"],
  ["validate-iat-v2-mainnet-stage-journal.mjs"],
  ["test-iat-v2-mainnet-stage-journal-regression.mjs"],
  ["validate-iat-v2-independent-signoff.mjs"],
  ["validate-iat-v2-feature-signoff.mjs"],
  ["validate-token-metadata.mjs"],
  ["verify-launch-schedule.mjs"],
  ["validate-daily-rewards-policy.mjs", "engagement/reward-policy.v1.json"],
  ["validate-rewards-epoch-engine.mjs"],
  ["validate-binding-ledger-schema.mjs"],
  ["validate-solana-wallet-proof.mjs"],
  ["validate-x-oauth-state.mjs"],
];

for (const [script, ...args] of checks) {
  console.log(`\n== ${script} ==`);
  const result = spawnSync(process.execPath, [`scripts/${script}`, ...args], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(
  requireCeremonyReady
    ? "\nATTENDED PREFLIGHT COMPLETE: reviewed local artifacts passed. This result still does not authorize signing, broadcast, deployment, minting, transfer, or publication."
    : "\nPREPARATION PREFLIGHT COMPLETE: local consistency confirmed; ceremony entry was not requested and mainnet remains HOLD. Use --require-ceremony-ready only during the attended final review.",
);
