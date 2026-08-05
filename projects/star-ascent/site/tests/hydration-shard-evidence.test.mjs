import assert from "node:assert/strict";
import test from "node:test";

import { createHydrationPlans } from "../scripts/dual-host-locale-hydration-plan.mjs";
import {
  createHydrationShardRecord,
  decodeHydrationShardLog,
  hydrationAggregateSchema,
  hydrationShardRecordPrefix,
  hydrationSourceScopePath,
  parseHydrationShardRecordLog,
  reconcileHydrationShardRecords,
} from "../scripts/hydration-shard-evidence.mjs";

const locales = ["en", "tr", "hr", ...Array.from({ length: 47 }, (_, index) => `l${String(index).padStart(2, "0")}`)];
const routes = [
  "/",
  "/dossier/read/white-dossier",
  "/future",
  "/network",
  "/tokenomics",
  ...Array.from({ length: 20 }, (_, index) => `/route-${index + 1}`),
];
const engineNames = ["chromium", "firefox", "webkit"];
const catalogSha256 = "a".repeat(64);
const evidenceSourceBinding = {
  commit: "b".repeat(40),
  tree: "c".repeat(40),
  scopePath: hydrationSourceScopePath,
  scopeTree: "d".repeat(40),
};
const alternateEquivalentSourceBinding = {
  commit: "1".repeat(40),
  tree: "2".repeat(40),
  scopePath: hydrationSourceScopePath,
  scopeTree: evidenceSourceBinding.scopeTree,
};
const currentSourceBinding = {
  commit: "e".repeat(40),
  tree: "f".repeat(40),
  scopePath: hydrationSourceScopePath,
  scopeTree: evidenceSourceBinding.scopeTree,
};
const scopedDriftSourceBinding = {
  commit: "3".repeat(40),
  tree: "4".repeat(40),
  scopePath: hydrationSourceScopePath,
  scopeTree: "5".repeat(40),
};
const bindingsByCommit = new Map([
  evidenceSourceBinding,
  alternateEquivalentSourceBinding,
  currentSourceBinding,
  scopedDriftSourceBinding,
].map((binding) => [binding.commit, binding]));
const sourceBindingResolver = (commit) => {
  const binding = bindingsByCommit.get(commit);
  assert.ok(binding, `Unknown source commit ${commit}`);
  return binding;
};
const fullProfilePlans = createHydrationPlans({ locales, routes, engineNames, fullCrossEngine: true });
const expectedShardPlans = Array.from({ length: 50 }, (_, offset) =>
  createHydrationPlans({ locales, routes, engineNames, fullCrossEngine: true, shardIndex: offset + 1 }));
const records = expectedShardPlans.map((shardPlans, offset) => createHydrationShardRecord({
  shardPlans,
  fullProfilePlans,
  shardIndex: offset + 1,
  catalogSha256,
  sourceBinding: evidenceSourceBinding,
  recordedAtUtc: `2026-08-05T00:${String(offset).padStart(2, "0")}:00.000Z`,
}));

function reconcile(candidateRecords = records, candidateCurrentSourceBinding = currentSourceBinding) {
  return reconcileHydrationShardRecords({
    records: candidateRecords,
    expectedShardPlans,
    fullProfilePlans,
    catalogSha256,
    currentSourceBinding: candidateCurrentSourceBinding,
    sourceBindingResolver,
  });
}

test("shard records remain explicitly partial and bind one exact 150-page assignment", () => {
  const record = records[0];
  assert.equal(record.status, "SHARD_PASS_NOT_AGGREGATE");
  assert.equal(record.profile.shardCount, 50);
  assert.equal(record.profile.assignedPages, 150);
  assert.deepEqual(record.profile.engines, { chromium: 50, firefox: 50, webkit: 50 });
  assert.deepEqual(record.result, { completedPages: 150, failedPages: 0, incompletePages: 0 });
  assert.deepEqual(record.sourceBinding, evidenceSourceBinding);
  assert.equal(record.assurance.aggregateComplete, false);
  assert.equal(record.mainnetStatus, "UNSCHEDULED_HOLD");
});

test("record parser accepts exactly one prefixed JSON record", () => {
  const log = `progress\n${hydrationShardRecordPrefix}${JSON.stringify(records[0])}\ncomplete\n`;
  assert.deepEqual(parseHydrationShardRecordLog(log), records[0]);
  assert.equal(decodeHydrationShardLog(Buffer.from(log, "utf8")), log);
  assert.equal(
    decodeHydrationShardLog(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(log, "utf16le")])),
    log,
  );
  assert.throws(() => decodeHydrationShardLog(Buffer.from([0xc3, 0x28])), /not valid utf-8/);
  assert.throws(() => parseHydrationShardRecordLog("no record"), /exactly one shard record/);
  assert.throws(() => parseHydrationShardRecordLog(`${log}${log}`), /found 2/);
  assert.throws(() => parseHydrationShardRecordLog(`${hydrationShardRecordPrefix}{broken`), /not valid JSON/);
});

