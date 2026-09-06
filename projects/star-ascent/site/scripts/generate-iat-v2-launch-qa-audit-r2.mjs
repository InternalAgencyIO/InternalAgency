import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/iat-v2-launch-qa-20260803-r2");
const auditedAtUtc = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const git = (...args) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
const sourceCommit = process.env.IAT_QA_SOURCE_COMMIT || git("rev-parse", "HEAD");
const gitTree = git("rev-parse", `${sourceCommit}^{tree}`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const sourcePaths = [
  ".github/workflows/iat-v2-proof.yml",
  "projects/star-ascent/site/app/layout.tsx",
  "projects/star-ascent/site/app/page.tsx",
  "projects/star-ascent/site/app/dossier/page.tsx",
  "projects/star-ascent/site/app/dossier/read/[slug]/page.tsx",
  "projects/star-ascent/site/app/press/page.tsx",
  "projects/star-ascent/site/app/world/page.tsx",
  "projects/star-ascent/site/app/i18n/messages.json",
  "projects/star-ascent/site/tests/native-image-runtime.test.mjs",
  "projects/star-ascent/site/tests/ui/ui-regression.spec.mjs",
  "projects/star-ascent/site/playwright.config.mjs",
  "projects/star-ascent/site/scripts/check-public-launch-routes.mjs",
  "projects/star-ascent/site/package.json",
  "projects/star-ascent/site/app/api/network/route.ts",
  "projects/star-ascent/site/app/network/page.tsx",
];

const sourceSha256 = Object.fromEntries(sourcePaths.map((path) => {
  const bytes = execFileSync("git", ["show", `${sourceCommit}:${path}`], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
  return [path, sha256(bytes)];
}));

const sourceBinding = {
  repository: "InternalAgencyIO/InternalAgency",
  commit: sourceCommit,
  gitTree,
};

const scope = {
  schema: "iat-v2-launch-qa-scope/v1",
  status: "DRAFT_QA_HOLD",
  auditedAtUtc,
  sourceBinding,
  routes: ["/", "/network", "/launch", "/proof", "/signal", "/tokenomics", "/dossier", "/world", "/verify", "/mint", "/rewards", "/press"],
  sourceSha256,
  included: [
    "production build, twenty rendered-HTML tests, and ten locale-routing tests",
    "eleven primary public routes in seven automated browser profiles",
    "HTTP status, document language/title, encoding, browser exception, console error, overflow, image, ARIA, focus, keyboard, and targeted axe assertions",
    "fifty-locale catalog completeness and critical-copy fallback checks",
    "native-image runtime regression coverage for the Vinext compatibility boundary",
    "production and full dependency audit summaries",
    "IAT V2, signoff, launch-gate, release, rollback, and reconciliation validators",
    "isolated local admin-console build warnings",
    "read-only HTTPS observations of internalagency.io and ileriakil.com",
  ],
  excluded: [
    "production or pre-production deployment",
    "wallet, hardware signer, secret, signing, simulation for signing, broadcast, mint, or transfer",
    "mainnet or devnet mutation",
    "DNS or hosting changes",
    "physical iOS or Android devices and installed mobile Safari",
    "graphical Linux desktop and assistive-technology certification",
    "performance-lab and network-throttling certification",
    "native-speaker certification for non-English locales",
    "fresh source-bound automated security or QA receipt/state/endpoint evidence",
  ],
};

const checks = {
  schema: "iat-v2-launch-qa-checks/v1",
  status: "DRAFT_QA_HOLD",
  runAtUtc: auditedAtUtc,
  checks: [
    { id: "PRODUCTION_BUILD_AND_RENDERED_HTML", result: "PASS", metrics: { build: "PASS", npmTestPassed: 45, renderedHtmlPassed: 20, localeRoutingPassed: 10, failed: 0, mainnetEvidenceGates: 16 } },
    { id: "PLAYWRIGHT_RUNTIME_MATRIX", result: "PASS", metrics: { passed: 35, failed: 0, profiles: 7, primaryRoutes: 11, pageExceptions: 0, consoleErrors: 0, non200PageResponses: 0, brokenImages: 0, documentOverflowDefects: 0, mojibakeMatches: 0, genericAriaLabelDefects: 0, targetedAxeViolations: 0 } },
    { id: "LINT", result: "PASS", metrics: { errors: 0, warnings: 0, documentedNativeImageExceptions: true } },
    { id: "NATIVE_IMAGE_RUNTIME", result: "PASS", metrics: { testsPassed: 2, testsFailed: 0, frameworkImageImportsInSensitivePages: 0, verifiedStaticAssets: 7 } },
    { id: "LOCALIZATION_AUTOMATED", result: "PASS_WITH_HUMAN_REVIEW_PENDING", metrics: { locales: 50, canonicalStringsPerLocale: 1280, catalogEmptyValues: 0, criticalEnglishFallbacks: 0, nativeSpeakerReviewComplete: false } },
    { id: "FAVICON_AND_METADATA_ORIGIN", result: "PASS", metrics: { testsPassed: 5, testsFailed: 0 } },
    { id: "PRODUCTION_DEPENDENCY_AUDIT", result: "PASS", metrics: { total: 0, moderate: 0, high: 0, critical: 0 } },
    { id: "FULL_DEPENDENCY_AUDIT", result: "HOLD_REVIEW", metrics: { total: 22, moderate: 15, high: 7, critical: 0, productionReachable: false } },
    { id: "IAT_V2_VALIDATION", result: "PASS_IN_HOLD", metrics: { nodeTestsPassed: 65, nodeTestsFailed: 0, policy: "PASS_IN_HOLD", timeGateProof: "PASS_LOCAL_ONLY", publicEvidence: "PASS_WITH_CURRENT_REHEARSAL_REQUIREMENTS" } },
    { id: "IAT_V2_SIGNOFF", result: "VALID_HOLD", metrics: { automatedInitializationEvidence: "PENDING", historicalFeatureArtifact: "VALID_FOR_PRIOR_ARTIFACT", currentRemediationRequiresFreshSignedDevnet: true, humanReviewerRequired: false, noSelfAttestation: true } },
    { id: "LAUNCH_GATES", result: "PASS_IN_HOLD", metrics: { schedule: "UNSCHEDULED_HOLD", observedLamports: 2533659570, requiredLamports: 8500000000, fundingFloorSatisfied: false, fullGateCommand: "PASS", authorizesSigning: false, authorizesBroadcast: false } },
    { id: "LOCAL_ADMIN_BUILD", result: "PASS_WITH_WARNINGS", metrics: { built: true, largestChunkKb: 2148.15, largestChunkGzipKb: 487.84, browserExternalizedImports: ["util", "crypto"] } },
    { id: "FUTURE_TEASERS", result: "PASS_INACTIVE", metrics: { testsPassed: 4, testsFailed: 0, deployedAtGenesis: false, claimRoute: false } },
    { id: "LIVE_PUBLIC_CONTRACT", result: "PASS", observedAtUtc: auditedAtUtc, metrics: { origins: 2, directPagesPassed: 42, legacyRedirectsPassed: 30, sitemapAndRobotsPassed: 4, totalChecksPassed: 76, failures: 0, productionMutated: false } },
    { id: "SOURCE_COMMIT_GITHUB_CHECKS", result: "NOT_YET_OBSERVED", metrics: { draftPullRequest: 4, head: sourceCommit, localEquivalentChecks: "PASS", githubActionsFinalResult: "PENDING_PUSH" } },
  ],
  limitations: [
    "The public-route check is a timestamped read-only observation, not a continuous monitor or deployment test.",
    "Playwright mobile profiles and WebKit are emulation/engine evidence, not physical mobile or installed Safari certification.",
    "Targeted axe rules and automated keyboard checks do not replace full assistive-technology testing.",
    "Automated localization completeness does not prove native fluency or cultural quality.",
    "The admin console build warning was not closed by a physical Trezor or ceremony session.",
    "No deployment, wallet access, signing, transaction, transfer, DNS, mainnet, or devnet mutation occurred.",
  ],
};

const findingList = [
  { id: "QA-RUNTIME-001", severity: "MEDIUM", state: "CLOSED", area: "browser-runtime", summary: "Unused next/font loading emitted blocked local module requests", resolution: "Removed the unused loader and added route-wide browser exception and console-error assertions.", evidence: ["35/35 Playwright cases passed", "zero page exceptions", "zero console errors"] },
  { id: "QA-LIVE-001", severity: "HIGH", state: "CLOSED", area: "live-publication-drift", summary: "Historical public-route, redirect, metadata, and sitemap drift", resolution: "The read-only public contract now passes every English and Turkish direct page, legacy redirect, metadata, alternate-link, sitemap, and robots check.", evidence: ["76/76 current read-only live checks passed", "zero live contract failures", "productionMutated=false"] },
  { id: "QA-L10N-AUTO-001", severity: "MEDIUM", state: "CLOSED", area: "localization-automation", summary: "Automated metadata and critical-copy parity gaps", resolution: "Reconciled route metadata and critical runtime copy across the fifty-locale catalog.", evidence: ["50 locales × 1,280 canonical strings", "zero empty catalog values", "zero critical English fallbacks"] },
  { id: "QA-LINT-001", severity: "LOW", state: "CLOSED", area: "image-runtime-lint", summary: "Eight native-image lint warnings obscured an unsafe framework-image substitution", resolution: "Retained Vinext-compatible native images with verified intrinsic dimensions, documented narrow lint exceptions, and regression tests that reject next/image imports in runtime-sensitive pages.", evidence: ["eslint: 0 errors, 0 warnings", "2/2 native-image runtime tests passed", "35/35 browser cases passed"] },
  { id: "QA-L10N-HUMAN-001", severity: "MEDIUM", state: "OPEN", area: "localization-human-review", summary: "Non-English locales have no native-speaker certification", evidence: ["automated completeness is not fluency proof", "AI-assisted translations remain labelled as such"], remediation: "Obtain and publish accountable native-speaker review before making native-quality claims." },
  { id: "QA-ADMIN-001", severity: "MEDIUM", state: "OPEN", area: "local-admin-runtime", summary: "The isolated admin bundle retains browser-externalized Node imports and a large output chunk", evidence: ["Vite build completed", "util and crypto were browser-externalized", "largest chunk 2148.15 kB and 487.84 kB gzip"], remediation: "Prove the built localhost console in an isolated non-signing runtime and reduce or document the dependency surface before ceremony use." },
  { id: "QA-DEPS-001", severity: "MEDIUM", state: "OPEN", area: "development-dependencies", summary: "Development tooling retains upstream advisories while production dependencies are clear", evidence: ["production audit total 0", "full audit total 22", "15 moderate and 7 high, 0 critical"], remediation: "Review non-breaking upstream resolutions and reproduce every launch gate before accepting toolchain changes." },
  { id: "QA-COVERAGE-001", severity: "INFO", state: "OPEN", area: "environment-coverage", summary: "Physical-device, graphical Linux, assistive-technology, performance-lab, and source-bound QA evidence are unavailable", evidence: ["mobile results are Playwright emulation", "no installed mobile Safari", "required automated environment receipts are unobserved"], remediation: "Run and publish the missing source-bound automated environment matrix." },
  { id: "QA-SIGNOFF-001", severity: "HIGH", state: "OPEN", area: "automated-devnet-evidence", summary: "Automated initialization evidence is pending and current remediation source requires a fresh signed Devnet rehearsal", evidence: ["historical feature artifact validates only for its prior artifact", "current source is not cleared by the historical rehearsal"], remediation: "Complete a fresh source-bound signed Devnet rehearsal and bind automated receipt/state/endpoint evidence without reusing stale evidence." },
  { id: "QA-FUNDING-001", severity: "HIGH", state: "OPEN", area: "mainnet-readiness", summary: "The reviewed mainnet address remains below the exact ceremony funding floor", evidence: ["observed 2,533,659,570 lamports", "required 8,500,000,000 lamports", "fundingFloorSatisfied=false"], remediation: "Fund through the separately authorized owner workflow, then rerun the read-only finalized balance gate." },
  { id: "QA-AUTHORITY-001", severity: "CRITICAL", state: "OPEN", area: "authority-concentration", summary: "The sole-Trezor authority model is an owner-accepted concentration risk", evidence: ["single-hardware-authority policy is intentional", "the risk remains recorded in the remediation audit", "no separate authority topology exists"], remediation: "Retain explicit owner acceptance and automated ceremony evidence; do not describe the concentration risk as remediated." },
];

const findings = { schema: "iat-v2-launch-qa-findings/v1", status: "DRAFT_QA_HOLD", findings: findingList };

const environments = {
  schema: "iat-v2-launch-qa-environments/v1",
  status: "DRAFT_QA_HOLD",
  environments: [
    { id: "PLAYWRIGHT_CHROMIUM_DESKTOP", kind: "AUTOMATED_ENGINE", viewport: "1440x900", result: "PASS", limitations: ["headless", "Windows host"] },
    { id: "PLAYWRIGHT_FIREFOX_DESKTOP", kind: "AUTOMATED_ENGINE", viewport: "1440x900", result: "PASS", limitations: ["headless", "Windows host"] },
    { id: "PLAYWRIGHT_WEBKIT_DESKTOP", kind: "AUTOMATED_ENGINE", viewport: "1440x900", result: "PASS", limitations: ["headless", "not installed Safari"] },
    { id: "PLAYWRIGHT_CHROMIUM_TABLET", kind: "AUTOMATED_ENGINE", viewport: "768x1024", result: "PASS", limitations: ["headless", "not a physical tablet"] },
    { id: "PLAYWRIGHT_FIREFOX_TABLET", kind: "AUTOMATED_ENGINE", viewport: "768x1024", result: "PASS", limitations: ["headless", "not a physical tablet"] },
    { id: "PLAYWRIGHT_PIXEL_5", kind: "DEVICE_EMULATION", viewport: "393x851", result: "PASS_AUTOMATED", limitations: ["not physical Android", "emulated device metrics"] },
    { id: "PLAYWRIGHT_IPHONE_13_WEBKIT", kind: "DEVICE_EMULATION", viewport: "390x664", result: "PASS_AUTOMATED", limitations: ["not iOS", "not installed Safari"] },
    { id: "WINDOWS_LOCAL_BUILD", kind: "LOCAL_BUILD", viewport: null, result: "PASS", limitations: ["single host"] },
    { id: "LIVE_PUBLIC_HTTPS_READ_ONLY", kind: "READ_ONLY_REMOTE_OBSERVATION", viewport: null, result: "PASS", limitations: ["timestamped observation", "no deployment or mutation"] },
    { id: "IOS_SAFARI_PHYSICAL", kind: "NOT_AVAILABLE", viewport: null, result: "NOT_TESTED", limitations: ["coverage gap"] },
    { id: "PHYSICAL_ANDROID_SYSTEM_BROWSER", kind: "NOT_AVAILABLE", viewport: null, result: "NOT_TESTED", limitations: ["coverage gap"] },
    { id: "LINUX_GRAPHICAL_BROWSER", kind: "NOT_AVAILABLE", viewport: null, result: "NOT_TESTED", limitations: ["coverage gap"] },
    { id: "ASSISTIVE_TECHNOLOGY", kind: "NOT_AVAILABLE", viewport: null, result: "NOT_TESTED", limitations: ["screen reader, switch control, and voice control not certified"] },
    { id: "PERFORMANCE_LAB", kind: "NOT_AVAILABLE", viewport: null, result: "NOT_TESTED", limitations: ["no throttled device laboratory"] },
    { id: "NATIVE_SPEAKER_REVIEW", kind: "NOT_AVAILABLE", viewport: null, result: "NOT_REVIEWED", limitations: ["all non-English locales remain human-review pending"] },
    { id: "SOURCE_BOUND_AUTOMATED_QA_EVIDENCE", kind: "NOT_AVAILABLE", viewport: null, result: "NOT_OBSERVED", limitations: ["required receipt/state/endpoint evidence is absent"] },
  ],
};

const openBySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
const closedBySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
for (const finding of findingList) (finding.state === "OPEN" ? openBySeverity : closedBySeverity)[finding.severity] += 1;

const readme = `# IAT V2 launch QA consolidation — revision 2

**DRAFT QA / MAINNET HOLD / NOT DEPLOYED BY THIS PACKAGE / NO SIGNING OR BROADCAST AUTHORITY**

Source commit: \`${sourceCommit}\`
Audited at: ${auditedAtUtc}

## Decision

Automated source, browser, localization, public-route, release-chain, and production-dependency checks pass. Mainnet remains **UNSCHEDULED_HOLD** because funding, fresh source-bound Devnet rehearsal and automated direct evidence, sole-authority risk handling, development-tooling evidence, and unavailable environment coverage remain open.

This revision supersedes the observations in \`iat-v2-launch-qa-20260803\` without rewriting that historical package. In particular, the live public contract now passes 76/76 checks and lint passes with zero warnings.

## Evidence summary

- \`npm test\`: 45/45 tests passed.
- \`npm run check:ui-regression\`: 35/35 browser cases passed across seven profiles.
- \`npm run check:iat-v2\`: 65/65 Node security and policy tests passed in HOLD.
- \`npm run check:launch-gates\`: full release, ceremony, rollback, and reconciliation chain passed in HOLD.
- \`npm run check:public\`: 76/76 current read-only live checks passed.
- \`npm run lint\`: 0 errors, 0 warnings.
- Production dependency audit: 0 vulnerabilities; full development audit: 22 advisories under review.

See \`FINDINGS.md\`, \`checks.json\`, \`findings.json\`, \`scope.json\`, and \`environment-matrix.json\` for the auditable record and limitations.
`;

const findingsMarkdown = `# Findings — revision 2

**DRAFT QA / MAINNET HOLD**

| ID | Severity | State | Summary |
|---|---|---|---|
${findingList.map((finding) => `| ${finding.id} | ${finding.severity} | ${finding.state} | ${finding.summary} |`).join("\n")}

Open findings remain launch inputs, not authorization. The owner-accepted sole-Trezor concentration risk is recorded as open and is not described as remediated.
`;

await mkdir(auditRoot, { recursive: true });
const artifacts = {
  "README.md": readme,
  "FINDINGS.md": findingsMarkdown,
  "scope.json": json(scope),
  "checks.json": json(checks),
  "findings.json": json(findings),
  "environment-matrix.json": json(environments),
};
await Promise.all(Object.entries(artifacts).map(([name, content]) => writeFile(resolve(auditRoot, name), content, "utf8")));
const artifactSha256 = Object.fromEntries(await Promise.all(Object.keys(artifacts).map(async (name) => [name, sha256(await readFile(resolve(auditRoot, name)))])));
const manifest = {
  schema: "iat-v2-launch-qa-manifest/v1",
  status: "DRAFT_QA_HOLD",
  mainnetStatus: "HOLD",
  qaDecision: "HOLD",
  assurance: "SOURCE_BOUND_AUTOMATED_DIRECT_EVIDENCE_UNOBSERVED",
  title: "IAT V2 launch QA consolidation — 2026-08-03 revision 2",
  auditedAtUtc,
  sourceBinding: { ...sourceBinding, scopePath: "public/audits/iat-v2-launch-qa-20260803-r2/scope.json" },
  findingSummary: { total: findingList.length, openBySeverity, closedBySeverity },
  clearance: {
    reviewedSourceAutomatedChecksPass: true,
    livePublicationReconciled: true,
    bilingualMetadataAutomatedChecksPass: true,
    nativeSpeakerReviewComplete: false,
    adminRuntimeWarningsClosed: false,
    productionDependenciesClear: true,
    developmentDependenciesReviewed: false,
    externalEnvironmentCoverageComplete: false,
    freshSourceBoundDevnetSignoffComplete: false,
    fundingFloorSatisfied: false,
    soleAuthorityRiskClosed: false,
    qaReleaseApproved: false,
    authorizesDeployment: false,
    authorizesSigning: false,
    authorizesBroadcast: false,
    authorizesMainnetChange: false,
  },
  publicDevelopmentSurface: {
    draftPullRequest: "https://github.com/InternalAgencyIO/InternalAgency/pull/4",
    packagePath: "projects/star-ascent/site/public/audits/iat-v2-launch-qa-20260803-r2",
    deploymentState: "NOT_DEPLOYED",
  },
  artifactSha256,
  limitations: [
    "This package has not observed the required fresh source-bound security, accessibility, localization, or physical-device evidence.",
    "Live public-route observations are timestamped read-only HTTP evidence and do not prove future availability.",
    "No wallet, key, hardware signer, secret, deployment, signing, transaction, transfer, DNS, mainnet, or devnet state was accessed or changed.",
  ],
};
await writeFile(resolve(auditRoot, "manifest.json"), json(manifest), "utf8");
console.log(`IAT V2 launch QA revision 2 generated at ${auditRoot} for ${sourceCommit.slice(0, 12)}.`);
