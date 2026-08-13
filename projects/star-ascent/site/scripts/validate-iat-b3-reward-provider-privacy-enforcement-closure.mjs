#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ENFORCEMENT_CLOSURE_SCHEMA =
  "iat-b3-reward-provider-privacy-enforcement-closure/v1";
export const ENFORCEMENT_CLOSURE_STATUS =
  "HOLD_UNTIL_RUNTIME_AUTHENTICATED_ENFORCEMENT";
export const ENFORCEMENT_CLOSURE_MAINNET_STATUS = "HOLD";
export const AUTOMATED_GATE_8_PREDICATE =
  "SOURCE_BOUND_AUTOMATED_GATE_8_DIRECT_EVIDENCE_PACKET";
export const ENFORCEMENT_CLOSURE_SOLE_HUMAN_GATE =
  "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION";
export const ENFORCEMENT_CLOSURE_HUMAN_GATE_SCOPE =
  "ACTUAL_CRYPTOGRAPHIC_SIGNATURES_ONLY";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPOSITORY_ROOT = resolve(SITE_ROOT, "../../..");
const DEFAULT_MANIFEST_PATH = fileURLToPath(new URL(
  "../docs/b3/iat-b3-reward-provider-privacy-enforcement-closure.v1.json",
  import.meta.url,
));

const TOP_LEVEL_KEYS = Object.freeze([
  "schema",
  "profile",
  "status",
  "scope",
  "gatePolicy",
  "sourceBindings",
  "featureRows",
  "runtimeSurfaces",
  "dependencyNodes",
  "terminalPredicate",
  "runtimeAuthenticationVerified",
  "providerOperationalTruthVerified",
  "collectorCompletenessVerified",
  "externalMonotonicityVerified",
  "rollbackProtectionVerified",
  "runtimeConsumerGatingVerified",
  "privacyLifecycleVerified",
  "activationReady",
  "releaseAuthorizationVerified",
  "mainnetExecutionAuthorized",
  "mainnetStatus",
]);

const SCOPE_KEYS = Object.freeze([
  "predicate",
  "retainedParityFeatureCount",
  "auditedFeatureOrdinals",
  "doesNotCertify",
]);
const GATE_POLICY_KEYS = Object.freeze([
  "gate8Predicate",
  "gate8PredicateSatisfied",
  "directEvidenceOnly",
  "humanReviewerRequired",
  "multipleAutomatedEvidenceSourcesRequired",
  "noSelfAttestation",
  "soleHumanGate",
  "humanGateScope",
]);
const SOURCE_BINDING_KEYS = Object.freeze(["path", "sha256", "byteLength"]);
const FEATURE_KEYS = Object.freeze([
  "ordinal",
  "capability",
  "domain",
  "enforcementState",
  "runtimeAuthenticated",
  "activationAuthorized",
  "blocker",
]);
const SURFACE_KEYS = Object.freeze([
  "id",
  "state",
  "present",
  "writesRuntimeState",
  "runtimeAuthenticated",
  "sourceBoundDisableVerified",
  "detail",
]);
const DEPENDENCY_KEYS = Object.freeze([
  "id",
  "status",
  "completionEvidencePresent",
]);
const TERMINAL_KEYS = Object.freeze([
  "auditedFeatureCount",
  "runtimeAuthenticatedFeatureCount",
  "unresolvedRuntimeExposureIds",
  "rewardPublicationDisabled",
  "privacySubmissionDisabled",
  "allRequiredProviderIntegrationsAbsent",
  "closureComplete",
  "evaluationRule",
]);

