import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(siteRoot, "..", "..", "..");
const auditDir = join(siteRoot, "public", "audits", "iat-v2-architecture-work-20260805");
const readJson = (name) => JSON.parse(readFileSync(join(auditDir, name), "utf8"));
const manifest = readJson("manifest.json");
const ledger = readJson("work-ledger.json");
const proof = readJson("hydration-proof.json");
const reviewedLocalizationPolicy = JSON.parse(readFileSync(join(siteRoot, "app", "i18n", "reviewed-localization-policy.json"), "utf8"));
const currentPayloadContract = JSON.parse(readFileSync(join(siteRoot, "app", "i18n", "payload-contract.json"), "utf8"));

function fail(message) {
  throw new Error(`IAT V2 architecture work validation failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  }).trim();
}

function commitExists(commit) {
  return spawnSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  }).status === 0;
}

function isAncestor(ancestor, descendant) {
  return spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  }).status === 0;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function verifyEvidencePath(path) {
  assert(typeof path === "string" && path.length > 0, "task evidence path is empty");
  assert(!isAbsolute(path) && !path.includes(".."), `unsafe evidence path: ${path}`);
  const absolute = resolve(siteRoot, path);
  assert(!relative(siteRoot, absolute).startsWith(".."), `evidence path escapes site root: ${path}`);
  readFileSync(absolute);
}

assert(manifest.schema === "iat-v2-architecture-work-manifest/v1", "unexpected manifest schema");
assert(ledger.schema === "iat-v2-architecture-work-ledger/v1", "unexpected ledger schema");
assert(proof.schema === "iat-v2-cross-engine-hydration-proof/v1", "unexpected proof schema");
assert(manifest.status === ledger.status, "manifest and ledger status differ");
assert(manifest.mainnetStatus === "UNSCHEDULED_HOLD", "manifest must retain Mainnet UNSCHEDULED_HOLD");
assert(ledger.mainnetStatus === "UNSCHEDULED_HOLD", "ledger must retain Mainnet UNSCHEDULED_HOLD");
assert(proof.mainnetStatus === "UNSCHEDULED_HOLD", "proof must retain Mainnet UNSCHEDULED_HOLD");

const serialized = [manifest, ledger, proof].map((value) => JSON.stringify(value)).join("\n");
assert(!/(^|["'\s])[A-Za-z]:[\\/]/mu.test(serialized), "absolute workstation paths are forbidden");
assert(!/(mnemonic|private[_ -]?key|seed phrase|bearer token|api[_ -]?secret)/iu.test(serialized), "secret-bearing vocabulary is forbidden");

const sourceCommit = manifest.sourceBinding?.commit;
assert(/^[0-9a-f]{40}$/u.test(sourceCommit ?? ""), "invalid source-binding commit");
assert(commitExists(sourceCommit), "source-binding commit is absent");
assert(git(["rev-parse", `${sourceCommit}^{tree}`]) === manifest.sourceBinding.gitTree, "source-binding tree differs");
assert(isAncestor(sourceCommit, "HEAD"), "source-binding commit is not an ancestor of HEAD");
assert(JSON.stringify(manifest.sourceBinding) === JSON.stringify({
  repository: ledger.sourceBinding.repository,
  branch: ledger.sourceBinding.branch,
  commit: ledger.sourceBinding.commit,
  gitTree: ledger.sourceBinding.gitTree,
}), "manifest and ledger source bindings differ");

const requiredArtifacts = ["README.md", "hydration-proof.json", "work-ledger.json"];
assert(JSON.stringify(Object.keys(manifest.artifactSha256).sort()) === JSON.stringify(requiredArtifacts.sort()), "artifact inventory differs");
for (const name of requiredArtifacts) {
  const bytes = readFileSync(join(auditDir, name));
  assert(sha256(bytes) === manifest.artifactSha256[name], `${name} digest differs`);
}

const tasks = ledger.tasks ?? [];
assert(tasks.length === 8, `safe task inventory must contain exactly 8 tasks; found ${tasks.length}`);
assert(new Set(tasks.map((task) => task.id)).size === tasks.length, "safe task IDs are not unique");
assert(tasks.every((task) => /^IAT-ARCH-00[1-8]$/u.test(task.id)), "safe task ID is outside the canonical inventory");
const completed = tasks.filter((task) => task.status === "COMPLETE");
const open = tasks.filter((task) => task.status === "OPEN");
assert(completed.length === 5 && open.length === 3, `task status split must be 5 COMPLETE / 3 OPEN; found ${completed.length}/${open.length}`);
assert(ledger.milestone.totalSafeTasks === tasks.length, "milestone task total differs");
assert(ledger.milestone.minimumCompletedForHalf === Math.ceil(tasks.length / 2), "half-task threshold differs");
assert(ledger.milestone.completed === completed.length && ledger.milestone.open === open.length, "milestone task counts differ");
assert(ledger.milestone.halfMilestoneSatisfied === true && completed.length >= ledger.milestone.minimumCompletedForHalf, "half-task milestone is not satisfied");
for (const task of tasks) {
  assert(Array.isArray(task.evidence) && task.evidence.length > 0, `${task.id} has no evidence`);
  task.evidence.forEach(verifyEvidencePath);
  if (task.status === "COMPLETE") {
    assert(/^[0-9a-f]{40}$/u.test(task.completionCommit ?? ""), `${task.id} completion commit is invalid`);
    assert(commitExists(task.completionCommit), `${task.id} completion commit is absent`);
    assert(isAncestor(task.completionCommit, sourceCommit), `${task.id} completion does not precede the ledger binding`);
    assert(typeof task.acceptance === "string" && task.acceptance.length > 40, `${task.id} acceptance is incomplete`);
  } else {
    assert(typeof task.nextAction === "string" && task.nextAction.length > 40, `${task.id} next action is incomplete`);
    assert(!Object.hasOwn(task, "completionCommit"), `${task.id} open task improperly claims a completion commit`);
  }
}

assert(proof.status === "PASS", "hydration proof is not PASS");
const proofCommit = proof.sourceBinding?.contentCommittedAs;
assert(/^[0-9a-f]{40}$/u.test(proofCommit ?? "") && commitExists(proofCommit), "hydration proof commit is invalid or absent");
assert(git(["rev-parse", `${proofCommit}^{tree}`]) === proof.sourceBinding.gitTree, "hydration proof tree differs");
assert(isAncestor(proofCommit, sourceCommit), "hydration proof commit does not precede the ledger binding");
const engines = Object.values(proof.profile.engines ?? {});
assert(engines.length === 3, "hydration proof must contain three engines");
assert(engines.reduce((sum, engine) => sum + engine.pages, 0) === 3500, "hydration proof engine page total differs");
assert(engines.every((engine) => engine.failures === 0), "hydration proof contains an engine failure");
assert(proof.result.plannedPages === 3500 && proof.result.completedPages === 3500, "hydration proof page cardinality differs");
assert(proof.result.failedPages === 0 && proof.result.incompletePages === 0, "hydration proof is incomplete or failed");
assert(proof.result.catalogBackedRenders + proof.result.nativeTurkishSourceRenders === 3500, "hydration proof render classification differs");
assert(proof.profile.configuredLocales === 50 && proof.profile.hosts.length === 2, "hydration proof locale/host topology differs");
assert(proof.result.catalogSha256 === "893cf8efbbb850b5cfb4133987a135785269b087d2d650de3fcb1946f050adce", "hydration catalog digest differs");
assert(
  reviewedLocalizationPolicy.mode === "GLOBAL_FAIL_CLOSED"
    && reviewedLocalizationPolicy.fallback === "canonical-english"
    && reviewedLocalizationPolicy.machineDraftRuntimeAllowed === false
    && reviewedLocalizationPolicy.unreviewedTargetLanguageBundleAllowed === false
    && reviewedLocalizationPolicy.unreviewedLocaleAutonymsAllowed === false
    && reviewedLocalizationPolicy.directComponentReviewBundleComplete === false,
  "current reviewed-localization policy is not fail closed",
);
assert(
  Object.entries(reviewedLocalizationPolicy.localeStatus ?? {}).every(([locale, status]) => locale === "en" ? status === "SOURCE" : status === "HOLD"),
  "current architecture gate requires every non-English locale to remain HOLD until evidence-backed review exists",
);
assert(
  proof.result.catalogSha256 !== currentPayloadContract.catalogSha256,
  "historical hydration proof must not be mistaken for proof of the current fail-closed catalog",
);

const externalBlockers = ledger.externalLaunchBlockers ?? [];
assert(externalBlockers.length === 9, "external launch blocker inventory must contain exactly 9 blockers");
assert(new Set(externalBlockers.map((blocker) => blocker.id)).size === externalBlockers.length, "external blocker IDs are not unique");
assert(externalBlockers.every((blocker) => blocker.status === "HOLD"), "external launch blocker escaped HOLD");
assert(Object.values(ledger.assurance).every((value) => value === false), "ledger improperly grants assurance");
assert(Object.values(proof.assurance).every((value) => value === false), "proof improperly grants assurance");
assert(manifest.clearance.halfSafeTaskMilestoneSatisfied === true, "manifest does not acknowledge the half-task milestone");
assert(Object.entries(manifest.clearance).filter(([key]) => key !== "halfSafeTaskMilestoneSatisfied").every(([, value]) => value === false), "manifest improperly grants launch clearance");
assert(ledger.preservation.originalDirtyWorktreeModified === false, "ledger claims the original dirty worktree was modified");
assert(ledger.preservation.unrelatedUserChangesRemoved === false, "ledger claims unrelated user changes were removed");
assert(ledger.preservation.forcePushAllowed === false && ledger.preservation.mergeAllowedByThisLedger === false, "ledger grants unsafe Git authority");

console.log(
  `IAT V2 architecture work ledger valid: ${completed.length}/${tasks.length} safe tasks complete, ` +
    `${proof.result.completedPages}/${proof.result.plannedPages} historical hydration pages retained (not current localization approval), ` +
    `current 50-locale runtime GLOBAL_FAIL_CLOSED, ${externalBlockers.length} external blockers HOLD, Mainnet UNSCHEDULED_HOLD.`,
);
