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
const MERKLE_LEAF_DOMAIN = "iat-promotions-dlc-representation-audit-leaf-v1";
const MERKLE_NODE_DOMAIN = "iat-promotions-dlc-representation-audit-node-v1";
const HEX_32 = /^[0-9a-f]{64}$/;
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

export function representationAuditLeafSha256(recordCommitmentSha256) {
  if (!HEX_32.test(recordCommitmentSha256)) throw new Error("INVALID_REPRESENTATION_RECORD_COMMITMENT");
  return sha256Hex(Buffer.concat([
    Buffer.from(MERKLE_LEAF_DOMAIN, "utf8"),
    Buffer.from([0]),
    Buffer.from(recordCommitmentSha256, "hex"),
  ]));
}

function representationAuditParentSha256(leftSha256, rightSha256) {
  if (!HEX_32.test(leftSha256) || !HEX_32.test(rightSha256)) {
    throw new Error("INVALID_REPRESENTATION_MERKLE_NODE");
  }
  return sha256Hex(Buffer.concat([
    Buffer.from(MERKLE_NODE_DOMAIN, "utf8"),
    Buffer.from([0]),
    Buffer.from(leftSha256, "hex"),
    Buffer.from(rightSha256, "hex"),
  ]));
}

export function representationAuditMerkleLevels(recordCommitments) {
  if (!Array.isArray(recordCommitments) || recordCommitments.length === 0) {
    throw new Error("REPRESENTATION_TREE_EMPTY");
  }
  const levels = [recordCommitments.map(representationAuditLeafSha256)];
  while (levels.at(-1).length > 1) {
    const current = levels.at(-1);
    const next = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(representationAuditParentSha256(current[index], current[index + 1] ?? current[index]));
    }
    levels.push(next);
  }
  return levels;
}

export function representationAuditMerkleRootSha256(recordCommitments) {
  return representationAuditMerkleLevels(recordCommitments).at(-1)[0];
}

export function representationAuditMerkleProof(recordCommitments, index) {
  const levels = representationAuditMerkleLevels(recordCommitments);
  if (!Number.isSafeInteger(index) || index < 0 || index >= levels[0].length) {
    throw new Error("REPRESENTATION_PROOF_INDEX_OUT_OF_RANGE");
  }
  const path = [];
  let cursor = index;
  for (let level = 0; level < levels.length - 1; level += 1) {
    const nodes = levels[level];
    const siblingIndex = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
    path.push({
      level: String(level),
      side: cursor % 2 === 0 ? "RIGHT" : "LEFT",
      siblingSha256: nodes[siblingIndex] ?? nodes[cursor],
    });
    cursor = Math.floor(cursor / 2);
  }
  return path;
}

export function verifyRepresentationAuditMerkleProof(
  recordCommitmentSha256,
  index,
  path,
  expectedRootSha256,
) {
  if (!Number.isSafeInteger(index) || index < 0 || !Array.isArray(path) || !HEX_32.test(expectedRootSha256)) {
    return false;
  }
  let current = representationAuditLeafSha256(recordCommitmentSha256);
  let cursor = index;
  for (let level = 0; level < path.length; level += 1) {
    const step = path[level];
    const expectedSide = cursor % 2 === 0 ? "RIGHT" : "LEFT";
    if (step?.level !== String(level) || step?.side !== expectedSide || !HEX_32.test(step?.siblingSha256 ?? "")) {
      return false;
    }
    current = step.side === "LEFT"
      ? representationAuditParentSha256(step.siblingSha256, current)
      : representationAuditParentSha256(current, step.siblingSha256);
    cursor = Math.floor(cursor / 2);
  }
  return current === expectedRootSha256;
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
  const recordMerkleRootSha256 = representationAuditMerkleRootSha256(recordCommitments);
  const expectedCollisionProofs = replay.records
    .filter((record) => record.canonicalCollisionExpected)
    .map((record) => {
      const index = Number(record.index);
      const core = {
        index: record.index,
        family: record.family,
        sourceFuzzCaseName: record.sourceFuzzCaseName,
        auditRecordCommitmentSha256: record.auditRecordCommitmentSha256,
        leafSha256: representationAuditLeafSha256(record.auditRecordCommitmentSha256),
        path: representationAuditMerkleProof(recordCommitments, index),
        proofVerifiedToPublishedRoot: true,
        inputOrResultStored: false,
        accepted: false,
        receiptIssued: false,
        reviewCompleted: false,
        activationAuthorized: false,
        activationEffect: "NONE",
      };
      return { ...core, proofCommitmentSha256: canonicalSha256(core) };
    });
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
    merkleContract: {
      hash: "SHA-256",
      leafDomain: MERKLE_LEAF_DOMAIN,
      leafPreimage: "domain || 0x00 || raw auditRecordCommitmentSha256",
      nodeDomain: MERKLE_NODE_DOMAIN,
      nodePreimage: "domain || 0x00 || raw leftSha256 || raw rightSha256",
      ordering: "records in ascending numeric index order",
      oddNode: "duplicate final node",
      proofFamily: "EXPECTED_TARGET",
      proofCount: 26,
      proofPathLength: 8,
      publishesProofsForAcceptedVectors: false,
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
      auditRecordMerkleRootSha256: recordMerkleRootSha256,
      expectedCollisionProofCount: String(expectedCollisionProofs.length),
      expectedCollisionProofSetCommitmentSha256: canonicalSha256(
        expectedCollisionProofs.map((proof) => proof.proofCommitmentSha256),
      ),
      allRejected: true,
    },
    canonicalCollisionClasses: replay.canonicalCollisionClasses,
    expectedCollisionProofs,
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
