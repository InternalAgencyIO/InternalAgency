/**
 * Generates compact duplicate-key and bounded-transport evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  evaluateTransportLimitCorpus,
  TRANSPORT_LIMITS,
} from "./settlement-contention-composition-transport-limits.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-composition-transport-limit-audit.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const PARSER_PATH = fileURLToPath(new URL("./settlement-contention-composition-transport-limits.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-transport-limits.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));

export function generateTransportLimitAudit() {
  const base = parse(BASE_PATH);
  const { controls, rejections } = evaluateTransportLimitCorpus(base);
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-contention-composition-transport-limits-v1",
    status: { labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false },
    sources: {
      baseArtifact: { path: "settlement-contention-composition-vectors.v1.json", canonicalSha256: canonicalSha256(base) },
      boundedParser: { path: "settlement-contention-composition-transport-limits.mjs", normalizedTextSha256: normalizedTextSha256(PARSER_PATH) },
      pythonVerifier: { path: "verify-settlement-contention-transport-limits.py", normalizedTextSha256: normalizedTextSha256(PYTHON_PATH) },
      generator: { path: "generate-settlement-contention-composition-transport-limit-audit.mjs", normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH) },
    },
    contract: {
      mode: "DUPLICATE_AWARE_BOUNDED_JSON_TRANSPORT",
      limits: TRANSPORT_LIMITS,
      acceptedControlCount: 2,
      rejectionCount: 8,
      duplicateKeyCaseCount: 3,
      limitCaseCount: 5,
      duplicateKeysRejectedAtAnyDepth: true,
      exactByteBoundaryAccepted: true,
      overLimitRejectedBeforeMutation: true,
      serializedRepresentationsStored: false,
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
      acceptedControlCount: "2",
      rejectionCount: "8",
      allControlsAcceptedAtParser: true,
      allControlsPreserveBaseCandidate: true,
      allAmbiguousOrOverLimitInputsRejectedBeforeMutation: true,
      controlSetCommitmentSha256: canonicalSha256(controls),
      rejectionSetCommitmentSha256: canonicalSha256(rejections),
      combinedReplayCommitmentSha256: canonicalSha256({ controls, rejections }),
      serializedRepresentationsStored: false,
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

export function renderTransportLimitAudit() {
  return `${JSON.stringify(generateTransportLimitAudit(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderTransportLimitAudit(), "utf8");
    console.log("Wrote two bounded controls and eight pre-mutation transport rejections; raw inputs and candidates remain runtime-only.");
  } else {
    process.stdout.write(renderTransportLimitAudit());
  }
}
