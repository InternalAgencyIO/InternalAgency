/**
 * Validator for the compact 256-input representation-sensitivity audit.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { FUZZ_CASE_COUNT } from "./generate-positive-campaign-vector-intake-fuzz-vectors.mjs";
import {
  generatePositiveCampaignVectorRepresentationAudit,
  replayPositiveCampaignVectorRepresentationAudit,
  representationAuditLeafSha256,
  representationAuditMerkleRootSha256,
  verifyRepresentationAuditMerkleProof,
} from "./generate-positive-campaign-vector-representation-audit.mjs";

const ARTIFACT_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-representation-audit.v1.json", import.meta.url),
);
const GENERATOR_PATH = fileURLToPath(
  new URL("./generate-positive-campaign-vector-representation-audit.mjs", import.meta.url),
);
const PYTHON_VERIFIER_PATH = fileURLToPath(
  new URL("./verify-positive-campaign-vector-intake.py", import.meta.url),
);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const HEX_32 = /^[0-9a-f]{64}$/;

export function loadPositiveCampaignVectorRepresentationAuditBundle() {
  return {
    artifact: JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")),
    generatorSource: readFileSync(GENERATOR_PATH, "utf8"),
    pythonVerifierSource: readFileSync(PYTHON_VERIFIER_PATH, "utf8"),
  };
}

export function validatePositiveCampaignVectorRepresentationAudit(
  bundle = loadPositiveCampaignVectorRepresentationAuditBundle(),
) {
  const { artifact, generatorSource, pythonVerifierSource } = bundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(artifact?.auditVersion === 1, "representation audit version drift");
  expect(
    artifact?.auditId === "iat-promotions-dlc-positive-campaign-vector-representation-audit-v1",
    "representation audit ID drift",
  );
  expect(JSON.stringify(artifact?.status?.labels) === JSON.stringify(HOLD_LABELS), "representation HOLD labels drift");
  expect(artifact?.status?.network === "NONE", "representation audit must remain network-free");
  expect(artifact?.status?.programId === null, "representation audit claims a program ID");
  expect(artifact?.status?.deployable === false, "representation audit claims deployability");
  expect(artifact?.status?.auditApplied === false, "representation audit claims application");
  expect(artifact?.status?.positiveVectorAvailable === false, "representation audit claims a positive vector");
  expect(artifact?.status?.positiveVectorReviewCompleted === false, "representation audit claims review completion");
  expect(artifact?.status?.positiveVectorIntegrationBlocked === true, "representation audit releases integration HOLD");
  expect(
    artifact?.contract?.mode === "CROSS_RUNTIME_REPRESENTATION_AUDIT_REJECTION_ONLY",
    "representation mode drift",
  );
  expect(artifact?.contract?.caseCount === FUZZ_CASE_COUNT, "representation case count drift");
  expect(
    JSON.stringify(artifact?.contract?.expectedCanonicalCollisionFamilies) === JSON.stringify(["EXPECTED_TARGET"]),
    "representation expected collision family drift",
  );
  expect(artifact?.contract?.expectedCanonicalCollisionClassCount === 1, "representation collision class contract drift");
  expect(artifact?.contract?.expectedCanonicalCollisionCaseCount === 26, "representation collision case contract drift");
  expect(artifact?.contract?.orderedInputsMustBeUnique === true, "ordered-input uniqueness disabled");
  expect(artifact?.contract?.storesInputsOrFullResults === false, "representation audit stores full inputs or results");
  expect(artifact?.contract?.everyCaseRejected === true, "representation audit claims an accepted case");
  for (const field of [
    "validPositiveCampaignVectorPublished",
    "signingMaterialIncluded",
    "createsKeys",
    "createsSignatures",
    "issuesReviewReceipts",
    "completesReview",
    "activationAuthorized",
  ]) {
    expect(artifact?.contract?.[field] === false, `representation contract ${field} drift`);
  }
  expect(artifact?.contract?.activationEffect === "NONE", "representation activation effect drift");
  expect(artifact?.merkleContract?.hash === "SHA-256", "representation Merkle hash drift");
  expect(
    artifact?.merkleContract?.leafDomain === "iat-promotions-dlc-representation-audit-leaf-v1",
    "representation Merkle leaf domain drift",
  );
  expect(
    artifact?.merkleContract?.nodeDomain === "iat-promotions-dlc-representation-audit-node-v1",
    "representation Merkle node domain drift",
  );
  expect(artifact?.merkleContract?.ordering === "records in ascending numeric index order", "representation Merkle ordering drift");
  expect(artifact?.merkleContract?.oddNode === "duplicate final node", "representation odd-node contract drift");
  expect(artifact?.merkleContract?.proofFamily === "EXPECTED_TARGET", "representation proof family drift");
  expect(artifact?.merkleContract?.proofCount === 26, "representation proof count contract drift");
  expect(artifact?.merkleContract?.proofPathLength === 8, "representation proof path-length drift");
  expect(artifact?.merkleContract?.publishesProofsForAcceptedVectors === false, "representation proof contract claims accepted vectors");

  const replay = replayPositiveCampaignVectorRepresentationAudit();
  expect(Array.isArray(artifact?.records) && artifact.records.length === FUZZ_CASE_COUNT, "representation record count drift");
  expect(
    JSON.stringify(replay.records) === JSON.stringify(artifact?.records),
    "representation records do not deterministically replay",
  );
  expect(
    JSON.stringify(replay.canonicalCollisionClasses) === JSON.stringify(artifact?.canonicalCollisionClasses),
    "representation collision classes do not deterministically replay",
  );
  const ordered = new Set();
  const canonical = new Set();
  for (let index = 0; index < (artifact?.records?.length ?? 0); index += 1) {
    const record = artifact.records[index];
    expect(record.index === String(index), `representation index drift at ${index}`);
    expect(HEX_32.test(record.sourceCaseCommitmentSha256 ?? ""), `${record.sourceFuzzCaseName} source commitment drift`);
    expect(HEX_32.test(record.canonicalInputSha256 ?? ""), `${record.sourceFuzzCaseName} canonical commitment drift`);
    expect(HEX_32.test(record.orderedInputSha256 ?? ""), `${record.sourceFuzzCaseName} ordered commitment drift`);
    expect(HEX_32.test(record.auditRecordCommitmentSha256 ?? ""), `${record.sourceFuzzCaseName} record commitment drift`);
    expect(record.orderedClassSize === "1", `${record.sourceFuzzCaseName} ordered input is duplicated`);
    expect(record.orderedInputUnique === true, `${record.sourceFuzzCaseName} ordered uniqueness claim drift`);
    expect(record.inputOrResultStored === false, `${record.sourceFuzzCaseName} claims stored evidence`);
    expect(record.accepted === false, `${record.sourceFuzzCaseName} claims acceptance`);
    expect(record.receiptIssued === false, `${record.sourceFuzzCaseName} claims receipt issuance`);
    expect(record.reviewCompleted === false, `${record.sourceFuzzCaseName} claims review completion`);
    expect(record.activationAuthorized === false, `${record.sourceFuzzCaseName} claims activation authority`);
    expect(record.activationEffect === "NONE", `${record.sourceFuzzCaseName} claims activation effect`);
    expect(!ordered.has(record.orderedInputSha256), `${record.sourceFuzzCaseName} repeats ordered commitment`);
    ordered.add(record.orderedInputSha256);
    canonical.add(record.canonicalInputSha256);
    if (record.family === "EXPECTED_TARGET") {
      expect(record.canonicalCollisionExpected === true, `${record.sourceFuzzCaseName} hides expected canonical collision`);
      expect(record.canonicalClassSize === "26", `${record.sourceFuzzCaseName} collision class size drift`);
    } else {
      expect(record.canonicalCollisionExpected === false, `${record.sourceFuzzCaseName} claims unexpected collision`);
      expect(record.canonicalClassSize === "1", `${record.sourceFuzzCaseName} has unexpected canonical collision`);
    }
  }
  expect(artifact?.canonicalCollisionClasses?.length === 1, "representation collision class count drift");
  const collision = artifact?.canonicalCollisionClasses?.[0];
  expect(collision?.classSize === "26", "representation expected collision size drift");
  expect(JSON.stringify(collision?.families) === JSON.stringify(["EXPECTED_TARGET"]), "representation collision family drift");
  expect(collision?.orderedCommitmentsAllDistinct === true, "ordered commitments do not split canonical collision");
  expect(artifact?.summary?.caseCount === "256", "representation summary case count drift");
  expect(artifact?.summary?.canonicalUniqueCount === "231", "representation canonical unique count drift");
  expect(artifact?.summary?.orderedUniqueCount === "256", "representation ordered unique count drift");
  expect(artifact?.summary?.canonicalCollisionClassCount === "1", "representation summary collision class drift");
  expect(artifact?.summary?.canonicalCollisionCaseCount === "26", "representation summary collision case drift");
  expect(artifact?.summary?.unexpectedCanonicalCollisionCount === "0", "unexpected canonical collision reported");
  expect(artifact?.summary?.duplicateOrderedInputCount === "0", "duplicate ordered input reported");
  expect(artifact?.summary?.allRejected === true, "representation summary rejection drift");
  expect(canonical.size === 231, "representation calculated canonical unique count drift");
  expect(ordered.size === 256, "representation calculated ordered unique count drift");
  expect(
    artifact?.summary?.auditRecordSetCommitmentSha256 === canonicalSha256(
      artifact.records.map((record) => record.auditRecordCommitmentSha256),
    ),
    "representation record-set commitment drift",
  );
  const recordCommitments = artifact.records.map((record) => record.auditRecordCommitmentSha256);
  const merkleRoot = representationAuditMerkleRootSha256(recordCommitments);
  expect(artifact?.summary?.auditRecordMerkleRootSha256 === merkleRoot, "representation Merkle root drift");
  const proofs = artifact?.expectedCollisionProofs ?? [];
  expect(Array.isArray(proofs) && proofs.length === 26, "representation inclusion-proof count drift");
  expect(artifact?.summary?.expectedCollisionProofCount === "26", "representation proof summary count drift");
  const expectedProofIndices = artifact.records
    .filter((record) => record.family === "EXPECTED_TARGET")
    .map((record) => record.index);
  expect(
    JSON.stringify(proofs.map((proof) => proof.index)) === JSON.stringify(expectedProofIndices),
    "representation proofs do not cover exactly the expected collision class",
  );
  for (const proof of proofs) {
    const record = artifact.records[Number(proof.index)];
    expect(proof.family === "EXPECTED_TARGET", `${proof.sourceFuzzCaseName} proof family drift`);
    expect(proof.sourceFuzzCaseName === record?.sourceFuzzCaseName, `${proof.index} proof source drift`);
    expect(proof.auditRecordCommitmentSha256 === record?.auditRecordCommitmentSha256, `${proof.index} proof record drift`);
    expect(proof.leafSha256 === representationAuditLeafSha256(proof.auditRecordCommitmentSha256), `${proof.index} proof leaf drift`);
    expect(Array.isArray(proof.path) && proof.path.length === 8, `${proof.index} proof path-length drift`);
    expect(
      verifyRepresentationAuditMerkleProof(
        proof.auditRecordCommitmentSha256,
        Number(proof.index),
        proof.path,
        merkleRoot,
      ),
      `${proof.index} inclusion proof does not reach the published root`,
    );
    expect(proof.proofVerifiedToPublishedRoot === true, `${proof.index} proof verification claim drift`);
    expect(proof.inputOrResultStored === false, `${proof.index} proof claims stored evidence`);
    expect(proof.accepted === false, `${proof.index} proof claims acceptance`);
    expect(proof.receiptIssued === false, `${proof.index} proof claims receipt issuance`);
    expect(proof.reviewCompleted === false, `${proof.index} proof claims review completion`);
    expect(proof.activationAuthorized === false, `${proof.index} proof claims activation authority`);
    expect(proof.activationEffect === "NONE", `${proof.index} proof claims activation effect`);
    const { proofCommitmentSha256, ...proofCore } = proof;
    expect(proofCommitmentSha256 === canonicalSha256(proofCore), `${proof.index} proof commitment drift`);
  }
  expect(
    artifact?.summary?.expectedCollisionProofSetCommitmentSha256 === canonicalSha256(
      proofs.map((proof) => proof.proofCommitmentSha256),
    ),
    "representation proof-set commitment drift",
  );
  expect(
    JSON.stringify(generatePositiveCampaignVectorRepresentationAudit()) === JSON.stringify(artifact),
    "representation audit does not deterministically regenerate",
  );
  const sources = `${generatorSource}\n${pythonVerifierSource}`;
  expect(!/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/.test(sources), "representation tooling can create keys or signatures");
  expect(!/\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/.test(sources), "representation tooling can use network or wallet capability");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validatePositiveCampaignVectorRepresentationAudit();
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("The 256-input representation audit reproduces with only expected canonical collisions.");
  }
}
