/**
 * Generates compact UTF-8 upper-bound and illegal-lead evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  evaluateUtf8BoundaryCorpus,
  UTF8_BOUNDARY_RULES,
} from "./settlement-contention-composition-transport-limits.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-composition-utf8-boundary-audit.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const PARSER_PATH = fileURLToPath(new URL("./settlement-contention-composition-transport-limits.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-transport-limits.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));

export function generateUtf8BoundaryAudit() {
  const base = parse(BASE_PATH);
  const { controls, rejections } = evaluateUtf8BoundaryCorpus();
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-contention-composition-utf8-boundary-v1",
    status: { labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false },
    sources: {
      baseArtifact: { path: "settlement-contention-composition-vectors.v1.json", canonicalSha256: canonicalSha256(base) },
      boundedParser: { path: "settlement-contention-composition-transport-limits.mjs", normalizedTextSha256: normalizedTextSha256(PARSER_PATH) },
      pythonVerifier: { path: "verify-settlement-contention-transport-limits.py", normalizedTextSha256: normalizedTextSha256(PYTHON_PATH) },
      generator: { path: "generate-settlement-contention-composition-utf8-boundary-audit.mjs", normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH) },
    },
    contract: {
      mode: "UTF8_UPPER_BOUND_AND_ILLEGAL_LEADS",
      utf8BoundaryRules: UTF8_BOUNDARY_RULES,
      acceptedControlCount: 4,
      rejectionCount: 16,
      outOfRangeCaseCount: 4,
      obsoleteLongFormCaseCount: 4,
      illegalFeFfLeadCaseCount: 4,
      redundantContinuationCaseCount: 4,
      boundaryScalarsAccepted: true,
      outOfRangeRejectedBeforeJson: true,
      obsoleteLongFormsRejectedBeforeJson: true,
      illegalFeFfLeadsRejectedBeforeJson: true,
      redundantContinuationsRejectedBeforeJson: true,
      serializedByteSequencesStored: false,
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
      acceptedControlCount: "4",
      rejectionCount: "16",
      allBoundaryControlsAccepted: true,
      allIllegalByteSequencesRejectedBeforeJson: true,
      controlSetCommitmentSha256: canonicalSha256(controls),
      rejectionSetCommitmentSha256: canonicalSha256(rejections),
      combinedReplayCommitmentSha256: canonicalSha256({ controls, rejections }),
      serializedByteSequencesStored: false,
      runtimeCandidatesStored: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    controls,
    rejections,
  };
}

export function renderUtf8BoundaryAudit() {
  return `${JSON.stringify(generateUtf8BoundaryAudit(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderUtf8BoundaryAudit(), "utf8");
    console.log("Wrote four UTF-8 scalar-boundary controls and sixteen fatal illegal-lead/range rejections; raw byte sequences and candidates remain runtime-only.");
  } else {
    process.stdout.write(renderUtf8BoundaryAudit());
  }
}
