import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

// This guarded inventory test is a canonical check:iat-b3-spec entry point.
// Loading the critical adapter's hostile functional suite here keeps its exact
// pinned bytes and executable durability proof in the same fail-closed gate.
import "./iat-b3-reward-waterfall-audit-sqlite.test.mjs";
import "./iat-b3-reward-allocator-rust-differential.test.mjs";
import "./iat-b3-reward-capacity-rust-recomputation.test.mjs";

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

test("canonical guarded entry point retains waterfall and native differential suites", () => {
  const entryPointSource = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const testFileName = ["iat-b3-reward-waterfall", "audit-sqlite.test.mjs"].join("-");
  const exactImport = `import "./${testFileName}";`;
  assert.equal(entryPointSource.split(/\r?\n/u).filter((line) => line === exactImport).length, 1);
  assert.doesNotThrow(() => readFileSync(
    fileURLToPath(new URL("./iat-b3-reward-waterfall-audit-sqlite.test.mjs", import.meta.url)),
    "utf8",
  ));
  const differentialTestFileName = [
    "iat-b3-reward-allocator-rust",
    "differential.test.mjs",
  ].join("-");
  const exactDifferentialImport = `import "./${differentialTestFileName}";`;
  assert.equal(
    entryPointSource.split(/\r?\n/u).filter((line) => line === exactDifferentialImport).length,
    1,
  );
  assert.doesNotThrow(() => readFileSync(
    fileURLToPath(new URL("./iat-b3-reward-allocator-rust-differential.test.mjs", import.meta.url)),
    "utf8",
  ));
  const recomputationTestFileName = [
    "iat-b3-reward-capacity-rust",
    "recomputation.test.mjs",
  ].join("-");
  const exactRecomputationImport = `import "./${recomputationTestFileName}";`;
  assert.equal(
    entryPointSource.split(/\r?\n/u).filter((line) => line === exactRecomputationImport).length,
    1,
  );
  assert.doesNotThrow(() => readFileSync(
    fileURLToPath(new URL("./iat-b3-reward-capacity-rust-recomputation.test.mjs", import.meta.url)),
    "utf8",
  ));
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const canonicalCommand = packageJson.scripts?.["check:iat-b3-spec"];
  assert.equal(typeof canonicalCommand, "string");
  assert.equal(
    canonicalCommand.split("tests/iat-b3-reward-guarded-source-inventory.test.mjs").length - 1,
    1,
  );
});

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
  assert.equal(result.staticSensitiveSourceMarkerLocationsMatched, true);
  assert.equal(result.unlistedSensitiveSourceMarkerRejected, false);
  assert.equal(result.deployableRewardConsumerPathsInventoried, false);
  assert.equal(result.dynamicComputedDispatchRejected, false);
  assert.equal(result.reflectiveDispatchRejected, false);
  assert.equal(result.criticalSources.length, 16);
  assert.ok(result.criticalSources.some(({ path, sourceSha256 }) => (
    path === "programs/iat_b3_economy/src/reward_allocator_transcript.rs"
      && sourceSha256 === "a9fab4007e1dc7fa24b0e2248ee6ace8cd0c904f7643c87c79311deb6942a99d"
  )));
  assert.ok(result.criticalSources.some(({ path, sourceSha256 }) => (
    path === "programs/iat_b3_economy/src/reward_capacity_recomputation.rs"
      && sourceSha256 === "421e4538e730482f5e1c235ce6af9e8ac54bbc920fc8023bc0d471fff8ee03f3"
  )));
  assert.ok(result.criticalSources.some(({ path }) => (
    path === "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs"
  )));
  assert.ok(result.criticalSources.some(({ path }) => (
    path === "programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs"
  )));
  assert.ok(result.criticalSources.some(({ path }) => (
    path === "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs"
  )));
  assert.ok(result.criticalSources.some(({ path }) => (
    path === "programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs"
  )));
  assert.ok(result.criticalSources.some(({ path }) => (
    path === "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs"
  )));
  assert.ok(result.criticalSources.some(({ path, sourceSha256 }) => (
    path === "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs"
      && sourceSha256 === "d09fd2e22838200f1952f61a3a5682bd79105ed734d01b05ec1272076e174268"
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
    [
      "worker/escaped-authenticated-materialized-runtime.mjs",
      `export const open = (adapter, options) =>
        adapter.createRewardAuthenticated\\u004daterializedConsumerRuntime(options);`,
      "ESCAPED_IDENTIFIER_MARKER",
      "createRewardAuthenticatedMaterializedConsumerRuntime",
    ],
  ]) {
    assert.throws(
      () => auditRewardGuardedSourceFiles(withSource(path, source)),
      new RegExp(`REWARD_GUARDED_SOURCE_${expectedError}_FORBIDDEN:.*:${marker}`, "u"),
      path,
    );
  }
});

