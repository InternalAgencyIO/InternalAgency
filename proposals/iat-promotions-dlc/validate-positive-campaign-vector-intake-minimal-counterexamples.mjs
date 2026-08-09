/**
 * Validator for deterministic intake-family minimal counterexamples.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { FUZZ_FAMILIES } from "./generate-positive-campaign-vector-intake-fuzz-vectors.mjs";
import {
  generatePositiveCampaignVectorMinimalCounterexamples,
  replayPositiveCampaignVectorMinimalCounterexample,
} from "./generate-positive-campaign-vector-intake-minimal-counterexamples.mjs";

const ARTIFACT_PATH = fileURLToPath(
  new URL("./positive-campaign-vector-intake-minimal-counterexamples.v1.json", import.meta.url),
);
const GENERATOR_PATH = fileURLToPath(
  new URL("./generate-positive-campaign-vector-intake-minimal-counterexamples.mjs", import.meta.url),
);
const PYTHON_VERIFIER_PATH = fileURLToPath(
  new URL("./verify-positive-campaign-vector-intake.py", import.meta.url),
);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const HEX_32 = /^[0-9a-f]{64}$/;

export function loadPositiveCampaignVectorMinimalCounterexampleBundle() {
  return {
    artifact: JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")),
    generatorSource: readFileSync(GENERATOR_PATH, "utf8"),
    pythonVerifierSource: readFileSync(PYTHON_VERIFIER_PATH, "utf8"),
  };
}

export function validatePositiveCampaignVectorMinimalCounterexamples(
  bundle = loadPositiveCampaignVectorMinimalCounterexampleBundle(),
) {
  const { artifact, generatorSource, pythonVerifierSource } = bundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(artifact?.counterexampleVersion === 1, "minimal counterexample version drift");
  expect(
    artifact?.counterexampleId === "iat-promotions-dlc-positive-campaign-vector-minimal-counterexamples-v1",
    "minimal counterexample ID drift",
  );
  expect(JSON.stringify(artifact?.status?.labels) === JSON.stringify(HOLD_LABELS), "minimal HOLD labels drift");
  expect(artifact?.status?.network === "NONE", "minimal counterexamples must remain network-free");
  expect(artifact?.status?.programId === null, "minimal counterexamples claim a program ID");
  expect(artifact?.status?.deployable === false, "minimal counterexamples claim deployability");
  expect(artifact?.status?.counterexamplesApplied === false, "minimal counterexamples claim application");
  expect(artifact?.status?.positiveVectorAvailable === false, "minimal counterexamples claim a positive vector");
  expect(artifact?.status?.positiveVectorReviewCompleted === false, "minimal counterexamples claim completed review");
  expect(artifact?.status?.positiveVectorIntegrationBlocked === true, "minimal counterexamples release integration HOLD");
  expect(artifact?.contract?.mode === "CROSS_RUNTIME_MINIMAL_REJECTION_ONLY", "minimal mode drift");
  expect(JSON.stringify(artifact?.contract?.familyOrder) === JSON.stringify(FUZZ_FAMILIES), "minimal family order drift");
  expect(artifact?.contract?.fixtureCount === FUZZ_FAMILIES.length, "minimal fixture count drift");
  expect(artifact?.contract?.oneSemanticDeltaPerFixture === true, "minimal single-delta contract drift");
  expect(artifact?.contract?.orderedCommitmentRequired === true, "ordered input commitment disabled");
  expect(artifact?.contract?.storesInputsOrFullResults === false, "minimal artifact stores full inputs or results");
  expect(artifact?.contract?.everyControlRejected === true, "minimal controls claim acceptance");
  expect(artifact?.contract?.everyMutationRejected === true, "minimal mutations claim acceptance");
  for (const field of [
    "validPositiveCampaignVectorPublished",
    "signingMaterialIncluded",
    "createsKeys",
    "createsSignatures",
    "issuesReviewReceipts",
    "completesReview",
    "activationAuthorized",
  ]) {
    expect(artifact?.contract?.[field] === false, `minimal contract ${field} drift`);
  }
  expect(artifact?.contract?.activationEffect === "NONE", "minimal activation effect drift");
  expect(Array.isArray(artifact?.fixtures) && artifact.fixtures.length === FUZZ_FAMILIES.length, "minimal fixture array drift");
  const names = new Set();
  for (let index = 0; index < (artifact?.fixtures?.length ?? 0); index += 1) {
    const fixture = artifact.fixtures[index];
    expect(fixture.index === String(index), `minimal index drift at ${index}`);
    expect(fixture.family === FUZZ_FAMILIES[index], `minimal family drift at ${index}`);
    expect(fixture.sourceFuzzCaseIndex === String(index), `${fixture.family} source index drift`);
    expect(!names.has(fixture.sourceFuzzCaseName), `${fixture.family} duplicate source case`);
    names.add(fixture.sourceFuzzCaseName);
    expect(fixture.semanticDeltaCount === "1", `${fixture.family} is not one semantic delta`);
    expect(["1", "2"].includes(fixture.storageDeltaCount), `${fixture.family} storage delta count drift`);
    for (const field of [
      "controlInputCanonicalSha256",
      "mutatedInputCanonicalSha256",
      "controlInputOrderedSha256",
      "mutatedInputOrderedSha256",
      "controlResultCommitmentSha256",
      "mutatedResultCommitmentSha256",
      "fixtureCommitmentSha256",
    ]) {
      expect(HEX_32.test(fixture[field] ?? ""), `${fixture.family} ${field} drift`);
    }
    expect(fixture.controlAccepted === false, `${fixture.family} control claims acceptance`);
    expect(fixture.mutatedAccepted === false, `${fixture.family} mutation claims acceptance`);
    expect(fixture.receiptIssued === false, `${fixture.family} claims receipt issuance`);
    expect(fixture.reviewCompleted === false, `${fixture.family} claims review completion`);
    expect(fixture.activationAuthorized === false, `${fixture.family} claims activation authority`);
    expect(fixture.activationEffect === "NONE", `${fixture.family} claims activation effect`);
    const replay = replayPositiveCampaignVectorMinimalCounterexample(index);
    expect(JSON.stringify(replay.fixture) === JSON.stringify(fixture), `${fixture.family} does not deterministically replay`);
    expect(replay.controlResult.candidateSatisfiesIntakePolicy === false, `${fixture.family} control satisfies intake policy`);
    expect(replay.mutatedResult.candidateSatisfiesIntakePolicy === false, `${fixture.family} mutation satisfies intake policy`);
    expect(replay.controlResult.receiptIssued === false && replay.mutatedResult.receiptIssued === false, `${fixture.family} issues a receipt`);
    expect(
      replay.controlResult.reviewCompletedByThisEvaluator === false &&
        replay.mutatedResult.reviewCompletedByThisEvaluator === false,
      `${fixture.family} completes review`,
    );
    expect(
      replay.controlResult.activationAuthorized === false && replay.mutatedResult.activationAuthorized === false,
      `${fixture.family} authorizes activation`,
    );
    if (!["CRYPTOGRAPHIC_SIGNATURE", "CRYPTOGRAPHIC_GUARD"].includes(fixture.family)) {
      expect(fixture.proofMode === "PASS_TO_FAIL_GATE", `${fixture.family} proof mode drift`);
      expect(fixture.controlPrimaryGateResult === "PASS", `${fixture.family} control primary gate does not pass`);
      expect(fixture.mutatedPrimaryGateResult === "FAIL", `${fixture.family} mutation primary gate does not fail`);
      expect(fixture.changedGateIds.includes(fixture.primaryGateId), `${fixture.family} primary gate did not change`);
    }
    if (fixture.family === "CRYPTOGRAPHIC_SIGNATURE") {
      expect(fixture.proofMode === "REJECTION_PRESERVING_BYTE_DELTA", "signature proof mode drift");
      expect(fixture.storageDeltaCount === "2", "signature mirrored storage delta drift");
      expect(fixture.controlPrimaryGateResult === "FAIL" && fixture.mutatedPrimaryGateResult === "FAIL", "signature fixture claims positive baseline");
    }
    if (fixture.family === "CRYPTOGRAPHIC_GUARD") {
      expect(fixture.proofMode === "REJECTION_REASON_DELTA", "guard proof mode drift");
      expect(fixture.controlVerificationReason !== fixture.mutatedVerificationReason, "guard verification reason did not change");
    }
    if (fixture.family === "EXPECTED_TARGET") {
      expect(
        fixture.controlInputCanonicalSha256 === fixture.mutatedInputCanonicalSha256,
        "target reorder unexpectedly changes canonical commitment",
      );
      expect(
        fixture.controlInputOrderedSha256 !== fixture.mutatedInputOrderedSha256,
        "target reorder is not bound by ordered commitment",
      );
    } else {
      expect(
        fixture.controlInputCanonicalSha256 !== fixture.mutatedInputCanonicalSha256,
        `${fixture.family} canonical input commitment did not change`,
      );
    }
  }
  expect(artifact?.summary?.fixtureCount === String(FUZZ_FAMILIES.length), "minimal summary count drift");
  expect(artifact?.summary?.allControlsRejected === true, "minimal summary control rejection drift");
  expect(artifact?.summary?.allMutationsRejected === true, "minimal summary mutation rejection drift");
  expect(
    artifact?.summary?.fixtureSetCommitmentSha256 === canonicalSha256(
      artifact.fixtures.map((fixture) => fixture.fixtureCommitmentSha256),
    ),
    "minimal fixture-set commitment drift",
  );
  expect(
    JSON.stringify(generatePositiveCampaignVectorMinimalCounterexamples()) === JSON.stringify(artifact),
    "minimal counterexamples do not deterministically regenerate",
  );
  const sources = `${generatorSource}\n${pythonVerifierSource}`;
  expect(!/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/.test(sources), "minimal tooling can create keys or signatures");
  expect(!/\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/.test(sources), "minimal tooling can use network or wallet capability");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validatePositiveCampaignVectorMinimalCounterexamples();
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Ten intake-family minimal counterexamples reproduce and remain rejection-only.");
  }
}
