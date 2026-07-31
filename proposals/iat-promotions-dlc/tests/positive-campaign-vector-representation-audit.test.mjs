/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { FUZZ_FAMILIES } from "../generate-positive-campaign-vector-intake-fuzz-vectors.mjs";
import {
  generatePositiveCampaignVectorRepresentationAudit,
  replayPositiveCampaignVectorRepresentationAudit,
  representationAuditMerkleMultiproof,
  representationAuditMerkleProof,
  representationAuditMerkleRootSha256,
  representationAuditOddWidthPropertySummary,
  representationAuditTreeLeafCountBoundarySummary,
  verifyRepresentationAuditMerkleMultiproof,
  verifyRepresentationAuditMerkleMultiproofWithExactTreeLeafCount,
  verifyRepresentationAuditMerkleProof,
} from "../generate-positive-campaign-vector-representation-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadPositiveCampaignVectorRepresentationAuditBundle,
  validatePositiveCampaignVectorRepresentationAudit,
} from "../validate-positive-campaign-vector-representation-audit.mjs";

const PYTHON_VERIFIER = fileURLToPath(new URL("../verify-positive-campaign-vector-intake.py", import.meta.url));
const GENERATOR = fileURLToPath(new URL("../generate-positive-campaign-vector-representation-audit.mjs", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const pythonOptions = { encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" } };
const bundle = loadPositiveCampaignVectorRepresentationAuditBundle();
const artifact = bundle.artifact;
const MULTIPROOF_PROPERTY_CASE_COUNT = 96;
const MULTIPROOF_PROPERTY_SET_COMMITMENT_SHA256 =
  "55b6dfca7e24fe93a18ee1a0e45b5086d27ca0f07ec778e283e67953b6582abb";
const ODD_WIDTH_PROPERTY_SET_COMMITMENT_SHA256 =
  "937771b307fe23379f7c4840017f1ce7e832186cbd9dfd1420720731624ed354";
const REPRESENTATION_LEAF_DOMAIN = Buffer.from(
  "iat-promotions-dlc-representation-audit-leaf-v1",
  "utf8",
);
const REPRESENTATION_NODE_DOMAIN = Buffer.from(
  "iat-promotions-dlc-representation-audit-node-v1",
  "utf8",
);

function runPython(path = null) {
  const args = [PYTHON_VERIFIER, "--verify-representation-audit", "--format", "json"];
  if (path !== null) args.push("--representation-audit", path);
  return spawnSync(PYTHON, args, pythonOptions);
}

function deterministicMultiproofPropertySubsets(totalLeafCount) {
  assert.equal(totalLeafCount, 256);
  const sizes = [
    1, 2, 3, 4, 5, 7, 8, 13, 16, 21, 26, 31, 32, 33, 55, 63, 64, 65,
    89, 127, 128, 129, 191, 254, 255, 256,
  ];
  for (let cursor = 0; sizes.length < MULTIPROOF_PROPERTY_CASE_COUNT; cursor += 1) {
    const candidate = ((cursor * 73) % 255) + 1;
    if (!sizes.includes(candidate)) sizes.push(candidate);
  }
  return sizes.map((size, caseIndex) => {
    const offset = (caseIndex * 97 + 17) % totalLeafCount;
    const stride = (((caseIndex * 53 + 1) % totalLeafCount) | 1);
    const indices = Array.from(
      { length: size },
      (_, position) => (offset + stride * position) % totalLeafCount,
    ).sort((left, right) => left - right);
    assert.equal(new Set(indices).size, size, `case ${caseIndex}`);
    return indices;
  });
}

function independentMinimalMultiproofCoordinates(totalLeafCount, indices) {
  let active = new Set(indices);
  let width = totalLeafCount;
  let level = 0;
  const coordinates = [];
  while (width > 1) {
    const next = new Set();
    for (let left = 0; left < width; left += 2) {
      const right = left + 1;
      const leftActive = active.has(left);
      const rightActive = right < width && active.has(right);
      if (!leftActive && !rightActive) continue;
      next.add(Math.floor(left / 2));
      if (right < width && leftActive !== rightActive) {
        coordinates.push(`${level}:${leftActive ? right : left}`);
      }
    }
    active = next;
    width = Math.ceil(width / 2);
    level += 1;
  }
  return coordinates;
}

function hashBuffers(...buffers) {
  const hash = createHash("sha256");
  for (const buffer of buffers) hash.update(buffer);
  return hash.digest("hex");
}

function independentRepresentationLeaf(recordCommitmentSha256) {
  return hashBuffers(
    REPRESENTATION_LEAF_DOMAIN,
    Buffer.from([0]),
    Buffer.from(recordCommitmentSha256, "hex"),
  );
}

function independentRepresentationParent(leftSha256, rightSha256) {
  return hashBuffers(
    REPRESENTATION_NODE_DOMAIN,
    Buffer.from([0]),
    Buffer.from(leftSha256, "hex"),
    Buffer.from(rightSha256, "hex"),
  );
}

function independentRepresentationRoot(recordCommitments) {
  let level = recordCommitments.map(independentRepresentationLeaf);
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      next.push(independentRepresentationParent(level[index], level[index + 1] ?? level[index]));
    }
    level = next;
  }
  return level[0];
}

function greatestCommonDivisor(left, right) {
  let a = left;
  let b = right;
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function syntheticOddWidthPropertyCases() {
  const leafCounts = [1, 3, 5, 7, 9, 15, 17, 31, 33, 63, 65, 127, 129, 255, 257];
  const cases = [];
  for (const [treeIndex, leafCount] of leafCounts.entries()) {
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
        indices = Array.from({ length: leafCount }, (_, index) => index);
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
          (_, position) => (offset + stride * position) % leafCount,
        ).sort((left, right) => left - right);
      }
      assert.equal(new Set(indices).size, size, `${leafCount}:${size}`);
      cases.push({ leafCount, indices });
    }
  }
  return cases;
}

