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
const ODD_WIDTH_TREE_LEAF_COUNTS = [1, 3, 5, 7, 9, 15, 17, 31, 33, 63, 65, 127, 129, 255, 257];
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

function representationAuditMultiproofNodeKeys(totalLeafCount, indices) {
  if (!Number.isSafeInteger(totalLeafCount) || totalLeafCount <= 0) {
    throw new Error("INVALID_REPRESENTATION_MULTIPROOF_LEAF_COUNT");
  }
  const unique = [...new Set(indices)].sort((left, right) => left - right);
  if (
    unique.length !== indices.length
    || unique.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= totalLeafCount)
  ) {
    throw new Error("INVALID_REPRESENTATION_MULTIPROOF_INDICES");
  }
  const keys = [];
  let active = new Set(unique);
  let width = totalLeafCount;
  let level = 0;
  while (width > 1) {
    const next = new Set();
    for (const index of [...active].sort((left, right) => left - right)) {
      const sibling = index % 2 === 0 ? index + 1 : index - 1;
      if (sibling < width && !active.has(sibling)) keys.push({ level, index: sibling });
      next.add(Math.floor(index / 2));
    }
    active = next;
    width = Math.ceil(width / 2);
    level += 1;
  }
  return keys;
}

export function representationAuditMerkleMultiproof(recordCommitments, indices) {
  const levels = representationAuditMerkleLevels(recordCommitments);
  return representationAuditMultiproofNodeKeys(recordCommitments.length, indices).map((key) => ({
    level: String(key.level),
    index: String(key.index),
    sha256: levels[key.level][key.index],
  }));
}

export function verifyRepresentationAuditMerkleMultiproof(
  selectedRecords,
  totalLeafCount,
  proofNodes,
  expectedRootSha256,
) {
  if (!Array.isArray(selectedRecords) || selectedRecords.length === 0 || !Array.isArray(proofNodes)) {
    return false;
  }
  const indices = selectedRecords.map((record) => record?.index);
  let expectedKeys;
  try {
    expectedKeys = representationAuditMultiproofNodeKeys(totalLeafCount, indices);
  } catch {
    return false;
  }
  if (proofNodes.length !== expectedKeys.length) return false;
  const proofMap = new Map();
  for (let position = 0; position < proofNodes.length; position += 1) {
    const node = proofNodes[position];
    const expected = expectedKeys[position];
    if (
      node?.level !== String(expected.level)
      || node?.index !== String(expected.index)
      || !HEX_32.test(node?.sha256 ?? "")
    ) {
      return false;
    }
    proofMap.set(`${node.level}:${node.index}`, node.sha256);
  }
  let active = new Map();
  for (const record of selectedRecords) {
    if (!Number.isSafeInteger(record?.index) || !HEX_32.test(record?.recordCommitmentSha256 ?? "")) {
      return false;
    }
    active.set(record.index, representationAuditLeafSha256(record.recordCommitmentSha256));
  }
  let width = totalLeafCount;
  let level = 0;
  const used = new Set();
  while (width > 1) {
    const parents = [...new Set([...active.keys()].map((index) => Math.floor(index / 2)))]
      .sort((left, right) => left - right);
    const next = new Map();
    for (const parent of parents) {
      const leftIndex = parent * 2;
      const rightIndex = Math.min(leftIndex + 1, width - 1);
      const resolve = (index) => {
        if (active.has(index)) return active.get(index);
        const key = `${level}:${index}`;
        if (!proofMap.has(key)) return null;
        used.add(key);
        return proofMap.get(key);
      };
      const left = resolve(leftIndex);
      const right = resolve(rightIndex);
      if (left === null || right === null) return false;
      next.set(parent, representationAuditParentSha256(left, right));
    }
    active = next;
    width = Math.ceil(width / 2);
    level += 1;
  }
  return active.get(0) === expectedRootSha256 && used.size === proofMap.size;
}