export const AUDITED_FEATURES = Object.freeze([
  Object.freeze({ ordinal: 3, capability: "Optional Privacy Vault", domain: "PRIVACY", enforcementState: "NONACTIVATING_UNSIGNED_ACCOUNT_LOCAL_PREREQUISITE_ONLY" }),
  Object.freeze({ ordinal: 7, capability: "Ordered reward lanes", domain: "REWARD", enforcementState: "REFERENCE_ONLY_PUBLICATION_DISABLED" }),
  Object.freeze({ ordinal: 8, capability: "Full collateral reservation", domain: "REWARD", enforcementState: "REFERENCE_ONLY_PUBLICATION_DISABLED" }),
  Object.freeze({ ordinal: 9, capability: "No reward debt", domain: "REWARD", enforcementState: "REFERENCE_ONLY_PUBLICATION_DISABLED" }),
  Object.freeze({ ordinal: 10, capability: "Existing-reservation priority", domain: "REWARD", enforcementState: "REFERENCE_ONLY_PUBLICATION_DISABLED" }),
  Object.freeze({ ordinal: 31, capability: "Wallet/X binding and uniqueness", domain: "PROVIDER", enforcementState: "RUNTIME_WRITE_IMMUTABLY_HELD_PENDING_AUTHENTICATED_PREREQUISITES" }),
  Object.freeze({ ordinal: 32, capability: "X age/subscription checks", domain: "PROVIDER", enforcementState: "RETAINED_V2_10_90_100_BOUNDARY_PRESENT_RUNTIME_HELD" }),
  Object.freeze({ ordinal: 33, capability: "Atomic D1 activation and cap semantics", domain: "PROVIDER", enforcementState: "LEGACY_D1_WRITER_REMOVED_EXACT_ATOMIC_ADAPTER_UNWIRED" }),
  Object.freeze({ ordinal: 49, capability: "Weekly faction rewards", domain: "REWARD", enforcementState: "CREATION_POLICY_HOLD_REFERENCE_ONLY" }),
  Object.freeze({ ordinal: 51, capability: "Genesis and X interaction eligibility", domain: "REWARD_PROVIDER", enforcementState: "NONPUBLISHING_REFERENCE_RUNTIME_WRITE_IMMUTABLY_HELD" }),
  Object.freeze({ ordinal: 52, capability: "X-bound reward tiering", domain: "REWARD_PROVIDER", enforcementState: "NONPUBLISHING_RETAINED_V2_BOUNDARY_RUNTIME_HELD" }),
  Object.freeze({ ordinal: 53, capability: "New-obligation reward-capacity waterfall", domain: "REWARD", enforcementState: "REFERENCE_CONTRACT_ONLY_PUBLICATION_DISABLED" }),
]);

export const REQUIRED_DEPENDENCY_NODE_IDS = Object.freeze([
  "REWARD_WATERFALL_PROOFS",
  "DURABLE_REWARD_CAS",
  "EXTERNAL_CHECKPOINT_PROVIDER",
  "X_SOCIAL_EVIDENCE_PROVIDER",
  "REWARD_LOCAL_WRITE_CONSUMER_GATING",
  "PRIVACY_VAULT_CLIENT",
]);

export const REQUIRED_RUNTIME_SURFACES = Object.freeze([
  Object.freeze({ id: "REWARD_PUBLICATION_SIGNING_AND_BROADCAST", state: "SOURCE_BOUND_DISABLED", present: true, writesRuntimeState: false, sourceBoundDisableVerified: true }),
  Object.freeze({ id: "RETAINED_V2_X_CALLBACK_WRITE_BOUNDARY", state: "SOURCE_BOUND_DISABLED_PENDING_UNAVAILABLE_RUNTIME_PREREQUISITES", present: true, writesRuntimeState: false, sourceBoundDisableVerified: true }),
  Object.freeze({ id: "EXTERNAL_CHECKPOINT_PROVIDER", state: "INTEGRATION_ABSENT_BLOCKED", present: false, writesRuntimeState: false, sourceBoundDisableVerified: true }),
  Object.freeze({ id: "X_SOCIAL_EVIDENCE_PROVIDER", state: "INTEGRATION_ABSENT_BLOCKED", present: false, writesRuntimeState: false, sourceBoundDisableVerified: true }),
  Object.freeze({ id: "PRIVACY_VAULT_NATIVE_EXECUTION", state: "UNSIGNED_INERT_PREREQUISITE_RELEASE_HOLD", present: true, writesRuntimeState: false, sourceBoundDisableVerified: true }),
  Object.freeze({ id: "REFERENCE_AUTHENTICATED_MECHANICS", state: "REFERENCE_PRESENT_NOT_PRODUCTION_WIRED", present: true, writesRuntimeState: false, sourceBoundDisableVerified: true }),
]);

