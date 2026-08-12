import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
  REWARD_GUARDED_SOURCE_INVENTORY_SCHEMA,
  assertEnumeratedRewardGuardedSourceInventory,
  assertRewardGuardedRepositorySourceInventory,
} from "./reward-guarded-source-inventory.mjs";

export const REWARD_GUARDED_ARTIFACT_INVENTORY_SCHEMA =
  "iat-b3-reward-guarded-artifact-inventory/v1";
export const REWARD_GUARDED_ARTIFACT_INVENTORY_STATUS =
  "HOST_ONLY_NON_ACTIVATING_EXACT_ARTIFACT_NEGATIVE_INVENTORY";
export const REWARD_GUARDED_ARTIFACT_INVENTORY_MAINNET_STATUS = "HOLD";
const ENUMERATED_ARTIFACT_INVENTORIES = new WeakSet();

const FORBIDDEN_ARTIFACT_MARKERS = Object.freeze([
  "HOST_ONLY_NON_ACTIVATING_DURABLE_LOCAL_PROJECTION_CURSOR",
  "HOST_ONLY_NON_ACTIVATING_EXACT_CHECKPOINT_WRITE_GATE",
  "HOST_ONLY_NONACTIVATING_REPLAY_AUDIT",
  "IAT_B3_REWARD_CAS_STORE_ADAPTER_V1",
  "REWARD_CAS_STORE_ADAPTER",
  "REWARD_CHECKPOINT_GATED_CAS_SCHEMA",
  "REWARD_CONSUMER_CURSOR_SCHEMA",
  "REWARD_CONSUMER_GATE_SCHEMA",
  "REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS",
  "appendFinalizedRound",
  "assertRewardConsumerPermit",
  "consumePermit",
  "createCheckpointGatedRewardPersistenceCas",
  "createInMemoryRewardPersistenceCas",
  "createRewardWaterfallAuditSqlite",
  "createSqliteRewardConsumerCursor",
  "createSqliteRewardPersistenceCas",
  "finalizeRewardCapacityRoundCas",
  "iat-b3-reward-cas-commit/v1",
  "iat-b3-reward-cas-entity/v1",
  "iat-b3-reward-cas-head/v1",
  "iat-b3-reward-cas-sqlite-adapter/v1",
  "iat-b3-reward-checkpoint-gated-cas/v1",
  "iat-b3-reward-consumer-cursor-sqlite-adapter/v1",
  "iat-b3-reward-consumer-cursor/v1",
  "iat-b3-reward-consumer-gate/v1",
  "iat-b3-reward-consumer-local-projection-commitment/v1",
  "iat-b3-reward-consumer-local-projection-event/v1",
  "iat-b3-reward-waterfall-audit-sqlite/v1",
  "prepareRewardConsumerPermit",
  "recordPremiumUpgradeCas",
  "reward-checkpoint-gated-cas.mjs",
  "reward-consumer-cursor-sqlite.mjs",
  "reward-consumer-gate.mjs",
  "reward-guarded-source-inventory.mjs",
  "reward-persistence-cas-sqlite.mjs",
  "reward-persistence-cas.mjs",
  "reward-waterfall-audit-sqlite.mjs",
  "reward_cas_",
  "reward_consumer_cursor_history",
  "reward_consumer_projection_events",
  "reward_waterfall_audit_",
]);
const FORBIDDEN_ARTIFACT_MARKER_BYTES = Object.freeze(
  FORBIDDEN_ARTIFACT_MARKERS.map((marker) => Buffer.from(marker, "utf8")),
);

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
  const expectedSorted = [...expected].sort();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !("value" in descriptor)
      || "get" in descriptor
      || "set" in descriptor) return false;
  }
  return keys.length === expectedSorted.length
    && [...keys].sort().every((key, index) => key === expectedSorted[index]);
}

function asCanonicalArtifactPath(value) {
  if (typeof value !== "string"
    || value.length === 0
    || value.includes("\\")
    || value.startsWith("/")
    || value.endsWith("/")
    || value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new TypeError("reward guarded artifact path must be canonical relative POSIX");
  }
  return value;
}

function asArtifactBytes(value) {
  if (!Buffer.isBuffer(value)) {
    throw new TypeError("reward guarded artifact bytes must be a Buffer");
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key)) {
      throw new TypeError("reward guarded artifact Buffer must not have decorated properties");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || "get" in descriptor || "set" in descriptor) {
      throw new TypeError("reward guarded artifact Buffer accessors are forbidden");
    }
  }
  return Buffer.from(value);
}

function asArtifactFile(value) {
  if (!hasExactDataKeys(value, ["bytes", "path"])) {
    throw new TypeError("reward guarded artifact descriptor must contain only path and bytes");
  }
  return Object.freeze({
    path: asCanonicalArtifactPath(value.path),
    bytes: asArtifactBytes(value.bytes),
  });
}

function findForbiddenMarker(bytes) {
  const index = FORBIDDEN_ARTIFACT_MARKER_BYTES.findIndex((marker) => bytes.indexOf(marker) !== -1);
  return index === -1 ? null : FORBIDDEN_ARTIFACT_MARKERS[index];
}

