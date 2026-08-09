/**
 * Validates compact immutable-input snapshot evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateInputSnapshotAudit } from "./generate-settlement-contention-composition-input-snapshot-audit.mjs";
import { INPUT_SNAPSHOT_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-input-snapshot-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadInputSnapshotAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateInputSnapshotAudit(artifact = loadInputSnapshotAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "input snapshot version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-input-snapshot-v1", "input snapshot ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "input snapshot HOLD drift");
  expect(JSON.stringify(generateInputSnapshotAudit()) === JSON.stringify(artifact), "input snapshot audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "IMMUTABLE_VISIBLE_BYTE_SNAPSHOT", "input snapshot mode drift");
  expect(JSON.stringify(contract.inputSnapshotRules) === JSON.stringify(INPUT_SNAPSHOT_RULES), "input snapshot rules drift");
  expect(contract.snapshotControlCount === 3 && contract.sharedRejectionCount === 3, "input snapshot counts drift");
  for (const field of ["ordinaryViewsCopiedBeforeDecode", "insideAliasMutationsCannotChangeSnapshot", "outsideAliasMutationsCannotChangeSnapshot", "sharedViewsRejectedBeforeDecode"]) expect(contract[field] === true, `input snapshot contract ${field} drift`);
  for (const field of ["backingByteSequencesStored", "visibleByteSequencesStored", "snapshotByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `input snapshot contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "input snapshot activation effect drift");
  const snapshotControls = Array.isArray(artifact?.snapshotControls) ? artifact.snapshotControls : [];
  const sharedRejections = Array.isArray(artifact?.sharedRejections) ? artifact.sharedRejections : [];
  expect(snapshotControls.length === 3 && sharedRejections.length === 3, "input snapshot evidence counts drift");
  expect(snapshotControls.every((item) => item.inputType === "Uint8Array" && item.backingType === "ArrayBuffer" && item.snapshotRepresentationSha256 === item.afterSnapshotRepresentationSha256 && item.snapshotCandidateCommitmentSha256 === item.afterSnapshotCandidateCommitmentSha256 && item.snapshotBytesPreserved === true && item.snapshotCandidatePreserved === true && item.snapshotAliasesInput === false && item.runtimeBytesStored === false && item.runtimeCandidatesStored === false), "input snapshot control claim drift");
  expect(sharedRejections.every((item) => item.inputType === "Uint8Array" && item.backingType === "SharedArrayBuffer" && item.observedError === "SHARED_BYTE_VIEW_UNSAFE" && item.snapshotCreated === false && item.utf8DecodingAttempted === false && item.jsonParsingAttempted === false && item.candidateProduced === false), "input snapshot shared rejection claim drift");
  expect(JSON.stringify(sharedRejections.map((item) => item.viewDescriptor)) === JSON.stringify(["FULL_VIEW", "BOUNDED_VIEW", "EMPTY_VIEW"]), "input snapshot shared coverage drift");
  const summary = artifact?.summary ?? {};
  expect(summary.snapshotControlCount === "3" && summary.sharedRejectionCount === "3", "input snapshot summary counts drift");
  expect(summary.allSnapshotsImmutableAfterCopy === true && summary.allSharedViewsRejectedBeforeDecode === true, "input snapshot summary outcome drift");
  expect(summary.snapshotControlSetCommitmentSha256 === canonicalSha256(snapshotControls), "input snapshot control-set drift");
  expect(summary.sharedRejectionSetCommitmentSha256 === canonicalSha256(sharedRejections), "input snapshot rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ snapshotControls, sharedRejections }), "input snapshot combined replay drift");
  for (const field of ["backingByteSequencesStored", "visibleByteSequencesStored", "snapshotByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `input snapshot summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "input snapshot summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateInputSnapshotAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Input snapshot audit validated: ordinary views copy before decode and SharedArrayBuffer views reject before decode, network NONE.");
  }
}