export const EXPECTED_SOURCE_BINDINGS = Object.freeze([
  Object.freeze({ path: "projects/star-ascent/site/docs/b3/iat-b3-v2-parity-claims-readiness.v1.json", sha256: "114b17900867df54407bb5f4bdec5f9916596f57e8e096df1cbad595c93edca2", byteLength: 12662 }),
  Object.freeze({ path: "projects/star-ascent/site/docs/b3/iat-b3-release-dependency-graph.v1.json", sha256: "68b22e29f555adb2f59fe5cf42e6a1bf7783a8c962195de6f7736ccd9b1ea843", byteLength: 31813 }),
  Object.freeze({ path: "projects/star-ascent/site/engagement/reward-policy.v1.json", sha256: "3af08bde5d9b2723880e000a48e78471634edac0854f09f8f4e21c84150869cd", byteLength: 10464 }),
  Object.freeze({ path: "projects/star-ascent/site/engagement/generate-epoch-manifest.mjs", sha256: "fea3502557002814755069a4788e894ed8d4c1d60acbbf9b3f9225460def263a", byteLength: 1645 }),
  Object.freeze({ path: "projects/star-ascent/site/engagement/node-binding-policy.mjs", sha256: "6a80f9c12ebf18badc13bb479798238d40a83550528325a550850ac8f7f36d3a", byteLength: 2317 }),
  Object.freeze({ path: "projects/star-ascent/site/app/api/x/callback/route.ts", sha256: "9f8f62088d6540223338166dea25be6a6ee5ed62b8b9505c4c3ce99a57441d34", byteLength: 658 }),
  Object.freeze({ path: "projects/star-ascent/site/app/api/x/callback/retained-v2-callback-handler.mjs", sha256: "62523efc75c68f9bb44cf140081161e3ac297732f3ddbe6d187819f6f6ecd258", byteLength: 9710 }),
  Object.freeze({ path: "projects/star-ascent/site/app/api/x/callback/retained-v2-runtime-boundary.mjs", sha256: "87bb53010cdcd7188950834b0110a645c60a1ed056d57559832755b4d6eee0f9", byteLength: 21696 }),
  Object.freeze({ path: "projects/star-ascent/site/docs/b3/iat-b3-external-checkpoint-provider-readiness.v1.json", sha256: "24f1c1879942346be86d3d2c4ff2907de6f890940cc74d5d3ecdd2bf54555fb5", byteLength: 11060 }),
  Object.freeze({ path: "projects/star-ascent/site/docs/b3/iat-b3-x-social-evidence-provider-readiness.v1.json", sha256: "1067ce1277b8d8f995db85d772d495ff17b51c58bc5da43c68b2cb7bcc5a101b", byteLength: 20847 }),
  Object.freeze({ path: "projects/star-ascent/site/docs/b3/iat-b3-privacy-vault-native-instruction-plan.v1.json", sha256: "411d90449c69bff1d73017cbb04e84b71dbe0248502a30bc35e8cc38d779a248", byteLength: 5631 }),
  Object.freeze({ path: "projects/star-ascent/site/programs/iat_b3_reference/provider-authenticated-envelope.mjs", sha256: "42b45111b527ecf4f570a77ad5ae977d9bf62ea8a0d6c6f9ed7f082b5bbc07b7", byteLength: 37061 }),
  Object.freeze({ path: "projects/star-ascent/site/programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs", sha256: "10062c50567f1073f1fded1468f95a2b78fe763800f31be19dcdf72e67aa0188", byteLength: 68569 }),
  Object.freeze({ path: "projects/star-ascent/site/programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs", sha256: "9140ffcf489dfd3b24a5e121214a92705c794d639934649dec8a9217a7468584", byteLength: 24118 }),
  Object.freeze({ path: "projects/star-ascent/site/programs/iat_b3_reference/reward-capacity-waterfall.mjs", sha256: "71fb4cbb58feecebe524e5047e34db7b39a99870825bbcfd7f2fc1e95aaf00f3", byteLength: 99158 }),
]);

const SCOPE_EXCLUSIONS = Object.freeze([
  "PRODUCTION_PROVIDER_IDENTITY_OR_KEY_OWNERSHIP",
  "PROVIDER_OPERATIONAL_TRUTH_OR_COLLECTOR_COMPLETENESS",
  "EXTERNAL_DURABILITY_MONOTONICITY_OR_ROLLBACK_PROTECTION",
  "RUNTIME_CONSUMER_GATING_OR_REWARD_PUBLICATION",
  "PRIVACY_VAULT_FULL_LIFECYCLE_OR_RUNTIME_DAILY_LAW_AUTHENTICATION",
  "DEVNET_FINAL_BINARY_OR_MAINNET_AUTHORIZATION",
  "THE_OTHER_RETAINED_V2_FEATURE_DOMAINS",
]);

const EXPECTED_GATE_POLICY = Object.freeze({
  gate8Predicate: AUTOMATED_GATE_8_PREDICATE,
  gate8PredicateSatisfied: false,
  directEvidenceOnly: true,
  humanReviewerRequired: false,
  multipleAutomatedEvidenceSourcesRequired: true,
  noSelfAttestation: true,
  soleHumanGate: ENFORCEMENT_CLOSURE_SOLE_HUMAN_GATE,
  humanGateScope: ENFORCEMENT_CLOSURE_HUMAN_GATE_SCOPE,
});

const NEGATIVE_TRUTH_KEYS = Object.freeze([
  "runtimeAuthenticationVerified",
  "providerOperationalTruthVerified",
  "collectorCompletenessVerified",
  "externalMonotonicityVerified",
  "rollbackProtectionVerified",
  "runtimeConsumerGatingVerified",
  "privacyLifecycleVerified",
  "activationReady",
  "releaseAuthorizationVerified",
  "mainnetExecutionAuthorized",
]);

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactKeys(value, expected, label, violations) {
  if (!isPlainRecord(value)) {
    violations.push(`${label}: must be an object`);
    return false;
  }
  const actual = Object.keys(value);
  if (!sameJson(actual, expected)) {
    violations.push(`${label}: keys must be exactly ${expected.join(", ")} in order`);
    return false;
  }
  return true;
}

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new TypeError("bound file must be bytes or a string");
}

