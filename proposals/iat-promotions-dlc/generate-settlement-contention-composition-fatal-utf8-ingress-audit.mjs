/**
 * Generates compact fatal UTF-8 byte-ingress evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  evaluateFatalUtf8IngressCorpus,
  FATAL_UTF8_INGRESS_RULES,
} from "./settlement-contention-composition-transport-limits.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-composition-fatal-utf8-ingress-audit.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const PARSER_PATH = fileURLToPath(new URL("./settlement-contention-composition-transport-limits.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-transport-limits.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));

export function generateFatalUtf8IngressAudit() {
  const base = parse(BASE_PATH);
  const { controls, rejections } = evaluateFatalUtf8IngressCorpus(base);
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-contention-composition-fatal-utf8-ingress-v1",
    status: { labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false },
    sources: {
      baseArtifact: { path: "settlement-contention-composition-vectors.v1.json", canonicalSha256: canonicalSha256(base) },
      boundedParser: { path: "settlement-contention-composition-transport-limits.mjs", normalizedTextSha256: normalizedTextSha256(PARSER_PATH) },
      pythonVerifier: { path: "verify-settlement-contention-transport-limits.py", normalizedTextSha256: normalizedTextSha256(PYTHON_PATH) },
      generator: { path: "generate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs", normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH) },
    },
    contract: {
      mode: "FATAL_UTF8_BYTE_INGRESS",
      fatalUtf8IngressRules: FATAL_UTF8_INGRESS_RULES,
      acceptedControlCount: 4,
      rejectionCount: 16,
      truncatedCaseCount: 4,
      overlongCaseCount: 4,
      surrogateEncodedCaseCount: 4,
      invalidContinuationCaseCount: 4,
      validScalarWidthsAccepted: true,
      truncatedRejectedBeforeJson: true,
      overlongRejectedBeforeJson: true,
      surrogateEncodedRejectedBeforeJson: true,
      invalidContinuationsRejectedBeforeJson: true,
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
      allValidScalarWidthControlsAccepted: true,
      allMalformedByteSequencesRejectedBeforeJson: true,
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

export function renderFatalUtf8IngressAudit() {
  return `${JSON.stringify(generateFatalUtf8IngressAudit(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderFatalUtf8IngressAudit(), "utf8");
    console.log("Wrote four valid UTF-8 width controls and sixteen fatal pre-JSON byte rejections; raw byte sequences and candidates remain runtime-only.");
  } else {
    process.stdout.write(renderFatalUtf8IngressAudit());
  }
}
