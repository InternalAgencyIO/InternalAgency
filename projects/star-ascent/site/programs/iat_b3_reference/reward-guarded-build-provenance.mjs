import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

import {
  REWARD_GUARDED_ARTIFACT_INVENTORY_SCHEMA,
  assertEnumeratedRewardGuardedArtifactInventory,
  assertRewardGuardedArtifactInventory,
} from "./reward-guarded-artifact-inventory.mjs";
import {
  REWARD_GUARDED_SOURCE_INVENTORY_SCHEMA,
  assertRewardGuardedRepositorySourceInventory,
} from "./reward-guarded-source-inventory.mjs";

export const REWARD_GUARDED_BUILD_RECIPE_SCHEMA =
  "iat-b3-reward-guarded-build-recipe/v1";
export const REWARD_GUARDED_BUILD_PROVENANCE_SCHEMA =
  "iat-b3-reward-guarded-build-provenance/v1";
export const REWARD_GUARDED_BUILD_PROVENANCE_STATUS =
  "HOST_ONLY_NON_ACTIVATING_PROCESS_OBSERVED_FRESH_BUILD_RECEIPT";
export const REWARD_GUARDED_BUILD_PROVENANCE_MAINNET_STATUS = "HOLD";

const BUILD_RECIPES = new WeakMap();
const EXECUTED_BUILD_RECEIPTS = new WeakMap();
let nextExecutionOrdinal = 1n;
const ENVIRONMENT_KEY = /^[A-Z_][A-Z0-9_]{0,127}$/u;
const SECRET_ENVIRONMENT_KEY =
  /(?:AUTH|COOKIE|CREDENTIAL|KEY|PASS|PASSWORD|PRIVATE|SECRET|TOKEN)/u;
const HEX_32 = /^[0-9a-f]{64}$/u;
const RECIPE_KEYS = Object.freeze([
  "schema",
  "status",
  "sourceInventorySchema",
  "sourceSetSha256",
  "guardedSurfaceSha256",
  "scannedSourceFileCount",
  "executablePath",
  "executableSha256",
  "arguments",
  "workingDirectoryRelative",
  "environment",
  "configurationLedger",
  "configurationLedgerSha256",
  "nodeVersion",
  "platform",
  "architecture",
  "timeoutMs",
  "freshArtifactDirectoryRequired",
  "runtimeConfinementVerified",
  "activationReady",
  "mainnetStatus",
  "recipeSha256",
]);
const RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "recipe",
  "artifactInventorySchema",
  "artifactSetSha256",
  "artifactFileCount",
  "artifactByteCount",
  "artifactForbiddenMarkerSetSha256",
  "exitCode",
  "stdoutByteLength",
  "stdoutSha256",
  "stderrByteLength",
  "stderrSha256",
  "freshArtifactDirectoryAbsenceVerified",
  "observedBuildCommandExecuted",
  "sourceStableAcrossBuildVerified",
  "configurationStableAcrossBuildVerified",
  "freshArtifactInventoryVerified",
  "processObservedSourceToArtifactBindingVerified",
  "artifactBuiltFromBoundSourceVerified",
  "reproducibleBuildVerified",
  "runtimeConfinementVerified",
  "providerAuthenticationVerified",
  "rollbackProtectionVerified",
  "materializedProjectionStateVerified",
  "externalSideEffectsAuthorized",
  "independentReviewAccepted",
  "activationReady",
  "mainnetStatus",
  "receiptSha256",
]);
const TOOLCHAIN_OBSERVATION_KEYS = Object.freeze([
  "nodeVersion",
  "platform",
  "architecture",
  "executableSha256",
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

function freezeResult(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) freezeResult(child);
  }
  return Object.freeze(value);
}

