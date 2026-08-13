#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import {
  join,
  isAbsolute,
  parse as parsePath,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  COMBINED_LAW_BUILD_RECEIPT_SCHEMA,
  PINNED_COMBINED_LAW_BUILD_CONTAINER,
  assertIdentityAndOwnerPolicyBytes,
  observeExactSource,
  readExactCommittedFile,
  validateCombinedLawBuildReceipt,
} from "./run-iat-b3-combined-law-reproducible-build.mjs";
import {
  ECONOMY_BUILD_RECEIPT_SCHEMA,
  assertEconomyIdentityAndOwnerPolicyBytes,
  validateEconomyBuildReceipt,
} from "./run-iat-b3-economy-reproducible-build.mjs";
import {
  validateIatB3ProductionLocalRehearsalExecutionReceipt,
  validateIatB3ProductionLocalRehearsalPreflight,
} from "./lib/iat-b3-production-local-rehearsal-contract.mjs";
import {
  IAT_B3_PRODUCTION_SOURCE_KEYS,
  extractIatB3ProductionTransactionMaps,
  validateIatB3ProductionTransactionMaps,
} from "./lib/iat-b3-production-transaction-map.mjs";
import {
  COMBINED_HOOK_HOST_TEST_IDENTITIES,
  IAT_V2_PROGRAM_ID,
  PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
  TEST_FIXTURE_IDENTITIES,
  TOKEN_2022_PROGRAM_ID,
  isCanonicalBase58Key,
} from "./validate-iat-b3-identity-freeze.mjs";
import {
  parseB3OwnerPolicyFreezeJson,
  validateB3OwnerPolicyFreezeManifest,
} from "./validate-iat-b3-owner-policy-freeze.mjs";
import {
  parseProductionIdentityAuthorityEvidenceJson,
  validateProductionIdentityAuthorityEvidenceManifest,
} from "./validate-iat-b3-production-identity-authority-evidence.mjs";
import {
  parseReleaseDependencyGraphJson,
  validateReleaseDependencyGraphManifest,
} from "./validate-iat-b3-release-dependency-graph.mjs";

export const ALL_FEATURE_DEVNET_INPUT_SCHEMA =
  "iat-b3-all-feature-devnet-readiness-input/v3";
export const ALL_FEATURE_DEVNET_ASSESSMENT_SCHEMA =
  "iat-b3-all-feature-devnet-readiness-assessment/v2";
export const ALL_FEATURE_DEVNET_AUTHORIZATION_CONFIRMATION =
  "CONFIRMED_ALL_FEATURE_B3_PUBLIC_DEVNET_REHEARSAL";
export const ALL_FEATURE_DEVNET_AUTHORIZATION_SCOPE =
  "EXACT_HEAD_DOCKER_RECEIPTS_LOCAL_FINAL_BYTES_AND_PUBLIC_DEVNET_BEHAVIOR_ONLY";
export const ALL_FEATURE_DEVNET_IDENTITY_POLICY =
  "FRESH_DISPOSABLE_PER_REHEARSAL_NEVER_CANONICAL";
export const ALL_FEATURE_PRODUCTION_BYTE_EVIDENCE_POLICY =
  "ISOLATED_LOCAL_VALIDATOR_EXACT_PRODUCTION_BYTES_MAINNET_LAW_DOMAIN";
export const ALL_FEATURE_PUBLIC_DEVNET_BEHAVIORAL_EVIDENCE_POLICY =
  "DISPOSABLE_IDENTITIES_DEVNET_DOMAIN_BEHAVIORAL_ONLY_NOT_FINAL_BYTES";
export const ALL_FEATURE_DEVNET_SOLE_HUMAN_GATE =
  "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION";
export const ALL_FEATURE_DEVNET_SIGNATURE_DEVICE = "TREZOR_MODEL_T";
export const ALL_FEATURE_DEVNET_AUTOMATED_VERIFIER_TYPE =
  "CODEX_SOURCE_BOUND_AUTOMATED_REDTEAM";
export const ALL_FEATURE_DEVNET_AUTOMATED_VERIFIER_LANE =
  "independent_launch_redteam";
export const ALL_FEATURE_DEVNET_MAX_OBSERVATION_AGE_SECONDS = 3_600n;
export const ALL_FEATURE_DEVNET_MAX_FUTURE_SKEW_SECONDS = 300n;

const SITE_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const OWNER_POLICY_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-owner-policy-freeze.v1.json",
);
const IDENTITY_MANIFEST_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-identity-freeze.v1.json",
);
const AUTHORITY_EVIDENCE_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-production-identity-authority-evidence.v1.json",
);
const RELEASE_GRAPH_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-release-dependency-graph.v1.json",
);
const ECONOMIC_WRITE_GATES_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-economic-write-gates.v1.json",
);
const PRODUCTION_DISPATCH_PATH = resolve(
  SITE_ROOT,
  "programs/iat_b3_economy/src/production_dispatch.rs",
);
const DEVNET_DRIVER_PATH = resolve(
  SITE_ROOT,
  "scripts/iat-b3-devnet-rehearsal-driver.mjs",
);
const exactRepositoryPath = (absolutePath) =>
  relative(REPOSITORY_ROOT, absolutePath).replaceAll("\\", "/");
const OWNER_POLICY_REPOSITORY_PATH = exactRepositoryPath(OWNER_POLICY_PATH);
const IDENTITY_MANIFEST_REPOSITORY_PATH = exactRepositoryPath(IDENTITY_MANIFEST_PATH);
const AUTHORITY_EVIDENCE_REPOSITORY_PATH = exactRepositoryPath(AUTHORITY_EVIDENCE_PATH);
const RELEASE_GRAPH_REPOSITORY_PATH = exactRepositoryPath(RELEASE_GRAPH_PATH);
const ECONOMIC_WRITE_GATES_REPOSITORY_PATH = exactRepositoryPath(ECONOMIC_WRITE_GATES_PATH);
const PRODUCTION_DISPATCH_REPOSITORY_PATH = exactRepositoryPath(PRODUCTION_DISPATCH_PATH);
const DEVNET_DRIVER_REPOSITORY_PATH = exactRepositoryPath(DEVNET_DRIVER_PATH);
const COMBINED_LAW_RUNNER_REPOSITORY_PATH =
  "projects/star-ascent/site/scripts/run-iat-b3-combined-law-reproducible-build.mjs";
const ECONOMY_RUNNER_REPOSITORY_PATH =
  "projects/star-ascent/site/scripts/run-iat-b3-economy-reproducible-build.mjs";
const PRODUCTION_TRANSACTION_MAP_MODULE_PATH = resolve(
  SITE_ROOT,
  "scripts/lib/iat-b3-production-transaction-map.mjs",
);
const PRODUCTION_TRANSACTION_MAP_MODULE_REPOSITORY_PATH =
  exactRepositoryPath(PRODUCTION_TRANSACTION_MAP_MODULE_PATH);
const PRODUCTION_TRANSACTION_MAP_SOURCE_PATHS = Object.freeze({
  economySource: "programs/iat_b3_economy/src/lib.rs",
  instructionSource: "programs/iat_b3_economy/src/production_instruction.rs",
  entrypointSource: "programs/iat_b3_economy/src/production_entrypoint.rs",
  dispatchSource: "programs/iat_b3_economy/src/production_dispatch.rs",
  initializationHoldSource:
    "programs/iat_b3_economy/src/production_initialization_policy_hold.rs",
  nativeAdapterSource: "programs/iat_b3_economy/src/native_adapter.rs",
  setEligibilitySource:
    "programs/iat_b3_economy/src/production_set_eligibility.rs",
  openPositionSource: "programs/iat_b3_economy/src/production_open_position.rs",
  openExecutorSource:
    "programs/iat_b3_economy/src/production_open_position_executor.rs",
  settleExecutorSource:
    "programs/iat_b3_economy/src/production_settle_position_week_executor.rs",
  settleCoreHoldSource:
    "programs/iat_b3_economy/src/production_settle_position_week.rs",
  claimLanePrincipalSource:
    "programs/iat_b3_economy/src/production_claim_lane_principal.rs",
  claimExecutorSource:
    "programs/iat_b3_economy/src/production_claim_lane_principal_executor.rs",
  withdrawPositionSource:
    "programs/iat_b3_economy/src/production_withdraw_position.rs",
  withdrawExecutorSource:
    "programs/iat_b3_economy/src/production_withdraw_position_executor.rs",
  closeSource: "programs/iat_b3_economy/src/production_close_position.rs",
  closeSpecSource:
    "programs/iat_b3_economy/tests/production_close_position_spec.rs",
  disabledRoundSource:
    "programs/iat_b3_economy/src/production_round_disabled.rs",
  stakeIngressRuntimeSource:
    "programs/iat_b3_economy/src/stake_ingress_runtime.rs",
  economicWriteGatesSource:
    "docs/b3/iat-b3-economic-write-gates.v1.json",
});
const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const UPGRADEABLE_LOADER_ID = "BPFLoaderUpgradeab1e11111111111111111111111";

