import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const auditRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(auditRoot, "..", "..", "..");
const siteRoot = resolve(repositoryRoot, "projects", "star-ascent", "site");
const evidencePath = resolve(auditRoot, "pre-funding-qa-20260805-nightflight-hydration-ledger.json");
const scorecardPath = resolve(siteRoot, "public", "audits", "localization-qa-20260803", "language-qa-scorecard.json");
const catalogPath = resolve(siteRoot, "app", "i18n", "messages.json");
const gitNoLfsFilters = [
  "-c", "filter.lfs.clean=",
  "-c", "filter.lfs.smudge=",
  "-c", "filter.lfs.process=",
  "-c", "filter.lfs.required=false",
];

function fail(message) {
  throw new Error(`pre-funding QA evidence validation failed: ${message}`);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function exactKeys(value, keys) {
  return value && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function git(...args) {
  return execFileSync("git", [...gitNoLfsFilters, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
}

function isAncestor(ancestor, descendant) {
  return spawnSync("git", [...gitNoLfsFilters, "merge-base", "--is-ancestor", ancestor, descendant], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).status === 0;
}

const evidenceText = readFileSync(evidencePath, "utf8");
const evidence = JSON.parse(evidenceText);
check(!/(^|["'\s])[A-Za-z]:[\\/]/mu.test(evidenceText), "workstation paths are forbidden");
check(exactKeys(evidence, [
  "schema", "status", "recordedAtUtc", "timeBasis", "sourceBinding", "scope", "checks", "hydration",
  "historicalHydration", "languageQa", "assurance", "mainnetStatus", "limitations",
]), "top-level contract drifted");
check(evidence.schema === "iat-pre-funding-current-source-qa/v1", "schema drifted");
check(evidence.status === "PARTIAL_PASS_NOT_LAUNCH_APPROVAL", "status must remain partial and non-authorizing");
check(evidence.timeBasis === "LATEST_RECORDED_CHECK_TIME", "timestamp basis drifted");
check(Number.isFinite(Date.parse(evidence.recordedAtUtc)), "recordedAtUtc is invalid");

const binding = evidence.sourceBinding;
check(/^[0-9a-f]{40}$/u.test(binding.commit), "source commit is invalid");
check(git("rev-parse", `${binding.commit}^{tree}`) === binding.tree, "source tree binding drifted");
check(git("rev-parse", `${binding.commit}:${binding.sitePath}`) === binding.siteTree, "site tree binding drifted");
check(isAncestor(binding.commit, git("rev-parse", "HEAD")), "evidence checkout does not descend from its source commit");
check(git("rev-parse", `HEAD:${binding.sitePath}`) === binding.siteTree, "current evidence commit changed the tested site tree");
for (const commit of evidence.scope.observedCommits) {
  check(/^[0-9a-f]{40}$/u.test(commit) && isAncestor(commit, binding.commit), `observed commit is not bound: ${commit}`);
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const catalogSha256 = createHash("sha256").update(JSON.stringify(catalog.messages)).digest("hex");
check(catalogSha256 === binding.catalogSha256, "catalog digest drifted");
check(evidence.scope.pullRequest === 4 && evidence.scope.draftRequired === true, "Draft PR scope drifted");
check(evidence.scope.nightflightRooms === 10 && evidence.scope.nightflightAssets === 15, "Nightflight scope drifted");
check(evidence.scope.localeCount === 50 && evidence.scope.canonicalRoutes === 25, "locale/route scope drifted");

const expectedChecks = new Map([
  ["nightflight-future-teasers", { passed: 11, failed: 0 }],
  ["production-build", { passed: null, failed: 0 }],
  ["rendered-route-seo", { passed: 33, failed: 0 }],
  ["hosting-config", { passed: null, failed: 0 }],
  ["casino-playwright", { passed: 9, failed: 0, skipped: 12 }],
]);
check(evidence.checks.length === expectedChecks.size, "check inventory drifted");
for (const result of evidence.checks) {
  const expected = expectedChecks.get(result.id);
  check(expected && result.status === "PASS", `check is not PASS: ${result.id}`);
  check(result.passed === expected.passed && result.failed === expected.failed, `check totals drifted: ${result.id}`);
  if (expected.skipped !== undefined) check(result.skipped === expected.skipped, `check skip total drifted: ${result.id}`);
  check(typeof result.command === "string" && result.command.length > 5, `check command missing: ${result.id}`);
}

const hydration = evidence.hydration;
check(hydration.schema === "iat-v2-hydration-partial-evidence/v1", "hydration schema drifted");
check(hydration.status === "PARTIAL_PASS_NOT_AGGREGATE", "hydration status overclaims aggregate proof");
check(hydration.batches.length === 1, "current hydration batch count drifted");
const currentBatch = hydration.batches[0];
check(JSON.stringify(currentBatch.range) === JSON.stringify({ shardStart: 1, shardEnd: 2 }), "current hydration range drifted");
check(currentBatch.evidenceSetSha256 === "6ba1ed0069ba9b9b51694c7aa80aefb0dff4f0f19e3447c5d85a5d1fa2b23086", "current hydration digest drifted");
check(currentBatch.sourceBinding.commit === binding.commit && currentBatch.sourceBinding.tree === binding.tree, "current hydration source drifted");
check(currentBatch.sourceBinding.scopePath === binding.sitePath && currentBatch.sourceBinding.scopeTree === binding.siteTree, "current hydration site scope drifted");
check(
  hydration.completedShards === 2 && hydration.requiredShards === 50
    && hydration.completedPages === 300 && hydration.fullProfilePages === 7500
    && hydration.failedPages === 0 && hydration.incompletePages === 0,
  "hydration summary drifted",
);
check(hydration.records.length === 2, "current hydration record count drifted");
const expectedLocales = ["ar", "az"];
const expectedAssignments = [
  "52ee9742123e36e8b089badd7ad4c9e436e085283dd4f3e84898c1baa9dd9b65",
  "fe6253897dd7ce61da6f741f20114dbee46ed3e1079ea6510c963eec3008fafb",
];
for (const [index, record] of hydration.records.entries()) {
  check(record.schema === "iat-v2-hydration-shard-record/v2", `shard ${index + 1} schema drifted`);
  check(record.status === "SHARD_PASS_NOT_AGGREGATE", `shard ${index + 1} overclaims aggregate proof`);
  check(Number.isFinite(Date.parse(record.recordedAtUtc)), `shard ${index + 1} timestamp drifted`);
  check(/^[0-9a-f]{40}$/u.test(record.sourceBinding.commit), `shard ${index + 1} source commit is invalid`);
  check(git("rev-parse", `${record.sourceBinding.commit}^{tree}`) === record.sourceBinding.tree, `shard ${index + 1} source tree is not Git-bound`);
  check(isAncestor(record.sourceBinding.commit, binding.commit), `shard ${index + 1} does not precede the evidence source`);
  check(record.sourceBinding.scopePath === binding.sitePath && record.sourceBinding.scopeTree === binding.siteTree, `shard ${index + 1} site scope drifted`);
  check(git("rev-parse", `${record.sourceBinding.commit}:${record.sourceBinding.scopePath}`) === binding.siteTree, `shard ${index + 1} site tree is not Git-bound`);
  check(record.catalogSha256 === binding.catalogSha256, `shard ${index + 1} catalog binding drifted`);
  check(record.profile.shardIndex === index + 1 && record.profile.shardCount === 50, `shard ${index + 1} assignment index drifted`);
  check(record.profile.locale === expectedLocales[index], `shard ${index + 1} locale drifted`);
  check(JSON.stringify(record.profile.hosts) === JSON.stringify(["internalagency", "ileriakil"]), `shard ${index + 1} hosts drifted`);
  check(record.profile.canonicalRoutes === 25, `shard ${index + 1} route count drifted`);
  check(JSON.stringify(record.profile.engines) === JSON.stringify({ chromium: 50, firefox: 50, webkit: 50 }), `shard ${index + 1} engine totals drifted`);
  check(record.profile.assignedPages === 150 && record.profile.fullProfilePages === 7500, `shard ${index + 1} page totals drifted`);
  check(record.profile.assignedJobsSha256 === expectedAssignments[index], `shard ${index + 1} assignment digest drifted`);
  check(record.profile.fullProfileJobsSha256 === "1f035cca45792e63056e961dc90b6783f1d210d62968b837e3dc8216746ccbd7", `shard ${index + 1} profile digest drifted`);
  check(JSON.stringify(record.result) === JSON.stringify({ completedPages: 150, failedPages: 0, incompletePages: 0 }), `shard ${index + 1} result drifted`);
  check(Object.values(record.assurance).every((value) => value === false), `shard ${index + 1} assurance overclaims proof`);
  check(record.mainnetStatus === "UNSCHEDULED_HOLD", `shard ${index + 1} changed Mainnet status`);
}

const historical = evidence.historicalHydration;
check(historical.schema === "iat-v2-hydration-historical-evidence/v1", "historical hydration schema drifted");
check(historical.status === "HISTORICAL_PARTIAL_NOT_CURRENT_SOURCE_PROOF", "historical hydration status overclaims current proof");
check(historical.sourceBinding.siteTree === "955e1c94b81f614beddaa629d1245a055c985cb5", "historical site tree drifted");
check(historical.sourceBinding.siteTree !== binding.siteTree && historical.supersededBySiteTree === binding.siteTree, "historical/current site separation drifted");
check(git("rev-parse", `${historical.sourceBinding.commit}^{tree}`) === historical.sourceBinding.tree, "historical source tree is not Git-bound");
check(git("rev-parse", `${historical.sourceBinding.commit}:${historical.sourceBinding.sitePath}`) === historical.sourceBinding.siteTree, "historical site tree is not Git-bound");
check(isAncestor(historical.sourceBinding.commit, binding.commit), "historical source does not precede the current source");
check(
  historical.completedShards === 4 && historical.requiredShards === 50
    && historical.completedPages === 600 && historical.fullProfilePages === 7500
    && historical.failedPages === 0 && historical.incompletePages === 0,
  "historical hydration summary drifted",
);
check(historical.batches.length === 2 && historical.records.length === 4, "historical hydration inventory drifted");
const historicalBatchDigests = [
  "0ea1247f7de93eaed39e25181aac40fb709b0b5c240b23858acf537ced6e006f",
  "7e12db50a0cf135611bbfc3fc229a7a2811c1af6f5c03667e6139b671f01f20a",
];
for (const [index, batch] of historical.batches.entries()) {
  check(batch.evidenceSetSha256 === historicalBatchDigests[index], `historical batch ${index + 1} digest drifted`);
  check(git("rev-parse", `${batch.sourceBinding.commit}^{tree}`) === batch.sourceBinding.tree, `historical batch ${index + 1} source tree is not Git-bound`);
  check(batch.sourceBinding.scopeTree === historical.sourceBinding.siteTree, `historical batch ${index + 1} escaped its site tree`);
  check(git("rev-parse", `${batch.sourceBinding.commit}:${batch.sourceBinding.scopePath}`) === historical.sourceBinding.siteTree, `historical batch ${index + 1} site tree is not Git-bound`);
}
const historicalAssignments = [
  "52ee9742123e36e8b089badd7ad4c9e436e085283dd4f3e84898c1baa9dd9b65",
  "fe6253897dd7ce61da6f741f20114dbee46ed3e1079ea6510c963eec3008fafb",
  "862666f4d4df79e068a7fee240095929a75798a6360f6691efc6a1cb994dcba8",
  "c8652e2883bcdb6b6cee7967bc92d03ebf4887a379197113b5d3d6a84ee9b501",
];
for (const [index, record] of historical.records.entries()) {
  check(record.status === "SHARD_PASS_NOT_AGGREGATE", `historical shard ${index + 1} status drifted`);
  check(record.sourceBinding.scopeTree === historical.sourceBinding.siteTree, `historical shard ${index + 1} escaped its site tree`);
  check(git("rev-parse", `${record.sourceBinding.commit}:${record.sourceBinding.scopePath}`) === historical.sourceBinding.siteTree, `historical shard ${index + 1} site tree is not Git-bound`);
  check(record.profile.shardIndex === index + 1 && record.profile.assignedJobsSha256 === historicalAssignments[index], `historical shard ${index + 1} assignment drifted`);
  check(JSON.stringify(record.result) === JSON.stringify({ completedPages: 150, failedPages: 0, incompletePages: 0 }), `historical shard ${index + 1} result drifted`);
  check(Object.values(record.assurance).every((value) => value === false), `historical shard ${index + 1} assurance overclaims proof`);
}

const scorecard = JSON.parse(readFileSync(scorecardPath, "utf8"));
check(scorecard.scope.locales === 50 && scorecard.scope.checksPerLocale === 100 && scorecard.scope.results === 5000, "scorecard topology drifted");
check(JSON.stringify(scorecard.summary) === JSON.stringify(evidence.languageQa.summary), "scorecard summary drifted");
check(evidence.languageQa.nativeMeaningCadenceSlang === "ACCOUNTABLE_NATIVE_REVIEW_HOLD", "native review escaped HOLD");
check(scorecard.assurance.nativeQualityClaimAllowed === false && scorecard.assurance.releaseApproved === false, "scorecard assurance overclaims approval");
check(Object.values(evidence.assurance).every((value) => value === false), "QA assurance overclaims completion or mutation");
check(evidence.mainnetStatus === "UNSCHEDULED_HOLD", "Mainnet status changed");
check(evidence.limitations.some((item) => /two of fifty/u.test(item)), "partial hydration limitation missing");
check(evidence.limitations.some((item) => /historical partial evidence/u.test(item)), "historical hydration limitation missing");
check(evidence.limitations.some((item) => /12 explicit expected skips/u.test(item)), "browser UI limitation missing");
check(evidence.limitations.some((item) => /accountable native review/u.test(item)), "native review limitation missing");
check(evidence.limitations.some((item) => /No deployment, wallet access, signing, funding/u.test(item)), "mutation safety limitation missing");

console.log(
  `pre-funding QA evidence PASS: ${evidence.checks.length} affected gates, `
    + `${hydration.completedShards}/${hydration.requiredShards} hydration shards, `
    + `${hydration.completedPages}/${hydration.fullProfilePages} pages, Mainnet ${evidence.mainnetStatus}.`,
);
