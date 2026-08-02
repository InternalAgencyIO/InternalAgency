import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/iat-ui-compatibility-20260802");

const readJson = (name) => JSON.parse(readFileSync(resolve(auditRoot, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => {
  if (!condition) throw new Error(`UI audit validation failed: ${message}`);
};

const manifest = readJson("manifest.json");
const scope = readJson("scope.json");
const findings = readJson("findings.json");
const checks = readJson("checks.json");
const environments = readJson("environment-matrix.json");

check(manifest.schema === "iat-ui-compatibility-audit-manifest/v1", "unexpected manifest schema");
check(scope.schema === "iat-ui-compatibility-audit-scope/v1", "unexpected scope schema");
check(findings.schema === "iat-ui-compatibility-findings/v1", "unexpected findings schema");
check(checks.schema === "iat-ui-compatibility-checks/v1", "unexpected checks schema");
check(environments.schema === "iat-ui-environment-matrix/v1", "unexpected environment schema");
check(manifest.status === "DRAFT_UI_RELEASE_HOLD", "status must remain DRAFT_UI_RELEASE_HOLD");
check(manifest.mainnetStatus === "HOLD", "mainnet must remain HOLD");
check(manifest.uiReleaseDecision === "HOLD", "UI release decision must remain HOLD");
check(manifest.clearance.authorizesDeployment === false, "audit must not authorize deployment");
check(manifest.clearance.authorizesSigning === false, "audit must not authorize signing");
check(manifest.clearance.authorizesBroadcast === false, "audit must not authorize broadcast");
check(scope.routes.length === 11, "expected eleven primary routes");

const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
for (const finding of findings.findings) {
  check(finding.state === "OPEN", `${finding.id} must remain OPEN in this revision`);
  check(Object.hasOwn(severityCounts, finding.severity), `${finding.id} has an unknown severity`);
  severityCounts[finding.severity] += 1;
}
check(findings.findings.length === manifest.findingSummary.total, "finding total mismatch");
check(JSON.stringify(severityCounts) === JSON.stringify(manifest.findingSummary.openBySeverity), "severity summary mismatch");

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

const requiredArtifacts = ["README.md", "FINDINGS.md", "scope.json", "findings.json", "checks.json", "environment-matrix.json"];
check(requiredArtifacts.every((name) => Object.hasOwn(manifest.artifactSha256, name)), "artifact hash coverage incomplete");
check(environments.environments.some((entry) => entry.id === "IOS_SAFARI_WEBKIT" && entry.result === "NOT_TESTED"), "iOS Safari limitation missing");
check(environments.environments.some((entry) => entry.id === "PHYSICAL_ANDROID_SYSTEM_BROWSER" && entry.result === "NOT_TESTED"), "physical Android limitation missing");
check(checks.checks.some((entry) => entry.id === "RESPONSIVE_MATRIX" && entry.result === "FAIL"), "responsive failure must remain explicit");
check(checks.checks.some((entry) => entry.id === "AXE_ROUTE_SWEEP" && entry.result === "FAIL"), "accessibility failure must remain explicit");

console.log(`UI audit valid: ${findings.findings.length} open findings, source ${manifest.sourceBinding.commit.slice(0, 12)}, UI HOLD.`);
