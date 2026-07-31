/**
 * Deterministic cross-runtime mutation corpus for positive-vector intake.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Every case is rejection-only. This generator creates no key, signature,
 * receipt, review decision, deployment, wallet request, or activation effect.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { applyJsonPointerMutation } from "./json-schema-subset.mjs";
import { evaluatePositiveCampaignVectorIntake } from "./positive-campaign-vector-intake.mjs";

const BASE_VECTORS_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-vectors.v1.json", import.meta.url),
);
const SCHEMA_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake.schema.v1.json", import.meta.url),
);
const EVALUATOR_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake.mjs", import.meta.url),
);
const PYTHON_VERIFIER_PATH = fileURLToPath(
  new URL("./verify-positive-campaign-vector-intake.py", import.meta.url),
);
const OUTPUT_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-differential-vectors.v1.json", import.meta.url),
);
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

function changeFirstHexByte(hex) {
  return `${hex.startsWith("00") ? "01" : "00"}${hex.slice(2)}`;
}

function changeFirstSignatureByte(base64) {
  const bytes = Buffer.from(base64, "base64");
  bytes[0] ^= 1;
  return bytes.toString("base64");
}

function scenario({ name, family, document, mutation, candidate, expectedTarget, now }) {
  const expectedResult = evaluatePositiveCampaignVectorIntake(candidate, expectedTarget, { now });
  return {
    name,
    family,
    document,
    mutation,
    expectedAccepted: false,
    expectedReceiptIssued: false,
    expectedReviewCompleted: false,
    expectedActivationAuthorized: false,
    expectedActivationEffect: "NONE",
    candidate,
    expectedTarget,
    expectedResult,
  };
}

export function generatePositiveCampaignVectorIntakeDifferentialVectors() {
  const baseVectors = JSON.parse(readFileSync(BASE_VECTORS_PATH, "utf8"));
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const base = baseVectors.scenarios[0];
  const now = baseVectors.evaluationTime;
  const cases = [];
  const addCandidate = (name, family, mutation, previous = base.candidate, target = base.expectedTarget) => {
    const candidate = applyJsonPointerMutation(previous, mutation);
    cases.push(scenario({
      name,
      family,
      document: "candidate",
      mutation,
      candidate,
      expectedTarget: structuredClone(target),
      now,
    }));
    return candidate;
  };
  const addTarget = (name, family, mutation, previous = base.expectedTarget, candidate = base.candidate) => {
    const expectedTarget = applyJsonPointerMutation(previous, mutation);
    cases.push(scenario({
      name,
      family,
      document: "expectedTarget",
      mutation,
      candidate: structuredClone(candidate),
      expectedTarget,
      now,
    }));
    return expectedTarget;
  };

  addCandidate("CANDIDATE_INTAKE_VERSION_CHANGED", "CLOSED_SCHEMA", {
    operation: "replace", path: "/intakeVersion", value: 2,
  });
  addCandidate("CANDIDATE_STATUS_REMOVED", "CLOSED_SCHEMA", {
    operation: "remove", path: "/status",
  });
  addCandidate("CANDIDATE_UNKNOWN_TOP_LEVEL_FIELD", "CLOSED_SCHEMA", {
    operation: "add", path: "/unexpected", value: false,
  });
  addCandidate("CANDIDATE_HOLD_LABELS_REORDERED", "CLOSED_SCHEMA", {
    operation: "replace", path: "/status/labels", value: [...HOLD_LABELS].reverse(),
  });

  const reorderedTarget = Object.fromEntries(
    Object.entries(base.expectedTarget).reverse(),
  );
  cases.push(scenario({
    name: "EXPECTED_TARGET_KEYS_REORDERED",
    family: "EXPECTED_TARGET",
    document: "expectedTarget",
    mutation: { operation: "reorder", path: "/", value: Object.keys(reorderedTarget) },
    candidate: structuredClone(base.candidate),
    expectedTarget: reorderedTarget,
    now,
  }));
  addTarget("EXPECTED_TARGET_VERSION_CHANGED", "EXPECTED_TARGET", {
    operation: "replace", path: "/targetVersion", value: 2,
  });
  addTarget("EXPECTED_TARGET_PUBLIC_KEY_SUBSTITUTED", "TARGET_BINDING", {
    operation: "replace",
    path: "/publicKeyHex",
    value: "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
  });

  addCandidate("CANDIDATE_ACCESS_TOKEN_FIELD_ADDED", "PRIVATE_MATERIAL_EXCLUSION", {
    operation: "add",
    path: "/provenance/accessToken",
    value: "forbidden-placeholder-not-a-credential",
  });
  addCandidate("PROVENANCE_SOURCE_DIGEST_CHANGED", "EXTERNAL_PROVENANCE", {
    operation: "replace", path: "/provenance/sourceArtifactSha256", value: "f".repeat(64),
  });
  addCandidate("PROVENANCE_SOURCE_SIGNED_ASSERTED", "EXTERNAL_PROVENANCE", {
    operation: "replace", path: "/provenance/campaignMessageWasSignedBySource", value: true,
  });

  addCandidate("CLAIMED_CANONICAL_MESSAGE_HEX_CHANGED", "CANONICAL_MESSAGE_BINDING", {
    operation: "replace",
    path: "/campaignVector/claimedCanonicalMessageHex",
    value: changeFirstHexByte(base.candidate.campaignVector.claimedCanonicalMessageHex),
  });
  addCandidate("CLAIMED_CANONICAL_MESSAGE_DIGEST_CHANGED", "CANONICAL_MESSAGE_BINDING", {
    operation: "replace",
    path: "/campaignVector/claimedCanonicalMessageSha256",
    value: "e".repeat(64),
  });
  addCandidate("CANDIDATE_PUBLIC_KEY_SUBSTITUTED", "CANONICAL_MESSAGE_BINDING", {
    operation: "replace",
    path: "/campaignVector/publicKeyHex",
    value: "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
  });
  addCandidate("CANDIDATE_SIGNATURE_HEX_CHANGED", "CANONICAL_MESSAGE_BINDING", {
    operation: "replace",
    path: "/campaignVector/signatureHex",
    value: changeFirstHexByte(base.candidate.campaignVector.signatureHex),
  });
  addCandidate("ENVELOPE_NONCE_CHANGED_WITH_STALE_ATTESTATION_ID", "CRYPTOGRAPHIC_GUARD", {
    operation: "replace",
    path: "/campaignVector/envelope/payload/nonce",
    value: "nonce-public-envelope-fixture-mutated",
  });
  const changedSignatureBase64 = changeFirstSignatureByte(
    base.candidate.campaignVector.envelope.signatureBase64,
  );
  let signatureMutation = applyJsonPointerMutation(base.candidate, {
    operation: "replace",
    path: "/campaignVector/envelope/signatureBase64",
    value: changedSignatureBase64,
  });
  signatureMutation = applyJsonPointerMutation(signatureMutation, {
    operation: "replace",
    path: "/campaignVector/signatureHex",
    value: Buffer.from(changedSignatureBase64, "base64").toString("hex"),
  });
  cases.push(scenario({
    name: "ENVELOPE_SIGNATURE_BYTE_CHANGED_WITH_MATCHING_HEX",
    family: "CRYPTOGRAPHIC_SIGNATURE",
    document: "candidate",
    mutation: {
      operation: "replace-pair",
      paths: ["/campaignVector/envelope/signatureBase64", "/campaignVector/signatureHex"],
    },
    candidate: signatureMutation,
    expectedTarget: structuredClone(base.expectedTarget),
    now,
  }));

  let candidateOnlyReview = applyJsonPointerMutation(base.candidate, {
    operation: "replace", path: "/review/completed", value: true,
  });
  candidateOnlyReview = applyJsonPointerMutation(candidateOnlyReview, {
    operation: "replace", path: "/review/decision", value: "APPROVE_VECTOR_ONLY",
  });
  candidateOnlyReview = applyJsonPointerMutation(candidateOnlyReview, {
    operation: "replace", path: "/review/reviewerIdentityCommitmentSha256", value: "a".repeat(64),
  });
  candidateOnlyReview = applyJsonPointerMutation(candidateOnlyReview, {
    operation: "replace", path: "/review/receiptSha256", value: base.expectedTarget.reviewReceiptSha256,
  });
  cases.push(scenario({
    name: "CANDIDATE_REVIEW_COMPLETE_TARGET_HELD",
    family: "INDEPENDENT_VECTOR_REVIEW",
    document: "candidate",
    mutation: { operation: "replace-review", path: "/review" },
    candidate: candidateOnlyReview,
    expectedTarget: structuredClone(base.expectedTarget),
    now,
  }));
  let reviewedTarget = applyJsonPointerMutation(base.expectedTarget, {
    operation: "replace", path: "/positiveVectorAvailable", value: true,
  });
  reviewedTarget = applyJsonPointerMutation(reviewedTarget, {
    operation: "replace", path: "/positiveVectorReviewCompleted", value: true,
  });
  cases.push(scenario({
    name: "REVIEW_BINDING_COMPLETE_BUT_CRYPTOGRAPHY_ABSENT",
    family: "INDEPENDENT_VECTOR_REVIEW",
    document: "candidate+expectedTarget",
    mutation: { operation: "replace-review-and-target-flags", path: "/review" },
    candidate: candidateOnlyReview,
    expectedTarget: reviewedTarget,
    now,
  }));

  addCandidate("AUTHORITY_RECEIPT_ISSUED", "NON_AUTHORITY", {
    operation: "replace", path: "/authority/receiptIssued", value: true,
  });
  addCandidate("AUTHORITY_ACTIVATION_AUTHORIZED", "NON_AUTHORITY", {
    operation: "replace", path: "/authority/activationAuthorized", value: true,
  });

  if (cases.length !== 20) throw new Error(`DIFFERENTIAL_CASE_COUNT_DRIFT:${cases.length}`);
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-positive-campaign-vector-intake-differential-vectors-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      differentialCorpusApplied: false,
      positiveVectorAvailable: false,
      positiveVectorReviewCompleted: false,
      positiveVectorIntegrationBlocked: true,
    },
    sources: {
      baseVectors: {
        path: "positive-campaign-vector-intake-vectors.v1.json",
        canonicalSha256: canonicalSha256(baseVectors),
      },
      intakeSchema: {
        path: "positive-campaign-vector-intake.schema.v1.json",
        canonicalSha256: canonicalSha256(schema),
      },
      nodeEvaluator: {
        path: "positive-campaign-vector-intake.mjs",
        normalizedTextSha256: normalizedTextSha256(EVALUATOR_PATH),
      },
      pythonVerifier: {
        path: "verify-positive-campaign-vector-intake.py",
        normalizedTextSha256: normalizedTextSha256(PYTHON_VERIFIER_PATH),
      },
    },
    contract: {
      mode: "CROSS_RUNTIME_VERIFY_ONLY_REJECTION_ONLY",
      gateOrder: GATE_ORDER,
      mutationCount: 20,
      everyMutationRejected: true,
      nodeAndPythonMustMatchExactly: true,
      validPositiveCampaignVectorPublished: false,
      signingMaterialIncluded: false,
      createsKeys: false,
      createsSignatures: false,
      issuesReviewReceipts: false,
      completesReview: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    evaluationTime: now,
    scenarios: cases,
  };
}

export function renderPositiveCampaignVectorIntakeDifferentialVectors() {
  return `${JSON.stringify(generatePositiveCampaignVectorIntakeDifferentialVectors(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = renderPositiveCampaignVectorIntakeDifferentialVectors();
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote rejection-only cross-runtime intake mutations; no key, signature, receipt, review, network, or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}
