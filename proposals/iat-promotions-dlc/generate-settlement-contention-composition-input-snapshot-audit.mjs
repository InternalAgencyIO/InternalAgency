/**
 * Generates compact immutable-input snapshot evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  evaluateInputSnapshotCorpus,
  INPUT_SNAPSHOT_RULES,
} from "./settlement-contention-composition-transport-limits.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-composition-input-snapshot-audit.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const PARSER_PATH = fileURLToPath(new URL("./settlement-contention-composition-transport-limits.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-transport-limits.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));

export function generateInputSnapshotAudit() {
  const base = parse(BASE_PATH);
  const { snapshotControls, sharedRejections } = evaluateInputSnapshotCorpus();
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-contention-composition-input-snapshot-v1",
    status: { labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false },
    sources: {
      baseArtifact: { path: "settlement-contention-composition-vectors.v1.json", canonicalSha256: canonicalSha256(base) },
      boundedParser: { path: "settlement-contention-composition-transport-limits.mjs", normalizedTextSha256: normalizedTextSha256(PARSER_PATH) },
      pythonVerifier: { path: "verify-settlement-contention-transport-limits.py", normalizedTextSha256: normalizedTextSha256(PYTHON_PATH) },
      generator: { path: "generate-settlement-contention-composition-input-snapshot-audit.mjs", normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH) },
    },
    contract: {
      mode: "IMMUTABLE_VISIBLE_BYTE_SNAPSHOT",
      inputSnapshotRules: INPUT_SNAPSHOT_RULES,
      snapshotControlCount: 3,
      sharedRejectionCount: 3,
      ordinaryViewsCopiedBeforeDecode: true,
      insideAliasMutationsCannotChangeSnapshot: true,
      outsideAliasMutationsCannotChangeSnapshot: true,
      sharedViewsRejectedBeforeDecode: true,
      backingByteSequencesStored: false,
      visibleByteSequencesStored: false,
      snapshotByteSequencesStored: false,
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
      snapshotControlCount: "3",
      sharedRejectionCount: "3",
      allSnapshotsImmutableAfterCopy: true,
      allSharedViewsRejectedBeforeDecode: true,
      snapshotControlSetCommitmentSha256: canonicalSha256(snapshotControls),
      sharedRejectionSetCommitmentSha256: canonicalSha256(sharedRejections),
      combinedReplayCommitmentSha256: canonicalSha256({ snapshotControls, sharedRejections }),
      backingByteSequencesStored: false,
      visibleByteSequencesStored: false,
      snapshotByteSequencesStored: false,
      runtimeInputsStored: false,
      runtimeCandidatesStored: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    snapshotControls,
    sharedRejections,
  };
}

export function renderInputSnapshotAudit() {
  return `${JSON.stringify(generateInputSnapshotAudit(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderInputSnapshotAudit(), "utf8");
    console.log("Wrote three immutable-copy controls and three pre-decode shared-buffer rejections; bytes and candidates remain runtime-only.");
  } else {
    process.stdout.write(renderInputSnapshotAudit());
  }
}