function readBinding(path, boundFiles) {
  if (boundFiles instanceof Map && boundFiles.has(path)) return asBuffer(boundFiles.get(path));
  return readFileSync(resolve(REPOSITORY_ROOT, path));
}

function readJsonBinding(path, boundFiles, violations) {
  try {
    return JSON.parse(readBinding(path, boundFiles).toString("utf8"));
  } catch (error) {
    violations.push(`${path}: cannot parse bound JSON: ${error.message}`);
    return null;
  }
}

function readTextBinding(path, boundFiles, violations) {
  try {
    return readBinding(path, boundFiles).toString("utf8");
  } catch (error) {
    violations.push(`${path}: cannot read bound source: ${error.message}`);
    return "";
  }
}

function requireFalse(record, keys, label, violations) {
  for (const key of keys) {
    if (record?.[key] !== false) violations.push(`${label}.${key}: must remain false`);
  }
}

function validateBindings(manifest, boundFiles, violations) {
  if (!Array.isArray(manifest.sourceBindings)
    || manifest.sourceBindings.length !== EXPECTED_SOURCE_BINDINGS.length) {
    violations.push(`sourceBindings: expected exactly ${EXPECTED_SOURCE_BINDINGS.length} entries`);
    return;
  }
  manifest.sourceBindings.forEach((binding, index) => {
    exactKeys(binding, SOURCE_BINDING_KEYS, `sourceBindings[${index}]`, violations);
    const expected = EXPECTED_SOURCE_BINDINGS[index];
    if (!sameJson(binding, expected)) {
      violations.push(`sourceBindings[${index}]: must bind exact expected path, digest, and byte length`);
      return;
    }
    try {
      const bytes = readBinding(binding.path, boundFiles);
      if (bytes.length !== binding.byteLength) {
        violations.push(`${binding.path}: byte length ${bytes.length} does not match ${binding.byteLength}`);
      }
      if (sha256(bytes) !== binding.sha256) {
        violations.push(`${binding.path}: SHA-256 does not match immutable closure binding`);
      }
    } catch (error) {
      violations.push(`${binding.path}: cannot verify binding: ${error.message}`);
    }
  });
}

function validateFeatureRows(manifest, violations) {
  if (!Array.isArray(manifest.featureRows) || manifest.featureRows.length !== AUDITED_FEATURES.length) {
    violations.push(`featureRows: expected exactly ${AUDITED_FEATURES.length} audited retained rows`);
    return;
  }
  manifest.featureRows.forEach((row, index) => {
    exactKeys(row, FEATURE_KEYS, `featureRows[${index}]`, violations);
    const expected = AUDITED_FEATURES[index];
    for (const key of ["ordinal", "capability", "domain", "enforcementState"]) {
      if (row?.[key] !== expected[key]) {
        violations.push(`featureRows[${index}].${key}: expected ${expected[key]}`);
      }
    }
    if (row?.runtimeAuthenticated !== false) {
      violations.push(`featureRows[${index}].runtimeAuthenticated: must remain false without production evidence`);
    }
    if (row?.activationAuthorized !== false) {
      violations.push(`featureRows[${index}].activationAuthorized: must remain false`);
    }
    if (typeof row?.blocker !== "string" || row.blocker.length < 40) {
      violations.push(`featureRows[${index}].blocker: exact unresolved enforcement boundary is required`);
    }
  });
}

function validateRuntimeSurfaces(manifest, violations) {
  if (!Array.isArray(manifest.runtimeSurfaces)
    || manifest.runtimeSurfaces.length !== REQUIRED_RUNTIME_SURFACES.length) {
    violations.push(`runtimeSurfaces: expected exactly ${REQUIRED_RUNTIME_SURFACES.length} surfaces`);
    return;
  }
  manifest.runtimeSurfaces.forEach((surface, index) => {
    exactKeys(surface, SURFACE_KEYS, `runtimeSurfaces[${index}]`, violations);
    const expected = REQUIRED_RUNTIME_SURFACES[index];
    for (const key of ["id", "state", "present", "writesRuntimeState", "sourceBoundDisableVerified"]) {
      if (surface?.[key] !== expected[key]) {
        violations.push(`runtimeSurfaces[${index}].${key}: expected ${expected[key]}`);
      }
    }
    if (surface?.runtimeAuthenticated !== false) {
      violations.push(`runtimeSurfaces[${index}].runtimeAuthenticated: must remain false`);
    }
    if (typeof surface?.detail !== "string" || surface.detail.length < 40) {
      violations.push(`runtimeSurfaces[${index}].detail: exact evidence boundary is required`);
    }
  });
}

