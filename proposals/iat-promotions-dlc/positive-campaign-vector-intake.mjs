/**
 * Pure verify-only intake evaluator for an externally supplied positive
 * campaign-envelope vector.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { verifyCampaignEnvelopeWithPublicKey } from "./campaign-envelope-verifier.mjs";
import { validateJsonSchemaSubset } from "./json-schema-subset.mjs";

const SCHEMA_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake.schema.v1.json", import.meta.url),
);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const TARGET_KEYS = [
  "targetVersion",
  "campaignId",
  "keyId",
  "publicKeyHex",
  "sourceArtifactSha256",
  "reviewReceiptSha256",
  "positiveVectorAvailable",
  "positiveVectorReviewCompleted",
];
const HEX_32 = /^[0-9a-f]{64}$/;

export function loadPositiveCampaignVectorIntakeSchema() {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
}

function exactTargetShape(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) return false;
  return JSON.stringify(Object.keys(target)) === JSON.stringify(TARGET_KEYS) &&
    target.targetVersion === 1 &&
    typeof target.campaignId === "string" && target.campaignId.length > 0 &&
    typeof target.keyId === "string" && target.keyId.length > 0 &&
    HEX_32.test(target.publicKeyHex ?? "") &&
    HEX_32.test(target.sourceArtifactSha256 ?? "") &&
    HEX_32.test(target.reviewReceiptSha256 ?? "") &&
    typeof target.positiveVectorAvailable === "boolean" &&
    typeof target.positiveVectorReviewCompleted === "boolean";
}

function containsForbiddenPrivateField(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, nested] of Object.entries(value)) {
    if (/(private|secret|seed|mnemonic|oauth|accessToken)/i.test(key)) return true;
    if (containsForbiddenPrivateField(nested)) return true;
  }
  return false;
}

function signatureHexFromBase64(value) {
  if (typeof value !== "string") return null;
  try {
    const bytes = Buffer.from(value, "base64");
    if (bytes.length !== 64 || bytes.toString("base64") !== value) return null;
    return bytes.toString("hex");
  } catch {
    return null;
  }
}

const gate = (id, passed, detail) => ({ id, result: passed ? "PASS" : "FAIL", detail });

export function evaluatePositiveCampaignVectorIntake(
  candidate,
  expectedTarget,
  { now, schema = loadPositiveCampaignVectorIntakeSchema() },
) {
  const schemaErrors = validateJsonSchemaSubset(schema, candidate);
  const structuralValid = schemaErrors.length === 0;
  const targetValid = exactTargetShape(expectedTarget);
  const privacyValid = !containsForbiddenPrivateField(candidate);
  let verification = {
    campaignEnvelopeVerified: false,
    canonicalMessageHex: null,
    canonicalMessageSha256: null,
    reason: "NOT_EVALUATED",
  };
  if (structuralValid && targetValid) {
    verification = verifyCampaignEnvelopeWithPublicKey(candidate.campaignVector.envelope, {
      now,
      expectedCampaignId: expectedTarget.campaignId,
      expectedKeyId: expectedTarget.keyId,
      publicKeyHex: expectedTarget.publicKeyHex,
    });
  }
  const provenanceValid = structuralValid && targetValid && privacyValid &&
    candidate.provenance.independenceDeclaration === true &&
    candidate.provenance.campaignMessageWasSignedBySource === true &&
    candidate.provenance.signingMaterialIncluded === false &&
    candidate.provenance.sourceArtifactSha256 === expectedTarget.sourceArtifactSha256;
  const messageBindingValid = structuralValid && targetValid &&
    verification.canonicalMessageHex !== null &&
    candidate.campaignVector.envelope.payload.campaignId === expectedTarget.campaignId &&
    candidate.campaignVector.envelope.keyId === expectedTarget.keyId &&
    candidate.campaignVector.publicKeyHex === expectedTarget.publicKeyHex &&
    candidate.campaignVector.signatureHex === signatureHexFromBase64(
      candidate.campaignVector.envelope.signatureBase64,
    ) &&
    candidate.campaignVector.claimedCanonicalMessageHex === verification.canonicalMessageHex &&
    candidate.campaignVector.claimedCanonicalMessageSha256 === verification.canonicalMessageSha256;
  const cryptographicValid = structuralValid && targetValid &&
    verification.campaignEnvelopeVerified === true;
  const reviewValid = structuralValid && targetValid &&
    expectedTarget.positiveVectorAvailable === true &&
    expectedTarget.positiveVectorReviewCompleted === true &&
    candidate.review.completed === true &&
    candidate.review.decision === "APPROVE_VECTOR_ONLY" &&
    HEX_32.test(candidate.review.reviewerIdentityCommitmentSha256 ?? "") &&
    candidate.review.receiptSha256 === expectedTarget.reviewReceiptSha256;
  const nonAuthorityValid = structuralValid &&
    candidate.authority.receiptIssued === false &&
    candidate.authority.reviewCompletedByIntake === false &&
    candidate.authority.activationAuthorized === false &&
    candidate.authority.activationEffect === "NONE";
  const gates = [
    gate("CLOSED_SCHEMA", structuralValid, structuralValid ? "STRUCTURE_VALID" : "STRUCTURE_REJECTED"),
    gate("EXPECTED_TARGET", targetValid, targetValid ? "TARGET_SHAPE_VALID" : "TARGET_REJECTED"),
    gate("PRIVATE_MATERIAL_EXCLUSION", privacyValid, privacyValid ? "NO_PRIVATE_FIELDS" : "PRIVATE_FIELD_REJECTED"),
    gate("EXTERNAL_PROVENANCE", provenanceValid, provenanceValid ? "PROVENANCE_BOUND" : "PROVENANCE_NOT_ESTABLISHED"),
    gate("CANONICAL_MESSAGE_BINDING", messageBindingValid, messageBindingValid ? "MESSAGE_BOUND" : "MESSAGE_BINDING_FAILED"),
    gate("CRYPTOGRAPHIC_SIGNATURE", cryptographicValid, verification.reason),
    gate("INDEPENDENT_VECTOR_REVIEW", reviewValid, reviewValid ? "VECTOR_REVIEW_BOUND" : "POSITIVE_VECTOR_OR_REVIEW_ABSENT"),
    gate("NON_AUTHORITY", nonAuthorityValid, nonAuthorityValid ? "NO_AUTHORITY_EFFECT" : "AUTHORITY_CLAIM_REJECTED"),
  ];
  const candidateSatisfiesIntakePolicy = gates.every((entry) => entry.result === "PASS");
  return {
    intakeEvaluationVersion: 1,
    intakeEvaluationId: "iat-promotions-dlc-positive-campaign-vector-intake-evaluation-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      intakeApplied: false,
    },
    structuralValid,
    schemaErrors,
    candidateSatisfiesIntakePolicy,
    positiveVectorAcceptedForSeparateReview: candidateSatisfiesIntakePolicy,
    verificationReason: verification.reason,
    gates,
    receiptIssued: false,
    reviewCompletedByThisEvaluator: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  };
}
