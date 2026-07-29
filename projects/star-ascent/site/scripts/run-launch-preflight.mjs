import { spawnSync } from "node:child_process";

const checks = [
  ["test-accountability-label-normalization.mjs"],
  ["test-manifest-gate-regression.mjs"],
  ["test-publication-payload-regression.mjs"],
  ["test-release-evidence-chain-regression.mjs"],
  ["validate-token-metadata.mjs"],
  ["validate-allocation-lock-plan.mjs"],
  ["test-devnet-rehearsal-regression.mjs"],
  ["test-signing-checklist-regression.mjs"],
  ["test-mainnet-handoff-regression.mjs"],
  ["test-release-packet-regression.mjs"],
  ["test-pre-publication-packet-proof-regression.mjs"],
  ["test-canonical-digest-regression.mjs"],
  ["test-release-snapshot-regression.mjs"],
  ["test-post-genesis-reconciliation-regression.mjs"],
  ["test-incoming-artwork-manifest-regression.mjs"],
  ["check-genesis-operator-cards.mjs"],
  ["test-launch-clock-evidence-state.mjs"],
  ["test-mint-config-regression.mjs"],
  ["../tests/mint-ceremony.test.mjs"],
  ["verify-launch-schedule.mjs"],
  ["validate-iat-supply-math.mjs"],
  ["validate-genesis-manifest.mjs", "launch/genesis-manifest.template.json"],
  ["validate-token-metadata.mjs", "launch/token-metadata.template.json"],
  ["validate-allocation-lock-plan.mjs", "launch/allocation-lock-plan.template.json"],
  ["validate-devnet-rehearsal.mjs", "launch/devnet-rehearsal.template.json"],
  ["validate-genesis-signing-checklist.mjs", "launch/genesis-signing-checklist.template.json"],
  ["validate-mainnet-handoff.mjs", "launch/mainnet-handoff.template.json"],
  ["validate-publication-payload.mjs", "launch/PUBLICATION_PAYLOAD.template.md"],
  ["validate-release-evidence-chain.mjs", "launch/genesis-manifest.template.json", "launch/PUBLICATION_PAYLOAD.template.md"],
  ["validate-genesis-transaction-order.mjs", "launch/genesis-manifest.template.json"],
  ["validate-release-packet.mjs", "launch/release-packet.template.json"],
  ["create-release-snapshot.mjs"],
  ["validate-release-snapshot.mjs", "launch/release-snapshot.generated.json"],
  ["validate-post-genesis-reconciliation.mjs", "launch/post-genesis-reconciliation.template.json"],
  ["validate-incoming-artwork-manifest.mjs", "launch/incoming-artwork-manifest.template.json"],
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

console.log("\nPRELIGHT COMPLETE: local package consistency confirmed. Physical signing and independent on-chain verification remain separate launch actions.");
