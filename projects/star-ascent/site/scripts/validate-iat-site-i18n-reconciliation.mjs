import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/iat-site-i18n-reconciliation-20260803");
const readJson = (name) => JSON.parse(readFileSync(resolve(auditRoot, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => {
  if (!condition) throw new Error(`IAT site i18n reconciliation validation failed: ${message}`);
};

const manifest = readJson("manifest.json");
const reconciliation = readJson("reconciliation.json");
check(manifest.schema === "iat-site-i18n-reconciliation-manifest/v1", "unexpected manifest schema");
check(reconciliation.schema === "iat-site-i18n-reconciliation/v1", "unexpected reconciliation schema");
check(manifest.status === "DRAFT_TRANSLATION_AND_NATIVE_REVIEW_HOLD", "manifest must remain translation/native-review HOLD");
check(manifest.mainnetStatus === "UNSCHEDULED_HOLD", "mainnet must remain unscheduled HOLD");
check(manifest.assurance === "INTERNAL_CODEX_ASSISTED_NOT_NATIVE_REVIEW", "assurance boundary changed");
check(reconciliation.status === manifest.status, "reconciliation status mismatch");
check(reconciliation.sourceBinding.commit === manifest.sourceBinding.commit, "source commit mismatch");
check(reconciliation.sourceBinding.gitTree === manifest.sourceBinding.gitTree, "source tree mismatch");
check(execFileSync("git", ["rev-parse", `${manifest.sourceBinding.commit}^{tree}`], { cwd: repoRoot, encoding: "utf8" }).trim() === manifest.sourceBinding.gitTree, "source commit tree mismatch");
for (const [path, expected] of Object.entries(manifest.sourceSha256)) {
  check(sha256(execFileSync("git", ["show", `${manifest.sourceBinding.commit}:${path}`], { cwd: repoRoot })) === expected, `source hash mismatch for ${path}`);
}
for (const [name, expected] of Object.entries(manifest.artifactSha256)) {
  check(expected !== "PENDING", `${name} hash remains pending`);
  check(sha256(readFileSync(resolve(auditRoot, name))) === expected, `artifact hash mismatch for ${name}`);
}

const pending = JSON.parse(execFileSync("git", ["show", `${manifest.sourceBinding.commit}:projects/star-ascent/site/app/i18n/pending-visible-source.json`], { cwd: repoRoot, encoding: "utf8" }));
check(pending.capture.routeCount === 25, "canonical route count mismatch");
check(pending.capture.routesWithPendingSource === 15, "affected route count mismatch");
check(pending.capture.pendingSourceCount === 247 && pending.sources.length === 247, "pending source count mismatch");
check(Object.keys(pending.localeWorkflow).length === 50, "locale workflow count mismatch");
check(Object.values(pending.localeWorkflow).filter((status) => status === "TRANSLATION_AND_NATIVE_REVIEW_REQUIRED").length === 49, "non-English HOLD count mismatch");
check(Object.values(pending.runtime).every((value) => value === false), "pending runtime or approval flag became active");

check(reconciliation.priorFinding.uncatalogedVisibleStrings === 247, "prior finding count mismatch");
check(reconciliation.reconciliation.capturedPendingStrings === 247, "captured pending count mismatch");
check(reconciliation.reconciliation.untrackedVisibleStrings === 0, "untracked visible source remains");
check(reconciliation.findingDisposition.inventoryAndWorkflowGap === "REMEDIATED", "inventory remediation missing");
check(reconciliation.findingDisposition.translationGap === "OPEN" && reconciliation.findingDisposition.nativeReviewGap === "OPEN", "language gaps must remain open");
check(reconciliation.findingDisposition.releaseDecision === "HOLD", "localization release must remain HOLD");
for (const [field, value] of Object.entries(reconciliation.runtime)) check(value === false, `runtime ${field} must remain false`);
for (const [field, value] of Object.entries(reconciliation.clearance)) check(value === false, `clearance ${field} must remain false`);
for (const [field, value] of Object.entries(manifest.clearance)) {
  if (field !== "inventoryComplete") check(value === false, `manifest clearance ${field} must remain false`);
}

console.log("IAT site i18n reconciliation valid: 247/247 pending strings tracked across 50 locales; translation/native review/runtime remain HOLD.");