test("all 50 Git-verified scoped records reconcile to one 7,500-page aggregate", () => {
  const aggregate = reconcile();
  assert.equal(aggregate.schema, hydrationAggregateSchema);
  assert.equal(aggregate.status, "PASS");
  assert.deepEqual(aggregate.result, {
    shardRecords: 50,
    plannedPages: 7_500,
    completedPages: 7_500,
    failedPages: 0,
    incompletePages: 0,
    fullProfileJobsSha256: records[0].profile.fullProfileJobsSha256,
  });
  assert.deepEqual(aggregate.sourceBinding, currentSourceBinding);
  assert.deepEqual(aggregate.sourceEquivalence, {
    scopePath: hydrationSourceScopePath,
    scopeTree: evidenceSourceBinding.scopeTree,
    evidenceSourceBindings: [evidenceSourceBinding],
  });
  assert.equal(aggregate.mainnetStatus, "UNSCHEDULED_HOLD");
  assert.match(aggregate.evidenceSetSha256, /^[0-9a-f]{64}$/u);
});

test("whole-repository commit drift is accepted only when the Git-verified site scope is identical", () => {
  const equivalentRecords = structuredClone(records);
  for (let index = 0; index < equivalentRecords.length; index += 2) {
    equivalentRecords[index].sourceBinding = alternateEquivalentSourceBinding;
  }
  const aggregate = reconcile(equivalentRecords);
  assert.notEqual(aggregate.evidenceSetSha256, reconcile(records).evidenceSetSha256);
  assert.deepEqual(
    new Set(aggregate.sourceEquivalence.evidenceSourceBindings.map((binding) => binding.commit)),
    new Set([evidenceSourceBinding.commit, alternateEquivalentSourceBinding.commit]),
  );
  assert.equal(aggregate.sourceBinding.commit, currentSourceBinding.commit);
});

test("reconciliation fails closed on missing, duplicate, failed, drifted, or overclaimed evidence", () => {
  assert.throws(() => reconcile(records.slice(1)), /Expected 50 shard records; found 49/);

  const duplicate = structuredClone(records);
  duplicate[1].profile.shardIndex = 1;
  assert.throws(() => reconcile(duplicate), /Duplicate shard record 1/);

  const failed = structuredClone(records);
  failed[4].status = "FAIL";
  assert.throws(() => reconcile(failed), /Shard 5 is not PASS/);

  const sourceDrift = structuredClone(records);
  sourceDrift[6].sourceBinding.commit = "0".repeat(40);
  assert.throws(() => reconcile(sourceDrift), /Unknown source commit/);

  const sourceTreeSubstitution = structuredClone(records);
  sourceTreeSubstitution[6].sourceBinding.tree = "0".repeat(40);
  assert.throws(() => reconcile(sourceTreeSubstitution), /Shard 7 source binding is not Git-verifiable/);

  const scopedDrift = structuredClone(records);
  scopedDrift[6].sourceBinding = scopedDriftSourceBinding;
  assert.throws(() => reconcile(scopedDrift), /Shard 7 scoped tree differs/);

  const scopedPathSubstitution = structuredClone(records);
  scopedPathSubstitution[6].sourceBinding.scopePath = "projects/star-ascent";
  assert.throws(() => reconcile(scopedPathSubstitution), /Shard 7 source binding is invalid/);

  const unverifiableCurrent = { ...currentSourceBinding, tree: "0".repeat(40) };
  assert.throws(() => reconcile(records, unverifiableCurrent), /Current source binding is not Git-verifiable/);

  const assignmentDrift = structuredClone(records);
  assignmentDrift[8].profile.assignedJobsSha256 = "e".repeat(64);
  assert.throws(() => reconcile(assignmentDrift), /Shard 9 assigned-job digest differs/);

  const incomplete = structuredClone(records);
  incomplete[10].result.incompletePages = 1;
  assert.throws(() => reconcile(incomplete), /Shard 11 is failed or incomplete/);

  const overclaim = structuredClone(records);
  overclaim[12].assurance.aggregateComplete = true;
  assert.throws(() => reconcile(overclaim), /Shard 13 improperly claims aggregate completion/);
});
