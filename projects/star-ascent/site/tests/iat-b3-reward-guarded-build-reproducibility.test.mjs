import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  createRewardGuardedBuildRecipe,
  executeRewardGuardedBuildRecipe,
} from "../programs/iat_b3_reference/reward-guarded-build-provenance.mjs";
import {
  REWARD_GUARDED_BUILD_REPRODUCIBILITY_MAINNET_STATUS,
  REWARD_GUARDED_BUILD_REPRODUCIBILITY_SCHEMA,
  REWARD_GUARDED_BUILD_REPRODUCIBILITY_STATUS,
  compareIndependentRewardGuardedBuildReceipts,
  validateRewardGuardedBuildReproducibilityReceipt,
} from "../programs/iat_b3_reference/reward-guarded-build-reproducibility.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const INVENTORIED_SOURCE_PATHS = Object.freeze([
  "programs/iat_b3_reference/provider-authenticated-envelope.mjs",
  "programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs",
  "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs",
  "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs",
  "programs/iat_b3_reference/reward-consumer-gate.mjs",
  "programs/iat_b3_reference/reward-external-rollback-anchor.mjs",
  "programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs",
  "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs",
  "programs/iat_b3_reference/reward-persistence-cas.mjs",
  "programs/iat_b3_reference/reward-persistence-checkpoint.mjs",
  "programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs",
  "scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs",
  "scripts/validate-iat-b3-x-social-evidence-provider-readiness.mjs",
]);
const DETERMINISTIC_BUILD = `
  import { mkdirSync, writeFileSync } from "node:fs";
  import { join } from "node:path";
  const root = process.argv[1];
  mkdirSync(join(root, "server"), { recursive: true });
  writeFileSync(join(root, "server", "index.js"), "export const revision = 1;");
  console.log("deterministic-build");
`;

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-reproducibility-"));
  const sourceRoot = join(directory, "source");
  const artifactRoot = join(directory, "artifact");
  mkdirSync(sourceRoot, { recursive: true });
  for (const relativePath of INVENTORIED_SOURCE_PATHS) {
    const destination = join(sourceRoot, ...relativePath.split("/"));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(SITE_ROOT, ...relativePath.split("/")), destination);
  }
  writeFileSync(
    join(sourceRoot, "build-config.json"),
    `${JSON.stringify({ schema: "iat-b3-reproducibility-config/v1", mode: "hold" })}\n`,
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, sourceRoot, artifactRoot };
}

function createRecipe(context, buildSource = DETERMINISTIC_BUILD, {
  environmentMode = "REPRODUCIBILITY_TEST",
  extraArguments = [],
} = {}) {
  return createRewardGuardedBuildRecipe({
    sourceRootDirectory: context.sourceRoot,
    executablePath: process.execPath,
    arguments: ["--input-type=module", "-e", buildSource, context.artifactRoot, ...extraArguments],
    workingDirectoryRelative: ".",
    environment: { IAT_B3_BUILD_MODE: environmentMode },
    configurationPaths: ["build-config.json"],
    timeoutMs: 30_000,
  });
}

function executeAgain(recipe, context) {
  if (existsSync(context.artifactRoot)) {
    rmSync(context.artifactRoot, { recursive: true, force: true });
  }
  return executeRewardGuardedBuildRecipe({
    recipe,
    artifactRootDirectory: context.artifactRoot,
  });
}

