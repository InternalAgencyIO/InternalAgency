import { createHash } from "node:crypto";

import { validateIndependentSecurityEvidence } from "./iat-v2-independent-security-evidence.mjs";
import { validateProductionIdentityIntegrationEvidence } from "./iat-v2-production-identity-integration-evidence.mjs";

export const PRODUCTION_IDENTITY_CLEARANCE_EVIDENCE_PATH =
  "target/identity-integration/iat-v2-production-identity-integration-evidence.json";
export const PRODUCTION_IDENTITY_CLEARANCE_TRUST_PATH =
  "docs/b3/iat-v2-production-identity-integration-trust.v1.json";
export const INDEPENDENT_SECURITY_CLEARANCE_PATHS = Object.freeze({
  evidence: "target/security/iat-v2-independent-security-evidence-v2.json",
  githubRun: "target/security/github-run-receipt.json",
  githubJobs: "target/security/github-jobs-receipt.json",
  githubArtifact: "target/security/github-artifact-receipt.json",
  artifactArchive: "target/security/iat-v2-independent-security-evidence-v2.zip",
});

export const CURRENT_SOURCE_PREDICATE_CHECK_IDS = Object.freeze({
  productionIdentityIntegration: "PRODUCTION_IDENTITY_STRUCTURE_CHECKED_HOLD",
  automatedSecurityClosure: "INDEPENDENT_SECURITY_STRUCTURE_CHECKED_HOLD",
});

export const CURRENT_SOURCE_PREDICATE_HOLD_STATUS = "LIVE_AUTH_REQUIRED_HOLD";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function exactDigestReceipt(checkReceipts, checkId, expectedDigest) {
  const matches = Array.isArray(checkReceipts)
    ? checkReceipts.filter((item) => item?.checkId === checkId)
    : [];
  return matches.length === 1 && matches[0].detailsSha256 === expectedDigest;
}

export function validateProductionIdentityClearancePredicate({
  directEvidence,
  checkReceipts,
  predicateBytes,
  trust,
  binding,
  evaluationUnixSeconds,
} = {}) {
  const result = validateProductionIdentityIntegrationEvidence({
    evidenceBytes: predicateBytes,
    trust,
    expectedSourceCommit: binding?.commit,
    expectedSourceTree: binding?.tree,
    expectedProgramArtifactSha256: binding?.programArtifactSha256,
    evaluationUnixSeconds,
  });
  const violations = [];
  if (!result.valid) {
    violations.push(`predicate-specific production-identity validation failed: ${result.violations.join("; ")}`);
  }
  if (result.predicate !== "PRODUCTION_IDENTITY_INTEGRATION_REHEARSAL"
    || result.sourceBound !== true || result.mainnetStatus !== "HOLD") {
    violations.push("predicate-specific production-identity result is not exact source-bound HOLD evidence");
  }
  if (directEvidence?.observedAtUtc !== result.observedAtUtc) {
    violations.push("observation time must match the predicate-specific evidence");
  }
  if (!result.receiptUrls.every((url) => directEvidence?.receipts?.includes(url))) {
    violations.push("both predicate-specific observer receipts must be cited");
  }
  if (!exactDigestReceipt(
    checkReceipts ?? [],
    CURRENT_SOURCE_PREDICATE_CHECK_IDS.productionIdentityIntegration,
    predicateBytes instanceof Uint8Array ? sha256(predicateBytes) : null,
  )) {
    violations.push("the exact predicate-specific evidence digest must be bound once");
  }
  return Object.freeze({
    status: CURRENT_SOURCE_PREDICATE_HOLD_STATUS,
    valid: false,
    structurallyValid: violations.length === 0,
    authenticated: false,
    clearanceValid: false,
    predicate: result.predicate ?? "PRODUCTION_IDENTITY_INTEGRATION_REHEARSAL",
    mainnetStatus: "HOLD",
    blocker: "EXTERNALLY_AUTHENTICATED_EVALUATION_TIME_REQUIRED",
    violations: Object.freeze(violations),
  });
}

export function validateIndependentSecurityClearancePredicate({
  directEvidence,
  checkReceipts,
  predicateBytes,
  githubRunBytes,
  githubJobsBytes,
  githubArtifactBytes,
  artifactArchiveBytes,
  sourceFiles,
  binding,
  evaluationUnixSeconds,
} = {}) {
  const result = validateIndependentSecurityEvidence({
    evidenceBytes: predicateBytes,
    githubRunBytes,
    githubJobsBytes,
    githubArtifactBytes,
    artifactArchiveBytes,
    sourceFiles,
    expectedSourceCommit: binding?.commit,
    expectedSourceTree: binding?.tree,
    expectedProgramArtifactSha256: binding?.programArtifactSha256,
    evaluationUnixSeconds,
  });
  const violations = [];
  if (!result.structurallyValid) {
    violations.push(`predicate-specific independent-security validation failed: ${result.violations.join("; ")}`);
  }
  if (result.predicate !== "AUTOMATED_SECURITY_CLOSURE"
    || result.sourceBound !== true || result.mainnetStatus !== "HOLD") {
    violations.push("predicate-specific independent-security result is not exact source-bound HOLD evidence");
  }
  if (!directEvidence?.receipts?.includes(result.runUrl)
    || !directEvidence?.receipts?.includes(result.jobUrl)) {
    violations.push("the exact claimed CI run and job URLs must be cited");
  }
  let observedAtUtc = null;
  try {
    observedAtUtc = JSON.parse(Buffer.from(predicateBytes).toString("utf8")).observedAtUtc ?? null;
  } catch {
    // The predicate-specific validator already records malformed evidence bytes.
  }
  if (directEvidence?.observedAtUtc !== observedAtUtc) {
    violations.push("observation time must match the predicate-specific evidence");
  }
  if (!exactDigestReceipt(
    checkReceipts ?? [],
    CURRENT_SOURCE_PREDICATE_CHECK_IDS.automatedSecurityClosure,
    result.evidenceSha256,
  )) {
    violations.push("the exact predicate-specific evidence digest must be bound once");
  }
  return Object.freeze({
    status: CURRENT_SOURCE_PREDICATE_HOLD_STATUS,
    valid: false,
    structurallyValid: violations.length === 0,
    authenticated: false,
    clearanceValid: false,
    predicate: result.predicate ?? "AUTOMATED_SECURITY_CLOSURE",
    mainnetStatus: "HOLD",
    blocker: "LIVE_GITHUB_RUN_JOB_ARTIFACT_ARCHIVE_AUTHENTICATION_REQUIRED",
    violations: Object.freeze(violations),
  });
}
