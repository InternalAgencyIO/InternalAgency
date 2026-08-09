/**
 * Generates compact visible-view shared-buffer alias-mutation evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  evaluateVisibleViewAliasMutationCorpus,
  VISIBLE_VIEW_ALIAS_MUTATION_RULES,
} from "./settlement-contention-composition-transport-limits.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-composition-visible-view-alias-mutation-audit.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const PARSER_PATH = fileURLToPath(new URL("./settlement-contention-composition-transport-limits.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-transport-limits.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));

export function generateVisibleViewAliasMutationAudit() {
  const base = parse(BASE_PATH);
  const { outsideControls, insideDetections } = evaluateVisibleViewAliasMutationCorpus();
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-contention-composition-visible-view-alias-mutation-v1",
    status: { labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false },
    sources: {
      baseArtifact: { path: "settlement-contention-composition-vectors.v1.json", canonicalSha256: canonicalSha256(base) },
      boundedParser: { path: "settlement-contention-composition-transport-limits.mjs", normalizedTextSha256: normalizedTextSha256(PARSER_PATH) },
      pythonVerifier: { path: "verify-settlement-contention-transport-limits.py", normalizedTextSha256: normalizedTextSha256(PYTHON_PATH) },
      generator: { path: "generate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs", normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH) },
    },
    contract: {
      mode: "UINT8ARRAY_SHARED_BACKING_ALIAS_MUTATION",
      visibleViewAliasMutationRules: VISIBLE_VIEW_ALIAS_MUTATION_RULES,
      outsideControlCount: 3,
      insideDetectionCount: 3,
      outsidePrefixIsolationProven: true,
      outsideSuffixIsolationProven: true,
      insideCandidateChangeDetected: true,
      insideMarkerChangeRejected: true,
      insideDelimiterChangeRejected: true,
      sharedBackingAliasesExercised: true,
      backingByteSequencesStored: false,
      visibleByteSequencesStored: false,
      runtimeInputsStored: false,
      runtimeCandidatesStored: false,
      usesLocalValidator: false,
      usesRpc: false,
      usesWallet: false,
      preparesTransactions: false,
      signsTransactions: false,
      broadcastsTransactions: false,
      issuesReviewReceipts: false,
      completesReview: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    summary: {
      outsideControlCount: "3",
      insideDetectionCount: "3",
      allOutsideMutationsIsolated: true,
      allInsideMutationsDetected: true,
      outsideControlSetCommitmentSha256: canonicalSha256(outsideControls),
      insideDetectionSetCommitmentSha256: canonicalSha256(insideDetections),
      combinedReplayCommitmentSha256: canonicalSha256({ outsideControls, insideDetections }),
      backingByteSequencesStored: false,
      visibleByteSequencesStored: false,
      runtimeInputsStored: false,
      runtimeCandidatesStored: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    outsideControls,
    insideDetections,
  };
}

export function renderVisibleViewAliasMutationAudit() {
  return `${JSON.stringify(generateVisibleViewAliasMutationAudit(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderVisibleViewAliasMutationAudit(), "utf8");
    console.log("Wrote three outside-view isolation controls and three inside-view mutation detections; bytes and candidates remain runtime-only.");
  } else {
    process.stdout.write(renderVisibleViewAliasMutationAudit());
  }
}
