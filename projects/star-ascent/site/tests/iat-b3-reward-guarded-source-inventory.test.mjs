import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  REWARD_GUARDED_SOURCE_INVENTORY_MAINNET_STATUS,
  REWARD_GUARDED_SOURCE_INVENTORY_SCHEMA,
  REWARD_GUARDED_SOURCE_INVENTORY_STATUS,
  assertRewardGuardedRepositorySourceInventory,
  auditRewardGuardedSourceFiles,
  collectRewardProductionSourceFiles,
} from "../programs/iat_b3_reference/reward-guarded-source-inventory.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const productionSources = collectRewardProductionSourceFiles(SITE_ROOT);

function withSource(path, source) {
  return [...productionSources, { path, source }];
}

function replaceSource(path, mutate) {
  return productionSources.map((file) => (
    file.path === path ? { path, source: mutate(file.source) } : file
  ));
}

test("repository source inventory binds every current reward adapter edge and stays non-authorizing", () => {
  const result = assertRewardGuardedRepositorySourceInventory({ rootDirectory: SITE_ROOT });
  assert.equal(result.schema, REWARD_GUARDED_SOURCE_INVENTORY_SCHEMA);
  assert.equal(result.status, REWARD_GUARDED_SOURCE_INVENTORY_STATUS);
  assert.equal(result.filesystemEnumerationVerified, true);
  assert.equal(result.exactGuardedAdapterSourceDigestsVerified, true);
  assert.equal(result.unlistedSensitiveSourceMarkerRejected, true);
  assert.equal(result.deployableRewardConsumerPathsInventoried, true);
  assert.equal(result.criticalSources.length, 11);
  assert.ok(result.criticalSources.some(({ path }) => (
    path === "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs"
  )));
  assert.ok(result.criticalSources.some(({ path }) => (
    path === "programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs"
  )));
  assert.ok(result.criticalSources.some(({ path }) => (
    path === "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs"
  )));
  assert.ok(result.scannedSourceFileCount >= 300);
  assert.match(result.sourceSetSha256, /^[0-9a-f]{64}$/u);
  assert.match(result.guardedSurfaceSha256, /^[0-9a-f]{64}$/u);

  assert.equal(result.runtimeDirectStoreBypassPreventionVerified, false);
  assert.equal(result.providerAuthenticationVerified, false);
  assert.equal(result.rollbackProtectionVerified, false);
  assert.equal(result.materializedProjectionStateVerified, false);
  assert.equal(result.externalSideEffectsAuthorized, false);
  assert.equal(result.builtArtifactParityVerified, false);
  assert.equal(result.independentReviewAccepted, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.mainnetStatus, REWARD_GUARDED_SOURCE_INVENTORY_MAINNET_STATUS);
  assert.equal(result.mainnetStatus, "HOLD");
});

test("aliased raw reward mutators and adapter-symbol access cannot enter a new source path", () => {
  assert.throws(
    () => auditRewardGuardedSourceFiles(withSource(
      "worker/forged-round-writer.mjs",
      `import { finalizeRewardCapacityRoundCas as write } from
        "../programs/iat_b3_reference/reward-persistence-cas.mjs";
       export const bypass = (input) => write(input);`,
    )),
    /REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles(withSource(
      "app/raw-reward-adapter.ts",
      `import { REWARD_CAS_STORE_ADAPTER as raw } from
        "../programs/iat_b3_reference/reward-persistence-cas.mjs";
       export const bypass = (store, input) => store[raw].recordPremiumUpgrade(input);`,
    )),
    /REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH:REWARD_CAS_STORE_ADAPTER/u,
  );
});

test("split or escaped static paths, properties, and IdentifierNames fail closed", () => {
  for (const [path, source, expectedError, marker] of [
    [
      "worker/split-materialized-import.mjs",
      `export const load = () => import(
        "../programs/iat_b3_reference/reward-" +
        "materialized-projection-sqlite.mjs"
      );`,
      "SPLIT_MARKER",
      "reward-materialized-projection-sqlite.mjs",
    ],
    [
      "worker/grouped-split-materialized-import.mjs",
      `export const load = () => import(
        ("../programs/iat_b3_reference/reward-" +
          ("materialized-" + "projection-sqlite.mjs"))
      );`,
      "SPLIT_MARKER",
      "reward-materialized-projection-sqlite.mjs",
    ],
    [
      "worker/split-materialized-factory.mjs",
      `export const open = (adapter, options) => adapter[
        "createSqliteReward" /* split marker */ + "\\u004daterializedProjection"
      ](options);`,
      "SPLIT_MARKER",
      "createSqliteRewardMaterializedProjection",
    ],
    [
      "worker/escaped-materialized-import.mjs",
      `export const load = () => import(
        "../programs/iat_b3_reference/reward-\\u006daterialized-projection-sqlite.mjs"
      );`,
      "ESCAPED_LITERAL_MARKER",
      "reward-materialized-projection-sqlite.mjs",
    ],
    [
      "worker/legacy-octal-materialized-import.cjs",
      `exports.load = () => import(
        "../programs/iat_b3_reference/reward-\\155aterialized-projection-sqlite.mjs"
      );`,
      "ESCAPED_LITERAL_MARKER",
      "reward-materialized-projection-sqlite.mjs",
    ],
    [
      "worker/escaped-materialized-property.mjs",
      `export const open = (adapter, options) => adapter[
        "createSqliteReward\\u004daterializedProjection"
      ](options);`,
      "ESCAPED_LITERAL_MARKER",
      "createSqliteRewardMaterializedProjection",
    ],
    [
      "worker/escaped-materialized-identifier.mjs",
      `export const open = (adapter, options) =>
        adapter.createSqliteReward\\u004daterializedProjection(options);`,
      "ESCAPED_IDENTIFIER_MARKER",
      "createSqliteRewardMaterializedProjection",
    ],
  ]) {
    assert.throws(
      () => auditRewardGuardedSourceFiles(withSource(path, source)),
      new RegExp(`REWARD_GUARDED_SOURCE_${expectedError}_FORBIDDEN:.*:${marker}`, "u"),
      path,
    );
  }
});