function validateDependencyRows(manifest, violations) {
  if (!Array.isArray(manifest.dependencyNodes)
    || manifest.dependencyNodes.length !== REQUIRED_DEPENDENCY_NODE_IDS.length) {
    violations.push(`dependencyNodes: expected exactly ${REQUIRED_DEPENDENCY_NODE_IDS.length} nodes`);
    return;
  }
  manifest.dependencyNodes.forEach((node, index) => {
    exactKeys(node, DEPENDENCY_KEYS, `dependencyNodes[${index}]`, violations);
    if (node?.id !== REQUIRED_DEPENDENCY_NODE_IDS[index]) {
      violations.push(`dependencyNodes[${index}].id: expected ${REQUIRED_DEPENDENCY_NODE_IDS[index]}`);
    }
    if (node?.status !== "BLOCKED") violations.push(`dependencyNodes[${index}].status: must remain BLOCKED`);
    if (node?.completionEvidencePresent !== false) {
      violations.push(`dependencyNodes[${index}].completionEvidencePresent: must remain false`);
    }
  });
}

function validateCrossArtifactTruth(boundFiles, violations) {
  const parityPath = EXPECTED_SOURCE_BINDINGS[0].path;
  const graphPath = EXPECTED_SOURCE_BINDINGS[1].path;
  const policyPath = EXPECTED_SOURCE_BINDINGS[2].path;
  const publisherPath = EXPECTED_SOURCE_BINDINGS[3].path;
  const bindingPolicyPath = EXPECTED_SOURCE_BINDINGS[4].path;
  const callbackPath = EXPECTED_SOURCE_BINDINGS[5].path;
  const callbackHandlerPath = EXPECTED_SOURCE_BINDINGS[6].path;
  const runtimeBoundaryPath = EXPECTED_SOURCE_BINDINGS[7].path;
  const checkpointPath = EXPECTED_SOURCE_BINDINGS[8].path;
  const socialPath = EXPECTED_SOURCE_BINDINGS[9].path;
  const privacyPath = EXPECTED_SOURCE_BINDINGS[10].path;

  const parity = readJsonBinding(parityPath, boundFiles, violations);
  if (parity) {
    if (parity.profile !== "PRODUCTION" || parity.status !== "BLOCKED"
      || parity.zeroUnauthorizedCuts !== true || parity.allFeatureRowsMapped !== true
      || !Array.isArray(parity.featureRows) || parity.featureRows.length !== 53) {
      violations.push(`${parityPath}: must preserve all 53 retained rows, zero unauthorized cuts, and BLOCKED production truth`);
    } else {
      for (const expected of AUDITED_FEATURES) {
        const row = parity.featureRows.find(({ ordinal }) => ordinal === expected.ordinal);
        if (row?.capability !== expected.capability) {
          violations.push(`${parityPath}: retained feature ${expected.ordinal} must remain ${expected.capability}`);
        }
      }
    }
    requireFalse(parity, [
      "productionParityPacketComplete",
      "releaseSurfaceClaimsPacketComplete",
      "activationReady",
      "deploymentAuthorized",
      "mainnetExecutionAuthorized",
    ], parityPath, violations);
    if (parity.mainnetStatus !== "HOLD") violations.push(`${parityPath}.mainnetStatus: must remain HOLD`);
  }

  const graph = readJsonBinding(graphPath, boundFiles, violations);
  if (graph) {
    if (graph.profile !== "PRODUCTION" || graph.status !== "BLOCKED" || graph.mainnetStatus !== "HOLD") {
      violations.push(`${graphPath}: must remain production BLOCKED/HOLD`);
    }
    requireFalse(graph, [
      "externalTruthVerified",
      "runtimeAuthenticationVerified",
      "providerEvidenceVerified",
      "rollbackProtectionVerified",
      "runtimeEnforcementVerified",
      "activationReady",
      "releaseAuthorizationVerified",
      "mainnetExecutionAuthorized",
    ], graphPath, violations);
    for (const id of REQUIRED_DEPENDENCY_NODE_IDS) {
      const node = graph.nodes?.find((candidate) => candidate.id === id);
      if (!node || node.status !== "BLOCKED" || node.completionEvidence !== null) {
        violations.push(`${graphPath}: ${id} must remain BLOCKED with null completion evidence`);
      }
    }
  }

  const policy = readJsonBinding(policyPath, boundFiles, violations);
  if (policy) {
    if (policy.schema !== "star-ascent-daily-rewards-policy/v2"
      || policy.status !== "HOLD_PENDING_GLOBAL_REWARD_WATERFALL"
      || policy.publicationAllowed !== false
      || policy.globalRewardWaterfall?.implemented !== false
      || policy.globalRewardWaterfall?.publicationAllowed !== false
      || policy.distribution?.serverSigningAllowed !== false
      || policy.distribution?.automaticBroadcastAllowed !== false) {
      violations.push(`${policyPath}: V2 reward publication, signing, and broadcast must remain source-bound disabled`);
    }
    if (!sameJson(policy.identityModel?.recognizedSubscriptionTypes, ["None", "Basic", "Premium", "PremiumPlus"])
      || !sameJson(policy.identityModel?.tenPercentSubscriptionTypes, ["None", "Basic"])
      || !sameJson(policy.identityModel?.fullRewardSubscriptionTypes, ["Premium", "PremiumPlus"])
      || policy.payoutTiers?.trancheBasisPoints?.X_BASE_10 !== 1000
      || policy.payoutTiers?.trancheBasisPoints?.X_PREMIUM_UPGRADE_90 !== 9000
      || policy.payoutTiers?.trancheBasisPoints?.X_PREMIUM_FULL_100 !== 10000) {
      violations.push(`${policyPath}: retained V2 10/90/100 tier semantics drifted`);
    }
  }

  const publisher = readTextBinding(publisherPath, boundFiles, violations);
  for (const marker of [
    "policy.schema !== \"star-ascent-daily-rewards-policy/v1\"",
    "policy.publicationAllowed !== true",
    "policy.globalRewardWaterfall?.publicationAllowed !== true",
    "legacy v1 reward manifest publication is HOLD",
  ]) {
    if (!publisher.includes(marker)) violations.push(`${publisherPath}: missing fail-closed marker ${marker}`);
  }

  const bindingPolicy = readTextBinding(bindingPolicyPath, boundFiles, violations);
  if (!bindingPolicy.includes('ALLOWED_X_SUBSCRIPTION_TYPES = Object.freeze(["Premium", "PremiumPlus"])')
    || !bindingPolicy.includes("export const NODE_ACTIVATION_SQL")
    || !bindingPolicy.includes("export const GENESIS_SLOT_RESERVATION_SQL")) {
    violations.push(`${bindingPolicyPath}: legacy Premium-only activation/reservation truth drifted`);
  }

  const callback = readTextBinding(callbackPath, boundFiles, violations);
  if (!callback.includes("createRetainedV2CallbackHandler({ runtimeEnv: env })")) {
    violations.push(`${callbackPath}: shipped route must use the unconfigured retained-V2 fail-closed handler`);
  }
  for (const forbidden of ["NODE_ACTIVATION_SQL", "GENESIS_SLOT_RESERVATION_SQL", "env.DB.batch", "runtimeBoundary:", "resolveRuntimeEvidence:", "applyRetainedV2Write:"]) {
    if (callback.includes(forbidden)) violations.push(`${callbackPath}: shipped route must not contain runtime write escape ${forbidden}`);
  }

  const callbackHandler = readTextBinding(callbackHandlerPath, boundFiles, violations);
  for (const marker of [
    "runtimeBoundary?.runtimeConfigured !== true",
    "typeof resolveRuntimeEvidence !== \"function\"",
    "typeof applyRetainedV2Write !== \"function\"",
    "runtimeBoundary.runAuthorizedMutation",
    "isRetainedV2SubscriptionType(subscriptionType)",
  ]) {
    if (!callbackHandler.includes(marker)) violations.push(`${callbackHandlerPath}: missing retained-V2 fail-closed marker ${marker}`);
  }
  for (const forbidden of ["NODE_ACTIVATION_SQL", "GENESIS_SLOT_RESERVATION_SQL", ".DB.batch", ".DB.run("]) {
    if (callbackHandler.includes(forbidden)) violations.push(`${callbackHandlerPath}: legacy or direct D1 write marker remains: ${forbidden}`);
  }

  const runtimeBoundary = readTextBinding(runtimeBoundaryPath, boundFiles, violations);
  for (const marker of [
    "RUNTIME_VERIFIERS_UNAVAILABLE",
    "RUNTIME_EVIDENCE_REPLAYED",
    "RETAINED_V2_WRITE_AUTHORIZATION_INVALID_OR_CONSUMED",
    "X_BASE_10",
    "X_PREMIUM_UPGRADE_90",
    "X_PREMIUM_FULL_100",
  ]) {
    if (!runtimeBoundary.includes(marker)) violations.push(`${runtimeBoundaryPath}: missing fail-closed or retained-V2 marker ${marker}`);
  }

  const checkpoint = readJsonBinding(checkpointPath, boundFiles, violations);
  if (checkpoint) {
    if (checkpoint.profile !== "PRODUCTION" || checkpoint.readiness !== "BLOCKED"
      || checkpoint.referenceContract?.providerIntegrationPresent !== false
      || checkpoint.mainnetStatus !== "HOLD"
      || !checkpoint.controlRequirements?.every(({ status, evidence }) => status === "BLOCKED" && evidence === null)) {
      violations.push(`${checkpointPath}: external checkpoint integration must remain absent and every production control BLOCKED`);
    }
    requireFalse(checkpoint, [
      "runtimeAuthenticationVerified",
      "externalMonotonicityVerified",
      "rollbackProtectionVerified",
      "activationReady",
    ], checkpointPath, violations);
  }

  const social = readJsonBinding(socialPath, boundFiles, violations);
  if (social) {
    if (social.profile !== "PRODUCTION" || social.readiness !== "BLOCKED"
      || social.referenceContract?.providerIntegrationPresent !== false
      || social.mainnetStatus !== "HOLD"
      || !social.controlRequirements?.every(({ status, evidence }) => status === "BLOCKED" && evidence === null)) {
      violations.push(`${socialPath}: X provider integration must remain absent and every production control BLOCKED`);
    }
    requireFalse(social, [
      "providerEvidenceAuthenticationVerified",
      "collectorCompletenessVerified",
      "walletBindingAuthenticationVerified",
      "allocatorLineageAuthenticationVerified",
      "externalMonotonicityVerified",
      "rollbackProtectionVerified",
      "runtimeConsumerGatingVerified",
      "activationReady",
      "mainnetOrReleaseReady",
    ], socialPath, violations);
  }

  const privacy = readJsonBinding(privacyPath, boundFiles, violations);
  if (privacy) {
    const checks = privacy.constructionChecks;
    if (privacy.status !== "ACCOUNT_LOCAL_UNSIGNED_INSTRUCTION_PREREQUISITE_COMPLETE_RELEASE_HOLD"
      || privacy.accountLocalInstructionPrerequisiteComplete !== true
      || privacy.privacyVaultLifecycleComplete !== false
      || checks?.runtimeDailyLawAuthenticated !== false
      || checks?.instructionSigned !== false
      || checks?.rpcPerformed !== false
      || checks?.tokenCpiExecuted !== false
      || checks?.instructionSubmitted !== false
      || checks?.chainStateMutated !== false
      || privacy.mainnetStatus !== "HOLD") {
      violations.push(`${privacyPath}: privacy boundary must remain unsigned, inert, unauthenticated, lifecycle-incomplete, and HOLD`);
    }
    requireFalse(privacy, [
      "privacyVaultLifecycleComplete",
      "devnetVerified",
      "activationReady",
      "releaseAuthorizationVerified",
      "mainnetExecutionAuthorized",
    ], privacyPath, violations);
  }

  for (const binding of EXPECTED_SOURCE_BINDINGS.slice(11, 14)) {
    const source = readTextBinding(binding.path, boundFiles, violations);
    if (!source.includes("activationReady") || !source.includes("mainnetStatus")) {
      violations.push(`${binding.path}: reference nonactivation truth markers are absent`);
    }
  }
}

