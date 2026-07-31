/**
 * Pure fail-closed acceptance policy for a future independent-review receipt.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Evaluation never activates anything and publishes no accepted receipt.
 */

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { verifyExternalReviewReceiptAttestation } from "./independent-review-receipt-verifier.mjs";

export const REQUIRED_OPEN_SECURITY_DECISIONS = Object.freeze([
  "UPGRADE_AUTHORITY_POLICY",
  "IDENTITY_VERIFIER_KEY_CUSTODY",
  "INDEPENDENT_REVIEWER_THRESHOLD",
  "IDENTITY_COMMITMENT_PEPPER_CUSTODY",
  "X_API_TERMS_AVAILABILITY_RETENTION",
  "RELAYER_AND_RENT_FUNDING",
  "COMMUNITY_REFUND_ACCOUNT",
  "PUBLIC_HANDLE_DISPLAY_CONSENT",
  "LEGAL_AND_REGIONAL_RESTRICTIONS",
]);
export const ALLOWED_DISPOSITIONS = Object.freeze(["RESOLVED", "ACCEPTED_RISK", "DEFERRED_BLOCKING"]);

const CANDIDATE_KEYS = ["target", "scope", "reviewer", "payload", "attestation"];
const TARGET_KEYS = [
  "gitCommitSha",
  "reviewManifestContentSha256",
  "reviewTreeRootSha256",
  "coveredFileCount",
];
const REVIEWER_KEYS = [
  "accountabilityLabel",
  "reviewerIdentityCommitmentSha256",
  "independenceDeclaration",
  "concurrentRoles",
];
const exactKeys = (value, keys) =>
  value && typeof value === "object" && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value)) === JSON.stringify(keys);

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function evaluateIndependentReviewReceiptCandidate(candidate, expectedTarget, receiptTemplate) {
  const gates = {
    exactShape: false,
    targetBinding: false,
    scopeComplete: false,
    reviewerIndependent: false,
    semanticReview: false,
    cryptographicAttestation: false,
  };
  const failures = [];
  const fail = (gate, detail) => {
    if (!failures.some((failure) => failure.gate === gate && failure.detail === detail)) {
      failures.push({ gate, detail });
    }
  };
  if (!exactKeys(candidate, CANDIDATE_KEYS) || !exactKeys(candidate?.target, TARGET_KEYS) || !exactKeys(candidate?.reviewer, REVIEWER_KEYS)) {
    fail("EXACT_SHAPE", "candidate, target, or reviewer field order/shape drift");
  } else {
    gates.exactShape = true;
  }

  const payload = candidate?.payload;
  const target = candidate?.target;
  const expectedTargetMatches = TARGET_KEYS.every((key) => target?.[key] === expectedTarget?.[key]);
  const payloadTargetMatches =
    target?.gitCommitSha === payload?.gitCommitSha &&
    target?.reviewManifestContentSha256 === payload?.reviewManifestContentSha256 &&
    target?.reviewTreeRootSha256 === payload?.reviewTreeRootSha256 &&
    target?.coveredFileCount === payload?.coveredFileCount;
  if (expectedTargetMatches && payloadTargetMatches) gates.targetBinding = true;
  else fail("TARGET_BINDING", "candidate target, expected target, and signed payload must match exactly");

  const scope = candidate?.scope;
  const requiredAreas = receiptTemplate?.scopeContract?.requiredReviewAreas ?? [];
  const requiredExclusions = receiptTemplate?.scopeContract?.explicitExclusions ?? [];
  const dispositions = Array.isArray(scope?.openSecurityDecisionDispositions)
    ? scope.openSecurityDecisionDispositions
    : [];
  const dispositionIds = dispositions.map((entry) => entry.id);
  const dispositionsValid = dispositions.every((entry) =>
    exactKeys(entry, ["id", "disposition", "evidenceCommitmentSha256"]) &&
    REQUIRED_OPEN_SECURITY_DECISIONS.includes(entry.id) &&
    ALLOWED_DISPOSITIONS.includes(entry.disposition) &&
    /^[0-9a-f]{64}$/.test(entry.evidenceCommitmentSha256 ?? ""),
  );
  const scopeComplete =
    exactKeys(scope, ["reviewAreas", "explicitExclusions", "manifestEntryCount", "openSecurityDecisionDispositions"]) &&
    same(scope.reviewAreas, requiredAreas) &&
    same(scope.explicitExclusions, requiredExclusions) &&
    scope.manifestEntryCount === expectedTarget?.coveredFileCount &&
    same(dispositionIds, REQUIRED_OPEN_SECURITY_DECISIONS) &&
    new Set(dispositionIds).size === REQUIRED_OPEN_SECURITY_DECISIONS.length &&
    dispositionsValid &&
    canonicalSha256(scope) === payload?.scopeCanonicalSha256;
  if (scopeComplete) gates.scopeComplete = true;
  else fail("SCOPE_COMPLETE", "review areas, exclusions, manifest count, decisions, and scope digest must be complete");

  const reviewer = candidate?.reviewer;
  const disallowedRoles = receiptTemplate?.reviewerContract?.disallowedConcurrentRoles ?? [];
  const reviewerIndependent =
    reviewer?.accountabilityLabel === payload?.accountabilityLabel &&
    reviewer?.reviewerIdentityCommitmentSha256 === payload?.reviewerIdentityCommitmentSha256 &&
    reviewer?.independenceDeclaration === true &&
    payload?.independenceDeclaration === true &&
    Array.isArray(reviewer?.concurrentRoles) &&
    reviewer.concurrentRoles.every((role) => !disallowedRoles.includes(role));
  if (reviewerIndependent) gates.reviewerIndependent = true;
  else fail("REVIEWER_INDEPENDENCE", "reviewer identity binding, declaration, or concurrent role failed");

  const allowedDecisions = receiptTemplate?.decisionContract?.allowedFinalDecisions ?? [];
  const blockingDisposition = dispositions.some((entry) => entry.disposition === "DEFERRED_BLOCKING");
  const semanticReview =
    allowedDecisions.includes(payload?.decision) &&
    /^[0-9a-f]{64}$/.test(payload?.rationaleCanonicalSha256 ?? "") &&
    /^[0-9a-f]{64}$/.test(payload?.findingsCommitmentSha256 ?? "") &&
    /^(0|[1-9][0-9]*)$/.test(payload?.reviewedAtUnixSeconds ?? "") &&
    payload?.activationAuthorized === false &&
    payload?.activationEffect === "NONE" &&
    !(payload?.decision === "APPROVE_REVIEW_ONLY" && blockingDisposition);
  if (semanticReview) gates.semanticReview = true;
  else fail("SEMANTIC_REVIEW", "decision, evidence commitments, timestamp, blocking findings, or non-activation invariant failed");

  const crypto = verifyExternalReviewReceiptAttestation(payload, candidate?.attestation);
  if (crypto.cryptographicallyVerified === true) gates.cryptographicAttestation = true;
  else fail("CRYPTOGRAPHIC_ATTESTATION", crypto.reason ?? "cryptographic verification failed");

  const accepted = Object.values(gates).every(Boolean);
  return {
    policyVersion: 1,
    evaluationOnly: true,
    accepted,
    gates,
    failures,
    decision: accepted ? payload.decision : "NOT_ACCEPTED",
    receiptIssued: false,
    reviewCompletedByThisEvaluator: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  };
}