test("permit-only, cursor-only, and direct projection-table consumers all fail the inventory", () => {
  for (const [path, source] of [
    [
      "worker/permit-without-cursor.mjs",
      `import { prepareRewardConsumerPermit } from
        "../programs/iat_b3_reference/reward-consumer-gate.mjs";
       export const leakPermit = (input) => prepareRewardConsumerPermit(input);`,
    ],
    [
      "worker/uninventoried-cursor-consumer.mjs",
      "export const consume = (cursor, input) => cursor.consumePermit(input);",
    ],
    [
      "scripts/direct-projection-event-write.mjs",
      "export const sql = 'INSERT INTO reward_consumer_projection_events VALUES (...)';",
    ],
    [
      "scripts/direct-materialized-projection-write.mjs",
      "export const sql = 'DELETE FROM reward_materialized_projection_state_history';",
    ],
    [
      "scripts/direct-reward-cas-write.mjs",
      "export const sql = 'DELETE FROM reward_cas_entity_versions';",
    ],
  ]) {
    assert.throws(
      () => auditRewardGuardedSourceFiles(withSource(path, source)),
      /REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH/u,
      path,
    );
  }
});

test("unlisted signed-anchor, mirror, and composed-runtime callers fail the inventory", () => {
  for (const [path, source] of [
    [
      "worker/unlisted-anchor-verifier.mjs",
      `import { verifyRewardExternalRollbackAnchor } from
        "../programs/iat_b3_reference/reward-external-rollback-anchor.mjs";
       export const verify = (input) => verifyRewardExternalRollbackAnchor(input);`,
    ],
    [
      "worker/unlisted-anchor-mirror.mjs",
      "export const persist = (mirror, receipt) => mirror.consumeSignedAnchorReceipt({ receipt });",
    ],
    [
      "worker/unlisted-composed-runtime.mjs",
      `import { createRewardAuthenticatedConsumerRuntime } from
        "../programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs";
       export const start = (options) => createRewardAuthenticatedConsumerRuntime(options);`,
    ],
    [
      "scripts/direct-anchor-history-write.mjs",
      "export const sql = 'DELETE FROM reward_rollback_anchor_receipts';",
    ],
  ]) {
    assert.throws(
      () => auditRewardGuardedSourceFiles(withSource(path, source)),
      /REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH/u,
      path,
    );
  }
});

test("critical adapter drift or omission fails before an updated inventory can attest it", () => {
  const criticalPath = "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs";
  assert.throws(
    () => auditRewardGuardedSourceFiles(replaceSource(
      criticalPath,
      (source) => `${source}\n// unreviewed source drift\n`,
    )),
    /REWARD_GUARDED_SOURCE_CRITICAL_DIGEST_MISMATCH/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles(
      productionSources.filter((file) => file.path !== criticalPath),
    ),
    /REWARD_GUARDED_SOURCE_CRITICAL_PATH_MISSING/u,
  );
  const runtimePath = "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs";
  assert.throws(
    () => auditRewardGuardedSourceFiles(replaceSource(
      runtimePath,
      (source) => `${source}\n// unreviewed runtime composition drift\n`,
    )),
    /REWARD_GUARDED_SOURCE_CRITICAL_DIGEST_MISMATCH/u,
  );
  const materializedPath =
    "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs";
  assert.throws(
    () => auditRewardGuardedSourceFiles(replaceSource(
      materializedPath,
      (source) => `${source}\n// unreviewed materialized projection drift\n`,
    )),
    /REWARD_GUARDED_SOURCE_CRITICAL_DIGEST_MISMATCH/u,
  );
});

test("descriptor accessors are rejected without execution and unrelated source remains allowed", () => {
  let accessorRead = false;
  const hostile = { path: "worker/hostile.mjs" };
  Object.defineProperty(hostile, "source", {
    enumerable: true,
    get() {
      accessorRead = true;
      throw new Error("SOURCE_ACCESSOR_EXECUTED");
    },
  });
  assert.throws(
    () => auditRewardGuardedSourceFiles([...productionSources, hostile]),
    /descriptor must contain only path and source/u,
  );
  assert.equal(accessorRead, false);

  const baseline = auditRewardGuardedSourceFiles(productionSources);
  const extended = auditRewardGuardedSourceFiles(withSource(
    "worker/unrelated-health-check.mjs",
    "export const health = () => Object.freeze({ status: 'ok' });",
  ));
  assert.equal(baseline.filesystemEnumerationVerified, false);
  assert.equal(extended.scannedSourceFileCount, baseline.scannedSourceFileCount + 1);
  assert.notEqual(extended.sourceSetSha256, baseline.sourceSetSha256);
  assert.equal(extended.guardedSurfaceSha256, baseline.guardedSurfaceSha256);
  assert.equal(extended.mainnetStatus, "HOLD");
});
