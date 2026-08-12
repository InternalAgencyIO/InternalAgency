import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const schemaUrl = new URL("../engagement/reward-ledger.v2.schema.sql", import.meta.url);
const activeSchemaUrl = new URL("../engagement/binding-ledger.schema.sql", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);
const appUrl = new URL("../app/", import.meta.url);
const workerUrl = new URL("../worker/", import.meta.url);
const engagementUrl = new URL("../engagement/", import.meta.url);
const sql = readFileSync(schemaUrl, "utf8");

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const required = [
  "PRAGMA recursive_triggers = ON",
  "BLUEPRINT_ONLY_NON_ACTIVATING",
  "runtime_wiring_allowed INTEGER NOT NULL CHECK (runtime_wiring_allowed = 0)",
  "migration_path_present INTEGER NOT NULL CHECK (migration_path_present = 0)",
  "global_allocator_present INTEGER NOT NULL CHECK (global_allocator_present = 0)",
  "tier IN ('None', 'Basic', 'Premium', 'PremiumPlus')",
  "unixepoch(x_control_observed_at_utc) - unixepoch(x_account_created_at_utc) >= 3456000",
  "action_type IN ('original', 'reply', 'quote', 'repost', 'like', 'follow')",
  "first_observed_finalized_slot INTEGER",
  "canonical_campaign_target_digest TEXT NOT NULL",
  "reward_v2_qualifying_actions_lookup_target_replay_unique",
  "UNIQUE (node_id, campaign_kind, origin_utc_day)",
  "nominal_full_reward_base_units = 100000000000",
  "nominal_full_reward_base_units = 12000000000",
  "genesis_rank BETWEEN 1 AND 1000",
  "tranche_kind IN ('X_BASE_10', 'X_PREMIUM_FULL_100', 'X_PREMIUM_UPGRADE_90')",
  "tranche_kind = 'X_BASE_10' AND tranche_basis_points = 1000",
  "tranche_kind = 'X_PREMIUM_FULL_100' AND tranche_basis_points = 10000",
  "tranche_kind = 'X_PREMIUM_UPGRADE_90' AND tranche_basis_points = 9000",
  "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
  "premium_observation.observation_history_sequence > candidate.base_eligibility_sequence",
  "unixepoch(premium_observation.accepted_at_utc) > unixepoch(candidate.original_funding_round_at_utc)",
  "base_receipt.tranche_kind = 'X_BASE_10'",
  "base_receipt.disposition = 'ADMITTED_RESERVED'",
  "candidate eligibility sequence must be the canonical max of activity, node, and accepted proof history",
  "original_funding_round_at_utc TEXT NOT NULL",
  "unixepoch(original_funding_round_at_utc) = unixepoch(origin_utc_day || 'T00:00:00.000Z') + 86400",
  "unixepoch(claim_expires_at_utc) = unixepoch(original_funding_round_at_utc) + 2592000",
  "daily_unfulfilled_at_utc_boundary",
  "partial_payment_allowed INTEGER NOT NULL CHECK (partial_payment_allowed = 0)",
  "retry_allowed INTEGER NOT NULL CHECK (retry_allowed = 0)",
  "recycling_allowed INTEGER NOT NULL CHECK (recycling_allowed = 0)",
  "reward_v2_allocator_grants_null_exclusion",
  "reward_v2_null_receipts_grant_exclusion",
  "reward_v2_terminal_receipts_outcome_guard",
  "reward_v2_genesis_acceptances_contiguous_rank_guard",
  "reward_v2_candidates_genesis_node_unique",
  "selected_count INTEGER NOT NULL CHECK (selected_count BETWEEN 0 AND 1000)",
  "selected_nominal_base_units BETWEEN 0 AND 12000000000000",
  "epoch_ordinal INTEGER NOT NULL UNIQUE CHECK (epoch_ordinal BETWEEN 1 AND 365)",
  "cumulative_selected_nominal_base_units BETWEEN 0 AND 4380000000000000",
  "reward_v2_daily_epochs_chain_guard",
  "v1_selection_score TEXT NOT NULL",
  "UNIQUE (funding_round_id, selection_rank)",
  "UNIQUE (funding_round_id, candidate_id)",
  "UNIQUE (funding_round_id, v1_selection_score)",
  "reward_v2_daily_selections_contiguous_rank_guard",
  "IAT_DAILY_BUDGET_V1_ASCENDING_SHA256",
  "selection_domain = 'IAT_DAILY_BUDGET_V1'",
  "ordered by ascending V1 score within its epoch",
  "reward_v2_allocator_grants_campaign_evidence_guard",
  "reward_v2_candidates_open_round_guard",
  "reward_v2_candidates_origin_evidence_time_guard",
  "sealed_at_utc TEXT",
  "lane_reservation_snapshot_digest TEXT",
  "miss_decidable_at_utc TEXT NOT NULL UNIQUE",
  "unixepoch(miss_decidable_at_utc) = unixepoch(opens_at_utc) + 1",
  "miss_decidable_at_utc = substr(opens_at_utc, 1, 11) || '00:00:01.000Z'",
  "reward_v2_funding_rounds_initial_state_guard",
  "reward_v2_funding_rounds_terminal_immutable",
  "reward_v2_allocator_batches",
  "batch_codec_magic TEXT NOT NULL CHECK (batch_codec_magic = 'IATB3RCF')",
  "batch_transcript_length INTEGER NOT NULL CHECK (batch_transcript_length = 320)",
  "policy_digest = '2054c881f9c7524acb965454286950445cd37c99f7485b45e2c787bcfb3617e2'",
  "deployment_domain_digest = '4851da6cd96c8231e0d2b85b1f80b889e0e48f528b5aaa5056dcd8730e216224'",
  "post_lane_ledger_digest TEXT NOT NULL",
  "reference_receipt_set_digest TEXT NOT NULL",
  "reference_outcome_digest TEXT NOT NULL",
  "reference_finalization_digest TEXT NOT NULL UNIQUE",
  "reference_receipt_count INTEGER NOT NULL",
  "reward_v2_allocator_receipt_transcripts",
  "receipt_codec_magic TEXT NOT NULL CHECK (receipt_codec_magic = 'IATB3ALR')",
  "receipt_transcript_length INTEGER NOT NULL CHECK (receipt_transcript_length = 288)",
  "UNIQUE (allocator_batch_id, allocation_index)",
  "planned_treasury_base_units = amount_base_units",
  "planned_liquidity_base_units <= amount_base_units - planned_ecosystem_base_units",
  "reward_v2_allocator_receipts",
  "reward_v2_allocator_receipts_transcript_guard",
  "reward_v2_funding_rounds_allocator_recorded_guard",
  "batch.reference_receipt_count = 0",
  "max(transcript.allocation_index)",
  "complete contiguous generic transcript set and every mapped X outcome",
  "reward_v2_allocator_grants_receipt_guard",
  "reward_v2_null_receipts_allocator_guard",
  "antecedent admitted allocator receipt with exact matching fields",
  "disposition = 'NULL_BLOCKED'",
  "allocator_reason = 'HIGHER_PRIORITY_OR_EARLIER_OBLIGATION_UNDERFUNDED'",
  "allocator_reason = 'EXACT_AMOUNT_NOT_AVAILABLE'",
  "runtime_authentication_verified INTEGER NOT NULL",
];

