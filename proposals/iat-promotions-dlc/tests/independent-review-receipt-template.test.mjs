/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import { generateIndependentReviewReceiptTemplate } from "../generate-independent-review-receipt-template.mjs";
import {
  loadIndependentReviewReceiptTemplate,
  validateIndependentReviewReceiptTemplate,
} from "../validate-independent-review-receipt-template.mjs";

const template = loadIndependentReviewReceiptTemplate();
const clone = (value) => structuredClone(value);

test("independent-review receipt template deterministically reproduces under every HOLD gate", () => {
  assert.deepEqual(validateIndependentReviewReceiptTemplate(template), []);
  assert.deepEqual(generateIndependentReviewReceiptTemplate(), template);
  assert.deepEqual(template.status.labels, [
    "DRAFT",
    "INACTIVE",
    "NOT PART OF GENESIS",
    "NOT DEPLOYED",
    "NO CLAIM ROUTE",
  ]);
});

test("template binds a future receipt to commit, manifest, tree, file count, and scope", () => {
  assert.deepEqual(template.targetBindingContract.requiredFinalBindings, [
    "gitCommitSha",
    "reviewManifestContentSha256",
    "reviewTreeRootSha256",
    "coveredFileCount",
    "scopeCanonicalSha256",
  ]);
  assert.equal(template.targetBindingContract.requireCommitTreeAgreement, true);
  assert.equal(template.targetBindingContract.requireIndependentManifestVerification, true);
  for (const field of template.targetBindingContract.requiredFinalBindings) {
    assert.equal(template.receiptTemplate.target[field], null);
  }
});

test("template covers the full manifest and every fixed review area while excluding production", () => {
  assert.equal(template.scopeContract.requireEveryManifestEntry, true);
  assert.equal(template.scopeContract.requireOpenSecurityDecisionDisposition, true);
  assert.equal(template.scopeContract.requiredReviewAreas.length, 8);
  assert.ok(template.scopeContract.explicitExclusions.includes("PRODUCTION_V2_CODE"));
  assert.ok(template.scopeContract.explicitExclusions.includes("MAINNET_STATE"));
  assert.ok(template.scopeContract.explicitExclusions.includes("WALLETS_AND_KEYS"));
});

test("reviewer must be independent and needs no wallet authority or raw private identity", () => {
  assert.equal(template.reviewerContract.independenceRequired, true);
  assert.ok(template.reviewerContract.disallowedConcurrentRoles.includes("PROPOSAL_AUTHOR"));
  assert.ok(template.reviewerContract.disallowedConcurrentRoles.includes("PROGRAM_DEPLOYER"));
  assert.equal(template.reviewerContract.walletAuthorityRequired, false);
  assert.equal(template.reviewerContract.rawPrivateIdentityRequired, false);
});

test("even review approval has no activation effect and cannot bypass separate review", () => {
  assert.deepEqual(template.decisionContract.allowedFinalDecisions, [
    "APPROVE_REVIEW_ONLY",
    "REQUEST_CHANGES",
    "REJECT",
  ]);
  assert.equal(template.decisionContract.approvalActivationEffect, "NONE");
  assert.equal(template.decisionContract.separateActivationReviewRequired, true);
  assert.equal(template.receiptTemplate.activationAuthorized, false);
  assert.equal(template.receiptTemplate.activationEffect, "NONE");
});

test("template never generates keys, signs, or pre-fills attestation material", () => {
  assert.equal(template.attestationContract.externalSignerOnly, true);
  assert.equal(template.attestationContract.templateGeneratesKeys, false);
  assert.equal(template.attestationContract.templateSignsPayload, false);
  assert.equal(template.attestationContract.verificationRequiredBeforePublication, true);
  assert.deepEqual(template.receiptTemplate.attestation, {
    algorithm: null,
    publicKeyHex: null,
    signatureHex: null,
    payloadCanonicalSha256: null,
    cryptographicallyVerified: false,
  });
});

test("deployment, binding, independence, decision, signature, and activation drift all fail", () => {
  const weakened = clone(template);
  weakened.status.network = "mainnet-beta";
  weakened.status.deployable = true;
  weakened.status.receiptIssued = true;
  weakened.targetBindingContract.requiredFinalBindings.pop();
  weakened.targetBindingContract.requireCommitTreeAgreement = false;
  weakened.scopeContract.requireEveryManifestEntry = false;
  weakened.reviewerContract.independenceRequired = false;
  weakened.decisionContract.allowedFinalDecisions.push("ACTIVATE");
  weakened.decisionContract.approvalActivationEffect = "DEPLOY";
  weakened.attestationContract.templateGeneratesKeys = true;
  weakened.attestationContract.templateSignsPayload = true;
  weakened.receiptTemplate.decision = "APPROVE_REVIEW_ONLY";
  weakened.receiptTemplate.attestation.signatureHex = "00";
  weakened.receiptTemplate.activationAuthorized = true;
  const errors = validateIndependentReviewReceiptTemplate(weakened);
  for (const fragment of [
    "network-free",
    "undeployable",
    "claim issuance",
    "required target bindings",
    "commit/tree agreement",
    "every manifest entry",
    "independence",
    "final decision set",
    "activation effect",
    "key generation",
    "payload signing",
    "final decision",
    "attestation material",
    "authorizes activation",
  ]) {
    assert.ok(errors.some((error) => error.includes(fragment)), fragment);
  }
});

test("template contains no reviewer, target, findings, timestamp, key, or signature value", () => {
  assert.equal(Object.values(template.receiptTemplate.target).every((value) => value === null), true);
  assert.equal(Object.values(template.receiptTemplate.reviewer).every((value) => value === null), true);
  assert.equal(template.receiptTemplate.rationale, null);
  assert.equal(template.receiptTemplate.findingsCommitmentSha256, null);
  assert.equal(template.receiptTemplate.reviewedAtUtc, null);
  assert.equal(template.status.reviewCompleted, false);
});
