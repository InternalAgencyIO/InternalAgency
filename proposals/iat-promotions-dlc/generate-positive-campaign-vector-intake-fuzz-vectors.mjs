/**
 * Seeded, compact, cross-runtime fuzz corpus for positive-vector intake.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Every generated case is rejection-only. This module creates no key,
 * signature, receipt, review decision, deployment, wallet request, or
 * activation effect.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
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
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const OUTPUT_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-fuzz-vectors.v1.json", import.meta.url),
);

export const FUZZ_SEED = 0x49544154;
export const FUZZ_CASE_COUNT = 256;
export const FUZZ_FAMILIES = [
  "CLOSED_SCHEMA",
  "EXPECTED_TARGET",
  "PRIVATE_MATERIAL_EXCLUSION",
  "EXTERNAL_PROVENANCE",
  "CANONICAL_MESSAGE_BINDING",
  "PUBLIC_KEY_BINDING",
  "INDEPENDENT_VECTOR_REVIEW",
  "NON_AUTHORITY",
  "CRYPTOGRAPHIC_SIGNATURE",
  "CRYPTOGRAPHIC_GUARD",
];
export const GATE_ORDER = [
  "CLOSED_SCHEMA",
  "EXPECTED_TARGET",
  "PRIVATE_MATERIAL_EXCLUSION",
  "EXTERNAL_PROVENANCE",
  "CANONICAL_MESSAGE_BINDING",
  "CRYPTOGRAPHIC_SIGNATURE",
  "INDEPENDENT_VECTOR_REVIEW",
  "NON_AUTHORITY",
];

const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const LEAF_DOMAIN = "iat-promotions-dlc-intake-fuzz-leaf-v1";
const NODE_DOMAIN = "iat-promotions-dlc-intake-fuzz-node-v1";
const DERIVATION_DOMAIN = "iat-promotions-dlc-intake-fuzz-v1";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest();
const sha256Hex = (bytes) => sha256(bytes).toString("hex");
const normalizedTextSha256 = (path) => sha256Hex(
  readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
);

export function xorshift32(value) {
  let state = value >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

function derivedHex(seedHex, index, wordHex, label) {
  return sha256Hex(`${DERIVATION_DOMAIN}\0${seedHex}\0${index}\0${wordHex}\0${label}`);
}

function factorial(value) {
  let product = 1;
  for (let factor = 2; factor <= value; factor += 1) product *= factor;
  return product;
}

function permuteObjectKeys(value, ordinal) {
  const remaining = Object.entries(value);
  const output = [];
  let rank = ordinal;
  while (remaining.length > 0) {
    const blockSize = factorial(remaining.length - 1);
    const selected = Math.floor(rank / blockSize) % remaining.length;
    rank %= blockSize;
    output.push(remaining.splice(selected, 1)[0]);
  }
  return Object.fromEntries(output);
}

function mutateSignature(base64, word) {
  const bytes = Buffer.from(base64, "base64");
  const byteIndex = (word >>> 8) % bytes.length;
  const xorMask = 1 + (word & 0xff) % 255;
  bytes[byteIndex] ^= xorMask;
  return { base64: bytes.toString("base64"), byteIndex, xorMask };
}

export function fuzzLeafSha256(caseCommitmentSha256) {
  const digest = Buffer.from(caseCommitmentSha256, "hex");
  if (digest.length !== 32) throw new Error("INVALID_FUZZ_CASE_COMMITMENT");
  return sha256(Buffer.concat([
    Buffer.from(LEAF_DOMAIN, "utf8"),
    Buffer.from([0]),
    digest,
  ])).toString("hex");
}

export function fuzzMerkleLevelsSha256(caseCommitments) {
  if (!Array.isArray(caseCommitments) || caseCommitments.length === 0) {
    throw new Error("FUZZ_TREE_EMPTY");
  }
  const levels = [caseCommitments.map(fuzzLeafSha256)];
  let level = levels[0].map((digest) => Buffer.from(digest, "hex"));
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(sha256(Buffer.concat([
        Buffer.from(NODE_DOMAIN, "utf8"),
        Buffer.from([0]),
        left,
        right,
      ])));
    }
    level = next;
    levels.push(level.map((digest) => digest.toString("hex")));
  }
  return levels;
}

export function fuzzMerkleRootSha256(caseCommitments) {
  return fuzzMerkleLevelsSha256(caseCommitments).at(-1)[0];
}

function mutateCase(baseCandidate, baseTarget, index, word) {
  const family = FUZZ_FAMILIES[index % FUZZ_FAMILIES.length];
  const wordHex = word.toString(16).padStart(8, "0");
  const seedHex = FUZZ_SEED.toString(16).padStart(8, "0");
  const candidate = structuredClone(baseCandidate);
  let expectedTarget = structuredClone(baseTarget);
  let mutation;

  switch (family) {
    case "CLOSED_SCHEMA": {
      const field = `fuzz_${wordHex}`;
      candidate[field] = false;
      mutation = { document: "candidate", operation: "add", path: `/${field}`, variant: wordHex };
      break;
    }
    case "EXPECTED_TARGET": {
      const permutationOrdinal = 1 + Math.floor(index / FUZZ_FAMILIES.length);
      expectedTarget = permuteObjectKeys(expectedTarget, permutationOrdinal);
      mutation = {
        document: "expectedTarget",
        operation: "permute-keys",
        path: "/",
        permutationOrdinal,
        variant: wordHex,
      };
      break;
    }
    case "PRIVATE_MATERIAL_EXCLUSION": {
      candidate.provenance.accessToken = `forbidden-fuzz-placeholder-${index}-${wordHex}`;
      mutation = { document: "candidate", operation: "add", path: "/provenance/accessToken", variant: wordHex };
      break;
    }
    case "EXTERNAL_PROVENANCE": {
      candidate.provenance.sourceArtifactSha256 = derivedHex(seedHex, index, wordHex, "provenance");
      mutation = { document: "candidate", operation: "replace", path: "/provenance/sourceArtifactSha256", variant: wordHex };
      break;
    }
    case "CANONICAL_MESSAGE_BINDING": {
      candidate.campaignVector.claimedCanonicalMessageSha256 = derivedHex(seedHex, index, wordHex, "canonical-message");
      mutation = { document: "candidate", operation: "replace", path: "/campaignVector/claimedCanonicalMessageSha256", variant: wordHex };
      break;
    }
    case "PUBLIC_KEY_BINDING": {
      candidate.campaignVector.publicKeyHex = derivedHex(seedHex, index, wordHex, "public-key-binding");
      mutation = { document: "candidate", operation: "replace", path: "/campaignVector/publicKeyHex", variant: wordHex };
      break;
    }
    case "INDEPENDENT_VECTOR_REVIEW": {
      const receiptSha256 = derivedHex(seedHex, index, wordHex, "review-receipt");
      candidate.review = {
        completed: true,
        decision: "APPROVE_VECTOR_ONLY",
        reviewerIdentityCommitmentSha256: derivedHex(seedHex, index, wordHex, "reviewer"),
        receiptSha256,
      };
      expectedTarget.reviewReceiptSha256 = receiptSha256;
      expectedTarget.positiveVectorAvailable = true;
      expectedTarget.positiveVectorReviewCompleted = true;
      mutation = { document: "candidate+expectedTarget", operation: "bind-review", path: "/review", variant: wordHex };
      break;
    }
    case "NON_AUTHORITY": {
      candidate.authority.activationEffect = `FUZZ_${wordHex}`;
      mutation = {
        document: "candidate",
        operation: "replace",
        path: "/authority/activationEffect",
        variant: wordHex,
      };
      break;
    }
    case "CRYPTOGRAPHIC_SIGNATURE": {
      const changed = mutateSignature(candidate.campaignVector.envelope.signatureBase64, word);
      candidate.campaignVector.envelope.signatureBase64 = changed.base64;
      candidate.campaignVector.signatureHex = Buffer.from(changed.base64, "base64").toString("hex");
      mutation = {
        document: "candidate",
        operation: "xor-signature-byte",
        path: "/campaignVector/envelope/signatureBase64",
        byteIndex: changed.byteIndex,
        xorMask: changed.xorMask,
        variant: wordHex,
      };
      break;
    }
    case "CRYPTOGRAPHIC_GUARD": {
      candidate.campaignVector.envelope.payload.nonce = `${candidate.campaignVector.envelope.payload.nonce}-${wordHex}`;
      mutation = { document: "candidate", operation: "append", path: "/campaignVector/envelope/payload/nonce", variant: wordHex };
      break;
    }
    default:
      throw new Error(`UNKNOWN_FUZZ_FAMILY:${family}`);
  }
  return { family, wordHex, candidate, expectedTarget, mutation };
}

export function replayPositiveCampaignVectorIntakeFuzzCase(index, baseVectors = null) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= FUZZ_CASE_COUNT) {
    throw new Error(`FUZZ_CASE_INDEX_OUT_OF_RANGE:${index}`);
  }
  const vectors = baseVectors ?? JSON.parse(readFileSync(BASE_VECTORS_PATH, "utf8"));
  const base = vectors.scenarios[0];
  let word = FUZZ_SEED;
  for (let cursor = 0; cursor <= index; cursor += 1) word = xorshift32(word);
  const mutated = mutateCase(base.candidate, base.expectedTarget, index, word);
  const result = evaluatePositiveCampaignVectorIntake(mutated.candidate, mutated.expectedTarget, {
    now: vectors.evaluationTime,
  });
  const passingGateIds = result.gates.filter((entry) => entry.result === "PASS").map((entry) => entry.id);
  const failingGateIds = result.gates.filter((entry) => entry.result === "FAIL").map((entry) => entry.id);
  const core = {
    index: String(index),
    name: `FUZZ_${String(index).padStart(3, "0")}_${mutated.family}_${mutated.wordHex}`,
    family: mutated.family,
    mutation: mutated.mutation,
    inputCommitmentSha256: canonicalSha256({
      candidate: mutated.candidate,
      expectedTarget: mutated.expectedTarget,
    }),
    resultCommitmentSha256: canonicalSha256(result),
    structuralValid: result.structuralValid,
    verificationReason: result.verificationReason,
    passingGateIds,
    failingGateIds,
    expectedAccepted: false,
    expectedReceiptIssued: false,
    expectedReviewCompleted: false,
    expectedActivationAuthorized: false,
    expectedActivationEffect: "NONE",
  };
  return {
    candidate: mutated.candidate,
    expectedTarget: mutated.expectedTarget,
    result,
    record: { ...core, caseCommitmentSha256: canonicalSha256(core) },
  };
}

export function generatePositiveCampaignVectorIntakeFuzzVectors() {
  const baseVectors = JSON.parse(readFileSync(BASE_VECTORS_PATH, "utf8"));
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const cases = Array.from({ length: FUZZ_CASE_COUNT }, (_, index) =>
    replayPositiveCampaignVectorIntakeFuzzCase(index, baseVectors).record);
  if (cases.some((entry) => entry.failingGateIds.length === 0 || entry.expectedAccepted !== false)) {
    throw new Error("FUZZ_REJECTION_CONTRACT_FAILED");
  }
  const familyCounts = Object.fromEntries(FUZZ_FAMILIES.map((family) => [
    family,
    String(cases.filter((entry) => entry.family === family).length),
  ]));
  const caseCommitments = cases.map((entry) => entry.caseCommitmentSha256);
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-positive-campaign-vector-intake-fuzz-vectors-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      fuzzCorpusApplied: false,
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
      generator: {
        path: "generate-positive-campaign-vector-intake-fuzz-vectors.mjs",
        normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH),
      },
    },
    contract: {
      mode: "SEEDED_CROSS_RUNTIME_VERIFY_ONLY_REJECTION_ONLY",
      prng: "XORSHIFT32",
      seedHex: FUZZ_SEED.toString(16).padStart(8, "0"),
      mutationCount: FUZZ_CASE_COUNT,
      familyOrder: FUZZ_FAMILIES,
      familyCounts,
      gateOrder: GATE_ORDER,
      everyMutationRejected: true,
      nodeAndPythonMustMatchExactly: true,
      storesInputsOrFullResults: false,
      validPositiveCampaignVectorPublished: false,
      signingMaterialIncluded: false,
      createsKeys: false,
      createsSignatures: false,
      issuesReviewReceipts: false,
      completesReview: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    hashContract: {
      hash: "SHA-256",
      canonicalJson: "UTF-8 JSON with lexicographically sorted object keys and no insignificant whitespace",
      leafDomain: LEAF_DOMAIN,
      leafPreimage: "domain || 0x00 || rawCaseCommitmentSha256",
      nodeDomain: NODE_DOMAIN,
      nodePreimage: "domain || 0x00 || rawLeftSha256 || rawRightSha256",
      oddNode: "duplicate final node",
    },
    evaluationTime: baseVectors.evaluationTime,
    summary: {
      caseCount: String(cases.length),
      familyCounts,
      allRejected: true,
      caseCommitmentMerkleRootSha256: fuzzMerkleRootSha256(caseCommitments),
    },
    cases,
  };
}

export function renderPositiveCampaignVectorIntakeFuzzVectors() {
  return `${JSON.stringify(generatePositiveCampaignVectorIntakeFuzzVectors(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = renderPositiveCampaignVectorIntakeFuzzVectors();
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote 256 seeded rejection-only intake fuzz commitments; no key, signature, receipt, review, network, or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}
