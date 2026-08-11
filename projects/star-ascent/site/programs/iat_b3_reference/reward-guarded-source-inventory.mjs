import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

export const REWARD_GUARDED_SOURCE_INVENTORY_SCHEMA =
  "iat-b3-reward-guarded-source-inventory/v1";
export const REWARD_GUARDED_SOURCE_INVENTORY_STATUS =
  "HOST_ONLY_NON_ACTIVATING_EXACT_SOURCE_ADAPTER_INVENTORY";
export const REWARD_GUARDED_SOURCE_INVENTORY_MAINNET_STATUS = "HOLD";

const AUDITOR_PATHS = new Set([
  "programs/iat_b3_reference/reward-guarded-artifact-inventory.mjs",
  "programs/iat_b3_reference/reward-guarded-build-provenance.mjs",
  "programs/iat_b3_reference/reward-guarded-build-reproducibility.mjs",
  "programs/iat_b3_reference/reward-guarded-source-inventory.mjs",
]);
const ENUMERATED_SOURCE_INVENTORIES = new WeakSet();
const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".wrangler",
  "archive",
  "build",
  "dist",
  "docs",
  "node_modules",
  "playwright-report",
  "target",
  "test-results",
  "tests",
  "vendor",
]);
const SOURCE_EXTENSIONS = new Set([
  ".bash",
  ".bat",
  ".cjs",
  ".cmd",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ps1",
  ".py",
  ".rs",
  ".sh",
  ".ts",
  ".tsx",
]);

// These hashes deliberately bind the source inventory to the exact guarded
// adapter implementations it audited. Updating one requires an explicit
// inventory update and review; this module does not independently review or
// authorize such an update.
const CRITICAL_SOURCE_SHA256 = Object.freeze({
  "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs":
    "7c2ceb08211046cce38b119074157bf0b41bc0667ed2502bade9516654d98673",
  "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs":
    "8252dca2ba8ffd324fc283b6f41c8d1c8634df54f3a1708bdad5f72644151c67",
  "programs/iat_b3_reference/reward-consumer-gate.mjs":
    "7139c8d2a57d630ca59306730f16a5d6f979a06280422b69eee4978310918b4f",
  "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs":
    "e935fafcfd947822f9a75f54a08369d4c8b7336a11e6ba37e8a3904a4c1fc23f",
  "programs/iat_b3_reference/reward-persistence-cas.mjs":
    "5f1fe96e878a25029836697c7ae78264b9f7239ae154c695040710b191011099",
  "programs/iat_b3_reference/reward-persistence-checkpoint.mjs":
    "38c652179120d2d5e1bf084d8f2ae0fb169fec4b800359503270e0925e0380c4",
});