test("two independent fresh builds produce a narrow byte-equality receipt", (t) => {
  const context = fixture(t);
  const recipe = createRecipe(context);
  const first = executeAgain(recipe, context);
  const second = executeAgain(recipe, context);
  assert.notEqual(first, second);
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.equal(first.artifactSetSha256, second.artifactSetSha256);

  const comparison = compareIndependentRewardGuardedBuildReceipts({
    firstReceipt: first,
    secondReceipt: second,
  });
  assert.equal(comparison.schema, REWARD_GUARDED_BUILD_REPRODUCIBILITY_SCHEMA);
  assert.equal(comparison.status, REWARD_GUARDED_BUILD_REPRODUCIBILITY_STATUS);
  assert.equal(comparison.firstReceiptSha256, first.receiptSha256);
  assert.equal(comparison.secondReceiptSha256, second.receiptSha256);
  assert.equal(comparison.artifactSetSha256, first.artifactSetSha256);
  assert.equal(comparison.artifactFileCount, first.artifactFileCount);
  assert.equal(comparison.artifactByteCount, first.artifactByteCount);
  assert.equal(comparison.independentFreshBuildExecutionsVerified, true);
  assert.equal(comparison.sameCurrentSourceRevalidated, true);
  assert.equal(comparison.sameCurrentConfigurationRevalidated, true);
  assert.equal(comparison.sameCurrentToolchainRevalidated, true);
  assert.equal(comparison.identicalRecipeBindingVerified, true);
  assert.equal(comparison.identicalConfigurationBindingVerified, true);
  assert.equal(comparison.identicalToolchainBindingVerified, true);
  assert.equal(comparison.identicalArtifactByteInventoryVerified, true);
  assert.equal(comparison.identicalForbiddenMarkerSetVerified, true);
  assert.equal(comparison.dualFreshBuildArtifactEqualityVerified, true);
  assert.equal(comparison.semanticBuildProvenanceVerified, false);
  assert.equal(comparison.artifactBuiltFromBoundSourceVerified, false);
  assert.equal(comparison.reproducibleBuildVerified, false);
  assert.equal(comparison.runtimeConfinementVerified, false);
  assert.equal(comparison.providerAuthenticationVerified, false);
  assert.equal(comparison.rollbackProtectionVerified, false);
  assert.equal(comparison.materializedProjectionStateVerified, false);
  assert.equal(comparison.externalSideEffectsAuthorized, false);
  assert.equal(comparison.independentReviewAccepted, false);
  assert.equal(comparison.activationReady, false);
  assert.equal(comparison.mainnetStatus, REWARD_GUARDED_BUILD_REPRODUCIBILITY_MAINNET_STATUS);
  assert.equal(comparison.mainnetStatus, "HOLD");
  assert.equal(validateRewardGuardedBuildReproducibilityReceipt(comparison), comparison);
  const copy = structuredClone(comparison);
  assert.equal(validateRewardGuardedBuildReproducibilityReceipt(copy), copy);
});

test("one byte of deterministic cross-run drift rejects equality", (t) => {
  const context = fixture(t);
  const statePath = join(context.directory, "one-byte-state.txt");
  const oneByteDriftBuild = `
    import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
    import { join } from "node:path";
    const root = process.argv[1];
    const state = process.argv[2];
    const prior = existsSync(state) ? readFileSync(state, "utf8") : "";
    const byte = prior === "first" ? "B" : "A";
    writeFileSync(state, "first");
    mkdirSync(join(root, "server"), { recursive: true });
    writeFileSync(join(root, "server", "index.js"), byte);
  `;
  const recipe = createRecipe(context, oneByteDriftBuild, { extraArguments: [statePath] });
  const first = executeAgain(recipe, context);
  const second = executeAgain(recipe, context);
  assert.equal(first.artifactFileCount, second.artifactFileCount);
  assert.equal(first.artifactByteCount, second.artifactByteCount);
  assert.notEqual(first.artifactSetSha256, second.artifactSetSha256);
  assert.throws(
    () => compareIndependentRewardGuardedBuildReceipts({
      firstReceipt: first,
      secondReceipt: second,
    }),
    /REWARD_GUARDED_REPRODUCIBILITY_ARTIFACT_DIGEST_MISMATCH/u,
  );
});

test("nondeterministic file cardinality rejects equality before digest comparison", (t) => {
  const context = fixture(t);
  const statePath = join(context.directory, "cardinality-state.txt");
  const cardinalityDriftBuild = `
    import { existsSync, mkdirSync, writeFileSync } from "node:fs";
    import { join } from "node:path";
    const root = process.argv[1];
    const state = process.argv[2];
    const second = existsSync(state);
    writeFileSync(state, "seen");
    mkdirSync(join(root, "server"), { recursive: true });
    writeFileSync(join(root, "server", "index.js"), "same");
    if (second) writeFileSync(join(root, "server", "extra.js"), "extra");
  `;
  const recipe = createRecipe(context, cardinalityDriftBuild, { extraArguments: [statePath] });
  const first = executeAgain(recipe, context);
  const second = executeAgain(recipe, context);
  assert.notEqual(first.artifactFileCount, second.artifactFileCount);
  assert.throws(
    () => compareIndependentRewardGuardedBuildReceipts({
      firstReceipt: first,
      secondReceipt: second,
    }),
    /REWARD_GUARDED_REPRODUCIBILITY_ARTIFACT_CARDINALITY_MISMATCH/u,
  );
});