function asHex32(value, label) {
  if (typeof value !== "string" || !HEX_32.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase SHA-256`);
  }
  return value;
}

function asCanonicalRelativePath(value, { allowDot = false } = {}) {
  if (allowDot && value === ".") return value;
  if (typeof value !== "string"
    || value.length === 0
    || value.includes("\\")
    || value.startsWith("/")
    || value.endsWith("/")
    || value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new TypeError("build provenance paths must be canonical relative POSIX");
  }
  return value;
}

function resolveContained(root, relativePath) {
  const absolutePath = resolve(root, relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
    throw new Error("REWARD_GUARDED_BUILD_PATH_ESCAPES_SOURCE_ROOT");
  }
  return absolutePath;
}

function normalizeArguments(value) {
  if (!Array.isArray(value) || value.length > 64) {
    throw new TypeError("build arguments must be an array of at most 64 entries");
  }
  return Object.freeze(value.map((entry) => {
    if (typeof entry !== "string" || entry.length > 16_384 || entry.includes("\0")) {
      throw new TypeError("build arguments must be bounded NUL-free strings");
    }
    return entry;
  }));
}

function normalizeEnvironment(value) {
  if (!value
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("build environment must be a plain object");
  }
  const entries = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new TypeError("build environment symbols are forbidden");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || "get" in descriptor || "set" in descriptor) {
      throw new TypeError("build environment accessors are forbidden");
    }
    if (!ENVIRONMENT_KEY.test(key) || SECRET_ENVIRONMENT_KEY.test(key)) {
      throw new Error(`REWARD_GUARDED_BUILD_ENVIRONMENT_KEY_FORBIDDEN:${key}`);
    }
    if (typeof descriptor.value !== "string"
      || descriptor.value.length > 4096
      || descriptor.value.includes("\0")) {
      throw new TypeError("build environment values must be bounded NUL-free strings");
    }
    entries.push(Object.freeze({ key, value: descriptor.value }));
  }
  return Object.freeze(entries.sort((left, right) => left.key.localeCompare(right.key, "en")));
}

function readConfigurationLedger(root, configurationPaths) {
  if (!Array.isArray(configurationPaths) || configurationPaths.length === 0) {
    throw new Error("REWARD_GUARDED_BUILD_CONFIGURATION_PATHS_REQUIRED");
  }
  const paths = configurationPaths.map((path) => asCanonicalRelativePath(path));
  if (new Set(paths).size !== paths.length) {
    throw new Error("REWARD_GUARDED_BUILD_CONFIGURATION_PATH_DUPLICATE");
  }
  paths.sort((left, right) => left.localeCompare(right, "en"));
  return Object.freeze(paths.map((path) => {
    const absolutePath = resolveContained(root, path);
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`REWARD_GUARDED_BUILD_CONFIGURATION_FILE_REQUIRED:${path}`);
    }
    const bytes = readFileSync(absolutePath);
    return Object.freeze({ path, byteLength: bytes.length, sha256: sha256(bytes) });
  }));
}

function assertSameLedger(actual, expected, errorCode) {
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(errorCode);
}

export function validateRewardGuardedBuildRecipe(recipe) {
  if (!hasExactDataKeys(recipe, RECIPE_KEYS)
    || recipe.schema !== REWARD_GUARDED_BUILD_RECIPE_SCHEMA
    || recipe.status !== REWARD_GUARDED_BUILD_PROVENANCE_STATUS
    || recipe.sourceInventorySchema !== REWARD_GUARDED_SOURCE_INVENTORY_SCHEMA
    || !Array.isArray(recipe.arguments)
    || !Array.isArray(recipe.environment)
    || !Array.isArray(recipe.configurationLedger)
    || recipe.freshArtifactDirectoryRequired !== true
    || recipe.runtimeConfinementVerified !== false
    || recipe.activationReady !== false
    || recipe.mainnetStatus !== REWARD_GUARDED_BUILD_PROVENANCE_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_GUARDED_BUILD_RECIPE");
  }
  for (const [value, label] of [
    [recipe.sourceSetSha256, "recipe source-set digest"],
    [recipe.guardedSurfaceSha256, "recipe guarded-surface digest"],
    [recipe.executableSha256, "recipe executable digest"],
    [recipe.configurationLedgerSha256, "recipe configuration-ledger digest"],
    [recipe.recipeSha256, "recipe digest"],
  ]) asHex32(value, label);
  if (!Number.isSafeInteger(recipe.scannedSourceFileCount) || recipe.scannedSourceFileCount <= 0
    || !Number.isSafeInteger(recipe.timeoutMs) || recipe.timeoutMs < 1 || recipe.timeoutMs > 600_000
    || typeof recipe.executablePath !== "string" || !isAbsolute(recipe.executablePath)
    || typeof recipe.workingDirectoryRelative !== "string"
    || typeof recipe.nodeVersion !== "string"
    || typeof recipe.platform !== "string"
    || typeof recipe.architecture !== "string") {
    throw new Error("INVALID_REWARD_GUARDED_BUILD_RECIPE");
  }
  normalizeArguments(recipe.arguments);
  asCanonicalRelativePath(recipe.workingDirectoryRelative, { allowDot: true });
  const environmentKeys = [];
  for (const entry of recipe.environment) {
    if (!hasExactDataKeys(entry, ["key", "value"])
      || !ENVIRONMENT_KEY.test(entry.key)
      || SECRET_ENVIRONMENT_KEY.test(entry.key)
      || typeof entry.value !== "string"
      || entry.value.length > 4096
      || entry.value.includes("\0")) {
      throw new Error("INVALID_REWARD_GUARDED_BUILD_RECIPE_ENVIRONMENT");
    }
    environmentKeys.push(entry.key);
  }
  if (new Set(environmentKeys).size !== environmentKeys.length
    || canonicalJson(environmentKeys) !== canonicalJson(
      [...environmentKeys].sort((left, right) => left.localeCompare(right, "en")),
    )) {
    throw new Error("INVALID_REWARD_GUARDED_BUILD_RECIPE_ENVIRONMENT_ORDER");
  }
  const configurationPaths = [];
  for (const entry of recipe.configurationLedger) {
    if (!hasExactDataKeys(entry, ["byteLength", "path", "sha256"])
      || !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0) {
      throw new Error("INVALID_REWARD_GUARDED_BUILD_RECIPE_CONFIGURATION");
    }
    asCanonicalRelativePath(entry.path);
    asHex32(entry.sha256, "recipe configuration digest");
    configurationPaths.push(entry.path);
  }
  if (configurationPaths.length === 0
    || new Set(configurationPaths).size !== configurationPaths.length
    || canonicalJson(configurationPaths) !== canonicalJson(
      [...configurationPaths].sort((left, right) => left.localeCompare(right, "en")),
    )) {
    throw new Error("INVALID_REWARD_GUARDED_BUILD_RECIPE_CONFIGURATION_ORDER");
  }
  if (recipe.configurationLedgerSha256 !== digestRecord(recipe.configurationLedger)) {
    throw new Error("REWARD_GUARDED_BUILD_CONFIGURATION_LEDGER_DIGEST_MISMATCH");
  }
  const { recipeSha256, ...core } = recipe;
  if (recipeSha256 !== digestRecord(core)) {
    throw new Error("REWARD_GUARDED_BUILD_RECIPE_DIGEST_MISMATCH");
  }
  return recipe;
}

export function createRewardGuardedBuildRecipe({
  sourceRootDirectory,
  executablePath,
  arguments: commandArguments = [],
  workingDirectoryRelative = ".",
  environment = {},
  configurationPaths,
  timeoutMs = 300_000,
} = {}) {
  if (typeof sourceRootDirectory !== "string" || sourceRootDirectory.length === 0) {
    throw new TypeError("build provenance sourceRootDirectory must be non-empty text");
  }
  const sourceRoot = resolve(sourceRootDirectory);
  const sourceInventory = assertRewardGuardedRepositorySourceInventory({ rootDirectory: sourceRoot });
  if (typeof executablePath !== "string" || !isAbsolute(executablePath)) {
    throw new TypeError("build provenance executablePath must be absolute");
  }
  const executableStat = lstatSync(executablePath);
  if (!executableStat.isFile() || executableStat.isSymbolicLink()) {
    throw new Error("REWARD_GUARDED_BUILD_EXECUTABLE_FILE_REQUIRED");
  }
  const workingRelative = asCanonicalRelativePath(workingDirectoryRelative, { allowDot: true });
  const workingDirectory = resolveContained(sourceRoot, workingRelative);
  const workingStat = lstatSync(workingDirectory);
  if (!workingStat.isDirectory() || workingStat.isSymbolicLink()) {
    throw new Error("REWARD_GUARDED_BUILD_WORKING_DIRECTORY_REQUIRED");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) {
    throw new RangeError("build provenance timeoutMs must be from 1 through 600000");
  }
  const configurationLedger = readConfigurationLedger(sourceRoot, configurationPaths);
  const core = {
    schema: REWARD_GUARDED_BUILD_RECIPE_SCHEMA,
    status: REWARD_GUARDED_BUILD_PROVENANCE_STATUS,
    sourceInventorySchema: sourceInventory.schema,
    sourceSetSha256: sourceInventory.sourceSetSha256,
    guardedSurfaceSha256: sourceInventory.guardedSurfaceSha256,
    scannedSourceFileCount: sourceInventory.scannedSourceFileCount,
    executablePath: resolve(executablePath),
    executableSha256: sha256(readFileSync(executablePath)),
    arguments: normalizeArguments(commandArguments),
    workingDirectoryRelative: workingRelative,
    environment: normalizeEnvironment(environment),
    configurationLedger,
    configurationLedgerSha256: digestRecord(configurationLedger),
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    timeoutMs,
    freshArtifactDirectoryRequired: true,
    runtimeConfinementVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_GUARDED_BUILD_PROVENANCE_MAINNET_STATUS,
  };
  const recipe = freezeResult({ ...core, recipeSha256: digestRecord(core) });
  validateRewardGuardedBuildRecipe(recipe);
  BUILD_RECIPES.set(recipe, Object.freeze({ sourceRoot, workingDirectory }));
  return recipe;
}

export function validateRewardGuardedBuildToolchainObservation({
  recipe,
  observation,
} = {}) {
  validateRewardGuardedBuildRecipe(recipe);
  if (!hasExactDataKeys(observation, TOOLCHAIN_OBSERVATION_KEYS)) {
    throw new Error("INVALID_REWARD_GUARDED_BUILD_TOOLCHAIN_OBSERVATION");
  }
  asHex32(observation.executableSha256, "observed executable digest");
  if (observation.nodeVersion !== recipe.nodeVersion
    || observation.platform !== recipe.platform
    || observation.architecture !== recipe.architecture
    || observation.executableSha256 !== recipe.executableSha256) {
    throw new Error("REWARD_GUARDED_BUILD_TOOLCHAIN_DRIFT_HOLD");
  }
  return observation;
}

function validateSourceAgainstRecipe(sourceInventory, recipe, errorCode) {
  if (sourceInventory.schema !== recipe.sourceInventorySchema
    || sourceInventory.sourceSetSha256 !== recipe.sourceSetSha256
    || sourceInventory.guardedSurfaceSha256 !== recipe.guardedSurfaceSha256
    || sourceInventory.scannedSourceFileCount !== recipe.scannedSourceFileCount) {
    throw new Error(errorCode);
  }
}

export function validateRewardGuardedBuildProvenanceReceipt(receipt) {
  if (!hasExactDataKeys(receipt, RECEIPT_KEYS)
    || receipt.schema !== REWARD_GUARDED_BUILD_PROVENANCE_SCHEMA
    || receipt.status !== REWARD_GUARDED_BUILD_PROVENANCE_STATUS
    || receipt.artifactInventorySchema !== REWARD_GUARDED_ARTIFACT_INVENTORY_SCHEMA
    || receipt.exitCode !== 0
    || receipt.freshArtifactDirectoryAbsenceVerified !== true
    || receipt.observedBuildCommandExecuted !== true
    || receipt.sourceStableAcrossBuildVerified !== true
    || receipt.configurationStableAcrossBuildVerified !== true
    || receipt.freshArtifactInventoryVerified !== true
    || receipt.processObservedSourceToArtifactBindingVerified !== true
    || receipt.artifactBuiltFromBoundSourceVerified !== false
    || receipt.reproducibleBuildVerified !== false
    || receipt.runtimeConfinementVerified !== false
    || receipt.providerAuthenticationVerified !== false
    || receipt.rollbackProtectionVerified !== false
    || receipt.materializedProjectionStateVerified !== false
    || receipt.externalSideEffectsAuthorized !== false
    || receipt.independentReviewAccepted !== false
    || receipt.activationReady !== false
    || receipt.mainnetStatus !== REWARD_GUARDED_BUILD_PROVENANCE_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_GUARDED_BUILD_PROVENANCE_RECEIPT");
  }
  validateRewardGuardedBuildRecipe(receipt.recipe);
  for (const [value, label] of [
    [receipt.artifactSetSha256, "receipt artifact-set digest"],
    [receipt.artifactForbiddenMarkerSetSha256, "receipt marker-set digest"],
    [receipt.stdoutSha256, "receipt stdout digest"],
    [receipt.stderrSha256, "receipt stderr digest"],
    [receipt.receiptSha256, "receipt digest"],
  ]) asHex32(value, label);
  if (!Number.isSafeInteger(receipt.artifactFileCount) || receipt.artifactFileCount <= 0
    || typeof receipt.artifactByteCount !== "bigint" || receipt.artifactByteCount < 0n
    || !Number.isSafeInteger(receipt.stdoutByteLength) || receipt.stdoutByteLength < 0
    || !Number.isSafeInteger(receipt.stderrByteLength) || receipt.stderrByteLength < 0) {
    throw new Error("INVALID_REWARD_GUARDED_BUILD_PROVENANCE_RECEIPT");
  }
  const { receiptSha256, ...core } = receipt;
  if (receiptSha256 !== digestRecord(core)) {
    throw new Error("REWARD_GUARDED_BUILD_PROVENANCE_RECEIPT_DIGEST_MISMATCH");
  }
  return receipt;
}

export function executeRewardGuardedBuildRecipe({ recipe, artifactRootDirectory } = {}) {
  validateRewardGuardedBuildRecipe(recipe);
  const context = BUILD_RECIPES.get(recipe);
  if (!context) throw new Error("REWARD_GUARDED_BUILD_PROCESS_BRANDED_RECIPE_REQUIRED");
  if (typeof artifactRootDirectory !== "string" || artifactRootDirectory.length === 0) {
    throw new TypeError("build provenance artifactRootDirectory must be non-empty text");
  }
  const artifactRoot = resolve(artifactRootDirectory);
  if (artifactRoot === context.sourceRoot) {
    throw new Error("REWARD_GUARDED_BUILD_ARTIFACT_ROOT_MUST_DIFFER_FROM_SOURCE_ROOT");
  }
  if (existsSync(artifactRoot)) {
    throw new Error("REWARD_GUARDED_BUILD_STALE_ARTIFACT_ROOT_PREEXISTS_HOLD");
  }
  validateRewardGuardedBuildToolchainObservation({
    recipe,
    observation: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      executableSha256: sha256(readFileSync(recipe.executablePath)),
    },
  });

  const sourceBefore = assertRewardGuardedRepositorySourceInventory({
    rootDirectory: context.sourceRoot,
  });
  validateSourceAgainstRecipe(
    sourceBefore,
    recipe,
    "REWARD_GUARDED_BUILD_SOURCE_DRIFT_BEFORE_EXECUTION_HOLD",
  );
  const configurationBefore = readConfigurationLedger(
    context.sourceRoot,
    recipe.configurationLedger.map(({ path }) => path),
  );
  assertSameLedger(
    configurationBefore,
    recipe.configurationLedger,
    "REWARD_GUARDED_BUILD_CONFIGURATION_DRIFT_BEFORE_EXECUTION_HOLD",
  );

  const child = spawnSync(recipe.executablePath, recipe.arguments, {
    cwd: context.workingDirectory,
    env: Object.fromEntries(recipe.environment.map(({ key, value }) => [key, value])),
    encoding: null,
    shell: false,
    windowsHide: true,
    timeout: recipe.timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (child.error) {
    throw new Error("REWARD_GUARDED_BUILD_COMMAND_EXECUTION_FAILED", { cause: child.error });
  }
  if (child.status !== 0) {
    throw new Error(`REWARD_GUARDED_BUILD_COMMAND_EXIT_${String(child.status)}`);
  }
  if (!existsSync(artifactRoot)) {
    throw new Error("REWARD_GUARDED_BUILD_FRESH_ARTIFACT_ROOT_NOT_CREATED");
  }

  const sourceAfter = assertRewardGuardedRepositorySourceInventory({
    rootDirectory: context.sourceRoot,
  });
  validateSourceAgainstRecipe(
    sourceAfter,
    recipe,
    "REWARD_GUARDED_BUILD_SOURCE_DRIFT_DURING_EXECUTION_HOLD",
  );
  const configurationAfter = readConfigurationLedger(
    context.sourceRoot,
    recipe.configurationLedger.map(({ path }) => path),
  );
  assertSameLedger(
    configurationAfter,
    recipe.configurationLedger,
    "REWARD_GUARDED_BUILD_CONFIGURATION_DRIFT_DURING_EXECUTION_HOLD",
  );

  const artifactInventory = assertRewardGuardedArtifactInventory({
    sourceRootDirectory: context.sourceRoot,
    artifactRootDirectory: artifactRoot,
  });
  assertEnumeratedRewardGuardedArtifactInventory(artifactInventory);
  if (artifactInventory.sourceSetSha256 !== recipe.sourceSetSha256
    || artifactInventory.guardedSurfaceSha256 !== recipe.guardedSurfaceSha256) {
    throw new Error("REWARD_GUARDED_BUILD_ARTIFACT_SOURCE_BINDING_MISMATCH");
  }
  const configurationFinal = readConfigurationLedger(
    context.sourceRoot,
    recipe.configurationLedger.map(({ path }) => path),
  );
  assertSameLedger(
    configurationFinal,
    recipe.configurationLedger,
    "REWARD_GUARDED_BUILD_CONFIGURATION_DRIFT_DURING_ARTIFACT_AUDIT_HOLD",
  );
  const stdout = Buffer.isBuffer(child.stdout) ? child.stdout : Buffer.alloc(0);
  const stderr = Buffer.isBuffer(child.stderr) ? child.stderr : Buffer.alloc(0);
  const core = {
    schema: REWARD_GUARDED_BUILD_PROVENANCE_SCHEMA,
    status: REWARD_GUARDED_BUILD_PROVENANCE_STATUS,
    recipe,
    artifactInventorySchema: artifactInventory.schema,
    artifactSetSha256: artifactInventory.artifactSetSha256,
    artifactFileCount: artifactInventory.artifactFileCount,
    artifactByteCount: artifactInventory.artifactByteCount,
    artifactForbiddenMarkerSetSha256: artifactInventory.forbiddenMarkerSetSha256,
    exitCode: child.status,
    stdoutByteLength: stdout.length,
    stdoutSha256: sha256(stdout),
    stderrByteLength: stderr.length,
    stderrSha256: sha256(stderr),
    freshArtifactDirectoryAbsenceVerified: true,
    observedBuildCommandExecuted: true,
    sourceStableAcrossBuildVerified: true,
    configurationStableAcrossBuildVerified: true,
    freshArtifactInventoryVerified: true,
    processObservedSourceToArtifactBindingVerified: true,
    artifactBuiltFromBoundSourceVerified: false,
    reproducibleBuildVerified: false,
    runtimeConfinementVerified: false,
    providerAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    materializedProjectionStateVerified: false,
    externalSideEffectsAuthorized: false,
    independentReviewAccepted: false,
    activationReady: false,
    mainnetStatus: REWARD_GUARDED_BUILD_PROVENANCE_MAINNET_STATUS,
  };
  const receipt = freezeResult({ ...core, receiptSha256: digestRecord(core) });
  validateRewardGuardedBuildProvenanceReceipt(receipt);
  EXECUTED_BUILD_RECEIPTS.set(receipt, Object.freeze({
    sourceRootDirectory: context.sourceRoot,
    executionOrdinal: nextExecutionOrdinal,
  }));
  nextExecutionOrdinal += 1n;
  return receipt;
}

export function assertExecutedRewardGuardedBuildProvenanceReceipt(value) {
  validateRewardGuardedBuildProvenanceReceipt(value);
  const binding = EXECUTED_BUILD_RECEIPTS.get(value);
  if (!binding) {
    throw new Error("REWARD_GUARDED_BUILD_EXECUTED_RECEIPT_REQUIRED");
  }
  return binding;
}
