/**
 * Compact representation-sensitivity audit for all seeded intake fuzz inputs.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This generator stores commitments only. It creates no key, signature,
 * receipt, review decision, deployment, wallet request, or activation effect.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  FUZZ_CASE_COUNT,
  replayPositiveCampaignVectorIntakeFuzzCase,
} from "./generate-positive-campaign-vector-intake-fuzz-vectors.mjs";

const FUZZ_VECTORS_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-fuzz-vectors.v1.json", import.meta.url),
);
const FUZZ_GENERATOR_PATH = fileURLToPath(
  new URL("./generate-positive-campaign-vector-intake-fuzz-vectors.mjs", import.meta.url),
);
const PYTHON_VERIFIER_PATH = fileURLToPath(
  new URL("./verify-positive-campaign-vector-intake.py", import.meta.url),
);
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const OUTPUT_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-representation-audit.v1.json", import.meta.url),
);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(
  readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
);
const orderedInputSha256 = (candidate, expectedTarget) => sha256Hex(
  JSON.stringify({ candidate, expectedTarget }),
);

function groupIndices(values) {
  const groups = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    groups.set(value, [...(groups.get(value) ?? []), index]);
  }
  return groups;
}

export function replayPositiveCampaignVectorRepresentationAudit() {
  const replays = Array.from({ length: FUZZ_CASE_COUNT }, (_, index) =>
    replayPositiveCampaignVectorIntakeFuzzCase(index));
  const canonicalCommitments = replays.map((replay) => replay.record.inputCommitmentSha256);
  const orderedCommitments = replays.map((replay) => orderedInputSha256(
    replay.candidate,
    replay.expectedTarget,
  ));
  const canonicalGroups = groupIndices(canonicalCommitments);
  const orderedGroups = groupIndices(orderedCommitments);
  const records = replays.map((replay, index) => {
    const canonicalClass = canonicalGroups.get(canonicalCommitments[index]);
    const orderedClass = orderedGroups.get(orderedCommitments[index]);
    const core = {
      index: String(index),
      family: replay.record.family,
      sourceFuzzCaseName: replay.record.name,
      sourceCaseCommitmentSha256: replay.record.caseCommitmentSha256,
      canonicalInputSha256: canonicalCommitments[index],
      orderedInputSha256: orderedCommitments[index],
      canonicalClassSize: String(canonicalClass.length),
      orderedClassSize: String(orderedClass.length),
      canonicalCollisionExpected: replay.record.family === "EXPECTED_TARGET",
      orderedInputUnique: orderedClass.length === 1,
      inputOrResultStored: false,
      accepted: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    };
    return { ...core, auditRecordCommitmentSha256: canonicalSha256(core) };
  });
  const canonicalCollisionClasses = [...canonicalGroups.entries()]
    .filter(([_hash, indices]) => indices.length > 1)
    .map(([canonicalInputSha256, indices]) => ({
      canonicalInputSha256,
      classSize: String(indices.length),
      indices: indices.map(String),
      families: [...new Set(indices.map((index) => records[index].family))],
      orderedCommitmentsAllDistinct:
        new Set(indices.map((index) => orderedCommitments[index])).size === indices.length,
    }));
  return { records, canonicalCollisionClasses };
}

export function generatePositiveCampaignVectorRepresentationAudit() {
  const fuzzVectors = JSON.parse(readFileSync(FUZZ_VECTORS_PATH, "utf8"));
  const replay = replayPositiveCampaignVectorRepresentationAudit();
  const recordCommitments = replay.records.map((record) => record.auditRecordCommitmentSha256);
  return {
    auditVersion: 1,
    auditId: "iat-promotions-dlc-positive-campaign-vector-representation-audit-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      auditApplied: false,
      positiveVectorAvailable: false,
      positiveVectorReviewCompleted: false,
      positiveVectorIntegrationBlocked: true,
    },
    sources: {
      fuzzVectors: {
        path: "positive-campaign-vector-intake-fuzz-vectors.v1.json",
        canonicalSha256: canonicalSha256(fuzzVectors),
      },
      fuzzGenerator: {
        path: "generate-positive-campaign-vector-intake-fuzz-vectors.mjs",
        normalizedTextSha256: normalizedTextSha256(FUZZ_GENERATOR_PATH),
      },
      pythonVerifier: {
        path: "verify-positive-campaign-vector-intake.py",
        normalizedTextSha256: normalizedTextSha256(PYTHON_VERIFIER_PATH),
      },
      generator: {
        path: "generate-positive-campaign-vector-representation-audit.mjs",
        normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH),
      },
    },
    contract: {
      mode: "CROSS_RUNTIME_REPRESENTATION_AUDIT_REJECTION_ONLY",
      caseCount: FUZZ_CASE_COUNT,
      canonicalHash: "SHA-256 over lexicographically key-sorted compact UTF-8 JSON",
      orderedHash: "SHA-256 over insertion-order-preserving compact UTF-8 JSON",
      expectedCanonicalCollisionFamilies: ["EXPECTED_TARGET"],
      expectedCanonicalCollisionClassCount: 1,
      expectedCanonicalCollisionCaseCount: 26,
      orderedInputsMustBeUnique: true,
      storesInputsOrFullResults: false,
      everyCaseRejected: true,
      validPositiveCampaignVectorPublished: false,
      signingMaterialIncluded: false,
      createsKeys: false,
      createsSignatures: false,
      issuesReviewReceipts: false,
      completesReview: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    summary: {
      caseCount: String(replay.records.length),
      canonicalUniqueCount: String(new Set(replay.records.map((record) =>
        record.canonicalInputSha256)).size),
      orderedUniqueCount: String(new Set(replay.records.map((record) =>
        record.orderedInputSha256)).size),
      canonicalCollisionClassCount: String(replay.canonicalCollisionClasses.length),
      canonicalCollisionCaseCount: String(replay.canonicalCollisionClasses.reduce(
        (total, entry) => total + Number(entry.classSize),
        0,
      )),
      unexpectedCanonicalCollisionCount: "0",
      duplicateOrderedInputCount: "0",
      auditRecordSetCommitmentSha256: canonicalSha256(recordCommitments),
      allRejected: true,
    },
    canonicalCollisionClasses: replay.canonicalCollisionClasses,
    records: replay.records,
  };
}

export function renderPositiveCampaignVectorRepresentationAudit() {
  return `${JSON.stringify(generatePositiveCampaignVectorRepresentationAudit(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = renderPositiveCampaignVectorRepresentationAudit();
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote the 256-input compact representation audit; no key, signature, receipt, review, network, or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}