test("same-execution, cloned-receipt, and different-recipe substitution fail closed", async (t) => {
  await t.test("same execution", (subtest) => {
    const context = fixture(subtest);
    const recipe = createRecipe(context);
    const receipt = executeAgain(recipe, context);
    assert.throws(
      () => compareIndependentRewardGuardedBuildReceipts({
        firstReceipt: receipt,
        secondReceipt: receipt,
      }),
      /REWARD_GUARDED_REPRODUCIBILITY_DISTINCT_RECEIPTS_REQUIRED/u,
    );
  });
  await t.test("serialized clone", (subtest) => {
    const context = fixture(subtest);
    const recipe = createRecipe(context);
    const first = executeAgain(recipe, context);
    const second = executeAgain(recipe, context);
    assert.throws(
      () => compareIndependentRewardGuardedBuildReceipts({
        firstReceipt: first,
        secondReceipt: structuredClone(second),
      }),
      /REWARD_GUARDED_BUILD_EXECUTED_RECEIPT_REQUIRED/u,
    );
  });
  await t.test("different recipe", (subtest) => {
    const context = fixture(subtest);
    const firstRecipe = createRecipe(context);
    const first = executeAgain(firstRecipe, context);
    const secondRecipe = createRecipe(context, DETERMINISTIC_BUILD, {
      environmentMode: "ALTERNATE_RECIPE",
    });
    const second = executeAgain(secondRecipe, context);
    assert.equal(first.artifactSetSha256, second.artifactSetSha256);
    assert.throws(
      () => compareIndependentRewardGuardedBuildReceipts({
        firstReceipt: first,
        secondReceipt: second,
      }),
      /REWARD_GUARDED_REPRODUCIBILITY_RECIPE_MISMATCH/u,
    );
  });
});

test("current source drift invalidates two otherwise identical build receipts", (t) => {
  const context = fixture(t);
  const recipe = createRecipe(context);
  const first = executeAgain(recipe, context);
  const second = executeAgain(recipe, context);
  mkdirSync(join(context.sourceRoot, "worker"), { recursive: true });
  writeFileSync(join(context.sourceRoot, "worker", "after-build.mjs"), "export const drift = true;");
  assert.throws(
    () => compareIndependentRewardGuardedBuildReceipts({
      firstReceipt: first,
      secondReceipt: second,
    }),
    /REWARD_GUARDED_REPRODUCIBILITY_CURRENT_SOURCE_DRIFT_HOLD/u,
  );
});

test("current configuration drift invalidates two otherwise identical build receipts", (t) => {
  const context = fixture(t);
  const recipe = createRecipe(context);
  const first = executeAgain(recipe, context);
  const second = executeAgain(recipe, context);
  writeFileSync(join(context.sourceRoot, "build-config.json"), "{\"mode\":\"post-build-drift\"}\n");
  assert.throws(
    () => compareIndependentRewardGuardedBuildReceipts({
      firstReceipt: first,
      secondReceipt: second,
    }),
    /REWARD_GUARDED_REPRODUCIBILITY_CURRENT_CONFIGURATION_DRIFT_HOLD/u,
  );
});

test("comparison receipt digest and truth flags reject serialized tamper", (t) => {
  const context = fixture(t);
  const recipe = createRecipe(context);
  const first = executeAgain(recipe, context);
  const second = executeAgain(recipe, context);
  const comparison = compareIndependentRewardGuardedBuildReceipts({
    firstReceipt: first,
    secondReceipt: second,
  });
  for (const mutate of [
    (copy) => { copy.artifactSetSha256 = "ff".repeat(32); },
    (copy) => { copy.reproducibleBuildVerified = true; },
    (copy) => { copy.runtimeConfinementVerified = true; },
    (copy) => { copy.independentFreshBuildExecutionsVerified = false; },
    (copy) => { copy.sameCurrentToolchainRevalidated = false; },
  ]) {
    const copy = structuredClone(comparison);
    mutate(copy);
    assert.throws(
      () => validateRewardGuardedBuildReproducibilityReceipt(copy),
      /INVALID_REWARD|DIGEST_MISMATCH/u,
    );
  }
});
