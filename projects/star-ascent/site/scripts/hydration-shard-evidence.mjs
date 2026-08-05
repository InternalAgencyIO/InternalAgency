import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import { exhaustiveLocaleShardCount } from "./dual-host-locale-hydration-plan.mjs";

export const hydrationShardRecordPrefix = "HYDRATION_SHARD_RECORD ";
export const hydrationShardRecordSchema = "iat-v2-hydration-shard-record/v1";
export const hydrationAggregateSchema = "iat-v2-hydration-shard-aggregate/v1";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function hydrationJobKeys(plans) {
  return plans.flatMap((plan) => plan.jobs.map((job) =>
    `${plan.engineName}\u0000${job.host}\u0000${job.locale}\u0000${job.route}`));
}

export function hydrationJobSetSha256(plans) {
  return sha256(JSON.stringify(hydrationJobKeys(plans)));
}

export function readCleanGitSourceBinding(cwd = process.cwd()) {
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();
  const worktreeChanges = git(["status", "--porcelain"]);
  assert(worktreeChanges === "", "Shard evidence requires a clean worktree with no tracked or untracked changes");
  const commit = git(["rev-parse", "HEAD"]);
  const tree = git(["rev-parse", "HEAD^{tree}"]);
  assert(/^[0-9a-f]{40}$/u.test(commit), "Shard evidence commit binding is invalid");
  assert(/^[0-9a-f]{40}$/u.test(tree), "Shard evidence tree binding is invalid");
  return { commit, tree };
}

export function createHydrationShardRecord({
  shardPlans,
  fullProfilePlans,
  shardIndex,
  catalogSha256,
  sourceBinding,
  recordedAtUtc = new Date().toISOString(),
}) {
  const assignedJobs = hydrationJobKeys(shardPlans);
  const fullJobs = hydrationJobKeys(fullProfilePlans);
  const locales = new Set(shardPlans.flatMap((plan) => plan.jobs.map((job) => job.locale)));
  assert(Number.isSafeInteger(shardIndex) && shardIndex >= 1 && shardIndex <= exhaustiveLocaleShardCount, "Invalid shard index");
  assert(assignedJobs.length === 150 && new Set(assignedJobs).size === 150, "A shard must contain 150 unique jobs");
  assert(fullJobs.length === 7_500 && new Set(fullJobs).size === 7_500, "The exhaustive profile must contain 7,500 unique jobs");
  assert(locales.size === 1, "A shard must contain exactly one locale");
  assert(/^[0-9a-f]{64}$/u.test(catalogSha256), "Catalog digest is invalid");
  assert(/^[0-9a-f]{40}$/u.test(sourceBinding.commit) && /^[0-9a-f]{40}$/u.test(sourceBinding.tree), "Source binding is invalid");

  return {
    schema: hydrationShardRecordSchema,
    status: "SHARD_PASS_NOT_AGGREGATE",
    recordedAtUtc,
    sourceBinding: { ...sourceBinding },
    catalogSha256,
    profile: {
      shardIndex,
      shardCount: exhaustiveLocaleShardCount,
      locale: [...locales][0],
      hosts: ["internalagency", "ileriakil"],
      canonicalRoutes: 25,
      engines: { chromium: 50, firefox: 50, webkit: 50 },
      assignedPages: 150,
      fullProfilePages: 7_500,
      assignedJobsSha256: hydrationJobSetSha256(shardPlans),
      fullProfileJobsSha256: hydrationJobSetSha256(fullProfilePlans),
    },
    result: { completedPages: 150, failedPages: 0, incompletePages: 0 },
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

export function parseHydrationShardRecordLog(logText, label = "log") {
  const matches = logText.split(/\r?\n/u).filter((line) => line.startsWith(hydrationShardRecordPrefix));
  assert(matches.length === 1, `${label} must contain exactly one shard record; found ${matches.length}`);
  try {
    return JSON.parse(matches[0].slice(hydrationShardRecordPrefix.length));
  } catch (error) {
    throw new Error(`${label} shard record is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function reconcileHydrationShardRecords({
  records,
  expectedShardPlans,
  fullProfilePlans,
  catalogSha256,
  sourceBinding,
}) {
  assert(records.length === exhaustiveLocaleShardCount, `Expected 50 shard records; found ${records.length}`);
  assert(expectedShardPlans.length === exhaustiveLocaleShardCount, "Expected plans must contain all 50 shards");
  const fullProfileJobsSha256 = hydrationJobSetSha256(fullProfilePlans);
  const seen = new Set();

  for (const record of records) {
    assert(record?.schema === hydrationShardRecordSchema, "Unexpected shard record schema");
    assert(record.status === "SHARD_PASS_NOT_AGGREGATE", `Shard ${record?.profile?.shardIndex ?? "?"} is not PASS`);
    const index = record.profile?.shardIndex;
    assert(Number.isSafeInteger(index) && index >= 1 && index <= exhaustiveLocaleShardCount, "Shard record index is invalid");
    assert(!seen.has(index), `Duplicate shard record ${index}`);
    seen.add(index);
    const expectedPlans = expectedShardPlans[index - 1];
    const expectedLocale = expectedPlans[0].jobs[0].locale;
    assert(record.sourceBinding?.commit === sourceBinding.commit, `Shard ${index} commit binding differs`);
    assert(record.sourceBinding?.tree === sourceBinding.tree, `Shard ${index} tree binding differs`);
    assert(record.catalogSha256 === catalogSha256, `Shard ${index} catalog binding differs`);
    assert(record.profile.shardCount === exhaustiveLocaleShardCount, `Shard ${index} count differs`);
    assert(record.profile.locale === expectedLocale, `Shard ${index} locale assignment differs`);
    assert(record.profile.assignedPages === 150 && record.profile.fullProfilePages === 7_500, `Shard ${index} page topology differs`);
    assert(record.profile.assignedJobsSha256 === hydrationJobSetSha256(expectedPlans), `Shard ${index} assigned-job digest differs`);
    assert(record.profile.fullProfileJobsSha256 === fullProfileJobsSha256, `Shard ${index} full-profile digest differs`);
    assert(JSON.stringify(record.profile.engines) === JSON.stringify({ chromium: 50, firefox: 50, webkit: 50 }), `Shard ${index} engine topology differs`);
    assert(record.result?.completedPages === 150, `Shard ${index} completion count differs`);
    assert(record.result?.failedPages === 0 && record.result?.incompletePages === 0, `Shard ${index} is failed or incomplete`);
    assert(record.assurance?.aggregateComplete === false, `Shard ${index} improperly claims aggregate completion`);
    assert(record.mainnetStatus === "UNSCHEDULED_HOLD", `Shard ${index} changes Mainnet HOLD`);
  }

  assert(seen.size === exhaustiveLocaleShardCount, "Shard index coverage is incomplete");
  return {
    schema: hydrationAggregateSchema,
    status: "PASS",
    sourceBinding,
    catalogSha256,
    evidenceSetSha256: sha256(JSON.stringify(records
      .toSorted((left, right) => left.profile.shardIndex - right.profile.shardIndex)
      .map((record) => [record.profile.shardIndex, record.recordedAtUtc, record.profile.assignedJobsSha256]))),
    result: {
      shardRecords: 50,
      plannedPages: 7_500,
      completedPages: 7_500,
      failedPages: 0,
      incompletePages: 0,
      fullProfileJobsSha256,
    },
    assurance: {
      independent: false,
      nativeLanguageApproval: false,
      deploymentPerformed: false,
      mainnetChanged: false,
    },
    mainnetStatus: "UNSCHEDULED_HOLD",
  };
}
