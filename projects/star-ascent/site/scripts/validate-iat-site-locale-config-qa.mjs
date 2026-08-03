import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/iat-site-locale-config-qa-20260803");
const readJson = (name) => JSON.parse(readFileSync(resolve(auditRoot, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => {
  if (!condition) throw new Error(`Site locale/config QA validation failed: ${message}`);
};

const manifest = readJson("manifest.json");
const scope = readJson("scope.json");
const findings = readJson("findings.json");
const checks = readJson("checks.json");
const environments = readJson("environment-matrix.json");
const coverage = readJson("localization-coverage.json");
const hosting = readJson("hosting-observation.json");

check(manifest.schema === "iat-site-locale-config-qa-manifest/v1", "unexpected manifest schema");
check(scope.schema === "iat-site-locale-config-qa-scope/v1", "unexpected scope schema");
check(findings.schema === "iat-site-locale-config-qa-findings/v1", "unexpected findings schema");
check(checks.schema === "iat-site-locale-config-qa-checks/v1", "unexpected checks schema");
check(environments.schema === "iat-site-locale-config-qa-environments/v1", "unexpected environment schema");
check(coverage.schema === "iat-site-localization-coverage/v1", "unexpected coverage schema");
check(hosting.schema === "iat-site-hosting-observation/v1", "unexpected hosting schema");
check(manifest.status === "DRAFT_LOCALIZATION_RELEASE_HOLD", "localization release must remain HOLD");
check(manifest.mainnetStatus === "HOLD_UNCHANGED", "mainnet status must remain unchanged HOLD");
check(manifest.clearance.localizationReleaseApproved === false, "audit must not approve localization release");
check(manifest.clearance.mainnetLaunchApproved === false, "audit must not approve mainnet");
check(manifest.clearance.authorizesDeployment === false, "audit must not authorize deployment");
check(manifest.clearance.authorizesSigning === false, "audit must not authorize signing");
check(manifest.clearance.authorizesBroadcast === false, "audit must not authorize broadcast");

const tree = execFileSync("git", ["rev-parse", `${manifest.sourceBinding.commit}^{tree}`], { cwd: repoRoot, encoding: "utf8" }).trim();
check(tree === manifest.sourceBinding.gitTree, "source commit tree mismatch");
check(scope.sourceBinding.commit === manifest.sourceBinding.commit, "scope commit mismatch");
check(scope.sourceBinding.gitTree === manifest.sourceBinding.gitTree, "scope tree mismatch");
for (const [path, expected] of Object.entries(scope.sourceSha256)) {
  const bytes = execFileSync("git", ["show", `${manifest.sourceBinding.commit}:${path}`], { cwd: repoRoot, maxBuffer: 20 * 1024 * 1024 });
  check(sha256(bytes) === expected, `source hash mismatch for ${path}`);
}
for (const [name, expected] of Object.entries(manifest.artifactSha256)) {
  check(sha256(readFileSync(resolve(auditRoot, name))) === expected, `artifact hash mismatch for ${name}`);
}

const severityTemplate = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
const openBySeverity = { ...severityTemplate };
const closedBySeverity = { ...severityTemplate };
for (const finding of findings.findings) {
  check(["OPEN", "CLOSED"].includes(finding.state), `${finding.id} state is invalid`);
  check(Object.hasOwn(severityTemplate, finding.severity), `${finding.id} severity is invalid`);
  (finding.state === "OPEN" ? openBySeverity : closedBySeverity)[finding.severity] += 1;
}
check(findings.findings.length === manifest.findingSummary.total, "finding total mismatch");
check(JSON.stringify(openBySeverity) === JSON.stringify(manifest.findingSummary.openBySeverity), "open severity mismatch");
check(JSON.stringify(closedBySeverity) === JSON.stringify(manifest.findingSummary.closedBySeverity), "closed severity mismatch");
const openIds = findings.findings.filter(({ state }) => state === "OPEN").map(({ id }) => id).sort();
check(JSON.stringify(openIds) === JSON.stringify(["WEB-DEPS-001", "WEB-I18N-001", "WEB-I18N-002", "WEB-PHYSICAL-001"]), "unexpected open findings");

check(scope.coverage.localeCount === 50, "scope must cover 50 locales");
check(scope.coverage.canonicalRouteCount === 25, "scope must cover 25 canonical routes");
check(scope.coverage.playwrightProjectCount === 7, "scope must cover seven browser projects");
check(coverage.result === "HOLD_CATALOG_DRIFT", "coverage must remain HOLD");
check(coverage.routesScanned === 25, "coverage route count mismatch");
check(coverage.routesWithDrift === 15, "drift route count mismatch");
check(coverage.uniqueUncatalogedVisibleStrings === 247, "uncataloged string count mismatch");
check(coverage.byRoute["/tokenomics"] === 63, "tokenomics drift evidence mismatch");

const checkById = new Map(checks.checks.map((entry) => [entry.id, entry]));
check(checkById.get("SITE_TEST_BUILD")?.metrics.passed === 45, "site test count mismatch");
check(checkById.get("PLAYWRIGHT_FULL_MATRIX")?.metrics.passed === 43, "Playwright pass count mismatch");
check(checkById.get("PLAYWRIGHT_FULL_MATRIX")?.metrics.failed === 0, "Playwright failures must be zero");
check(checkById.get("FRESH_CHECKOUT_LOCALE_ASSETS")?.result === "PASS_LOCAL_FINAL_HOSTED_RERUN_PENDING", "fresh-checkout remediation status mismatch");
check(findings.findings.some(({ id, state }) => id === "WEB-QA-002" && state === "CLOSED"), "fresh-checkout finding must be closed locally");
check(checkById.get("HOSTING_PACKAGE")?.metrics.migrations === 6, "migration package count mismatch");
check(checkById.get("PRODUCTION_DEPENDENCY_AUDIT")?.metrics.vulnerabilities === 0, "production audit must be clean");
check(checkById.get("FULL_DEPENDENCY_AUDIT")?.metrics.total === 22, "full dependency finding count mismatch");
check(checkById.get("CATALOG_DRIFT_SCAN")?.result === "HOLD", "catalog drift must remain HOLD");

check(environments.environments.some(({ id, result }) => id === "PHYSICAL_IOS_SAFARI" && result === "NOT_TESTED"), "physical iOS limitation missing");
check(environments.environments.some(({ id, result }) => id === "NATIVE_LINUX_BROWSER_HOST" && result === "NOT_TESTED"), "native Linux limitation missing");
check(hosting.mode === "READ_ONLY", "hosting observation must be read-only");
check(hosting.configuration.sourceD1Binding === "DB", "D1 binding mismatch");
check(hosting.configuration.sourceR2Binding === null, "R2 must remain disabled");
check(hosting.mutation.deploymentPerformed === false, "audit must not record a deployment");
check(hosting.mutation.environmentChanged === false, "audit must not record an environment change");

console.log("Site locale/config QA valid: 50 locales, 43/49 Playwright cases passed with 6 intentional skips, 247 catalog-drift strings remain OPEN, localization and mainnet HOLD.");
