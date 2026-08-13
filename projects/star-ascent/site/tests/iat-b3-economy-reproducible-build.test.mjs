import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMBINED_LAW_BUILD_DISK_BUDGET,
  COMBINED_LAW_LFS_POLICY,
  COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
  COMBINED_LAW_SUBMODULE_POLICY,
  PINNED_COMBINED_LAW_BUILD_CONTAINER,
} from "../scripts/run-iat-b3-combined-law-reproducible-build.mjs";
import {
  ECONOMY_BUILD_PREFLIGHT_HOLD,
  ECONOMY_BUILD_PREFLIGHT_READY,
  ECONOMY_BUILD_RECEIPT_SCHEMA,
  ECONOMY_BUILD_RECEIPT_STATUS,
  ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE,
  ECONOMY_PRODUCTION_FEATURE,
  ECONOMY_SBF_BUILD_RECIPE,
  assertEconomyBuildRecipe,
  createEconomyBuildPreflight,
  createEconomyBuildReceipt,
  createEconomyDockerBuildArguments,
  inspectEconomyProductionSourceClosure,
  observeEconomyBuildPreflight,
  runEconomyReproducibleBuild,
  validateEconomyBuildPreflight,
  validateEconomyBuildReceipt,
} from "../scripts/run-iat-b3-economy-reproducible-build.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT_PATH = resolve(SITE_ROOT, "scripts/run-iat-b3-economy-reproducible-build.mjs");
const HEAD = "1".repeat(40);
const TREE = "2".repeat(40);
const GENERATED_AT = "2033-05-18T03:33:20.000Z";
const RUNNER_SHA256 = "3".repeat(64);
const TOOLCHAIN = Object.freeze({
  rustc: "rustc 1.97.1 (8bab26f4f 2026-07-14)",
  cargo: "cargo 1.97.1 (c980f4866 2026-06-30)",
  cargoBuildSbf: "solana-cargo-build-sbf 3.1.10",
});
const CONTAINER = Object.freeze({
  ...PINNED_COMBINED_LAW_BUILD_CONTAINER,
  localImageId: `sha256:${"4".repeat(64)}`,
});
const IDENTITY_OBSERVATION = Object.freeze({
  ready: true,
  manifestSha256: "5".repeat(64),
  ownerPolicySha256: "6".repeat(64),
  environmentBindingSha256: "7".repeat(64),
  failure: null,
});
const RECEIPT_IDENTITY = Object.freeze({
  manifestPath: "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
  manifestSha256: IDENTITY_OBSERVATION.manifestSha256,
  ownerPolicyPath: "projects/star-ascent/site/docs/b3/iat-b3-owner-policy-freeze.v1.json",
  ownerPolicySha256: IDENTITY_OBSERVATION.ownerPolicySha256,
  environmentNames: [
    "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
    "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
    "IAT_B3_PRODUCTION_CANONICAL_MINT",
    "IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH",
  ],
  environmentBindingSha256: IDENTITY_OBSERVATION.environmentBindingSha256,
  canonicalManifestReady: true,
});

const sources = Object.freeze({
  cargoManifestSource: readFileSync(
    resolve(SITE_ROOT, "programs/iat_b3_economy/Cargo.toml"),
    "utf8",
  ),
  librarySource: readFileSync(
    resolve(SITE_ROOT, "programs/iat_b3_economy/src/lib.rs"),
    "utf8",
  ),
  entrypointSource: readFileSync(
    resolve(SITE_ROOT, "programs/iat_b3_economy/src/production_entrypoint.rs"),
    "utf8",
  ),
  buildScriptSource: readFileSync(
    resolve(SITE_ROOT, "programs/iat_b3_economy/build.rs"),
    "utf8",
  ),
});
const SOURCE_CLOSURE = inspectEconomyProductionSourceClosure(sources);

function temporaryDirectory(prefix) {
  return mkdtempSync(resolve(tmpdir(), prefix));
}

