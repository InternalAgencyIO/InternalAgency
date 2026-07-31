/**
 * Validator for the seeded positive-vector intake fuzz corpus.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  FUZZ_CASE_COUNT,
  FUZZ_FAMILIES,
  FUZZ_SEED,
  GATE_ORDER,
  fuzzMerkleRootSha256,
  generatePositiveCampaignVectorIntakeFuzzVectors,
  replayPositiveCampaignVectorIntakeFuzzCase,
} from "./generate-positive-campaign-vector-intake-fuzz-vectors.mjs";

const VECTOR_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-fuzz-vectors.v1.json", import.meta.url),
);
const GENERATOR_PATH = fileURLToPath(
  new URL("./generate-positive-campaign-vector-intake-fuzz-vectors.mjs", import.meta.url),
);
const PYTHON_VERIFIER_PATH = fileURLToPath(
  new URL("./verify-positive-campaign-vector-intake.py", import.meta.url),
);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const HEX_32 = /^[0-9a-f]{64}$/;

export function loadPositiveCampaignVectorIntakeFuzzBundle() {
  return {
    vectors: JSON.parse(readFileSync(VECTOR_PATH, "utf8")),
    generatorSource: readFileSync(GENERATOR_PATH, "utf8"),
    pythonVerifierSource: readFileSync(PYTHON_VERIFIER_PATH, "utf8"),
  };
}

export function validatePositiveCampaignVectorIntakeFuzzVectors(
  bundle = loadPositiveCampaignVectorIntakeFuzzBundle(),
) {
  const { vectors, generatorSource, pythonVerifierSource } = bundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(vectors?.vectorVersion === 1, "fuzz vector version drift");
  expect(
    vectors?.vectorId === "iat-promotions-dlc-positive-campaign-vector-intake-fuzz-vectors-v1",
    "fuzz vector ID drift",
  );
  expect(JSON.stringify(vectors?.status?.labels) === JSON.stringify(HOLD_LABELS), "fuzz HOLD labels drift");
  expect(vectors?.status?.network === "NONE", "fuzz vectors must remain network-free");
  expect(vectors?.status?.programId === null, "fuzz vectors claim a program ID");
  expect(vectors?.status?.deployable === false, "fuzz vectors claim deployability");
  expect(vectors?.status?.fuzzCorpusApplied === false, "fuzz corpus claims application");
  expect(vectors?.status?.positiveVectorAvailable === false, "fuzz corpus claims a positive vector");
  expect(vectors?.status?.positiveVectorReviewCompleted === false, "fuzz corpus claims review completion");
  expect(vectors?.status?.positiveVectorIntegrationBlocked === true, "fuzz corpus released integration HOLD");
  expect(
    vectors?.contract?.mode === "SEEDED_CROSS_RUNTIME_VERIFY_ONLY_REJECTION_ONLY",
    "fuzz mode drift",
  );
  expect(vectors?.contract?.prng === "XORSHIFT32", "fuzz PRNG drift");
  expect(
    vectors?.contract?.seedHex === FUZZ_SEED.toString(16).padStart(8, "0"),
    "fuzz seed drift",
  );
  expect(vectors?.contract?.mutationCount === FUZZ_CASE_COUNT, "fuzz mutation count drift");
  expect(
    JSON.stringify(vectors?.contract?.familyOrder) === JSON.stringify(FUZZ_FAMILIES),
    "fuzz family order drift",
  );
  expect(
    JSON.stringify(vectors?.contract?.gateOrder) === JSON.stringify(GATE_ORDER),
    "fuzz gate order drift",
  );
  expect(vectors?.contract?.everyMutationRejected === true, "fuzz rejection contract drift");
  expect(vectors?.contract?.nodeAndPythonMustMatchExactly === true, "fuzz cross-runtime parity disabled");
  expect(vectors?.contract?.storesInputsOrFullResults === false, "fuzz corpus stores full inputs or results");
  for (const field of [
    "validPositiveCampaignVectorPublished",
    "signingMaterialIncluded",
    "createsKeys",
    "createsSignatures",
    "issuesReviewReceipts",
    "completesReview",
    "activationAuthorized",
  ]) {
    expect(vectors?.contract?.[field] === false, `fuzz contract ${field} drift`);
  }
  expect(vectors?.contract?.activationEffect === "NONE", "fuzz activation effect drift");
  expect(Array.isArray(vectors?.cases) && vectors.cases.length === FUZZ_CASE_COUNT, "fuzz case count drift");

  const names = new Set();
  const counts = Object.fromEntries(FUZZ_FAMILIES.map((family) => [family, 0]));
  for (let index = 0; index < (vectors?.cases?.length ?? 0); index += 1) {
    const record = vectors.cases[index];
    expect(record.index === String(index), `fuzz case index drift at ${index}`);
    expect(!names.has(record.name), `duplicate fuzz case ${record.name}`);
    names.add(record.name);
    expect(FUZZ_FAMILIES.includes(record.family), `${record.name} has unknown family`);
    if (Object.hasOwn(counts, record.family)) counts[record.family] += 1;
    expect(HEX_32.test(record.inputCommitmentSha256 ?? ""), `${record.name} input commitment drift`);
    expect(HEX_32.test(record.resultCommitmentSha256 ?? ""), `${record.name} result commitment drift`);
    expect(HEX_32.test(record.caseCommitmentSha256 ?? ""), `${record.name} case commitment drift`);
    expect(record.expectedAccepted === false, `${record.name} claims acceptance`);
    expect(record.expectedReceiptIssued === false, `${record.name} claims receipt issuance`);
    expect(record.expectedReviewCompleted === false, `${record.name} claims review completion`);
    expect(record.expectedActivationAuthorized === false, `${record.name} claims activation authority`);
    expect(record.expectedActivationEffect === "NONE", `${record.name} claims activation effect`);
    expect(Array.isArray(record.failingGateIds) && record.failingGateIds.length > 0, `${record.name} has no rejecting gate`);
    expect(
      [...record.passingGateIds, ...record.failingGateIds].every((id) => GATE_ORDER.includes(id)),
      `${record.name} has an unknown gate`,
    );
    const replay = replayPositiveCampaignVectorIntakeFuzzCase(index);
    expect(JSON.stringify(replay.record) === JSON.stringify(record), `${record.name} does not deterministically replay`);
    expect(replay.result.candidateSatisfiesIntakePolicy === false, `${record.name} satisfies intake policy`);
    expect(replay.result.positiveVectorAcceptedForSeparateReview === false, `${record.name} claims review acceptance`);
    expect(replay.result.receiptIssued === false, `${record.name} issues receipt`);
    expect(replay.result.reviewCompletedByThisEvaluator === false, `${record.name} completes review`);
    expect(replay.result.activationAuthorized === false, `${record.name} authorizes activation`);
    expect(replay.result.activationEffect === "NONE", `${record.name} creates activation effect`);
    expect(canonicalSha256(replay.result) === record.resultCommitmentSha256, `${record.name} result commitment mismatch`);
    if (record.family === "INDEPENDENT_VECTOR_REVIEW") {
      const reviewGate = replay.result.gates.find((entry) => entry.id === "INDEPENDENT_VECTOR_REVIEW");
      const cryptoGate = replay.result.gates.find((entry) => entry.id === "CRYPTOGRAPHIC_SIGNATURE");
      expect(reviewGate?.result === "PASS", `${record.name} does not isolate complete review binding`);
      expect(cryptoGate?.result === "FAIL", `${record.name} bypasses cryptographic rejection`);
    }
    if (record.family === "PRIVATE_MATERIAL_EXCLUSION") {
      expect(
        /^forbidden-fuzz-placeholder-\d+-[0-9a-f]{8}$/.test(replay.candidate.provenance.accessToken),
        `${record.name} private-field placeholder drift`,
      );
    }
  }
  const expectedCounts = Object.fromEntries(FUZZ_FAMILIES.map((family) => [
    family,
    String(counts[family]),
  ]));
  expect(JSON.stringify(vectors?.contract?.familyCounts) === JSON.stringify(expectedCounts), "fuzz contract family counts drift");
  expect(JSON.stringify(vectors?.summary?.familyCounts) === JSON.stringify(expectedCounts), "fuzz summary family counts drift");
  expect(vectors?.summary?.caseCount === String(FUZZ_CASE_COUNT), "fuzz summary case count drift");
  expect(vectors?.summary?.allRejected === true, "fuzz summary rejection drift");
  const root = fuzzMerkleRootSha256(vectors.cases.map((entry) => entry.caseCommitmentSha256));
  expect(vectors?.summary?.caseCommitmentMerkleRootSha256 === root, "fuzz Merkle root drift");
  expect(
    JSON.stringify(generatePositiveCampaignVectorIntakeFuzzVectors()) === JSON.stringify(vectors),
    "fuzz vectors do not deterministically regenerate",
  );
  const sources = `${generatorSource}\n${pythonVerifierSource}`;
  expect(!/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/.test(sources), "fuzz tooling can create keys or signatures");
  expect(!/\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/.test(sources), "fuzz tooling can use network or wallet capability");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validatePositiveCampaignVectorIntakeFuzzVectors();
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Seeded intake fuzz commitments reproduce in Node and remain rejection-only.");
  }
}
