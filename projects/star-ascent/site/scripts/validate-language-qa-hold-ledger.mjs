import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";

const expectedLocales = [
  "en", "zh", "es", "hi", "fr", "ar", "bn", "pt", "id", "ur",
  "ru", "de", "ja", "pcm", "tr", "sq", "ca", "be", "nl", "bs",
  "bg", "hr", "el", "cs", "da", "et", "fi", "hu", "is", "ga",
  "it", "lv", "lt", "lb", "mk", "mt", "no", "pl", "ro", "sr",
  "sk", "sl", "sv", "uk", "ht", "gn", "qu", "hy", "az", "ka",
];
const expectedCheckIds = Array.from(
  { length: 100 },
  (_, index) => `LQA-${String(index + 1).padStart(3, "0")}`,
);
const expectedRenderCheckIds = expectedCheckIds.slice(70, 95);
const statusVocabulary = ["PASS", "FAIL", "HOLD", "NOT_RUN"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const canonicalDigest = (bytes) => sha256(canonical(JSON.parse(bytes.toString("utf8"))));
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const summarize = (results) => results.reduce(
  (summary, result) => ({ ...summary, [result.status]: summary[result.status] + 1 }),
  { PASS: 0, FAIL: 0, HOLD: 0, NOT_RUN: 0 },
);
const aggregateStatus = (summary) => {
  if (summary.FAIL > 0) return "FAIL";
  if (summary.HOLD > 0) return "HOLD";
  if (summary.NOT_RUN > 0) return "NOT_RUN";
  return "PASS";
};
const expectedMode = (index) => {
  if (index < 70) return "STATIC";
  if (index < 95) return "RENDER";
  return "NATIVE";
};

export function validateLanguageQaHoldLedgerArtifacts({ scorecardBytes, ledgerBytes, repoRoot = resolve(process.cwd(), "../../..") }) {
  const scorecard = JSON.parse(scorecardBytes.toString("utf8"));
  const ledger = JSON.parse(ledgerBytes.toString("utf8"));
  const check = (condition, message) => {
    if (!condition) throw new Error(`Language QA HOLD ledger validation failed: ${message}`);
  };

  check(scorecard.schema === "iat-language-qa-scorecard/v1", "unexpected scorecard schema");
  check(scorecard.status === "HOLD", "scorecard must remain HOLD until every result passes");
  check(sameJson(scorecard.policy?.statusVocabulary, statusVocabulary), "status vocabulary drift");
  check(scorecard.scope?.locales === 50, "scorecard scope must declare exactly 50 locales");
  check(scorecard.scope?.checksPerLocale === 100, "scorecard scope must declare exactly 100 checks per locale");
  check(scorecard.scope?.results === 5000, "scorecard scope must declare exactly 5,000 results");
  check(Array.isArray(scorecard.locales) && scorecard.locales.length === 50, "scorecard must contain exactly 50 locale rows");
  check(
    sameJson(scorecard.locales.map(({ locale }) => locale), expectedLocales),
    "locale rows must retain the exact reviewed order without omissions or duplicates",
  );

  const allResults = [];
  for (const localeRow of scorecard.locales) {
    check(/^[0-9a-f]{64}$/u.test(localeRow.localeMessagesSha256), `${localeRow.locale} has an invalid locale digest`);
    check(Array.isArray(localeRow.checks) && localeRow.checks.length === 100, `${localeRow.locale} must contain exactly 100 checks`);
    check(
      sameJson(localeRow.checks.map(({ id }) => id), expectedCheckIds),
      `${localeRow.locale} check ID order must be unique and contiguous from LQA-001 through LQA-100`,
    );
    for (const [index, result] of localeRow.checks.entries()) {
      check(statusVocabulary.includes(result.status), `${localeRow.locale}/${result.id} has invalid status ${result.status}`);
      check(result.mode === expectedMode(index), `${localeRow.locale}/${result.id} mode drift`);
      check(typeof result.category === "string" && result.category.trim(), `${localeRow.locale}/${result.id} lacks a category`);
      check(typeof result.detail === "string" && result.detail.trim(), `${localeRow.locale}/${result.id} lacks evidence detail`);
      if (result.mode === "STATIC") {
        check(["STATIC_DETERMINISTIC", "STATIC_HEURISTIC"].includes(result.evidenceClass), `${localeRow.locale}/${result.id} has invalid static evidence class`);
      } else if (result.mode === "RENDER") {
        check(result.evidenceClass === "RENDER_REQUIRED", `${localeRow.locale}/${result.id} has invalid render evidence class`);
      } else {
        check(result.evidenceClass === "NATIVE_REVIEW_RECORD", `${localeRow.locale}/${result.id} has invalid native evidence class`);
      }
    }
    const localeSummary = summarize(localeRow.checks);
    check(sameJson(localeRow.summary, localeSummary), `${localeRow.locale} summary mismatch`);
    check(localeRow.status === aggregateStatus(localeSummary), `${localeRow.locale} aggregate status mismatch`);
    allResults.push(...localeRow.checks.map((result) => ({ locale: localeRow.locale, ...result })));
  }

  check(allResults.length === 5000, "computed result topology must equal exactly 5,000");
  const summary = summarize(allResults);
  check(sameJson(scorecard.summary, summary), "global summary mismatch");
  check(scorecard.status === aggregateStatus(summary), "global aggregate status mismatch");
  check(summary.FAIL === 0 && summary.NOT_RUN === 0, "current public scorecard must not contain FAIL or NOT_RUN results");

  for (const [laneName, mode] of [["static", "STATIC"], ["render", "RENDER"], ["native", "NATIVE"]]) {
    const laneSummary = summarize(allResults.filter((result) => result.mode === mode));
    check(sameJson(scorecard.lanes?.[laneName]?.summary, laneSummary), `${laneName} lane summary mismatch`);
    check(scorecard.lanes?.[laneName]?.status === aggregateStatus(laneSummary), `${laneName} lane status mismatch`);
  }
  check(scorecard.lanes.native.summary.PASS + scorecard.lanes.native.summary.HOLD === 250, "native lane must contain exactly 250 reviewed results");
  check(scorecard.lanes.native.nativePassClaimAllowed === false, "native PASS claim must remain disabled while native results are on HOLD");
  check(Object.values(scorecard.assurance ?? {}).every((value) => value === false), "scorecard assurance flags must remain false");
  check(
    sameJson(Object.keys(scorecard.evidenceInputs ?? {}), ["nativeReview", "languageId", "render"]),
    "evidence input inventory drift",
  );
  for (const [name, expectedPath, expectedPresent] of [
    ["nativeReview", "app/i18n/native-review-signoffs.v1.json", false],
    ["languageId", "app/i18n/language-id-evidence.v1.json", false],
    ["render", "app/i18n/language-render-evidence.v1.json", true],
  ]) {
    const evidence = scorecard.evidenceInputs[name];
    check(evidence?.path === expectedPath, `${name} evidence path drift`);
    check(evidence?.present === expectedPresent, `${name} evidence presence claim mismatch`);
    check(evidence?.parseError === null, `${name} evidence parse-error claim mismatch`);
  }

  for (const field of ["headCommit", "headTree"]) {
    check(/^[0-9a-f]{40}$/u.test(scorecard.sourceBinding?.[field]), `scorecard source binding ${field} is invalid`);
  }
  for (const field of [
    "worktreeStatusSha256", "definitionSha256", "messagesFileSha256", "criticalSha256",
    "overridesSha256", "metadataSha256", "routeSeoSha256", "pendingSha256", "reviewedPolicySha256",
  ]) {
    check(/^[0-9a-f]{64}$/u.test(scorecard.sourceBinding?.[field]), `scorecard source binding ${field} is invalid`);
  }
  check(scorecard.sourceBinding.worktreeDirty === false, "public scorecard must bind a clean source worktree");
  check(scorecard.sourceBinding.worktreeStatusSha256 === sha256(""), "clean scorecard worktree-status digest mismatch");

  const git = (args) => {
    try {
      return execFileSync("git", args, {
        cwd: repoRoot,
        encoding: args[0] === "show" ? null : "utf8",
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      return null;
    }
  };
  const sourceCommit = scorecard.sourceBinding.headCommit;
  check(git(["cat-file", "-e", `${sourceCommit}^{commit}`]) !== null, "scorecard source commit is unavailable");
  check(git(["merge-base", "--is-ancestor", sourceCommit, "HEAD"]) !== null, "scorecard source commit is outside the current branch history");
  const sourceTree = git(["rev-parse", `${sourceCommit}^{tree}`]);
  check(sourceTree?.trim() === scorecard.sourceBinding.headTree, "scorecard source tree mismatch");
  const generatedAtMs = Date.parse(scorecard.generatedAt);
  check(Number.isFinite(generatedAtMs) && new Date(generatedAtMs).toISOString() === scorecard.generatedAt, "scorecard generation time must be canonical UTC");
  const sourceCommittedAt = git(["show", "-s", "--format=%cI", sourceCommit]);
  const sourceCommittedAtText = sourceCommittedAt?.toString("utf8").trim();
  check(Number.isFinite(Date.parse(sourceCommittedAtText)) && Date.parse(sourceCommittedAtText) <= generatedAtMs, "scorecard generation predates its source commit");

  const sourceFiles = {
    definitionSha256: ["projects/star-ascent/site/app/i18n/language-qa-checks.v1.json", (bytes) => sha256(bytes)],
    messagesFileSha256: ["projects/star-ascent/site/app/i18n/messages.json", (bytes) => sha256(bytes)],
    criticalSha256: ["projects/star-ascent/site/app/i18n/critical-ui-source.json", canonicalDigest],
    overridesSha256: ["projects/star-ascent/site/app/i18n/critical-ui-overrides.json", canonicalDigest],
    metadataSha256: ["projects/star-ascent/site/app/i18n/metadata.generated.json", canonicalDigest],
    routeSeoSha256: ["projects/star-ascent/site/app/i18n/route-seo.json", canonicalDigest],
    pendingSha256: ["projects/star-ascent/site/app/i18n/pending-visible-source.json", canonicalDigest],
    reviewedPolicySha256: ["projects/star-ascent/site/app/i18n/reviewed-localization-policy.json", canonicalDigest],
  };
  const sourceBytes = {};
  for (const [field, [sourcePath, digest]] of Object.entries(sourceFiles)) {
    const bytes = git(["show", `${sourceCommit}:${sourcePath}`]);
    check(bytes !== null, `scorecard source file is unavailable: ${sourcePath}`);
    check(digest(bytes) === scorecard.sourceBinding[field], `scorecard source binding ${field} mismatch`);
    sourceBytes[field] = bytes;
  }

  const sourceDefinition = JSON.parse(sourceBytes.definitionSha256.toString("utf8"));
  const sourceCatalog = JSON.parse(sourceBytes.messagesFileSha256.toString("utf8"));
  const sourceRouteSeo = JSON.parse(sourceBytes.routeSeoSha256.toString("utf8"));
  const sourceReviewedPolicy = JSON.parse(sourceBytes.reviewedPolicySha256.toString("utf8"));
  check(sourceDefinition.schema === "iat-language-qa-check-definition/v1", "source check definition schema mismatch");
  check(sourceDefinition.localeCount === 50 && sourceDefinition.checksPerLocale === 100 && sourceDefinition.resultCount === 5000, "source check definition cardinality mismatch");
  check(Array.isArray(sourceDefinition.checks) && sourceDefinition.checks.length === 100, "source check definition must contain exactly 100 checks");
  check(sameJson(sourceDefinition.checks.map(({ id }) => id), expectedCheckIds), "source check definition ID inventory mismatch");
  check(sameJson(Object.keys(sourceCatalog.messages ?? {}), expectedLocales), "source message catalog locale inventory mismatch");
  check(Object.keys(sourceCatalog.messages.en ?? {}).length === scorecard.scope.canonicalStrings, "scorecard canonical-string scope mismatch");
  check(Object.keys(sourceRouteSeo).length === scorecard.scope.canonicalRoutes, "scorecard canonical-route scope mismatch");
  check(
    sourceReviewedPolicy.schema === "iat-reviewed-localization-policy/v1"
      && sourceReviewedPolicy.mode === "GLOBAL_FAIL_CLOSED"
      && sourceReviewedPolicy.fallback === "canonical-english"
      && sourceReviewedPolicy.machineDraftRuntimeAllowed === false
      && sourceReviewedPolicy.unreviewedTargetLanguageBundleAllowed === false
      && sourceReviewedPolicy.unreviewedLocaleAutonymsAllowed === false
      && sourceReviewedPolicy.directComponentReviewBundleComplete === false,
    "reviewed-localization policy is not fail closed",
  );
  const reviewedRuntimeCells = Object.values(sourceReviewedPolicy.translations ?? {})
    .reduce((total, translations) => total + Object.keys(translations ?? {}).length, 0);
  const canonicalFallbackCells = scorecard.scope.canonicalStrings * (expectedLocales.length - 1) - reviewedRuntimeCells;
  check(scorecard.scope.reviewedRuntimeCells === reviewedRuntimeCells, "reviewed runtime-cell scope mismatch");
  check(scorecard.scope.canonicalFallbackCells === canonicalFallbackCells, "canonical fallback-cell scope mismatch");
  check(scorecard.policy.runtimeMode === sourceReviewedPolicy.mode, "runtime policy mode mismatch");
  check(scorecard.policy.runtimeFallback === sourceReviewedPolicy.fallback, "runtime fallback policy mismatch");

  const renderEvidencePath = `projects/star-ascent/site/${scorecard.evidenceInputs.render.path}`;
  const renderEvidenceBytes = git(["show", `${sourceCommit}:${renderEvidencePath}`]);
  check(renderEvidenceBytes !== null, "source-bound render evidence is unavailable");
  let renderEvidence;
  try {
    renderEvidence = JSON.parse(renderEvidenceBytes.toString("utf8"));
  } catch {
    check(false, "source-bound render evidence is not valid JSON");
  }
  check(renderEvidence.schema === "iat-language-render-evidence/v1", "source-bound render evidence schema mismatch");
  check(renderEvidence.status === "PASS", "source-bound render evidence must remain PASS");
  check(
    renderEvidence.scope?.localeCount === 50
      && renderEvidence.scope?.claimedChecksPerLocale === 25
      && Array.isArray(renderEvidence.scope?.omittedChecks)
      && renderEvidence.scope.omittedChecks.length === 0,
    "source-bound render evidence scope mismatch",
  );
  const renderGeneratedAtMs = Date.parse(renderEvidence.generatedAt);
  check(
    Number.isFinite(renderGeneratedAtMs) && new Date(renderGeneratedAtMs).toISOString() === renderEvidence.generatedAt,
    "source-bound render evidence generation time must be canonical UTC",
  );
  check(renderGeneratedAtMs <= generatedAtMs, "scorecard predates its source-bound render evidence");
  for (const field of ["definitionSha256", "messagesFileSha256", "metadataSha256", "routeSeoSha256", "pendingSha256", "reviewedPolicySha256"]) {
    check(renderEvidence.sourceBinding?.[field] === scorecard.sourceBinding[field], `render evidence source binding ${field} mismatch`);
  }
  check(
    sameJson(Object.keys(renderEvidence.locales ?? {}), expectedLocales),
    "source-bound render evidence locale inventory mismatch",
  );

  for (const localeRow of scorecard.locales) {
    check(canonicalDigest(Buffer.from(JSON.stringify(sourceCatalog.messages[localeRow.locale]))) === localeRow.localeMessagesSha256, `${localeRow.locale} digest does not match the source message catalog`);
    for (const [index, result] of localeRow.checks.entries()) {
      const definition = sourceDefinition.checks[index];
      check(result.id === definition.id && result.mode === definition.mode && result.category === definition.category, `${localeRow.locale}/${result.id} does not match the source check definition`);
    }
    const renderChecks = renderEvidence.locales[localeRow.locale]?.checks;
    check(
      sameJson(Object.keys(renderChecks ?? {}), expectedRenderCheckIds),
      `${localeRow.locale} source-bound render check inventory mismatch`,
    );
    for (const result of localeRow.checks.slice(70, 95)) {
      const record = renderChecks[result.id];
      check(["PASS", "FAIL"].includes(record?.status), `${localeRow.locale}/${result.id} source-bound render status is invalid`);
      const expectedResult = {
        status: record.status,
        detail: record.detail ?? "Source-bound clean-build render evidence",
        ...(record.metrics ? { metrics: record.metrics } : {}),
      };
      const actualResult = {
        status: result.status,
        detail: result.detail,
        ...(Object.hasOwn(result, "metrics") ? { metrics: result.metrics } : {}),
      };
      check(sameJson(actualResult, expectedResult), `${localeRow.locale}/${result.id} does not match source-bound render evidence`);
    }
  }

  check(ledger.schemaVersion === 1, "unexpected ledger schema version");
  check(ledger.status === "HOLD", "ledger must remain HOLD");
  check(ledger.mainnetStatus === "UNSCHEDULED_HOLD", "Mainnet must remain unscheduled HOLD");
  check(ledger.sourceBinding.scorecardSha256 === sha256(scorecardBytes), "scorecard hash mismatch");
  check(ledger.sourceBinding.scorecardGeneratedAt === scorecard.generatedAt, "scorecard generation time mismatch");
  check(ledger.sourceBinding.catalogHeadCommit === scorecard.sourceBinding.headCommit, "catalog source commit mismatch");
  check(ledger.sourceBinding.catalogHeadTree === scorecard.sourceBinding.headTree, "catalog source tree mismatch");
  check(ledger.sourceBinding.reviewedPolicySha256 === scorecard.sourceBinding.reviewedPolicySha256, "reviewed policy digest mismatch");
  check(sameJson(ledger.scorecardSummary, summary), "ledger scorecard summary mismatch");

  const holds = allResults.filter(({ status }) => status === "HOLD");
  const staticHolds = holds.filter(({ mode }) => mode === "STATIC");
  const nativeHolds = holds.filter(({ mode }) => mode === "NATIVE");
  const externalHolds = holds.filter(({ id }) => id === "LQA-054" || /^LQA-(?:096|097|098|099|100)$/u.test(id));
  const heuristicHolds = staticHolds.filter(({ id }) => id !== "LQA-054");

  check(holds.length === ledger.holdSummary.total, "total HOLD count mismatch");
  check(staticHolds.length === ledger.holdSummary.static, "static HOLD count mismatch");
  check(nativeHolds.length === ledger.holdSummary.native, "native HOLD count mismatch");
  check(externalHolds.length === ledger.holdSummary.externalEvidenceOnly, "external-evidence HOLD count mismatch");
  check(heuristicHolds.length === ledger.holdSummary.heuristicEditorialReview, "heuristic editorial HOLD count mismatch");
  check(ledger.holdSummary.automationMayApprove === 0, "automation cannot approve HOLD results");

  const expectedQueueIds = [...new Set(heuristicHolds.map(({ id }) => id))];
  check(sameJson(ledger.heuristicEditorialQueue.map(({ checkId }) => checkId), expectedQueueIds), "heuristic queue inventory drift");
  for (const queue of ledger.heuristicEditorialQueue) {
    const matching = heuristicHolds.filter(({ id }) => id === queue.checkId);
    check(queue.results === matching.length, `result count mismatch for ${queue.checkId}`);
    check(sameJson(queue.locales, matching.map(({ locale }) => locale)), `locale order mismatch for ${queue.checkId}`);
    check(queue.automationMayPrepare === true, `candidate preparation must remain explicit for ${queue.checkId}`);
    check(queue.automationMayApprove === false, `automation cannot approve ${queue.checkId}`);
    check(queue.nextAction.length > 80, `next action missing for ${queue.checkId}`);
  }

  const expectedExternalGateTopology = [
    {
      checkIds: ["LQA-054"],
      owner: "independent-language-id-reviewer",
      disposition: "BLOCKED_EXTERNAL_EVIDENCE",
    },
    {
      checkIds: ["LQA-096", "LQA-097", "LQA-098", "LQA-099", "LQA-100"],
      owner: "accountable-native-reviewers",
      disposition: "BLOCKED_NATIVE_REVIEW",
    },
  ];
  check(
    sameJson(
      ledger.externalEvidenceGates.map(({ checkIds, owner, disposition }) => ({ checkIds, owner, disposition })),
      expectedExternalGateTopology,
    ),
    "external evidence gate topology drift",
  );
  check(ledger.externalEvidenceGates.reduce((total, gate) => total + gate.results, 0) === externalHolds.length, "external evidence gate total mismatch");
  for (const gate of ledger.externalEvidenceGates) {
    const matching = externalHolds.filter(({ id }) => gate.checkIds.includes(id));
    check(gate.results === matching.length, `external evidence result count mismatch for ${gate.checkIds.join(",")}`);
    check(gate.localeCoverage === "ALL_50", "external evidence must cover all 50 locales");
    check(typeof gate.requiredEvidence === "string" && gate.requiredEvidence.length > 80, "external evidence requirement is incomplete");
    check(gate.automationMayPrepare === true, "external evidence preparation authority drift");
    check(gate.automationMayApprove === false, "automation cannot approve external evidence");
    check(gate.disposition.startsWith("BLOCKED_"), "external evidence must remain blocked");
  }

  const expectedPriorityLocales = [...new Set(heuristicHolds.map(({ locale }) => locale))]
    .map((locale) => {
      const localeHolds = heuristicHolds.filter((entry) => entry.locale === locale);
      return { locale, heuristicHoldCount: localeHolds.length, checkIds: localeHolds.map(({ id }) => id) };
    })
    .sort((left, right) => right.heuristicHoldCount - left.heuristicHoldCount)
    .slice(0, 5);
  check(sameJson(ledger.priorityLocales, expectedPriorityLocales), "priority queue must contain the five highest-density locales");
  if (heuristicHolds.length > 0) {
    check(ledger.priorityLocales.every(({ heuristicHoldCount }) => heuristicHoldCount >= 1), "priority locale density must remain positive while heuristic HOLDs exist");
  } else {
    check(ledger.priorityLocales.length === 0, "priority locale queue must be empty when no heuristic HOLDs exist");
  }
  check(ledger.decisions.some(({ id, state }) => id === "LQA-HOLD-003" && state === "NO_RELEASE_CLAIM"), "no-release decision missing");
  check(Object.values(ledger.assurance).every((value) => value === false), "ledger assurance flags must remain false");
  check(ledger.limitations.length === 4, "limitation inventory drift");

  return { summary, externalHoldCount: externalHolds.length, heuristicHoldCount: heuristicHolds.length };
}

function main() {
  const siteRoot = process.cwd();
  const repoRoot = resolve(siteRoot, "../../..");
  const auditRoot = resolve(siteRoot, "public/audits/localization-qa-20260803");
  const readArtifact = (name) => readCanonicalTrackedFile({ repoRoot, absolutePath: resolve(auditRoot, name) });
  const result = validateLanguageQaHoldLedgerArtifacts({
    scorecardBytes: readArtifact("language-qa-scorecard.json"),
    ledgerBytes: readArtifact("hold-remediation-ledger.json"),
    repoRoot,
  });
  console.log(`Language QA HOLD ledger valid: ${result.summary.PASS} PASS, ${result.summary.FAIL} FAIL, ${result.summary.HOLD} HOLD, ${result.summary.NOT_RUN} NOT_RUN; ${result.externalHoldCount} external-evidence gates and ${result.heuristicHoldCount} heuristic editorial reviews remain fail closed across 50 locales.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
