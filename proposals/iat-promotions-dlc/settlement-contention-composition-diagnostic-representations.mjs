/**
 * Representation audit for compact composition-schema diagnostics.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { evaluateCompositionSchemaMutation } from "./settlement-contention-composition-schema-mutations.mjs";

const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");

function reverseKeys(value) {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)]));
}

export function buildDiagnosticRepresentations(baseArtifact) {
  const baseLf = `${JSON.stringify(baseArtifact, null, 2)}\n`;
  const reversedLf = `${JSON.stringify(reverseKeys(baseArtifact), null, 2)}\n`;
  const baseCrlf = baseLf.replace(/\n/g, "\r\n");
  return [
    { representationId: "BASE_LF", serialized: baseLf },
    { representationId: "REVERSED_KEYS_LF", serialized: reversedLf },
    { representationId: "BASE_CRLF", serialized: baseCrlf },
  ];
}

export function evaluateDiagnosticRepresentationAudit(baseArtifact, schema, definition) {
  const trials = buildDiagnosticRepresentations(baseArtifact).map(({ representationId, serialized }) => {
    const representedBase = JSON.parse(serialized);
    const result = evaluateCompositionSchemaMutation(representedBase, schema, definition);
    return {
      representationId,
      representationSha256: sha256Hex(serialized),
      candidateCommitmentSha256: result.commonReplayRecord.candidateCommitmentSha256,
      diagnostics: result.diagnostics,
      diagnosticCommitmentSha256: result.commonReplayRecord.diagnosticCommitmentSha256,
      accepted: false,
    };
  });
  const baseline = trials[0];
  const stable = trials.every((trial) =>
    trial.candidateCommitmentSha256 === baseline.candidateCommitmentSha256 &&
    JSON.stringify(trial.diagnostics) === JSON.stringify(baseline.diagnostics) &&
    trial.diagnosticCommitmentSha256 === baseline.diagnosticCommitmentSha256 &&
    trial.accepted === false);
  if (!stable) throw new Error(`DIAGNOSTIC_REPRESENTATION_DRIFT:${definition.caseId}`);
  if (new Set(trials.map((trial) => trial.representationSha256)).size !== trials.length) {
    throw new Error(`REPRESENTATION_DIGEST_COLLISION:${definition.caseId}`);
  }
  return {
    trials,
    commonReplayRecord: {
      caseId: definition.caseId,
      candidateCommitmentSha256: baseline.candidateCommitmentSha256,
      diagnosticCommitmentSha256: baseline.diagnosticCommitmentSha256,
      representationSetCommitmentSha256: canonicalSha256(trials.map((trial) => ({
        representationId: trial.representationId,
        representationSha256: trial.representationSha256,
      }))),
      stable: true,
      accepted: false,
    },
  };
}
