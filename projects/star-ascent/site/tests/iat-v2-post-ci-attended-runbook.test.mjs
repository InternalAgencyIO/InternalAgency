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
const attendedBoundary = readFileSync(
  "tools/iat-v2-admin-console/attended-transaction-boundary.mjs",
  "utf8",
);

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
  for (const source of [`${upgrade}\n${attendedBoundary}`, `${migration}\n${attendedBoundary}`, feature]) {
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

test("feature selection is documented as finalized chain truth before any prompt", () => {
  assert.match(runbook, /selector must refresh its config and action accounts at finalized commitment/u);
  assert.match(runbook, /derive cadence only from finalized block time/u);
  assert.match(runbook, /greatest returned observation slot must still resolve to the same week and CCC round/u);
  assert.match(runbook, /confirmed-only read, local workstation time, missing block time, regressing context, or boundary change/u);
  assert.match(feature, /getAccountInfoAndContext/u);
  assert.match(feature, /getMultipleAccountsInfoAndContext/u);
  assert.match(feature, /getBalanceAndContext/u);
  assert.match(feature, /minContextSlot/u);
  assert.doesNotMatch(
    feature.slice(
      feature.indexOf("async function loadFeatureState"),
      feature.indexOf("function nextFeatureAction"),
    ),
    /Date\.now\(|["']confirmed["']/u,
  );
});

test("feature signing and broadcast stop on any fresh deployment or action mismatch", () => {
  assert.match(
    runbook,
    /fresh finalized parent snapshot[\s\S]*snapshot's final slot as the minimum[\s\S]*exact Program ID, ProgramData address, `771c…8a01` program hash, 649,680-byte artifact length, and `7XZj…fzPH` upgrade authority/u,
  );
  assert.match(
    runbook,
    /after simulation immediately before the Model T prompt[\s\S]*broadcast click must repeat the same parent → child → deployment observation chain/u,
  );
  assert.match(runbook, /pre-broadcast mismatch discards the pending signed transaction and broadcasts nothing/u);
});

test("the base admin shell keeps artifact modes exact and initialization finalized", () => {
  const admin = readFileSync("tools/iat-v2-admin-console/main.jsx", "utf8");
  assert.match(runbook, /feature-mode shell must require the exact migration artifact/u);
  assert.match(runbook, /seven-stage initialization shell remains pinned to its exact pre-upgrade artifact/u);
  assert.match(runbook, /Mode switching must never turn “either reviewed artifact” into an acceptable deployment check/u);
  assert.match(admin, /ACTIVE_PROGRAM_ARTIFACT_BYTES = FEATURE_MODE/u);
  assert.match(admin, /expectedArtifactBytes: ACTIVE_PROGRAM_ARTIFACT_BYTES/u);
  assert.match(admin, /expectedArtifactSha256: ACTIVE_PROGRAM_ARTIFACT_SHA256/u);
  assert.match(admin, /getMultipleAccountsInfoAndContext/u);
  assert.match(admin, /getBalanceAndContext/u);
  assert.match(admin, /finalizedBlockTimestamp/u);
  assert.doesNotMatch(admin, /Date\.now\(|["']confirmed["']/u);
});

test("post-upgrade feature evidence cannot reuse the legacy initialization export", () => {
  const admin = readFileSync("tools/iat-v2-admin-console/main.jsx", "utf8");
  assert.match(runbook, /legacy seven-stage evidence export is disabled in feature\/post-upgrade mode/u);
  assert.match(runbook, /must never be rebound to, or combined with, the `bb09`\/`771c` migration snapshot/u);
  assert.match(runbook, /pre-upgrade initialization shell retains its own legacy export/u);
  assert.match(runbook, /DOWNLOAD FEATURE EVIDENCE[^\n]+only a partial checkpoint/u);
  assert.match(runbook, /EXPORT COMPLETE ATTENDED BUNDLE[^\n]+canonical complete-roster export/u);
  assert.match(admin, /if \(FEATURE_MODE\) \{[\s\S]*LEGACY SEVEN-STAGE EXPORT DISABLED IN POST-UPGRADE MODE[\s\S]*return;[\s\S]*const payload =/u);
  assert.match(admin, /rehearsalScope: "PRIMARY_INITIALIZATION"/u);
  assert.doesNotMatch(admin, /BACKDATED_FEATURE_INSTANCE_INITIALIZATION|iat-v2-devnet-feature-initialization-evidence\.json/u);
  assert.match(feature, /DOWNLOAD FEATURE EVIDENCE/u);
  assert.match(feature, /buildCompleteAttendedBundle/u);
  assert.match(feature, /EXPORT COMPLETE ATTENDED BUNDLE/u);
});
