import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  IAT_V2_ATTENDED_MINIMUM_NODE_VERSION,
  IAT_V2_ATTENDED_PROHIBITED_ENVIRONMENT_NAMES,
  IatV2AttendedEnvironmentError,
  IatV2AttendedNodeRuntimeError,
  assertIatV2AttendedEnvironment,
  assertIatV2AttendedNodeRuntime,
  isIatV2AttendedNodeRuntimeSupported,
  parseIatV2NodeVersion,
} from "../scripts/lib/iat-v2-attended-node-runtime.mjs";

test("attended Node boundary rejects loader, shell, module, and Git environment injection", () => {
  assert.deepEqual(IAT_V2_ATTENDED_PROHIBITED_ENVIRONMENT_NAMES, [
    "BASH_ENV",
    "ENV",
    "LD_LIBRARY_PATH",
    "LD_PRELOAD",
    "NODE_OPTIONS",
    "NODE_PATH",
  ]);
  assert.deepEqual(assertIatV2AttendedEnvironment({ HOME: "/home/a", PATH: "/usr/bin:/bin" }), {
    clean: true,
    prohibitedNames: [],
  });
  for (const name of [...IAT_V2_ATTENDED_PROHIBITED_ENVIRONMENT_NAMES, "GIT_DIR", "GIT_WORK_TREE"]) {
    assert.throws(
      () => assertIatV2AttendedEnvironment({ [name]: "attacker-controlled" }),
      (error) => error instanceof IatV2AttendedEnvironmentError
        && error.code === "IAT_V2_ATTENDED_ENVIRONMENT_HOLD"
        && error.prohibitedNames.includes(name),
      name,
    );
  }
});

test("attended Node runtime gate enforces the exact 22.13.0 boundary", () => {
  assert.equal(IAT_V2_ATTENDED_MINIMUM_NODE_VERSION, "22.13.0");
  for (const rejected of [
    "18.20.5",
    "22.12.99",
    "v22.12.0",
    "22.13",
    "22.13.0-nightly",
    "not-a-version",
    "022.13.0",
    null,
  ]) {
    assert.equal(isIatV2AttendedNodeRuntimeSupported(rejected), false, `${rejected} must be rejected`);
    assert.throws(
      () => assertIatV2AttendedNodeRuntime(rejected),
      (error) => error instanceof IatV2AttendedNodeRuntimeError
        && error.code === "IAT_V2_ATTENDED_NODE_RUNTIME_HOLD"
        && error.minimumVersion === "22.13.0",
    );
  }
  for (const accepted of ["22.13.0", "v22.13.0", "22.13.1", "23.0.0", "24.7.0"]) {
    assert.equal(isIatV2AttendedNodeRuntimeSupported(accepted), true, `${accepted} must be accepted`);
    assert.equal(assertIatV2AttendedNodeRuntime(accepted).observedVersion, accepted);
  }
  assert.deepEqual(parseIatV2NodeVersion("v22.13.0"), { major: 22, minor: 13, patch: 0 });
});

test("attended CLIs evaluate the dependency-free runtime gate before external modules", () => {
  for (const path of [
    "scripts/iat-v2-devnet-buffer-preflight.mjs",
    "scripts/finalize-iat-v2-current-source-devnet-evidence.mjs",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(
      source,
      /^#!\/usr\/bin\/env node\r?\n\r?\nimport "\.\/lib\/iat-v2-attended-node-runtime\.mjs";/u,
    );
    const gate = source.indexOf('import "./lib/iat-v2-attended-node-runtime.mjs";');
    const external = source.indexOf('await import("@solana/web3.js")');
    assert.ok(gate >= 0 && external > gate, `${path} must gate before Solana loads`);
    assert.doesNotMatch(source, /from "@solana\/web3\.js"/u);
  }

  const gateSource = readFileSync("scripts/lib/iat-v2-attended-node-runtime.mjs", "utf8");
  assert.doesNotMatch(gateSource, /^import\s/mu);
  assert.doesNotMatch(gateSource, /fetch\(|Connection|PublicKey|readFile|writeFile|@solana/u);
});

test("admin console lifecycle and operator runbook require the same reviewed runtime", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const runbook = readFileSync("launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md", "utf8");
  assert.equal(packageJson.engines.node, ">=22.13.0");
  assert.equal(
    packageJson.scripts["preiat:v2-admin"],
    "node scripts/lib/iat-v2-attended-node-runtime.mjs",
  );
  assert.match(runbook, /\$NodeExe = 'C:\\ABSOLUTE\\PATH\\TO\\REVIEWED\\node\.exe'/u);
  assert.match(runbook, /\$NpmCli = 'C:\\ABSOLUTE\\PATH\\TO\\REVIEWED\\npm-cli\.js'/u);
  assert.match(runbook, /Node\.js `>=22\.13\.0`/u);
  assert.match(runbook, /& \$NodeExe --version/u);
  assert.match(runbook, /& \$NodeExe \$NpmCli run iat:v2-admin/u);
  assert.match(runbook, /& \$NodeExe scripts\/iat-v2-devnet-buffer-preflight\.mjs verify/u);
  assert.match(runbook, /& \$NodeExe scripts\/iat-v2-devnet-buffer-preflight\.mjs capacity/u);
  assert.match(runbook, /& \$NodeExe scripts\/finalize-iat-v2-current-source-devnet-evidence\.mjs/u);
  assert.doesNotMatch(runbook, /^node scripts\/(?:iat-v2-devnet-buffer-preflight|finalize-iat-v2-current-source-devnet-evidence)\.mjs/mu);
  assert.doesNotMatch(runbook, /^npm(?:\.cmd)? run iat:v2-admin/mu);
});