for (const snippet of required) check(sql.includes(snippet), `missing reward-ledger v2 control: ${snippet}`);
check(!sql.includes("funding_cutoff_at_utc"), "a forbidden 24-hour funding eligibility cutoff remains in reward-ledger v2");
check(!sql.includes("UTC_BOUNDARY_NULL_V1"), "boundary terminal events must not fabricate allocator batches");
check(!sql.includes("authentication_evidence_digest"), "the inert codec mapping must not invent allocator authentication evidence");

for (const forbiddenAction of ["bookmark", "view", "impression", "unattributable"]) {
  const enumFragment = sql.match(/action_type IN \(([^)]+)\)/u)?.[1] ?? "";
  check(!enumFragment.includes(`'${forbiddenAction}'`), `forbidden action entered the v2 enum: ${forbiddenAction}`);
}

for (const forbiddenSql of [
  /\bALTER\s+TABLE\b/iu,
  /\bDROP\s+TABLE\b/iu,
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:node_bindings|genesis_slots|reward_epochs|reward_claims)\b/iu,
]) {
  check(!forbiddenSql.test(sql), `reward-ledger v2 contains forbidden migration/runtime SQL: ${forbiddenSql}`);
}

const objectNames = [...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?(?:TABLE|TRIGGER|INDEX)\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)/giu)]
  .map((match) => match[1]);
