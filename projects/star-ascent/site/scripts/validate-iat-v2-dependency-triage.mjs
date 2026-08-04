import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/iat-v2-dependency-triage-20260804");
const readArtifact = (name) => readCanonicalTrackedFile({ repoRoot, absolutePath: resolve(auditRoot, name) });
const report = JSON.parse(readArtifact("report.json").toString("utf8"));
const reachability = JSON.parse(readArtifact("reachability.json").toString("utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => {
  if (!condition) throw new Error(`IAT V2 dependency triage validation failed: ${message}`);
};

check(report.schemaVersion === 1, "unexpected schema version");
check(report.status === "DRAFT_QA_HOLD", "audit must remain QA HOLD");
check(report.mainnetStatus === "UNSCHEDULED_HOLD", "mainnet must remain unscheduled HOLD");
check(report.deploymentPerformed === false, "audit cannot claim a deployment");
check(execFileSync("git", ["rev-parse", `${report.sourceBinding.commit}^{tree}`], { cwd: repoRoot, encoding: "utf8" }).trim() === report.sourceBinding.gitTree, "source tree mismatch");

for (const [path, expected] of Object.entries(report.sourceBinding.sha256)) {
  const bytes = execFileSync("git", ["show", `${report.sourceBinding.commit}:${path}`], { cwd: repoRoot });
  check(sha256(bytes) === expected, `source hash mismatch for ${path}`);
}

const packageJson = JSON.parse(execFileSync("git", ["show", `${report.sourceBinding.commit}:projects/star-ascent/site/package.json`], { cwd: repoRoot, encoding: "utf8" }));
for (const [name, expected] of Object.entries(report.exactDirectPins)) {
  check(packageJson.dependencies?.[name] === expected || packageJson.devDependencies?.[name] === expected, `direct pin drift for ${name}`);
}

check(JSON.stringify(report.githubDefaultBranchSnapshot.severity) === JSON.stringify({ critical: 0, high: 38, moderate: 33, low: 7 }), "default-branch severity snapshot drift");
check(report.githubDefaultBranchSnapshot.total === 78, "default-branch alert total drift");
check(JSON.stringify(report.currentLockNpmAudit.vulnerabilityCounts) === JSON.stringify({ critical: 0, high: 10, moderate: 16, low: 0, total: 26 }), "current-lock audit counts drift");
check(JSON.stringify(report.currentLockNpmAudit.directHigh) === JSON.stringify(["@solana/spl-token", "@switchboard-xyz/on-demand", "next"]), "direct-high inventory drift");
check(report.currentLockNpmAudit.directHigh.length + report.currentLockNpmAudit.transitiveHigh.length === 10, "high finding inventory must reconcile to ten");
check(report.decisions.some(({ id, state }) => id === "DEP-002" && state === "HOLD"), "unpatched bigint-buffer decision must remain HOLD");
for (const value of Object.values(report.assurance)) check(value === false, "assurance flags must remain false");
check(report.limitations.length === 4, "limitation inventory drift");
check(report.limitations.some((value) => value.includes("does not by itself prove")), "runtime-reachability limitation missing");

check(reachability.schemaVersion === 1, "unexpected reachability schema version");
check(reachability.status === "DRAFT_QA_HOLD", "reachability matrix must remain QA HOLD");
check(reachability.mainnetStatus === "UNSCHEDULED_HOLD", "reachability matrix must keep mainnet unscheduled HOLD");
check(execFileSync("git", ["rev-parse", `${reachability.sourceBinding.commit}^{tree}`], { cwd: repoRoot, encoding: "utf8" }).trim() === reachability.sourceBinding.gitTree, "reachability source tree mismatch");

for (const [path, expected] of Object.entries(reachability.sourceBinding.sha256)) {
  const bytes = execFileSync("git", ["show", `${reachability.sourceBinding.commit}:${path}`], { cwd: repoRoot });
  check(sha256(bytes) === expected, `reachability source hash mismatch for ${path}`);
}

const expectedNames = [
  "@solana/buffer-layout-utils",
  "@solana/spl-token",
  "@switchboard-xyz/on-demand",
  "bigint-buffer",
  "brace-expansion",
  "fast-uri",
  "next",
  "postcss",
  "sharp",
  "undici",
];
check(reachability.findings.length === 10, "reachability matrix must contain ten high findings");
check(JSON.stringify(reachability.findings.map(({ name }) => name).sort()) === JSON.stringify(expectedNames), "reachability finding inventory drift");
check(reachability.findings.filter(({ graphClass }) => graphClass === "DIRECT").length === 3, "direct reachability count drift");
check(reachability.findings.filter(({ graphClass }) => graphClass === "TRANSITIVE").length === 7, "transitive reachability count drift");
check(reachability.findings.filter(({ sourceDirectImportFound }) => sourceDirectImportFound).length === 3, "direct source-reference count drift");

for (const finding of reachability.findings) {
  check(finding.dependencyPaths.length > 0, `dependency path missing for ${finding.name}`);
  check(finding.executionBoundary.length > 20, `execution boundary missing for ${finding.name}`);
  check(finding.owner.length > 5, `owner missing for ${finding.name}`);
  check(finding.nextAction.length > 40, `targeted next action missing for ${finding.name}`);
  check(finding.launchDisposition === "HOLD_PENDING_TARGETED_REMEDIATION", `finding must remain HOLD: ${finding.name}`);
  check(finding.vulnerableFunctionReachabilityProven === false, `vulnerable function cannot be claimed proven: ${finding.name}`);
  check(finding.productionBundleAbsenceProven === false, `production absence cannot be claimed proven: ${finding.name}`);
  if (finding.graphClass === "DIRECT") check(finding.sourceEvidence.length > 0, `direct finding needs source evidence: ${finding.name}`);
  if (finding.graphClass === "TRANSITIVE") check(finding.sourceDirectImportFound === false, `transitive finding cannot claim direct import: ${finding.name}`);
}

const byName = Object.fromEntries(reachability.findings.map((finding) => [finding.name, finding]));
check(byName["@solana/spl-token"].sourceEvidence.includes("projects/star-ascent/site/app/mint/ceremony.mjs"), "SPL Token ceremony evidence missing");
check(byName["@switchboard-xyz/on-demand"].sourceEvidence.includes("projects/star-ascent/site/tools/iat-v2-admin-console/FeatureRehearsal.jsx"), "Switchboard rehearsal evidence missing");
check(byName.next.sourceEvidence.includes("projects/star-ascent/site/app/layout.tsx"), "Next layout evidence missing");
check(JSON.stringify(byName["brace-expansion"].installedVersions) === JSON.stringify(["1.1.17", "5.0.8"]), "brace-expansion version inventory drift");
check(byName.postcss.affectedDependencyPaths.some((value) => value.includes("postcss@8.4.31")), "affected nested PostCSS path missing");
check(byName.sharp.affectedDependencyPaths.some((value) => value.includes("sharp@0.34.5")), "affected nested Sharp path missing");
check(byName.undici.dependencyPaths.some((value) => value.includes("miniflare@4.20260722.1")), "Undici Miniflare path missing");
check(reachability.summary.highFindings === 10, "reachability summary total drift");
check(reachability.summary.vulnerableFunctionReachabilityProven === 0, "reachability summary cannot claim vulnerable function proof");
check(reachability.summary.productionBundleAbsenceProven === 0, "reachability summary cannot claim production absence proof");
for (const value of Object.values(reachability.assurance)) check(value === false, "reachability assurance flags must remain false");
check(reachability.limitations.length === 4, "reachability limitation inventory drift");

console.log("IAT V2 dependency triage valid: default-branch and current-lock findings remain separated, all 10 current-lock highs have fail-closed reachability owners, automatic mutation is HOLD, Mainnet UNSCHEDULED_HOLD.");
