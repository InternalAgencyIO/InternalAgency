import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  NATIVE_WSL_BUILD_BACKEND,
  NATIVE_WSL_BUILD_HOLD,
  NATIVE_WSL_BUILD_RECEIPT_SCHEMA,
  NATIVE_WSL_EXECUTION_MODE,
  NATIVE_WSL_FUTURE_EXECUTION_CONTRACT,
  NATIVE_WSL_PINNED_TOOLCHAIN_POLICY,
  assertNativeWslObservationOnlyBuildDisabled,
  createNativeWslBuildInvocation,
  createNativeWslBuildPreflight,
  createNativeWslBuildReceipt,
  executeNativeWslFreshBuild,
  observeNativeWslPinnedToolchain,
  selectReproducibleBuildBackend,
  validateNativeWslBuildReceipt,
  verifyNativeCargoLockArchiveClosure,
} from "../scripts/iat-b3-native-wsl-build-backend.mjs";
import {
  projectCombinedLawBuildReceiptForLocalRehearsal,
  projectEconomyBuildReceiptForLocalRehearsal,
} from "../scripts/assess-iat-b3-local-rehearsal-readiness.mjs";
import {
  runCombinedLawNativeWslReproducibleBuild,
} from "../scripts/run-iat-b3-combined-law-reproducible-build.mjs";
import {
  runEconomyNativeWslReproducibleBuild,
} from "../scripts/run-iat-b3-economy-reproducible-build.mjs";
import {
  PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
} from "../scripts/validate-iat-b3-identity-freeze.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const HEAD = "1".repeat(40);
const TREE = "2".repeat(40);
const SHA = (digit) => digit.repeat(64);
const GENERATED_AT = "2033-05-18T03:33:20.000Z";
const OBSERVATION_ONLY = /OBSERVATION_PREFLIGHT_ONLY_IMMUTABLE_ROOTFS_NOT_PROVEN_HOLD/u;

test("native WSL paths are runtime-home-relative without a source-coded username", () => {
  const source = readFileSync(
    join(SITE_ROOT, "scripts", "iat-b3-native-wsl-build-backend.mjs"),
    "utf8",
  );
  assert.doesNotMatch(source, /\/home\/a(?:\/|\b)/u);
  for (const key of [
    "node",
    "rustToolchainRoot",
    "rustc",
    "cargo",
    "cargoBuildSbf",
    "solanaReleaseRoot",
    "platformToolsRoot",
    "registryCacheRoot",
    "registryIndexRoot",
  ]) {
    assert.ok(
      NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.paths[key].startsWith(homedir()),
      `${key} must be derived from the observed runtime home`,
    );
  }
  assert.equal(NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.buildExecutionPermitted, false);
  assert.equal(NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.buildReceiptCreationPermitted, false);
  assert.equal(NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.buildReceiptAcceptancePermitted, false);
});

function dependencyClosure() {
  return {
    lockSha256: SHA("3"),
    sourcePolicy: "CARGO_LOCK_REGISTRY_CHECKSUMS_AND_FRESH_ARCHIVE_EXTRACTION",
    packageCount: 229,
    packagesSha256: SHA("4"),
    bindingSha256: SHA("5"),
  };
}

test("native WSL preflight remains HOLD after every observational prerequisite passes", () => {
  const held = createNativeWslBuildPreflight({
    generatedAt: GENERATED_AT,
    programKind: "LAW",
    source: {
      declaredHeadSha: HEAD,
      observedHeadSha: HEAD,
      observedTreeSha: TREE,
      statusPorcelain: "",
    },
    runnerBinding: {
      executedRunnerSha256: SHA("6"),
      committedRunnerSha256: SHA("6"),
    },
    identityReady: true,
    sourceClosureReady: true,
    toolchainObservation: { backend: NATIVE_WSL_BUILD_BACKEND },
    dependencyClosure: dependencyClosure(),
    disk: { path: "/tmp", freeBytes: 30 * 1024 ** 3 },
    recipe: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
    minimumFreeBytes: 24 * 1024 ** 3,
  });
  assert.equal(held.status, NATIVE_WSL_BUILD_HOLD);
  assert.equal(held.exitCode, 2);
  assert.equal(held.executionMode, NATIVE_WSL_EXECUTION_MODE);
  assert.deepEqual(held.blockers, ["HERMETIC_IMMUTABLE_ROOTFS_DIRECTLY_PROVEN"]);
  assert.equal(held.safety.observationPreflightOnly, true);
  assert.equal(held.safety.buildExecutionPermitted, false);
  assert.equal(held.safety.buildReceiptCreationPermitted, false);
  assert.equal(held.safety.buildReceiptAcceptancePermitted, false);
});