function syntheticRecordCommitments(leafCount) {
  return Array.from({ length: leafCount }, (_, index) =>
    createHash("sha256")
      .update(`iat-promotions-dlc-odd-width-record-v1\0${leafCount}\0${index}`, "utf8")
      .digest("hex"));
}

test("the compact 256-input representation audit deterministically regenerates", () => {
  assert.deepEqual(validatePositiveCampaignVectorRepresentationAudit(bundle), []);
  assert.deepEqual(generatePositiveCampaignVectorRepresentationAudit(), artifact);
  assert.deepEqual(replayPositiveCampaignVectorRepresentationAudit().records, artifact.records);
  assert.equal(artifact.records.length, 256);
});

test("all 256 insertion-order-sensitive input commitments are unique", () => {
  assert.equal(new Set(artifact.records.map((record) => record.orderedInputSha256)).size, 256);
  assert.ok(artifact.records.every((record) => record.orderedInputUnique && record.orderedClassSize === "1"));
});

test("only the 26 expected-target permutations share a canonical class", () => {
  assert.equal(artifact.summary.canonicalUniqueCount, "231");
  assert.equal(artifact.canonicalCollisionClasses.length, 1);
  const collision = artifact.canonicalCollisionClasses[0];
  assert.equal(collision.classSize, "26");
  assert.deepEqual(collision.families, ["EXPECTED_TARGET"]);
  assert.equal(collision.orderedCommitmentsAllDistinct, true);
});

test("every compact record remains source-bound and rejection-only", () => {
  for (const record of artifact.records) {
    assert.match(record.sourceCaseCommitmentSha256, /^[0-9a-f]{64}$/);
    assert.equal(record.inputOrResultStored, false);
    assert.equal(record.accepted, false);
    assert.equal(record.receiptIssued, false);
    assert.equal(record.reviewCompleted, false);
    assert.equal(record.activationAuthorized, false);
    assert.equal(record.activationEffect, "NONE");
  }
});

test("every family appears and only target permutations collide canonically", () => {
  assert.deepEqual([...new Set(artifact.records.map((record) => record.family))], FUZZ_FAMILIES);
  for (const record of artifact.records) {
    assert.equal(record.canonicalCollisionExpected, record.family === "EXPECTED_TARGET");
    assert.equal(record.canonicalClassSize, record.family === "EXPECTED_TARGET" ? "26" : "1");
  }
});

test("the domain-separated record tree deterministically reproduces", () => {
  const commitments = artifact.records.map((record) => record.auditRecordCommitmentSha256);
  assert.equal(
    representationAuditMerkleRootSha256(commitments),
    artifact.summary.auditRecordMerkleRootSha256,
  );
  assert.equal(artifact.merkleContract.leafDomain, "iat-promotions-dlc-representation-audit-leaf-v1");
  assert.equal(artifact.merkleContract.nodeDomain, "iat-promotions-dlc-representation-audit-node-v1");
  assert.equal(artifact.merkleContract.publishesProofsForAcceptedVectors, false);
});

