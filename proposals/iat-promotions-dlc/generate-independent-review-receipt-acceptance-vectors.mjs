/**
 * Deterministic rejection-only receipt-acceptance vectors.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { buildUnsignedReviewPayloadFixture } from "./generate-independent-review-receipt-payload-vectors.mjs";
import {
  evaluateIndependentReviewReceiptCandidate,
  REQUIRED_OPEN_SECURITY_DECISIONS,
} from "./independent-review-receipt-acceptance.mjs";
import { encodeUnsignedReviewReceiptPayload } from "./independent-review-receipt-payload.mjs";

const TEMPLATE_PATH = fileURLToPath(new URL("./independent-review-receipt-template.v1.json", import.meta.url));
const RFC_PATH = fileURLToPath(new URL("./ed25519-public-vectors.v0.json", import.meta.url));
const POLICY_PATH = fileURLToPath(new URL("./independent-review-receipt-acceptance.mjs", import.meta.url));
const OUTPUT_PATH = fileURLToPath(
  new URL("./independent-review-receipt-acceptance-vectors.v1.json", import.meta.url),
);
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const fixtureDigest = (label) => sha256Hex(`iat-promotions-dlc-review-acceptance:${label}`);
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
const clone = (value) => structuredClone(value);

function buildBase(receiptTemplate, rfcVector) {
  const scope = {
    reviewAreas: receiptTemplate.scopeContract.requiredReviewAreas,
    explicitExclusions: receiptTemplate.scopeContract.explicitExclusions,
    manifestEntryCount: "91",
    openSecurityDecisionDispositions: REQUIRED_OPEN_SECURITY_DECISIONS.map((id) => ({
      id,
      disposition: "RESOLVED",
      evidenceCommitmentSha256: fixtureDigest(`decision:${id}`),
    })),
  };
  const payload = {
    ...buildUnsignedReviewPayloadFixture("APPROVE_REVIEW_ONLY"),
    coveredFileCount: scope.manifestEntryCount,
    scopeCanonicalSha256: canonicalSha256(scope),
  };
  const payloadBytes = encodeUnsignedReviewReceiptPayload(payload);
  const target = {
    gitCommitSha: payload.gitCommitSha,
    reviewManifestContentSha256: payload.reviewManifestContentSha256,
    reviewTreeRootSha256: payload.reviewTreeRootSha256,
    coveredFileCount: payload.coveredFileCount,
  };
  return {
    expectedTarget: clone(target),
    candidate: {
      target,
      scope,
      reviewer: {
        accountabilityLabel: payload.accountabilityLabel,
        reviewerIdentityCommitmentSha256: payload.reviewerIdentityCommitmentSha256,
        independenceDeclaration: true,
        concurrentRoles: [],
      },
      payload,
      attestation: {
        algorithm: "Ed25519",
        publicKeyHex: rfcVector.publicKeyHex,
        signatureHex: rfcVector.signatureHex,
        payloadSha256: sha256Hex(payloadBytes),
      },
    },
  };
}

export function generateIndependentReviewAcceptanceVectors() {
  const receiptTemplate = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
  const rfc = JSON.parse(readFileSync(RFC_PATH, "utf8"));
  const base = buildBase(receiptTemplate, rfc.vectors[0]);
  const scenarioBuilders = [
    ["UNRELATED_SIGNATURE_ONLY", () => clone(base)],
    ["TARGET_COMMIT_MISMATCH", () => {
      const scenario = clone(base);
      scenario.expectedTarget.gitCommitSha = "f".repeat(40);
      return scenario;
    }],
    ["SCOPE_AREA_OMITTED", () => {
      const scenario = clone(base);
      scenario.candidate.scope.reviewAreas.pop();
      return scenario;
    }],
    ["REVIEWER_ROLE_CONFLICT", () => {
      const scenario = clone(base);
      scenario.candidate.reviewer.concurrentRoles.push("PROGRAM_DEPLOYER");
      return scenario;
    }],
    ["BLOCKING_FINDING_WITH_APPROVAL", () => {
      const scenario = clone(base);
      scenario.candidate.scope.openSecurityDecisionDispositions[0].disposition = "DEFERRED_BLOCKING";
      scenario.candidate.payload.scopeCanonicalSha256 = canonicalSha256(scenario.candidate.scope);
      scenario.candidate.attestation.payloadSha256 = sha256Hex(encodeUnsignedReviewReceiptPayload(scenario.candidate.payload));
      return scenario;
    }],
    ["ACTIVATION_AUTHORITY_CLAIM", () => {
      const scenario = clone(base);
      scenario.candidate.payload.activationAuthorized = true;
      return scenario;
    }],
  ];
  const scenarios = scenarioBuilders.map(([name, build]) => {
    const scenario = build();
    const result = evaluateIndependentReviewReceiptCandidate(
      scenario.candidate,
      scenario.expectedTarget,
      receiptTemplate,
    );
    return {
      name,
      expectedAccepted: false,
      expectedFailedGates: result.failures.map((failure) => failure.gate),
      candidate: scenario.candidate,
      expectedTarget: scenario.expectedTarget,
      result,
    };
  });
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-independent-review-acceptance-vectors-v1",
    status: {
      labels: ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"],
      network: "NONE",
      programId: null,
      deployable: false,
      acceptancePolicyApplied: false,
      acceptedReceiptPublished: false,
      validReviewSignaturePublished: false,
    },
    sources: {
      receiptTemplate: {
        path: "independent-review-receipt-template.v1.json",
        canonicalSha256: canonicalSha256(receiptTemplate),
      },
      acceptancePolicy: {
        path: "independent-review-receipt-acceptance.mjs",
        normalizedTextSha256: normalizedTextSha256(POLICY_PATH),
      },
    },
    contract: {
      gates: [
        "EXACT_SHAPE",
        "TARGET_BINDING",
        "SCOPE_COMPLETE",
        "REVIEWER_INDEPENDENCE",
        "SEMANTIC_REVIEW",
        "CRYPTOGRAPHIC_ATTESTATION",
      ],
      allGatesRequired: true,
      publicVectorsAreRejectionOnly: true,
      evaluationIssuesNoReceipt: true,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    scenarios,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = `${JSON.stringify(generateIndependentReviewAcceptanceVectors(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote rejection-only receipt-acceptance vectors; no receipt or signature was created.");
  } else {
    process.stdout.write(rendered);
  }
}