test("runtime-computed and reflective dispatch remain an explicit accepted-but-HOLD gap", () => {
  const cases = [
    [
      "worker/dynamic-materialized-array-join.mjs",
      `export function bypass(runtime, input) {
        const operation = ["consume", "Anchored", "Materialized", "Projection"].join("");
        return runtime[operation](input);
      }`,
    ],
    [
      "worker/dynamic-materialized-char-code.mjs",
      `export function bypass(runtime, input) {
        const operation = String.fromCharCode(
          99, 111, 110, 115, 117, 109, 101, 65, 110, 99, 104, 111, 114, 101, 100,
          77, 97, 116, 101, 114, 105, 97, 108, 105, 122, 101, 100, 80, 114, 111,
          106, 101, 99, 116, 105, 111, 110,
        );
        return runtime[operation](input);
      }`,
    ],
    [
      "worker/dynamic-materialized-variable.mjs",
      `export const bypass = (runtime, input, operation) => runtime[operation](input);`,
    ],
    [
      "worker/dynamic-materialized-optional.mjs",
      `export const bypass = (runtime, input, operation) => runtime?.[operation]?.(input);`,
    ],
    [
      "worker/dynamic-materialized-parenthesized.mjs",
      `export const bypass = (runtime, input, operation) =>
        (runtime)[(operation)](input);`,
    ],
    [
      "worker/dynamic-materialized-two-step.mjs",
      `export function bypass(runtime, input, operation) {
        const invoke = runtime[operation];
        return invoke(input);
      }`,
    ],
    [
      "worker/dynamic-materialized-reflect-call.mjs",
      `export function bypass(runtime, input, operation) {
        const invoke = Reflect.get(runtime, operation);
        return invoke.call(runtime, input);
      }`,
    ],
  ];
  for (const [path, source] of cases) {
    const result = auditRewardGuardedSourceFiles(withSource(path, source));
    assert.equal(result.staticSensitiveSourceMarkerLocationsMatched, true, path);
    assert.equal(result.unlistedSensitiveSourceMarkerRejected, false, path);
    assert.equal(result.deployableRewardConsumerPathsInventoried, false, path);
    assert.equal(result.dynamicComputedDispatchRejected, false, path);
    assert.equal(result.reflectiveDispatchRejected, false, path);
    assert.equal(result.runtimeDirectStoreBypassPreventionVerified, false, path);
    assert.equal(result.externalSideEffectsAuthorized, false, path);
    assert.equal(result.activationReady, false, path);
    assert.equal(result.mainnetStatus, "HOLD", path);
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
      "worker/unlisted-materialized-runtime.mjs",
      `import { createRewardAuthenticatedMaterializedConsumerRuntime } from
        "../programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs";
       export const start = (options) =>
         createRewardAuthenticatedMaterializedConsumerRuntime(options);`,
    ],
    [
      "worker/unlisted-materialized-operation.mjs",
      `export const consume = (runtime, input) =>
        runtime.consumeAnchoredMaterializedProjection(input);`,
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

test("waterfall replay-audit bytes, HOLD truth, imports, factory, and SQLite namespace fail closed", () => {
  const auditPath = "programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs";
  const auditSource = productionSources.find(({ path }) => path === auditPath);
  assert.ok(auditSource);
  assert.throws(
    () => auditRewardGuardedSourceFiles(
      productionSources.filter(({ path }) => path !== auditPath),
    ),
    /REWARD_GUARDED_SOURCE_CRITICAL_PATH_MISSING:.*reward-waterfall-audit-sqlite/u,
  );
  for (const mutate of [
    (source) => `${source}\n// unreviewed replay-audit drift\n`,
    (source) => source.replace(
      'REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS = "HOLD"',
      'REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS = "READY"',
    ),
    (source) => source.replace(
      "runtimeAuthenticationVerified: false",
      "runtimeAuthenticationVerified: true",
    ),
    (source) => source.replace(
      "rollbackProtectionVerified: false",
      "rollbackProtectionVerified: true",
    ),
    (source) => source.replace("activationReady: false", "activationReady: true"),
  ]) {
    assert.throws(
      () => auditRewardGuardedSourceFiles(replaceSource(auditPath, mutate)),
      /REWARD_GUARDED_SOURCE_CRITICAL_DIGEST_MISMATCH:.*reward-waterfall-audit-sqlite/u,
    );
  }

  for (const [path, source, marker] of [
    [
      "worker/unreviewed-waterfall-audit-import.mjs",
      `export * from
        "../programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs";`,
      "reward-waterfall-audit-sqlite.mjs",
    ],
    [
      "worker/unreviewed-waterfall-audit-factory.mjs",
      "export const open = (adapter, options) => adapter.createRewardWaterfallAuditSqlite(options);",
      "createRewardWaterfallAuditSqlite",
    ],
    [
      "scripts/unreviewed-waterfall-audit-delete.mjs",
      "export const sql = 'DELETE FROM reward_waterfall_audit_rounds';",
      "reward_waterfall_audit_",
    ],
    [
      "worker/unreviewed-waterfall-audit-schema.mjs",
      "export const schema = 'iat-b3-reward-waterfall-audit-sqlite/v1';",
      "iat-b3-reward-waterfall-audit-sqlite/v1",
    ],
    [
      "worker/unreviewed-waterfall-audit-status.mjs",
      "export const status = 'HOST_ONLY_NONACTIVATING_REPLAY_AUDIT';",
      "HOST_ONLY_NONACTIVATING_REPLAY_AUDIT",
    ],
    [
      "worker/unreviewed-waterfall-audit-append.mjs",
      "export const append = (adapter, input) => adapter.appendFinalizedRound(input);",
      "appendFinalizedRound",
    ],
    [
      "worker/unreviewed-proof-bundle-import.mjs",
      `export { validateRewardAllocatorProofBundle } from
        "../programs/iat_b3_reference/reward-allocator-proof-bundle.mjs";`,
      "reward-allocator-proof-bundle.mjs",
    ],
    [
      "worker/unreviewed-receipt-codec-import.mjs",
      `export { allocatorTranscriptSha256 } from
        "../programs/iat_b3_reference/reward-allocator-receipt-codec.mjs";`,
      "reward-allocator-receipt-codec.mjs",
    ],
  ]) {
    assert.throws(
      () => auditRewardGuardedSourceFiles(withSource(path, source)),
      new RegExp(`REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH:${marker}`),
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

  const privacyAnchorPath =
    "programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs";
  const privacyAnchor = productionSources.find(({ path }) => path === privacyAnchorPath);
  assert.ok(privacyAnchor);
  assert.throws(
    () => auditRewardGuardedSourceFiles(replaceSource(
      privacyAnchorPath,
      (source) => `${source}\n// unreviewed privacy anchor drift\n`,
    )),
    /REWARD_GUARDED_SOURCE_CRITICAL_DIGEST_MISMATCH/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles(
      productionSources.filter(({ path }) => path !== privacyAnchorPath),
    ),
    /REWARD_GUARDED_SOURCE_CRITICAL_PATH_MISSING/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles([
      ...productionSources.filter(({ path }) => path !== privacyAnchorPath),
      {
        path: "programs/iat_b3_reference/privacy-vault-external-anchor-alias.mjs",
        source: privacyAnchor.source,
      },
    ]),
    /REWARD_GUARDED_SOURCE_CRITICAL_PATH_MISSING/u,
  );
});

test("native reward proof bytes, exports, truth, and validators fail closed on drift", () => {
  const modulePath = "programs/iat_b3_economy/src/reward_allocator_transcript.rs";
  const recomputationPath =
    "programs/iat_b3_economy/src/reward_capacity_recomputation.rs";
  const libPath = "programs/iat_b3_economy/src/lib.rs";
  assert.ok(productionSources.some(({ path }) => path === modulePath));
  assert.ok(productionSources.some(({ path }) => path === recomputationPath));
  assert.throws(
    () => auditRewardGuardedSourceFiles(replaceSource(
      modulePath,
      (source) => `${source}\n// unreviewed native reward transcript drift\n`,
    )),
    /REWARD_GUARDED_SOURCE_CRITICAL_DIGEST_MISMATCH:.*reward_allocator_transcript\.rs/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles(
      productionSources.filter(({ path }) => path !== modulePath),
    ),
    /REWARD_GUARDED_SOURCE_CRITICAL_PATH_MISSING:.*reward_allocator_transcript\.rs/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles(replaceSource(
      recomputationPath,
      (source) => `${source}\n// unreviewed native reward recomputation drift\n`,
    )),
    /REWARD_GUARDED_SOURCE_CRITICAL_DIGEST_MISMATCH:.*reward_capacity_recomputation\.rs/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles(
      productionSources.filter(({ path }) => path !== recomputationPath),
    ),
    /REWARD_GUARDED_SOURCE_CRITICAL_PATH_MISSING:.*reward_capacity_recomputation\.rs/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles(replaceSource(
      libPath,
      (source) => source.replace(
        "validate_reward_allocator_transcript_binding",
        "validate_reward_allocator_transcript_bindin_",
      ),
    )),
    /REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH:validate_reward_allocator_transcript_binding/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles(replaceSource(
      libPath,
      (source) => source.replace(
        "verify_reward_capacity_allocation_recomputation",
        "verify_reward_capacity_allocation_recomputatio_",
      ),
    )),
    /REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH:verify_reward_capacity_allocation_recomputation/u,
  );
  for (const [path, source, marker] of [
    [
      "worker/unreviewed-native-reward-validator.rs",
      "fn bypass() { validate_reward_allocator_transcript_binding(); }",
      "validate_reward_allocator_transcript_binding",
    ],
    [
      "worker/unreviewed-native-reward-decoder.rs",
      "fn bypass(bytes: &[u8]) { decode_reward_allocator_receipt(bytes); }",
      "decode_reward_allocator_receipt",
    ],
    [
      "worker/unreviewed-native-reward-truth.rs",
      "const BYPASS: bool = REWARD_ALLOCATOR_TRANSCRIPT_TRUTH.activation_ready;",
      "REWARD_ALLOCATOR_TRANSCRIPT_TRUTH",
    ],
    [
      "worker/unreviewed-native-reward-status.rs",
      "const STATUS: &str = REWARD_ALLOCATOR_TRANSCRIPT_MAINNET_STATUS;",
      "REWARD_ALLOCATOR_TRANSCRIPT_MAINNET_STATUS",
    ],
    [
      "worker/unreviewed-native-reward-structural-status.rs",
      "const STATUS: &str = REWARD_ALLOCATOR_TRANSCRIPT_STATUS;",
      "REWARD_ALLOCATOR_TRANSCRIPT_STATUS",
    ],
    [
      "worker/unreviewed-native-reward-module.rs",
      "mod reward_allocator_transcript;",
      "mod reward_allocator_transcript",
    ],
    [
      "worker/unreviewed-native-reward-reexport.rs",
      "pub use reward_allocator_transcript::*;",
      "pub use reward_allocator_transcript",
    ],
    [
      "worker/unreviewed-native-recomputation-validator.rs",
      "fn bypass() { verify_reward_capacity_allocation_recomputation(); }",
      "verify_reward_capacity_allocation_recomputation",
    ],
    [
      "worker/unreviewed-native-recomputation-truth.rs",
      "const BYPASS: bool = REWARD_CAPACITY_RECOMPUTATION_TRUTH.activation_ready;",
      "REWARD_CAPACITY_RECOMPUTATION_TRUTH",
    ],
    [
      "worker/unreviewed-native-recomputation-status.rs",
      "const STATUS: &str = REWARD_CAPACITY_RECOMPUTATION_MAINNET_STATUS;",
      "REWARD_CAPACITY_RECOMPUTATION_MAINNET_STATUS",
    ],
    [
      "worker/unreviewed-native-recomputation-structural-status.rs",
      "const STATUS: &str = REWARD_CAPACITY_RECOMPUTATION_STATUS;",
      "REWARD_CAPACITY_RECOMPUTATION_STATUS",
    ],
    [
      "worker/unreviewed-native-recomputation-module.rs",
      "mod reward_capacity_recomputation;",
      "mod reward_capacity_recomputation",
    ],
    [
      "worker/unreviewed-native-recomputation-reexport.rs",
      "pub use reward_capacity_recomputation::*;",
      "pub use reward_capacity_recomputation",
    ],
  ]) {
    assert.throws(
      () => auditRewardGuardedSourceFiles(withSource(path, source)),
      new RegExp(`REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH:${marker}`, "u"),
      path,
    );
  }
});

test("the reviewed privacy anchor provider import marker cannot drift to another source", () => {
  assert.throws(
    () => auditRewardGuardedSourceFiles(withSource(
      "worker/unreviewed-privacy-anchor-provider-import.mjs",
      `import { verifyProviderEnvelope } from
        "../programs/iat_b3_reference/provider-authenticated-envelope.mjs";
       export const bypass = (input) => verifyProviderEnvelope(input);`,
    )),
    /REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH:provider-authenticated-envelope\.mjs/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles(withSource(
      "worker/unreviewed-privacy-anchor-verifier.mjs",
      "export const bypass = (provider, input) => provider.verifyProviderSignedEnvelope(input);",
    )),
    /REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH:verifyProviderSignedEnvelope/u,
  );
});

test("authenticated privacy runtime path, digest, and static composition edges fail closed", () => {
  const runtimePath =
    "programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs";
  const runtimeSource = productionSources.find(({ path }) => path === runtimePath);
  assert.ok(runtimeSource);
  assert.throws(
    () => auditRewardGuardedSourceFiles(replaceSource(
      runtimePath,
      (source) => `${source}\n// unreviewed authenticated privacy runtime drift\n`,
    )),
    /REWARD_GUARDED_SOURCE_CRITICAL_DIGEST_MISMATCH/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles(
      productionSources.filter(({ path }) => path !== runtimePath),
    ),
    /REWARD_GUARDED_SOURCE_CRITICAL_PATH_MISSING/u,
  );
  assert.throws(
    () => auditRewardGuardedSourceFiles([
      ...productionSources.filter(({ path }) => path !== runtimePath),
      {
        path: "worker/privacy-vault-authenticated-runtime-alias.mjs",
        source: runtimeSource.source,
      },
    ]),
    /REWARD_GUARDED_SOURCE_CRITICAL_PATH_MISSING/u,
  );
  for (const [path, source, marker] of [
    [
      "worker/unreviewed-privacy-runtime-import.mjs",
      `export { createPrivacyVaultAuthenticatedRecoveryRuntime } from
        "../programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs";`,
      "privacy-vault-authenticated-recovery-runtime.mjs",
    ],
    [
      "worker/unreviewed-recovery-verifier.mjs",
      "export const bypass = (adapter, input) => adapter.verifyPrivacyVaultRecoveryBundle(input);",
      "verifyPrivacyVaultRecoveryBundle",
    ],
    [
      "worker/unreviewed-recovery-commit.mjs",
      "export const bypass = (adapter, input) => adapter.commitVerifiedBundle(input);",
      "commitVerifiedBundle",
    ],
    [
      "worker/unreviewed-anchor-verifier.mjs",
      "export const bypass = (adapter, input) => adapter.verifyPrivacyVaultExternalRollbackAnchor(input);",
      "verifyPrivacyVaultExternalRollbackAnchor",
    ],
  ]) {
    assert.throws(
      () => auditRewardGuardedSourceFiles(withSource(path, source)),
      new RegExp(`REWARD_GUARDED_SOURCE_BYPASS_MARKER_MISMATCH:${marker}`),
      path,
    );
  }
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