check(objectNames.length >= 20, "reward-ledger v2 object inventory is unexpectedly small");
for (const name of objectNames) check(name.startsWith("reward_v2_"), `non-v2 SQL object is forbidden: ${name}`);

const db = new DatabaseSync(":memory:");
db.exec(sql);
const foreignKeyFailures = db.prepare("PRAGMA foreign_key_check").all();
check(foreignKeyFailures.length === 0, `fresh reward-ledger v2 schema has foreign-key failures: ${JSON.stringify(foreignKeyFailures)}`);

const allocatorTableSql = [
  "reward_v2_allocator_receipt_transcripts",
  "reward_v2_allocator_receipts",
].map((name) => db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)?.sql ?? "");
for (const tableSql of allocatorTableSql) {
  for (const disposition of ["ADMITTED_RESERVED", "NULL_UNDERFUNDED", "NULL_BLOCKED"]) {
    check(tableSql.includes(`'${disposition}'`), `canonical allocator disposition is missing: ${disposition}`);
  }
  for (const forbiddenDisposition of [
    "NULL_MISSED",
    "NULL_PARENT_UNFUNDED",
    "NULL_CLAIM_EXPIRED",
    "NULL_POLICY_HOLD",
    "NULL_EVIDENCE_HELD",
    "NULL_PREMIUM_PROOF_STALE",
    "NULL_ALLOCATOR_ABSENT",
  ]) {
    check(!tableSql.includes(`'${forbiddenDisposition}'`), `terminal event leaked into allocator dispositions: ${forbiddenDisposition}`);
  }
}
check(
  db.prepare("SELECT [notnull] AS required FROM pragma_table_info('reward_v2_null_receipts') WHERE name = 'allocator_receipt_id'").get()?.required === 0,
  "direct boundary/expiry/parent nulls must not require a fabricated allocator receipt",
);

const guard = db.prepare("SELECT * FROM reward_v2_blueprint_guard WHERE singleton_id = 1").get();
check(guard?.schema_version === 2, "reward-ledger v2 guard version drift");
check(guard?.status === "BLUEPRINT_ONLY_NON_ACTIVATING", "reward-ledger v2 guard status drift");
check(guard?.runtime_wiring_allowed === 0 && guard?.migration_path_present === 0 && guard?.global_allocator_present === 0, "reward-ledger v2 guard accidentally authorizes activation");

