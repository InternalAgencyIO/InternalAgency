/**
 * Deterministic independent-review receipt template.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This creates no identity, key, signature, approval, or activation record.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUTPUT_PATH = fileURLToPath(
  new URL("./independent-review-receipt-template.v1.json", import.meta.url),
);

export const REVIEW_RECEIPT_HOLD_LABELS = Object.freeze([
  "DRAFT",
  "INACTIVE",
  "NOT PART OF GENESIS",
  "NOT DEPLOYED",
  "NO CLAIM ROUTE",
]);

export function generateIndependentReviewReceiptTemplate() {
  return {
    templateVersion: 1,
    templateId: "iat-promotions-dlc-independent-review-receipt-v1",
    status: {
      labels: REVIEW_RECEIPT_HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
    },
    targetBindingContract: {
      repository: "InternalAgencyIO/InternalAgency",
      pullRequestNumber: "8",
      reviewManifestPath: "proposals/iat-promotions-dlc/review-manifest.v1.json",
      requiredFinalBindings: [
        "gitCommitSha",
        "reviewManifestContentSha256",
        "reviewTreeRootSha256",
        "coveredFileCount",
        "scopeCanonicalSha256",
      ],
      formats: {
        gitCommitSha: "lowercase-hex-40",
        reviewManifestContentSha256: "lowercase-hex-64",
        reviewTreeRootSha256: "lowercase-hex-64",
        coveredFileCount: "canonical-decimal-string",
        scopeCanonicalSha256: "lowercase-hex-64",
      },
      requireCommitTreeAgreement: true,
      requireIndependentManifestVerification: true,
    },
    scopeContract: {
      requiredReviewAreas: [
        "PROTOCOL_AND_ECONOMICS",
        "IDENTITY_AND_DEDUPLICATION",
        "ATOMIC_SETTLEMENT_AND_ROLLBACK",
        "VAULT_AND_AUTHORITY_ISOLATION",
        "VERIFIER_KEY_LIFECYCLE",
        "EVENT_ACCOUNT_RECONCILIATION",
        "CLIENT_ABI_AND_FIXED_BYTES",
        "ADVERSARIAL_TESTS_AND_REPRODUCIBILITY",
      ],
      explicitExclusions: [
        "PRODUCTION_V2_CODE",
        "LIVE_SITES",
        "MAINNET_STATE",
        "DEVNET_STATE",
        "WALLETS_AND_KEYS",
        "DNS_AND_HOSTING",
        "GENESIS_RELEASE_GATES",
      ],
      requireEveryManifestEntry: true,
      requireOpenSecurityDecisionDisposition: true,
      scopeCanonicalization: "RFC8785-compatible canonical JSON object",
    },
    reviewerContract: {
      independenceRequired: true,
      disallowedConcurrentRoles: [
        "PROPOSAL_AUTHOR",
        "CEREMONY_OPERATOR",
        "PROGRAM_DEPLOYER",
        "PROMOTION_VAULT_AUTHORITY",
        "IDENTITY_VERIFIER_OPERATOR",
      ],
      requiredFinalFields: [
        "accountabilityLabel",
        "reviewerIdentityCommitmentSha256",
        "independenceDeclaration",
      ],
      rawPrivateIdentityRequired: false,
      walletAuthorityRequired: false,
    },
    decisionContract: {
      templateDecision: "PENDING",
      allowedFinalDecisions: ["APPROVE_REVIEW_ONLY", "REQUEST_CHANGES", "REJECT"],
      rationaleRequired: true,
      findingsCommitmentRequired: true,
      reviewedAtUtcRequired: true,
      approvalActivationEffect: "NONE",
      separateActivationReviewRequired: true,
    },
    attestationContract: {
      externalSignerOnly: true,
      templateGeneratesKeys: false,
      templateSignsPayload: false,
      algorithm: "Ed25519",
      signingDomain: "iat-promotions-dlc-independent-review-receipt-v1",
      requiredFinalFields: [
        "publicKeyHex",
        "signatureHex",
        "payloadCanonicalSha256",
        "cryptographicallyVerified",
      ],
      verificationRequiredBeforePublication: true,
    },
    receiptTemplate: {
      receiptStatus: "TEMPLATE",
      target: {
        gitCommitSha: null,
        reviewManifestContentSha256: null,
        reviewTreeRootSha256: null,
        coveredFileCount: null,
        scopeCanonicalSha256: null,
      },
      reviewer: {
        accountabilityLabel: null,
        reviewerIdentityCommitmentSha256: null,
        independenceDeclaration: null,
      },
      decision: "PENDING",
      rationale: null,
      findingsCommitmentSha256: null,
      reviewedAtUtc: null,
      attestation: {
        algorithm: null,
        publicKeyHex: null,
        signatureHex: null,
        payloadCanonicalSha256: null,
        cryptographicallyVerified: false,
      },
      activationAuthorized: false,
      activationEffect: "NONE",
    },
  };
}

export function renderIndependentReviewReceiptTemplate() {
  return `${JSON.stringify(generateIndependentReviewReceiptTemplate(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = renderIndependentReviewReceiptTemplate();
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote held independent-review receipt template; no identity, key, or signature was created.");
  } else {
    process.stdout.write(rendered);
  }
}
