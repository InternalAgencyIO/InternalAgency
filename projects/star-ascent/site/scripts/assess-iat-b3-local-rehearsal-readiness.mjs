#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  realpathSync,
  statfsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  isAbsolute,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  REQUIRED_ALL_FEATURE_DEVNET_FAILURE_POLICY,
  canonicalSha256,
  extractCanonicalCeremonyStages,
} from "./assess-iat-b3-all-feature-devnet-readiness.mjs";
import {
  COMBINED_LAW_BUILD_RECEIPT_SCHEMA,
  observeExactSource,
  readExactCommittedFile,
  validateCombinedLawBuildReceipt,
} from "./run-iat-b3-combined-law-reproducible-build.mjs";
import {
  ECONOMY_BUILD_RECEIPT_SCHEMA,
  deriveEconomyProductionBuildEnvironment,
  validateEconomyBuildReceipt,
} from "./run-iat-b3-economy-reproducible-build.mjs";
import { measureFinalizerInfluence } from "./measure-iat-b3-daily-law-finalizer-influence.mjs";
import {
  isCanonicalBase58Key,
  parseIdentityFreezeJson,
  validateIdentityFreezeManifest,
} from "./validate-iat-b3-identity-freeze.mjs";
import { parseB3OwnerPolicyFreezeJson } from "./validate-iat-b3-owner-policy-freeze.mjs";
import {
  parseProductionIdentityAuthorityEvidenceJson,
  validateProductionIdentityAuthorityEvidenceManifest,
} from "./validate-iat-b3-production-identity-authority-evidence.mjs";

export const LOCAL_REHEARSAL_READINESS_INPUT_SCHEMA =
  "iat-b3-local-rehearsal-readiness-input/v1";
export const LOCAL_REHEARSAL_READINESS_SCHEMA =
  "iat-b3-local-rehearsal-readiness-assessment/v2";
export const LOCAL_REHEARSAL_READY = "READY";
export const LOCAL_REHEARSAL_HOLD = "HOLD";

const SITE_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const RUNNER_PATH = fileURLToPath(import.meta.url);
const RUNNER_REPOSITORY_PATH =
  "projects/star-ascent/site/scripts/assess-iat-b3-local-rehearsal-readiness.mjs";
const PRODUCTION_INSTRUCTION_PATH = resolve(
  SITE_ROOT,
  "programs/iat_b3_economy/src/production_instruction.rs",
);
const PRODUCTION_DISPATCH_PATH = resolve(
  SITE_ROOT,
  "programs/iat_b3_economy/src/production_dispatch.rs",
);
const PRODUCTION_ENTRYPOINT_PATH = resolve(
  SITE_ROOT,
  "programs/iat_b3_economy/src/production_entrypoint.rs",
);
const CLAIM_LANE_EXECUTOR_PATH = resolve(
  SITE_ROOT,
  "programs/iat_b3_economy/src/production_claim_lane_principal_executor.rs",
);
const CONSENSUS_PATH = resolve(SITE_ROOT, "programs/iat_b3_consensus/src/lib.rs");
const LAW_PATH = resolve(SITE_ROOT, "programs/iat_b3_law/src/lib.rs");
const IDENTITY_PATH = resolve(SITE_ROOT, "docs/b3/iat-b3-identity-freeze.v1.json");
const OWNER_POLICY_PATH = resolve(SITE_ROOT, "docs/b3/iat-b3-owner-policy-freeze.v1.json");
const AUTHORITY_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-production-identity-authority-evidence.v1.json",
);
const HEX_SHA1 = /^[0-9a-f]{40}$/u;
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const GIBIBYTE = 1024 ** 3;

export const LOCAL_REHEARSAL_DISK_POLICY = Object.freeze({
  minimumFreeBytes: 24 * GIBIBYTE,
  estimatedDisposableLedgersArtifactsAndLogsBytes: 16 * GIBIBYTE,
  requiredPostRehearsalReserveBytes: 8 * GIBIBYTE,
  buildCachesIncluded: false,
  artifactBuildPermittedByThisCommand: false,
});

export const LOCAL_REHEARSAL_TOOLCHAIN_POLICY = Object.freeze({
  hostPlatform: "linux",
  hostArchitecture: "x64",
  nodeMinimum: "22.13.0",
  testNode: "24.14.0",
  bash: "GNU bash",
  rustc: "1.97.1",
  cargo: "1.97.1",
  cargoBuildSbf: "solana-cargo-build-sbf 3.1.10",
  platformTools: "platform-tools v1.52",
  sbfRustc: "rustc 1.89.0",
  solanaCli: "3.1.10",
  solanaKeygen: "3.1.10",
  solanaTestValidator: "3.1.10",
  splToken: "spl-token-cli 5.5.0",
  sha256UtilityRequired: true,
});

export const LOCAL_REHEARSAL_FAILURE_POLICY = Object.freeze({
  networkBoundary: "LOOPBACK_ONLY_NO_PUBLIC_RPC",
  automaticRetry: false,
  automaticCompensation: false,
  ambiguousSendAction: "STOP_PRESERVE_AND_RECONCILE_BEFORE_ANY_RETRY",
  expectedFailureRequiresExactPreAndPostSnapshotEquality: true,
  successfulMutationFollowedByAbort:
    "STOP_VALIDATOR_DISCARD_DISPOSABLE_LEDGER_RESTART_FROM_STAGE_1",
  authorityRevocationOnlyAfterExactByteVerification: true,
  temporaryKeysAndLedgerMustRemainInsideOneSafetyCheckedDirectory: true,
  validatorMustStopOnSuccessFailureOrSignal: true,
  cleanupMustNeverWidenBeyondCreatedTemporaryRoot: true,
  publicClusterWritesForbidden: true,
  signingPermittedByPreflight: false,
  rpcPermittedByPreflight: false,
  inheritedPublicClusterPolicy: REQUIRED_ALL_FEATURE_DEVNET_FAILURE_POLICY,
});

