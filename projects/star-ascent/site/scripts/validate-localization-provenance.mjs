import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(siteRoot, "..", "..", "..");
const auditRelative = "public/audits/localization-qa-20260803";
const manifestPath = join(siteRoot, auditRelative, "translation-provenance.v1.json");
const manifestRelativeToRepository =
  "projects/star-ascent/site/public/audits/localization-qa-20260803/translation-provenance.v1.json";
const catalogRelativeToRepository = "projects/star-ascent/site/app/i18n/messages.json";

function fail(message) {
  throw new Error(`localization provenance validation failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  }).trim();
}

function commitExists(commit) {
  const result = spawnSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return result.status === 0;
}

function isAncestor(ancestor, descendant) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return result.status === 0;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function historicalCatalog(commit) {
  return JSON.parse(git(["show", `${commit}:${catalogRelativeToRepository}`]));
}

function validateAppendOnlyHistory(currentManifest) {
  const prior = spawnSync("git", ["show", `HEAD:${manifestRelativeToRepository}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (prior.status !== 0) return;
  const priorManifest = JSON.parse(prior.stdout);
  assert(
    currentManifest.runs.length >= priorManifest.runs.length,
    "run history cannot shrink",
  );
  for (let index = 0; index < priorManifest.runs.length; index += 1) {
    assert(
      JSON.stringify(currentManifest.runs[index]) === JSON.stringify(priorManifest.runs[index]),
      `previous run ${priorManifest.runs[index].id} was changed instead of preserved`,
    );
  }
}

const manifestText = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestText);
assert(manifest.schema === "iat-localization-provenance/v1", "unexpected schema");
assert(manifest.status === "PUBLIC_MACHINE_DRAFT_NATIVE_REVIEW_HOLD", "status must remain HOLD");
assert(manifest.mainnetStatus === "UNSCHEDULED_HOLD", "mainnet status must remain UNSCHEDULED_HOLD");
assert(manifest.license?.spdx === "CC0-1.0", "CC0-1.0 SPDX identifier is required");
assert(manifest.license?.scope?.length >= 5, "CC0 scope is incomplete");
assert(manifest.license?.exclusions?.length >= 5, "CC0 exclusions are incomplete");
assert(manifest.policy?.appendOnlyRuns === true, "runs must be append-only");
assert(manifest.policy?.overwritePriorRunRecords === false, "prior runs must not be overwritten");
assert(manifest.policy?.runtimeTranslationService === false, "runtime translation must remain disabled");
assert(manifest.policy?.nativeQualityClaimAllowed === false, "native quality cannot be claimed");
assert(!/(^|["'\s])[A-Za-z]:[\\/]/m.test(manifestText), "absolute workstation paths are forbidden");

const dedication = readFileSync(join(siteRoot, manifest.license.file), "utf8");
assert(dedication.includes("SPDX-License-Identifier: CC0-1.0"), "CC0 dedication file is missing SPDX");
validateAppendOnlyHistory(manifest);

assert(Array.isArray(manifest.runs) && manifest.runs.length > 0, "at least one run is required");
assert(new Set(manifest.runs.map((run) => run.id)).size === manifest.runs.length, "run IDs must be unique");

for (const run of manifest.runs) {
  assert(/^[0-9a-f]{40}$/.test(run.baselineCommit), `${run.id} baseline commit is invalid`);
  assert(/^[0-9a-f]{40}$/.test(run.outputCommit), `${run.id} output commit is invalid`);
  assert(commitExists(run.baselineCommit), `${run.id} baseline commit is absent`);
  assert(commitExists(run.outputCommit), `${run.id} output commit is absent`);
  assert(isAncestor(run.baselineCommit, run.outputCommit), `${run.id} output does not descend from baseline`);
  assert(
    git(["show", "-s", "--format=%cI", run.outputCommit]) === run.recordedAt,
    `${run.id} recordedAt does not equal output committer time`,
  );
  assert(
    run.timeBasis === "OUTPUT_COMMIT_COMMITTER_TIME_NOT_MODEL_START_TIME",
    `${run.id} timestamp basis is not explicit`,
  );
  assert(run.model?.revision && /^[0-9a-f]{40}$/.test(run.model.revision), `${run.id} model revision missing`);
  assert(run.model?.weightsPublishedInRepository === false, `${run.id} must not publish model weights`);
  assert(run.runtime?.absolutePathsPublished === false, `${run.id} path privacy declaration missing`);
  assert(run.generation?.staticCommittedOutput === true, `${run.id} output must be static`);

  const chain = run.commitChain.map((entry) => entry.commit);
  assert(chain[0] === run.baselineCommit, `${run.id} chain must begin at baseline`);
  assert(chain[1] === run.outputCommit, `${run.id} chain must bind output second`);
  assert(new Set(chain).size === chain.length, `${run.id} commit chain contains duplicates`);
  for (let index = 0; index < chain.length; index += 1) {
    assert(/^[0-9a-f]{40}$/.test(chain[index]), `${run.id} chain commit ${index} is invalid`);
    assert(commitExists(chain[index]), `${run.id} chain commit ${index} is absent`);
    if (index > 0) {
      assert(isAncestor(chain[index - 1], chain[index]), `${run.id} chain order breaks at ${index}`);
    }
  }

  for (const artifact of run.artifacts) {
    assert(!artifact.path.startsWith("/") && !artifact.path.includes(".."), `unsafe artifact path ${artifact.path}`);
    assert(chain.includes(artifact.bindingCommit), `${artifact.path} is bound outside the run commit chain`);
    const buffer = execFileSync(
      "git",
      ["show", `${artifact.bindingCommit}:projects/star-ascent/site/${artifact.path}`],
      { cwd: repositoryRoot, maxBuffer: 32 * 1024 * 1024 },
    );
    assert(buffer.length === artifact.bytes, `${artifact.path} historical byte count drifted`);
    assert(sha256(buffer) === artifact.sha256, `${artifact.path} SHA-256 drifted`);
  }

  const baseline = historicalCatalog(run.baselineCommit).messages;
  const output = historicalCatalog(run.outputCommit).messages;
  let changed = 0;
  let sourceEqualDrafts = 0;
  let literalRestorations = 0;
  let otherChanges = 0;
  let corruptHashesBefore = 0;
  let corruptHashesAfter = 0;
  for (const [locale, values] of Object.entries(output)) {
    assert(baseline[locale], `${run.id} baseline is missing locale ${locale}`);
    for (const [source, value] of Object.entries(values)) {
      const before = baseline[locale][source];
      if (before !== value) {
        changed += 1;
        if (before === source && value !== source) sourceEqualDrafts += 1;
        else if (before !== source && value === source) literalRestorations += 1;
        else otherChanges += 1;
      }
      if (/^[0-9a-f]{64}$/i.test(source)) {
        if (before !== source) corruptHashesBefore += 1;
        if (value !== source) corruptHashesAfter += 1;
      }
    }
  }
  const outcome = run.outcomes;
  assert(changed === outcome.changedLocaleEntries, `${run.id} changed-entry count drifted`);
  assert(sourceEqualDrafts === outcome.sourceEqualDraftReplacements, `${run.id} source-match count drifted`);
  assert(literalRestorations === outcome.literalOnlyRestorations, `${run.id} literal restoration count drifted`);
  assert(otherChanges === outcome.otherDeterministicPipelineChanges, `${run.id} other-change count drifted`);
  assert(corruptHashesBefore === outcome.corruptedSha256ValuesBefore, `${run.id} prior SHA count drifted`);
  assert(corruptHashesAfter === outcome.corruptedSha256ValuesAfter, `${run.id} output SHA count drifted`);
  assert(outcome.unexplainedMutations === 0, `${run.id} unexplained mutations must be zero`);
}

const activeRun = manifest.runs.at(-1);
for (const artifact of activeRun.artifacts) {
  const buffer = readFileSync(join(siteRoot, artifact.path));
  assert(buffer.length === artifact.bytes, `${artifact.path} active byte count is not recorded`);
  assert(sha256(buffer) === artifact.sha256, `${artifact.path} active content is not recorded`);
}
const catalog = readJson(join(siteRoot, "app/i18n/messages.json"));
const localeEntries = Object.entries(catalog.messages);
assert(localeEntries.length === activeRun.scope.localeCount, "active catalog locale count drifted");
for (const [locale, messages] of localeEntries) {
  assert(Object.keys(messages).length === activeRun.scope.canonicalStrings, `${locale} source count drifted`);
  assert(Object.values(messages).every((value) => typeof value === "string" && value.trim()), `${locale} has empty values`);
}
assert(catalog.meta.sourceCount === activeRun.scope.canonicalStrings, "catalog meta source count drifted");
assert(catalog.meta.renderedRoutes.length === activeRun.scope.canonicalRoutes, "catalog route count drifted");
assert(catalog.meta.translationAlgorithmVersion === activeRun.generation.translationAlgorithmVersion, "algorithm version drifted");
assert(catalog.meta.sourceMatchRefresh?.algorithmVersion === activeRun.generation.sourceMatchRefreshAlgorithmVersion, "refresh version drifted");
assert(catalog.meta.translationDraftStatus === "MACHINE_DRAFT_NATIVE_REVIEW_REQUIRED", "catalog draft status drifted");

const pending = readJson(join(siteRoot, "app/i18n/pending-visible-source.json"));
assert(pending.capture.routeCount === activeRun.scope.canonicalRoutes, "pending capture route count drifted");
assert(pending.capture.pendingSourceCount === activeRun.outcomes.pendingVisibleSourceStrings, "pending source count drifted");
assert(pending.capture.routesWithPendingSource === 0, "routes still contain pending source");

const render = readJson(join(siteRoot, "app/i18n/language-render-evidence.v1.json"));
assert(render.status === "PASS", "render evidence is not PASS");
assert(render.scope.localeCount === activeRun.scope.localeCount, "render locale count drifted");
assert(render.scope.routeCount === activeRun.scope.canonicalRoutes, "render route count drifted");
let renderPass = 0;
let renderFail = 0;
for (const locale of Object.values(render.locales)) {
  for (const check of Object.values(locale.checks)) {
    if (check.status === "PASS") renderPass += 1;
    else renderFail += 1;
  }
}
assert(renderPass === activeRun.outcomes.renderChecks.PASS, "render PASS total drifted");
assert(renderFail === activeRun.outcomes.renderChecks.FAIL, "render FAIL total drifted");

const scorecard = readJson(join(siteRoot, auditRelative, "language-qa-scorecard.json"));
assert(JSON.stringify(scorecard.summary) === JSON.stringify({
  PASS: activeRun.outcomes.scorecard.PASS,
  FAIL: activeRun.outcomes.scorecard.FAIL,
  HOLD: activeRun.outcomes.scorecard.HOLD,
  NOT_RUN: activeRun.outcomes.scorecard.NOT_RUN,
}), "scorecard summary drifted");
assert(scorecard.scope.locales === activeRun.scope.localeCount, "scorecard locale count drifted");
assert(scorecard.scope.canonicalStrings === activeRun.scope.canonicalStrings, "scorecard source count drifted");
assert(scorecard.assurance.nativeQualityClaimAllowed === false, "scorecard improperly allows native-quality claim");
assert(scorecard.assurance.releaseApproved === false, "scorecard improperly approves release");
assert(scorecard.assurance.mainnetStateChanged === false, "scorecard improperly changes mainnet state");

console.log(
  `localization provenance PASS: ${manifest.runs.length} append-only run(s), ` +
    `${activeRun.artifacts.length} artifacts, ${activeRun.outcomes.changedLocaleEntries} classified mutations, ` +
    `${activeRun.outcomes.renderChecks.PASS} render PASS, ` +
    `${activeRun.outcomes.scorecard.PASS}/${activeRun.outcomes.scorecard.HOLD} scorecard PASS/HOLD`,
);