function greatestCommonDivisor(left, right) {
  let a = left;
  let b = right;
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function representationAuditOddWidthPropertyCases() {
  const cases = [];
  for (const [treeIndex, leafCount] of ODD_WIDTH_TREE_LEAF_COUNTS.entries()) {
    const sizes = [...new Set([
      1,
      Math.min(2, leafCount),
      Math.ceil(leafCount / 3),
      Math.floor(leafCount / 2),
      Math.max(1, leafCount - 1),
      leafCount,
    ])].filter((size) => size > 0);
    for (const [sizeIndex, size] of sizes.entries()) {
      let indices;
      if (size === 1) {
        indices = [leafCount - 1];
      } else if (size === 2) {
        indices = [0, leafCount - 1];
      } else if (size === leafCount) {
        indices = Array.from({ length: leafCount }, (_unused, index) => index);
      } else {
        const offset = (treeIndex * 19 + sizeIndex * 11 + 3) % leafCount;
        let stride = (treeIndex * 23 + sizeIndex * 17 + 1) % leafCount;
        if (stride === 0) stride = 1;
        while (greatestCommonDivisor(stride, leafCount) !== 1) {
          stride = (stride + 1) % leafCount;
          if (stride === 0) stride = 1;
        }
        indices = Array.from(
          { length: size },
          (_unused, position) => (offset + stride * position) % leafCount,
        ).sort((left, right) => left - right);
      }
      cases.push({ leafCount, indices });
    }
  }
  return cases;
}

function representationAuditSyntheticRecordCommitments(leafCount) {
  return Array.from({ length: leafCount }, (_unused, index) => sha256Hex(
    `iat-promotions-dlc-odd-width-record-v1\0${leafCount}\0${index}`,
  ));
}

export function representationAuditOddWidthPropertySummary() {
  const cases = representationAuditOddWidthPropertyCases();
  let selectedRecordCount = 0;
  let individualProofNodeCount = 0;
  let multiproofNodeCount = 0;
  let duplicateFinalWidthAliasCount = 0;
  for (const propertyCase of cases) {
    const commitments = representationAuditSyntheticRecordCommitments(propertyCase.leafCount);
    const root = representationAuditMerkleRootSha256(commitments);
    const nodes = representationAuditMerkleMultiproof(commitments, propertyCase.indices);
    const selected = propertyCase.indices.map((index) => ({
      index,
      recordCommitmentSha256: commitments[index],
    }));
    if (!verifyRepresentationAuditMerkleMultiproof(
      selected,
      propertyCase.leafCount,
      nodes,
      root,
    )) {
      throw new Error("ODD_WIDTH_REPRESENTATION_MULTIPROOF_FAILED");
    }
    if (verifyRepresentationAuditMerkleMultiproof(
      selected,
      propertyCase.leafCount + 1,
      nodes,
      root,
    )) {
      duplicateFinalWidthAliasCount += 1;
    }
    selectedRecordCount += selected.length;
    multiproofNodeCount += nodes.length;
    individualProofNodeCount += selected.reduce(
      (total, record) => total + representationAuditMerkleProof(commitments, record.index).length,
      0,
    );
  }
  return {
    caseCount: String(cases.length),
    treeCount: String(ODD_WIDTH_TREE_LEAF_COUNTS.length),
    treeLeafCounts: ODD_WIDTH_TREE_LEAF_COUNTS.map(String),
    minimumTreeLeafCount: String(ODD_WIDTH_TREE_LEAF_COUNTS[0]),
    maximumTreeLeafCount: String(ODD_WIDTH_TREE_LEAF_COUNTS.at(-1)),
    selectedRecordCount: String(selectedRecordCount),
    individualProofNodeCount: String(individualProofNodeCount),
    multiproofNodeCount: String(multiproofNodeCount),
    savedNodeCount: String(individualProofNodeCount - multiproofNodeCount),
    duplicateFinalWidthAliasCount: String(duplicateFinalWidthAliasCount),
    caseSetCommitmentSha256: sha256Hex(JSON.stringify(cases)),
    allMultiproofsVerify: true,
    exactTreeLeafCountRequired: true,
    expandedCasesStored: false,
    inputOrResultStored: false,
    accepted: false,
    receiptIssued: false,
    reviewCompleted: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  };
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
  const expectedCollisionIndices = expectedCollisionProofs.map((proof) => Number(proof.index));
  const expectedCollisionMultiproofNodes = representationAuditMerkleMultiproof(
    recordCommitments,
    expectedCollisionIndices,
  );
  const multiproofCore = {
    family: "EXPECTED_TARGET",
    treeLeafCount: String(recordCommitments.length),
    recordCount: String(expectedCollisionIndices.length),
    recordIndices: expectedCollisionIndices.map(String),
    proofNodes: expectedCollisionMultiproofNodes,
    proofNodeCount: String(expectedCollisionMultiproofNodes.length),
    proofVerifiedToPublishedRoot: true,
    minimalNodeSet: true,
    equivalentToIndividualProofs: true,
    inputOrResultStored: false,
    accepted: false,
    receiptIssued: false,
    reviewCompleted: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  };
  const expectedCollisionMultiproof = {
    ...multiproofCore,
    multiproofCommitmentSha256: canonicalSha256(multiproofCore),
  };
  const oddWidthMultiproofProperties = representationAuditOddWidthPropertySummary();
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
      multiproofCount: 1,
      multiproofNodeCount: 84,
      individualProofNodeCount: 208,
      multiproofSavedNodeCount: 124,
      multiproofRequiresExactTreeLeafCount: true,
      multiproofRequiresMinimalNodeSet: true,
      multiproofEquivalentToIndividualProofs: true,
      oddWidthPropertyCaseCount: 79,
      oddWidthPropertyTreeCount: 15,
      oddWidthPropertiesStoreExpandedCases: false,
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
      expectedCollisionMultiproofNodeCount: expectedCollisionMultiproof.proofNodeCount,
      expectedCollisionIndividualProofNodeCount: String(
        expectedCollisionProofs.reduce((total, proof) => total + proof.path.length, 0),
      ),
      expectedCollisionMultiproofSavedNodeCount: String(
        expectedCollisionProofs.reduce((total, proof) => total + proof.path.length, 0)
          - expectedCollisionMultiproofNodes.length,
      ),
      expectedCollisionMultiproofCommitmentSha256:
        expectedCollisionMultiproof.multiproofCommitmentSha256,
      allRejected: true,
    },
    canonicalCollisionClasses: replay.canonicalCollisionClasses,
    expectedCollisionProofs,
    expectedCollisionMultiproof,
    oddWidthMultiproofProperties,
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