export const LOCAL_REHEARSAL_ROLLBACK_CASES = Object.freeze([
  Object.freeze({
    id: "PREREQUISITE_HOLD_BEFORE_PROCESS_START",
    expected: "NO_VALIDATOR_NO_KEY_NO_LEDGER_NO_TRANSACTION",
  }),
  Object.freeze({
    id: "VALIDATOR_START_OR_HEALTH_FAILURE",
    expected: "STOP_CHILD_AND_REMOVE_ONLY_CREATED_DISPOSABLE_ROOT",
  }),
  Object.freeze({
    id: "MISSING_STALE_LOCKED_OR_FORGED_DAILY_LAW",
    expected: "REJECTION_AND_EXACT_ACCOUNT_BYTE_BALANCE_DELEGATE_EQUALITY",
  }),
  Object.freeze({
    id: "POLICY_HELD_CCC_DISABLED_OR_CORE_CUSTODY_OPCODE",
    expected: "OPCODE_SPECIFIC_REJECTION_AND_NO_ACCOUNT_MUTATION",
  }),
  Object.freeze({
    id: "ACTIVE_OPCODE_ADVERSARIAL_FAILURE",
    expected: "ATOMIC_REJECTION_AND_ALL_TOUCHED_ACCOUNTS_UNCHANGED",
  }),
  Object.freeze({
    id: "POST_STAGE_INVARIANT_OR_IDENTITY_MISMATCH",
    expected: "STOP_BEFORE_NEXT_STAGE_DISCARD_LEDGER_AND_RESTART_FROM_STAGE_1",
  }),
  Object.freeze({
    id: "AMBIGUOUS_LOCAL_SEND_OR_TIMEOUT",
    expected: "NO_BLIND_RETRY_RECONCILE_SIGNATURE_LOG_AND_ACCOUNT_SNAPSHOTS",
  }),
  Object.freeze({
    id: "PRE_REVOCATION_BINARY_MISMATCH",
    expected: "ABORT_WITH_AUTHORITY_INTACT_NO_AUTOMATIC_UPGRADE",
  }),
  Object.freeze({
    id: "POST_REVOCATION_LATER_STAGE_FAILURE",
    expected: "NO_CODE_ROLLBACK_DISCARD_WHOLE_DISPOSABLE_LEDGER",
  }),
  Object.freeze({
    id: "CLEANUP_BOUNDARY_OR_PROCESS_STOP_FAILURE",
    expected: "HOLD_PRESERVE_DIAGNOSTICS_AND_NEVER_BROAD_DELETE",
  }),
]);

const ROUTE_DISPOSITIONS = Object.freeze({
  CompleteInitializationPolicyHold: "INITIALIZATION_POLICY_HOLD",
  CompleteSettleCoreWeekPolicyHold: "CORE_CUSTODY_HOLD",
  CompleteSetEligibility: "ACTIVE",
  CompleteOpenPosition: "ACTIVE",
  CompleteSettlePositionWeek: "ACTIVE",
  CompleteClaimLanePrincipal: "ACTIVE",
  CompleteWithdrawPosition: "ACTIVE",
  CompleteClosePosition: "ACTIVE",
  CompleteDisabledRound: "CCC_DISABLED",
  Unavailable: "CORE_CUSTODY_HOLD",
});

const INPUT_KEYS = Object.freeze([
  "schema",
  "declaredHeadSha",
  "identityBinding",
  "artifacts",
]);
const IDENTITY_KEYS = Object.freeze([
  "policy",
  "lawProgramId",
  "economyProgramId",
  "canonicalMint",
  "networkGenesisHash",
  "bindingSha256",
]);
const ARTIFACT_SET_KEYS = Object.freeze(["law", "economy"]);
const ARTIFACT_KEYS = Object.freeze([
  "kind",
  "path",
  "sha256",
  "byteLength",
  "sourceHeadSha",
  "identityBindingSha256",
  "firstBuildSha256",
  "firstBuildByteLength",
  "firstBuildLogSha256",
  "secondBuildSha256",
  "secondBuildByteLength",
  "secondBuildLogSha256",
  "receiptPath",
  "receiptSha256",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function freezeResult(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) freezeResult(child);
  }
  return Object.freeze(value);
}

export function projectCombinedLawBuildReceiptForLocalRehearsal(receipt) {
  const validated = validateCombinedLawBuildReceipt(receipt);
  return freezeResult({
    kind: "LAW",
    schema: validated.schema,
    validated: true,
    recordSha256: validated.receiptSha256,
    sourceHeadSha: validated.source.declaredHeadSha,
    identityManifestSha256: validated.identityBinding.manifestSha256,
    identityEnvironmentSha256:
      validated.identityBinding.environmentBindingSha256,
    artifactFileName: validated.artifact.fileName,
    artifactSha256: validated.artifact.sha256,
    artifactByteLength: validated.artifact.byteLength,
    firstBuildSha256: validated.artifact.firstBuildSha256,
    firstBuildLogSha256: validated.artifact.firstBuildLogSha256,
    secondBuildSha256: validated.artifact.secondBuildSha256,
    secondBuildLogSha256: validated.artifact.secondBuildLogSha256,
    preservedArtifactSha256: validated.artifact.preservedArtifactSha256,
    preservedArtifactByteLength:
      validated.artifact.preservedArtifactByteLength,
  });
}

export function projectEconomyBuildReceiptForLocalRehearsal(receipt) {
  const validated = validateEconomyBuildReceipt(receipt);
  return freezeResult({
    kind: "ECONOMY",
    schema: validated.schema,
    validated: true,
    recordSha256: validated.receiptSha256,
    sourceHeadSha: validated.source.declaredHeadSha,
    identityManifestSha256: validated.identityBinding.manifestSha256,
    identityEnvironmentSha256:
      validated.identityBinding.environmentBindingSha256,
    artifactFileName: validated.artifact.fileName,
    artifactSha256: validated.artifact.sha256,
    artifactByteLength: validated.artifact.byteLength,
    firstBuildSha256: validated.artifact.firstBuildSha256,
    firstBuildLogSha256: validated.artifact.firstBuildLogSha256,
    secondBuildSha256: validated.artifact.secondBuildSha256,
    secondBuildLogSha256: validated.artifact.secondBuildLogSha256,
    preservedArtifactSha256: validated.artifact.preservedArtifactSha256,
    preservedArtifactByteLength:
      validated.artifact.preservedArtifactByteLength,
  });
}

function exactKeys(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isWithin(parent, candidate) {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function camelToSnake(value) {
  return value.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
}

function snakeToUpper(value) {
  return value.toUpperCase();
}

function extractRustInteger(source, name) {
  const match = source.match(new RegExp(
    `pub\\s+const\\s+${name}\\s*:\\s*(?:u8|u16|u64|usize|i128)\\s*=\\s*([0-9_]+)\\s*;`,
    "u",
  ));
  if (!match) throw new Error(`R01_SOURCE_CONSTANT_${name}_MISSING`);
  const value = Number(match[1].replaceAll("_", ""));
  if (!Number.isSafeInteger(value)) throw new Error(`R01_SOURCE_CONSTANT_${name}_INVALID`);
  return value;
}

function extractInstructionVariants(source) {
  const match = source.match(/pub\s+enum\s+ProductionInstruction\s*\{([\s\S]*?)\n\}/u);
  if (!match) throw new Error("R01_PRODUCTION_INSTRUCTION_ENUM_MISSING");
  const variants = [];
  const matcher = /^\s*([A-Z][A-Za-z0-9]*)(?:\s*\{[^}]*\})?\s*,?\s*$/gmu;
  for (const variant of match[1].matchAll(matcher)) variants.push(variant[1]);
  if (variants.length !== 15 || new Set(variants).size !== 15) {
    throw new Error("R01_PRODUCTION_INSTRUCTION_ENUM_NOT_EXACT_15");
  }
  return variants;
}

function extractRouteMap(dispatchSource) {
  const functionIndex = dispatchSource.indexOf("pub const fn production_handler_route");
  if (functionIndex < 0) throw new Error("R01_PRODUCTION_HANDLER_ROUTE_MISSING");
  const routes = new Map();
  const functionTail = dispatchSource.slice(functionIndex);
  const armPattern = /((?:ProductionInstruction::[A-Z][A-Za-z0-9]*(?:\s*\{[^}]*\})?\s*\|\s*)*ProductionInstruction::[A-Z][A-Za-z0-9]*(?:\s*\{[^}]*\})?)\s*=>\s*(?:\{\s*)?ProductionHandlerRoute::([A-Z][A-Za-z0-9]*)\s*(?:\})?\s*,?/gu;
  for (const arm of functionTail.matchAll(armPattern)) {
    const variants = [...arm[1].matchAll(
      /ProductionInstruction::([A-Z][A-Za-z0-9]*)/gu,
    )].map((match) => match[1]);
    const route = arm[2];
    if (variants.length === 0 || !route || ROUTE_DISPOSITIONS[route] === undefined) {
      throw new Error("R01_PRODUCTION_HANDLER_ROUTE_ARM_INVALID");
    }
    for (const variant of variants) {
      if (routes.has(variant)) throw new Error(`R01_DUPLICATE_ROUTE_${variant}`);
      routes.set(variant, route);
    }
  }
  return routes;
}