// Raw substring counts are intentional. Imports renamed with `as`, computed
// adapter-symbol access, comments that attempt to waive the gate, and direct
// table-name use all require an explicit inventory update instead of silently
// escaping a syntax-only call scanner.
const EXPECTED_MARKER_LOCATIONS = Object.freeze({
  REWARD_CAS_STORE_ADAPTER: Object.freeze({
    "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs": 3,
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 2,
    "programs/iat_b3_reference/reward-persistence-cas.mjs": 5,
  }),
  assertRewardConsumerPermit: Object.freeze({
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 2,
    "programs/iat_b3_reference/reward-consumer-gate.mjs": 1,
  }),
  consumePermit: Object.freeze({
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 1,
  }),
  createCheckpointGatedRewardPersistenceCas: Object.freeze({
    "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs": 1,
  }),
  createInMemoryRewardPersistenceCas: Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas.mjs": 1,
  }),
  createSqliteRewardConsumerCursor: Object.freeze({
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 1,
  }),
  createSqliteRewardPersistenceCas: Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 1,
  }),
  finalizeRewardCapacityRoundCas: Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas.mjs": 1,
  }),
  prepareRewardConsumerPermit: Object.freeze({
    "programs/iat_b3_reference/reward-consumer-gate.mjs": 1,
  }),
  recordPremiumUpgradeCas: Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas.mjs": 1,
  }),
  "reward-checkpoint-gated-cas.mjs": Object.freeze({}),
  "reward-consumer-cursor-sqlite.mjs": Object.freeze({}),
  "reward-consumer-gate.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 1,
  }),
  "reward-persistence-cas-sqlite.mjs": Object.freeze({}),
  "reward-persistence-cas.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs": 1,
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 1,
    "programs/iat_b3_reference/reward-consumer-gate.mjs": 1,
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 1,
    "programs/iat_b3_reference/reward-persistence-checkpoint.mjs": 1,
  }),
  "reward-persistence-checkpoint.mjs": Object.freeze({
    "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs": 1,
    "programs/iat_b3_reference/reward-consumer-gate.mjs": 1,
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 1,
    "scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs": 1,
    "scripts/validate-iat-b3-x-social-evidence-provider-readiness.mjs": 1,
  }),
  reward_cas_: Object.freeze({
    "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs": 55,
  }),
  reward_consumer_cursor_history: Object.freeze({
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 5,
  }),
  reward_consumer_projection_events: Object.freeze({
    "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs": 4,
  }),
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hasExactDataKeys(value, expected) {
  if (!value
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) return false;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !("value" in descriptor)
      || "get" in descriptor
      || "set" in descriptor) return false;
  }
  return keys.length === expected.length
    && [...keys].sort().every((key, index) => key === [...expected].sort()[index]);
}

function asCanonicalSourcePath(value) {
  if (typeof value !== "string"
    || value.length === 0
    || value.includes("\\")
    || value.startsWith("/")
    || value.endsWith("/")
    || value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new TypeError("reward guarded source path must be canonical repository-relative POSIX");
  }
  return value;
}

function asSourceFile(value) {
  if (!hasExactDataKeys(value, ["path", "source"])) {
    throw new TypeError("reward guarded source descriptor must contain only path and source");
  }
  const path = asCanonicalSourcePath(value.path);
  if (typeof value.source !== "string") {
    throw new TypeError("reward guarded source content must be text");
  }
  return Object.freeze({ path, source: value.source });
}

function countOccurrences(source, marker) {
  let count = 0;
  let cursor = 0;
  while (cursor <= source.length - marker.length) {
    const next = source.indexOf(marker, cursor);
    if (next === -1) break;
    count += 1;
    cursor = next + marker.length;
  }
  return count;
}

function canonicalLocationRecord(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => (
    left.localeCompare(right, "en")
  )));
}

function sameLocationRecord(left, right) {
  return JSON.stringify(canonicalLocationRecord(left))
    === JSON.stringify(canonicalLocationRecord(right));
}

function freezeResult(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) freezeResult(child);
  }
  return Object.freeze(value);
}

/**
 * Audit a supplied source set. This lower-level function is useful for hostile
 * regression fixtures, but cannot prove that its caller supplied the complete
 * repository. Use assertRewardGuardedRepositorySourceInventory for the
 * enumerated repository gate.
 */
