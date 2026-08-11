import assert from "node:assert/strict";
import {
  copyFileSync,
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
  REWARD_GUARDED_BUILD_PROVENANCE_MAINNET_STATUS,
  REWARD_GUARDED_BUILD_PROVENANCE_SCHEMA,
  REWARD_GUARDED_BUILD_PROVENANCE_STATUS,
  REWARD_GUARDED_BUILD_RECIPE_SCHEMA,
  createRewardGuardedBuildRecipe,
  executeRewardGuardedBuildRecipe,
  validateRewardGuardedBuildProvenanceReceipt,
  validateRewardGuardedBuildToolchainObservation,
} from "../programs/iat_b3_reference/reward-guarded-build-provenance.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const INVENTORIED_SOURCE_PATHS = Object.freeze([
  "programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs",
  "programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs",
  "programs/iat_b3_reference/reward-consumer-gate.mjs",
  "programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs",
  "programs/iat_b3_reference/reward-persistence-cas.mjs",
  "programs/iat_b3_reference/reward-persistence-checkpoint.mjs",
  "scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs",
  "scripts/validate-iat-b3-x-social-evidence-provider-readiness.mjs",
]);
const CLEAN_BUILD_SOURCE = `
  import { mkdirSync, writeFileSync } from "node:fs";
  import { join } from "node:path";
  const root = process.argv[1];
  mkdirSync(join(root, "server"), { recursive: true });
  writeFileSync(join(root, "server", "index.js"), "export const status = 'hold';");
  console.log("fresh-build");
`;

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-build-provenance-"));
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
    `${JSON.stringify({ schema: "iat-b3-test-build-config/v1", mode: "hold" })}\n`,
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, sourceRoot, artifactRoot };
}

function recipe(context, buildSource = CLEAN_BUILD_SOURCE, extraArguments = []) {
  return createRewardGuardedBuildRecipe({
    sourceRootDirectory: context.sourceRoot,
    executablePath: process.execPath,
    arguments: ["--input-type=module", "-e", buildSource, context.artifactRoot, ...extraArguments],
    workingDirectoryRelative: ".",
    environment: { IAT_B3_BUILD_MODE: "PROVENANCE_TEST" },
    configurationPaths: ["build-config.json"],
    timeoutMs: 30_000,
  });
}

test("fresh observed build binds exact source, command, toolchain, environment, config, and artifact", (t) => {
  const context = fixture(t);
  const frozenRecipe = recipe(context);
  assert.equal(frozenRecipe.schema, REWARD_GUARDED_BUILD_RECIPE_SCHEMA);
  assert.equal(frozenRecipe.status, REWARD_GUARDED_BUILD_PROVENANCE_STATUS);
  assert.equal(frozenRecipe.freshArtifactDirectoryRequired, true);
  assert.equal(frozenRecipe.runtimeConfinementVerified, false);
  assert.equal(frozenRecipe.activationReady, false);
  assert.equal(frozenRecipe.mainnetStatus, "HOLD");

  const receipt = executeRewardGuardedBuildRecipe({
    recipe: frozenRecipe,
    artifactRootDirectory: context.artifactRoot,
  });
  assert.equal(receipt.schema, REWARD_GUARDED_BUILD_PROVENANCE_SCHEMA);
  assert.equal(receipt.status, REWARD_GUARDED_BUILD_PROVENANCE_STATUS);
  assert.equal(receipt.recipe, frozenRecipe);
  assert.equal(receipt.exitCode, 0);
  assert.equal(receipt.artifactFileCount, 1);
  assert.equal(receipt.artifactByteCount > 0n, true);
  assert.equal(receipt.freshArtifactDirectoryAbsenceVerified, true);
  assert.equal(receipt.observedBuildCommandExecuted, true);
  assert.equal(receipt.sourceStableAcrossBuildVerified, true);
  assert.equal(receipt.configurationStableAcrossBuildVerified, true);
  assert.equal(receipt.freshArtifactInventoryVerified, true);
  assert.equal(receipt.processObservedSourceToArtifactBindingVerified, true);
  assert.equal(receipt.artifactBuiltFromBoundSourceVerified, false);
  assert.equal(receipt.reproducibleBuildVerified, false);
  assert.equal(receipt.runtimeConfinementVerified, false);
  assert.equal(receipt.providerAuthenticationVerified, false);
  assert.equal(receipt.rollbackProtectionVerified, false);
  assert.equal(receipt.materializedProjectionStateVerified, false);
  assert.equal(receipt.externalSideEffectsAuthorized, false);
  assert.equal(receipt.independentReviewAccepted, false);
  assert.equal(receipt.activationReady, false);
  assert.equal(receipt.mainnetStatus, REWARD_GUARDED_BUILD_PROVENANCE_MAINNET_STATUS);
  assert.equal(receipt.mainnetStatus, "HOLD");
  assert.match(receipt.receiptSha256, /^[0-9a-f]{64}$/u);
  assert.equal(validateRewardGuardedBuildProvenanceReceipt(receipt), receipt);
  const serializedCopy = structuredClone(receipt);
  assert.equal(validateRewardGuardedBuildProvenanceReceipt(serializedCopy), serializedCopy);
});

test("a pre-existing artifact directory is stale and the build command never runs", (t) => {
  const context = fixture(t);
  const frozenRecipe = recipe(context);
  mkdirSync(context.artifactRoot, { recursive: true });
  writeFileSync(join(context.artifactRoot, "stale.js"), "stale");
  assert.throws(
    () => executeRewardGuardedBuildRecipe({
      recipe: frozenRecipe,
      artifactRootDirectory: context.artifactRoot,
    }),
    /REWARD_GUARDED_BUILD_STALE_ARTIFACT_ROOT_PREEXISTS_HOLD/u,
  );
});