export function validateRewardProviderPrivacyEnforcementClosure(manifest, options = {}) {
  const violations = [];
  if (!exactKeys(manifest, TOP_LEVEL_KEYS, "manifest", violations)) {
    return {
      valid: false,
      status: "INVALID",
      closureComplete: false,
      runtimeAuthenticationVerified: false,
      mainnetStatus: "HOLD",
      blockers: [],
      violations,
    };
  }

  if (manifest.schema !== ENFORCEMENT_CLOSURE_SCHEMA) violations.push(`schema: expected ${ENFORCEMENT_CLOSURE_SCHEMA}`);
  if (manifest.profile !== "PRODUCTION") violations.push("profile: must be PRODUCTION");
  if (manifest.status !== ENFORCEMENT_CLOSURE_STATUS) violations.push(`status: expected ${ENFORCEMENT_CLOSURE_STATUS}`);

  if (exactKeys(manifest.scope, SCOPE_KEYS, "scope", violations)) {
    if (manifest.scope.predicate !== "RETAINED_V2_REWARD_PROVIDER_PRIVACY_ENFORCEMENT_CLOSURE") {
      violations.push("scope.predicate: unexpected closure predicate");
    }
    if (manifest.scope.retainedParityFeatureCount !== 53) violations.push("scope.retainedParityFeatureCount: expected 53");
    if (!sameJson(manifest.scope.auditedFeatureOrdinals, AUDITED_FEATURES.map(({ ordinal }) => ordinal))) {
      violations.push("scope.auditedFeatureOrdinals: must exactly enumerate every reward/provider/privacy row in this closure");
    }
    if (!sameJson(manifest.scope.doesNotCertify, SCOPE_EXCLUSIONS)) {
      violations.push("scope.doesNotCertify: exact non-certification boundary is required");
    }
  }

  if (exactKeys(manifest.gatePolicy, GATE_POLICY_KEYS, "gatePolicy", violations)
    && !sameJson(manifest.gatePolicy, EXPECTED_GATE_POLICY)) {
    violations.push("gatePolicy: Gate 8 must remain an unsatisfied source-bound automated direct-evidence predicate; the Model T physical confirmation is the sole human gate and applies only to actual cryptographic signatures");
  }

  validateBindings(manifest, options.boundFiles, violations);
  validateFeatureRows(manifest, violations);
  validateRuntimeSurfaces(manifest, violations);
  validateDependencyRows(manifest, violations);

  if (exactKeys(manifest.terminalPredicate, TERMINAL_KEYS, "terminalPredicate", violations)) {
    const expectedTerminal = {
      auditedFeatureCount: AUDITED_FEATURES.length,
      runtimeAuthenticatedFeatureCount: 0,
      unresolvedRuntimeExposureIds: [],
      rewardPublicationDisabled: true,
      privacySubmissionDisabled: true,
      allRequiredProviderIntegrationsAbsent: true,
      closureComplete: false,
      evaluationRule: "GO_REQUIRES_EVERY_AUDITED_FEATURE_RUNTIME_AUTHENTICATED_NO_UNRESOLVED_RUNTIME_EXPOSURE_ALL_REQUIRED_DEPENDENCIES_VERIFIED_AND_EXPLICIT_RELEASE_AUTHORIZATION",
    };
    if (!sameJson(manifest.terminalPredicate, expectedTerminal)) {
      violations.push("terminalPredicate: current evidence requires the exact HOLD predicate and zero shipped-route runtime exposures");
    }
  }

  requireFalse(manifest, NEGATIVE_TRUTH_KEYS, "manifest", violations);
  if (manifest.mainnetStatus !== ENFORCEMENT_CLOSURE_MAINNET_STATUS) {
    violations.push(`mainnetStatus: must remain ${ENFORCEMENT_CLOSURE_MAINNET_STATUS}`);
  }

  validateCrossArtifactTruth(options.boundFiles, violations);

  const blockers = Array.isArray(manifest.featureRows)
    ? [...new Set(manifest.featureRows.map(({ blocker }) => blocker).filter((value) => typeof value === "string"))]
    : [];
  const valid = violations.length === 0;
  return {
    schema: ENFORCEMENT_CLOSURE_SCHEMA,
    valid,
    status: valid ? ENFORCEMENT_CLOSURE_STATUS : "INVALID",
    retainedParityFeatureCount: 53,
    auditedFeatureCount: AUDITED_FEATURES.length,
    runtimeAuthenticatedFeatureCount: 0,
    sourceBoundDisabledSurfaceIds: valid
      ? REQUIRED_RUNTIME_SURFACES.filter(({ sourceBoundDisableVerified }) => sourceBoundDisableVerified).map(({ id }) => id)
      : [],
    unresolvedRuntimeExposureIds: [],
    closureComplete: false,
    runtimeAuthenticationVerified: false,
    providerOperationalTruthVerified: false,
    collectorCompletenessVerified: false,
    externalMonotonicityVerified: false,
    rollbackProtectionVerified: false,
    runtimeConsumerGatingVerified: false,
    privacyLifecycleVerified: false,
    activationReady: false,
    releaseAuthorizationVerified: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: ENFORCEMENT_CLOSURE_MAINNET_STATUS,
    gate8Predicate: AUTOMATED_GATE_8_PREDICATE,
    gate8PredicateSatisfied: false,
    humanReviewerRequired: false,
    soleHumanGate: ENFORCEMENT_CLOSURE_SOLE_HUMAN_GATE,
    blockers,
    violations,
  };
}

