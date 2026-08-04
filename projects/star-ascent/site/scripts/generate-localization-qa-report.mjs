import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";

const root = process.cwd();
const repoRoot = resolve(root, "../../..");
const auditDir = join(root, "public", "audits", "localization-qa-20260803");
const trackedFiles = [
  "app/i18n/language-qa-checks.v1.json",
  "app/i18n/messages.json",
  "app/i18n/critical-ui-source.json",
  "app/i18n/critical-ui-overrides.json",
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
const [catalog, critical, overrides, metadata, routeSeo, pending, scorecard, renderEvidence, holdLedger] = await Promise.all([
  readJson("app/i18n/messages.json"),
  readJson("app/i18n/critical-ui-source.json"),
  readJson("app/i18n/critical-ui-overrides.json"),
  readJson("app/i18n/metadata.generated.json"),
  readJson("app/i18n/route-seo.json"),
  readJson("app/i18n/pending-visible-source.json"),
  readJson("public/audits/localization-qa-20260803/language-qa-scorecard.json"),
  readJson("app/i18n/language-render-evidence.v1.json"),
  readJson("public/audits/localization-qa-20260803/hold-remediation-ledger.json"),
]);
const browserQa = await readJson("public/audits/localization-qa-20260803/browser-qa.json");
const sources = Object.keys(catalog.messages.en);
const criticalSources = Object.values(critical);
const nonLinguistic = /^(?:STAR ASCENT|IAT|SOL|SOLANA|APY|UTC|X|T\+\d+|\d+(?:[.,:]\d+)*(?:%|[A-Z]+)?)$/i;
const exactSourceMatches = (locale) => sources.filter((source) => {
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
  pendingSha256: canonicalDigest(pending),
};
for (const [field, expected] of Object.entries(currentBindings)) {
  if (scorecard.sourceBinding?.[field] !== expected) throw new Error(`Language QA scorecard has stale ${field}`);
  if (renderEvidence.sourceBinding?.[field] !== expected) throw new Error(`Language render evidence has stale ${field}`);
}
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
  const criticalLeaks = locale === "en" ? [] : criticalSources.filter(
    (source) => catalog.messages[locale][source].trim().toLocaleLowerCase() === source.toLocaleLowerCase(),
  );
  return {
    locale,
    sourceCount: sources.length,
    emptyCount: Object.values(catalog.messages[locale]).filter((value) => !value.trim()).length,
    criticalCopyCount: criticalSources.length,
    criticalEnglishFallbackCount: criticalLeaks.length,
    exactSourceMatchHeuristicCount: exact.length,
    exactSourceMatchHeuristicSamples: exact.slice(0, 12),
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
  },
  outcome: {
    automatedCatalogCompleteness: locales.every((entry) => entry.emptyCount === 0) ? "PASS" : "FAIL",
    criticalEnglishFallbackGate: locales.every((entry) => entry.criticalEnglishFallbackCount === 0) ? "PASS" : "FAIL",
    nativeLanguageSignoff: "HOLD — native-speaker review required for every non-English locale",
    generalExactMatchHeuristic: "ADVISORY — includes legitimate protocol names and technical labels; samples require human triage",
    sourceBoundLanguageScorecard: scorecard.status,
    sourceBoundRenderEvidence: renderEvidence.status,
    browserAccessibilityReview: browserQa.outcome,
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
  semanticDecision: overrides.semanticRule,
  reviewStatus: overrides.reviewStatus,
  limitations: [
    "Automated completeness proves that a static value exists; it does not prove idiomatic or culturally fluent language.",
    "The editorial critical-copy pass is AI-assisted and must not be described as native-speaker reviewed.",
    "Exact source-match counts are a triage heuristic, not a standalone defect count.",
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
const table = locales.map((entry) => `| ${entry.locale} | ${entry.emptyCount} | ${entry.criticalEnglishFallbackCount} | ${entry.exactSourceMatchHeuristicCount} | ${entry.nativeSpeakerReview} |`).join("\n");
const historicalValidation = report.historicalValidation.commands.map((item) => {
  const count = item.automatedTestsPassed ? ` (${item.automatedTestsPassed} tests)` : ` (${item.errors} errors, ${item.warnings} warnings)`;
  return `- \`${item.command}\`: **${item.outcome}**${count}`;
}).join("\n");
const validation = [
  `- Exact scorecard: **${scorecard.summary.PASS} PASS / ${scorecard.summary.FAIL} FAIL / ${scorecard.summary.HOLD} HOLD / ${scorecard.summary.NOT_RUN} NOT_RUN** across ${scorecardResults} results.`,
  `- HOLD remediation ledger: [\`hold-remediation-ledger.json\`](./hold-remediation-ledger.json) separates **${holdLedger.holdSummary.externalEvidenceOnly} external-evidence gates** from **${holdLedger.holdSummary.heuristicEditorialReview} heuristic editorial reviews** without closing or downgrading any result.`,
  `- Source-bound browser/render evidence: **${renderEvidence.status}** for ${renderRecords.length}/${renderRecords.length} recorded checks.`,
  "",
  `The remediation ledger prioritizes ${holdLedger.priorityLocales.map(({ locale }) => `\`${locale}\``).join(", ")} because each has five heuristic HOLDs, while preserving all language-identification and native-review gates. Automation may prepare candidates and evidence inventories; it may not approve native quality or independent language identification.`,
  "",
  "Historical command record from 2026-08-03; regenerating this summary does not claim these commands were rerun:",
  "",
  historicalValidation,
].join("\n");
const markdown = `# DRAFT localization, usability, and accessibility QA\n\n**STATIC QA / NOT LAUNCH APPROVAL / MAINNET HOLD / NO DEPLOYMENT PERFORMED**\n\nGenerated: ${report.generatedAt}\n\n## Outcome\n\n- Catalog completeness: **${report.outcome.automatedCatalogCompleteness}** across ${report.scope.locales} locales and ${report.scope.canonicalStrings} canonical strings.\n- Critical hydration-only English fallback gate: **${report.outcome.criticalEnglishFallbackGate}** for ${report.scope.criticalHydrationOnlyStrings} launch-control strings.\n- Native-language signoff: **HOLD**. Every non-English locale still requires a native-speaker review before it can be described as native-quality.\n- Mainnet decision: **HOLD, unchanged**. This package is not launch approval.\n\nThe launch-checklist word “GO” is treated semantically as “ready,” not as an instruction to move. The critical override keeps this cadence explicit.\n\n## Validation\n\n${validation}\n\n## Locale matrix\n\n| Locale | Empty | Critical English fallbacks | Exact-source heuristic | Native review |\n|---|---:|---:|---:|---|\n${table}\n\n## Limitations\n\n${report.limitations.map((item) => `- ${item}`).join("\n")}\n\nSee [report.json](./report.json) for source digests, samples, and machine-readable results.\n`;
await mkdir(auditDir, { recursive: true });
await Promise.all([
  writeFile(join(auditDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  writeFile(join(auditDir, "README.md"), markdown, "utf8"),
]);
console.log(`Localization QA report generated for ${locales.length} locales.`);
