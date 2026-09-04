import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  REWARD_GUARDED_ARTIFACT_INVENTORY_MAINNET_STATUS,
  REWARD_GUARDED_ARTIFACT_INVENTORY_SCHEMA,
  REWARD_GUARDED_ARTIFACT_INVENTORY_STATUS,
  assertRewardGuardedArtifactInventory,
  auditRewardGuardedArtifactFiles,
} from "../programs/iat_b3_reference/reward-guarded-artifact-inventory.mjs";
import {
  assertRewardGuardedRepositorySourceInventory,
} from "../programs/iat_b3_reference/reward-guarded-source-inventory.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const sourceInventory = assertRewardGuardedRepositorySourceInventory({
  rootDirectory: SITE_ROOT,
});

function artifact(path, source) {
  return { path, bytes: Buffer.from(source) };
}

function audit(files) {
  return auditRewardGuardedArtifactFiles({
    artifactFiles: files,
    sourceInventory,
  });
}

test("exact clean artifact bytes bind to the enumerated source gate and remain non-authorizing", () => {
  const result = audit([
    artifact("client/app.js", "export const launch = false;"),
    artifact("server/index.js", "export default { fetch: () => new Response('hold') };"),
    { path: "client/image.bin", bytes: Buffer.from([0, 1, 2, 255]) },
  ]);
  assert.equal(result.schema, REWARD_GUARDED_ARTIFACT_INVENTORY_SCHEMA);
  assert.equal(result.status, REWARD_GUARDED_ARTIFACT_INVENTORY_STATUS);
  assert.equal(result.sourceSetSha256, sourceInventory.sourceSetSha256);
  assert.equal(result.guardedSurfaceSha256, sourceInventory.guardedSurfaceSha256);
  assert.equal(result.artifactFileCount, 3);
  assert.equal(result.artifactByteCount > 0n, true);
  assert.equal(result.fileLedger.length, 3);
  assert.deepEqual(result.fileLedger.map(({ path }) => path), [
    "client/app.js",
    "client/image.bin",
    "server/index.js",
  ]);
  assert.match(result.artifactSetSha256, /^[0-9a-f]{64}$/u);
  assert.match(result.forbiddenMarkerSetSha256, /^[0-9a-f]{64}$/u);
  assert.ok(result.forbiddenMarkerCount >= 30);
  assert.equal(result.exactArtifactByteInventoryVerified, true);
  assert.equal(result.forbiddenGuardedRewardSurfaceBytesAbsentVerified, true);
  assert.equal(result.sourceMapAndBinaryBytesIncludedInScan, true);
  assert.equal(result.sourceInventoryBindingRecorded, true);

  assert.equal(result.artifactBuiltFromBoundSourceVerified, false);
  assert.equal(result.reproducibleBuildVerified, false);
  assert.equal(result.runtimeConfinementVerified, false);
  assert.equal(result.providerAuthenticationVerified, false);
  assert.equal(result.rollbackProtectionVerified, false);
  assert.equal(result.materializedProjectionStateVerified, false);
  assert.equal(result.externalSideEffectsAuthorized, false);
  assert.equal(result.sourceBoundAutomatedDirectEvidenceVerified, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.mainnetStatus, REWARD_GUARDED_ARTIFACT_INVENTORY_MAINNET_STATUS);
  assert.equal(result.mainnetStatus, "HOLD");
});