test("published inclusion proofs cover exactly the 26 expected collision members", () => {
  const expectedIndices = artifact.records
    .filter((record) => record.family === "EXPECTED_TARGET")
    .map((record) => record.index);
  assert.deepEqual(artifact.expectedCollisionProofs.map((proof) => proof.index), expectedIndices);
  assert.equal(artifact.expectedCollisionProofs.length, 26);
  for (const proof of artifact.expectedCollisionProofs) {
    assert.equal(proof.path.length, 8, proof.index);
    assert.equal(
      verifyRepresentationAuditMerkleProof(
        proof.auditRecordCommitmentSha256,
        Number(proof.index),
        proof.path,
        artifact.summary.auditRecordMerkleRootSha256,
      ),
      true,
      proof.index,
    );
  }
});

test("index, sibling, side, and record mutations invalidate inclusion", () => {
  const commitments = artifact.records.map((record) => record.auditRecordCommitmentSha256);
  const proof = artifact.expectedCollisionProofs[7];
  assert.deepEqual(
    representationAuditMerkleProof(commitments, Number(proof.index)),
    proof.path,
  );
  const changedSibling = structuredClone(proof.path);
  changedSibling[3].siblingSha256 = "f".repeat(64);
  assert.equal(verifyRepresentationAuditMerkleProof(
    proof.auditRecordCommitmentSha256,
    Number(proof.index),
    changedSibling,
    artifact.summary.auditRecordMerkleRootSha256,
  ), false);
  const changedSide = structuredClone(proof.path);
  changedSide[0].side = changedSide[0].side === "LEFT" ? "RIGHT" : "LEFT";
  assert.equal(verifyRepresentationAuditMerkleProof(
    proof.auditRecordCommitmentSha256,
    Number(proof.index),
    changedSide,
    artifact.summary.auditRecordMerkleRootSha256,
  ), false);
  assert.equal(verifyRepresentationAuditMerkleProof(
    proof.auditRecordCommitmentSha256,
    Number(proof.index) + 1,
    proof.path,
    artifact.summary.auditRecordMerkleRootSha256,
  ), false);
  assert.equal(verifyRepresentationAuditMerkleProof(
    "e".repeat(64),
    Number(proof.index),
    proof.path,
    artifact.summary.auditRecordMerkleRootSha256,
  ), false);
});

test("the 84-node multiproof is minimal and equivalent to 26 individual paths", () => {
  const commitments = artifact.records.map((record) => record.auditRecordCommitmentSha256);
  const selected = artifact.expectedCollisionProofs.map((proof) => ({
    index: Number(proof.index),
    recordCommitmentSha256: proof.auditRecordCommitmentSha256,
  }));
  const multiproof = artifact.expectedCollisionMultiproof;
  assert.deepEqual(
    representationAuditMerkleMultiproof(commitments, selected.map((record) => record.index)),
    multiproof.proofNodes,
  );
  assert.equal(multiproof.proofNodes.length, 84);
  assert.equal(multiproof.treeLeafCount, "256");
  assert.equal(multiproof.treeLeafCount, artifact.summary.caseCount);
  assert.equal(artifact.merkleContract.multiproofRequiresExactTreeLeafCount, true);
  assert.equal(artifact.expectedCollisionProofs.reduce((total, proof) => total + proof.path.length, 0), 208);
  assert.equal(208 - multiproof.proofNodes.length, 124);
  assert.equal(new Set(multiproof.proofNodes.map((node) => `${node.level}:${node.index}`)).size, 84);
  assert.equal(verifyRepresentationAuditMerkleMultiproof(
    selected,
    commitments.length,
    multiproof.proofNodes,
    artifact.summary.auditRecordMerkleRootSha256,
  ), true);
  assert.equal(multiproof.minimalNodeSet, true);
  assert.equal(multiproof.equivalentToIndividualProofs, true);
  assert.equal(multiproof.inputOrResultStored, false);
  assert.equal(multiproof.accepted, false);
  assert.equal(multiproof.receiptIssued, false);
  assert.equal(multiproof.reviewCompleted, false);
  assert.equal(multiproof.activationAuthorized, false);
  assert.equal(multiproof.activationEffect, "NONE");
});