test("source or configuration drift before execution fails before the child process", async (t) => {
  await t.test("source", (subtest) => {
    const context = fixture(subtest);
    const frozenRecipe = recipe(context);
    mkdirSync(join(context.sourceRoot, "worker"), { recursive: true });
    writeFileSync(join(context.sourceRoot, "worker", "drift.mjs"), "export const drift = true;");
    assert.throws(
      () => executeRewardGuardedBuildRecipe({
        recipe: frozenRecipe,
        artifactRootDirectory: context.artifactRoot,
      }),
      /REWARD_GUARDED_BUILD_SOURCE_DRIFT_BEFORE_EXECUTION_HOLD/u,
    );
  });
  await t.test("configuration", (subtest) => {
    const context = fixture(subtest);
    const frozenRecipe = recipe(context);
    writeFileSync(join(context.sourceRoot, "build-config.json"), "{\"mode\":\"changed\"}\n");
    assert.throws(
      () => executeRewardGuardedBuildRecipe({
        recipe: frozenRecipe,
        artifactRootDirectory: context.artifactRoot,
      }),
      /REWARD_GUARDED_BUILD_CONFIGURATION_DRIFT_BEFORE_EXECUTION_HOLD/u,
    );
  });
});

test("source drift during the observed build and forbidden artifact bytes both fail", async (t) => {
  await t.test("source drift during build", (subtest) => {
    const context = fixture(subtest);
    const driftSource = `
      import { mkdirSync, writeFileSync } from "node:fs";
      import { join } from "node:path";
      const artifactRoot = process.argv[1];
      const sourceRoot = process.argv[2];
      mkdirSync(join(artifactRoot, "server"), { recursive: true });
      writeFileSync(join(artifactRoot, "server", "index.js"), "clean");
      mkdirSync(join(sourceRoot, "worker"), { recursive: true });
      writeFileSync(join(sourceRoot, "worker", "during.mjs"), "export const drift = true;");
    `;
    const frozenRecipe = recipe(context, driftSource, [context.sourceRoot]);
    assert.throws(
      () => executeRewardGuardedBuildRecipe({
        recipe: frozenRecipe,
        artifactRootDirectory: context.artifactRoot,
      }),
      /REWARD_GUARDED_BUILD_SOURCE_DRIFT_DURING_EXECUTION_HOLD/u,
    );
  });
  await t.test("artifact bypass surface", (subtest) => {
    const context = fixture(subtest);
    const hostileBuild = `
      import { mkdirSync, writeFileSync } from "node:fs";
      import { join } from "node:path";
      const root = process.argv[1];
      mkdirSync(join(root, "server"), { recursive: true });
      writeFileSync(join(root, "server", "index.js"), "finalizeRewardCapacityRoundCas(input)");
    `;
    const frozenRecipe = recipe(context, hostileBuild);
    assert.throws(
      () => executeRewardGuardedBuildRecipe({
        recipe: frozenRecipe,
        artifactRootDirectory: context.artifactRoot,
      }),
      /REWARD_GUARDED_ARTIFACT_FORBIDDEN_SURFACE/u,
    );
  });
});

test("toolchain observations and serialized receipt tamper fail closed", (t) => {
  const context = fixture(t);
  const frozenRecipe = recipe(context);
  const observation = {
    nodeVersion: frozenRecipe.nodeVersion,
    platform: frozenRecipe.platform,
    architecture: frozenRecipe.architecture,
    executableSha256: frozenRecipe.executableSha256,
  };
  assert.equal(validateRewardGuardedBuildToolchainObservation({
    recipe: frozenRecipe,
    observation,
  }), observation);
  assert.throws(
    () => validateRewardGuardedBuildToolchainObservation({
      recipe: frozenRecipe,
      observation: { ...observation, nodeVersion: "v0.0.0-drift" },
    }),
    /REWARD_GUARDED_BUILD_TOOLCHAIN_DRIFT_HOLD/u,
  );

  const receipt = executeRewardGuardedBuildRecipe({
    recipe: frozenRecipe,
    artifactRootDirectory: context.artifactRoot,
  });
  for (const mutate of [
    (copy) => { copy.artifactSetSha256 = "ff".repeat(32); },
    (copy) => { copy.runtimeConfinementVerified = true; },
    (copy) => { copy.recipe.arguments.push("--unreviewed"); },
  ]) {
    const copy = structuredClone(receipt);
    mutate(copy);
    assert.throws(
      () => validateRewardGuardedBuildProvenanceReceipt(copy),
      /INVALID_REWARD|DIGEST_MISMATCH/u,
    );
  }
});

test("nonzero commands and commands that omit the fresh artifact root cannot produce receipts", async (t) => {
  await t.test("nonzero", (subtest) => {
    const context = fixture(subtest);
    const frozenRecipe = recipe(context, "process.exit(7);");
    assert.throws(
      () => executeRewardGuardedBuildRecipe({
        recipe: frozenRecipe,
        artifactRootDirectory: context.artifactRoot,
      }),
      /REWARD_GUARDED_BUILD_COMMAND_EXIT_7/u,
    );
  });
  await t.test("missing artifact", (subtest) => {
    const context = fixture(subtest);
    const frozenRecipe = recipe(context, "console.log('no artifact');");
    assert.throws(
      () => executeRewardGuardedBuildRecipe({
        recipe: frozenRecipe,
        artifactRootDirectory: context.artifactRoot,
      }),
      /REWARD_GUARDED_BUILD_FRESH_ARTIFACT_ROOT_NOT_CREATED/u,
    );
  });
});
