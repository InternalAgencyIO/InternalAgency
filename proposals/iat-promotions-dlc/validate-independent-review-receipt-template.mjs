/**
 * Independent-review receipt-template validator.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  generateIndependentReviewReceiptTemplate,
  REVIEW_RECEIPT_HOLD_LABELS,
} from "./generate-independent-review-receipt-template.mjs";

const TEMPLATE_PATH = fileURLToPath(
  new URL("./independent-review-receipt-template.v1.json", import.meta.url),
);
const REQUIRED_BINDINGS = [
  "gitCommitSha",
  "reviewManifestContentSha256",
  "reviewTreeRootSha256",
  "coveredFileCount",
  "scopeCanonicalSha256",
];
const FINAL_DECISIONS = ["APPROVE_REVIEW_ONLY", "REQUEST_CHANGES", "REJECT"];
const DISALLOWED_ROLES = [
  "PROPOSAL_AUTHOR",
  "CEREMONY_OPERATOR",
  "PROGRAM_DEPLOYER",
  "PROMOTION_VAULT_AUTHORITY",
  "IDENTITY_VERIFIER_OPERATOR",
];

export function loadIndependentReviewReceiptTemplate() {
  return JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
}

export function validateIndependentReviewReceiptTemplate(
  template = loadIndependentReviewReceiptTemplate(),
) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(template?.templateVersion === 1, "review receipt template version drift");
  expect(
    template?.templateId === "iat-promotions-dlc-independent-review-receipt-v1",
    "review receipt template ID drift",
  );
  expect(
    JSON.stringify(template?.status?.labels) === JSON.stringify(REVIEW_RECEIPT_HOLD_LABELS),
    "review receipt HOLD labels drift",
  );
  expect(template?.status?.network === "NONE", "review receipt template must remain network-free");
  expect(template?.status?.programId === null, "review receipt template must not claim a program ID");
  expect(template?.status?.deployable === false, "review receipt template must remain undeployable");
  expect(template?.status?.receiptIssued === false, "review receipt template must not claim issuance");
  expect(template?.status?.reviewCompleted === false, "review receipt template must not claim completed review");
  expect(template?.status?.activationAuthorized === false, "review receipt template must not authorize activation");
  expect(
    template?.targetBindingContract?.repository === "InternalAgencyIO/InternalAgency",
    "review receipt repository binding drift",
  );
  expect(template?.targetBindingContract?.pullRequestNumber === "8", "review receipt PR binding drift");
  expect(
    template?.targetBindingContract?.reviewManifestPath ===
      "proposals/iat-promotions-dlc/review-manifest.v1.json",
    "review receipt manifest path drift",
  );
  expect(
    JSON.stringify(template?.targetBindingContract?.requiredFinalBindings) ===
      JSON.stringify(REQUIRED_BINDINGS),
    "review receipt required target bindings drift",
  );
  expect(
    template?.targetBindingContract?.requireCommitTreeAgreement === true,
    "review receipt no longer requires commit/tree agreement",
  );
  expect(
    template?.targetBindingContract?.requireIndependentManifestVerification === true,
    "review receipt no longer requires independent manifest verification",
  );
  expect(
    template?.scopeContract?.requireEveryManifestEntry === true,
    "review receipt scope no longer covers every manifest entry",
  );
  expect(
    template?.scopeContract?.requireOpenSecurityDecisionDisposition === true,
    "review receipt scope omits open security decisions",
  );
  expect(template?.reviewerContract?.independenceRequired === true, "reviewer independence is not required");
  expect(
    JSON.stringify(template?.reviewerContract?.disallowedConcurrentRoles) ===
      JSON.stringify(DISALLOWED_ROLES),
    "reviewer disallowed-role contract drift",
  );
  expect(template?.reviewerContract?.walletAuthorityRequired === false, "review receipt requires wallet authority");
  expect(
    JSON.stringify(template?.decisionContract?.allowedFinalDecisions) === JSON.stringify(FINAL_DECISIONS),
    "review receipt final decision set drift",
  );
  expect(template?.decisionContract?.templateDecision === "PENDING", "review receipt template decision drift");
  expect(template?.decisionContract?.rationaleRequired === true, "review receipt rationale no longer required");
  expect(
    template?.decisionContract?.findingsCommitmentRequired === true,
    "review receipt findings commitment no longer required",
  );
  expect(template?.decisionContract?.approvalActivationEffect === "NONE", "review approval gains activation effect");
  expect(
    template?.decisionContract?.separateActivationReviewRequired === true,
    "review receipt bypasses separate activation review",
  );
  expect(template?.attestationContract?.externalSignerOnly === true, "review receipt permits internal signing");
  expect(template?.attestationContract?.templateGeneratesKeys === false, "review template permits key generation");
  expect(template?.attestationContract?.templateSignsPayload === false, "review template permits payload signing");
  expect(
    template?.attestationContract?.verificationRequiredBeforePublication === true,
    "review receipt permits unverified publication",
  );

  const receipt = template?.receiptTemplate;
  expect(receipt?.receiptStatus === "TEMPLATE", "review template claims a final receipt status");
  expect(receipt?.decision === "PENDING", "review template claims a final decision");
  for (const binding of REQUIRED_BINDINGS) {
    expect(receipt?.target?.[binding] === null, `review template pre-fills target binding: ${binding}`);
  }
  for (const field of ["accountabilityLabel", "reviewerIdentityCommitmentSha256", "independenceDeclaration"]) {
    expect(receipt?.reviewer?.[field] === null, `review template pre-fills reviewer field: ${field}`);
  }
  for (const field of ["algorithm", "publicKeyHex", "signatureHex", "payloadCanonicalSha256"]) {
    expect(receipt?.attestation?.[field] === null, `review template contains attestation material: ${field}`);
  }
  expect(receipt?.attestation?.cryptographicallyVerified === false, "review template claims cryptographic verification");
  expect(receipt?.activationAuthorized === false, "review template authorizes activation");
  expect(receipt?.activationEffect === "NONE", "review template has an activation effect");
  expect(receipt?.rationale === null, "review template contains rationale before review");
  expect(receipt?.findingsCommitmentSha256 === null, "review template contains a findings commitment before review");
  expect(receipt?.reviewedAtUtc === null, "review template contains a review timestamp before review");
  expect(
    JSON.stringify(template) === JSON.stringify(generateIndependentReviewReceiptTemplate()),
    "review receipt template differs from deterministic generation",
  );
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateIndependentReviewReceiptTemplate();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Independent-review receipt template reproduces and makes no review or activation claim.");
  }
}
