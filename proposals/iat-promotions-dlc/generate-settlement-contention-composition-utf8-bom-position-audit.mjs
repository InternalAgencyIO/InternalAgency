/**
 * Generates compact UTF-8 BOM-position evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  evaluateUtf8BomPositionCorpus,
  UTF8_BOM_POSITION_RULES,
} from "./settlement-contention-composition-transport-limits.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-composition-utf8-bom-position-audit.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const PARSER_PATH = fileURLToPath(new URL("./settlement-contention-composition-transport-limits.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-transport-limits.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));

export function generateUtf8BomPositionAudit() {
  const base = parse(BASE_PATH);
  const { controls, rejections } = evaluateUtf8BomPositionCorpus();
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-contention-composition-utf8-bom-position-v1",
    status: { labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false },
    sources: {
      baseArtifact: { path: "settlement-contention-composition-vectors.v1.json", canonicalSha256: canonicalSha256(base) },
      boundedParser: { path: "settlement-contention-composition-transport-limits.mjs", normalizedTextSha256: normalizedTextSha256(PARSER_PATH) },
      pythonVerifier: { path: "verify-settlement-contention-transport-limits.py", normalizedTextSha256: normalizedTextSha256(PYTHON_PATH) },
      generator: { path: "generate-settlement-contention-composition-utf8-bom-position-audit.mjs", normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH) },
    },
    contract: {
      mode: "UTF8_BOM_POSITION_DELIMITER_BOUNDARY",
      utf8BomPositionRules: UTF8_BOM_POSITION_RULES,
      acceptedControlCount: 1,
      rejectionCount: 3,
      leadingBomCaseCount: 1,
      postWhitespaceBomCaseCount: 1,
      trailingBomCaseCount: 1,
      bomScalarInsideStringAccepted: true,
      bomBytesPreservedByDecoder: true,
      leadingBomRejectedByDelimiterRule: true,
      postWhitespaceBomRejectedByDelimiterRule: true,
      trailingBomRejectedByDelimiterRule: true,
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
      acceptedControlCount: "1",
      rejectionCount: "3",
      bomInsideStringAccepted: true,
      allDelimiterBomPositionsRejectedAfterDecode: true,
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

export function renderUtf8BomPositionAudit() {
  return `${JSON.stringify(generateUtf8BomPositionAudit(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderUtf8BomPositionAudit(), "utf8");
    console.log("Wrote one in-string BOM control and three delimiter-position rejections; raw byte sequences and candidates remain runtime-only.");
  } else {
    process.stdout.write(renderUtf8BomPositionAudit());
  }
}
