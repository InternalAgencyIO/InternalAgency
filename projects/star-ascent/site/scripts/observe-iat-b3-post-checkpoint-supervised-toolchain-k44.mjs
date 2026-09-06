import {
  POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN,
  canonicalPostCheckpointObserverSourceDesignJson,
  createPostCheckpointObserverSourceDesign,
  parsePostCheckpointObserverSourceDesignJson,
} from "./lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs";
import {
  SUPERVISED_TOOLCHAIN_K44_PACKAGE_RESULT_SCHEMA,
  assertPackageSourceTruth,
  evaluateBoundSupervisedProjection,
} from "./lib/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package-contract.mjs";

export const SUPERVISED_TOOLCHAIN_K44_OBSERVER_ENTRY_CONTRACT = Object.freeze({
  schema: "iat-b3-post-checkpoint-supervised-toolchain-k44-observer-entry/v1",
  exportName: "evaluatePostCheckpointToolchainK44Observation",
  argumentCount: 1,
  argument: "CONTEXT_PARSED_DEEP_FROZEN_CANONICAL_VALIDATED_PROJECTION_BYTES_ONLY",
  synchronous: true,
  thenablePermitted: false,
  resultSchema: SUPERVISED_TOOLCHAIN_K44_PACKAGE_RESULT_SCHEMA,
  resultSerialization: "CANONICAL_PRIMITIVE_UTF8_JSON_PLUS_ONE_LF",
  toolchainAccepted: false,
  k44Accepted: false,
  receiptPresent: false,
  decision: "HOLD",
  authority: "NONE",
  fdCapabilityPresent: false,
  persistenceCapabilityPresent: false,
  runtimeAuthorityPresent: false,
});

export function evaluatePostCheckpointToolchainK44Observation(canonicalProjectionJson) {
  if (arguments.length !== 1 || typeof canonicalProjectionJson !== "string") {
    throw new TypeError("$entry: expected exactly one primitive canonical projection string");
  }
  const sourceTruth = assertPackageSourceTruth();
  if (
    sourceTruth.status !== "HOLD_SOURCE_PACKAGE_ONLY" ||
    sourceTruth.actualRuntimeProjection !== null ||
    sourceTruth.actualReceipt !== null ||
    sourceTruth.authority !== "NONE"
  ) {
    throw new TypeError("$entry: source truth boundary mismatch");
  }
  const canonicalBpoDesignJson =
    canonicalPostCheckpointObserverSourceDesignJson(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN);
  const parsedBpoDesign = parsePostCheckpointObserverSourceDesignJson(canonicalBpoDesignJson);
  const createdBpoDesign = createPostCheckpointObserverSourceDesign();
  if (
    parsedBpoDesign.schema !== POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.schema ||
    createdBpoDesign.schema !== POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.schema
  ) {
    throw new TypeError("$entry: exact BPO initialization, parse, or create mismatch");
  }
  const result = evaluateBoundSupervisedProjection(canonicalProjectionJson, canonicalBpoDesignJson);
  if (typeof result !== "string" || !result.endsWith("\n")) {
    throw new TypeError("$entry: expected canonical primitive result string");
  }
  return result;
}

export default evaluatePostCheckpointToolchainK44Observation;

