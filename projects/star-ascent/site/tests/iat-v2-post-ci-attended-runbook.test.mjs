import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { IAT_V2_PROGRAM_ID } from "../programs/iat_v2/instructions.mjs";

const runbook = readFileSync("launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md", "utf8");
const upgrade = [
  "tools/iat-v2-admin-console/ProgramUpgrade.jsx",
  "tools/iat-v2-admin-console/ProgramUpgradeAttendedActions.jsx",
].map((path) => readFileSync(path, "utf8")).join("\n");
const migration = readFileSync("tools/iat-v2-admin-console/LegacyRoundMigration.jsx", "utf8");
const feature = readFileSync("tools/iat-v2-admin-console/FeatureRehearsal.jsx", "utf8");

test("post-CI runbook fixes localhost consoles and keeps Mainnet on hold", () => {
  for (const mode of ["upgrade", "migrate-rounds", "features"]) {
    assert.match(runbook, new RegExp(`http://127\\.0\\.0\\.1:4175/\\?mode=${mode}`, "u"));
  }
  assert.match(runbook, /Mainnet remains \*\*HOLD\*\*/u);
  assert.match(runbook, /does not authorize a Mainnet transaction/u);
  assert.match(runbook, new RegExp(IAT_V2_PROGRAM_ID.toBase58(), "u"));
  assert.doesNotMatch(runbook, /IATv2jRuKKmT41NKsb1iYwWba4wtviisFTcKMcpVR7X/u);
});

test("operator sequence preserves conditional capacity, buffer, migration, backfill, and feature order", () => {
  const tokens = [
    "iat-v2-devnet-buffer-preflight.mjs capacity",
    "rebuild-iat-v2-devnet-buffer-fresh.sh",
    "handoff-iat-v2-devnet-buffer.sh",
    "UPGRADE_PROGRAM",
    "MIGRATE_LEGACY_ROUND_WEEK_7",
    "MIGRATE_LEGACY_ROUND_WEEK_8",
    "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_9",
    "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_10",
    "SETTLE_STANDARD_POSITION_WEEK_10",
    "SETTLE_STANDARD_POSITION_WEEK_11",
    "SETTLE_LINKED_POSITION_2_WEEK_9",
    "SETTLE_LINKED_POSITION_2_WEEK_10",
    "SETTLE_LINKED_POSITION_3_WEEK_9",
    "SETTLE_LINKED_POSITION_3_WEEK_10",
    "CREATE_SWITCHBOARD_RANDOMNESS",
    "COMMIT_CCC_ROUND_11",
    "SETTLE_LINKED_POSITION_2_WEEK_11",
    "SETTLE_LINKED_POSITION_3_WEEK_11",
    "finalize-iat-v2-current-source-devnet-evidence.mjs",
  ];
  let cursor = -1;
  for (const token of tokens) {
    const next = runbook.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `${token} must appear in reviewed order`);
    cursor = next;
  }
});

test("each attended console separates simulation/signing from finalized broadcast and evidence", () => {
  for (const source of [upgrade, migration, feature]) {
    assert.match(source, /simulateTransaction/u);
    assert.match(source, /provider\.signTransaction/u);
    assert.match(source, /sendRawTransaction/u);
    assert.match(source, /FINALIZED_COMMITMENT/u);
    assert.match(source, /messageSha256/u);
    assert.match(source, /finalizedAtUtc/u);
    assert.doesNotMatch(source.match(/useEffect\([\s\S]*?\n  \}, \[\]\);/u)?.[0] ?? "", /sendRawTransaction/u);
  }
  assert.match(upgrade, /persistAttendedReceipt/u);
  assert.match(migration, /persistAttendedReceipt/u);
  assert.match(feature, /buildCompleteAttendedBundle/u);
  assert.match(feature, /EXPORT COMPLETE ATTENDED BUNDLE/u);
  assert.match(feature, /CLEAR LOCAL FEATURE RECEIPTS/u);
  assert.match(runbook, /never creates a placeholder receipt/u);
});
