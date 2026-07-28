import { spawnSync } from "node:child_process";

const checks = [
  ["verify-launch-schedule.mjs"],
  ["validate-iat-supply-math.mjs"],
  ["validate-genesis-manifest.mjs", "launch/genesis-manifest.template.json"],
  ["validate-devnet-rehearsal.mjs", "launch/devnet-rehearsal.template.json"],
  ["validate-genesis-signing-checklist.mjs", "launch/genesis-signing-checklist.template.json"],
  ["validate-mainnet-handoff.mjs", "launch/mainnet-handoff.template.json"],
  ["validate-publication-payload.mjs", "launch/PUBLICATION_PAYLOAD.template.md"],
  ["validate-release-evidence-chain.mjs", "launch/genesis-manifest.template.json", "launch/PUBLICATION_PAYLOAD.template.md"],
  ["validate-genesis-transaction-order.mjs", "launch/genesis-manifest.template.json"],
  ["validate-release-packet.mjs", "launch/release-packet.template.json"],
  ["create-release-snapshot.mjs"],
  ["validate-release-snapshot.mjs", "launch/release-snapshot.generated.json"],
  ["validate-daily-rewards-policy.mjs", "engagement/reward-policy.v1.json"],
  ["validate-rewards-epoch-engine.mjs"],
  ["validate-binding-ledger-schema.mjs"],
];

for (const [script, ...args] of checks) {
  console.log(`\n== ${script} ==`);
  const result = spawnSync(process.execPath, [`scripts/${script}`, ...args], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\nPRELIGHT COMPLETE: local package consistency confirmed. Physical signing and independent on-chain verification remain separate launch actions.");
