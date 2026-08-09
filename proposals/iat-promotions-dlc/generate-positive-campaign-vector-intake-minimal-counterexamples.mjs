/**
 * Deterministic minimal counterexamples for every intake fuzz family.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * The fixtures are rejection-only and create no key, signature, receipt,
 * review decision, deployment, wallet request, or activation effect.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  FUZZ_FAMILIES,
  replayPositiveCampaignVectorIntakeFuzzCase,
} from "./generate-positive-campaign-vector-intake-fuzz-vectors.mjs";
import { evaluatePositiveCampaignVectorIntake } from "./positive-campaign-vector-intake.mjs";

const BASE_VECTORS_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-vectors.v1.json", import.meta.url),
);
const FUZZ_VECTORS_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-fuzz-vectors.v1.json", import.meta.url),
);
const SCHEMA_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake.schema.v1.json", import.meta.url),
);
const EVALUATOR_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake.mjs", import.meta.url),
);
const FUZZ_GENERATOR_PATH = fileURLToPath(
  new URL("./generate-positive-campaign-vector-intake-fuzz-vectors.mjs", import.meta.url),
);
const PYTHON_VERIFIER_PATH = fileURLToPath(
  new URL("./verify-positive-campaign-vector-intake.py", import.meta.url),
);
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const OUTPUT_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-minimal-counterexamples.v1.json", import.meta.url),
);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(
  readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
);
const orderedInputSha256 = (candidate, expectedTarget) => sha256Hex(
  JSON.stringify({ candidate, expectedTarget }),
);

const PRIMARY_GATES = {
  CLOSED_SCHEMA: "CLOSED_SCHEMA",
  EXPECTED_TARGET: "EXPECTED_TARGET",
  PRIVATE_MATERIAL_EXCLUSION: "PRIVATE_MATERIAL_EXCLUSION",
  EXTERNAL_PROVENANCE: "EXTERNAL_PROVENANCE",
  CANONICAL_MESSAGE_BINDING: "CANONICAL_MESSAGE_BINDING",
  PUBLIC_KEY_BINDING: "CANONICAL_MESSAGE_BINDING",
  INDEPENDENT_VECTOR_REVIEW: "INDEPENDENT_VECTOR_REVIEW",
  NON_AUTHORITY: "NON_AUTHORITY",
  CRYPTOGRAPHIC_SIGNATURE: "CRYPTOGRAPHIC_SIGNATURE",
  CRYPTOGRAPHIC_GUARD: "CRYPTOGRAPHIC_SIGNATURE",
};

function resultGate(result, gateId) {
  const entry = result.gates.find((gate) => gate.id === gateId);
  if (!entry) throw new Error(`MISSING_GATE:${gateId}`);
  return entry;
}

function differingGateIds(before, after) {
  return before.gates.filter((gate, index) =>
    gate.result !== after.gates[index].result || gate.detail !== after.gates[index].detail)
    .map((gate) => gate.id);
}

function buildInputs(family, index, baseVectors) {
  const base = baseVectors.scenarios[0];
  const fuzzReplay = replayPositiveCampaignVectorIntakeFuzzCase(index, baseVectors);
  let controlCandidate = structuredClone(base.candidate);
  let controlTarget = structuredClone(base.expectedTarget);
  let mutatedCandidate = structuredClone(fuzzReplay.candidate);
  let mutatedTarget = structuredClone(fuzzReplay.expectedTarget);
  let delta = structuredClone(fuzzReplay.record.mutation);
  let storageDeltaCount = family === "CRYPTOGRAPHIC_SIGNATURE" ? 2 : 1;
  let proofMode = "PASS_TO_FAIL_GATE";

  if (family === "EXTERNAL_PROVENANCE") {
    controlCandidate.provenance.campaignMessageWasSignedBySource = true;
    mutatedCandidate.provenance.campaignMessageWasSignedBySource = true;
  }
  if (family === "INDEPENDENT_VECTOR_REVIEW") {
    controlCandidate = structuredClone(fuzzReplay.candidate);
    controlTarget = structuredClone(fuzzReplay.expectedTarget);
    mutatedCandidate = structuredClone(controlCandidate);
    mutatedTarget = structuredClone(controlTarget);
    mutatedTarget.positiveVectorReviewCompleted = false;
    delta = {
      document: "expectedTarget",
      operation: "replace",
      path: "/positiveVectorReviewCompleted",
      from: true,
      to: false,
      variant: fuzzReplay.record.mutation.variant,
    };
  }
  if (family === "CRYPTOGRAPHIC_SIGNATURE") {
    proofMode = "REJECTION_PRESERVING_BYTE_DELTA";
  }
  if (family === "CRYPTOGRAPHIC_GUARD") {
    proofMode = "REJECTION_REASON_DELTA";
  }
  return {
    controlCandidate,
    controlTarget,
    mutatedCandidate,
    mutatedTarget,
    delta,
    storageDeltaCount,
    proofMode,
    sourceFuzzCaseName: fuzzReplay.record.name,
  };
}

export function replayPositiveCampaignVectorMinimalCounterexample(
  index,
  baseVectors = null,
) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= FUZZ_FAMILIES.length) {
    throw new Error(`MINIMAL_COUNTEREXAMPLE_INDEX_OUT_OF_RANGE:${index}`);
  }
  const vectors = baseVectors ?? JSON.parse(readFileSync(BASE_VECTORS_PATH, "utf8"));
  const family = FUZZ_FAMILIES[index];
  const inputs = buildInputs(family, index, vectors);
  const evaluate = (candidate, expectedTarget) => evaluatePositiveCampaignVectorIntake(
    candidate,
    expectedTarget,
    { now: vectors.evaluationTime },
  );
  const controlResult = evaluate(inputs.controlCandidate, inputs.controlTarget);
  const mutatedResult = evaluate(inputs.mutatedCandidate, inputs.mutatedTarget);
  const primaryGateId = PRIMARY_GATES[family];
  const controlGate = resultGate(controlResult, primaryGateId);
  const mutatedGate = resultGate(mutatedResult, primaryGateId);
  const core = {
    index: String(index),
    family,
    sourceFuzzCaseIndex: String(index),
    sourceFuzzCaseName: inputs.sourceFuzzCaseName,
    primaryGateId,
    proofMode: inputs.proofMode,
    delta: inputs.delta,
    semanticDeltaCount: "1",
    storageDeltaCount: String(inputs.storageDeltaCount),
    controlInputCanonicalSha256: canonicalSha256({
      candidate: inputs.controlCandidate,
      expectedTarget: inputs.controlTarget,
    }),
    mutatedInputCanonicalSha256: canonicalSha256({
      candidate: inputs.mutatedCandidate,
      expectedTarget: inputs.mutatedTarget,
    }),
    controlInputOrderedSha256: orderedInputSha256(inputs.controlCandidate, inputs.controlTarget),
    mutatedInputOrderedSha256: orderedInputSha256(inputs.mutatedCandidate, inputs.mutatedTarget),
    controlResultCommitmentSha256: canonicalSha256(controlResult),
    mutatedResultCommitmentSha256: canonicalSha256(mutatedResult),
    controlPrimaryGateResult: controlGate.result,
    mutatedPrimaryGateResult: mutatedGate.result,
    controlVerificationReason: controlResult.verificationReason,
    mutatedVerificationReason: mutatedResult.verificationReason,
    changedGateIds: differingGateIds(controlResult, mutatedResult),
    controlAccepted: false,
    mutatedAccepted: false,
    receiptIssued: false,
    reviewCompleted: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  };
  return {
    controlCandidate: inputs.controlCandidate,
    controlTarget: inputs.controlTarget,
    mutatedCandidate: inputs.mutatedCandidate,
    mutatedTarget: inputs.mutatedTarget,
    controlResult,
    mutatedResult,
    fixture: { ...core, fixtureCommitmentSha256: canonicalSha256(core) },
  };
}

export function generatePositiveCampaignVectorMinimalCounterexamples() {
  const baseVectors = JSON.parse(readFileSync(BASE_VECTORS_PATH, "utf8"));
  const fuzzVectors = JSON.parse(readFileSync(FUZZ_VECTORS_PATH, "utf8"));
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const fixtures = FUZZ_FAMILIES.map((_family, index) =>
    replayPositiveCampaignVectorMinimalCounterexample(index, baseVectors).fixture);
  const fixtureCommitments = fixtures.map((fixture) => fixture.fixtureCommitmentSha256);
  return {
    counterexampleVersion: 1,
    counterexampleId: "iat-promotions-dlc-positive-campaign-vector-minimal-counterexamples-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      counterexamplesApplied: false,
      positiveVectorAvailable: false,
      positiveVectorReviewCompleted: false,
      positiveVectorIntegrationBlocked: true,
    },
    sources: {
      baseVectors: {
        path: "positive-campaign-vector-intake-vectors.v1.json",
        canonicalSha256: canonicalSha256(baseVectors),
      },
      fuzzVectors: {
        path: "positive-campaign-vector-intake-fuzz-vectors.v1.json",
        canonicalSha256: canonicalSha256(fuzzVectors),
      },
      intakeSchema: {
        path: "positive-campaign-vector-intake.schema.v1.json",
        canonicalSha256: canonicalSha256(schema),
      },
      nodeEvaluator: {
        path: "positive-campaign-vector-intake.mjs",
        normalizedTextSha256: normalizedTextSha256(EVALUATOR_PATH),
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
        path: "generate-positive-campaign-vector-intake-minimal-counterexamples.mjs",
        normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH),
      },
    },
    contract: {
      mode: "CROSS_RUNTIME_MINIMAL_REJECTION_ONLY",
      familyOrder: FUZZ_FAMILIES,
      fixtureCount: fixtures.length,
      oneSemanticDeltaPerFixture: true,
      orderedCommitmentRequired: true,
      storesInputsOrFullResults: false,
      everyControlRejected: true,
      everyMutationRejected: true,
      validPositiveCampaignVectorPublished: false,
      signingMaterialIncluded: false,
      createsKeys: false,
      createsSignatures: false,
      issuesReviewReceipts: false,
      completesReview: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    evaluationTime: baseVectors.evaluationTime,
    summary: {
      fixtureCount: String(fixtures.length),
      fixtureSetCommitmentSha256: canonicalSha256(fixtureCommitments),
      allControlsRejected: true,
      allMutationsRejected: true,
    },
    fixtures,
  };
}

export function renderPositiveCampaignVectorMinimalCounterexamples() {
  return `${JSON.stringify(generatePositiveCampaignVectorMinimalCounterexamples(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = renderPositiveCampaignVectorMinimalCounterexamples();
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote ten rejection-only minimal counterexample commitments; no key, signature, receipt, review, network, or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}
