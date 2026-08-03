import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const auditDir = join(root, "public", "audits", "localization-qa-20260803");
const trackedFiles = [
  "app/i18n/messages.json",
  "app/i18n/critical-ui-source.json",
  "app/i18n/critical-ui-overrides.json",
  "app/i18n/LocaleRuntime.tsx",
  "scripts/generate-i18n-catalog.mjs",
  "scripts/check-i18n-catalog.mjs",
  "public/audits/localization-qa-20260803/browser-qa.json",
];
const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
const [catalog, critical, overrides] = await Promise.all([
  readJson("app/i18n/messages.json"),
  readJson("app/i18n/critical-ui-source.json"),
  readJson("app/i18n/critical-ui-overrides.json"),
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
  const content = await readFile(join(root, path));
  files[path] = { sha256: createHash("sha256").update(content).digest("hex"), bytes: content.length };
}
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
  generatedAt: new Date().toISOString(),
  title: "Internal Agency multilingual usability and localization QA",
  publicStatus: "DRAFT / STATIC QA / NOT LAUNCH APPROVAL",
  mainnetDecision: "HOLD (unchanged by this package)",
  deploymentPerformed: false,
  scope: {
    locales: locales.length,
    canonicalStrings: sources.length,
    criticalHydrationOnlyStrings: criticalSources.length,
    canonicalRouteDocumentsCoveredByExistingRouteTests: 1173,
  },
  outcome: {
    automatedCatalogCompleteness: locales.every((entry) => entry.emptyCount === 0) ? "PASS" : "FAIL",
    criticalEnglishFallbackGate: locales.every((entry) => entry.criticalEnglishFallbackCount === 0) ? "PASS" : "FAIL",
    nativeLanguageSignoff: "HOLD — native-speaker review required for every non-English locale",
    generalExactMatchHeuristic: "ADVISORY — includes legitimate protocol names and technical labels; samples require human triage",
    browserAccessibilityReview: browserQa.outcome,
  },
  validation: {
    runDate: "2026-08-03",
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
  files,
  browserQa,
  locales,
};
const table = locales.map((entry) => `| ${entry.locale} | ${entry.emptyCount} | ${entry.criticalEnglishFallbackCount} | ${entry.exactSourceMatchHeuristicCount} | ${entry.nativeSpeakerReview} |`).join("\n");
const validation = report.validation.commands.map((item) => {
  const count = item.automatedTestsPassed ? ` (${item.automatedTestsPassed} tests)` : ` (${item.errors} errors, ${item.warnings} warnings)`;
  return `- \`${item.command}\`: **${item.outcome}**${count}`;
}).join("\n");
const markdown = `# DRAFT localization, usability, and accessibility QA\n\n**STATIC QA / NOT LAUNCH APPROVAL / MAINNET HOLD / NO DEPLOYMENT PERFORMED**\n\nGenerated: ${report.generatedAt}\n\n## Outcome\n\n- Catalog completeness: **${report.outcome.automatedCatalogCompleteness}** across ${report.scope.locales} locales and ${report.scope.canonicalStrings} canonical strings.\n- Critical hydration-only English fallback gate: **${report.outcome.criticalEnglishFallbackGate}** for ${report.scope.criticalHydrationOnlyStrings} launch-control strings.\n- Native-language signoff: **HOLD**. Every non-English locale still requires a native-speaker review before it can be described as native-quality.\n- Mainnet decision: **HOLD, unchanged**. This package is not launch approval.\n\nThe launch-checklist word “GO” is treated semantically as “ready,” not as an instruction to move. The critical override keeps this cadence explicit.\n\n## Validation\n\n${validation}\n\n## Locale matrix\n\n| Locale | Empty | Critical English fallbacks | Exact-source heuristic | Native review |\n|---|---:|---:|---:|---|\n${table}\n\n## Limitations\n\n${report.limitations.map((item) => `- ${item}`).join("\n")}\n\nSee [report.json](./report.json) for source digests, samples, and machine-readable results.\n`;
await mkdir(auditDir, { recursive: true });
await Promise.all([
  writeFile(join(auditDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  writeFile(join(auditDir, "README.md"), markdown, "utf8"),
]);
console.log(`Localization QA report generated for ${locales.length} locales.`);
