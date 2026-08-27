import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";
import { runtimeContentLocaleForPolicy } from "../app/i18n/runtime-content-policy.js";

const root = process.cwd();
const repoRoot = resolve(root, "../../..");
const auditDir = join(root, "public", "audits", "localization-qa-20260803");
const activeArtifactRun = {
  id: "2026-08-27-radiance-proof-claim-refresh-v1",
  recordedAt: "2026-08-27T00:18:21Z",
};
const trackedFiles = [
  "app/i18n/language-qa-checks.v1.json",
  "app/i18n/messages.json",
  "app/i18n/critical-ui-source.json",
  "app/i18n/critical-ui-overrides.json",
  "app/i18n/reviewed-localization-policy.json",
  "app/i18n/metadata.generated.json",
  "app/i18n/route-seo.json",
  "app/i18n/pending-visible-source.json",
  "app/i18n/LocaleRuntime.tsx",
  "scripts/generate-i18n-catalog.mjs",
  "scripts/check-i18n-catalog.mjs",
  "public/audits/localization-qa-20260803/browser-qa.json",
  "app/i18n/language-render-evidence.v1.json",
  "public/audits/localization-qa-20260803/language-qa-scorecard.json",
  "public/audits/localization-qa-20260803/hold-remediation-ledger.json",
];
const readCanonical = (path) => readCanonicalTrackedFile({ repoRoot, absolutePath: join(root, path) });
const readJson = async (path) => JSON.parse(readCanonical(path).toString("utf8"));
const [catalog, critical, reviewedPolicy, metadata, routeSeo, pending, scorecard, renderEvidence, holdLedger] = await Promise.all([
  readJson("app/i18n/messages.json"),
  readJson("app/i18n/critical-ui-source.json"),
  readJson("app/i18n/reviewed-localization-policy.json"),
  readJson("app/i18n/metadata.generated.json"),
  readJson("app/i18n/route-seo.json"),
  readJson("app/i18n/pending-visible-source.json"),
  readJson("public/audits/localization-qa-20260803/language-qa-scorecard.json"),
  readJson("app/i18n/language-render-evidence.v1.json"),
  readJson("public/audits/localization-qa-20260803/hold-remediation-ledger.json"),
]);
const browserQa = await readJson("public/audits/localization-qa-20260803/browser-qa.json");
if (
  reviewedPolicy.schema !== "iat-reviewed-localization-policy/v1"
  || reviewedPolicy.mode !== "GLOBAL_FAIL_CLOSED"
  || reviewedPolicy.fallback !== "canonical-english"
  || reviewedPolicy.machineDraftRuntimeAllowed !== false
  || reviewedPolicy.unreviewedTargetLanguageBundleAllowed !== false
  || reviewedPolicy.unreviewedLocaleAutonymsAllowed !== false
  || reviewedPolicy.directComponentReviewBundleComplete !== false
) throw new Error("Localization QA report requires the complete GLOBAL_FAIL_CLOSED policy");
const sources = Object.keys(catalog.messages.en);
const criticalSources = Object.values(critical);
const nonLinguistic = /^(?:STAR ASCENT|IAT|SOL|SOLANA|APY|UTC|X|T\+\d+|\d+(?:[.,:]\d+)*(?:%|[A-Z]+)?)$/i;
const exactSourceMatches = (locale) => sources.filter((source) => {
  if (!Object.hasOwn(reviewedPolicy.translations?.[locale] ?? {}, source)) return false;
  const translated = catalog.messages[locale][source]?.trim();
  return translated === source.trim() && /\p{L}/u.test(source) && !nonLinguistic.test(source.trim());
});

