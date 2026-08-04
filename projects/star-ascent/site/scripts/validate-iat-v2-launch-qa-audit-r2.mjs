import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/iat-v2-launch-qa-20260803-r2");
const readArtifact = (name) => readCanonicalTrackedFile({ repoRoot, absolutePath: resolve(auditRoot, name) });
const readJson = (name) => JSON.parse(readArtifact(name).toString("utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => {
  if (!condition) throw new Error(`IAT V2 launch QA revision 2 validation failed: ${message}`);
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
check(manifest.clearance.reviewedSourceAutomatedChecksPass === true, "automated source checks must pass");
check(manifest.clearance.livePublicationReconciled === true, "live publication reconciliation must be recorded");
check(manifest.clearance.bilingualMetadataAutomatedChecksPass === true, "automated bilingual metadata checks must pass");
check(manifest.clearance.nativeSpeakerReviewComplete === false, "native-speaker review must remain open");
check(manifest.clearance.productionDependenciesClear === true, "production dependencies must remain clear");
for (const field of ["developmentDependenciesReviewed", "externalEnvironmentCoverageComplete", "freshSourceBoundDevnetSignoffComplete", "fundingFloorSatisfied", "soleAuthorityRiskClosed", "qaReleaseApproved", "authorizesDeployment", "authorizesSigning", "authorizesBroadcast", "authorizesMainnetChange"]) {
  check(manifest.clearance[field] === false, `${field} must remain false`);
}

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
    "QA-L10N-HUMAN-001,QA-ADMIN-001,QA-DEPS-001,QA-COVERAGE-001,QA-SIGNOFF-001,QA-FUNDING-001,QA-AUTHORITY-001",
  "open finding inventory changed",
);

const commitTree = execFileSync("git", ["rev-parse", `${manifest.sourceBinding.commit}^{tree}`], { cwd: repoRoot, encoding: "utf8" }).trim();
check(commitTree === manifest.sourceBinding.gitTree, "source commit tree mismatch");
check(scope.sourceBinding.commit === manifest.sourceBinding.commit, "scope commit mismatch");
check(scope.sourceBinding.gitTree === manifest.sourceBinding.gitTree, "scope tree mismatch");
for (const [relativePath, expected] of Object.entries(scope.sourceSha256)) {
  const bytes = execFileSync("git", ["show", `${manifest.sourceBinding.commit}:${relativePath}`], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
  check(sha256(bytes) === expected, `source hash mismatch for ${relativePath}`);
}
for (const [name, expected] of Object.entries(manifest.artifactSha256)) {
  check(sha256(readArtifact(name)) === expected, `artifact hash mismatch for ${name}`);
}
const requiredArtifacts = ["README.md", "FINDINGS.md", "scope.json", "checks.json", "findings.json", "environment-matrix.json"];
check(requiredArtifacts.every((name) => Object.hasOwn(manifest.artifactSha256, name)), "artifact hash coverage incomplete");

const result = (id) => checks.checks.find((entry) => entry.id === id);
check(result("PRODUCTION_BUILD_AND_RENDERED_HTML")?.result === "PASS" && result("PRODUCTION_BUILD_AND_RENDERED_HTML").metrics.npmTestPassed === 45, "build and test evidence mismatch");
check(result("PLAYWRIGHT_RUNTIME_MATRIX")?.result === "PASS" && result("PLAYWRIGHT_RUNTIME_MATRIX").metrics.passed === 35 && result("PLAYWRIGHT_RUNTIME_MATRIX").metrics.consoleErrors === 0, "browser runtime evidence mismatch");
check(result("LINT")?.result === "PASS" && result("LINT").metrics.errors === 0 && result("LINT").metrics.warnings === 0, "lint evidence mismatch");
check(result("NATIVE_IMAGE_RUNTIME")?.result === "PASS" && result("NATIVE_IMAGE_RUNTIME").metrics.testsPassed === 2, "native-image regression evidence mismatch");
check(result("LOCALIZATION_AUTOMATED")?.metrics.locales === 50 && result("LOCALIZATION_AUTOMATED").metrics.criticalEnglishFallbacks === 0 && result("LOCALIZATION_AUTOMATED").metrics.nativeSpeakerReviewComplete === false, "localization boundary mismatch");
check(result("PRODUCTION_DEPENDENCY_AUDIT")?.metrics.total === 0, "production dependency audit must remain zero");
check(result("FULL_DEPENDENCY_AUDIT")?.metrics.total === 22 && result("FULL_DEPENDENCY_AUDIT").metrics.high === 7, "full dependency audit counts changed");
check(result("IAT_V2_VALIDATION")?.result === "PASS_IN_HOLD" && result("IAT_V2_VALIDATION").metrics.nodeTestsPassed === 65, "IAT V2 evidence mismatch");
check(result("IAT_V2_SIGNOFF")?.result === "VALID_HOLD" && result("IAT_V2_SIGNOFF").metrics.independentInitializationSignoff === "PENDING", "signoff HOLD boundary missing");
const launch = result("LAUNCH_GATES");
check(launch?.result === "PASS_IN_HOLD" && launch.metrics.observedLamports < launch.metrics.requiredLamports && launch.metrics.fundingFloorSatisfied === false && launch.metrics.fullGateCommand === "PASS", "launch funding HOLD mismatch");
const live = result("LIVE_PUBLIC_CONTRACT");
check(live?.result === "PASS" && live.metrics.totalChecksPassed === 76 && live.metrics.failures === 0 && live.metrics.productionMutated === false, "live public contract evidence mismatch");
check(result("LOCAL_ADMIN_BUILD")?.result === "PASS_WITH_WARNINGS", "admin warning state missing");
check(result("FUTURE_TEASERS")?.result === "PASS_INACTIVE" && result("FUTURE_TEASERS").metrics.deployedAtGenesis === false, "future-feature boundary mismatch");
check(environments.environments.some(({ id, result: state }) => id === "LIVE_PUBLIC_HTTPS_READ_ONLY" && state === "PASS"), "live environment pass missing");
check(environments.environments.some(({ id, result: state }) => id === "IOS_SAFARI_PHYSICAL" && state === "NOT_TESTED"), "physical iOS gap missing");
check(environments.environments.some(({ id, result: state }) => id === "ASSISTIVE_TECHNOLOGY" && state === "NOT_TESTED"), "assistive-technology gap missing");
check(environments.environments.some(({ id, result: state }) => id === "NATIVE_SPEAKER_REVIEW" && state === "NOT_REVIEWED"), "native-speaker gap missing");

console.log(`IAT V2 launch QA revision 2 valid: ${findings.findings.length} findings, 35/35 browser cases, 76/76 live checks, QA HOLD at ${manifest.sourceBinding.commit.slice(0, 12)}.`);