const tables = db.prepare("SELECT name FROM pragma_table_list WHERE schema = 'main' AND name LIKE 'reward_v2_%' ORDER BY name").all();
check(tables.length === 17, `expected exactly 17 isolated reward_v2 tables, found ${tables.length}`);
for (const { name } of tables) {
  const table = db.prepare("SELECT strict FROM pragma_table_list WHERE schema = 'main' AND name = ?").get(name);
  check(table?.strict === 1, `${name} is not a SQLite STRICT table`);
  check(
    db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ? AND name = ?")
      .get(name, `${name}_no_replace`).count === 1,
    `${name} is missing its statement-level no-REPLACE guard`,
  );
}
check(db.prepare("SELECT count(*) AS count FROM pragma_foreign_key_list('reward_v2_allocator_grants')").get().count >= 6, "allocator grants are missing strict receipt/identity/round/selection foreign keys");
check(db.prepare("SELECT count(*) AS count FROM pragma_foreign_key_list('reward_v2_allocator_receipts')").get().count >= 8, "allocator receipts are missing strict batch/identity/evidence foreign keys");
check(db.prepare("SELECT count(*) AS count FROM pragma_foreign_key_list('reward_v2_allocator_receipt_transcripts')").get().count >= 2, "generic allocator transcripts are missing batch/round foreign keys");
check(db.prepare("SELECT count(*) AS count FROM pragma_index_list('reward_v2_daily_selections') WHERE [unique] = 1").get().count >= 5, "daily selection rank/candidate/score replay uniqueness is incomplete");
check(db.prepare("SELECT count(*) AS count FROM pragma_index_list('reward_v2_candidates') WHERE [unique] = 1").get().count >= 3, "candidate replay/Genesis uniqueness is incomplete");
check(db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'reward_v2_%_no_delete'").get().count === 17, "append-only delete guards are incomplete");
check(db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'reward_v2_%_no_replace'").get().count === 17, "statement-level REPLACE guards are incomplete");
check(db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('node_bindings', 'genesis_slots', 'reward_epochs', 'reward_claims')").get().count === 0, "active ledger tables leaked into the v2 blueprint database");
db.close();

const activeSchema = readFileSync(activeSchemaUrl, "utf8");
const packageSource = readFileSync(packageUrl, "utf8");
const packageJson = JSON.parse(packageSource);
check(!activeSchema.includes("reward_v2_"), "active binding schema is wired to reward-ledger v2");
const packageLedgerReferences = Object.entries(packageJson.scripts ?? {})
  .filter(([, command]) => command.includes("reward-ledger-v2") || command.includes("reward-ledger.v2"));
check(
  packageLedgerReferences.length === 1
    && packageLedgerReferences[0][0] === "check:iat-b3-spec"
    && packageLedgerReferences[0][1].includes("tests/reward-ledger-v2-schema.test.mjs")
    && !packageLedgerReferences[0][1].includes("engagement/reward-ledger.v2.schema.sql")
    && !packageLedgerReferences[0][1].includes("scripts/validate-reward-ledger-v2-schema.mjs"),
  "package scripts must expose only the read-only reward-ledger v2 CI test, never a runtime/migration command",
);

const sourceFiles = (directoryUrl) => readdirSync(directoryUrl, { withFileTypes: true }).flatMap((entry) => {
  const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directoryUrl);
  return entry.isDirectory() ? sourceFiles(child) : [child];
});
for (const sourceUrl of [appUrl, workerUrl, engagementUrl].flatMap(sourceFiles)) {
  if (!/\.(?:js|jsx|mjs|ts|tsx)$/u.test(sourceUrl.pathname)) continue;
  const source = readFileSync(sourceUrl, "utf8");
  check(!source.includes("reward_v2_") && !source.includes("reward-ledger.v2"), `active app source wires reward-ledger v2: ${sourceUrl.pathname}`);
}

console.log("REWARD LEDGER V2 SCHEMA VALID: isolated STRICT blueprint, statement-level no-REPLACE immutability, persistent six-action replay keys, contiguous first-1000 Genesis acceptance, capped daily epochs with structurally bound frozen V1 algorithm/domain attestations, antecedent allocator batch/receipt matching, post-original-round Premium ancestry, atomic tranches, +1-second nulls, and terminal receipts are pinned without activation; authenticated clock/persistence, allocator authentication, SHA recomputation, and top-N completeness remain explicit adapter gates.");
