import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  NATIVE_WSL_BUILD_HOLD,
  NATIVE_WSL_EXECUTION_MODE,
  NATIVE_WSL_FUTURE_EXECUTION_CONTRACT,
  assertNativeWslObservationOnlyBuildDisabled,
  createNativeWslBuildInvocation,
  createNativeWslBuildPreflight,
  createNativeWslBuildReceipt,
  executeNativeWslFreshBuild,
  validateNativeWslBuildReceipt,
} from "../scripts/iat-b3-native-wsl-build-backend.mjs";
import {
  runCombinedLawNativeWslReproducibleBuild,
} from "../scripts/run-iat-b3-combined-law-reproducible-build.mjs";
import {
  runEconomyNativeWslReproducibleBuild,
} from "../scripts/run-iat-b3-economy-reproducible-build.mjs";

const DISABLED = /OBSERVATION_PREFLIGHT_ONLY_IMMUTABLE_ROOTFS_NOT_PROVEN_HOLD/u;

test("native WSL contract is immutable observation-only HOLD", () => {
  assert.equal(NATIVE_WSL_EXECUTION_MODE, "OBSERVATION_PREFLIGHT_ONLY");
  assert.equal(NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.mode, NATIVE_WSL_EXECUTION_MODE);
  assert.equal(NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.buildExecutionPermitted, false);
  assert.equal(NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.buildReceiptCreationPermitted, false);
  assert.equal(NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.buildReceiptAcceptancePermitted, false);
  const preflight = createNativeWslBuildPreflight({});
  assert.equal(preflight.status, NATIVE_WSL_BUILD_HOLD);
  assert.equal(preflight.exitCode, 2);
  assert.equal(preflight.buildExecuted, false);
  assert.equal(preflight.safety.buildExecutionPermitted, false);
  assert.equal(preflight.safety.buildReceiptCreationPermitted, false);
  assert.equal(preflight.safety.buildReceiptAcceptancePermitted, false);
  assert.equal(preflight.safety.artifactCreated, false);
  assert.equal(preflight.safety.networkUsed, false);
  assert.equal(preflight.safety.rpcUsed, false);
  assert.equal(preflight.safety.signing, false);
  assert.equal(preflight.safety.deployment, false);
  assert.equal(preflight.safety.mainnetStatus, "HOLD");
});

test("every native WSL execution and receipt surface throws before side effects", () => {
  const buildRoot = mkdtempSync(join(tmpdir(), "iat-b3-native-wsl-ci-disabled-"));
  try {
    const calls = [
      () => assertNativeWslObservationOnlyBuildDisabled(),
      () => createNativeWslBuildInvocation({
        sourceRoot: buildRoot,
        buildRoot,
        recipeArguments: ["--offline", "--skip-tools-install"],
        identityEnvironment: {
          IAT_B3_PRODUCTION_LAW_PROGRAM_ID: "unread",
          IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: "unread",
          IAT_B3_PRODUCTION_CANONICAL_MINT: "unread",
        },
        declaredHeadSha: "1".repeat(40),
      }),
      () => executeNativeWslFreshBuild({}),
      () => createNativeWslBuildReceipt({}),
      () => validateNativeWslBuildReceipt({}, {}),
      () => runCombinedLawNativeWslReproducibleBuild({}),
      () => runEconomyNativeWslReproducibleBuild({}),
    ];
    for (const call of calls) assert.throws(call, DISABLED);
    assert.deepEqual(readdirSync(buildRoot), []);
  } finally {
    rmSync(buildRoot, { recursive: true, force: true });
  }
});