export function deriveProductionOpcodeDispositions({
  instructionSource,
  dispatchSource,
  entrypointSource,
  claimLaneExecutorSource,
} = {}) {
  if ([instructionSource, dispatchSource, entrypointSource, claimLaneExecutorSource]
    .some((source) => typeof source !== "string" || source.length === 0)) {
    throw new TypeError("R01 production instruction, dispatch, entrypoint, and claim-lane executor sources are required");
  }
  const count = extractRustInteger(instructionSource, "PRODUCTION_INSTRUCTION_COUNT");
  if (count !== 15) throw new Error("R01_PRODUCTION_INSTRUCTION_COUNT_DRIFT");
  const variants = extractInstructionVariants(instructionSource);
  const routes = extractRouteMap(dispatchSource);
  const dispositions = variants.map((variant, opcode) => {
    const name = camelToSnake(variant);
    const constantName = `${snakeToUpper(name)}_OPCODE`;
    const observedOpcode = extractRustInteger(instructionSource, constantName);
    const route = routes.get(variant);
    if (observedOpcode !== opcode || !route) {
      throw new Error(`R01_OPCODE_OR_ROUTE_DRIFT_${variant}`);
    }
    let conditionalDisposition = null;
    if (variant === "ClaimLanePrincipal") {
      const dispatcherTruth = dispatchSource.includes(
        "claim_lane_principal_non_core_routed: true",
      ) && dispatchSource.includes("claim_lane_principal_core_policy_held: true");
      const conditionalExecutorIndex = claimLaneExecutorSource.indexOf(
        "pub(crate) fn execute_runtime_production_claim_lane_principal_with_daily_law_prefix_account_infos",
      );
      const conditionalExecutor = conditionalExecutorIndex < 0
        ? ""
        : claimLaneExecutorSource.slice(conditionalExecutorIndex);
      const laneClassificationIndex = conditionalExecutor.indexOf("match lane {");
      const operationAccountReadIndex = conditionalExecutor.indexOf("operation_accounts.len()");
      const executorTruth = claimLaneExecutorSource.includes(
        "non_core_lane_filter_precedes_account_reads: true",
      ) && claimLaneExecutorSource.includes(
        "core_team_policy_hold_precedes_account_reads: true",
      ) && claimLaneExecutorSource.includes(
        "invalid_lane_rejected_before_account_reads: true",
      ) && /match\s+lane\s*\{[\s\S]*TREASURY\s*\|\s*ECOSYSTEM\s*\|\s*LIQUIDITY\s*=>\s*\{\}[\s\S]*CORE_TEAM\s*=>\s*\{[\s\S]*CoreCustodyPolicyHold[\s\S]*_\s*=>[\s\S]*InvalidLane/u
        .test(conditionalExecutor)
        && laneClassificationIndex >= 0
        && operationAccountReadIndex > laneClassificationIndex;
      if (!dispatcherTruth || !executorTruth) {
        throw new Error("R01_OPCODE_9_CONDITIONAL_CORE_CUSTODY_TRUTH_MISSING");
      }
      conditionalDisposition = Object.freeze({
        payloadField: "lane",
        supportedNonCoreLanes: Object.freeze(["TREASURY", "ECOSYSTEM", "LIQUIDITY"]),
        supportedNonCoreDisposition: "ACTIVE",
        coreLane: "CORE_TEAM",
        coreLaneDisposition: "CORE_CUSTODY_HOLD",
        invalidLaneDisposition: "INVALID_LANE_HOLD",
        classificationBeforeOperationAccountRead: true,
        coreLaneExpectedMutation: "NONE",
      });
    }
    return Object.freeze({
      opcode,
      name,
      variant,
      route,
      disposition: ROUTE_DISPOSITIONS[route],
      conditionalDisposition,
      dailyLawAuthenticatedFirst: true,
      expectedMutation: ROUTE_DISPOSITIONS[route] === "ACTIVE"
        ? "OPERATION_DEPENDENT_ATOMIC_MUTATION_ONLY_ON_SUCCESS"
        : "NONE",
    });
  });
  if (routes.size !== dispositions.length) throw new Error("R01_ROUTE_SET_NOT_EXACT_15");
  const counts = Object.fromEntries(
    [
      "ACTIVE",
      "INITIALIZATION_POLICY_HOLD",
      "CCC_DISABLED",
      "CORE_CUSTODY_HOLD",
    ].map((kind) => [
      kind,
      dispositions.filter(({ disposition }) => disposition === kind).length,
    ]),
  );
  const sourceCounts = {
    active: extractRustInteger(dispatchSource, "PRODUCTION_ACTIVE_HANDLER_COUNT"),
    policyHeldIncludingCore:
      extractRustInteger(dispatchSource, "PRODUCTION_POLICY_HELD_HANDLER_COUNT"),
    cccDisabled: extractRustInteger(dispatchSource, "PRODUCTION_DISABLED_HANDLER_COUNT"),
    unavailable: extractRustInteger(dispatchSource, "PRODUCTION_UNAVAILABLE_HANDLER_COUNT"),
  };
  if (counts.ACTIVE !== sourceCounts.active
    || counts.INITIALIZATION_POLICY_HOLD + counts.CORE_CUSTODY_HOLD
      !== sourceCounts.policyHeldIncludingCore + sourceCounts.unavailable
    || counts.CCC_DISABLED !== sourceCounts.cccDisabled
    || Object.values(counts).reduce((sum, value) => sum + value, 0) !== 15) {
    throw new Error("R01_PRODUCTION_DISPOSITION_COUNT_DRIFT");
  }
  const lawCheckIndex = entrypointSource.indexOf("verify_runtime_daily_law_open_account_info");
  const dispatchIndex = entrypointSource.indexOf("dispatch_authenticated_production_instruction(");
  if (lawCheckIndex < 0 || dispatchIndex <= lawCheckIndex) {
    throw new Error("R01_DAILY_LAW_NOT_AUTHENTICATED_BEFORE_DISPATCH");
  }
  return freezeResult({
    count,
    counts,
    sourceCounts,
    all15Active: counts.ACTIVE === 15,
    expectedDispositionRehearsalSupported: true,
    fullCeremonyCompletionExpected:
      counts.INITIALIZATION_POLICY_HOLD === 0 && counts.CORE_CUSTODY_HOLD === 0,
    dispositions,
    sourceBindings: {
      productionInstructionSha256: sha256(instructionSource),
      productionDispatchSha256: sha256(dispatchSource),
      productionEntrypointSha256: sha256(entrypointSource),
      claimLaneExecutorSha256: sha256(claimLaneExecutorSource),
    },
    bindingSha256: canonicalSha256(dispositions),
  });
}

export function deriveLawBoundaryAndGrindingPlan({
  consensusSource,
  lawSource,
  measurement = measureFinalizerInfluence(),
} = {}) {
  if (typeof consensusSource !== "string" || typeof lawSource !== "string") {
    throw new TypeError("R01 consensus and law sources are required");
  }
  const constants = Object.freeze({
    protocolUtcOffsetSeconds: extractRustInteger(consensusSource, "IAT_PROTOCOL_OFFSET_SECONDS"),
    decisionLocalSecond: extractRustInteger(consensusSource, "DAILY_DECISION_LOCAL_SECOND"),
    secondsPerDay: extractRustInteger(consensusSource, "SECONDS_PER_DAY"),
    normalNumerator: extractRustInteger(consensusSource, "NORMAL_DAY_LOCKDOWN_NUMERATOR"),
    fridayNumerator: extractRustInteger(consensusSource, "FRIDAY_LOCKDOWN_NUMERATOR"),
    denominator: extractRustInteger(consensusSource, "DRAW_DENOMINATOR"),
    entropyLagSlots: extractRustInteger(lawSource, "ENTROPY_LAG_SLOTS"),
  });
  if (canonicalJson(constants) !== canonicalJson({
    protocolUtcOffsetSeconds: 10_800,
    decisionLocalSecond: 60,
    secondsPerDay: 86_400,
    normalNumerator: 100,
    fridayNumerator: 6_667,
    denominator: 10_000,
    entropyLagSlots: 150,
  })
    || !consensusSource.includes("Map every Unix second into the half-open protocol day")
    || !lawSource.includes(".checked_sub(ENTROPY_LAG_SLOTS)")
    || !lawSource.includes(".find(|(slot, _)| *slot <= target_slot)")) {
    throw new Error("R01_DAILY_LAW_BOUNDARY_OR_ENTROPY_RULE_DRIFT");
  }
  if (measurement?.findings?.openOutcomeSelectableByWaitingInConsecutiveSyntheticTrace !== true
    || measurement?.findings?.skippedSlotsReduceDistinctCandidateCount !== true
    || measurement?.scenarios?.modeledForkAlternatives?.divergentOutcomePairCount <= 0
    || measurement?.findings?.permissionlessCompetitionEliminatesTimingInfluence !== false
    || measurement?.findings?.empiricalMainnetOrDevnetMeasurementComplete !== false) {
    throw new Error("R01_DAILY_LAW_GRINDING_VECTOR_DRIFT");
  }
  const boundaryVectors = [
    ["LOCAL_00_00_59_PRIOR_DAY", "PRIOR_PROTOCOL_DAY"],
    ["LOCAL_00_01_00_NEW_DAY", "NEW_PROTOCOL_DAY"],
    ["NEGATIVE_UNIX_SECOND_FLOOR_DIVISION", "SAME_HALF_OPEN_RULE"],
    ["MISSING_CURRENT_DECISION", "DAY_UNFINALIZED"],
    ["STALE_PRIOR_DAY_DECISION", "DAY_UNFINALIZED"],
    ["CURRENT_OPEN_DECISION", "ALLOWED"],
    ["CURRENT_LOCKED_DECISION", "DAILY_LOCKDOWN"],
    ["FORGED_BUCKET_OR_BINDING", "STATE_CORRUPT"],
    ["NORMAL_DAY_BUCKET_99", "LOCKED"],
    ["NORMAL_DAY_BUCKET_100", "OPEN"],
    ["FRIDAY_BUCKET_6666", "LOCKED"],
    ["FRIDAY_BUCKET_6667", "OPEN"],
    ["CURRENT_SLOT_149", "ENTROPY_UNAVAILABLE"],
    ["SKIPPED_TARGET_SLOT", "NEWEST_RETAINED_SLOT_AT_OR_BEFORE_TARGET"],
    ["SAME_DAY_REROLL", "DAY_ALREADY_FINALIZED"],
    ["CONSECUTIVE_SELECTED_DAYS", "NO_FORCED_OPEN_DAY"],
  ].map(([id, expected]) => Object.freeze({ id, expected }));
  const grindingVectors = [
    Object.freeze({
      id: "CONSECUTIVE_FINALIZER_INVOCATIONS",
      candidateCount: measurement.scenarios.consecutiveInvocationSlots.invocationCount,
      firstLockedIndex:
        measurement.scenarios.consecutiveInvocationSlots.firstLockedInvocationIndex,
      firstOpenIndex: measurement.scenarios.consecutiveInvocationSlots.firstOpenInvocationIndex,
    }),
    Object.freeze({
      id: "SKIPPED_SLOT_CANDIDATE_COLLAPSE",
      distinctCandidateCount:
        measurement.scenarios.skippedSlotTrace.distinctEntropySlotCount,
    }),
    Object.freeze({
      id: "CONGESTED_INVOCATION_OPPORTUNITIES",
      invocationCount:
        measurement.scenarios.congestedInvocationOpportunities.invocationCount,
    }),
    Object.freeze({
      id: "MODELED_FORK_ALTERNATIVES",
      divergentOutcomePairCount:
        measurement.scenarios.modeledForkAlternatives.divergentOutcomePairCount,
    }),
    Object.freeze({
      id: "PERMISSIONLESS_COMPETITION_DOES_NOT_REMOVE_TIMING_INFLUENCE",
      expected: true,
    }),
  ];
  return freezeResult({
    constants,
    boundaryVectors,
    grindingVectors,
    empiricalDevnetOrMainnetMeasurementComplete: false,
    entropyRiskAcceptance: measurement.truth.entropyRiskAcceptance,
    finalEntropyLagFrozen: measurement.truth.finalEntropyLagFrozen,
    sourceBindings: {
      consensusSha256: sha256(consensusSource),
      lawSha256: sha256(lawSource),
    },
    bindingSha256: canonicalSha256({ constants, boundaryVectors, grindingVectors }),
  });
}

function nodeVersionSupported(version) {
  const match = typeof version === "string" ? version.match(/^v?(\d+)\.(\d+)\.(\d+)$/u) : null;
  if (!match) return false;
  const observed = match.slice(1).map(Number);
  const minimum = [22, 13, 0];
  for (let index = 0; index < minimum.length; index += 1) {
    if (observed[index] > minimum[index]) return true;
    if (observed[index] < minimum[index]) return false;
  }
  return true;
}

function probeVersion(command, arguments_, runner) {
  const result = runner(command, arguments_, {
    encoding: "utf8",
    timeout: 5_000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    return Object.freeze({
      available: false,
      output: null,
      failure: result.error instanceof Error
        ? result.error.message.slice(0, 256)
        : `exit ${String(result.status)}`,
    });
  }
  return Object.freeze({
    available: true,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().slice(0, 2_048),
    failure: null,
  });
}

export function probeLocalRehearsalToolchain({
  runner = spawnSync,
  nodeVersion = process.versions.node,
} = {}) {
  return freezeResult({
    node: { available: true, output: nodeVersion, failure: null },
    bash: probeVersion("bash", ["--version"], runner),
    rustc: probeVersion("rustc", ["--version"], runner),
    cargo: probeVersion("cargo", ["--version"], runner),
    cargoBuildSbf: probeVersion("cargo", ["build-sbf", "--version"], runner),
    solana: probeVersion("solana", ["--version"], runner),
    solanaKeygen: probeVersion("solana-keygen", ["--version"], runner),
    solanaTestValidator: probeVersion("solana-test-validator", ["--version"], runner),
    splToken: probeVersion("spl-token", ["--version"], runner),
    sha256sum: probeVersion("sha256sum", ["--version"], runner),
  });
}

export function selectLocalRehearsalToolchainObservations({
  inputPath,
  toolchainObservations = null,
  runner = spawnSync,
  nodeVersion = process.versions.node,
} = {}) {
  if (toolchainObservations !== null) return toolchainObservations;
  if (inputPath !== null) return probeLocalRehearsalToolchain({ runner, nodeVersion });
  const notProbed = Object.freeze({
    available: false,
    output: null,
    failure: "NOT_PROBED_NO_INPUT_FAIL_CLOSED",
  });
  return freezeResult({
    node: { available: true, output: nodeVersion, failure: null },
    bash: notProbed,
    rustc: notProbed,
    cargo: notProbed,
    cargoBuildSbf: notProbed,
    solana: notProbed,
    solanaKeygen: notProbed,
    solanaTestValidator: notProbed,
    splToken: notProbed,
    sha256sum: notProbed,
  });
}

export function validateLocalRehearsalToolchain(observations) {
  const output = (name) => observations?.[name]?.available === true
    ? observations[name].output ?? ""
    : "";
  const checks = Object.freeze({
    node: nodeVersionSupported(output("node")),
    bash: /^GNU bash, version /u.test(output("bash")),
    rustc: /^rustc 1\.97\.1 \(/u.test(output("rustc")),
    cargo: /^cargo 1\.97\.1 \(/u.test(output("cargo")),
    cargoBuildSbf: /^solana-cargo-build-sbf 3\.1\.10$/mu.test(output("cargoBuildSbf")),
    platformTools: /^platform-tools v1\.52$/mu.test(output("cargoBuildSbf")),
    sbfRustc: /^rustc 1\.89\.0$/mu.test(output("cargoBuildSbf")),
    solana: /^solana-cli 3\.1\.10\b/mu.test(output("solana")),
    solanaKeygen: /(?:solana-keygen|solana-cli) 3\.1\.10\b/mu.test(output("solanaKeygen")),
    solanaTestValidator:
      /(?:solana-test-validator|solana-cli) 3\.1\.10\b/mu.test(output("solanaTestValidator")),
    splToken: /^spl-token-cli 5\.5\.0$/mu.test(output("splToken")),
    sha256sum: observations?.sha256sum?.available === true,
  });
  return freezeResult({
    policy: LOCAL_REHEARSAL_TOOLCHAIN_POLICY,
    ready: Object.values(checks).every(Boolean),
    checks,
    observations,
  });
}

export function observeLocalRehearsalGitSource(repositoryRoot) {
  return observeExactSource(repositoryRoot);
}

function committedRunnerSha256(repositoryRoot, headSha) {
  try {
    return sha256(readExactCommittedFile(repositoryRoot, headSha, RUNNER_REPOSITORY_PATH));
  } catch {
    return null;
  }
}

function validateIdentityPacket(packet, canonicalManifest) {
  if (!exactKeys(packet, IDENTITY_KEYS)
    || packet.policy !== "EXACT_PRODUCTION_CANDIDATE_IDENTITIES_ON_DISPOSABLE_LOCAL_LEDGER"
    || !isCanonicalBase58Key(packet.lawProgramId)
    || !isCanonicalBase58Key(packet.economyProgramId)
    || !isCanonicalBase58Key(packet.canonicalMint)
    || !isCanonicalBase58Key(packet.networkGenesisHash)
    || new Set([
      packet.lawProgramId,
      packet.economyProgramId,
      packet.canonicalMint,
    ]).size !== 3) return false;
  const bindingCore = {
    policy: packet.policy,
    lawProgramId: packet.lawProgramId,
    economyProgramId: packet.economyProgramId,
    canonicalMint: packet.canonicalMint,
    networkGenesisHash: packet.networkGenesisHash,
  };
  return packet.bindingSha256 === canonicalSha256(bindingCore)
    && packet.lawProgramId === canonicalManifest?.identities?.lawProgramId
    && packet.economyProgramId === canonicalManifest?.identities?.economyProgramId
    && packet.canonicalMint === canonicalManifest?.identities?.canonicalMint
    && packet.networkGenesisHash === canonicalManifest?.networkBinding?.genesisHash;
}

function observeArtifact(descriptor, repositoryRoot) {
  if (!exactKeys(descriptor, ARTIFACT_KEYS)
    || typeof descriptor.path !== "string"
    || typeof descriptor.receiptPath !== "string"
    || !isAbsolute(descriptor.path)
    || !isAbsolute(descriptor.receiptPath)) return null;
  const path = resolve(descriptor.path);
  const receiptPath = resolve(descriptor.receiptPath);
  const repository = realpathSync(repositoryRoot);
  if (isWithin(repository, path) || isWithin(repository, receiptPath)) return null;
  try {
    const artifactStat = lstatSync(path);
    const receiptStat = lstatSync(receiptPath);
    if (!artifactStat.isFile() || artifactStat.isSymbolicLink()
      || !receiptStat.isFile() || receiptStat.isSymbolicLink()) return null;
    const artifactBytes = readFileSync(path);
    const receiptBytes = readFileSync(receiptPath);
    if (artifactBytes.length === 0 || receiptBytes.length === 0) return null;
    let receiptBinding = null;
    if (descriptor.kind === "LAW") {
      try {
        receiptBinding = projectCombinedLawBuildReceiptForLocalRehearsal(
          parseB3OwnerPolicyFreezeJson(receiptBytes.toString("utf8"), receiptPath),
        );
      } catch {
        receiptBinding = null;
      }
    } else if (descriptor.kind === "ECONOMY") {
      try {
        receiptBinding = projectEconomyBuildReceiptForLocalRehearsal(
          parseB3OwnerPolicyFreezeJson(receiptBytes.toString("utf8"), receiptPath),
        );
      } catch {
        receiptBinding = null;
      }
    }
    return Object.freeze({
      path,
      sha256: sha256(artifactBytes),
      byteLength: artifactBytes.length,
      receiptPath,
      receiptSha256: sha256(receiptBytes),
      receiptBinding,
    });
  } catch {
    return null;
  }
}

function validateArtifactDescriptor({
  descriptor,
  observation,
  kind,
  headSha,
  identityBindingSha256,
  identityManifestSha256,
  identityEnvironmentSha256,
}) {
  const receipt = observation?.receiptBinding;
  const dockerReceiptSchema = kind === "LAW"
    ? COMBINED_LAW_BUILD_RECEIPT_SCHEMA
    : ECONOMY_BUILD_RECEIPT_SCHEMA;
  const expectedArtifactFileName = kind === "LAW" ? "iat_b3_law.so" : "iat_b3_economy.so";
  const receiptReady = ["LAW", "ECONOMY"].includes(kind)
    && receipt?.kind === kind
    && receipt?.schema === dockerReceiptSchema
    && receipt?.validated === true
    && receipt.sourceHeadSha === headSha
    && receipt.identityManifestSha256 === identityManifestSha256
    && receipt.identityEnvironmentSha256 === identityEnvironmentSha256
    && receipt.artifactFileName === expectedArtifactFileName
    && receipt.artifactSha256 === observation.sha256
    && receipt.artifactByteLength === observation.byteLength
    && receipt.firstBuildSha256 === descriptor?.firstBuildSha256
    && receipt.firstBuildLogSha256 === descriptor?.firstBuildLogSha256
    && receipt.secondBuildSha256 === descriptor?.secondBuildSha256
    && receipt.secondBuildLogSha256 === descriptor?.secondBuildLogSha256
    && receipt.preservedArtifactSha256 === observation.sha256
    && receipt.preservedArtifactByteLength === observation.byteLength;
  return exactKeys(descriptor, ARTIFACT_KEYS)
    && observation !== null
    && receiptReady
    && descriptor.kind === kind
    && descriptor.sourceHeadSha === headSha
    && descriptor.identityBindingSha256 === identityBindingSha256
    && typeof descriptor.sha256 === "string"
    && HEX_SHA256.test(descriptor.sha256)
    && descriptor.sha256 === observation.sha256
    && Number.isSafeInteger(descriptor.byteLength)
    && descriptor.byteLength > 0
    && descriptor.byteLength === observation.byteLength
    && descriptor.firstBuildSha256 === observation.sha256
    && descriptor.secondBuildSha256 === observation.sha256
    && descriptor.firstBuildByteLength === observation.byteLength
    && descriptor.secondBuildByteLength === observation.byteLength
    && HEX_SHA256.test(descriptor.firstBuildLogSha256)
    && HEX_SHA256.test(descriptor.secondBuildLogSha256)
    && descriptor.receiptSha256 === observation.receiptSha256;
}

function check(id, passed) {
  return Object.freeze({ id, passed: passed === true });
}

export function assessLocalRehearsalReadiness({
  generatedAt,
  source,
  opcodeDispositions,
  ceremonyStages,
  lawPlan,
  identityManifest,
  identityValidation,
  authorityValidation,
  toolchain,
  disk,
  inputPacket = null,
  artifactObservations = Object.freeze({ law: null, economy: null }),
} = {}) {
  const inputShapeValid = exactKeys(inputPacket, INPUT_KEYS)
    && inputPacket.schema === LOCAL_REHEARSAL_READINESS_INPUT_SCHEMA
    && HEX_SHA1.test(inputPacket.declaredHeadSha)
    && exactKeys(inputPacket.artifacts, ARTIFACT_SET_KEYS);
  const exactCleanSource = inputShapeValid
    && source?.headSha === inputPacket.declaredHeadSha
    && HEX_SHA1.test(source?.headSha)
    && HEX_SHA1.test(source?.treeSha)
    && source.statusPorcelain === "";
  const runnerMatchesHead = exactCleanSource
    && HEX_SHA256.test(source.executedRunnerSha256)
    && source.executedRunnerSha256 === source.committedRunnerSha256;
  const identityManifestReady = identityValidation?.productionCombinedArtifactBindingReady === true;
  const identityInputReady = inputShapeValid
    && validateIdentityPacket(inputPacket.identityBinding, identityManifest);
  const lawArtifactReady = inputShapeValid && validateArtifactDescriptor({
    descriptor: inputPacket.artifacts.law,
    observation: artifactObservations.law,
    kind: "LAW",
    headSha: source?.headSha,
    identityBindingSha256: inputPacket.identityBinding?.bindingSha256,
    identityManifestSha256: source?.identityManifestSha256,
    identityEnvironmentSha256: source?.lawIdentityEnvironmentSha256,
  });
  const economyArtifactReady = inputShapeValid && validateArtifactDescriptor({
    descriptor: inputPacket.artifacts.economy,
    observation: artifactObservations.economy,
    kind: "ECONOMY",
    headSha: source?.headSha,
    identityBindingSha256: inputPacket.identityBinding?.bindingSha256,
    identityManifestSha256: source?.identityManifestSha256,
    identityEnvironmentSha256: source?.economyIdentityEnvironmentSha256,
  });
  const distinctArtifacts = lawArtifactReady
    && economyArtifactReady
    && artifactObservations.law.path !== artifactObservations.economy.path
    && artifactObservations.law.receiptPath !== artifactObservations.economy.receiptPath;
  const toolchainReady = toolchain?.ready === true
    && canonicalJson(toolchain?.policy) === canonicalJson(LOCAL_REHEARSAL_TOOLCHAIN_POLICY);
  const hostReady = source?.hostPlatform === "linux" && source?.hostArchitecture === "x64";
  const diskReady = Number.isSafeInteger(disk?.freeBytes)
    && disk.freeBytes >= LOCAL_REHEARSAL_DISK_POLICY.minimumFreeBytes;
  const dispositionsReady = opcodeDispositions?.count === 15
    && Object.values(opcodeDispositions?.counts ?? {})
      .reduce((sum, value) => sum + value, 0) === 15
    && opcodeDispositions?.counts?.CCC_DISABLED >= 1;
  const ceremonyReady = ceremonyStages?.count === 17;
  const lawPlanReady = lawPlan?.boundaryVectors?.length === 16
    && lawPlan?.grindingVectors?.length === 5;
  const rollbackReady = LOCAL_REHEARSAL_ROLLBACK_CASES.length === 10;
  const checks = Object.freeze([
    check("CANONICAL_GENERATED_AT", typeof generatedAt === "string"
      && new Date(generatedAt).toISOString() === generatedAt),
    check("READINESS_INPUT_VALID", inputShapeValid),
    check("EXACT_CLEAN_COMMITTED_SOURCE", exactCleanSource),
    check("EXECUTED_RUNNER_MATCHES_HEAD", runnerMatchesHead),
    check("SOURCE_DERIVED_15_OPCODE_DISPOSITIONS", dispositionsReady),
    check("SOURCE_DERIVED_17_CEREMONY_STAGES", ceremonyReady),
    check("SOURCE_DERIVED_LAW_BOUNDARY_AND_GRINDING_PLAN", lawPlanReady),
    check("ROLLBACK_AND_ABORT_PLAN_BOUND", rollbackReady),
    check("LINUX_AMD64_LOCAL_VALIDATOR_HOST", hostReady),
    check("PINNED_LOCAL_VALIDATOR_TOOLCHAIN", toolchainReady),
    check("LOCAL_REHEARSAL_VOLUME_MINIMUM_24_GIB_FREE", diskReady),
    check("CANONICAL_PRODUCTION_IDENTITIES_READY", identityManifestReady),
    check("EXACT_REHEARSAL_IDENTITY_INPUT", identityInputReady),
    check("EXACT_LAW_ARTIFACT_DUAL_BUILD_BOUND", lawArtifactReady),
    check("EXACT_ECONOMY_ARTIFACT_DUAL_BUILD_BOUND", economyArtifactReady),
    check("LAW_ECONOMY_ARTIFACTS_AND_RECEIPTS_DISTINCT", distinctArtifacts),
  ]);
  const blockers = Object.freeze(checks.filter(({ passed }) => !passed).map(({ id }) => id));
  const status = blockers.length === 0 ? LOCAL_REHEARSAL_READY : LOCAL_REHEARSAL_HOLD;
  const core = {
    schema: LOCAL_REHEARSAL_READINESS_SCHEMA,
    status,
    exitCode: status === LOCAL_REHEARSAL_READY ? 0 : 2,
    generatedAt,
    scope: {
      decision: "READINESS_FOR_SEPARATE_LOOPBACK_EXPECTED_DISPOSITION_REHEARSAL_ONLY",
      doesNotStartValidator: true,
      doesNotBuildArtifact: true,
      doesNotGenerateKey: true,
      doesNotSign: true,
      doesNotUseRpc: true,
      doesNotBroadcast: true,
      readyDoesNotMeanAll15Active: true,
      readyDoesNotMeanCeremonyCompletes: true,
      readyDoesNotAuthorizeDevnetOrMainnet: true,
    },
    source: {
      declaredHeadSha: inputShapeValid ? inputPacket.declaredHeadSha : null,
      observedHeadSha: source?.headSha ?? null,
      observedTreeSha: source?.treeSha ?? null,
      repositoryCleanTrackedAndNonignoredUntracked: source?.statusPorcelain === "",
      dirtyEntryCount: typeof source?.statusPorcelain === "string"
        ? source.statusPorcelain.split("\0").filter(Boolean).length
        : null,
      executedRunnerSha256: source?.executedRunnerSha256 ?? null,
      committedRunnerSha256: source?.committedRunnerSha256 ?? null,
      exactCleanCommittedSource: exactCleanSource,
      runnerMatchesHead,
    },
    opcodeDispositions,
    ceremonyStages: {
      ...ceremonyStages,
      evidenceComplete: authorityValidation?.phaseCComplete === true,
      fullCompletionExpectedUnderCurrentDispositions:
        opcodeDispositions?.fullCeremonyCompletionExpected === true,
    },
    lawPlan,
    rollback: {
      policy: LOCAL_REHEARSAL_FAILURE_POLICY,
      cases: LOCAL_REHEARSAL_ROLLBACK_CASES,
      bindingSha256: canonicalSha256({
        policy: LOCAL_REHEARSAL_FAILURE_POLICY,
        cases: LOCAL_REHEARSAL_ROLLBACK_CASES,
      }),
    },
    host: {
      required: "linux/x64",
      observed: `${source?.hostPlatform ?? "unknown"}/${source?.hostArchitecture ?? "unknown"}`,
      ready: hostReady,
    },
    toolchain,
    disk: {
      path: disk?.path ?? null,
      freeBytes: disk?.freeBytes ?? null,
      ...LOCAL_REHEARSAL_DISK_POLICY,
      ready: diskReady,
    },
    identities: {
      canonicalManifestSha256: source?.identityManifestSha256 ?? null,
      canonicalEnvironmentBindingSha256:
        source?.lawIdentityEnvironmentSha256 ?? null,
      canonicalEconomyEnvironmentBindingSha256:
        source?.economyIdentityEnvironmentSha256 ?? null,
      productionCombinedArtifactBindingReady: identityManifestReady,
      inputBindingSha256: inputShapeValid ? inputPacket.identityBinding?.bindingSha256 : null,
      inputReady: identityInputReady,
      productionChoices: {
        lawProgramId: identityManifest?.identities?.lawProgramId ?? null,
        economyProgramId: identityManifest?.identities?.economyProgramId ?? null,
        canonicalMint: identityManifest?.identities?.canonicalMint ?? null,
        networkGenesisHash: identityManifest?.networkBinding?.genesisHash ?? null,
      },
    },
    artifacts: {
      law: artifactObservations.law,
      economy: artifactObservations.economy,
      lawReady: lawArtifactReady,
      economyReady: economyArtifactReady,
      lawReceiptContract: COMBINED_LAW_BUILD_RECEIPT_SCHEMA,
      economyReceiptContract: ECONOMY_BUILD_RECEIPT_SCHEMA,
      distinct: distinctArtifacts,
    },
    checks,
    blockers,
    safety: {
      validatorStarted: false,
      artifactBuildExecuted: false,
      keyGenerated: false,
      rpcUsed: false,
      transactionSigned: false,
      broadcastAttempted: false,
      devnetExecuted: false,
      mainnetExecuted: false,
      fullCeremonyCompleted: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: "HOLD",
    },
  };
  return validateLocalRehearsalReadinessAssessment(
    freezeResult({ ...core, assessmentSha256: canonicalSha256(core) }),
  );
}

export function validateLocalRehearsalReadinessAssessment(assessment) {
  if (!assessment
    || assessment.schema !== LOCAL_REHEARSAL_READINESS_SCHEMA
    || !Array.isArray(assessment.checks)
    || !Array.isArray(assessment.blockers)
    || assessment.scope?.doesNotStartValidator !== true
    || assessment.scope?.doesNotBuildArtifact !== true
    || assessment.scope?.doesNotGenerateKey !== true
    || assessment.scope?.doesNotSign !== true
    || assessment.scope?.doesNotUseRpc !== true
    || assessment.scope?.doesNotBroadcast !== true
    || assessment.safety?.validatorStarted !== false
    || assessment.safety?.artifactBuildExecuted !== false
    || assessment.safety?.keyGenerated !== false
    || assessment.safety?.rpcUsed !== false
    || assessment.safety?.transactionSigned !== false
    || assessment.safety?.broadcastAttempted !== false
    || assessment.safety?.mainnetStatus !== "HOLD") {
    throw new Error("INVALID_IAT_B3_LOCAL_REHEARSAL_READINESS_ASSESSMENT");
  }
  const blockers = assessment.checks.filter(({ passed }) => !passed).map(({ id }) => id);
  if (canonicalJson(blockers) !== canonicalJson(assessment.blockers)) {
    throw new Error("IAT_B3_LOCAL_REHEARSAL_BLOCKER_SET_MISMATCH");
  }
  const ready = blockers.length === 0;
  if (assessment.status !== (ready ? LOCAL_REHEARSAL_READY : LOCAL_REHEARSAL_HOLD)
    || assessment.exitCode !== (ready ? 0 : 2)) {
    throw new Error("IAT_B3_LOCAL_REHEARSAL_STATUS_MISMATCH");
  }
  const { assessmentSha256, ...core } = assessment;
  if (!HEX_SHA256.test(assessmentSha256) || assessmentSha256 !== canonicalSha256(core)) {
    throw new Error("IAT_B3_LOCAL_REHEARSAL_DIGEST_MISMATCH");
  }
  return assessment;
}

function loadInputPacket(inputPath, repositoryRoot) {
  if (inputPath === null) return null;
  if (typeof inputPath !== "string" || !isAbsolute(inputPath)) {
    throw new Error("R01_INPUT_ABSOLUTE_PATH_REQUIRED");
  }
  const path = resolve(inputPath);
  const repository = realpathSync(repositoryRoot);
  if (isWithin(repository, path)) throw new Error("R01_INPUT_MUST_BE_OUTSIDE_REPOSITORY");
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("R01_INPUT_REGULAR_FILE_REQUIRED");
  return parseB3OwnerPolicyFreezeJson(readFileSync(path, "utf8"), path);
}

export function runLocalRehearsalReadinessAssessment({
  inputPath = null,
  repositoryRoot = REPOSITORY_ROOT,
  generatedAt = new Date().toISOString(),
  toolchainObservations = null,
  toolchainProbeRunner = spawnSync,
} = {}) {
  const gitSource = observeLocalRehearsalGitSource(repositoryRoot);
  const instructionSource = readFileSync(PRODUCTION_INSTRUCTION_PATH, "utf8");
  const dispatchSource = readFileSync(PRODUCTION_DISPATCH_PATH, "utf8");
  const entrypointSource = readFileSync(PRODUCTION_ENTRYPOINT_PATH, "utf8");
  const claimLaneExecutorSource = readFileSync(CLAIM_LANE_EXECUTOR_PATH, "utf8");
  const consensusSource = readFileSync(CONSENSUS_PATH, "utf8");
  const lawSource = readFileSync(LAW_PATH, "utf8");
  const identityBytes = readFileSync(IDENTITY_PATH);
  const ownerPolicyBytes = readFileSync(OWNER_POLICY_PATH);
  const authorityBytes = readFileSync(AUTHORITY_PATH);
  const identityManifest = parseIdentityFreezeJson(identityBytes.toString("utf8"), IDENTITY_PATH);
  const identityValidation = validateIdentityFreezeManifest(identityManifest, { ownerPolicyBytes });
  let economyIdentityEnvironmentSha256 = null;
  try {
    economyIdentityEnvironmentSha256 = canonicalSha256(
      deriveEconomyProductionBuildEnvironment(identityManifest, identityValidation),
    );
  } catch {
    economyIdentityEnvironmentSha256 = null;
  }
  const authorityManifest = parseProductionIdentityAuthorityEvidenceJson(
    authorityBytes.toString("utf8"),
    AUTHORITY_PATH,
  );
  const authorityValidation = validateProductionIdentityAuthorityEvidenceManifest(
    authorityManifest,
  );
  const ceremonyStages = extractCanonicalCeremonyStages(
    authorityManifest,
    authorityValidation,
  );
  const opcodeDispositions = deriveProductionOpcodeDispositions({
    instructionSource,
    dispatchSource,
    entrypointSource,
    claimLaneExecutorSource,
  });
  const lawPlan = deriveLawBoundaryAndGrindingPlan({ consensusSource, lawSource });
  const packet = loadInputPacket(inputPath, repositoryRoot);
  const artifactObservations = Object.freeze({
    law: packet?.artifacts?.law ? observeArtifact(packet.artifacts.law, repositoryRoot) : null,
    economy: packet?.artifacts?.economy
      ? observeArtifact(packet.artifacts.economy, repositoryRoot)
      : null,
  });
  const tempRoot = realpathSync(tmpdir());
  const fileSystem = statfsSync(tempRoot);
  const freeBytes = fileSystem.bavail * fileSystem.bsize;
  const source = Object.freeze({
    ...gitSource,
    executedRunnerSha256: sha256(readFileSync(RUNNER_PATH)),
    committedRunnerSha256: committedRunnerSha256(repositoryRoot, gitSource.headSha),
    identityManifestSha256: sha256(identityBytes),
    lawIdentityEnvironmentSha256:
      identityValidation.combinedArtifactBuildEnvironment
        ? canonicalSha256(identityValidation.combinedArtifactBuildEnvironment)
        : null,
    economyIdentityEnvironmentSha256,
    hostPlatform: process.platform,
    hostArchitecture: process.arch,
  });
  const toolchain = validateLocalRehearsalToolchain(
    selectLocalRehearsalToolchainObservations({
      inputPath,
      toolchainObservations,
      runner: toolchainProbeRunner,
    }),
  );
  return assessLocalRehearsalReadiness({
    generatedAt,
    source,
    opcodeDispositions,
    ceremonyStages,
    lawPlan,
    identityManifest,
    identityValidation,
    authorityValidation,
    toolchain,
    disk: Object.freeze({ path: tempRoot, freeBytes }),
    inputPacket: packet,
    artifactObservations,
  });
}

function parseCliArguments(argv) {
  if (argv.length === 0) return Object.freeze({ inputPath: null });
  if (argv.length === 2 && argv[0] === "--input" && argv[1]) {
    return Object.freeze({ inputPath: resolve(argv[1]) });
  }
  throw new Error("Usage: assess-iat-b3-local-rehearsal-readiness.mjs [--input <absolute-outside-repository.json>]");
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const assessment = runLocalRehearsalReadinessAssessment(
      parseCliArguments(process.argv.slice(2)),
    );
    process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
    process.exitCode = assessment.exitCode;
  } catch (error) {
    const fatal = {
      schema: LOCAL_REHEARSAL_READINESS_SCHEMA,
      status: LOCAL_REHEARSAL_HOLD,
      exitCode: 2,
      fatalBlocker: error instanceof Error ? error.message : String(error),
      safety: {
        validatorStarted: false,
        artifactBuildExecuted: false,
        keyGenerated: false,
        rpcUsed: false,
        transactionSigned: false,
        broadcastAttempted: false,
      },
    };
    process.stdout.write(`${JSON.stringify(fatal, null, 2)}\n`);
    process.exitCode = 2;
  }
}
