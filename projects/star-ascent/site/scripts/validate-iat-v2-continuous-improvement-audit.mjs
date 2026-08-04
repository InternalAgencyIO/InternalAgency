import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/iat-v2-continuous-improvement-20260803");
const readCanonical = (path) => readCanonicalTrackedFile({ repoRoot, absolutePath: path });
const readJson = (path) => JSON.parse(readCanonical(path).toString("utf8"));
const readAuditJson = (name) => readJson(resolve(auditRoot, name));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => {
  if (!condition) throw new Error(`IAT V2 continuous-improvement audit validation failed: ${message}`);
};

const manifest = readAuditJson("manifest.json");
const attribution = readAuditJson("attribution.json");
const ledger = readAuditJson("work-ledger.json");
const boundaries = readAuditJson("assurance-boundaries.json");

check(manifest.schema === "iat-v2-continuous-improvement-manifest/v1", "unexpected manifest schema");
check(attribution.schema === "iat-v2-continuous-improvement-attribution/v1", "unexpected attribution schema");
check(ledger.schema === "iat-v2-continuous-improvement-work-ledger/v1", "unexpected work-ledger schema");
check(boundaries.schema === "iat-v2-continuous-improvement-assurance-boundaries/v1", "unexpected assurance-boundaries schema");
check(manifest.status === "DRAFT_MAINNET_HOLD" && manifest.mainnetStatus === "HOLD", "manifest must remain on mainnet HOLD");
check(manifest.assurance === "INTERNAL_CODEX_ASSISTED_NOT_INDEPENDENT", "assurance label must remain explicit");
check(ledger.status === "DRAFT_MAINNET_HOLD" && boundaries.status === "DRAFT_MAINNET_HOLD", "machine-readable package must remain draft HOLD");
check(boundaries.sourceCommit === manifest.sourceBinding.commit, "assurance-boundaries source commit mismatch");

const commitTree = execFileSync("git", ["rev-parse", `${manifest.sourceBinding.commit}^{tree}`], { cwd: repoRoot, encoding: "utf8" }).trim();
check(commitTree === manifest.sourceBinding.gitTree, "source commit tree mismatch");
for (const [relativePath, expected] of Object.entries(manifest.sourceSha256)) {
  const bytes = execFileSync("git", ["show", `${manifest.sourceBinding.commit}:${relativePath}`], { cwd: repoRoot });
  check(sha256(bytes) === expected, `source hash mismatch for ${relativePath}`);
}
for (const [name, expected] of Object.entries(manifest.artifactSha256)) {
  check(expected !== "PENDING", `${name} hash is still pending`);
  check(sha256(readCanonical(resolve(auditRoot, name))) === expected, `artifact hash mismatch for ${name}`);
}

check(ledger.auditPackages.length === 8, "audit package inventory must contain eight manifests");
for (const entry of ledger.auditPackages) {
  const manifestPath = resolve(auditRoot, entry.path);
  const recorded = readJson(manifestPath);
  const sourceCommit = recorded.sourceBinding?.commit ?? recorded.sourceCommit;
  check(recorded.schema === entry.schema, `${entry.path} schema mismatch`);
  check(recorded.status === entry.status, `${entry.path} status mismatch`);
  check(sourceCommit === entry.sourceCommit, `${entry.path} source commit mismatch`);
}

const evidenceIndexPath = resolve(auditRoot, ledger.publicEvidence.indexPath);
const evidenceIndex = readJson(evidenceIndexPath);
check(evidenceIndex.schema === ledger.publicEvidence.schema, "public evidence index schema mismatch");
check(evidenceIndex.network === "devnet" && evidenceIndex.mainnetStatus === "HOLD", "evidence index must remain Devnet/mainnet HOLD");
check(evidenceIndex.records.length === ledger.publicEvidence.recordCount, "public evidence record count mismatch");
const receipt = evidenceIndex.records.find(({ file }) => file === "chain-status-20260801T053947Z.json");
const signoffRecord = evidenceIndex.records.find(({ file }) => file === "v2-feature-independent-signoff-20260801T055736Z.json");
check(receipt?.status === ledger.publicEvidence.historicalFinalizedReceipt && receipt.transactions === 29, "historical 29-of-29 receipt mismatch");
check(signoffRecord?.status.includes("PRIOR_ARTIFACT") && signoffRecord.status.includes("MAINNET_HOLD"), "historical signoff must remain prior-artifact HOLD evidence");
check(evidenceIndex.currentRemediationState.freshSignedDevnetEvidence === "REQUIRED_NOT_COMPLETE", "current remediation signed Devnet requirement changed");
check(evidenceIndex.currentRemediationState.independentReview === "REQUIRED_NOT_COMPLETE", "current remediation independent-review requirement changed");
check(evidenceIndex.currentIdentityHardeningState.actualXOAuthAndD1Integration === "REQUIRED_NOT_COMPLETE", "actual X OAuth/D1 requirement changed");

