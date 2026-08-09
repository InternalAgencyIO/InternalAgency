/**
 * Deterministic rejection-only external positive-vector intake corpus.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This generator copies public RFC material already present in the proposal.
 * It never creates a key, signature, review receipt, or activation claim.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { verifyCampaignEnvelopeWithPublicKey } from "./campaign-envelope-verifier.mjs";
import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { applyJsonPointerMutation } from "./json-schema-subset.mjs";
import {
  evaluatePositiveCampaignVectorIntake,
} from "./positive-campaign-vector-intake.mjs";

const CAMPAIGN_VECTORS_PATH = fileURLToPath(
  new URL("./campaign-envelope-verification-vectors.v1.json", import.meta.url),
);
const SCHEMA_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake.schema.v1.json", import.meta.url),
);
const EVALUATOR_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake.mjs", import.meta.url),
);
const OUTPUT_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-vectors.v1.json", import.meta.url),
);
const NOW = 1_800_100_001;
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const GATE_ORDER = [
  "CLOSED_SCHEMA",
  "EXPECTED_TARGET",
  "PRIVATE_MATERIAL_EXCLUSION",
  "EXTERNAL_PROVENANCE",
  "CANONICAL_MESSAGE_BINDING",
  "CRYPTOGRAPHIC_SIGNATURE",
  "INDEPENDENT_VECTOR_REVIEW",
  "NON_AUTHORITY",
];
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(
  readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
);

function baseline(campaignVectors) {
  const source = campaignVectors.exactEnvelopeNegativeCases[0];
  const verification = verifyCampaignEnvelopeWithPublicKey(source.envelope, {
    now: NOW,
    expectedCampaignId: source.expectedCampaignId,
    expectedKeyId: source.expectedKeyId,
    publicKeyHex: source.publicKeyHex,
  });
  if (verification.canonicalMessageHex === null) {
    throw new Error("BASELINE_CANONICAL_MESSAGE_UNAVAILABLE");
  }
  const sourceArtifactSha256 = campaignVectors.sources.rfc8032Vectors.canonicalSha256;
  const candidate = {
    intakeVersion: 1,
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      intakeApplied: false,
    },
    provenance: {
      sourceType: "EXTERNAL_PUBLIC_TEST_VECTOR",
      sourceUri: campaignVectors.sources.rfc8032Vectors.source,
      sourceArtifactSha256,
      generatorName: "IETF RFC 8032 section 7.1 public test vector",
      generatorVersion: "RFC8032",
      accountabilityLabel: "IETF RFC 8032",
      independenceDeclaration: true,
      campaignMessageWasSignedBySource: false,
      signingMaterialIncluded: false,
    },
    campaignVector: {
      envelope: structuredClone(source.envelope),
      publicKeyHex: source.publicKeyHex,
      signatureHex: Buffer.from(source.envelope.signatureBase64, "base64").toString("hex"),
      claimedCanonicalMessageHex: verification.canonicalMessageHex,
      claimedCanonicalMessageSha256: verification.canonicalMessageSha256,
    },
    review: {
      completed: false,
      decision: "NOT_REVIEWED",
      reviewerIdentityCommitmentSha256: null,
      receiptSha256: null,
    },
    authority: {
      receiptIssued: false,
      reviewCompletedByIntake: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
  };
  const expectedTarget = {
    targetVersion: 1,
    campaignId: source.expectedCampaignId,
    keyId: source.expectedKeyId,
    publicKeyHex: source.publicKeyHex,
    sourceArtifactSha256,
    reviewReceiptSha256: "d".repeat(64),
    positiveVectorAvailable: false,
    positiveVectorReviewCompleted: false,
  };
  return { candidate, expectedTarget };
}

function evaluateScenario(name, category, candidate, expectedTarget) {
  return {
    name,
    category,
    expectedAccepted: false,
    expectedReceiptIssued: false,
    expectedReviewCompleted: false,
    expectedActivationAuthorized: false,
    expectedActivationEffect: "NONE",
    candidate,
    expectedTarget,
    expectedResult: evaluatePositiveCampaignVectorIntake(candidate, expectedTarget, { now: NOW }),
  };
}

export function generatePositiveCampaignVectorIntakeVectors() {
  const campaignVectors = JSON.parse(readFileSync(CAMPAIGN_VECTORS_PATH, "utf8"));
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const { candidate: baseCandidate, expectedTarget: baseTarget } = baseline(campaignVectors);
  const scenarios = [];
  const add = (name, category, candidate = baseCandidate, target = baseTarget) => {
    scenarios.push(evaluateScenario(name, category, structuredClone(candidate), structuredClone(target)));
  };

  add("BASE_UNRELATED_SIGNATURE_AND_REVIEW_ABSENT", "BASELINE_REJECTION");
  add(
    "MISSING_PROVENANCE",
    "CLOSED_SCHEMA_REJECTION",
    applyJsonPointerMutation(baseCandidate, { operation: "remove", path: "/provenance" }),
  );
  add(
    "PRIVATE_KEY_FIELD_ADDED",
    "PRIVATE_MATERIAL_REJECTION",
    applyJsonPointerMutation(baseCandidate, {
      operation: "add",
      path: "/provenance/privateKey",
      value: "forbidden-placeholder-not-signing-material",
    }),
  );
  add(
    "CANONICAL_MESSAGE_HEX_DRIFT",
    "MESSAGE_BINDING_REJECTION",
    applyJsonPointerMutation(baseCandidate, {
      operation: "replace",
      path: "/campaignVector/claimedCanonicalMessageHex",
      value: `00${baseCandidate.campaignVector.claimedCanonicalMessageHex.slice(2)}`,
    }),
  );
  add(
    "CANONICAL_MESSAGE_DIGEST_DRIFT",
    "MESSAGE_BINDING_REJECTION",
    applyJsonPointerMutation(baseCandidate, {
      operation: "replace",
      path: "/campaignVector/claimedCanonicalMessageSha256",
      value: "e".repeat(64),
    }),
  );
  add(
    "SOURCE_ARTIFACT_DIGEST_DRIFT",
    "PROVENANCE_REJECTION",
    applyJsonPointerMutation(baseCandidate, {
      operation: "replace",
      path: "/provenance/sourceArtifactSha256",
      value: "f".repeat(64),
    }),
  );
  add(
    "EXPECTED_TARGET_PUBLIC_KEY_MISMATCH",
    "EXPECTED_TARGET_BINDING_REJECTION",
    baseCandidate,
    { ...baseTarget, publicKeyHex: campaignVectors.publicPrimitiveControls[1].publicKeyHex },
  );
  add(
    "ACTIVATION_AUTHORITY_CLAIM",
    "NON_AUTHORITY_REJECTION",
    applyJsonPointerMutation(baseCandidate, {
      operation: "replace",
      path: "/authority/activationAuthorized",
      value: true,
    }),
  );
  let fakeReview = applyJsonPointerMutation(baseCandidate, {
    operation: "replace",
    path: "/review/completed",
    value: true,
  });
  fakeReview = applyJsonPointerMutation(fakeReview, {
    operation: "replace",
    path: "/review/decision",
    value: "APPROVE_VECTOR_ONLY",
  });
  fakeReview = applyJsonPointerMutation(fakeReview, {
    operation: "replace",
    path: "/review/reviewerIdentityCommitmentSha256",
    value: "a".repeat(64),
  });
  fakeReview = applyJsonPointerMutation(fakeReview, {
    operation: "replace",
    path: "/review/receiptSha256",
    value: baseTarget.reviewReceiptSha256,
  });
  add("CANDIDATE_ONLY_REVIEW_CLAIM", "INDEPENDENT_REVIEW_REJECTION", fakeReview);
  add(
    "UNRELATED_SIGNATURE_MISLABELED_AS_SOURCE_SIGNED",
    "CRYPTOGRAPHIC_REJECTION",
    applyJsonPointerMutation(baseCandidate, {
      operation: "replace",
      path: "/provenance/campaignMessageWasSignedBySource",
      value: true,
    }),
  );

  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-positive-campaign-vector-intake-vectors-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      intakeApplied: false,
      positiveVectorAvailable: false,
      positiveVectorReviewCompleted: false,
      positiveVectorIntegrationBlocked: true,
    },
    sources: {
      campaignEnvelopeVectors: {
        path: "campaign-envelope-verification-vectors.v1.json",
        canonicalSha256: canonicalSha256(campaignVectors),
      },
      intakeSchema: {
        path: "positive-campaign-vector-intake.schema.v1.json",
        canonicalSha256: canonicalSha256(schema),
      },
      intakeEvaluator: {
        path: "positive-campaign-vector-intake.mjs",
        normalizedTextSha256: normalizedTextSha256(EVALUATOR_PATH),
      },
    },
    contract: {
      mode: "VERIFY_ONLY_REJECTION_ONLY",
      gateOrder: GATE_ORDER,
      everyPublicCandidateRejected: true,
      validPositiveCampaignVectorPublished: false,
      independentlyReviewedPositiveVectorPublished: false,
      signingMaterialIncluded: false,
      createsKeys: false,
      createsSignatures: false,
      issuesReviewReceipts: false,
      completesReview: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    evaluationTime: NOW,
    scenarios,
  };
}

export function renderPositiveCampaignVectorIntakeVectors() {
  return `${JSON.stringify(generatePositiveCampaignVectorIntakeVectors(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = renderPositiveCampaignVectorIntakeVectors();
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote rejection-only intake vectors; no key, signature, receipt, review, network, or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}
