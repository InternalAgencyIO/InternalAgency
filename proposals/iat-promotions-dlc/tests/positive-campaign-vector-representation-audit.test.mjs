/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  verifyRepresentationAuditMerkleMultiproof,
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

function runPython(path = null) {
  const args = [PYTHON_VERIFIER, "--verify-representation-audit", "--format", "json"];
  if (path !== null) args.push("--representation-audit", path);
  return spawnSync(PYTHON, args, pythonOptions);
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
