import { exhaustiveLocaleShardCount } from "./dual-host-locale-hydration-plan.mjs";
import {
  assertStableHydrationSourceBinding,
  hydrationEvidenceSetSha256,
  hydrationShardRecordSchema,
} from "./hydration-shard-evidence.mjs";

export const hydrationBatchSummaryPrefix = "HYDRATION_BATCH_SUMMARY ";
export const hydrationBatchSummarySchema = "iat-v2-hydration-shard-batch-summary/v1";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseShardBoundary(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  assert(
    Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= exhaustiveLocaleShardCount,
    `${name} must be an integer from 1 through ${exhaustiveLocaleShardCount}; received ${value}`,
  );
  return parsed;
}

export function hydrationShardBatchRangeFromEnvironment(environment = {}) {
  assert(
    environment.I18N_HYDRATION_SHARD_INDEX === undefined,
    "Batch execution owns I18N_HYDRATION_SHARD_INDEX",
  );
  assert(
    environment.I18N_HYDRATION_EMIT_SHARD_RECORD === undefined,
    "Batch execution owns I18N_HYDRATION_EMIT_SHARD_RECORD",
  );
  const shardStart = parseShardBoundary(environment.I18N_HYDRATION_SHARD_START, 1, "I18N_HYDRATION_SHARD_START");
  const shardEnd = parseShardBoundary(
    environment.I18N_HYDRATION_SHARD_END,
    exhaustiveLocaleShardCount,
    "I18N_HYDRATION_SHARD_END",
  );
  assert(shardStart <= shardEnd, "I18N_HYDRATION_SHARD_START must not exceed I18N_HYDRATION_SHARD_END");
  return {
    shardStart,
    shardEnd,
    shardIndexes: Array.from({ length: shardEnd - shardStart + 1 }, (_, offset) => shardStart + offset),
  };
}

export function createHydrationShardBatchSummary({ records, shardStart, shardEnd, sourceBinding }) {
  const expectedIndexes = Array.from({ length: shardEnd - shardStart + 1 }, (_, offset) => shardStart + offset);
  assert(expectedIndexes.length < exhaustiveLocaleShardCount, "A complete 50-shard set must use aggregate reconciliation");
  assert(records.length === expectedIndexes.length, `Expected ${expectedIndexes.length} batch records; found ${records.length}`);
  assertStableHydrationSourceBinding(sourceBinding, sourceBinding);
  for (const [offset, record] of records.entries()) {
    const expectedIndex = expectedIndexes[offset];
    assert(record?.schema === hydrationShardRecordSchema, `Batch record ${expectedIndex} schema is invalid`);
    assert(record.status === "SHARD_PASS_NOT_AGGREGATE", `Batch record ${expectedIndex} is not PASS`);
    assert(record.profile?.shardIndex === expectedIndex, `Batch record index ${record.profile?.shardIndex} differs from ${expectedIndex}`);
    assert(record.result?.completedPages === 150, `Batch record ${expectedIndex} completion count differs`);
    assert(record.result?.failedPages === 0 && record.result?.incompletePages === 0, `Batch record ${expectedIndex} is failed or incomplete`);
    assertStableHydrationSourceBinding(sourceBinding, record.sourceBinding);
    assert(record.assurance?.aggregateComplete === false, `Batch record ${expectedIndex} improperly claims aggregate completion`);
    assert(record.mainnetStatus === "UNSCHEDULED_HOLD", `Batch record ${expectedIndex} changes Mainnet HOLD`);
  }
  return {
    schema: hydrationBatchSummarySchema,
    status: "PARTIAL_PASS_NOT_AGGREGATE",
    sourceBinding,
    range: { shardStart, shardEnd },
    evidenceSetSha256: hydrationEvidenceSetSha256(records),
    result: {
      shardRecords: records.length,
      completedPages: records.length * 150,
      failedPages: 0,
      incompletePages: 0,
      remainingShards: exhaustiveLocaleShardCount - records.length,
      remainingPages: 7_500 - records.length * 150,
    },
    assurance: {
      aggregateComplete: false,
      independent: false,
      nativeLanguageApproval: false,
      deploymentPerformed: false,
      mainnetChanged: false,
    },
    mainnetStatus: "UNSCHEDULED_HOLD",
  };
}