const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const HEAD_SHA = /^[0-9a-f]{40}$/u;
const SAFE_EVIDENCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,255}$/u;
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;
const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const MAX_RAW_LOG_BYTES = 64 * 1024 * 1024;
const CANONICAL_CONTEXTS = new WeakSet();
const EXACT_PACKET_KEYS = Object.freeze([
  "schema",
  "declaredHeadSha",
  "productionToolchain",
  "productionByteEvidence",
  "publicDevnetBehavioralEvidence",
  "clusterPolicy",
  "funding",
  "authorization",
  "automatedVerification",
  "failurePolicy",
]);
const EXACT_TOOLCHAIN_KEYS = Object.freeze([
  "hostPlatform",
  "rustToolchain",
  "cargoBuildSbfVersion",
  "platformToolsVersion",
  "containerExecutionReference",
  "networkPolicy",
  "dualFreshBuilds",
]);
const EXACT_ARTIFACT_SET_KEYS = Object.freeze(["law", "economy"]);
const EXACT_PRODUCTION_ARTIFACT_KEYS = Object.freeze([
  "kind",
  "artifactPath",
  "artifactSha256",
  "artifactByteLength",
  "receiptPath",
  "receiptFileSha256",
  "firstBuildLogPath",
  "firstBuildLogSha256",
  "secondBuildLogPath",
  "secondBuildLogSha256",
]);
const EXACT_PRODUCTION_BYTE_EVIDENCE_KEYS = Object.freeze([
  "policy",
  "identities",
  "artifacts",
  "localValidator",
  "publicDevnetCannotSatisfyFinalByteProof",
]);
const EXACT_PRODUCTION_IDENTITY_KEYS = Object.freeze([
  "lawProgramId",
  "economyProgramId",
  "canonicalMint",
  "compiledLawDomainGenesisHash",
  "bindingSha256",
]);
const EXACT_LOCAL_VALIDATOR_EVIDENCE_KEYS = Object.freeze([
  "preflightPath",
  "preflightFileSha256",
  "executionReceiptPath",
  "executionReceiptFileSha256",
  "isolatedLoopbackOnly",
  "productionPublicIdsPreloaded",
  "productionPrivateKeysUsed",
  "compiledMainnetLawDomain",
  "validatorGenesisClaimedMainnet",
  "publicNetworkUsed",
]);
const EXACT_PUBLIC_DEVNET_BEHAVIORAL_KEYS = Object.freeze([
  "policy",
  "artifacts",
  "devnetDomain",
  "disposableIdentities",
  "productionArtifactReuseForbidden",
  "finalByteEvidenceAccepted",
]);
const EXACT_PUBLIC_DEVNET_ARTIFACT_KEYS = Object.freeze([
  "kind",
  "path",
  "sha256",
  "byteLength",
  "sourceHeadSha",
  "identityBindingSha256",
  "networkGenesisHash",
]);
const EXACT_CLUSTER_POLICY_KEYS = Object.freeze([
  "network",
  "rpcUrl",
  "genesisHash",
  "identityPolicy",
  "identities",
  "allIdentitiesNonProduction",
  "programsDisposable",
  "mintDisposable",
  "mainnetIdentityReuseForbidden",
  "keysRetainedUntilFinalReconciliation",
  "cleanupPlanSha256",
]);
const EXACT_IDENTITY_KEYS = Object.freeze([
  "lawProgramId",
  "economyProgramId",
  "canonicalMint",
]);
const EXACT_FUNDING_KEYS = Object.freeze([
  "mode",
  "payerPublicKey",
  "observedBalanceLamports",
  "requiredPeakLamports",
  "observationUnixSeconds",
  "observationSha256",
  "approvalId",
  "approved",
]);
const EXACT_AUTHORIZATION_KEYS = Object.freeze([
  "confirmation",
  "scope",
  "soleHumanGate",
  "signatureDeviceModel",
  "allNonSignatureClaimsDirectlyObserved",
  "authorizationId",
  "authorizedBy",
  "authorized",
  "authorizedAtUnixSeconds",
  "expiresAtUnixSeconds",
  "declaredHeadSha",
  "productionByteEvidenceSha256",
  "publicDevnetBehavioralEvidenceSha256",
  "operationMapsSha256",
  "ceremonyStagesSha256",
  "fundingSha256",
  "failurePolicySha256",
]);
const EXACT_AUTOMATED_VERIFICATION_KEYS = Object.freeze([
  "verificationId",
  "verifierType",
  "verifierLane",
  "directEvidenceOnly",
  "humanReviewerRequired",
  "accepted",
  "verifiedAtUnixSeconds",
  "declaredHeadSha",
  "productionByteEvidenceSha256",
  "publicDevnetBehavioralEvidenceSha256",
  "operationMapsSha256",
  "ceremonyStagesSha256",
  "fundingSha256",
  "failurePolicySha256",
]);
const EXACT_FAILURE_POLICY_KEYS = Object.freeze([
  "automaticRetry",
  "resubmitBeforeReconciliation",
  "ambiguousSendAction",
  "preserveMessageBytesSignaturesAndLogs",
  "authorityRevocationOnlyAfterExactByteVerification",
  "publicWritesRollbackable",
  "automaticCompensation",
  "preRevocationRecovery",
  "postRevocationRecovery",
  "partialWriteDisposition",
  "retainDisposableKeysUntilReconciled",
  "cleanupOnlyAfterEvidence",
]);

export const REQUIRED_ALL_FEATURE_DEVNET_FAILURE_POLICY = Object.freeze({
  automaticRetry: false,
  resubmitBeforeReconciliation: false,
  ambiguousSendAction: "STOP_PRESERVE_AND_RECONCILE",
  preserveMessageBytesSignaturesAndLogs: true,
  authorityRevocationOnlyAfterExactByteVerification: true,
  publicWritesRollbackable: false,
  automaticCompensation: false,
  preRevocationRecovery: "PREAPPROVED_UPGRADE_OR_ABANDON",
  postRevocationRecovery: "NO_CODE_ROLLBACK_ABANDON_AND_REDEPLOY",
  partialWriteDisposition: "PARTIAL_HOLD",
  retainDisposableKeysUntilReconciled: true,
  cleanupOnlyAfterEvidence: true,
});

const REQUIRED_DISPATCH_TRUTH = Object.freeze({
  instruction_abi_frozen: true,
  all_15_instruction_routes_frozen: true,
  account_identity_graph_complete: true,
  handler_dispatch_exposed: true,
  entrypoint_exposed: true,
  account_writes_executed: true,
  any_handler_complete: true,
});

