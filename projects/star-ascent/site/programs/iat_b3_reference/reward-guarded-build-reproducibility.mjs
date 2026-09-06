import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

import {
  REWARD_GUARDED_BUILD_PROVENANCE_SCHEMA,
  assertExecutedRewardGuardedBuildProvenanceReceipt,
  validateRewardGuardedBuildProvenanceReceipt,
  validateRewardGuardedBuildToolchainObservation,
} from "./reward-guarded-build-provenance.mjs";
import { assertRewardGuardedRepositorySourceInventory } from "./reward-guarded-source-inventory.mjs";

export const REWARD_GUARDED_BUILD_REPRODUCIBILITY_SCHEMA =
  "iat-b3-reward-guarded-build-reproducibility/v1";
export const REWARD_GUARDED_BUILD_REPRODUCIBILITY_STATUS =
  "HOST_ONLY_NON_ACTIVATING_DUAL_FRESH_BUILD_BYTE_EQUALITY";
export const REWARD_GUARDED_BUILD_REPRODUCIBILITY_MAINNET_STATUS = "HOLD";

const HEX_32 = /^[0-9a-f]{64}$/u;
const COMPARISON_KEYS = Object.freeze([
  "schema",
  "status",
  "firstReceiptSha256",
  "secondReceiptSha256",
  "recipeSha256",
  "sourceSetSha256",
  "guardedSurfaceSha256",
  "configurationLedgerSha256",
  "executableSha256",
  "nodeVersion",
  "platform",
  "architecture",
  "artifactSetSha256",
  "artifactForbiddenMarkerSetSha256",
  "artifactFileCount",
  "artifactByteCount",
  "independentFreshBuildExecutionsVerified",
  "sameCurrentSourceRevalidated",
  "sameCurrentConfigurationRevalidated",
  "sameCurrentToolchainRevalidated",
  "identicalRecipeBindingVerified",
  "identicalConfigurationBindingVerified",
  "identicalToolchainBindingVerified",
  "identicalArtifactByteInventoryVerified",
  "identicalForbiddenMarkerSetVerified",
  "dualFreshBuildArtifactEqualityVerified",
  "semanticBuildProvenanceVerified",
  "artifactBuiltFromBoundSourceVerified",
  "reproducibleBuildVerified",
  "runtimeConfinementVerified",
  "providerAuthenticationVerified",
  "rollbackProtectionVerified",
  "materializedProjectionStateVerified",
  "externalSideEffectsAuthorized",
  "sourceBoundAutomatedDirectEvidenceVerified",
  "activationReady",
  "mainnetStatus",
  "comparisonSha256",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  return JSON.stringify(value, (_key, entry) => (
    typeof entry === "bigint" ? { $u64: entry.toString() } : entry
  ));
}

function digestRecord(value) {
  return sha256(canonicalJson(value));
}

function hasExactDataKeys(value, expected) {
  if (!value
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string")) return false;
  const canonical = [...expected].sort();
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !("value" in descriptor)
      || "get" in descriptor
      || "set" in descriptor) return false;
  }
  return actual.length === canonical.length
    && [...actual].sort().every((key, index) => key === canonical[index]);
}

