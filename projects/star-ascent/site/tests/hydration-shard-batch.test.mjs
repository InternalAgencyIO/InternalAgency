import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createHydrationShardBatchSummary,
  hydrationBatchSummarySchema,
  hydrationShardBatchRangeFromEnvironment,
} from "../scripts/hydration-shard-batch.mjs";
import {
  hydrationShardRecordSchema,
  hydrationSourceScopePath,
} from "../scripts/hydration-shard-evidence.mjs";

const sourceBinding = {
  commit: "a".repeat(40),
  tree: "b".repeat(40),
  scopePath: hydrationSourceScopePath,
  scopeTree: "c".repeat(40),
};

function record(shardIndex) {
  return {
    schema: hydrationShardRecordSchema,
    status: "SHARD_PASS_NOT_AGGREGATE",
    recordedAtUtc: `2026-08-05T00:${String(shardIndex).padStart(2, "0")}:00.000Z`,
    sourceBinding,
    profile: { shardIndex, assignedJobsSha256: String(shardIndex).padStart(64, "0") },
    result: { completedPages: 150, failedPages: 0, incompletePages: 0 },
    assurance: { aggregateComplete: false },
    mainnetStatus: "UNSCHEDULED_HOLD",
  };
}

test("batch ranges are exact, bounded, and owned by the batch runner", () => {
  assert.deepEqual(hydrationShardBatchRangeFromEnvironment({}), {
    shardStart: 1,
    shardEnd: 50,
    shardIndexes: Array.from({ length: 50 }, (_, index) => index + 1),
  });
  assert.deepEqual(hydrationShardBatchRangeFromEnvironment({
    I18N_HYDRATION_SHARD_START: "11",
    I18N_HYDRATION_SHARD_END: "20",
  }), {
    shardStart: 11,
    shardEnd: 20,
    shardIndexes: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  });
  assert.throws(() => hydrationShardBatchRangeFromEnvironment({ I18N_HYDRATION_SHARD_START: "0" }), /integer from 1 through 50/);
  assert.throws(() => hydrationShardBatchRangeFromEnvironment({ I18N_HYDRATION_SHARD_END: "2.5" }), /integer from 1 through 50/);
  assert.throws(() => hydrationShardBatchRangeFromEnvironment({
    I18N_HYDRATION_SHARD_START: "20",
    I18N_HYDRATION_SHARD_END: "10",
  }), /must not exceed/);
  assert.throws(() => hydrationShardBatchRangeFromEnvironment({ I18N_HYDRATION_SHARD_INDEX: "1" }), /owns/);
  assert.throws(() => hydrationShardBatchRangeFromEnvironment({ I18N_HYDRATION_EMIT_SHARD_RECORD: "1" }), /owns/);
});

test("partial batch summaries remain explicit, deterministic, source-bound HOLD evidence", () => {
  const records = [record(11), record(12), record(13)];
  const summary = createHydrationShardBatchSummary({ records, shardStart: 11, shardEnd: 13, sourceBinding });
  assert.equal(summary.schema, hydrationBatchSummarySchema);
  assert.equal(summary.status, "PARTIAL_PASS_NOT_AGGREGATE");
  assert.deepEqual(summary.range, { shardStart: 11, shardEnd: 13 });
  assert.deepEqual(summary.result, {
    shardRecords: 3,
    completedPages: 450,
    failedPages: 0,
    incompletePages: 0,
    remainingShards: 47,
    remainingPages: 7_050,
  });
  assert.equal(summary.assurance.aggregateComplete, false);
  assert.equal(summary.mainnetStatus, "UNSCHEDULED_HOLD");
  assert.match(summary.evidenceSetSha256, /^[0-9a-f]{64}$/u);
  assert.equal(
    summary.evidenceSetSha256,
    createHydrationShardBatchSummary({ records, shardStart: 11, shardEnd: 13, sourceBinding }).evidenceSetSha256,
  );
});

test("partial batch summaries reject gaps, drift, failure, and aggregate overclaim", () => {
  assert.throws(
    () => createHydrationShardBatchSummary({ records: [record(11), record(13)], shardStart: 11, shardEnd: 12, sourceBinding }),
    /differs from 12/,
  );
  const drifted = record(11);
  drifted.sourceBinding = { ...sourceBinding, tree: "d".repeat(40) };
  assert.throws(
    () => createHydrationShardBatchSummary({ records: [drifted], shardStart: 11, shardEnd: 11, sourceBinding }),
    /changed during shard execution/,
  );
  const failed = record(11);
  failed.result.failedPages = 1;
  assert.throws(
    () => createHydrationShardBatchSummary({ records: [failed], shardStart: 11, shardEnd: 11, sourceBinding }),
    /failed or incomplete/,
  );
  const overclaim = record(11);
  overclaim.assurance.aggregateComplete = true;
  assert.throws(
    () => createHydrationShardBatchSummary({ records: [overclaim], shardStart: 11, shardEnd: 11, sourceBinding }),
    /improperly claims aggregate completion/,
  );
  assert.throws(
    () => createHydrationShardBatchSummary({
      records: Array.from({ length: 50 }, (_, index) => record(index + 1)),
      shardStart: 1,
      shardEnd: 50,
      sourceBinding,
    }),
    /must use aggregate reconciliation/,
  );
});

test("batch command builds once, then executes shards directly and reconciles only a full set", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["check:i18n:dual-host-hydration-batch"], /^npm run build && /u);
  assert.match(packageJson.scripts["check:i18n:dual-host-hydration-batch"], /run-dual-host-hydration-shards\.mjs$/u);
  const runner = readFileSync(new URL("../scripts/run-dual-host-hydration-shards.mjs", import.meta.url), "utf8");
  assert.match(runner, /spawnSync\(process\.execPath, \[checkerPath\]/u);
  assert.match(runner, /records\.length === exhaustiveLocaleShardCount/u);
  assert.match(runner, /reconcileHydrationShardRecords/u);
  assert.match(runner, /createHydrationShardBatchSummary/u);
  assert.doesNotMatch(runner, /npm run build/u);
});
