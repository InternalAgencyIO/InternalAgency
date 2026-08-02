#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("public/audits/iat-v2-remediation-20260802");
const read = (name) => readFileSync(resolve(root, name));
const json = (name) => JSON.parse(read(name).toString("utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => Buffer.from(value.toString("utf8").replace(/\r\n?/gu, "\n"), "utf8");
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const manifest = json("manifest.json");
const scope = json("scope.json");
const findings = json("findings.json");
const matrix = json("attack-matrix.json");
const checks = json("checks.json");

check(manifest.schema === "iat-v2-remediation-audit-manifest/v1", "unexpected remediation manifest schema");
check(manifest.status === "DRAFT_MAINNET_HOLD", "remediation audit must remain DRAFT/HOLD");
check(manifest.launchDecision === "HOLD" && manifest.mainnetStatus === "HOLD", "remediation audit cannot clear Mainnet");
check(manifest.assurance === "INTERNAL_CODEX_ASSISTED_NOT_INDEPENDENT", "assurance boundary drift");
for (const field of ["securityBlockersResolved", "independentAuditComplete", "freshSignedDevnetComplete", "authorizesDeployment", "authorizesFunding", "authorizesSigning", "authorizesBroadcast"]) {
  check(manifest.clearance?.[field] === false, `remediation audit unexpectedly sets ${field}`);
}

check(scope.schema === "iat-v2-remediation-scope/v1" && scope.status === "DRAFT_MAINNET_HOLD", "unexpected remediation scope");
check(findings.schema === "iat-v2-remediation-findings/v1" && findings.status === "DRAFT_MAINNET_HOLD", "unexpected remediation findings");
check(matrix.schema === "iat-v2-remediation-attack-matrix/v1" && matrix.status === "DRAFT_MAINNET_HOLD", "unexpected remediation matrix");
check(checks.schema === "iat-v2-remediation-checks/v1" && checks.status === "DRAFT_MAINNET_HOLD", "unexpected remediation checks");

const commit = scope.sourceCommit;
check(/^[0-9a-f]{40}$/u.test(commit ?? ""), "remediation source commit must be a full SHA-1");
check(manifest.sourceBinding?.commit === commit && findings.auditedSourceCommit === commit, "remediation source binding mismatch");
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 50_000_000 }).trim();
check(git("rev-parse", `${commit}^{tree}`) === scope.sourceTree, "remediation source tree mismatch");
check(manifest.sourceBinding?.gitTree === scope.sourceTree, "manifest remediation tree mismatch");
check(git("rev-parse", `${commit}:projects/star-ascent/site/programs/iat_v2`) === scope.programTree, "remediation program tree mismatch");

for (const [path, expected] of Object.entries(scope.criticalSourceCanonicalUtf8LfSha256 ?? {})) {
  const committed = execFileSync("git", ["show", `${commit}:${path}`], { maxBuffer: 50_000_000 });
  check(sha256(canonical(committed)) === expected, `committed remediation source digest mismatch: ${path}`);
  check(sha256(canonical(readFileSync(resolve(path.replace(/^projects\/star-ascent\/site\//u, ""))))) === expected, `current remediation source drift: ${path}`);
}

check(scope.verifiableSbf?.sha256 === "d01d56161396ce7de28c1ff8c7386bf2fdf1014f6f62935c29106054b0e93e22", "SBF digest drift");
check(scope.verifiableSbf?.bytes === 606320 && scope.verifiableSbf?.deploymentAuthorized === false, "SBF evidence boundary drift");
check(scope.historicalDevnetEvidence?.coversThisSourceCommit === false, "old Devnet evidence cannot cover remediation source");
check(scope.historicalDevnetEvidence?.freshSignedRehearsalRequired === true, "fresh signed Devnet requirement removed");

const allowedStatuses = new Set(["OPEN_BLOCKER", "REMEDIATED_PENDING_REHEARSAL_AND_INDEPENDENT_REVIEW"]);
const ids = new Set();
const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
let pendingReview = 0;
for (const finding of findings.findings ?? []) {
  check(/^IAT-REM-\d{3}$/u.test(finding.id ?? ""), `invalid remediation finding id: ${finding.id}`);
  check(!ids.has(finding.id), `duplicate remediation finding id: ${finding.id}`);
  ids.add(finding.id);
  check(Object.hasOwn(counts, finding.severity), `invalid remediation severity: ${finding.id}`);
  check(allowedStatuses.has(finding.status), `invalid remediation status: ${finding.id}`);
  if (finding.status === "OPEN_BLOCKER") counts[finding.severity] += 1;
  else pendingReview += 1;
}
check(findings.findings.length === manifest.findingSummary?.total, "remediation finding total mismatch");
check(JSON.stringify(counts) === JSON.stringify(manifest.findingSummary?.openBySeverity), "remediation open finding summary mismatch");
check(pendingReview === manifest.findingSummary?.remediatedPendingReview, "remediation pending-review count mismatch");
check(counts.CRITICAL > 0 && counts.HIGH > 0, "remediation audit must retain critical and high blockers");
check(matrix.cases.some((entry) => entry.id === "REM-07" && entry.result === "FAIL" && entry.finding === "IAT-REM-002"), "selective-withholding attack must remain failed");
check(matrix.cases.some((entry) => entry.id === "REM-09" && entry.result === "NOT_YET_TESTED"), "local-validator gap must remain explicit");
check(checks.results.some((entry) => entry.id === "VERIFIABLE_SBF" && entry.result === "PASS"), "SBF check missing");
check(checks.results.some((entry) => entry.id === "FRESH_SIGNED_DEVNET" && entry.result === "NOT_RUN_BLOCKER"), "fresh Devnet blocker missing");

for (const name of ["README.md", "GAME-THEORY.md", "scope.json", "findings.json", "attack-matrix.json", "checks.json"]) {
  const value = read(name);
  check(manifest.artifactSha256?.[name] === sha256(value), `remediation artifact digest mismatch: ${name}`);
  if (name.endsWith(".md")) {
    const label = value.toString("utf8").slice(0, 500).toUpperCase();
    check(label.includes("DRAFT") && label.includes("HOLD"), `remediation document lacks DRAFT/HOLD banner: ${name}`);
  }
}

const publicObjects = [manifest, scope, findings, matrix, checks];
const credentialValue = /(^|[^A-Za-z0-9])(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/u;
const scan = (value) => {
  if (Array.isArray(value)) return value.forEach(scan);
  if (value && typeof value === "object") return Object.values(value).forEach(scan);
  if (typeof value === "string") check(!credentialValue.test(value), "credential-shaped value in remediation audit");
};
publicObjects.forEach(scan);

console.log(`IAT V2 remediation audit validated at ${commit}: permanent-lock candidate fixed, ${counts.CRITICAL} critical and ${counts.HIGH} high blockers remain, Mainnet HOLD.`);
