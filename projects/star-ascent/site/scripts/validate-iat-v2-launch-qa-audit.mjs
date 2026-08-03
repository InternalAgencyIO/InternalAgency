import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/iat-v2-launch-qa-20260803");
const readJson = (name) => JSON.parse(readFileSync(resolve(auditRoot, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => {
  if (!condition) throw new Error(`IAT V2 launch QA validation failed: ${message}`);
};

const manifest = readJson("manifest.json");
const scope = readJson("scope.json");
const checks = readJson("checks.json");
const findings = readJson("findings.json");
const environments = readJson("environment-matrix.json");

check(manifest.schema === "iat-v2-launch-qa-manifest/v1", "unexpected manifest schema");
check(scope.schema === "iat-v2-launch-qa-scope/v1", "unexpected scope schema");
check(checks.schema === "iat-v2-launch-qa-checks/v1", "unexpected checks schema");
check(findings.schema === "iat-v2-launch-qa-findings/v1", "unexpected findings schema");
check(environments.schema === "iat-v2-launch-qa-environments/v1", "unexpected environment schema");
for (const artifact of [manifest, scope, checks, findings, environments]) {
  check(artifact.status === "DRAFT_QA_HOLD", "every machine-readable artifact must remain DRAFT_QA_HOLD");
}
check(manifest.mainnetStatus === "HOLD" && manifest.qaDecision === "HOLD", "QA and mainnet must remain HOLD");
check(manifest.clearance.qaReleaseApproved === false, "QA release must remain unapproved");
for (const field of ["authorizesDeployment", "authorizesSigning", "authorizesBroadcast", "authorizesMainnetChange"]) {
  check(manifest.clearance[field] === false, `${field} must remain false`);
}
check(manifest.clearance.livePublicationReconciled === false, "live publication drift must remain open");
check(manifest.clearance.bilingualMetadataApproved === false, "bilingual metadata must remain unapproved");
check(manifest.clearance.productionDependenciesClear === true, "production dependency result must remain clear");
check(manifest.clearance.developmentDependenciesReviewed === false, "development dependency review must remain open");

const severityTemplate = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
const openBySeverity = { ...severityTemplate };
const closedBySeverity = { ...severityTemplate };
for (const finding of findings.findings) {
  check(["OPEN", "CLOSED"].includes(finding.state), `${finding.id} has an unknown state`);
  check(Object.hasOwn(severityTemplate, finding.severity), `${finding.id} has an unknown severity`);
  (finding.state === "OPEN" ? openBySeverity : closedBySeverity)[finding.severity] += 1;
}
check(findings.findings.length === manifest.findingSummary.total, "finding total mismatch");
check(JSON.stringify(openBySeverity) === JSON.stringify(manifest.findingSummary.openBySeverity), "open severity summary mismatch");
check(JSON.stringify(closedBySeverity) === JSON.stringify(manifest.findingSummary.closedBySeverity), "closed severity summary mismatch");
check(
  findings.findings.filter(({ state }) => state === "OPEN").map(({ id }) => id).join(",") ===
    "QA-LIVE-001,QA-L10N-001,QA-ADMIN-001,QA-DEPS-001,QA-COVERAGE-001",
  "open finding inventory changed",
);

const commitTree = execFileSync("git", ["rev-parse", `${manifest.sourceBinding.commit}^{tree}`], { cwd: repoRoot, encoding: "utf8" }).trim();
check(commitTree === manifest.sourceBinding.gitTree, "source commit tree mismatch");
check(scope.sourceBinding.commit === manifest.sourceBinding.commit, "scope commit mismatch");
check(scope.sourceBinding.gitTree === manifest.sourceBinding.gitTree, "scope tree mismatch");
for (const [relativePath, expected] of Object.entries(scope.sourceSha256)) {
  const bytes = execFileSync("git", ["show", `${manifest.sourceBinding.commit}:${relativePath}`], { cwd: repoRoot });
  check(sha256(bytes) === expected, `source hash mismatch for ${relativePath}`);
}
for (const [name, expected] of Object.entries(manifest.artifactSha256)) {
  check(sha256(readFileSync(resolve(auditRoot, name))) === expected, `artifact hash mismatch for ${name}`);
}
const requiredArtifacts = ["README.md", "FINDINGS.md", "scope.json", "checks.json", "findings.json", "environment-matrix.json"];
check(requiredArtifacts.every((name) => Object.hasOwn(manifest.artifactSha256, name)), "artifact hash coverage incomplete");

const result = (id) => checks.checks.find((entry) => entry.id === id);
check(result("PRODUCTION_BUILD_AND_RENDERED_HTML")?.result === "PASS" && result("PRODUCTION_BUILD_AND_RENDERED_HTML").metrics.renderedHtmlPassed === 19, "build/rendered HTML evidence mismatch");
check(result("PLAYWRIGHT_RUNTIME_MATRIX")?.result === "PASS" && result("PLAYWRIGHT_RUNTIME_MATRIX").metrics.passed === 35 && result("PLAYWRIGHT_RUNTIME_MATRIX").metrics.consoleErrors === 0, "browser runtime evidence mismatch");
check(result("PRODUCTION_DEPENDENCY_AUDIT")?.metrics.total === 0, "production dependency audit must remain zero");
check(result("FULL_DEPENDENCY_AUDIT")?.metrics.total === 22 && result("FULL_DEPENDENCY_AUDIT").metrics.high === 7, "full dependency audit counts changed");
check(result("IAT_V2_VALIDATION")?.result === "PASS_IN_HOLD" && result("IAT_V2_VALIDATION").metrics.nodeTestsPassed === 65, "IAT V2 evidence mismatch");
check(result("IAT_V2_SIGNOFF")?.result === "VALID_HOLD" && result("IAT_V2_SIGNOFF").metrics.independentInitializationSignoff === "PENDING", "signoff HOLD boundary missing");
const launch = result("LAUNCH_GATES");
check(launch?.result === "PASS_IN_HOLD" && launch.metrics.observedLamports < launch.metrics.requiredLamports && launch.metrics.fundingFloorSatisfied === false, "launch funding HOLD mismatch");
const live = result("LIVE_PUBLIC_CONTRACT");
check(live?.result === "FAIL_HOLD" && live.metrics.failures === 46, "live public contract failure count mismatch");
check(live.metrics.directRoutingPublicationDrift === live.metrics.route404s + live.metrics.incorrectV2Redirects + live.metrics.sitemapOmissions, "direct live drift subtotal mismatch");
check(live.metrics.failures === live.metrics.directRoutingPublicationDrift + live.metrics.titleDescriptionContractMismatches, "live failure subtotal mismatch");
check(live.metrics.productionMutated === false, "live observation must remain read-only");
check(result("LOCAL_ADMIN_BUILD")?.result === "PASS_WITH_WARNINGS", "admin warning state missing");
check(environments.environments.some(({ id, result: state }) => id === "IOS_SAFARI_PHYSICAL" && state === "NOT_TESTED"), "physical iOS gap missing");
check(environments.environments.some(({ id, result: state }) => id === "ASSISTIVE_TECHNOLOGY" && state === "NOT_TESTED"), "assistive-technology gap missing");

console.log(`IAT V2 launch QA package valid: ${findings.findings.length} findings, 35/35 browser cases, live drift open, QA HOLD at ${manifest.sourceBinding.commit.slice(0, 12)}.`);