export function auditRewardGuardedSourceFiles(sourceFiles, {
  filesystemEnumerationVerified = false,
} = {}) {
  if (!Array.isArray(sourceFiles)) {
    throw new TypeError("reward guarded source inventory requires an array");
  }
  const files = sourceFiles.map(asSourceFile).sort((left, right) => (
    left.path.localeCompare(right.path, "en")
  ));
  const byPath = new Map();
  for (const file of files) {
    if (AUDITOR_PATHS.has(file.path)) {
      throw new Error("REWARD_GUARDED_SOURCE_AUDITOR_MUST_BE_EXCLUDED");
    }
    if (byPath.has(file.path)) throw new Error("REWARD_GUARDED_SOURCE_DUPLICATE_PATH");
    byPath.set(file.path, file.source);
  }

  const criticalSources = Object.entries(CRITICAL_SOURCE_SHA256).map(([path, expectedSha256]) => {
    const source = byPath.get(path);
    if (source === undefined) {
      throw new Error(`REWARD_GUARDED_SOURCE_CRITICAL_PATH_MISSING:${path}`);
    }
    const actualSha256 = sha256(source);
    if (actualSha256 !== expectedSha256) {
      throw new Error(`REWARD_GUARDED_SOURCE_CRITICAL_DIGEST_MISMATCH:${path}`);
    }
    return Object.freeze({ path, sourceSha256: actualSha256 });
  });

  const markerInventory = Object.entries(EXPECTED_MARKER_LOCATIONS)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([marker, expected]) => {
      const actual = {};
      for (const file of files) {
        const count = countOccurrences(file.source, marker);
        if (count > 0) actual[file.path] = count;
      }
      if (!sameLocationRecord(actual, expected)) {
        throw new Error(`REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH:${marker}`);
      }
      return Object.freeze({ markerSha256: sha256(marker), locations: canonicalLocationRecord(actual) });
    });

  const sourceSetSha256 = sha256(files.map((file) => (
    `${file.path}\0${sha256(file.source)}`
  )).join("\n"));
  const guardedSurfaceSha256 = sha256(JSON.stringify({
    criticalSources,
    markerInventory,
  }));
  return freezeResult({
    schema: REWARD_GUARDED_SOURCE_INVENTORY_SCHEMA,
    status: REWARD_GUARDED_SOURCE_INVENTORY_STATUS,
    scannedSourceFileCount: files.length,
    sourceSetSha256,
    guardedSurfaceSha256,
    criticalSources,
    markerInventory,
    filesystemEnumerationVerified,
    exactGuardedAdapterSourceDigestsVerified: true,
    unlistedSensitiveSourceMarkerRejected: true,
    deployableRewardConsumerPathsInventoried: true,
    runtimeDirectStoreBypassPreventionVerified: false,
    providerAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    materializedProjectionStateVerified: false,
    externalSideEffectsAuthorized: false,
    builtArtifactParityVerified: false,
    independentReviewAccepted: false,
    activationReady: false,
    mainnetStatus: REWARD_GUARDED_SOURCE_INVENTORY_MAINNET_STATUS,
  });
}

export function collectRewardProductionSourceFiles(rootDirectory) {
  if (typeof rootDirectory !== "string" || rootDirectory.length === 0) {
    throw new TypeError("reward guarded source rootDirectory must be non-empty text");
  }
  const root = resolve(rootDirectory);
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("REWARD_GUARDED_SOURCE_ROOT_DIRECTORY_REQUIRED");
  }
  const files = [];
  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (EXCLUDED_DIRECTORY_NAMES.has(entry.name)) continue;
      const absolutePath = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("REWARD_GUARDED_SOURCE_SYMLINK_HOLD");
      }
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      const path = relative(root, absolutePath).replaceAll("\\", "/");
      if (AUDITOR_PATHS.has(path)) continue;
      files.push(Object.freeze({ path, source: readFileSync(absolutePath, "utf8") }));
    }
  };
  walk(root);
  return Object.freeze(files.sort((left, right) => left.path.localeCompare(right.path, "en")));
}

export function assertRewardGuardedRepositorySourceInventory({ rootDirectory } = {}) {
  const result = auditRewardGuardedSourceFiles(
    collectRewardProductionSourceFiles(rootDirectory),
    { filesystemEnumerationVerified: true },
  );
  ENUMERATED_SOURCE_INVENTORIES.add(result);
  return result;
}

export function assertEnumeratedRewardGuardedSourceInventory(value) {
  if (!ENUMERATED_SOURCE_INVENTORIES.has(value)) {
    throw new Error("REWARD_GUARDED_SOURCE_ENUMERATED_INVENTORY_REQUIRED");
  }
  return value;
}