test("missing, redundant, reordered, changed, and disconnected multiproof nodes fail", () => {
  const selected = artifact.expectedCollisionProofs.map((proof) => ({
    index: Number(proof.index),
    recordCommitmentSha256: proof.auditRecordCommitmentSha256,
  }));
  const root = artifact.summary.auditRecordMerkleRootSha256;
  const nodes = artifact.expectedCollisionMultiproof.proofNodes;
  const verify = (candidateNodes, candidateRecords = selected) =>
    verifyRepresentationAuditMerkleMultiproof(candidateRecords, 256, candidateNodes, root);
  assert.equal(verify(nodes.slice(0, -1)), false);
  assert.equal(verify([...nodes, nodes.at(-1)]), false);
  const reordered = structuredClone(nodes);
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.equal(verify(reordered), false);
  const changed = structuredClone(nodes);
  changed[19].sha256 = "f".repeat(64);
  assert.equal(verify(changed), false);
  const disconnected = structuredClone(nodes);
  disconnected[6].index = String(Number(disconnected[6].index) + 2);
  assert.equal(verify(disconnected), false);
  assert.equal(verify(nodes, selected.slice(1)), false);
});

test("96 deterministic varied subsets preserve exact minimal coordinates and individual-path equivalence", () => {
  const commitments = artifact.records.map((record) => record.auditRecordCommitmentSha256);
  const subsets = deterministicMultiproofPropertySubsets(commitments.length);
  assert.equal(subsets.length, MULTIPROOF_PROPERTY_CASE_COUNT);
  assert.equal(new Set(subsets.map((indices) => JSON.stringify(indices))).size, subsets.length);
  assert.equal(subsets.reduce((total, indices) => total + indices.length, 0), 10_579);
  assert.equal(
    createHash("sha256").update(JSON.stringify(subsets), "utf8").digest("hex"),
    MULTIPROOF_PROPERTY_SET_COMMITMENT_SHA256,
  );
  let aggregateIndividualNodeCount = 0;
  let aggregateMultiproofNodeCount = 0;
  for (const [caseIndex, indices] of subsets.entries()) {
    const proofNodes = representationAuditMerkleMultiproof(commitments, indices);
    const expectedCoordinates = independentMinimalMultiproofCoordinates(commitments.length, indices);
    assert.deepEqual(
      proofNodes.map((node) => `${node.level}:${node.index}`),
      expectedCoordinates,
      `case ${caseIndex}`,
    );
    assert.deepEqual(
      representationAuditMerkleMultiproof(commitments, [...indices].reverse()),
      proofNodes,
      `case ${caseIndex} reverse construction`,
    );
    const selected = indices.map((index) => ({
      index,
      recordCommitmentSha256: commitments[index],
    }));
    assert.equal(verifyRepresentationAuditMerkleMultiproof(
      selected,
      commitments.length,
      proofNodes,
      artifact.summary.auditRecordMerkleRootSha256,
    ), true, `case ${caseIndex}`);
    assert.equal(verifyRepresentationAuditMerkleMultiproof(
      [...selected].reverse(),
      commitments.length,
      proofNodes,
      artifact.summary.auditRecordMerkleRootSha256,
    ), true, `case ${caseIndex} reverse verification`);
    for (const record of selected) {
      const path = representationAuditMerkleProof(commitments, record.index);
      assert.equal(path.length, 8, `case ${caseIndex} index ${record.index}`);
      assert.equal(verifyRepresentationAuditMerkleProof(
        record.recordCommitmentSha256,
        record.index,
        path,
        artifact.summary.auditRecordMerkleRootSha256,
      ), true, `case ${caseIndex} index ${record.index}`);
    }
    aggregateIndividualNodeCount += selected.length * 8;
    aggregateMultiproofNodeCount += proofNodes.length;
    assert.ok(proofNodes.length <= selected.length * 8, `case ${caseIndex}`);
  }
  assert.equal(aggregateIndividualNodeCount, 84_632);
  assert.equal(aggregateMultiproofNodeCount, 6_554);
  assert.equal(aggregateIndividualNodeCount - aggregateMultiproofNodeCount, 78_078);
});

