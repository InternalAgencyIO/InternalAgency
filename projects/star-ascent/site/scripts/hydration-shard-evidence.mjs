import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { exhaustiveLocaleShardCount } from "./dual-host-locale-hydration-plan.mjs";

export const hydrationShardRecordPrefix = "HYDRATION_SHARD_RECORD ";
export const hydrationShardRecordSchema = "iat-v2-hydration-shard-record/v2";
export const hydrationAggregateSchema = "iat-v2-hydration-shard-aggregate/v2";
export const hydrationSourceScopePath = "projects/star-ascent/site";

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

function assertSourceBinding(sourceBinding, label = "Source binding") {
  assert(
    sourceBinding
      && Object.keys(sourceBinding).toSorted().join(",") === "commit,scopePath,scopeTree,tree"
      && /^[0-9a-f]{40}$/u.test(sourceBinding.commit)
      && /^[0-9a-f]{40}$/u.test(sourceBinding.tree)
      && sourceBinding.scopePath === hydrationSourceScopePath
      && /^[0-9a-f]{40}$/u.test(sourceBinding.scopeTree),
    `${label} is invalid`,
  );
}

export function assertStableHydrationSourceBinding(initialSourceBinding, completedSourceBinding) {
  assertSourceBinding(initialSourceBinding, "Initial source binding");
  assertSourceBinding(completedSourceBinding, "Completed source binding");
  assert(
    JSON.stringify(initialSourceBinding) === JSON.stringify(completedSourceBinding),
    "Hydration source binding changed during shard execution",
  );
  return completedSourceBinding;
}

export function readGitSourceBindingAtCommit(commit, cwd = process.cwd()) {
  assert(commit === "HEAD" || /^[0-9a-f]{40}$/u.test(commit), "Git source commit is invalid");
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();
  const repoRoot = git(["rev-parse", "--show-toplevel"]);
  assert(
    resolve(cwd) === resolve(repoRoot, hydrationSourceScopePath),
    `Hydration evidence must run from the fixed ${hydrationSourceScopePath} source scope`,
  );
  const resolvedCommit = git(["rev-parse", `${commit}^{commit}`]);
  const sourceBinding = {
    commit: resolvedCommit,
    tree: git(["rev-parse", `${resolvedCommit}^{tree}`]),
    scopePath: hydrationSourceScopePath,
    scopeTree: git(["rev-parse", `${resolvedCommit}:${hydrationSourceScopePath}`]),
  };
  assertSourceBinding(sourceBinding, "Git source binding");
  return sourceBinding;
}

export function createGitSourceBindingResolver(cwd = process.cwd()) {
  const cache = new Map();
  return (commit) => {
    if (!cache.has(commit)) cache.set(commit, readGitSourceBindingAtCommit(commit, cwd));
    return cache.get(commit);
  };
}

export function readCleanGitSourceBinding(cwd = process.cwd()) {
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();
  const worktreeChanges = git(["status", "--porcelain"]);
  assert(worktreeChanges === "", "Shard evidence requires a clean worktree with no tracked or untracked changes");
  return readGitSourceBindingAtCommit("HEAD", cwd);
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
  assertSourceBinding(sourceBinding);

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

export function decodeHydrationShardLog(bytes, label = "log") {
  assert(Buffer.isBuffer(bytes), `${label} must be read as bytes`);
  let encoding = "utf-8";
  let offset = 0;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf-16le";
    offset = 2;
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf-16be";
    offset = 2;
  }
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(offset));
  } catch (error) {
    throw new Error(`${label} is not valid ${encoding}: ${error instanceof Error ? error.message : String(error)}`);
  }
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
  currentSourceBinding,
  sourceBindingResolver,
}) {
  assert(records.length === exhaustiveLocaleShardCount, `Expected 50 shard records; found ${records.length}`);
  assert(expectedShardPlans.length === exhaustiveLocaleShardCount, "Expected plans must contain all 50 shards");
  assert(typeof sourceBindingResolver === "function", "Source binding resolver is required");
  assertSourceBinding(currentSourceBinding, "Current source binding");
  assert(
    JSON.stringify(sourceBindingResolver(currentSourceBinding.commit)) === JSON.stringify(currentSourceBinding),
    "Current source binding is not Git-verifiable",
  );
  const fullProfileJobsSha256 = hydrationJobSetSha256(fullProfilePlans);
  const seen = new Set();
  const evidenceSourceBindings = new Map();

  for (const record of records) {
    assert(record?.schema === hydrationShardRecordSchema, "Unexpected shard record schema");
    assert(record.status === "SHARD_PASS_NOT_AGGREGATE", `Shard ${record?.profile?.shardIndex ?? "?"} is not PASS`);
    const index = record.profile?.shardIndex;
    assert(Number.isSafeInteger(index) && index >= 1 && index <= exhaustiveLocaleShardCount, "Shard record index is invalid");
    assert(!seen.has(index), `Duplicate shard record ${index}`);
    seen.add(index);
    const expectedPlans = expectedShardPlans[index - 1];
    const expectedLocale = expectedPlans[0].jobs[0].locale;
    assertSourceBinding(record.sourceBinding, `Shard ${index} source binding`);
    const resolvedSourceBinding = sourceBindingResolver(record.sourceBinding.commit);
    assert(
      JSON.stringify(record.sourceBinding) === JSON.stringify(resolvedSourceBinding),
      `Shard ${index} source binding is not Git-verifiable`,
    );
    assert(record.sourceBinding.scopePath === currentSourceBinding.scopePath, `Shard ${index} source scope differs`);
    assert(record.sourceBinding.scopeTree === currentSourceBinding.scopeTree, `Shard ${index} scoped tree differs`);
    evidenceSourceBindings.set(record.sourceBinding.commit, record.sourceBinding);
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
    sourceBinding: currentSourceBinding,
    sourceEquivalence: {
      scopePath: currentSourceBinding.scopePath,
      scopeTree: currentSourceBinding.scopeTree,
      evidenceSourceBindings: [...evidenceSourceBindings.values()].toSorted((left, right) =>
        left.commit.localeCompare(right.commit)),
    },
    catalogSha256,
    evidenceSetSha256: sha256(JSON.stringify(records
      .toSorted((left, right) => left.profile.shardIndex - right.profile.shardIndex)
      .map((record) => [
        record.profile.shardIndex,
        record.recordedAtUtc,
        record.sourceBinding,
        record.profile.assignedJobsSha256,
      ]))),
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
