/**
 * Closed-schema mutation corpus for compact contention compositions.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { applyJsonPointerMutation, validateJsonSchemaSubset } from "./json-schema-subset.mjs";

const ZERO_HASH = "0".repeat(64);

export const COMPOSITION_SCHEMA_MUTATION_DEFINITIONS = Object.freeze([
  { caseId: "ROOT_CANDIDATE_FIELD", family: "CLOSED_ROOT", mutation: { operation: "add", path: "/candidate", value: {} } },
  { caseId: "CASE_EXPANDED_STATE", family: "CLOSED_CASE", mutation: { operation: "add", path: "/cases/0/expandedState", value: {} } },
  { caseId: "REMOVAL_TRACE_FIELD", family: "CLOSED_REMOVAL", mutation: { operation: "add", path: "/cases/0/removalChecks/0/trace", value: [] } },
  { caseId: "STATUS_NETWORK_MAINNET", family: "HOLD_STATUS", mutation: { operation: "replace", path: "/status/network", value: "MAINNET" } },
  { caseId: "CONTRACT_RPC_ENABLED", family: "CAPABILITY", mutation: { operation: "replace", path: "/contract/usesRpc", value: true } },
  { caseId: "CONTRACT_WALLET_ENABLED", family: "CAPABILITY", mutation: { operation: "replace", path: "/contract/usesWallet", value: true } },
  { caseId: "CONTRACT_PREPARATION_ENABLED", family: "CAPABILITY", mutation: { operation: "replace", path: "/contract/preparesTransactions", value: true } },
  { caseId: "CONTRACT_ACTIVATION_AUTHORIZED", family: "AUTHORITY", mutation: { operation: "replace", path: "/contract/activationAuthorized", value: true } },
  { caseId: "SUMMARY_REVIEW_COMPLETED", family: "AUTHORITY", mutation: { operation: "replace", path: "/summary/reviewCompleted", value: true } },
  { caseId: "REMOVAL_OBSERVED_TWO_GATES", family: "CARDINALITY", mutation: { operation: "replace", path: "/cases/0/removalChecks/0/observedGates", value: ["STATUS", "CAPABILITY"] } },
  { caseId: "REMOVAL_HASH_UPPERCASE", family: "CANONICAL_HEX", mutation: { operation: "replace", path: "/cases/0/removalChecks/0/candidateCommitmentSha256", value: ZERO_HASH.toUpperCase().replaceAll("0", "A") } },
  { caseId: "REMOVAL_UNKNOWN_GATE", family: "GATE_ENUM", mutation: { operation: "replace", path: "/cases/0/removalChecks/0/remainingGate", value: "UNKNOWN" } },
]);

export function evaluateCompositionSchemaMutation(baseArtifact, schema, definition) {
  const candidate = applyJsonPointerMutation(baseArtifact, definition.mutation);
  const diagnostics = validateJsonSchemaSubset(schema, candidate);
  if (diagnostics.length === 0) throw new Error(`SCHEMA_MUTATION_UNEXPECTEDLY_ACCEPTED:${definition.caseId}`);
  return {
    candidate,
    diagnostics,
    commonReplayRecord: {
      caseId: definition.caseId,
      candidateCommitmentSha256: canonicalSha256(candidate),
      diagnosticCommitmentSha256: canonicalSha256(diagnostics),
      accepted: false,
    },
  };
}