export function assertRewardProviderPrivacyRuntimeAuthenticated(manifest, options = {}) {
  const result = validateRewardProviderPrivacyEnforcementClosure(manifest, options);
  if (!result.valid) {
    throw new Error(`REWARD_PROVIDER_PRIVACY_ENFORCEMENT_CLOSURE_INVALID:${result.violations.join("|")}`);
  }
  if (!result.closureComplete || !result.runtimeAuthenticationVerified) {
    throw new Error(`REWARD_PROVIDER_PRIVACY_RUNTIME_AUTHENTICATION_HOLD:${result.blockers.join("|")}`);
  }
  return result;
}

export function loadRewardProviderPrivacyEnforcementClosure(path = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function parseCli(argv) {
  let manifestPath = DEFAULT_MANIFEST_PATH;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--manifest" || !argv[index + 1]) {
      throw new Error(`unknown or incomplete argument: ${argv[index]}`);
    }
    manifestPath = resolve(argv[index + 1]);
    index += 1;
  }
  return { manifestPath };
}

function main() {
  let manifest;
  try {
    const { manifestPath } = parseCli(process.argv.slice(2));
    manifest = loadRewardProviderPrivacyEnforcementClosure(manifestPath);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  const result = validateRewardProviderPrivacyEnforcementClosure(manifest);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.valid ? 2 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