const files = {};
for (const path of trackedFiles) {
  const content = readCanonical(path);
  files[path] = { sha256: createHash("sha256").update(content).digest("hex"), bytes: content.length };
}
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const canonicalDigest = (value) => createHash("sha256").update(canonical(value)).digest("hex");
const currentBindings = {
  definitionSha256: files["app/i18n/language-qa-checks.v1.json"].sha256,
  messagesFileSha256: files["app/i18n/messages.json"].sha256,
  metadataSha256: canonicalDigest(metadata),
  routeSeoSha256: canonicalDigest(routeSeo),
  reviewedPolicySha256: canonicalDigest(reviewedPolicy),
};
for (const [field, expected] of Object.entries(currentBindings)) {
  if (scorecard.sourceBinding?.[field] !== expected) throw new Error(`Language QA scorecard has stale ${field}`);
  if (renderEvidence.sourceBinding?.[field] !== expected) throw new Error(`Language render evidence has stale ${field}`);
}
if (scorecard.sourceBinding?.pendingSha256 !== renderEvidence.sourceBinding?.pendingSha256) {
  throw new Error("Language QA scorecard and render evidence disagree about their historical pending-source input");
}
const pendingSourceCount = pending.capture?.pendingSourceCount;
const pendingRouteCount = pending.capture?.routesWithPendingSource;
if (
  pending.schema !== "iat-pending-visible-i18n-source/v1"
  || pending.status !== "DRAFT_TRANSLATION_AND_NATIVE_REVIEW_HOLD"
  || !Array.isArray(pending.sources)
  || pendingSourceCount !== pending.sources.length
  || pendingRouteCount !== Object.keys(pending.capture?.byRoute ?? {}).length
  || pending.runtime?.active !== false
  || pending.runtime?.automaticEnglishFallbackApproved !== false
  || pending.runtime?.translationComplete !== false
  || pending.runtime?.nativeReviewComplete !== false
) throw new Error("Pending visible-source ledger is not complete and fail closed");
const scorecardResults = Object.values(scorecard.summary ?? {}).reduce((total, count) => total + count, 0);
if (scorecard.scope?.locales !== 50 || scorecard.scope?.checksPerLocale !== 100 || scorecardResults !== 5000) throw new Error("Language QA scorecard cardinality is not 100 checks across 50 locales");
if (scorecard.status !== "HOLD" || scorecard.summary.FAIL !== 0 || scorecard.summary.NOT_RUN !== 0 || scorecard.summary.HOLD === 0) throw new Error("Language QA scorecard must remain a zero-FAIL, zero-NOT_RUN, evidence-dependent HOLD");
if (scorecard.assurance?.nativeQualityClaimAllowed !== false || scorecard.assurance?.releaseApproved !== false) throw new Error("Language QA scorecard must not claim native quality or release approval");
if (holdLedger.sourceBinding?.scorecardSha256 !== files["public/audits/localization-qa-20260803/language-qa-scorecard.json"].sha256) throw new Error("Language QA HOLD ledger is not bound to the current scorecard bytes");
if (JSON.stringify(holdLedger.scorecardSummary) !== JSON.stringify(scorecard.summary)) throw new Error("Language QA HOLD ledger summary does not match the current scorecard");
if (
  holdLedger.status !== "HOLD"
  || holdLedger.mainnetStatus !== "UNSCHEDULED_HOLD"
  || holdLedger.holdSummary?.externalEvidenceOnly !== 300
  || holdLedger.holdSummary.externalEvidenceOnly + holdLedger.holdSummary.heuristicEditorialReview !== holdLedger.holdSummary.total
) throw new Error("Language QA HOLD ledger must retain the reviewed fail-closed split");
if (holdLedger.assurance?.nativeQualityClaimAllowed !== false || holdLedger.assurance?.releaseApproved !== false) throw new Error("Language QA HOLD ledger must not claim native quality or release approval");
const renderRecords = Object.values(renderEvidence.locales ?? {}).flatMap((locale) => Object.values(locale.checks ?? {}));
if (renderEvidence.status !== "PASS" || renderRecords.length !== 1250 || renderRecords.some((record) => record.status !== "PASS")) throw new Error("Language render evidence must contain exactly 1,250 passing results");
const locales = Object.keys(catalog.messages).map((locale) => {
  const exact = locale === "en" ? [] : exactSourceMatches(locale);
  const reviewed = reviewedPolicy.translations?.[locale] ?? {};
  const runtimeStatus = reviewedPolicy.localeStatus?.[locale] ?? "MISSING";
  const contentLocale = runtimeContentLocaleForPolicy(reviewedPolicy, locale);
  const policyViolations = locale === "en" ? [] : sources.filter(
    (source) => catalog.messages[locale][source] !== (reviewed[source] ?? source),
  );
  const criticalFallbacks = locale === "en" ? [] : criticalSources.filter(
    (source) => !Object.hasOwn(reviewed, source) && catalog.messages[locale][source] === source,
  );
  return {
    locale,
    requestedLocale: locale,
    contentLocale,
    runtimeStatus,
    sourceCount: sources.length,
    emptyCount: Object.values(catalog.messages[locale]).filter((value) => !value.trim()).length,
    criticalCopyCount: criticalSources.length,
    reviewedCatalogCellCount: Object.keys(reviewed).length,
    canonicalFallbackCellCount: locale === "en" ? 0 : sources.length - Object.keys(reviewed).length,
    criticalCanonicalFallbackCount: criticalFallbacks.length,
    policyViolationCount: policyViolations.length,
    policyViolationSamples: policyViolations.slice(0, 12),
    reviewedExactSourceHeuristicCount: exact.length,
    reviewedExactSourceHeuristicSamples: exact.slice(0, 12),
    nativeSpeakerReview: locale === "en" ? "source" : "required",
  };
});
const report = {
  schemaVersion: 1,
  generatedAt: scorecard.generatedAt,
  generatedAtPolicy: "SOURCE_SCORECARD_GENERATED_AT_FOR_REPRODUCIBLE_OUTPUT",
  title: "Internal Agency multilingual usability and localization QA",
  publicStatus: "DRAFT / STATIC QA / NOT LAUNCH APPROVAL",
  mainnetDecision: "HOLD (unchanged by this package)",
  deploymentPerformed: false,
  scope: {
    locales: locales.length,
    canonicalStrings: sources.length,
    criticalHydrationOnlyStrings: criticalSources.length,
    canonicalRoutes: scorecard.scope.canonicalRoutes,
    languageQaResults: scorecardResults,
    pendingVisibleSourceStrings: pendingSourceCount,
    routesWithPendingVisibleSource: pendingRouteCount,
    reviewedRuntimeCells: catalog.meta.runtimeLocalizationPolicy?.reviewedRuntimeCells ?? 0,
    canonicalFallbackCells: catalog.meta.runtimeLocalizationPolicy?.fallbackRuntimeCells ?? 0,
  },
  outcome: {
    automatedCatalogCompleteness: locales.every((entry) => entry.emptyCount === 0) ? "PASS" : "FAIL",
    reviewedRuntimePolicyGate: locales.every((entry) => entry.policyViolationCount === 0) ? "PASS" : "FAIL",
    nativeLanguageSignoff: "HOLD — native-speaker review required for every non-English locale",
    reviewedExactMatchHeuristic: "ADVISORY — applies only to evidence-backed target-language cells; canonical fallback is excluded",
    sourceBoundLanguageScorecard: scorecard.status,
    sourceBoundRenderEvidence: renderEvidence.status,
    pendingLocalizationActivation: pendingSourceCount === 0 ? "NONE" : "HOLD_PENDING_TRANSLATION_AND_NATIVE_REVIEW",
    browserAccessibilityReview: browserQa.outcome,
  },
  activeArtifactRefresh: {
    ...activeArtifactRun,
    sourceCommit: pending.sourceBinding?.commit,
    pendingLedgerSha256: files["app/i18n/pending-visible-source.json"].sha256,
    pendingVisibleSourceStrings: pendingSourceCount,
    routesWithPendingVisibleSource: pendingRouteCount,
    runtimeActivation: false,
  },
  historicalValidation: {
    runDate: "2026-08-03",
    provenance: "Recorded by the earlier public QA package; regeneration does not claim these commands were rerun.",
    commands: [
      { command: "npm test", outcome: "PASS", automatedTestsPassed: 45 },
      { command: "npm run lint", outcome: "PASS", errors: 0, warnings: 0 },
      { command: "npm run check:future-teasers", outcome: "PASS", automatedTestsPassed: 4 },
    ],
    nonBlockingWarnings: [],
  },
  semanticDecision: reviewedPolicy.mode,
  reviewStatus: "All non-English locales remain HOLD until accountable evidence is added to the reviewed-localization policy.",
  limitations: [
    "Automated completeness proves that a static value exists; it does not prove idiomatic or culturally fluent language.",
    "Legacy editorial and critical-copy drafts are AI-assisted evidence only and are not active runtime translations.",
    "Canonical English fallback is an intentional safety state, not native-language approval.",
    `${pendingSourceCount} newly captured English source strings remain outside the active catalog and require translation plus accountable native review before any non-English activation.`,
    "Exact source-match counts inspect reviewed cells only and remain a triage heuristic, not a standalone defect count.",
    "Rendered browser checks are representative, not an exhaustive physical-device or assistive-technology certification.",
    "This package does not authorize deployment, signing, broadcasting, funding, or mainnet launch.",
  ],
  scorecard: {
    path: "language-qa-scorecard.json",
    generatedAt: scorecard.generatedAt,
    status: scorecard.status,
    summary: scorecard.summary,
    lanes: scorecard.lanes,
    assurance: scorecard.assurance,
  },
  holdRemediationLedger: {
    path: "hold-remediation-ledger.json",
    generatedAt: holdLedger.generatedAt,
    status: holdLedger.status,
    summary: holdLedger.holdSummary,
    priorityLocales: holdLedger.priorityLocales,
    assurance: holdLedger.assurance,
  },
  renderEvidence: {
    path: "../../../app/i18n/language-render-evidence.v1.json",
    generatedAt: renderEvidence.generatedAt,
    status: renderEvidence.status,
    scope: renderEvidence.scope,
    environment: renderEvidence.environment,
    limitations: renderEvidence.limitations,
  },
  files,
  browserQa,
  locales,
};
const table = locales.map((entry) => `| ${entry.locale} | ${entry.contentLocale} | ${entry.runtimeStatus} | ${entry.emptyCount} | ${entry.reviewedCatalogCellCount} | ${entry.canonicalFallbackCellCount} | ${entry.policyViolationCount} | ${entry.nativeSpeakerReview} |`).join("\n");
const historicalValidation = report.historicalValidation.commands.map((item) => {
  const count = item.automatedTestsPassed ? ` (${item.automatedTestsPassed} tests)` : ` (${item.errors} errors, ${item.warnings} warnings)`;
  return `- \`${item.command}\`: **${item.outcome}**${count}`;
}).join("\n");
const validation = [
  `- Exact scorecard: **${scorecard.summary.PASS} PASS / ${scorecard.summary.FAIL} FAIL / ${scorecard.summary.HOLD} HOLD / ${scorecard.summary.NOT_RUN} NOT_RUN** across ${scorecardResults} results.`,
  `- HOLD remediation ledger: [\`hold-remediation-ledger.json\`](./hold-remediation-ledger.json) separates **${holdLedger.holdSummary.externalEvidenceOnly} external-evidence gates** from **${holdLedger.holdSummary.heuristicEditorialReview} heuristic editorial reviews** without closing or downgrading any result.`,
  `- Source-bound browser/render evidence: **${renderEvidence.status}** for ${renderRecords.length}/${renderRecords.length} recorded checks.`,
  `- Pending visible-source ledger: **${pendingSourceCount} strings across ${pendingRouteCount} routes**, all runtime-inactive and held for translation plus accountable native review.`,
  `- Public process: [\`TRANSLATION-PROCESS.md\`](./TRANSLATION-PROCESS.md) records the model revision, runtime, generation parameters, deterministic repair stages, public commit chain, and future append-only update protocol.`,
  "- Machine-readable provenance: [`translation-provenance.v1.json`](./translation-provenance.v1.json) is append-only and is validated separately against exact tracked bytes and commit ancestry.",
  `- Data license: [\`CC0-DATA-DEDICATION.md\`](./CC0-DATA-DEDICATION.md) dedicates the project-owned, non-secret localization data and QA evidence under CC0 1.0 while explicitly excluding software, third-party model weights and runtimes, trademarks, secrets, and material the project does not own.`,
  "",
  holdLedger.priorityLocales.length > 0
    ? `The remediation ledger prioritizes ${holdLedger.priorityLocales.map(({ locale }) => `\`${locale}\``).join(", ")} for evidence-backed editorial review, while preserving all language-identification and native-review gates.`
    : "No heuristic editorial queue remains because unreviewed target-language drafts are inactive. Language-identification and native-review gates remain HOLD for every locale.",
  "",
  "Historical command record from 2026-08-03; regenerating this summary does not claim these commands were rerun:",
  "",
  historicalValidation,
].join("\n");
const markdown = `# DRAFT localization, usability, and accessibility QA\n\n**STATIC QA / NOT LAUNCH APPROVAL / MAINNET HOLD / NO DEPLOYMENT PERFORMED**\n\nGenerated: ${report.generatedAt}\n\n## Outcome\n\n- Catalog completeness: **${report.outcome.automatedCatalogCompleteness}** across ${report.scope.locales} locales and ${report.scope.canonicalStrings} canonical strings.\n- Reviewed-runtime policy gate: **${report.outcome.reviewedRuntimePolicyGate}** with ${report.scope.reviewedRuntimeCells} reviewed cells and ${report.scope.canonicalFallbackCells} canonical-English fallback cells.\n- Native-language signoff: **HOLD**. Every non-English locale still requires an accountable native review before it can be described as native-quality.\n- Mainnet decision: **HOLD, unchanged**. This package is not launch approval.\n\nUnreviewed target-language drafts are not served. Safety-critical copy remains canonical English until exact review evidence is committed.\n\n## Validation\n\n${validation}\n\n## Locale matrix\n\n| Route locale | Content locale | Runtime status | Empty | Reviewed cells | Fallback cells | Policy violations | Native review |\n|---|---|---|---:|---:|---:|---:|---|\n${table}\n\n## Limitations\n\n${report.limitations.map((item) => `- ${item}`).join("\n")}\n\nSee [report.json](./report.json) for source digests, samples, and machine-readable results.\n`;
const refreshedMarkdown = markdown
  .replace(
    `Generated: ${report.generatedAt}`,
    `Generated: ${report.generatedAt}\n\nActive-artifact refresh: ${report.activeArtifactRefresh.recordedAt}`,
  )
  .replace(
    "- Native-language signoff: **HOLD**.",
    `- Pending visible-source ledger: **${report.scope.pendingVisibleSourceStrings} strings across ${report.scope.routesWithPendingVisibleSource} routes** remain runtime-inactive until translation and accountable native review.\n- Native-language signoff: **HOLD**.`,
  );
await mkdir(auditDir, { recursive: true });
await Promise.all([
  writeFile(join(auditDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  writeFile(
    join(auditDir, "README.md"),
    refreshedMarkdown.replace(
      "See [report.json](./report.json) for source digests, samples, and machine-readable results.",
      "See [report.json](./report.json) for source digests, samples, and machine-readable results. Run `npm run check:i18n:provenance` from `projects/star-ascent/site` to verify public commit ancestry, historical mutation counts, file hashes, evidence totals, HOLD boundaries, and the append-only run policy.",
    ),
    "utf8",
  ),
]);
console.log(`Localization QA report generated for ${locales.length} locales.`);
