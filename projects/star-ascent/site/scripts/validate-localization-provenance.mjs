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
const activeContentEvidenceMode = "APPEND_ONLY_ACTIVE_CONTENT_V1";
const activeEvidenceManifestPath = "public/audits/localization-qa-20260808/manifest.json";
const gitNoLfsFilters = [
  "-c", "filter.lfs.clean=",
  "-c", "filter.lfs.smudge=",
  "-c", "filter.lfs.process=",
  "-c", "filter.lfs.required=false",
];

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
  return execFileSync("git", [...gitNoLfsFilters, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  }).trim();
}

function commitExists(commit) {
  const result = spawnSync("git", [...gitNoLfsFilters, "cat-file", "-e", `${commit}^{commit}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return result.status === 0;
}

function isAncestor(ancestor, descendant) {
  const result = spawnSync("git", [...gitNoLfsFilters, "merge-base", "--is-ancestor", ancestor, descendant], {
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

function introductionCommit(runId) {
  const history = git([
    "log",
    "--reverse",
    "--format=%H",
    "-S",
    runId,
    "--",
    manifestRelativeToRepository,
  ]).split(/\r?\n/u).filter(Boolean);
  return history[0] ?? null;
}

function manifestHasUncommittedChange() {
  const worktree = spawnSync("git", [...gitNoLfsFilters, "diff", "--quiet", "--", manifestRelativeToRepository], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const index = spawnSync("git", [...gitNoLfsFilters, "diff", "--cached", "--quiet", "--", manifestRelativeToRepository], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return worktree.status === 1 || index.status === 1;
}

function validateAppendOnlyHistory(currentManifest) {
  const history = git([
    "log",
    "--format=%H",
    "-n",
    "32",
    "--",
    manifestRelativeToRepository,
  ]).split(/\r?\n/u).filter(Boolean);
  let priorManifest;
  for (const commit of history) {
    const candidate = JSON.parse(git(["show", `${commit}:${manifestRelativeToRepository}`]));
    if (JSON.stringify(candidate) !== JSON.stringify(currentManifest)) {
      priorManifest = candidate;
      break;
    }
  }
  if (!priorManifest) return;
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
assert(manifest.status === "GLOBAL_FAIL_CLOSED_NATIVE_REVIEW_HOLD", "status must remain reviewed-localization HOLD");
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

for (const [runIndex, run] of manifest.runs.entries()) {
  const isActiveContentRun = run.evidenceMode === activeContentEvidenceMode;
  assert(/^[0-9a-f]{40}$/.test(run.baselineCommit), `${run.id} baseline commit is invalid`);
  assert(/^[0-9a-f]{40}$/.test(run.outputCommit), `${run.id} output commit is invalid`);
  assert(commitExists(run.baselineCommit), `${run.id} baseline commit is absent`);
  assert(commitExists(run.outputCommit), `${run.id} output commit is absent`);
  assert(isAncestor(run.baselineCommit, run.outputCommit), `${run.id} output does not descend from baseline`);
  if (isActiveContentRun) {
    const recordedAtMs = Date.parse(run.recordedAt);
    assert(
      Number.isFinite(recordedAtMs)
        && new Date(recordedAtMs).toISOString().replace(".000Z", "Z") === run.recordedAt,
      `${run.id} active-content timestamp must be canonical UTC`,
    );
    assert(run.baselineCommit === run.outputCommit, `${run.id} active-content run must declare no catalog commit delta`);
    assert(
      run.timeBasis === "EVIDENCE_MANIFEST_RECORDED_AT_UTC_BEFORE_PUBLICATION_COMMIT",
      `${run.id} active-content timestamp basis is not explicit`,
    );
  } else {
    assert(
      git(["show", "-s", "--format=%cI", run.outputCommit]) === run.recordedAt,
      `${run.id} recordedAt does not equal output committer time`,
    );
    assert(
      run.timeBasis === "OUTPUT_COMMIT_COMMITTER_TIME_NOT_MODEL_START_TIME",
      `${run.id} timestamp basis is not explicit`,
    );
  }
  if (run.model?.used === false) {
    assert(run.model.provider === "none" && run.model.identifier === "none" && run.model.revision === null, `${run.id} no-model declaration is incomplete`);
  } else {
    assert(run.model?.revision && /^[0-9a-f]{40}$/.test(run.model.revision), `${run.id} model revision missing`);
  }
  assert(run.model?.weightsPublishedInRepository === false, `${run.id} must not publish model weights`);
  assert(run.runtime?.absolutePathsPublished === false, `${run.id} path privacy declaration missing`);
  assert(run.generation?.staticCommittedOutput === true, `${run.id} output must be static`);

  const chain = run.commitChain.map((entry) => entry.commit);
  assert(chain[0] === run.baselineCommit, `${run.id} chain must begin at baseline`);
  if (isActiveContentRun) {
    assert(chain.length === 1 && chain[0] === run.outputCommit, `${run.id} active-content chain must contain its unchanged source commit once`);
  } else {
    assert(chain[1] === run.outputCommit, `${run.id} chain must bind output second`);
  }
  assert(new Set(chain).size === chain.length, `${run.id} commit chain contains duplicates`);
  for (let index = 0; index < chain.length; index += 1) {
    assert(/^[0-9a-f]{40}$/.test(chain[index]), `${run.id} chain commit ${index} is invalid`);
    assert(commitExists(chain[index]), `${run.id} chain commit ${index} is absent`);
    if (index > 0) {
      assert(isAncestor(chain[index - 1], chain[index]), `${run.id} chain order breaks at ${index}`);
    }
  }

  const introducedAt = isActiveContentRun ? introductionCommit(run.id) : null;
  if (isActiveContentRun) {
    assert(runIndex === manifest.runs.length - 1 || introducedAt, `${run.id} uncommitted active-content run is not the final run`);
    assert(introducedAt || manifestHasUncommittedChange(), `${run.id} active-content run is neither committed nor an explicit working-tree append`);
    if (introducedAt) assert(isAncestor(introducedAt, "HEAD"), `${run.id} introduction commit is not an ancestor of HEAD`);
  }
  for (const artifact of run.artifacts) {
    assert(!artifact.path.startsWith("/") && !artifact.path.includes(".."), `unsafe artifact path ${artifact.path}`);
    let buffer;
    if (isActiveContentRun) {
      assert(
        JSON.stringify(Object.keys(artifact).sort()) === JSON.stringify(["bytes", "path", "sha256"]),
        `${run.id} active-content artifact fields are not exact`,
      );
      buffer = introducedAt
        ? execFileSync(
          "git",
          [...gitNoLfsFilters, "show", `${introducedAt}:projects/star-ascent/site/${artifact.path}`],
          { cwd: repositoryRoot, maxBuffer: 32 * 1024 * 1024 },
        )
        : readFileSync(join(siteRoot, artifact.path));
    } else {
      assert(chain.includes(artifact.bindingCommit), `${artifact.path} is bound outside the run commit chain`);
      buffer = execFileSync(
        "git",
        [...gitNoLfsFilters, "show", `${artifact.bindingCommit}:projects/star-ascent/site/${artifact.path}`],
        { cwd: repositoryRoot, maxBuffer: 32 * 1024 * 1024 },
      );
    }
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
  const baselineSourceKeys = new Set(Object.keys(baseline.en ?? {}));
  const outputSourceKeys = new Set(Object.keys(output.en ?? {}));
  const removedCanonicalSourceKeys = [...baselineSourceKeys].filter((source) => !outputSourceKeys.has(source)).length;
  const addedCanonicalSourceKeys = [...outputSourceKeys].filter((source) => !baselineSourceKeys.has(source)).length;
  let removedLocaleEntries = 0;
  let addedLocaleEntries = 0;
  for (const [locale, values] of Object.entries(output)) {
    assert(baseline[locale], `${run.id} baseline is missing locale ${locale}`);
    removedLocaleEntries += Object.keys(baseline[locale]).filter((source) => !(source in values)).length;
    addedLocaleEntries += Object.keys(values).filter((source) => !(source in baseline[locale])).length;
    for (const [source, value] of Object.entries(values)) {
      const before = baseline[locale][source];
      if (!(source in baseline[locale])) continue;
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
  assert(removedCanonicalSourceKeys === (outcome.removedCanonicalSourceKeys ?? 0), `${run.id} removed canonical-source count drifted`);
  assert(addedCanonicalSourceKeys === (outcome.addedCanonicalSourceKeys ?? 0), `${run.id} added canonical-source count drifted`);
  assert(removedLocaleEntries === (outcome.removedLocaleEntries ?? 0), `${run.id} removed locale-entry count drifted`);
  assert(addedLocaleEntries === (outcome.addedLocaleEntries ?? 0), `${run.id} added locale-entry count drifted`);
  assert(corruptHashesBefore === outcome.corruptedSha256ValuesBefore, `${run.id} prior SHA count drifted`);
  assert(corruptHashesAfter === outcome.corruptedSha256ValuesAfter, `${run.id} output SHA count drifted`);
  assert(outcome.unexplainedMutations === 0, `${run.id} unexplained mutations must be zero`);
}

const activeRun = manifest.runs.at(-1);
assert(activeRun.status === "GLOBAL_FAIL_CLOSED_NATIVE_REVIEW_HOLD", "active run must retain reviewed-localization HOLD");
assert(
  activeRun.artifacts.some((artifact) => artifact.path === "app/i18n/messages.json"),
  "active run must bind the current localization catalog",
);
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
assert(catalog.meta.translationDraftStatus === "QUARANTINED_MACHINE_DRAFTS_RUNTIME_REVIEW_ONLY", "catalog draft quarantine status drifted");
const reviewedPolicy = readJson(join(siteRoot, "app/i18n/reviewed-localization-policy.json"));
assert(
  reviewedPolicy.schema === "iat-reviewed-localization-policy/v1"
    && reviewedPolicy.mode === "GLOBAL_FAIL_CLOSED"
    && reviewedPolicy.fallback === "canonical-english"
    && reviewedPolicy.machineDraftRuntimeAllowed === false
    && reviewedPolicy.unreviewedTargetLanguageBundleAllowed === false
    && reviewedPolicy.unreviewedLocaleAutonymsAllowed === false
    && reviewedPolicy.directComponentReviewBundleComplete === false,
  "reviewed-localization policy is not fail closed",
);
assert(Object.entries(reviewedPolicy.localeStatus ?? {}).every(([locale, status]) => locale === "en" ? status === "SOURCE" : status === "HOLD"), "non-English locale escaped HOLD without review evidence");
assert(catalog.meta.runtimeLocalizationPolicy?.reviewedRuntimeCells === activeRun.outcomes.reviewedRuntimeCells, "reviewed runtime-cell count drifted");
assert(catalog.meta.runtimeLocalizationPolicy?.fallbackRuntimeCells === activeRun.outcomes.canonicalFallbackCells, "canonical fallback-cell count drifted");

const pending = readJson(join(siteRoot, "app/i18n/pending-visible-source.json"));
assert(pending.capture.routeCount === activeRun.scope.canonicalRoutes, "pending capture route count drifted");
assert(pending.capture.pendingSourceCount === activeRun.outcomes.pendingVisibleSourceStrings, "pending source count drifted");
assert(pending.capture.pendingSourceCount === pending.sources?.length, "pending source inventory cardinality drifted");
assert(pending.capture.routesWithPendingSource === Object.keys(pending.capture.byRoute ?? {}).length, "pending route inventory cardinality drifted");
assert(
  pending.runtime?.active === false
    && pending.runtime?.automaticEnglishFallbackApproved === false
    && pending.runtime?.translationComplete === false
    && pending.runtime?.nativeReviewComplete === false,
  "pending source escaped its inactive translation/native-review HOLD",
);

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
assert(scorecard.scope.reviewedRuntimeCells === activeRun.outcomes.reviewedRuntimeCells, "scorecard reviewed runtime-cell count drifted");
assert(scorecard.scope.canonicalFallbackCells === activeRun.outcomes.canonicalFallbackCells, "scorecard fallback runtime-cell count drifted");
assert(scorecard.assurance.nativeQualityClaimAllowed === false, "scorecard improperly allows native-quality claim");
assert(scorecard.assurance.releaseApproved === false, "scorecard improperly approves release");
assert(scorecard.assurance.mainnetStateChanged === false, "scorecard improperly changes mainnet state");

const activeEvidence = readJson(join(siteRoot, activeEvidenceManifestPath));
assert(activeEvidence.schema === "iat-localization-active-artifact-evidence/v1", "active-artifact evidence schema drifted");
assert(activeEvidence.runId === activeRun.id, "active-artifact evidence run ID drifted");
assert(activeEvidence.recordedAt === activeRun.recordedAt, "active-artifact evidence timestamp drifted");
assert(activeEvidence.status === "GLOBAL_FAIL_CLOSED_NATIVE_REVIEW_HOLD", "active-artifact evidence escaped HOLD");
assert(activeEvidence.mainnetStatus === "UNSCHEDULED_HOLD", "active-artifact evidence changed Mainnet status");
assert(activeEvidence.sourceBinding?.captureCommit === activeRun.baselineCommit, "active-artifact capture commit drifted");
assert(activeEvidence.sourceBinding?.evidenceMode === activeContentEvidenceMode, "active-artifact evidence mode drifted");
assert(
  JSON.stringify(activeEvidence.localizationState) === JSON.stringify({
    configuredLocales: 50,
    sourceLocales: 1,
    holdLocales: 49,
    canonicalStrings: activeRun.scope.canonicalStrings,
    reviewedRuntimeCells: 0,
    canonicalFallbackCells: activeRun.outcomes.canonicalFallbackCells,
    pendingVisibleSourceStrings: activeRun.outcomes.pendingVisibleSourceStrings,
    routesWithPendingVisibleSource: pending.capture.routesWithPendingSource,
    activatedTranslations: 0,
  }),
  "active-artifact localization state drifted",
);
const activeRunArtifacts = new Map(activeRun.artifacts.map((artifact) => [artifact.path, artifact]));
assert(activeRunArtifacts.size === activeRun.artifacts.length, "active run artifact paths are not unique");
assert(Array.isArray(activeEvidence.artifacts) && activeEvidence.artifacts.length > 0, "active-artifact evidence inventory is empty");
for (const artifact of activeEvidence.artifacts) {
  assert(
    JSON.stringify(activeRunArtifacts.get(artifact.path)) === JSON.stringify(artifact),
    `${artifact.path} evidence manifest binding differs from active run`,
  );
  const buffer = readFileSync(join(siteRoot, artifact.path));
  assert(buffer.length === artifact.bytes && sha256(buffer) === artifact.sha256, `${artifact.path} evidence manifest content drifted`);
}
assert(
  activeRunArtifacts.size === activeEvidence.artifacts.length + 1
    && activeRunArtifacts.has(activeEvidenceManifestPath),
  "active run must bind exactly the evidence inventory plus its manifest",
);
assert(
  activeEvidence.assurance?.runtimeActivation === false
    && activeEvidence.assurance?.nativeQualityClaimAllowed === false
    && activeEvidence.assurance?.releaseApproved === false
    && activeEvidence.assurance?.mainnetStateChanged === false,
  "active-artifact evidence improperly grants assurance",
);

console.log(
  `localization provenance PASS: ${manifest.runs.length} append-only run(s), ` +
    `${activeRun.artifacts.length} artifacts, ${activeRun.outcomes.changedLocaleEntries} classified mutations, ` +
    `${activeRun.outcomes.renderChecks.PASS} render PASS, ` +
    `${activeRun.outcomes.scorecard.PASS}/${activeRun.outcomes.scorecard.HOLD} scorecard PASS/HOLD`,
);