test("native WSL cannot create an invocation, execute, or create/accept a receipt", () => {
  const buildRoot = mkdtempSync(join(tmpdir(), "iat-b3-native-disabled-test-"));
  try {
    assert.throws(assertNativeWslObservationOnlyBuildDisabled, OBSERVATION_ONLY);
    assert.throws(() => createNativeWslBuildInvocation({
      sourceRoot: SITE_ROOT,
      buildRoot,
      recipeArguments: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments,
      identityEnvironment: {
        IAT_B3_PRODUCTION_LAW_PROGRAM_ID: "law",
        IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: "economy",
        IAT_B3_PRODUCTION_CANONICAL_MINT: "mint",
      },
      declaredHeadSha: HEAD,
    }), OBSERVATION_ONLY);
    assert.deepEqual(readdirSync(buildRoot), []);
    assert.throws(() => executeNativeWslFreshBuild({}), OBSERVATION_ONLY);
    assert.throws(() => createNativeWslBuildReceipt({}), OBSERVATION_ONLY);
    assert.throws(() => validateNativeWslBuildReceipt({}, {}), OBSERVATION_ONLY);
    assert.throws(() => runCombinedLawNativeWslReproducibleBuild({}), OBSERVATION_ONLY);
    assert.throws(() => runEconomyNativeWslReproducibleBuild({}), OBSERVATION_ONLY);
  } finally {
    rmSync(buildRoot, { recursive: true, force: true });
  }
});

test("R01 rejects every synthetic native WSL law or economy receipt", () => {
  const synthetic = {
    schema: NATIVE_WSL_BUILD_RECEIPT_SCHEMA,
    status: "EXACT_SOURCE_DUAL_FRESH_SBF_BYTE_EQUALITY_VERIFIED",
    programKind: "LAW",
  };
  assert.throws(
    () => projectCombinedLawBuildReceiptForLocalRehearsal(synthetic),
    /INVALID_IAT_B3_COMBINED_LAW_BUILD_RECEIPT/u,
  );
  assert.throws(
    () => projectEconomyBuildReceiptForLocalRehearsal({
      ...synthetic,
      programKind: "ECONOMY",
    }),
    /INVALID_IAT_B3_ECONOMY_BUILD_RECEIPT/u,
  );
});

test("future native enablement requires recursive key rejection and preserved raw logs", () => {
  assert.equal(NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.mode, NATIVE_WSL_EXECUTION_MODE);
  assert.equal(NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.buildExecutionPermitted, false);
  assert.equal(
    NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.requiredBeforeEnablement
      .recursiveWholeBuildRootKeyMaterialRejection,
    true,
  );
  assert.equal(
    NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.requiredBeforeEnablement
      .preservedRawStdoutAndStderrPerRun,
    true,
  );
  assert.equal(
    NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.requiredBeforeEnablement
      .preservedLogSha256AndByteLengthPerRun,
    true,
  );
});

test("native WSL observation still verifies installed tools and Cargo archives without building", {
  skip: process.platform !== "linux" || process.arch !== "x64",
}, () => {
  const observation = observeNativeWslPinnedToolchain();
  assert.equal(observation.backend, NATIVE_WSL_BUILD_BACKEND);
  assert.equal(observation.versions.node, "v24.10.0");
  const closure = verifyNativeCargoLockArchiveClosure(
    readFileSync(join(SITE_ROOT, "Cargo.lock")),
  );
  assert.equal(closure.packageCount, 229);
});

test("backend selection defaults to Docker and rejects unbound alternatives", () => {
  assert.equal(selectReproducibleBuildBackend({}), "PINNED_OFFLINE_CONTAINER");
  assert.equal(selectReproducibleBuildBackend({
    IAT_B3_REPRODUCIBLE_BUILD_BACKEND: NATIVE_WSL_BUILD_BACKEND,
  }), NATIVE_WSL_BUILD_BACKEND);
  assert.throws(() => selectReproducibleBuildBackend({
    IAT_B3_REPRODUCIBLE_BUILD_BACKEND: "HOST_CARGO",
  }), /BACKEND_INVALID/u);
});