function freezeResult(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) freezeResult(child);
  }
  return Object.freeze(value);
}

export function auditRewardGuardedArtifactFiles({
  artifactFiles,
  sourceInventory,
  filesystemEnumerationVerified = false,
} = {}) {
  const enumeratedSource = assertEnumeratedRewardGuardedSourceInventory(sourceInventory);
  if (enumeratedSource.schema !== REWARD_GUARDED_SOURCE_INVENTORY_SCHEMA
    || enumeratedSource.filesystemEnumerationVerified !== true
    || enumeratedSource.mainnetStatus !== "HOLD") {
    throw new Error("REWARD_GUARDED_ARTIFACT_SOURCE_INVENTORY_MISMATCH");
  }
  if (!Array.isArray(artifactFiles) || artifactFiles.length === 0) {
    throw new Error("REWARD_GUARDED_ARTIFACT_NONEMPTY_FILE_SET_REQUIRED");
  }
  const files = artifactFiles.map(asArtifactFile).sort((left, right) => (
    left.path.localeCompare(right.path, "en")
  ));
  const seenPaths = new Set();
  const fileLedger = [];
  let artifactByteCount = 0n;
  for (const file of files) {
    if (seenPaths.has(file.path)) throw new Error("REWARD_GUARDED_ARTIFACT_DUPLICATE_PATH");
    seenPaths.add(file.path);
    const forbiddenMarker = findForbiddenMarker(file.bytes);
    if (forbiddenMarker !== null) {
      throw new Error(
        `REWARD_GUARDED_ARTIFACT_FORBIDDEN_SURFACE:${file.path}:${sha256(forbiddenMarker)}`,
      );
    }
    artifactByteCount += BigInt(file.bytes.length);
    fileLedger.push(Object.freeze({
      path: file.path,
      byteLength: file.bytes.length,
      sha256: sha256(file.bytes),
    }));
  }

  const artifactSetSha256 = sha256(fileLedger.map((file) => (
    `${file.path}\0${file.byteLength}\0${file.sha256}`
  )).join("\n"));
  return freezeResult({
    schema: REWARD_GUARDED_ARTIFACT_INVENTORY_SCHEMA,
    status: REWARD_GUARDED_ARTIFACT_INVENTORY_STATUS,
    sourceInventorySchema: enumeratedSource.schema,
    sourceSetSha256: enumeratedSource.sourceSetSha256,
    guardedSurfaceSha256: enumeratedSource.guardedSurfaceSha256,
    artifactSetSha256,
    artifactFileCount: fileLedger.length,
    artifactByteCount,
    fileLedger,
    forbiddenMarkerSetSha256: sha256(FORBIDDEN_ARTIFACT_MARKERS.join("\n")),
    forbiddenMarkerCount: FORBIDDEN_ARTIFACT_MARKERS.length,
    filesystemEnumerationVerified,
    exactArtifactByteInventoryVerified: true,
    forbiddenGuardedRewardSurfaceBytesAbsentVerified: true,
    sourceMapAndBinaryBytesIncludedInScan: true,
    sourceInventoryBindingRecorded: true,
    artifactBuiltFromBoundSourceVerified: false,
    reproducibleBuildVerified: false,
    runtimeConfinementVerified: false,
    providerAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    materializedProjectionStateVerified: false,
    externalSideEffectsAuthorized: false,
    independentReviewAccepted: false,
    activationReady: false,
    mainnetStatus: REWARD_GUARDED_ARTIFACT_INVENTORY_MAINNET_STATUS,
  });
}

export function collectRewardArtifactFiles(artifactRootDirectory) {
  if (typeof artifactRootDirectory !== "string" || artifactRootDirectory.length === 0) {
    throw new TypeError("reward guarded artifact root must be non-empty text");
  }
  const root = resolve(artifactRootDirectory);
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("REWARD_GUARDED_ARTIFACT_ROOT_DIRECTORY_REQUIRED");
  }
  const files = [];
  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("REWARD_GUARDED_ARTIFACT_SYMLINK_HOLD");
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      files.push(Object.freeze({
        path: relative(root, absolutePath).replaceAll("\\", "/"),
        bytes: readFileSync(absolutePath),
      }));
    }
  };
  walk(root);
  return Object.freeze(files.sort((left, right) => left.path.localeCompare(right.path, "en")));
}

export function assertRewardGuardedArtifactInventory({
  sourceRootDirectory,
  artifactRootDirectory,
} = {}) {
  const sourceInventory = assertRewardGuardedRepositorySourceInventory({
    rootDirectory: sourceRootDirectory,
  });
  const result = auditRewardGuardedArtifactFiles({
    artifactFiles: collectRewardArtifactFiles(artifactRootDirectory),
    sourceInventory,
    filesystemEnumerationVerified: true,
  });
  ENUMERATED_ARTIFACT_INVENTORIES.add(result);
  return result;
}

export function assertEnumeratedRewardGuardedArtifactInventory(value) {
  if (!ENUMERATED_ARTIFACT_INVENTORIES.has(value)) {
    throw new Error("REWARD_GUARDED_ARTIFACT_ENUMERATED_INVENTORY_REQUIRED");
  }
  return value;
}