test("mutator, module, schema, SQLite, source-map, and binary bypass markers fail closed", () => {
  const hostiles = [
    "finalizeRewardCapacityRoundCas",
    "reward-persistence-cas-sqlite.mjs",
    "iat-b3-reward-consumer-local-projection-event/v1",
    "INSERT INTO reward_consumer_projection_events VALUES (?)",
    "INSERT INTO reward_cas_entity_versions VALUES (?)",
    "reward-waterfall-audit-sqlite.mjs",
    "createRewardWaterfallAuditSqlite",
    "appendFinalizedRound",
    "REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS",
    "iat-b3-reward-waterfall-audit-sqlite/v1",
    "HOST_ONLY_NONACTIVATING_REPLAY_AUDIT",
    "INSERT INTO reward_waterfall_audit_rounds VALUES (?)",
    JSON.stringify({
      version: 3,
      sources: ["programs/iat_b3_reference/reward-consumer-gate.mjs"],
      sourcesContent: ["prepareRewardConsumerPermit(input)"],
    }),
  ];
  for (const [index, hostile] of hostiles.entries()) {
    assert.throws(
      () => audit([artifact(`server/hostile-${index}.js`, hostile)]),
      /REWARD_GUARDED_ARTIFACT_FORBIDDEN_SURFACE/u,
      hostile,
    );
  }
  assert.throws(
    () => audit([{
      path: "client/opaque.bin",
      bytes: Buffer.concat([
        Buffer.from([0, 255, 0]),
        Buffer.from("REWARD_CAS_STORE_ADAPTER"),
        Buffer.from([255, 0]),
      ]),
    }]),
    /REWARD_GUARDED_ARTIFACT_FORBIDDEN_SURFACE/u,
  );
});

test("artifact descriptors, paths, and source binding reject aliases without reading accessors", () => {
  assert.throws(
    () => audit([
      artifact("server/index.js", "export const a = 1;"),
      artifact("server/index.js", "export const b = 2;"),
    ]),
    /REWARD_GUARDED_ARTIFACT_DUPLICATE_PATH/u,
  );
  assert.throws(
    () => audit([artifact("../escape.js", "export const nope = true;")]),
    /canonical relative POSIX/u,
  );

  let accessorRead = false;
  const hostile = { path: "server/hostile.js" };
  Object.defineProperty(hostile, "bytes", {
    enumerable: true,
    get() {
      accessorRead = true;
      throw new Error("ARTIFACT_BYTES_ACCESSOR_EXECUTED");
    },
  });
  assert.throws(
    () => audit([hostile]),
    /descriptor must contain only path and bytes/u,
  );
  assert.equal(accessorRead, false);

  const decorated = Buffer.from("clean");
  decorated.hidden = true;
  assert.throws(
    () => audit([{ path: "server/decorated.js", bytes: decorated }]),
    /must not have decorated properties/u,
  );
  assert.throws(
    () => auditRewardGuardedArtifactFiles({
      artifactFiles: [artifact("server/index.js", "clean")],
      sourceInventory: structuredClone(sourceInventory),
    }),
    /REWARD_GUARDED_SOURCE_ENUMERATED_INVENTORY_REQUIRED/u,
  );
});

test("harmless artifact drift changes the exact byte ledger without changing the source binding", () => {
  const first = audit([artifact("server/index.js", "export const revision = 1;")]);
  const second = audit([artifact("server/index.js", "export const revision = 2;")]);
  assert.notEqual(first.artifactSetSha256, second.artifactSetSha256);
  assert.equal(first.sourceSetSha256, second.sourceSetSha256);
  assert.equal(first.guardedSurfaceSha256, second.guardedSurfaceSha256);
  assert.equal(first.mainnetStatus, "HOLD");
  assert.equal(second.mainnetStatus, "HOLD");
});

test("filesystem artifact enumeration includes nested and opaque files", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-reward-artifact-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "client"), { recursive: true });
  mkdirSync(join(directory, "server", "nested"), { recursive: true });
  writeFileSync(join(directory, "client", "app.js"), "export const status = 'hold';");
  writeFileSync(join(directory, "server", "nested", "opaque.data"), Buffer.from([9, 8, 7]));

  const result = assertRewardGuardedArtifactInventory({
    sourceRootDirectory: SITE_ROOT,
    artifactRootDirectory: directory,
  });
  assert.equal(result.filesystemEnumerationVerified, true);
  assert.equal(result.artifactFileCount, 2);
  assert.deepEqual(result.fileLedger.map(({ path }) => path), [
    "client/app.js",
    "server/nested/opaque.data",
  ]);
  assert.equal(result.forbiddenGuardedRewardSurfaceBytesAbsentVerified, true);
  assert.equal(result.artifactBuiltFromBoundSourceVerified, false);
  assert.equal(result.mainnetStatus, "HOLD");
});
