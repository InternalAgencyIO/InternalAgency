import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/iat-v2-dependency-triage-20260804");
const readArtifact = (name) => readCanonicalTrackedFile({ repoRoot, absolutePath: resolve(auditRoot, name) });
const report = JSON.parse(readArtifact("report.json").toString("utf8"));
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

console.log("IAT V2 dependency triage valid: default-branch and current-lock findings remain separated, 10 current-lock high findings are public, automatic mutation is HOLD, Mainnet UNSCHEDULED_HOLD.");