function runGit(repositoryRoot, arguments_) {
  const result = spawnSync("git", ["-C", repositoryRoot, ...arguments_], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function sourceObservations() {
  return Array.from({ length: 4 }, () => ({
    headSha: HEAD,
    treeSha: TREE,
    statusPorcelain: "",
  }));
}

function materializedSourceObservations() {
  return Array.from({ length: 4 }, () => ({
    schema: COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
    declaredHeadSha: HEAD,
    treeSha: TREE,
    mountedInputSha256: "8".repeat(64),
    fileCount: 10,
    byteLength: 1_024,
    lfsPointerCount: 0,
    ignoredWorktreeBytesIncluded: false,
    submodulePolicy: COMBINED_LAW_SUBMODULE_POLICY,
    lfsPolicy: COMBINED_LAW_LFS_POLICY,
  }));
}

function buildArtifact(bytes = Buffer.from("deterministic-production-economy-sbf"), log = "9") {
  return { fileName: "iat_b3_economy.so", bytes, logSha256: log.repeat(64) };
}

function preservedArtifact(bytes = Buffer.from("deterministic-production-economy-sbf")) {
  return {
    fileName: "iat_b3_economy.so",
    bytes,
    atomicNoOverwrite: true,
    readbackVerified: true,
  };
}

function createReceipt(overrides = {}) {
  return createEconomyBuildReceipt({
    generatedAt: GENERATED_AT,
    declaredHeadSha: HEAD,
    sourceObservations: sourceObservations(),
    materializedSourceObservations: materializedSourceObservations(),
    runnerBinding: {
      executedRunnerSha256: RUNNER_SHA256,
      committedRunnerSha256: RUNNER_SHA256,
    },
    sourceClosure: SOURCE_CLOSURE,
    identityBinding: { ...RECEIPT_IDENTITY },
    containerObservation: { ...CONTAINER },
    toolchainObservation: { ...TOOLCHAIN },
    firstArtifact: buildArtifact(undefined, "9"),
    secondArtifact: buildArtifact(undefined, "a"),
    preservedArtifact: preservedArtifact(),
    ...overrides,
  });
}

function readyPreflight(overrides = {}) {
  return createEconomyBuildPreflight({
    generatedAt: GENERATED_AT,
    declaredHeadSha: HEAD,
    sourceObservation: { headSha: HEAD, treeSha: TREE, statusPorcelain: "" },
    executedRunnerSha256: RUNNER_SHA256,
    committedRunnerSha256: RUNNER_SHA256,
    nodeVersion: "24.14.0",
    hostPlatform: "linux",
    hostArchitecture: "x64",
    identityObservation: { ...IDENTITY_OBSERVATION },
    sourceClosureObservation: { ready: true, result: SOURCE_CLOSURE, failure: null },
    containerObservation: { ...CONTAINER },
    toolchainObservation: { ...TOOLCHAIN },
    diskPath: "/var/tmp",
    diskFreeBytes: COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes,
    ...overrides,
  });
}

test("B02 freezes the production-only economy recipe and source closure", () => {
  assert.equal(assertEconomyBuildRecipe(), ECONOMY_SBF_BUILD_RECIPE);
  assert.equal(SOURCE_CLOSURE.productionFeature, ECONOMY_PRODUCTION_FEATURE);
  assert.equal(SOURCE_CLOSURE.forbiddenFeature, ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE);
  assert.ok(Object.values(SOURCE_CLOSURE.checks).every(Boolean));
  assert.deepEqual(
    ECONOMY_SBF_BUILD_RECIPE.arguments.slice(
      ECONOMY_SBF_BUILD_RECIPE.arguments.indexOf("--features"),
      ECONOMY_SBF_BUILD_RECIPE.arguments.indexOf("--features") + 2,
    ),
    ["--features", "runtime-production-entrypoint"],
  );
  assert.ok(!ECONOMY_SBF_BUILD_RECIPE.arguments.includes("sbf-preflight-entrypoint"));
  assert.throws(
    () => inspectEconomyProductionSourceClosure({
      ...sources,
      cargoManifestSource: sources.cargoManifestSource.replace(
        "runtime-production-entrypoint = [",
        "runtime-production-entrypoint = [\n    \"sbf-preflight-entrypoint\",",
      ),
    }),
    /PRODUCTION_SOURCE_CLOSURE_HOLD/u,
  );
  assert.throws(
    () => assertEconomyBuildRecipe({
      ...ECONOMY_SBF_BUILD_RECIPE,
      arguments: ECONOMY_SBF_BUILD_RECIPE.arguments.map((value) => (
        value === ECONOMY_PRODUCTION_FEATURE ? ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE : value
      )),
    }),
    /BUILD_RECIPE_DRIFT_HOLD|PRODUCTION_FEATURE_EXCLUSIVITY_HOLD/u,
  );
});

test("B02 preflight reaches READY only with every exact offline prerequisite", () => {
  const preflight = readyPreflight();
  assert.equal(preflight.status, ECONOMY_BUILD_PREFLIGHT_READY);
  assert.equal(preflight.exitCode, 0);
  assert.deepEqual(preflight.blockers, []);
  assert.equal(preflight.buildExecuted, false);
  assert.equal(preflight.safety.artifactCreated, false);
  assert.equal(preflight.safety.networkUsed, false);
  assert.equal(validateEconomyBuildPreflight(preflight), preflight);

  for (const [blocker, override] of [
    ["REPOSITORY_CLEAN_TRACKED_AND_UNTRACKED", {
      sourceObservation: { headSha: HEAD, treeSha: TREE, statusPorcelain: "?? dirt\0" },
    }],
    ["EXECUTED_RUNNER_MATCHES_DECLARED_HEAD", { committedRunnerSha256: "b".repeat(64) }],
    ["LINUX_AMD64_HOST", { hostPlatform: "win32" }],
    ["PRODUCTION_FOUR_INPUT_IDENTITY_BINDING", {
      identityObservation: { ...IDENTITY_OBSERVATION, ready: false },
    }],
    ["PRODUCTION_FEATURE_SOURCE_CLOSURE", {
      sourceClosureObservation: { ready: false, result: null, failure: "missing" },
    }],
    ["PINNED_CONTAINER_PRESENT", { containerObservation: null }],
    ["PINNED_CONTAINER_TOOLCHAIN", { toolchainObservation: null }],
    ["BUILD_VOLUME_MINIMUM_24_GIB_FREE", {
      diskFreeBytes: COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes - 1,
    }],
  ]) {
    const held = readyPreflight(override);
    assert.equal(held.status, ECONOMY_BUILD_PREFLIGHT_HOLD, blocker);
    assert.ok(held.blockers.includes(blocker), blocker);
    assert.equal(held.buildExecuted, false, blocker);
  }
});

test("B02 preflight rejects rehashed check and safety promotion tampering", () => {
  const checkTamper = structuredClone(readyPreflight());
  checkTamper.host.observedPlatform = "win32";
  const { preflightSha256: ignoredCheckDigest, ...checkCore } = checkTamper;
  assert.ok(ignoredCheckDigest);
  checkTamper.preflightSha256 = digest(checkCore);
  assert.throws(
    () => validateEconomyBuildPreflight(checkTamper),
    /PREFLIGHT_CHECK_SET_MISMATCH/u,
  );

  const safetyTamper = structuredClone(readyPreflight());
  safetyTamper.safety.deployment = true;
  const { preflightSha256: ignoredSafetyDigest, ...safetyCore } = safetyTamper;
  assert.ok(ignoredSafetyDigest);
  safetyTamper.preflightSha256 = digest(safetyCore);
  assert.throws(
    () => validateEconomyBuildPreflight(safetyTamper),
    /INVALID_IAT_B3_ECONOMY_BUILD_PREFLIGHT/u,
  );
});

test("B02 receipt proves exact dual fresh byte equality and retains Mainnet HOLD", () => {
  const receipt = createReceipt();
  assert.equal(receipt.schema, ECONOMY_BUILD_RECEIPT_SCHEMA);
  assert.equal(receipt.status, ECONOMY_BUILD_RECEIPT_STATUS);
  assert.equal(receipt.source.executedRunnerSha256, receipt.source.committedRunnerSha256);
  assert.equal(receipt.sourceClosure.productionFeature, "runtime-production-entrypoint");
  assert.equal(receipt.recipe.forbiddenFeature, "sbf-preflight-entrypoint");
  assert.ok(!receipt.recipe.arguments.includes("sbf-preflight-entrypoint"));
  assert.equal(receipt.artifact.firstBuildSha256, receipt.artifact.secondBuildSha256);
  assert.notEqual(receipt.artifact.firstBuildLogSha256, receipt.artifact.secondBuildLogSha256);
  assert.equal(receipt.safety.reproducibleBuildVerified, true);
  assert.equal(receipt.safety.productionCandidate, false);
  assert.equal(receipt.safety.mainnetStatus, ECONOMY_BUILD_PREFLIGHT_HOLD);
  assert.equal(validateEconomyBuildReceipt(receipt), receipt);
});

test("B02 receipt rejects byte, log, runner, feature, and safety drift", () => {
  assert.throws(
    () => createReceipt({ secondArtifact: buildArtifact(Buffer.from("different"), "a") }),
    /DUAL_BUILD_BYTE_MISMATCH_HOLD/u,
  );
  assert.throws(
    () => createReceipt({ secondArtifact: buildArtifact(undefined, "9") }),
    /DISTINCT_BUILD_LOGS_REQUIRED/u,
  );
  assert.throws(
    () => createReceipt({
      runnerBinding: {
        executedRunnerSha256: RUNNER_SHA256,
        committedRunnerSha256: "c".repeat(64),
      },
    }),
    /RECEIPT_RUNNER_BINDING_INVALID/u,
  );

  for (const mutate of [
    (value) => { value.recipe.arguments[value.recipe.arguments.indexOf(ECONOMY_PRODUCTION_FEATURE)] = ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE; },
    (value) => { value.safety.mainnetExecutionAuthorized = true; },
    (value) => { value.sourceClosure.checks.mutualEntrypointCompileError = false; },
  ]) {
    const tampered = structuredClone(createReceipt());
    mutate(tampered);
    const { receiptSha256: ignored, ...core } = tampered;
    assert.ok(ignored);
    tampered.receiptSha256 = digest(core);
    assert.throws(() => validateEconomyBuildReceipt(tampered));
  }
});

test("B02 Docker argv is exact, offline, isolated, and production-feature-only", () => {
  const arguments_ = createEconomyDockerBuildArguments({
    sourceSnapshotRoot: resolve(tmpdir(), "exact-source"),
    hostBuildRoot: resolve(tmpdir(), "economy-build-run-1"),
    containerBuildRoot: "/iat-economy-build/run-1",
    identityEnvironmentNames: [...RECEIPT_IDENTITY.environmentNames],
  });
  assert.ok(arguments_.includes("--pull=never"));
  assert.ok(arguments_.includes("--network=none"));
  assert.ok(arguments_.includes("--platform=linux/amd64"));
  assert.ok(arguments_.includes("--cap-drop=ALL"));
  assert.ok(arguments_.includes("--security-opt=no-new-privileges"));
  assert.ok(arguments_.some((value) => value.endsWith("target=/iat-source,readonly")));
  assert.ok(arguments_.includes("runtime-production-entrypoint"));
  assert.ok(!arguments_.includes("sbf-preflight-entrypoint"));
  assert.equal(arguments_.filter((value) => value === "--features").length, 1);
  assert.equal(arguments_.filter((value) => value.startsWith("--env=IAT_B3_PRODUCTION_")).length, 4);
});

test("B02 runtime preflight is source-only HOLD and the runner has no signing/RPC surface", () => {
  const currentHead = process.env.IAT_B3_EXACT_SOURCE_HEAD_SHA ?? "0".repeat(40);
  const preflight = observeEconomyBuildPreflight({
    environment: { IAT_B3_EXACT_SOURCE_HEAD_SHA: currentHead },
    probeContainer: false,
  });
  assert.equal(preflight.status, ECONOMY_BUILD_PREFLIGHT_HOLD);
  assert.equal(preflight.exitCode, 2);
  assert.equal(preflight.buildExecuted, false);
  assert.equal(preflight.safety.artifactCreated, false);
  assert.equal(preflight.safety.keyGenerated, false);
  assert.equal(preflight.safety.rpcUsed, false);
  assert.equal(preflight.safety.networkUsed, false);

  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.doesNotMatch(source, /@solana\/web3\.js|\bKeypair\b|\bTransactionInstruction\b/u);
  assert.doesNotMatch(source, /\bsendTransaction\s*\(|\bsendAndConfirmTransaction\s*\(|\bfetch\s*\(/u);
  assert.doesNotMatch(source, /solana\s+(?:program|transfer|airdrop|balance|genesis-hash)/u);
});

test("B02 observes source closure and runner only from the exact committed head", () => {
  const repositoryRoot = temporaryDirectory("iat-b3-economy-preflight-repository-");
  const files = {
    "projects/star-ascent/site/scripts/run-iat-b3-economy-reproducible-build.mjs":
      readFileSync(SCRIPT_PATH),
    "projects/star-ascent/site/programs/iat_b3_economy/Cargo.toml":
      Buffer.from(sources.cargoManifestSource),
    "projects/star-ascent/site/programs/iat_b3_economy/src/lib.rs":
      Buffer.from(sources.librarySource),
    "projects/star-ascent/site/programs/iat_b3_economy/src/production_entrypoint.rs":
      Buffer.from(sources.entrypointSource),
    "projects/star-ascent/site/programs/iat_b3_economy/build.rs":
      Buffer.from(sources.buildScriptSource),
    "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json": readFileSync(
      resolve(SITE_ROOT, "docs/b3/iat-b3-identity-freeze.v1.json"),
    ),
    "projects/star-ascent/site/docs/b3/iat-b3-owner-policy-freeze.v1.json": readFileSync(
      resolve(SITE_ROOT, "docs/b3/iat-b3-owner-policy-freeze.v1.json"),
    ),
  };
  try {
    runGit(repositoryRoot, ["init", "--quiet"]);
    runGit(repositoryRoot, ["config", "user.name", "B02 exact source test"]);
    runGit(repositoryRoot, ["config", "user.email", "b02@example.invalid"]);
    for (const [relativePath, bytes] of Object.entries(files)) {
      const absolutePath = resolve(repositoryRoot, relativePath);
      mkdirSync(resolve(absolutePath, ".."), { recursive: true });
      writeFileSync(absolutePath, bytes);
    }
    runGit(repositoryRoot, ["add", "--all"]);
    runGit(repositoryRoot, ["commit", "--quiet", "-m", "exact B02 source"]);
    const head = runGit(repositoryRoot, ["rev-parse", "HEAD"]);
    const preflight = observeEconomyBuildPreflight({
      repositoryRoot,
      environment: { IAT_B3_EXACT_SOURCE_HEAD_SHA: head },
      hostPlatform: "linux",
      hostArchitecture: "x64",
      nodeVersion: "24.14.0",
      probeContainer: false,
    });
    assert.equal(preflight.source.repositoryCleanTrackedAndUntracked, true);
    assert.equal(preflight.tooling.executedRunnerMatchesDeclaredHead, true);
    assert.equal(preflight.sourceClosure.ready, true);
    assert.equal(preflight.identityBinding.ready, false);
    assert.ok(preflight.blockers.includes("PRODUCTION_FOUR_INPUT_IDENTITY_BINDING"));
    assert.ok(preflight.blockers.includes("PINNED_CONTAINER_PRESENT"));

    writeFileSync(
      resolve(repositoryRoot, "projects/star-ascent/site/programs/iat_b3_economy/src/lib.rs"),
      `${sources.librarySource}\n// mutable drift\n`,
    );
    const dirty = observeEconomyBuildPreflight({
      repositoryRoot,
      environment: { IAT_B3_EXACT_SOURCE_HEAD_SHA: head },
      hostPlatform: "linux",
      hostArchitecture: "x64",
      nodeVersion: "24.14.0",
      probeContainer: false,
    });
    assert.ok(dirty.blockers.includes("REPOSITORY_CLEAN_TRACKED_AND_UNTRACKED"));
    assert.equal(dirty.sourceClosure.ready, true);
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test("B02 economy runner uses the shared owned-root materializer before a deliberate stop", {
  skip: process.platform !== "linux" || process.arch !== "x64",
}, () => {
  const repositoryRoot = temporaryDirectory("iat-b3-economy-materialization-repository-");
  const outputRoot = temporaryDirectory("iat-b3-economy-materialization-output-");
  try {
    runGit(repositoryRoot, ["init", "--quiet"]);
    runGit(repositoryRoot, ["config", "user.name", "B02 shared materializer test"]);
    runGit(repositoryRoot, ["config", "user.email", "b02-shared@example.invalid"]);
    const runnerPath = resolve(
      repositoryRoot,
      "projects/star-ascent/site/scripts/run-iat-b3-economy-reproducible-build.mjs",
    );
    mkdirSync(resolve(runnerPath, ".."), { recursive: true });
    writeFileSync(runnerPath, readFileSync(SCRIPT_PATH));
    runGit(repositoryRoot, ["add", "--all"]);
    runGit(repositoryRoot, ["commit", "--quiet", "-m", "exact economy runner"]);
    const head = runGit(repositoryRoot, ["rev-parse", "HEAD"]);
    assert.throws(
      () => runEconomyReproducibleBuild({
        repositoryRoot,
        environment: { IAT_B3_EXACT_SOURCE_HEAD_SHA: head },
        receiptPath: resolve(outputRoot, "iat_b3_economy.receipt.json"),
        artifactPath: resolve(outputRoot, "iat_b3_economy.so"),
        stopAfterSourceMaterialization: true,
      }),
      /TEST_STOP_AFTER_SOURCE_MATERIALIZATION/u,
    );
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