test("varied subsets reject nonminimal nodes, membership drift, bad roots, and invalid indices", () => {
  const commitments = artifact.records.map((record) => record.auditRecordCommitmentSha256);
  const root = artifact.summary.auditRecordMerkleRootSha256;
  const subsets = deterministicMultiproofPropertySubsets(commitments.length);
  for (const [caseIndex, indices] of subsets.entries()) {
    const nodes = representationAuditMerkleMultiproof(commitments, indices);
    const selected = indices.map((index) => ({
      index,
      recordCommitmentSha256: commitments[index],
    }));
    const verify = (candidateRecords, candidateNodes, totalLeafCount = commitments.length, expectedRoot = root) =>
      verifyRepresentationAuditMerkleMultiproof(
        candidateRecords,
        totalLeafCount,
        candidateNodes,
        expectedRoot,
      );
    assert.equal(verify(selected, nodes, commitments.length, "f".repeat(64)), false, `case ${caseIndex} root`);
    assert.equal(verify([...selected, selected[0]], nodes), false, `case ${caseIndex} duplicate member`);
    assert.equal(verify([
      ...selected.slice(0, -1),
      { index: commitments.length, recordCommitmentSha256: selected.at(-1).recordCommitmentSha256 },
    ], nodes), false, `case ${caseIndex} out-of-range member`);
    assert.equal(verify(selected.slice(1), nodes), false, `case ${caseIndex} missing member`);
    if (nodes.length > 0) {
      assert.equal(verify(selected, nodes.slice(0, -1)), false, `case ${caseIndex} missing node`);
      assert.equal(verify(selected, [...nodes, nodes.at(-1)]), false, `case ${caseIndex} redundant node`);
      const changed = structuredClone(nodes);
      changed[Math.floor(changed.length / 2)].sha256 = "e".repeat(64);
      assert.equal(verify(selected, changed), false, `case ${caseIndex} changed node`);
    }
    if (nodes.length > 1) {
      const reordered = structuredClone(nodes);
      [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
      assert.equal(verify(selected, reordered), false, `case ${caseIndex} reordered nodes`);
    }
  }
});

test("odd-width trees preserve minimal coordinates, duplicate-final-node semantics, and root parity", () => {
  const cases = syntheticOddWidthPropertyCases();
  assert.equal(cases.length, 79);
  assert.equal(new Set(cases.map((propertyCase) => propertyCase.leafCount)).size, 15);
  assert.equal(
    createHash("sha256").update(JSON.stringify(cases), "utf8").digest("hex"),
    ODD_WIDTH_PROPERTY_SET_COMMITMENT_SHA256,
  );
  let selectedRecordCount = 0;
  let aggregateIndividualNodeCount = 0;
  let aggregateMultiproofNodeCount = 0;
  for (const [caseIndex, propertyCase] of cases.entries()) {
    const { leafCount, indices } = propertyCase;
    const commitments = syntheticRecordCommitments(leafCount);
    const root = representationAuditMerkleRootSha256(commitments);
    assert.equal(root, independentRepresentationRoot(commitments), `case ${caseIndex} root`);
    const nodes = representationAuditMerkleMultiproof(commitments, indices);
    assert.deepEqual(
      nodes.map((node) => `${node.level}:${node.index}`),
      independentMinimalMultiproofCoordinates(leafCount, indices),
      `case ${caseIndex} coordinates`,
    );
    const selected = indices.map((index) => ({
      index,
      recordCommitmentSha256: commitments[index],
    }));
    assert.equal(verifyRepresentationAuditMerkleMultiproof(
      selected,
      leafCount,
      nodes,
      root,
    ), true, `case ${caseIndex} multiproof`);
    assert.equal(verifyRepresentationAuditMerkleMultiproof(
      [...selected].reverse(),
      leafCount,
      nodes,
      root,
    ), true, `case ${caseIndex} reverse`);
    if (indices.length === 1 && indices[0] === leafCount - 1) {
      assert.ok(!nodes.some((node) => node.level === "0" && node.index === String(leafCount)));
    }
    for (const record of selected) {
      const path = representationAuditMerkleProof(commitments, record.index);
      assert.equal(verifyRepresentationAuditMerkleProof(
        record.recordCommitmentSha256,
        record.index,
        path,
        root,
      ), true, `case ${caseIndex} index ${record.index}`);
      aggregateIndividualNodeCount += path.length;
    }
    selectedRecordCount += selected.length;
    aggregateMultiproofNodeCount += nodes.length;
  }
  assert.equal(selectedRecordCount, 2_893);
  assert.equal(aggregateIndividualNodeCount, 21_873);
  assert.equal(aggregateMultiproofNodeCount, 908);
  assert.equal(aggregateIndividualNodeCount - aggregateMultiproofNodeCount, 20_965);
  assert.deepEqual(
    representationAuditOddWidthPropertySummary(),
    artifact.oddWidthMultiproofProperties,
  );
});

test("odd-width multiproofs bind width externally and reject membership, coordinate, digest, and node-set drift", () => {
  const cases = syntheticOddWidthPropertyCases();
  let duplicateFinalWidthAliasCount = 0;
  for (const [caseIndex, propertyCase] of cases.entries()) {
    const { leafCount, indices } = propertyCase;
    const commitments = syntheticRecordCommitments(leafCount);
    const root = representationAuditMerkleRootSha256(commitments);
    const nodes = representationAuditMerkleMultiproof(commitments, indices);
    const selected = indices.map((index) => ({
      index,
      recordCommitmentSha256: commitments[index],
    }));
    const verify = (candidateRecords, candidateNodes, width = leafCount, expectedRoot = root) =>
      verifyRepresentationAuditMerkleMultiproof(candidateRecords, width, candidateNodes, expectedRoot);
    if (verify(selected, nodes, leafCount + 1)) duplicateFinalWidthAliasCount += 1;
    assert.notEqual(
      createHash("sha256").update(JSON.stringify({ treeLeafCount: leafCount, root }), "utf8").digest("hex"),
      createHash("sha256").update(JSON.stringify({ treeLeafCount: leafCount + 1, root }), "utf8").digest("hex"),
      `case ${caseIndex} external width binding`,
    );
    assert.equal(verify(selected, nodes, leafCount, "f".repeat(64)), false, `case ${caseIndex} root`);
    assert.equal(verify([...selected, selected[0]], nodes), false, `case ${caseIndex} duplicate member`);
    assert.equal(verify(selected.slice(1), nodes), false, `case ${caseIndex} missing member`);
    const outOfRange = structuredClone(selected);
    outOfRange.at(-1).index = leafCount;
    assert.equal(verify(outOfRange, nodes), false, `case ${caseIndex} out-of-range member`);
    assert.equal(verify(selected, [
      ...nodes,
      { level: "0", index: "0", sha256: "e".repeat(64) },
    ]), false, `case ${caseIndex} redundant node`);
    if (nodes.length > 0) {
      assert.equal(verify(selected, nodes.slice(0, -1)), false, `case ${caseIndex} missing node`);
      const changedDigest = structuredClone(nodes);
      changedDigest[Math.floor(changedDigest.length / 2)].sha256 = "d".repeat(64);
      assert.equal(verify(selected, changedDigest), false, `case ${caseIndex} changed digest`);
      const changedCoordinate = structuredClone(nodes);
      changedCoordinate[0].index = String(Number(changedCoordinate[0].index) + 1);
      assert.equal(verify(selected, changedCoordinate), false, `case ${caseIndex} changed coordinate`);
    }
  }
  assert.equal(duplicateFinalWidthAliasCount, 18);
  assert.equal(verifyRepresentationAuditMerkleMultiproof([], 0, [], "f".repeat(64)), false);
});

test("237 tree leaf-count boundaries accept only exact counts despite duplicate-final aliases", () => {
  const cases = syntheticOddWidthPropertyCases();
  const roots = [];
  const committedTreeLeafCounts = [];
  const outcomes = [];
  let duplicateFinalRootAliasTreeCount = 0;
  for (const leafCount of [...new Set(cases.map((propertyCase) => propertyCase.leafCount))]) {
    const commitments = syntheticRecordCommitments(leafCount);
    const root = independentRepresentationRoot(commitments);
    const explicitlyPaddedRoot = independentRepresentationRoot([...commitments, commitments.at(-1)]);
    if (root === explicitlyPaddedRoot) duplicateFinalRootAliasTreeCount += 1;
  }
  for (const [caseIndex, propertyCase] of cases.entries()) {
    const commitments = syntheticRecordCommitments(propertyCase.leafCount);
    const root = independentRepresentationRoot(commitments);
    const nodes = representationAuditMerkleMultiproof(commitments, propertyCase.indices);
    const selected = propertyCase.indices.map((index) => ({
      index,
      recordCommitmentSha256: commitments[index],
    }));
    roots.push(root);
    committedTreeLeafCounts.push(String(propertyCase.leafCount));
    for (const [relation, candidateTreeLeafCount] of [
      ["BELOW", propertyCase.leafCount - 1],
      ["EXACT", propertyCase.leafCount],
      ["ABOVE", propertyCase.leafCount + 1],
    ]) {
      const rawMultiproofAccepted = verifyRepresentationAuditMerkleMultiproof(
        selected,
        candidateTreeLeafCount,
        nodes,
        root,
      );
      const exactTreeLeafCountAccepted =
        verifyRepresentationAuditMerkleMultiproofWithExactTreeLeafCount(
          selected,
          candidateTreeLeafCount,
          propertyCase.leafCount,
          nodes,
          root,
        );
      assert.equal(exactTreeLeafCountAccepted, relation === "EXACT", `${caseIndex}:${relation}`);
      outcomes.push({
        caseIndex: String(caseIndex),
        relation,
        candidateTreeLeafCount: String(candidateTreeLeafCount),
        rawMultiproofAccepted,
        exactTreeLeafCountAccepted,
      });
    }
  }
  assert.equal(outcomes.length, 237);
  assert.equal(outcomes.filter((outcome) => outcome.relation === "EXACT"
    && outcome.exactTreeLeafCountAccepted).length, 79);
  assert.equal(outcomes.filter((outcome) => outcome.relation !== "EXACT"
    && !outcome.exactTreeLeafCountAccepted).length, 158);
  assert.equal(outcomes.filter((outcome) => outcome.relation !== "EXACT"
    && outcome.rawMultiproofAccepted).length, 20);
  assert.equal(outcomes.filter((outcome) => outcome.relation === "BELOW"
    && outcome.rawMultiproofAccepted).length, 2);
  assert.equal(outcomes.filter((outcome) => outcome.relation === "ABOVE"
    && outcome.rawMultiproofAccepted).length, 18);
  assert.equal(duplicateFinalRootAliasTreeCount, 14);
  assert.equal(
    createHash("sha256").update(JSON.stringify(roots), "utf8").digest("hex"),
    "8662b7f1e1b87dc81d648cefb9fcd847821346ee304792d3b5ce42b32a362d1e",
  );
  assert.equal(
    createHash("sha256").update(JSON.stringify(committedTreeLeafCounts), "utf8").digest("hex"),
    "759111eb0bb4d9848edc2e3d556093ad98cdd1682bbc5d8c110648c8331738df",
  );
  assert.equal(
    createHash("sha256").update(JSON.stringify(outcomes), "utf8").digest("hex"),
    "72c8cbf74755b88862b57d58d15a63189740cb5b4d65b3c8324f8bd1eea219d9",
  );
  assert.deepEqual(
    representationAuditTreeLeafCountBoundarySummary(),
    artifact.treeLeafCountBoundaryProperties,
  );
  assert.equal(artifact.treeLeafCountBoundaryProperties.rootAndTreeLeafCountCommitmentsSeparate, true);
  assert.equal(artifact.treeLeafCountBoundaryProperties.expandedCasesStored, false);
});

test("Python independently reproduces the representation audit", () => {
  assert.ok(PYTHON, "Python 3 is required for representation verification");
  const result = runPython();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    valid: true,
    errors: [],
    caseCount: 256,
    canonicalUniqueCount: 231,
    orderedUniqueCount: 256,
    expectedCanonicalCollisionClassCount: 1,
    nodeAndPythonMatchExactly: true,
    allRejected: true,
    auditRecordSetCommitmentSha256: artifact.summary.auditRecordSetCommitmentSha256,
    auditRecordMerkleRootSha256: artifact.summary.auditRecordMerkleRootSha256,
    expectedCollisionProofCount: 26,
    expectedCollisionProofSetCommitmentSha256:
      artifact.summary.expectedCollisionProofSetCommitmentSha256,
    expectedCollisionMultiproofNodeCount: 84,
    expectedCollisionIndividualProofNodeCount: 208,
    expectedCollisionMultiproofSavedNodeCount: 124,
    expectedCollisionMultiproofCommitmentSha256:
      artifact.summary.expectedCollisionMultiproofCommitmentSha256,
    oddWidthMultiproofPropertyCaseCount: 79,
    oddWidthMultiproofPropertyTreeCount: 15,
    oddWidthMultiproofPropertySetCommitmentSha256:
      artifact.oddWidthMultiproofProperties.caseSetCommitmentSha256,
    oddWidthExactTreeLeafCountRequired: true,
    oddWidthExpandedCasesStored: false,
    treeLeafCountBoundaryMutationCount: 237,
    treeLeafCountBoundaryExactAcceptedCount: 79,
    treeLeafCountBoundaryMismatchRejectedCount: 158,
    treeLeafCountBoundaryRawAliasAcceptedCount: 20,
    treeLeafCountBoundaryRootSetCommitmentSha256:
      artifact.treeLeafCountBoundaryProperties.rootSetCommitmentSha256,
    treeLeafCountBoundaryCountSetCommitmentSha256:
      artifact.treeLeafCountBoundaryProperties.committedTreeLeafCountSetCommitmentSha256,
    treeLeafCountBoundaryOutcomeSetCommitmentSha256:
      artifact.treeLeafCountBoundaryProperties.boundaryOutcomeSetCommitmentSha256,
    treeLeafCountBoundaryCommitmentsSeparate: true,
    treeLeafCountBoundaryExpandedCasesStored: false,
    receiptIssued: false,
    reviewCompleted: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  });
});