const REQUIRED_ALL_15_MATRIX_TRUTH = Object.freeze({
  complete: true,
  accountIdentityGraphComplete: true,
  instructionAbiFrozen: true,
  solanaEntrypoint: true,
  publicDispatcher: true,
  configCodecSupported: true,
  ownerPolicyFrozen: true,
  anyHandlerComplete: true,
  publicDevnetDriverWired: true,
});
const REQUIRED_DEVNET_OWNER_CHOICE_NODE_IDS = Object.freeze([
  "LIVE_ESTATE_CANONICAL_MINT_DECISION",
  "CORE_CUSTODY_POLICY_ADAPTER",
  "FACTION_ECONOMICS_FUNDING",
  "CONFIG_GENESIS_PHASE_CODEC",
  "GENESIS_ALLOCATIONS_CONSERVATION",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

export function canonicalSha256(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function addBlocker(blockers, code, detail, source = "readiness") {
  const key = `${code}\u0000${detail}`;
  if (!blockers.has(key)) blockers.set(key, Object.freeze({ code, detail, source }));
}

function parseCanonicalU64(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) return null;
  try {
    const parsed = BigInt(value);
    return parsed <= 18_446_744_073_709_551_615n ? parsed : null;
  } catch {
    return null;
  }
}

function readStrictJson(path) {
  return parseB3OwnerPolicyFreezeJson(readFileSync(path, "utf8"), path);
}

export function readAllFeatureDevnetExactCommittedFile(
  repositoryRoot,
  headSha,
  repositoryPath,
) {
  return readExactCommittedFile(repositoryRoot, headSha, repositoryPath);
}

export function observeAllFeatureDevnetExactSource(repositoryRoot) {
  return observeExactSource(repositoryRoot);
}

function observeProductionBuildSourceBindings({ exactBytes }) {
  let identityManifestBytes = null;
  let ownerPolicyBytes = null;
  let runnerSha256 = Object.freeze({ law: null, economy: null });
  try {
    identityManifestBytes = exactBytes(IDENTITY_MANIFEST_REPOSITORY_PATH);
    ownerPolicyBytes = exactBytes(OWNER_POLICY_REPOSITORY_PATH);
    runnerSha256 = Object.freeze({
      law: sha256(exactBytes(COMBINED_LAW_RUNNER_REPOSITORY_PATH)),
      economy: sha256(exactBytes(ECONOMY_RUNNER_REPOSITORY_PATH)),
    });
    const law = assertIdentityAndOwnerPolicyBytes({
      identityManifestBytes,
      ownerPolicyBytes,
    });
    const economy = assertEconomyIdentityAndOwnerPolicyBytes({
      identityManifestBytes,
      ownerPolicyBytes,
    });
    const identities = Object.freeze({
      lawProgramId: law.environment.IAT_B3_PRODUCTION_LAW_PROGRAM_ID,
      economyProgramId: law.environment.IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID,
      canonicalMint: law.environment.IAT_B3_PRODUCTION_CANONICAL_MINT,
      compiledLawDomainGenesisHash:
        economy.environment.IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH,
    });
    return Object.freeze({
      ready: true,
      failure: null,
      manifestSha256: law.receiptBinding.manifestSha256,
      ownerPolicySha256: economy.receiptBinding.ownerPolicySha256,
      lawEnvironmentSha256: law.receiptBinding.environmentBindingSha256,
      economyEnvironmentSha256: economy.receiptBinding.environmentBindingSha256,
      identities,
      identityBindingSha256: canonicalSha256(identities),
      runnerSha256,
    });
  } catch (error) {
    return Object.freeze({
      ready: false,
      failure: error instanceof Error ? error.message : String(error),
      manifestSha256: identityManifestBytes === null
        ? null
        : sha256(identityManifestBytes),
      ownerPolicySha256: ownerPolicyBytes === null
        ? null
        : sha256(ownerPolicyBytes),
      lawEnvironmentSha256: null,
      economyEnvironmentSha256: null,
      identities: null,
      identityBindingSha256: null,
      runnerSha256,
    });
  }
}

function observeProductionOperationMaps({ exactBytes, exactText }) {
  let executedModuleSha256 = null;
  let committedModuleSha256 = null;
  try {
    executedModuleSha256 = sha256(readFileSync(PRODUCTION_TRANSACTION_MAP_MODULE_PATH));
    committedModuleSha256 = sha256(
      exactBytes(PRODUCTION_TRANSACTION_MAP_MODULE_REPOSITORY_PATH),
    );
    if (executedModuleSha256 !== committedModuleSha256) {
      throw new Error(
        "executed production transaction-map validator bytes are not the exact committed bytes",
      );
    }
    if (canonicalSha256(Object.keys(PRODUCTION_TRANSACTION_MAP_SOURCE_PATHS).sort())
      !== canonicalSha256([...IAT_B3_PRODUCTION_SOURCE_KEYS].sort())) {
      throw new Error("production transaction-map source inventory drifted");
    }
    const sourceInput = Object.fromEntries(
      IAT_B3_PRODUCTION_SOURCE_KEYS.map((key) => [
        key,
        exactText(PRODUCTION_TRANSACTION_MAP_SOURCE_PATHS[key]),
      ]),
    );
    const map = extractIatB3ProductionTransactionMaps(sourceInput);
    validateIatB3ProductionTransactionMaps(map);
    return Object.freeze({
      ready: true,
      failure: null,
      executedModuleSha256,
      committedModuleSha256,
      bindingSha256: map.canonicalMapSha256,
      map,
    });
  } catch (error) {
    return Object.freeze({
      ready: false,
      failure: error instanceof Error ? error.message : String(error),
      executedModuleSha256,
      committedModuleSha256,
      bindingSha256: null,
      map: null,
    });
  }
}

function extractStringConstant(source, name) {
  const pattern = new RegExp(
    `export\\s+const\\s+${name}\\s*=\\s*[\"']([^\"']+)[\"']\\s*;`,
    "u",
  );
  const match = source.match(pattern);
  if (!match) throw new Error(`${name} is absent from the canonical Devnet driver`);
  return match[1];
}

export function extractCanonicalDevnetBoundary(source) {
  if (typeof source !== "string") throw new TypeError("Devnet driver source must be text");
  return Object.freeze({
    rpcUrl: extractStringConstant(source, "DEVNET_RPC"),
    genesisHash: extractStringConstant(source, "DEVNET_GENESIS_HASH"),
    sourceSha256: sha256(source),
  });
}

function extractRustU64Constant(source, name) {
  const match = source.match(new RegExp(
    `pub\\s+const\\s+${name}\\s*:\\s*(?:u8|usize)\\s*=\\s*([0-9_]+)\\s*;`,
    "u",
  ));
  if (!match) throw new Error(`canonical instruction constant ${name} is absent`);
  return Number(match[1].replaceAll("_", ""));
}

function extractRustByteStringConstant(source, name) {
  const match = source.match(new RegExp(
    `pub\\s+const\\s+${name}[^=]*=\\s*b[\"']([^\"']+)[\"']\\s*;`,
    "u",
  ));
  if (!match) throw new Error(`canonical instruction constant ${name} is absent`);
  return match[1];
}

function camelToSnake(value) {
  return value.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
}

function snakeToUpper(value) {
  return value.toUpperCase();
}

function extractInstructionVariants(source) {
  const match = source.match(
    /pub\s+enum\s+ProductionInstruction\s*\{([\s\S]*?)\n\}/u,
  );
  if (!match) throw new Error("canonical ProductionInstruction enum is absent");
  const variants = [];
  const matcher = /^\s*([A-Z][A-Za-z0-9]*)(?:\s*\{\s*([^}]*)\s*\})?\s*,?\s*$/gmu;
  for (const variant of match[1].matchAll(matcher)) {
    const fields = [];
    const rawFields = variant[2]?.trim();
    if (rawFields) {
      for (const field of rawFields.split(",").map((entry) => entry.trim()).filter(Boolean)) {
        const separator = field.indexOf(":");
        if (separator < 1) throw new Error(`invalid field in ${variant[1]}`);
        fields.push(Object.freeze({
          name: field.slice(0, separator).trim(),
          rustType: field.slice(separator + 1).trim(),
        }));
      }
    }
    variants.push(Object.freeze({ variant: variant[1], fields: Object.freeze(fields) }));
  }
  if (variants.length !== 15) {
    throw new Error(`canonical ProductionInstruction enum has ${variants.length}, expected 15`);
  }
  return variants;
}

function extractAccountArrays(source) {
  const arrays = new Map();
  const arrayMatcher = /const\s+([A-Z][A-Z0-9_]*)\s*:\s*&\[RehearsalAccountSlot\]\s*=\s*&\[([\s\S]*?)\n\];/gu;
  for (const match of source.matchAll(arrayMatcher)) {
    const accounts = [];
    const slotMatcher = /(optional_slot|slot)\(\s*"([a-z0-9_]+)"\s*,\s*(true|false)\s*,\s*(true|false)\s*,\s*(true|false)\s*\)/gu;
    for (const slot of match[2].matchAll(slotMatcher)) {
      accounts.push(Object.freeze({
        role: slot[2],
        signer: slot[3] === "true",
        writable: slot[4] === "true",
        executable: slot[5] === "true",
        optional: slot[1] === "optional_slot",
      }));
    }
    if (accounts.length === 0) throw new Error(`account map ${match[1]} is empty`);
    arrays.set(match[1], Object.freeze(accounts));
  }
  return arrays;
}

function extractOpcodeMap(source) {
  const opcodes = new Map();
  for (const match of source.matchAll(
    /pub\s+const\s+([A-Z][A-Z0-9_]*)_OPCODE\s*:\s*u8\s*=\s*([0-9]+)\s*;/gu,
  )) {
    opcodes.set(match[1], Number(match[2]));
  }
  return opcodes;
}

function extractBooleanTruth(source, constantName) {
  const match = source.match(new RegExp(
    `pub\\s+const\\s+${constantName}[^=]*=[^{]*\\{([\\s\\S]*?)\\n\\s*\\};`,
    "u",
  ));
  if (!match) throw new Error(`canonical truth block ${constantName} is absent`);
  const result = {};
  for (const field of match[1].matchAll(/\b([a-z][a-z0-9_]*)\s*:\s*(true|false)\s*,/gu)) {
    result[field[1]] = field[2] === "true";
  }
  if (Object.keys(result).length === 0) throw new Error(`${constantName} has no boolean truth fields`);
  return Object.freeze(result);
}

export function extractCanonicalOperationMaps({
  rehearsalAdapterSource,
  productionInstructionSource,
  economicWriteGates,
  economicWriteGatesSource = null,
} = {}) {
  if (typeof rehearsalAdapterSource !== "string"
    || typeof productionInstructionSource !== "string"
    || !isPlainObject(economicWriteGates)) {
    throw new TypeError("canonical operation-map sources are required");
  }
  const count = extractRustU64Constant(
    productionInstructionSource,
    "PRODUCTION_INSTRUCTION_COUNT",
  );
  const rehearsalCount = extractRustU64Constant(
    rehearsalAdapterSource,
    "EXPECTED_REHEARSAL_HANDLER_COUNT",
  );
  if (count !== 15 || rehearsalCount !== count) {
    throw new Error(`canonical operation count drifted (${count}/${rehearsalCount})`);
  }
  if (economicWriteGates.expectedHandlerCount !== count
    || !Array.isArray(economicWriteGates.handlers)
    || economicWriteGates.handlers.length !== count) {
    throw new Error("economic write-gate inventory is not an exact 15-handler map");
  }
  const namespaceAscii = extractRustByteStringConstant(
    productionInstructionSource,
    "PRODUCTION_INSTRUCTION_NAMESPACE",
  );
  const version = extractRustU64Constant(
    productionInstructionSource,
    "PRODUCTION_INSTRUCTION_VERSION",
  );
  const byteLength = extractRustU64Constant(
    productionInstructionSource,
    "PRODUCTION_INSTRUCTION_LEN",
  );
  const variants = extractInstructionVariants(productionInstructionSource);
  const accountsByName = extractAccountArrays(rehearsalAdapterSource);
  const opcodes = extractOpcodeMap(productionInstructionSource);
  const handlers = new Map(economicWriteGates.handlers.map((handler) => [handler.name, handler]));
  const maps = variants.map(({ variant, fields }, index) => {
    const name = camelToSnake(variant);
    const constantName = snakeToUpper(name);
    const accounts = accountsByName.get(constantName);
    const opcode = opcodes.get(constantName);
    const handler = handlers.get(name);
    if (!accounts || opcode !== index || !handler) {
      throw new Error(`operation ${name} is not bound consistently across ABI, accounts, and write gates`);
    }
    return Object.freeze({
      name,
      message: Object.freeze({
        namespaceAscii,
        version,
        byteLength,
        opcode,
        payloadFields: fields,
      }),
      accounts,
      writeGate: Object.freeze({
        implementationStage: typeof handler.implementationStage === "string"
          ? handler.implementationStage
          : null,
        handlerComplete: handler.handlerComplete === true,
        publicExposure: typeof handler.publicExposure === "string"
          ? handler.publicExposure
          : null,
      }),
    });
  });
  if (new Set(maps.map(({ name }) => name)).size !== count
    || new Set(maps.map(({ message }) => message.opcode)).size !== count) {
    throw new Error("operation names or opcodes are duplicated");
  }
  return Object.freeze({
    count,
    sourceBindings: Object.freeze({
      rehearsalAdapterSha256: sha256(rehearsalAdapterSource),
      productionInstructionSha256: sha256(productionInstructionSource),
      economicWriteGatesSha256: economicWriteGatesSource === null
        ? canonicalSha256(economicWriteGates)
        : sha256(economicWriteGatesSource),
    }),
    maps: Object.freeze(maps),
    bindingSha256: canonicalSha256(maps),
  });
}

export function extractCanonicalCeremonyStages(manifest, validation) {
  if (!validation?.valid) throw new Error("canonical authority evidence manifest is invalid");
  const journal = manifest?.phaseCDeployedSeal?.journal;
  if (!Array.isArray(journal) || journal.length !== 17) {
    throw new Error("canonical authority journal is not an exact 17-stage plan");
  }
  const stages = journal.map((entry, index) => {
    if (!exactKeys(entry, ["ordinal", "step", "status", "evidenceSha256"])
      || entry.ordinal !== index + 1
      || typeof entry.step !== "string"
      || entry.step.length < 8) {
      throw new Error(`canonical authority journal stage ${index + 1} is invalid`);
    }
    return Object.freeze({ ordinal: entry.ordinal, step: entry.step });
  });
  if (new Set(stages.map(({ step }) => step)).size !== stages.length) {
    throw new Error("canonical authority journal contains duplicate stages");
  }
  return Object.freeze({
    count: stages.length,
    stages: Object.freeze(stages),
    bindingSha256: canonicalSha256(stages),
  });
}

function releaseAncestors(manifest, targetId) {
  const required = new Set([targetId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of manifest.edges ?? []) {
      if (!Array.isArray(edge) || edge.length !== 2) continue;
      if (required.has(edge[1]) && !required.has(edge[0])) {
        required.add(edge[0]);
        changed = true;
      }
    }
  }
  return required;
}

function collectCanonicalContext({ repositoryRoot = REPOSITORY_ROOT } = {}) {
  const source = observeAllFeatureDevnetExactSource(repositoryRoot);
  const exactBytes = (repositoryPath) =>
    readAllFeatureDevnetExactCommittedFile(
      repositoryRoot,
      source.headSha,
      repositoryPath,
    );
  const exactText = (repositoryPath) => exactBytes(repositoryPath).toString("utf8");
  const productionDispatchSource = exactText(PRODUCTION_DISPATCH_REPOSITORY_PATH);
  const economicWriteGatesSource = exactText(ECONOMIC_WRITE_GATES_REPOSITORY_PATH);
  const economicWriteGates = parseB3OwnerPolicyFreezeJson(
    economicWriteGatesSource,
    ECONOMIC_WRITE_GATES_REPOSITORY_PATH,
  );
  const operationMaps = observeProductionOperationMaps({ exactBytes, exactText });
  const authorityManifest = parseProductionIdentityAuthorityEvidenceJson(
    exactText(AUTHORITY_EVIDENCE_REPOSITORY_PATH),
    AUTHORITY_EVIDENCE_REPOSITORY_PATH,
  );
  const authorityValidation = validateProductionIdentityAuthorityEvidenceManifest(
    authorityManifest,
  );
  let ceremonyStages;
  try {
    ceremonyStages = Object.freeze({
      ...extractCanonicalCeremonyStages(authorityManifest, authorityValidation),
      valid: true,
      failure: null,
    });
  } catch (error) {
    ceremonyStages = Object.freeze({
      count: 0,
      stages: Object.freeze([]),
      bindingSha256: null,
      valid: false,
      failure: error instanceof Error ? error.message : String(error),
    });
  }
  const ownerPolicyValidation = validateB3OwnerPolicyFreezeManifest(
    parseB3OwnerPolicyFreezeJson(
      exactText(OWNER_POLICY_REPOSITORY_PATH),
      OWNER_POLICY_REPOSITORY_PATH,
    ),
  );
  const releaseManifest = parseReleaseDependencyGraphJson(
    exactText(RELEASE_GRAPH_REPOSITORY_PATH),
    RELEASE_GRAPH_REPOSITORY_PATH,
  );
  const releaseValidation = validateReleaseDependencyGraphManifest(releaseManifest);
  const devnetAncestors = releaseAncestors(releaseManifest, "ADVERSARIAL_DEVNET_REHEARSAL");
  const releaseNodes = releaseManifest.nodes
    .filter(({ id }) => devnetAncestors.has(id))
    .map(({ id, status, blocker }) => Object.freeze({ id, status, blocker }));
  const context = Object.freeze({
    source,
    devnetBoundary: extractCanonicalDevnetBoundary(exactText(DEVNET_DRIVER_REPOSITORY_PATH)),
    operationMaps,
    ceremonyStages,
    dispatchTruth: extractBooleanTruth(
      productionDispatchSource,
      "PRODUCTION_DISPATCH_PREFLIGHT_TRUTH",
    ),
    all15MatrixTruth: Object.freeze({ ...economicWriteGates.all15RehearsalPreflight }),
    ownerPolicyValidation,
    authorityValidation,
    knownProductionIdentities: Object.freeze({
      lawProgramId: authorityManifest.productionChoices.lawProgramId,
      economyProgramId: authorityManifest.productionChoices.economyProgramId,
      canonicalMint: authorityManifest.productionChoices.canonicalMint,
    }),
    forbiddenDevnetIdentities: Object.freeze([
      SYSTEM_PROGRAM_ID,
      UPGRADEABLE_LOADER_ID,
      TOKEN_2022_PROGRAM_ID,
      IAT_V2_PROGRAM_ID,
      ...Object.values(TEST_FIXTURE_IDENTITIES),
      ...Object.values(COMBINED_HOOK_HOST_TEST_IDENTITIES),
    ]),
    productionBuildSource: observeProductionBuildSourceBindings({ exactBytes }),
    releaseValidation,
    releaseNodes: Object.freeze(releaseNodes),
    toolchainPolicy: Object.freeze({
      hostPlatform: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.hostPlatform,
      rustToolchain: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.rustToolchain,
      cargoBuildSbfVersion:
        PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.cargoBuildSbfVersion,
      platformToolsVersion:
        PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.platformToolsVersion,
      containerExecutionReference:
        PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
      networkPolicy:
        PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.networkPolicy,
      dualFreshBuilds:
        PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.repetitions === 2,
    }),
  });
  CANONICAL_CONTEXTS.add(context);
  return context;
}

function isWithin(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`));
}

function assertNoSymlinkSegments(path) {
  const parsed = parsePath(path);
  let cursor = parsed.root;
  for (const segment of path.slice(parsed.root.length).split(/[\\/]/u).filter(Boolean)) {
    cursor = join(cursor, segment);
    if (lstatSync(cursor).isSymbolicLink()) throw new Error("symlink path segment rejected");
  }
}

function readExactExternalFile(path, repositoryRoot, { label, maximumBytes, requireElf = false }) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error(`${label} path must be absolute`);
  assertNoSymlinkSegments(path);
  const root = realpathSync(repositoryRoot);
  const beforePathStat = lstatSync(path, { bigint: true });
  if (!beforePathStat.isFile() || beforePathStat.isSymbolicLink()) {
    throw new Error(`${label} must be a non-symlink regular file`);
  }
  const beforeRealpath = realpathSync(path);
  if (isWithin(root, beforeRealpath)) throw new Error(`${label} must be outside the repository`);
  const noFollow = typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
  const descriptor = openSync(path, fsConstants.O_RDONLY | noFollow);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.size <= 0n
      || before.size > BigInt(maximumBytes)) throw new Error(`${label} must be one bounded regular file with one link`);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    const afterRealpath = realpathSync(path);
    const afterPathStat = lstatSync(path, { bigint: true });
    const pathStat = statSync(path, { bigint: true });
    if (!afterPathStat.isFile() || afterPathStat.isSymbolicLink()) {
      throw new Error(`${label} became a symlink while being observed`);
    }
    for (const key of ["dev", "ino", "size", "mtimeNs", "ctimeNs"]) {
      if (beforePathStat[key] !== before[key]
        || before[key] !== after[key]
        || after[key] !== afterPathStat[key]
        || afterPathStat[key] !== pathStat[key]) {
        throw new Error(`${label} changed while being observed`);
      }
    }
    if (beforeRealpath !== afterRealpath || bytes.length !== Number(before.size)) {
      throw new Error(`${label} path or size changed while being observed`);
    }
    if (requireElf && !bytes.subarray(0, ELF_MAGIC.length).equals(ELF_MAGIC)) {
      throw new Error(`${label} is not an ELF artifact`);
    }
    return Object.freeze({ path: afterRealpath, bytes, sha256: sha256(bytes), byteLength: bytes.length });
  } finally {
    closeSync(descriptor);
  }
}

function projectDockerBuildReceipt(receipt, kind, context) {
  const validated = kind === "LAW"
    ? validateCombinedLawBuildReceipt(receipt)
    : validateEconomyBuildReceipt(receipt);
  const expectedSchema = kind === "LAW"
    ? COMBINED_LAW_BUILD_RECEIPT_SCHEMA
    : ECONOMY_BUILD_RECEIPT_SCHEMA;
  const expectedRunner = kind === "LAW"
    ? context.productionBuildSource.runnerSha256.law
    : context.productionBuildSource.runnerSha256.economy;
  const expectedEnvironment = kind === "LAW"
    ? context.productionBuildSource.lawEnvironmentSha256
    : context.productionBuildSource.economyEnvironmentSha256;
  if (validated.schema !== expectedSchema
    || validated.source.declaredHeadSha !== context.source.headSha
    || validated.source.observedHeadSha !== context.source.headSha
    || validated.source.observedTreeSha !== context.source.treeSha
    || validated.source.materializedTreeSha !== context.source.treeSha
    || validated.source.executedRunnerSha256 !== expectedRunner
    || validated.source.committedRunnerSha256 !== expectedRunner
    || validated.identityBinding.manifestSha256 !== context.productionBuildSource.manifestSha256
    || validated.identityBinding.environmentBindingSha256 !== expectedEnvironment
    || validated.container.executionReference !== PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference
    || validated.container.platformManifestDigest !== PINNED_COMBINED_LAW_BUILD_CONTAINER.platformManifestDigest
    || validated.container.networkMode !== "none"
    || validated.container.pullPolicy !== "never") {
    throw new Error(`${kind} Docker receipt does not bind exact committed production source and environment`);
  }
  if (kind === "ECONOMY"
    && validated.identityBinding.ownerPolicySha256
      !== context.productionBuildSource.ownerPolicySha256) {
    throw new Error("Economy Docker receipt does not bind the exact owner-policy source");
  }
  if (kind === "ECONOMY"
    && (validated.recipe.productionFeature !== "runtime-production-entrypoint"
      || validated.recipe.forbiddenFeature !== "sbf-preflight-entrypoint"
      || validated.recipe.arguments.includes("sbf-preflight-entrypoint"))) {
    throw new Error("Economy Docker receipt does not bind production source closure");
  }
  return validated;
}

function observeProductionArtifact(descriptor, kind, context, repositoryRoot, blockers) {
  const prefix = `PRODUCTION_${kind}`;
  if (!exactKeys(descriptor, EXACT_PRODUCTION_ARTIFACT_KEYS) || descriptor.kind !== kind) {
    addBlocker(blockers, `${prefix}_SHAPE_INVALID`, `${kind} production evidence fields are not exact`, "production-byte-evidence");
    return null;
  }
  try {
    const artifact = readExactExternalFile(descriptor.artifactPath, repositoryRoot, {
      label: `${kind} artifact`, maximumBytes: MAX_ARTIFACT_BYTES, requireElf: true,
    });
    const receiptFile = readExactExternalFile(descriptor.receiptPath, repositoryRoot, {
      label: `${kind} receipt`, maximumBytes: MAX_RECEIPT_BYTES,
    });
    const firstLog = readExactExternalFile(descriptor.firstBuildLogPath, repositoryRoot, {
      label: `${kind} first raw build log`, maximumBytes: MAX_RAW_LOG_BYTES,
    });
    const secondLog = readExactExternalFile(descriptor.secondBuildLogPath, repositoryRoot, {
      label: `${kind} second raw build log`, maximumBytes: MAX_RAW_LOG_BYTES,
    });
    if (new Set([artifact.path, receiptFile.path, firstLog.path, secondLog.path]).size !== 4) {
      throw new Error(`${kind} artifact, receipt, and raw logs must be four distinct files`);
    }
    const receipt = projectDockerBuildReceipt(
      parseB3OwnerPolicyFreezeJson(receiptFile.bytes.toString("utf8"), receiptFile.path),
      kind,
      context,
    );
    if (descriptor.artifactSha256 !== artifact.sha256
      || descriptor.artifactByteLength !== artifact.byteLength
      || descriptor.receiptFileSha256 !== receiptFile.sha256
      || descriptor.firstBuildLogSha256 !== firstLog.sha256
      || descriptor.secondBuildLogSha256 !== secondLog.sha256
      || receipt.artifact.sha256 !== artifact.sha256
      || receipt.artifact.byteLength !== artifact.byteLength
      || receipt.artifact.firstBuildLogSha256 !== firstLog.sha256
      || receipt.artifact.secondBuildLogSha256 !== secondLog.sha256
      || firstLog.sha256 === secondLog.sha256) {
      throw new Error(`${kind} artifact, receipt, or raw log binding mismatch`);
    }
    return Object.freeze({
      kind, artifactPath: artifact.path, artifactSha256: artifact.sha256,
      artifactByteLength: artifact.byteLength, receiptPath: receiptFile.path,
      receiptFileSha256: receiptFile.sha256, receiptRecordSha256: receipt.receiptSha256,
      firstBuildLogPath: firstLog.path, firstBuildLogSha256: firstLog.sha256,
      secondBuildLogPath: secondLog.path, secondBuildLogSha256: secondLog.sha256,
      sourceHeadSha: receipt.source.declaredHeadSha,
      sourceTreeSha: receipt.source.observedTreeSha,
      committedRunnerSha256: receipt.source.committedRunnerSha256,
      dockerReceiptValidated: true,
    });
  } catch (error) {
    addBlocker(blockers, `${prefix}_EVIDENCE_INVALID`, error instanceof Error ? error.message : String(error), "production-byte-evidence");
    return null;
  }
}

function observeJsonEvidenceFile(path, declaredSha256, repositoryRoot, label, validator) {
  const file = readExactExternalFile(path, repositoryRoot, {
    label, maximumBytes: MAX_RECEIPT_BYTES,
  });
  if (declaredSha256 !== file.sha256) throw new Error(`${label} file SHA-256 mismatch`);
  const record = validator(parseB3OwnerPolicyFreezeJson(file.bytes.toString("utf8"), file.path));
  return Object.freeze({ path: file.path, fileSha256: file.sha256, record });
}

function validateToolchain(packet, expected, blockers) {
  if (!exactKeys(packet?.productionToolchain, EXACT_TOOLCHAIN_KEYS)) {
    addBlocker(blockers, "TOOLCHAIN_INPUT_INVALID", "toolchain must have the exact pinned offline-build fields", "input");
    return false;
  }
  let ready = true;
  for (const [key, value] of Object.entries(expected)) {
    if (packet.productionToolchain[key] !== value) {
      addBlocker(blockers, `TOOLCHAIN_${key.toUpperCase()}_DRIFT`, `${key} differs from the canonical pinned build recipe`, "toolchain");
      ready = false;
    }
  }
  return ready;
}

function validateClusterPolicy(packet, context, blockers) {
  const policy = packet?.clusterPolicy;
  if (!exactKeys(policy, EXACT_CLUSTER_POLICY_KEYS)
    || !exactKeys(policy?.identities, EXACT_IDENTITY_KEYS)) {
    addBlocker(blockers, "CLUSTER_POLICY_INVALID", "cluster policy must have the exact disposable Devnet identity fields", "input");
    return Object.freeze({ ready: false, identityBindingSha256: null });
  }
  const exactValues = {
    network: "solana-devnet",
    rpcUrl: context.devnetBoundary.rpcUrl,
    genesisHash: context.devnetBoundary.genesisHash,
    identityPolicy: ALL_FEATURE_DEVNET_IDENTITY_POLICY,
    allIdentitiesNonProduction: true,
    programsDisposable: true,
    mintDisposable: true,
    mainnetIdentityReuseForbidden: true,
    keysRetainedUntilFinalReconciliation: true,
  };
  let ready = true;
  for (const [key, expected] of Object.entries(exactValues)) {
    if (policy[key] !== expected) {
      addBlocker(blockers, `CLUSTER_${key.toUpperCase()}_INVALID`, `${key} is not the required fail-closed disposable Devnet value`, "cluster");
      ready = false;
    }
  }
  const identities = Object.values(policy.identities);
  if (!identities.every(isCanonicalBase58Key) || new Set(identities).size !== 3) {
    addBlocker(blockers, "CLUSTER_IDENTITIES_INVALID", "law, economy, and mint must be three distinct canonical public keys", "cluster");
    ready = false;
  }
  const forbidden = new Set([
    ...(context.forbiddenDevnetIdentities ?? []),
    ...Object.values(context.knownProductionIdentities ?? {}).filter(
      (value) => typeof value === "string",
    ),
  ]);
  const reused = identities.filter((identity) => forbidden.has(identity));
  if (reused.length > 0) {
    addBlocker(
      blockers,
      "CLUSTER_IDENTITIES_NOT_FRESH",
      "disposable Devnet identities reuse a production, V2, standard-program, or checked-in fixture identity",
      "cluster",
    );
    ready = false;
  }
  if (!HEX_SHA256.test(policy.cleanupPlanSha256)) {
    addBlocker(blockers, "CLUSTER_CLEANUP_PLAN_MISSING", "disposable public state needs an exact cleanup/recovery plan digest", "cluster");
    ready = false;
  }
  return Object.freeze({
    ready,
    identityBindingSha256: canonicalSha256(policy.identities),
  });
}

function validateProductionIdentityPacket(packet, context, blockers) {
  if (!exactKeys(packet, EXACT_PRODUCTION_IDENTITY_KEYS)
    || context.productionBuildSource?.ready !== true) {
    addBlocker(blockers, "PRODUCTION_IDENTITY_BINDING_UNAVAILABLE", context.productionBuildSource?.failure ?? "production identity binding is unavailable", "production-byte-evidence");
    return false;
  }
  const core = {
    lawProgramId: packet.lawProgramId,
    economyProgramId: packet.economyProgramId,
    canonicalMint: packet.canonicalMint,
    compiledLawDomainGenesisHash: packet.compiledLawDomainGenesisHash,
  };
  if (canonicalSha256(core) !== packet.bindingSha256
    || canonicalSha256(core) !== context.productionBuildSource.identityBindingSha256
    || packet.compiledLawDomainGenesisHash === context.devnetBoundary.genesisHash
    || Object.entries(core).some(([key, value]) =>
      value !== context.productionBuildSource.identities[key])) {
    addBlocker(blockers, "PRODUCTION_IDENTITY_BINDING_INVALID", "production-byte evidence must bind the exact production program IDs, mint, and compiled Mainnet Law domain", "production-byte-evidence");
    return false;
  }
  return true;
}

function validateProductionByteEvidence(packet, context, repositoryRoot, blockers) {
  const evidence = packet?.productionByteEvidence;
  if (!exactKeys(evidence, EXACT_PRODUCTION_BYTE_EVIDENCE_KEYS)
    || evidence.policy !== ALL_FEATURE_PRODUCTION_BYTE_EVIDENCE_POLICY
    || evidence.publicDevnetCannotSatisfyFinalByteProof !== true
    || !exactKeys(evidence.artifacts, EXACT_ARTIFACT_SET_KEYS)
    || !exactKeys(evidence.localValidator, EXACT_LOCAL_VALIDATOR_EVIDENCE_KEYS)) {
    addBlocker(blockers, "PRODUCTION_BYTE_EVIDENCE_SHAPE_INVALID", "exact production-byte evidence must use the isolated local-validator schema", "production-byte-evidence");
    return Object.freeze({ ready: false, artifacts: Object.freeze({ law: null, economy: null }), bindingSha256: null });
  }
  const identitiesReady = validateProductionIdentityPacket(evidence.identities, context, blockers);
  const artifacts = Object.freeze({
    law: observeProductionArtifact(evidence.artifacts.law, "LAW", context, repositoryRoot, blockers),
    economy: observeProductionArtifact(evidence.artifacts.economy, "ECONOMY", context, repositoryRoot, blockers),
  });
  const artifactPaths = [
    ...Object.values(artifacts).flatMap((entry) => entry ? [
      entry.artifactPath, entry.receiptPath, entry.firstBuildLogPath, entry.secondBuildLogPath,
    ] : []),
  ];
  let localPreflight = null;
  let localExecution = null;
  try {
    localPreflight = observeJsonEvidenceFile(
      evidence.localValidator.preflightPath,
      evidence.localValidator.preflightFileSha256,
      repositoryRoot,
      "production local-validator preflight",
      validateIatB3ProductionLocalRehearsalPreflight,
    );
    localExecution = observeJsonEvidenceFile(
      evidence.localValidator.executionReceiptPath,
      evidence.localValidator.executionReceiptFileSha256,
      repositoryRoot,
      "production local-validator execution receipt",
      validateIatB3ProductionLocalRehearsalExecutionReceipt,
    );
  } catch (error) {
    addBlocker(blockers, "PRODUCTION_LOCAL_VALIDATOR_EVIDENCE_INVALID", error instanceof Error ? error.message : String(error), "production-byte-evidence");
  }
  const allPaths = [
    ...artifactPaths,
    ...[localPreflight?.path, localExecution?.path].filter(Boolean),
  ];
  const pathsDistinct = allPaths.length === 10 && new Set(allPaths).size === 10;
  if (!pathsDistinct) {
    addBlocker(blockers, "PRODUCTION_EVIDENCE_PATHS_NOT_DISTINCT", "all artifacts, receipts, raw logs, and local-validator records must resolve to ten distinct files", "production-byte-evidence");
  }
  const preflight = localPreflight?.record;
  const execution = localExecution?.record;
  const declaredBoundary = evidence.localValidator.isolatedLoopbackOnly === true
    && evidence.localValidator.productionPublicIdsPreloaded === true
    && evidence.localValidator.productionPrivateKeysUsed === false
    && evidence.localValidator.compiledMainnetLawDomain === true
    && evidence.localValidator.validatorGenesisClaimedMainnet === false
    && evidence.localValidator.publicNetworkUsed === false;
  const officialPreflight = preflight?.status === "OFFICIAL_READY"
    && preflight.validationAuthority === "SOURCE_BOUND_IDENTITY_AND_DOCKER_RECEIPT_VALIDATORS"
    && preflight.declaredHeadSha === context.source.headSha
    && preflight.safety?.officialIdentityAndReceiptValidatorsUsed === true
    && preflight.safety?.networkUsed === false
    && !preflight.blockers?.includes("TEST_ONLY_VALIDATOR_OVERRIDE");
  const executionAccepted = execution?.complete === true
    && execution.exitCode === 0
    && execution.status === "EXACT_PRODUCTION_BYTES_LOCAL_REHEARSAL_VERIFIED"
    && execution.preflightSha256 === preflight?.preflightSha256
    && execution.inputBindingSha256 === preflight?.inputBindingSha256
    && execution.safety?.localLoopbackOnly === true
    && execution.safety?.publicNetworkUsed === false
    && execution.safety?.keyGenerated === false
    && execution.safety?.executionEvidenceAccepted === true
    && execution.safety?.all15Observed === true
    && execution.safety?.allFiveRollbackAndRetryProbesObserved === true
    && execution.runtimeBindings?.validatorGenesisClaimedMainnet === false
    && execution.runtimeBindings?.compiledLawDomainGenesisHash
      === evidence.identities.compiledLawDomainGenesisHash;
  if (!declaredBoundary || !officialPreflight || !executionAccepted) {
    addBlocker(
      blockers,
      "PRODUCTION_LOCAL_FINAL_BYTE_EXECUTION_NOT_ACCEPTED",
      "strict Docker receipts are validated, but no accepted isolated local-validator exact-final-byte execution receipt exists",
      "production-byte-evidence",
    );
  }
  const ready = identitiesReady && artifacts.law !== null && artifacts.economy !== null
    && pathsDistinct
    && declaredBoundary && officialPreflight && executionAccepted;
  const summary = Object.freeze({
    policy: evidence.policy,
    ready,
    identityBindingSha256: evidence.identities.bindingSha256,
    artifacts,
    localValidator: Object.freeze({
      preflightFileSha256: localPreflight?.fileSha256 ?? null,
      preflightStatus: preflight?.status ?? null,
      executionReceiptFileSha256: localExecution?.fileSha256 ?? null,
      executionStatus: execution?.status ?? null,
      executionEvidenceAccepted: execution?.safety?.executionEvidenceAccepted === true,
      isolatedLoopbackOnly: evidence.localValidator.isolatedLoopbackOnly === true,
      compiledMainnetLawDomain: evidence.localValidator.compiledMainnetLawDomain === true,
      publicNetworkUsed: false,
    }),
  });
  return Object.freeze({ ...summary, bindingSha256: canonicalSha256(summary) });
}

function validatePublicDevnetBehavioralEvidence(packet, context, cluster, repositoryRoot, blockers) {
  const evidence = packet?.publicDevnetBehavioralEvidence;
  if (!exactKeys(evidence, EXACT_PUBLIC_DEVNET_BEHAVIORAL_KEYS)
    || evidence.policy !== ALL_FEATURE_PUBLIC_DEVNET_BEHAVIORAL_EVIDENCE_POLICY
    || evidence.devnetDomain !== context.devnetBoundary.genesisHash
    || evidence.disposableIdentities !== true
    || evidence.productionArtifactReuseForbidden !== true
    || evidence.finalByteEvidenceAccepted !== false
    || !exactKeys(evidence.artifacts, EXACT_ARTIFACT_SET_KEYS)) {
    addBlocker(blockers, "PUBLIC_DEVNET_BEHAVIORAL_EVIDENCE_INVALID", "public Devnet must be disposable-identity, Devnet-domain behavioral evidence and never final-byte proof", "public-devnet-behavioral-evidence");
    return Object.freeze({ ready: false, artifacts: Object.freeze({ law: null, economy: null }), bindingSha256: null });
  }
  const declaredEvidenceSha256 = canonicalSha256(evidence);
  const artifacts = {};
  for (const [name, kind] of [["law", "LAW"], ["economy", "ECONOMY"]]) {
    const descriptor = evidence.artifacts[name];
    try {
      if (!exactKeys(descriptor, EXACT_PUBLIC_DEVNET_ARTIFACT_KEYS)
        || descriptor.kind !== kind
        || descriptor.sourceHeadSha !== context.source.headSha
        || descriptor.identityBindingSha256 !== cluster.identityBindingSha256
        || descriptor.networkGenesisHash !== context.devnetBoundary.genesisHash) {
        throw new Error(`${kind} disposable Devnet descriptor is not exact`);
      }
      const observed = readExactExternalFile(descriptor.path, repositoryRoot, {
        label: `${kind} disposable Devnet artifact`, maximumBytes: MAX_ARTIFACT_BYTES, requireElf: true,
      });
      if (descriptor.sha256 !== observed.sha256 || descriptor.byteLength !== observed.byteLength) {
        throw new Error(`${kind} disposable Devnet artifact bytes do not match`);
      }
      artifacts[name] = Object.freeze({ kind, path: observed.path, sha256: observed.sha256, byteLength: observed.byteLength });
    } catch (error) {
      addBlocker(blockers, `PUBLIC_DEVNET_${kind}_ARTIFACT_INVALID`, error instanceof Error ? error.message : String(error), "public-devnet-behavioral-evidence");
      artifacts[name] = null;
    }
  }
  const productionHashes = new Set([
    packet.productionByteEvidence?.artifacts?.law?.artifactSha256,
    packet.productionByteEvidence?.artifacts?.economy?.artifactSha256,
  ].filter((value) => typeof value === "string"));
  if (Object.values(artifacts).some((entry) => entry && productionHashes.has(entry.sha256))) {
    addBlocker(blockers, "PUBLIC_DEVNET_PRODUCTION_ARTIFACT_REUSE", "public Devnet cannot deploy a production-identity/Mainnet-domain final artifact", "public-devnet-behavioral-evidence");
  }
  addBlocker(
    blockers,
    "DISPOSABLE_DEVNET_EXACT_SOURCE_RECEIPT_UNAVAILABLE",
    "no dedicated source-bound disposable-identity/Devnet-domain Docker receipt schema and validator exists; ELF descriptors alone are not evidence",
    "public-devnet-behavioral-evidence",
  );
  const ready = false;
  const summary = Object.freeze({
    policy: evidence.policy,
    ready,
    artifacts: Object.freeze(artifacts),
    declaredEvidenceSha256,
    descriptorBytesObservedOnly: true,
    exactSourceReceiptValidated: false,
    finalByteEvidenceAccepted: false,
  });
  return Object.freeze({ ...summary, bindingSha256: declaredEvidenceSha256 });
}

function validateFunding(packet, evaluationUnixSeconds, blockers) {
  const funding = packet?.funding;
  if (!exactKeys(funding, EXACT_FUNDING_KEYS)) {
    addBlocker(blockers, "FUNDING_INPUT_INVALID", "funding must have the exact payer, balance, peak, approval, and observation fields", "input");
    return Object.freeze({ ready: false, bindingSha256: null });
  }
  let ready = true;
  if (funding.mode !== "EXPLICIT_DISPOSABLE_DEVNET_PAYER"
    || !isCanonicalBase58Key(funding.payerPublicKey)
    || funding.approved !== true
    || !SAFE_EVIDENCE_ID.test(funding.approvalId)
    || !HEX_SHA256.test(funding.observationSha256)) {
    addBlocker(blockers, "FUNDING_APPROVAL_INVALID", "funding mode, public payer, evidence, and explicit approval must be complete", "funding");
    ready = false;
  }
  const observed = parseCanonicalU64(funding.observedBalanceLamports);
  const required = parseCanonicalU64(funding.requiredPeakLamports);
  const observedAt = parseCanonicalU64(funding.observationUnixSeconds);
  if (observed === null || required === null || required === 0n || observed < required) {
    addBlocker(blockers, "FUNDING_BALANCE_INSUFFICIENT", "fresh observed payer balance must cover the approved peak requirement", "funding");
    ready = false;
  }
  if (observedAt === null
    || observedAt > evaluationUnixSeconds + ALL_FEATURE_DEVNET_MAX_FUTURE_SKEW_SECONDS
    || evaluationUnixSeconds - observedAt > ALL_FEATURE_DEVNET_MAX_OBSERVATION_AGE_SECONDS) {
    addBlocker(blockers, "FUNDING_OBSERVATION_STALE", "payer observation must be within the one-hour readiness window", "funding");
    ready = false;
  }
  return Object.freeze({ ready, bindingSha256: canonicalSha256(funding) });
}

function validateFailurePolicy(packet, blockers) {
  const policy = packet?.failurePolicy;
  if (!exactKeys(policy, EXACT_FAILURE_POLICY_KEYS)) {
    addBlocker(blockers, "FAILURE_POLICY_INVALID", "failure policy must have every rollback and ambiguous-send field", "input");
    return Object.freeze({ ready: false, bindingSha256: null });
  }
  let ready = true;
  for (const [key, expected] of Object.entries(REQUIRED_ALL_FEATURE_DEVNET_FAILURE_POLICY)) {
    if (policy[key] !== expected) {
      addBlocker(blockers, `FAILURE_POLICY_${key.toUpperCase()}_UNSAFE`, `${key} differs from the required stop-and-reconcile policy`, "failure-policy");
      ready = false;
    }
  }
  return Object.freeze({ ready, bindingSha256: canonicalSha256(policy) });
}

function validateFreshWindow(value, label, evaluationUnixSeconds, blockers) {
  const parsed = parseCanonicalU64(value);
  if (parsed === null
    || parsed > evaluationUnixSeconds + ALL_FEATURE_DEVNET_MAX_FUTURE_SKEW_SECONDS
    || evaluationUnixSeconds - parsed > ALL_FEATURE_DEVNET_MAX_OBSERVATION_AGE_SECONDS) {
    addBlocker(blockers, `${label}_STALE`, `${label.toLowerCase()} time must be within the one-hour readiness window`, label.toLowerCase());
    return false;
  }
  return true;
}

function validateBindings(record, bindings, prefix, blockers) {
  let ready = true;
  for (const [key, expected] of Object.entries(bindings)) {
    if (record[key] !== expected) {
      addBlocker(blockers, `${prefix}_${key.toUpperCase()}_MISMATCH`, `${prefix.toLowerCase()} does not bind the exact ${key}`, prefix.toLowerCase());
      ready = false;
    }
  }
  return ready;
}

function validateAuthorizationAndVerification(packet, bindings, evaluationUnixSeconds, blockers) {
  const authorization = packet?.authorization;
  const verification = packet?.automatedVerification;
  let authorizationReady = true;
  let automatedVerificationReady = true;
  if (!exactKeys(authorization, EXACT_AUTHORIZATION_KEYS)) {
    addBlocker(blockers, "AUTHORIZATION_INPUT_INVALID", "authorization must have the exact Devnet-only binding fields", "input");
    authorizationReady = false;
  } else {
    if (authorization.confirmation !== ALL_FEATURE_DEVNET_AUTHORIZATION_CONFIRMATION
      || authorization.scope !== ALL_FEATURE_DEVNET_AUTHORIZATION_SCOPE
      || authorization.soleHumanGate !== ALL_FEATURE_DEVNET_SOLE_HUMAN_GATE
      || authorization.signatureDeviceModel !== ALL_FEATURE_DEVNET_SIGNATURE_DEVICE
      || authorization.allNonSignatureClaimsDirectlyObserved !== true
      || authorization.authorized !== true
      || !SAFE_EVIDENCE_ID.test(authorization.authorizationId)
      || !SAFE_EVIDENCE_ID.test(authorization.authorizedBy)) {
      addBlocker(blockers, "DEVNET_AUTHORIZATION_ABSENT", "exact all-feature public Devnet authorization is absent or malformed", "authorization");
      authorizationReady = false;
    }
    authorizationReady = validateFreshWindow(
      authorization.authorizedAtUnixSeconds,
      "AUTHORIZATION",
      evaluationUnixSeconds,
      blockers,
    ) && authorizationReady;
    const authorizedAt = parseCanonicalU64(authorization.authorizedAtUnixSeconds);
    const expiry = parseCanonicalU64(authorization.expiresAtUnixSeconds);
    if (expiry === null
      || authorizedAt === null
      || expiry <= evaluationUnixSeconds
      || expiry > authorizedAt + ALL_FEATURE_DEVNET_MAX_OBSERVATION_AGE_SECONDS) {
      addBlocker(blockers, "AUTHORIZATION_WINDOW_INVALID", "Devnet authorization must be live and may last no more than one hour", "authorization");
      authorizationReady = false;
    }
    authorizationReady = validateBindings(
      authorization,
      bindings,
      "AUTHORIZATION",
      blockers,
    ) && authorizationReady;
  }
  if (!exactKeys(verification, EXACT_AUTOMATED_VERIFICATION_KEYS)) {
    addBlocker(blockers, "AUTOMATED_VERIFICATION_INPUT_INVALID", "automatedVerification must have the exact source-bound evidence fields", "input");
    automatedVerificationReady = false;
  } else {
    if (!SAFE_EVIDENCE_ID.test(verification.verificationId)
      || verification.verifierType !== ALL_FEATURE_DEVNET_AUTOMATED_VERIFIER_TYPE
      || verification.verifierLane !== ALL_FEATURE_DEVNET_AUTOMATED_VERIFIER_LANE
      || verification.directEvidenceOnly !== true
      || verification.humanReviewerRequired !== false
      || verification.accepted !== true) {
      addBlocker(blockers, "AUTOMATED_VERIFICATION_ABSENT", "the exact automated source-bound red-team verification is absent or malformed", "automated-verification");
      automatedVerificationReady = false;
    }
    automatedVerificationReady = validateFreshWindow(
      verification.verifiedAtUnixSeconds,
      "AUTOMATED_VERIFICATION",
      evaluationUnixSeconds,
      blockers,
    ) && automatedVerificationReady;
    automatedVerificationReady = validateBindings(
      verification,
      bindings,
      "AUTOMATED_VERIFICATION",
      blockers,
    ) && automatedVerificationReady;
  }
  return Object.freeze({ authorizationReady, automatedVerificationReady });
}

function addCanonicalSourceBlockers(context, blockers) {
  if (!HEAD_SHA.test(context.source.headSha)) {
    addBlocker(blockers, "SOURCE_HEAD_INVALID", "observed Git HEAD is not a full commit SHA", "source");
  }
  if (context.source.statusPorcelain !== "") {
    addBlocker(blockers, "SOURCE_NOT_CLEAN", "tracked or untracked worktree changes exist", "source");
  }
  if (context.productionBuildSource?.ready !== true) {
    addBlocker(
      blockers,
      "PRODUCTION_SOURCE_BINDING_UNAVAILABLE",
      context.productionBuildSource?.failure
        ?? "exact production identity, runner, and environment source bindings are unavailable",
      "production-byte-evidence",
    );
  }
  if (context.ceremonyStages?.valid === false) {
    addBlocker(
      blockers,
      "CEREMONY_STAGE_SOURCE_INVALID",
      context.ceremonyStages.failure ?? "the exact committed 17-stage ceremony source is invalid",
      "authority-evidence-validator",
    );
  }
  const productionMap = context.operationMaps?.map;
  if (context.operationMaps?.ready !== true || productionMap === null) {
    addBlocker(
      blockers,
      "PRODUCTION_TRANSACTION_MAP_UNAVAILABLE",
      context.operationMaps?.failure
        ?? "the exact committed R06 production transaction map is unavailable",
      "production-transaction-map",
    );
  } else {
    try {
      validateIatB3ProductionTransactionMaps(productionMap);
      const expectedCounts = [1, 1, 1, 1, 1, 6, "17/18", 17, 1, "12-or-1", 12, 7, 1, 1, 1];
      const actualCounts = productionMap.operations.map(({ opcode, variants }) => {
        const counts = [...new Set(variants.map(({ totalMetaCount }) => totalMetaCount))];
        if (opcode === 6) return counts.join("/");
        if (opcode === 9) return counts.includes(12) && counts.includes(1) ? "12-or-1" : counts.join("/");
        return counts[0];
      });
      const opcode9 = productionMap.operations[9];
      if (canonicalSha256(actualCounts) !== canonicalSha256(expectedCounts)
        || productionMap.transactionPrefix.accountCount !== 1
        || productionMap.transactionPrefix.role !== "daily_law_state"
        || productionMap.transactionPrefix.authenticatedBeforeAbiDecode !== true
        || opcode9.disposition
          !== "LANE_CONDITIONAL_ACTIVE_OR_CORE_CUSTODY_POLICY_HOLD"
        || canonicalSha256(opcode9.variants.map(({ name, lanes, excludedLanes, totalMetaCount }) => ({
          name,
          lanes: lanes ?? null,
          excludedLanes: excludedLanes ?? null,
          totalMetaCount,
        }))) !== canonicalSha256([
          { name: "NON_CORE_ACTIVE", lanes: [1, 2, 4], excludedLanes: null, totalMetaCount: 12 },
          { name: "CORE_CUSTODY_HOLD", lanes: [3], excludedLanes: null, totalMetaCount: 1 },
          { name: "INVALID_LANE", lanes: null, excludedLanes: [1, 2, 3, 4], totalMetaCount: 1 },
        ])) {
        throw new Error("Daily-Law prefix, exact account counts, or opcode9 lane semantics drifted");
      }
    } catch (error) {
      addBlocker(
        blockers,
        "PRODUCTION_TRANSACTION_MAP_INVALID",
        error instanceof Error ? error.message : String(error),
        "production-transaction-map",
      );
    }
  }
  if (context.authorityValidation?.valid === false) {
    for (const violation of context.authorityValidation.violations ?? [
      "canonical production identity authority evidence is invalid",
    ]) {
      addBlocker(
        blockers,
        "AUTHORITY_EVIDENCE_INVALID",
        violation,
        "authority-evidence-validator",
      );
    }
  }
  for (const [key, expected] of Object.entries(REQUIRED_DISPATCH_TRUTH)) {
    if (context.dispatchTruth[key] !== expected) {
      addBlocker(blockers, `DISPATCH_${key.toUpperCase()}_BLOCKED`, `production dispatch truth requires ${key}=${String(expected)} but exact source reports ${String(context.dispatchTruth[key])}`, "production-dispatch");
    }
  }
  for (const [key, expected] of Object.entries(REQUIRED_ALL_15_MATRIX_TRUTH)) {
    if (context.all15MatrixTruth[key] !== expected) {
      addBlocker(blockers, `ALL_15_${key.toUpperCase()}_BLOCKED`, `economic write-gate matrix requires ${key}=${String(expected)} but reports ${String(context.all15MatrixTruth[key])}`, "economic-write-gates");
    }
  }
  if (!context.ownerPolicyValidation.valid) {
    for (const violation of context.ownerPolicyValidation.violations) {
      addBlocker(blockers, "OWNER_POLICY_INVALID", violation, "owner-policy-validator");
    }
  }
  const devnetOwnerChoiceState = context.ownerPolicyValidation.nodeChoiceState;
  if (devnetOwnerChoiceState) {
    for (const nodeId of REQUIRED_DEVNET_OWNER_CHOICE_NODE_IDS) {
      if (devnetOwnerChoiceState[nodeId]?.structurallyComplete !== true) {
        const detail = context.ownerPolicyValidation.blockers.find((entry) =>
          entry.startsWith(`${nodeId}:`)) ?? `${nodeId}: Devnet-relevant owner choice is incomplete`;
        addBlocker(blockers, "OWNER_POLICY_CHOICE_BLOCKED", detail, "owner-policy-validator");
      }
    }
  } else if (!context.ownerPolicyValidation.ownerChoicesStructurallyComplete
    || !context.ownerPolicyValidation.safeDecisionOrderSatisfied) {
    for (const blocker of context.ownerPolicyValidation.blockers) {
      addBlocker(blockers, "OWNER_POLICY_CHOICE_BLOCKED", blocker, "owner-policy-validator");
    }
  }
  if (!context.releaseValidation.valid
    || !context.releaseValidation.dependencyInventoryComplete
    || !context.releaseValidation.dependencyGraphValid) {
    for (const violation of context.releaseValidation.violations) {
      addBlocker(blockers, "RELEASE_GRAPH_INVALID", violation, "release-graph-validator");
    }
  }
  for (const node of context.releaseNodes) {
    if (node.status === "BLOCKED"
      && node.id !== "ADVERSARIAL_DEVNET_REHEARSAL"
      && node.id !== "PRODUCTION_IDENTITY_INPUT_FREEZE"
      && node.id !== "PRODUCTION_BINARY_REPRODUCIBILITY") {
      addBlocker(
        blockers,
        `DEPENDENCY_${node.id}_BLOCKED`,
        node.blocker,
        "release-graph-validator",
      );
    }
  }
}

function emptyPacketSummary() {
  return Object.freeze({
    supplied: false,
    schemaValid: false,
    declaredHeadSha: null,
    productionToolchainReady: false,
    productionByteEvidenceReady: false,
    publicDevnetBehavioralEvidenceReady: false,
    clusterPolicyReady: false,
    fundingReady: false,
    authorizationReady: false,
    automatedVerificationReady: false,
    failurePolicyReady: false,
  });
}

export function assessAllFeatureDevnetReadiness({
  packet = null,
  context,
  repositoryRoot = REPOSITORY_ROOT,
  evaluationUnixSeconds = BigInt(Math.floor(Date.now() / 1_000)),
} = {}) {
  if (!context || typeof context !== "object") throw new TypeError("canonical readiness context is required");
  if (typeof evaluationUnixSeconds !== "bigint" || evaluationUnixSeconds <= 0n) {
    throw new TypeError("evaluationUnixSeconds must be a positive bigint");
  }
  const blockers = new Map();
  const testOnly = !CANONICAL_CONTEXTS.has(context);
  if (testOnly) {
    addBlocker(
      blockers,
      "TEST_ONLY_CONTEXT_INJECTED",
      "injected contexts are adversarial test seams and can never produce operational readiness",
      "test-boundary",
    );
  }
  addCanonicalSourceBlockers(context, blockers);
  let packetSummary = emptyPacketSummary();
  let cluster = Object.freeze({ ready: false, identityBindingSha256: null });
  let productionByteEvidence = Object.freeze({
    ready: false,
    artifacts: Object.freeze({ law: null, economy: null }),
    bindingSha256: null,
  });
  let publicDevnetBehavioralEvidence = Object.freeze({
    ready: false,
    artifacts: Object.freeze({ law: null, economy: null }),
    bindingSha256: null,
  });
  let funding = Object.freeze({ ready: false, bindingSha256: null });
  let failure = Object.freeze({ ready: false, bindingSha256: null });
  let authorizationVerification = Object.freeze({
    authorizationReady: false,
    automatedVerificationReady: false,
  });
  if (packet === null) {
    addBlocker(blockers, "READINESS_INPUT_REQUIRED", "supply one strict all-feature Devnet readiness input packet", "input");
  } else if (!exactKeys(packet, EXACT_PACKET_KEYS)
    || packet.schema !== ALL_FEATURE_DEVNET_INPUT_SCHEMA) {
    addBlocker(blockers, "READINESS_INPUT_SCHEMA_INVALID", "input packet schema or top-level fields are not exact", "input");
  } else {
    const productionToolchainReady = validateToolchain(
      packet,
      context.toolchainPolicy,
      blockers,
    );
    if (packet.declaredHeadSha !== context.source.headSha) {
      addBlocker(blockers, "DECLARED_HEAD_MISMATCH", "input packet does not bind the observed exact Git HEAD", "source");
    }
    cluster = validateClusterPolicy(packet, context, blockers);
    productionByteEvidence = validateProductionByteEvidence(
      packet,
      context,
      repositoryRoot,
      blockers,
    );
    publicDevnetBehavioralEvidence = validatePublicDevnetBehavioralEvidence(
      packet,
      context,
      cluster,
      repositoryRoot,
      blockers,
    );
    const productionArtifactPaths = new Set(
      Object.values(productionByteEvidence.artifacts ?? {})
        .filter(Boolean)
        .map((entry) => entry.artifactPath),
    );
    if (Object.values(publicDevnetBehavioralEvidence.artifacts ?? {})
      .filter(Boolean)
      .some((entry) => productionArtifactPaths.has(entry.path))) {
      addBlocker(
        blockers,
        "PUBLIC_DEVNET_PRODUCTION_ARTIFACT_PATH_REUSE",
        "public Devnet behavioral artifacts must be separate files from exact production artifacts",
        "public-devnet-behavioral-evidence",
      );
      publicDevnetBehavioralEvidence = Object.freeze({
        ...publicDevnetBehavioralEvidence,
        ready: false,
      });
    }
    funding = validateFunding(packet, evaluationUnixSeconds, blockers);
    failure = validateFailurePolicy(packet, blockers);
    const bindings = Object.freeze({
      declaredHeadSha: context.source.headSha,
      productionByteEvidenceSha256: productionByteEvidence.bindingSha256,
      publicDevnetBehavioralEvidenceSha256:
        publicDevnetBehavioralEvidence.bindingSha256,
      operationMapsSha256: context.operationMaps.bindingSha256,
      ceremonyStagesSha256: context.ceremonyStages.bindingSha256,
      fundingSha256: funding.bindingSha256,
      failurePolicySha256: failure.bindingSha256,
    });
    authorizationVerification = validateAuthorizationAndVerification(
      packet,
      bindings,
      evaluationUnixSeconds,
      blockers,
    );
    packetSummary = Object.freeze({
      supplied: true,
      schemaValid: true,
      declaredHeadSha: packet.declaredHeadSha,
      productionToolchainReady,
      productionByteEvidenceReady: productionByteEvidence.ready,
      publicDevnetBehavioralEvidenceReady:
        publicDevnetBehavioralEvidence.ready,
      clusterPolicyReady: cluster.ready,
      fundingReady: funding.ready,
      authorizationReady: authorizationVerification.authorizationReady,
      automatedVerificationReady:
        authorizationVerification.automatedVerificationReady,
      failurePolicyReady: failure.ready,
    });
  }
  const orderedBlockers = Object.freeze(
    [...blockers.values()].sort((left, right) =>
      left.code.localeCompare(right.code) || left.detail.localeCompare(right.detail)),
  );
  const status = testOnly
    ? "HOLD_TEST"
    : orderedBlockers.length === 0 ? "GO" : "HOLD";
  const withoutDigest = {
    schema: ALL_FEATURE_DEVNET_ASSESSMENT_SCHEMA,
    status,
    evaluatedAtUnixSeconds: evaluationUnixSeconds.toString(),
    scope: Object.freeze({
      decision: "TWO_LANE_PRODUCTION_BYTE_AND_PUBLIC_DEVNET_BEHAVIORAL_READINESS_ONLY",
      doesNotExecuteRehearsal: true,
      doesNotAuthorizeMainnet: true,
      productionByteEvidenceLane:
        ALL_FEATURE_PRODUCTION_BYTE_EVIDENCE_POLICY,
      publicDevnetBehavioralEvidenceLane:
        ALL_FEATURE_PUBLIC_DEVNET_BEHAVIORAL_EVIDENCE_POLICY,
      publicDevnetCanNeverSatisfyFinalByteProof: true,
      goRequiresAcceptedLocalFinalByteExecutionEvidence: true,
    }),
    source: Object.freeze({
      declaredHeadSha: packet?.declaredHeadSha ?? null,
      observedHeadSha: context.source.headSha,
      observedTreeSha: context.source.treeSha,
      exactCleanCommittedHead: context.source.statusPorcelain === ""
        && packet?.declaredHeadSha === context.source.headSha
        && !testOnly,
    }),
    canonicalToolchainPolicy: context.toolchainPolicy,
    devnetBoundary: context.devnetBoundary,
    operationMaps: context.operationMaps,
    ceremonyStages: context.ceremonyStages,
    sourceReadiness: Object.freeze({
      productionDispatchTruth: context.dispatchTruth,
      all15MatrixTruth: context.all15MatrixTruth,
      ownerPolicy: Object.freeze({
        valid: context.ownerPolicyValidation.valid,
        ownerChoicesStructurallyComplete:
          context.ownerPolicyValidation.ownerChoicesStructurallyComplete,
        safeDecisionOrderSatisfied:
          context.ownerPolicyValidation.safeDecisionOrderSatisfied,
        devnetRelevantChoiceNodeIds: REQUIRED_DEVNET_OWNER_CHOICE_NODE_IDS,
      }),
      releaseGraph: Object.freeze({
        valid: context.releaseValidation.valid,
        dependencyInventoryComplete:
          context.releaseValidation.dependencyInventoryComplete,
        dependencyGraphValid: context.releaseValidation.dependencyGraphValid,
        adversarialDevnetAncestors: context.releaseNodes,
      }),
      productionBuildSource: context.productionBuildSource,
    }),
    input: packetSummary,
    productionByteEvidence,
    publicDevnetBehavioralEvidence,
    blockers: orderedBlockers,
    safety: Object.freeze({
      networkAccess: false,
      rpcQueries: false,
      signing: false,
      broadcast: false,
      deployment: false,
      fundingSpend: false,
      activation: false,
      writesFiles: false,
      injectedTestSeam: testOnly,
      injectedTestEvidenceAccepted: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: "HOLD",
    }),
  };
  return Object.freeze({
    ...withoutDigest,
    assessmentSha256: canonicalSha256(withoutDigest),
  });
}

export function runAllFeatureDevnetReadinessAssessment({
  inputPath = null,
  repositoryRoot = REPOSITORY_ROOT,
  evaluationUnixSeconds = BigInt(Math.floor(Date.now() / 1_000)),
} = {}) {
  const context = collectCanonicalContext({ repositoryRoot });
  const packet = inputPath === null ? null : readStrictJson(resolve(inputPath));
  return assessAllFeatureDevnetReadiness({
    packet,
    context,
    repositoryRoot,
    evaluationUnixSeconds,
  });
}

function parseCli(argv) {
  if (argv.length === 0) return Object.freeze({ inputPath: null });
  if (argv.length === 2 && argv[0] === "--input" && argv[1]) {
    return Object.freeze({ inputPath: resolve(argv[1]) });
  }
  throw new Error("Usage: assess-iat-b3-all-feature-devnet-readiness.mjs [--input <strict-readiness-input.json>]");
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const assessment = runAllFeatureDevnetReadinessAssessment(parseCli(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
    if (assessment.status !== "GO") process.exitCode = 2;
  } catch (error) {
    const failure = {
      schema: ALL_FEATURE_DEVNET_ASSESSMENT_SCHEMA,
      status: "HOLD",
      blockers: [{
        code: "ASSESSMENT_ERROR",
        detail: error instanceof Error ? error.message : String(error),
        source: "orchestrator",
      }],
      safety: {
        networkAccess: false,
        rpcQueries: false,
        signing: false,
        broadcast: false,
        deployment: false,
        fundingSpend: false,
        activation: false,
        writesFiles: false,
        mainnetExecutionAuthorized: false,
        mainnetStatus: "HOLD",
      },
    };
    process.stdout.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 2;
  }
}