function asHex32(value, label) {
  if (typeof value !== "string" || !HEX_32.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase SHA-256`);
  }
  return value;
}

function freezeResult(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) freezeResult(child);
  }
  return Object.freeze(value);
}

function readCurrentConfigurationLedger(sourceRoot, expectedLedger) {
  return expectedLedger.map(({ path }) => {
    const absolutePath = resolve(sourceRoot, path);
    if (absolutePath !== sourceRoot && !absolutePath.startsWith(`${sourceRoot}${sep}`)) {
      throw new Error("REWARD_GUARDED_REPRODUCIBILITY_CONFIGURATION_PATH_ESCAPE");
    }
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error("REWARD_GUARDED_REPRODUCIBILITY_CONFIGURATION_FILE_REQUIRED");
    }
    const bytes = readFileSync(absolutePath);
    return { path, byteLength: bytes.length, sha256: sha256(bytes) };
  });
}

export function validateRewardGuardedBuildReproducibilityReceipt(receipt) {
  if (!hasExactDataKeys(receipt, COMPARISON_KEYS)
    || receipt.schema !== REWARD_GUARDED_BUILD_REPRODUCIBILITY_SCHEMA
    || receipt.status !== REWARD_GUARDED_BUILD_REPRODUCIBILITY_STATUS
    || receipt.independentFreshBuildExecutionsVerified !== true
    || receipt.sameCurrentSourceRevalidated !== true
    || receipt.sameCurrentConfigurationRevalidated !== true
    || receipt.sameCurrentToolchainRevalidated !== true
    || receipt.identicalRecipeBindingVerified !== true
    || receipt.identicalConfigurationBindingVerified !== true
    || receipt.identicalToolchainBindingVerified !== true
    || receipt.identicalArtifactByteInventoryVerified !== true
    || receipt.identicalForbiddenMarkerSetVerified !== true
    || receipt.dualFreshBuildArtifactEqualityVerified !== true
    || receipt.semanticBuildProvenanceVerified !== false
    || receipt.artifactBuiltFromBoundSourceVerified !== false
    || receipt.reproducibleBuildVerified !== false
    || receipt.runtimeConfinementVerified !== false
    || receipt.providerAuthenticationVerified !== false
    || receipt.rollbackProtectionVerified !== false
    || receipt.materializedProjectionStateVerified !== false
    || receipt.externalSideEffectsAuthorized !== false
    || receipt.sourceBoundAutomatedDirectEvidenceVerified !== false
    || receipt.activationReady !== false
    || receipt.mainnetStatus !== REWARD_GUARDED_BUILD_REPRODUCIBILITY_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_GUARDED_BUILD_REPRODUCIBILITY_RECEIPT");
  }
  for (const [value, label] of [
    [receipt.firstReceiptSha256, "first build-receipt digest"],
    [receipt.secondReceiptSha256, "second build-receipt digest"],
    [receipt.recipeSha256, "reproducibility recipe digest"],
    [receipt.sourceSetSha256, "reproducibility source-set digest"],
    [receipt.guardedSurfaceSha256, "reproducibility guarded-surface digest"],
    [receipt.configurationLedgerSha256, "reproducibility configuration digest"],
    [receipt.executableSha256, "reproducibility executable digest"],
    [receipt.artifactSetSha256, "reproducibility artifact-set digest"],
    [receipt.artifactForbiddenMarkerSetSha256, "reproducibility marker-set digest"],
    [receipt.comparisonSha256, "reproducibility comparison digest"],
  ]) asHex32(value, label);
  if (!Number.isSafeInteger(receipt.artifactFileCount) || receipt.artifactFileCount <= 0
    || typeof receipt.artifactByteCount !== "bigint" || receipt.artifactByteCount < 0n
    || typeof receipt.nodeVersion !== "string" || receipt.nodeVersion.length === 0
    || typeof receipt.platform !== "string" || receipt.platform.length === 0
    || typeof receipt.architecture !== "string" || receipt.architecture.length === 0) {
    throw new Error("INVALID_REWARD_GUARDED_BUILD_REPRODUCIBILITY_RECEIPT");
  }
  const { comparisonSha256, ...core } = receipt;
  if (comparisonSha256 !== digestRecord(core)) {
    throw new Error("REWARD_GUARDED_BUILD_REPRODUCIBILITY_DIGEST_MISMATCH");
  }
  return receipt;
}

export function compareIndependentRewardGuardedBuildReceipts({
  firstReceipt,
  secondReceipt,
} = {}) {
  validateRewardGuardedBuildProvenanceReceipt(firstReceipt);
  validateRewardGuardedBuildProvenanceReceipt(secondReceipt);
  if (firstReceipt === secondReceipt) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_DISTINCT_RECEIPTS_REQUIRED");
  }
  const firstBinding = assertExecutedRewardGuardedBuildProvenanceReceipt(firstReceipt);
  const secondBinding = assertExecutedRewardGuardedBuildProvenanceReceipt(secondReceipt);
  if (firstBinding.executionOrdinal === secondBinding.executionOrdinal) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_INDEPENDENT_EXECUTIONS_REQUIRED");
  }
  if (firstBinding.sourceRootDirectory !== secondBinding.sourceRootDirectory) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_SOURCE_ROOT_MISMATCH");
  }
  if (firstReceipt.schema !== REWARD_GUARDED_BUILD_PROVENANCE_SCHEMA
    || secondReceipt.schema !== REWARD_GUARDED_BUILD_PROVENANCE_SCHEMA) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_PROVENANCE_SCHEMA_MISMATCH");
  }
  const currentSource = assertRewardGuardedRepositorySourceInventory({
    rootDirectory: firstBinding.sourceRootDirectory,
  });
  if (currentSource.sourceSetSha256 !== firstReceipt.recipe.sourceSetSha256
    || currentSource.sourceSetSha256 !== secondReceipt.recipe.sourceSetSha256
    || currentSource.guardedSurfaceSha256 !== firstReceipt.recipe.guardedSurfaceSha256
    || currentSource.guardedSurfaceSha256 !== secondReceipt.recipe.guardedSurfaceSha256) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_CURRENT_SOURCE_DRIFT_HOLD");
  }
  if (firstReceipt.recipe.executableSha256 !== secondReceipt.recipe.executableSha256
    || firstReceipt.recipe.nodeVersion !== secondReceipt.recipe.nodeVersion
    || firstReceipt.recipe.platform !== secondReceipt.recipe.platform
    || firstReceipt.recipe.architecture !== secondReceipt.recipe.architecture) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_TOOLCHAIN_MISMATCH");
  }
  if (firstReceipt.recipe.configurationLedgerSha256
    !== secondReceipt.recipe.configurationLedgerSha256) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_CONFIGURATION_MISMATCH");
  }
  if (firstReceipt.recipe.recipeSha256 !== secondReceipt.recipe.recipeSha256) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_RECIPE_MISMATCH");
  }
  const currentConfiguration = readCurrentConfigurationLedger(
    firstBinding.sourceRootDirectory,
    firstReceipt.recipe.configurationLedger,
  );
  if (canonicalJson(currentConfiguration)
    !== canonicalJson(firstReceipt.recipe.configurationLedger)) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_CURRENT_CONFIGURATION_DRIFT_HOLD");
  }
  validateRewardGuardedBuildToolchainObservation({
    recipe: firstReceipt.recipe,
    observation: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      executableSha256: sha256(readFileSync(firstReceipt.recipe.executablePath)),
    },
  });
  if (firstReceipt.artifactForbiddenMarkerSetSha256
    !== secondReceipt.artifactForbiddenMarkerSetSha256) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_MARKER_SET_MISMATCH");
  }
  if (firstReceipt.artifactFileCount !== secondReceipt.artifactFileCount
    || firstReceipt.artifactByteCount !== secondReceipt.artifactByteCount) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_ARTIFACT_CARDINALITY_MISMATCH");
  }
  if (firstReceipt.artifactSetSha256 !== secondReceipt.artifactSetSha256) {
    throw new Error("REWARD_GUARDED_REPRODUCIBILITY_ARTIFACT_DIGEST_MISMATCH");
  }

  const core = {
    schema: REWARD_GUARDED_BUILD_REPRODUCIBILITY_SCHEMA,
    status: REWARD_GUARDED_BUILD_REPRODUCIBILITY_STATUS,
    firstReceiptSha256: firstReceipt.receiptSha256,
    secondReceiptSha256: secondReceipt.receiptSha256,
    recipeSha256: firstReceipt.recipe.recipeSha256,
    sourceSetSha256: currentSource.sourceSetSha256,
    guardedSurfaceSha256: currentSource.guardedSurfaceSha256,
    configurationLedgerSha256: firstReceipt.recipe.configurationLedgerSha256,
    executableSha256: firstReceipt.recipe.executableSha256,
    nodeVersion: firstReceipt.recipe.nodeVersion,
    platform: firstReceipt.recipe.platform,
    architecture: firstReceipt.recipe.architecture,
    artifactSetSha256: firstReceipt.artifactSetSha256,
    artifactForbiddenMarkerSetSha256: firstReceipt.artifactForbiddenMarkerSetSha256,
    artifactFileCount: firstReceipt.artifactFileCount,
    artifactByteCount: firstReceipt.artifactByteCount,
    independentFreshBuildExecutionsVerified: true,
    sameCurrentSourceRevalidated: true,
    sameCurrentConfigurationRevalidated: true,
    sameCurrentToolchainRevalidated: true,
    identicalRecipeBindingVerified: true,
    identicalConfigurationBindingVerified: true,
    identicalToolchainBindingVerified: true,
    identicalArtifactByteInventoryVerified: true,
    identicalForbiddenMarkerSetVerified: true,
    dualFreshBuildArtifactEqualityVerified: true,
    semanticBuildProvenanceVerified: false,
    artifactBuiltFromBoundSourceVerified: false,
    reproducibleBuildVerified: false,
    runtimeConfinementVerified: false,
    providerAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    materializedProjectionStateVerified: false,
    externalSideEffectsAuthorized: false,
    sourceBoundAutomatedDirectEvidenceVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_GUARDED_BUILD_REPRODUCIBILITY_MAINNET_STATUS,
  };
  const comparison = freezeResult({
    ...core,
    comparisonSha256: digestRecord(core),
  });
  validateRewardGuardedBuildReproducibilityReceipt(comparison);
  return comparison;
}