test("Python rejects changed compact evidence and a stale set commitment", () => {
  assert.ok(PYTHON, "Python 3 is required for representation verification");
  const directory = mkdtempSync(join(tmpdir(), "iat-representation-audit-"));
  try {
    const changedRecord = structuredClone(artifact);
    changedRecord.records[87].orderedInputSha256 = "f".repeat(64);
    const recordPath = join(directory, "changed-record.json");
    writeFileSync(recordPath, `${JSON.stringify(changedRecord, null, 2)}\n`, "utf8");
    const recordResult = runPython(recordPath);
    assert.equal(recordResult.status, 2, recordResult.stderr || recordResult.stdout);
    assert.ok(JSON.parse(recordResult.stdout).errors.some((error) => error.includes("independently replay")));

    const changedSet = structuredClone(artifact);
    changedSet.summary.auditRecordSetCommitmentSha256 = "e".repeat(64);
    const setPath = join(directory, "changed-set.json");
    writeFileSync(setPath, `${JSON.stringify(changedSet, null, 2)}\n`, "utf8");
    const setResult = runPython(setPath);
    assert.equal(setResult.status, 2, setResult.stderr || setResult.stdout);
    assert.ok(JSON.parse(setResult.stdout).errors.includes("representation record-set commitment drift"));

    const changedMultiproof = structuredClone(artifact);
    changedMultiproof.expectedCollisionMultiproof.proofNodes[12].sha256 = "d".repeat(64);
    const multiproofPath = join(directory, "changed-multiproof.json");
    writeFileSync(multiproofPath, `${JSON.stringify(changedMultiproof, null, 2)}\n`, "utf8");
    const multiproofResult = runPython(multiproofPath);
    assert.equal(multiproofResult.status, 2, multiproofResult.stderr || multiproofResult.stdout);
    assert.ok(JSON.parse(multiproofResult.stdout).errors.includes(
      "representation multiproof does not independently replay",
    ));

    const changedOddWidth = structuredClone(artifact);
    changedOddWidth.oddWidthMultiproofProperties.caseSetCommitmentSha256 = "c".repeat(64);
    changedOddWidth.treeLeafCountBoundaryProperties
      .committedTreeLeafCountSetCommitmentSha256 = "b".repeat(64);
    const oddWidthPath = join(directory, "changed-odd-width-properties.json");
    writeFileSync(oddWidthPath, `${JSON.stringify(changedOddWidth, null, 2)}\n`, "utf8");
    const oddWidthResult = runPython(oddWidthPath);
    assert.equal(oddWidthResult.status, 2, oddWidthResult.stderr || oddWidthResult.stdout);
    assert.ok(JSON.parse(oddWidthResult.stdout).errors.includes(
      "representation odd-width properties do not independently replay",
    ));
    assert.ok(JSON.parse(oddWidthResult.stdout).errors.includes(
      "representation tree leaf-count boundaries do not independently replay",
    ));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("representation tooling is offline, powerless, and review-manifest bound", () => {
  const sources = `${readFileSync(GENERATOR, "utf8")}\n${bundle.pythonVerifierSource}`;
  assert.doesNotMatch(sources, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  const expectedRoles = {
    "POSITIVE_CAMPAIGN_VECTOR_REPRESENTATION_AUDIT.md": "ARTIFACT",
    "generate-positive-campaign-vector-representation-audit.mjs": "GENERATOR",
    "positive-campaign-vector-representation-audit.v1.json": "ARTIFACT",
    "tests/positive-campaign-vector-representation-audit.test.mjs": "TEST",
    "validate-positive-campaign-vector-representation-audit.mjs": "VALIDATOR",
  };
  const roles = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expectedRoles, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(roles, expectedRoles);
});
