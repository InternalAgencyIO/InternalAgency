#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const auditRoot = resolve("public/audits/iat-v2-prelaunch-20260802");
const readJson = (name) => JSON.parse(readFileSync(resolve(auditRoot, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

const manifest = readJson("manifest.json");
const scope = readJson("scope.json");
const register = readJson("findings.json");
const checks = readJson("checks.json");
const matrix = readJson("attack-matrix.json");

check(manifest.schema === "iat-v2-prelaunch-audit-manifest/v1", "unexpected audit manifest schema");
check(manifest.status === "DRAFT_MAINNET_HOLD", "audit status must remain DRAFT_MAINNET_HOLD");
check(manifest.launchDecision === "HOLD", "open pre-launch audit must keep launchDecision HOLD");
check(manifest.mainnetStatus === "HOLD", "audit cannot move mainnet from HOLD");
check(manifest.assurance === "INTERNAL_CODEX_ASSISTED_NOT_INDEPENDENT", "assurance boundary drift");
check(manifest.clearance?.securityBlockersResolved === false, "security blockers cannot be marked resolved");
check(manifest.clearance?.independentAuditComplete === false, "independent audit cannot be claimed complete");
check(manifest.clearance?.authorizesDeployment === false, "audit cannot authorize deployment");
check(manifest.clearance?.authorizesFunding === false, "audit cannot authorize funding");
check(manifest.clearance?.authorizesSigning === false, "audit cannot authorize signing");
check(manifest.clearance?.authorizesBroadcast === false, "audit cannot authorize broadcast");

const identity = manifest.identityModel ?? {};
check(identity.unit === "UNIQUE_WALLET_PLUS_IMMUTABLE_X_ID_PLUS_X_PREMIUM", "identity unit drift");
check(identity.oneHumanPerAccountRequired === false, "audit must not impose one-human-one-account");
check(identity.multipleQualifyingPairsPerPersonAllowed === true, "multi-pair policy drift");
check(identity.xPremiumRequiredForEveryPair === true, "Premium requirement drift");
check(identity.handleIsIdentityKey === false, "X handle cannot become the identity key");

check(scope.schema === "iat-v2-prelaunch-audit-scope/v1", "unexpected scope schema");
check(scope.status === "DRAFT_MAINNET_HOLD", "scope must preserve HOLD");
check(register.schema === "iat-v2-prelaunch-findings/v1", "unexpected finding schema");
check(checks.schema === "iat-v2-prelaunch-checks/v1", "unexpected checks schema");
check(matrix.schema === "iat-v2-prelaunch-attack-matrix/v1", "unexpected attack matrix schema");

const commit = scope.sourceBinding?.commit;
check(/^[0-9a-f]{40}$/u.test(commit ?? ""), "audited commit must be a full SHA-1");
check(manifest.sourceBinding?.commit === commit, "manifest/scope commit mismatch");
check(register.auditedSourceCommit === commit, "finding register commit mismatch");

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 50_000_000 });
const actualTree = git("rev-parse", `${commit}^{tree}`).trim();
check(actualTree === scope.sourceBinding.gitTree, "audited Git tree mismatch");
check(manifest.sourceBinding.gitTree === actualTree, "manifest Git tree mismatch");
const lsTree = git("ls-tree", "-r", "--full-tree", "-l", commit);
check(sha256(lsTree) === scope.sourceBinding.lsTreeSha256, "audited ls-tree digest mismatch");
const entries = lsTree.trim().split(/\r?\n/u);
let trackedBytes = 0;
for (const entry of entries) {
  const match = entry.match(/^\d+ \w+ [0-9a-f]+\s+(\d+)\t/u);
  check(Boolean(match), `unparseable git tree entry: ${entry}`);
  trackedBytes += Number(match[1]);
}
check(entries.length === scope.sourceBinding.trackedFiles, "tracked file count mismatch");
check(trackedBytes === scope.sourceBinding.trackedBytes, "tracked byte count mismatch");

for (const [sourcePath, expected] of Object.entries(scope.criticalSourceSha256 ?? {})) {
  const bytes = execFileSync("git", ["show", `${commit}:${sourcePath}`], { maxBuffer: 50_000_000 });
  check(sha256(bytes) === expected, `critical source digest mismatch: ${sourcePath}`);
}

const severities = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);
const ids = new Set();
const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
for (const finding of register.findings ?? []) {
  check(/^IAT-[A-Z]+-\d{3}$/u.test(finding.id ?? ""), `invalid finding id: ${finding.id}`);
  check(!ids.has(finding.id), `duplicate finding id: ${finding.id}`);
  ids.add(finding.id);
  check(severities.has(finding.severity), `invalid severity: ${finding.id}`);
  check(["OPEN_BLOCKER", "OPEN", "RESOLVED", "ACCEPTED"].includes(finding.status), `invalid status: ${finding.id}`);
  check(Array.isArray(finding.sourceRefs) && finding.sourceRefs.length > 0, `finding lacks source refs: ${finding.id}`);
  check(Array.isArray(finding.remediation) && finding.remediation.length > 0, `finding lacks remediation: ${finding.id}`);
  if (["OPEN_BLOCKER", "OPEN"].includes(finding.status)) counts[finding.severity] += 1;
}
check(JSON.stringify(counts) === JSON.stringify(manifest.findingSummary.openBySeverity), "finding summary mismatch");
check(counts.CRITICAL > 0 && counts.HIGH > 0, "this audit revision must retain its recorded blockers");
check(manifest.findingSummary.total === register.findings.length, "total finding count mismatch");

for (const testCase of matrix.cases ?? []) {
  check(["PASS", "PASS_LIMITED", "PARTIAL", "FAIL"].includes(testCase.result), `invalid attack result: ${testCase.id}`);
  if (testCase.result === "FAIL" || testCase.result === "PARTIAL") {
    check(ids.has(testCase.finding), `attack case lacks valid finding: ${testCase.id}`);
  }
}

const artifactNames = [
  "README.md",
  "FINDINGS.md",
  "SYBIL-AND-GAME-THEORY.md",
  "THREAT-MODEL.md",
  "scope.json",
  "findings.json",
  "attack-matrix.json",
  "checks.json",
];
for (const name of artifactNames) {
  const bytes = readFileSync(resolve(auditRoot, name));
  check(manifest.artifactSha256?.[name] === sha256(bytes), `audit artifact digest mismatch: ${name}`);
  if (name.endsWith(".md")) {
    const upper = bytes.toString("utf8").slice(0, 500).toUpperCase();
    check(upper.includes("DRAFT") && upper.includes("HOLD"), `public document lacks DRAFT/HOLD banner: ${name}`);
  }
}

const credentialKey = /(private.?key|secret|mnemonic|seed.?phrase|access.?token|refresh.?token|passphrase|password)/iu;
const credentialValue = /(^|[^A-Za-z0-9])(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/u;
function scan(value, path = "$") {
  if (Array.isArray(value)) return value.forEach((item, index) => scan(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      check(!credentialKey.test(key), `credential-shaped field in public audit: ${path}.${key}`);
      scan(child, `${path}.${key}`);
    }
  } else if (typeof value === "string") {
    check(!credentialValue.test(value), `credential-shaped value in public audit: ${path}`);
  }
}
for (const object of [manifest, scope, register, checks, matrix]) scan(object);

console.log(`IAT V2 pre-launch audit package validated: ${register.findings.length} findings (${counts.CRITICAL} critical, ${counts.HIGH} high, ${counts.MEDIUM} medium, ${counts.LOW} low), audited tree ${actualTree}, mainnet HOLD.`);