const historicalSignoff = readJson(resolve(dirname(evidenceIndexPath), "v2-feature-independent-signoff-20260801T055736Z.json"));
check(historicalSignoff.chainReceipt.signatureCount === 29, "historical signoff signature count mismatch");
check(historicalSignoff.checks.chainReceipt29Of29Finalized === true, "historical chain receipt is not finalized");
check(historicalSignoff.checks.mainnetRemainedHold === true, "historical signoff must retain mainnet HOLD");

check(attribution.status === "DRAFT_USER_PROVIDED_ATTRIBUTION_NOT_INDEPENDENTLY_VERIFIED", "attribution status must remain qualified");
check(attribution.projectDirection.provenance === "USER_PROVIDED_IN_CODEX_TASK", "project-direction provenance must remain user-provided");
check(attribution.projectDirection.independentlyVerified === false, "project-direction identity must not be claimed as independently verified");
check(attribution.automatedAssistance.independentlyVerifiedPercentage === null, "AI assistance percentage must remain unknown");
for (const [claim, value] of Object.entries(attribution.claims)) {
  check(value === false, `${claim} must remain false`);
}
check(attribution.humanAccountabilityRequired === true, "human accountability must remain required");

const ui = boundaries.domains.uiAndWebsite;
check(ui.automatedEvidence.playwrightPassed === 43 && ui.automatedEvidence.playwrightIntentionalSkips === 6 && ui.automatedEvidence.playwrightFailed === 0, "latest browser evidence mismatch");
check(ui.automatedEvidence.uncatalogedVisibleSourceStrings === 247 && ui.automatedEvidence.routesWithVisibleSourceDrift === 15, "visible-source localization gap mismatch");
check(ui.decision === "LOCALIZATION_RELEASE_HOLD", "localization release must remain HOLD");
const contracts = boundaries.domains.smartContractsAndLaunchLogic;
check(contracts.automatedEvidence.nodeTestsPassed === 65 && contracts.automatedEvidence.nodeTestsFailed === 0, "contract Node test evidence mismatch");
check(contracts.automatedEvidence.currentSourceReproducibleSbfJobsPassed === 2, "reproducible SBF evidence mismatch");
check(contracts.decision === "MAINNET_HOLD", "contract decision must remain HOLD");
check(boundaries.domains.devnet.currentHardenedSource.signedDevnetRehearsal === "REQUIRED_NOT_COMPLETE", "current source signed Devnet gap missing");
check(boundaries.domains.devnet.decision === "DO_NOT_REUSE_HISTORICAL_EVIDENCE_AS_CURRENT_CLEARANCE", "historical evidence reuse warning missing");
check(boundaries.domains.futureDlc.decision === "NOT_PART_OF_GENESIS", "future DLC boundary missing");

check(boundaries.launch.schedule === "UNSCHEDULED_HOLD" && boundaries.launch.mainnetStatus === "HOLD", "launch must remain unscheduled HOLD");
check(boundaries.launch.fundingFloorSatisfied === false, "funding floor must remain unsatisfied in this source-bound package");
for (const [field, value] of Object.entries(boundaries.launch)) {
  if (field.startsWith("authorizes")) check(value === false, `${field} must remain false`);
}
for (const [field, value] of Object.entries(manifest.clearance)) {
  check(value === false, `manifest clearance ${field} must remain false`);
}

console.log(`IAT V2 continuous-improvement public ledger valid: ${ledger.auditPackages.length} audits, ${evidenceIndex.records.length} evidence records, current-source signed Devnet pending, mainnet HOLD at ${manifest.sourceBinding.commit.slice(0, 12)}.`);
