import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DISPOSABLE_DEVNET_EXECUTION_GATE_ENVIRONMENT_VARIABLE,
  DISPOSABLE_DEVNET_EXECUTION_GATE_VALUE,
  DISPOSABLE_DEVNET_EXECUTION_PROJECTION_SCHEMA,
  DISPOSABLE_DEVNET_EXECUTION_REPLAY_STATUS,
  DISPOSABLE_DEVNET_EXECUTION_STATE_SCHEMA,
  DISPOSABLE_DEVNET_EXECUTION_STATUS,
  DISPOSABLE_DEVNET_EXECUTION_TEST_STATUS,
  DISPOSABLE_DEVNET_EXECUTION_TRANSCRIPT_SCHEMA,
  DISPOSABLE_DEVNET_HERMETIC_CONTAINER_WRAPPER_SCRIPT,
  DISPOSABLE_DEVNET_HERMETIC_EXECUTION_CONTRACT_SCHEMA,
  DISPOSABLE_DEVNET_HERMETIC_FRAME_SCHEMA,
  DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SCRIPT,
  DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SHA256,
  DISPOSABLE_DEVNET_HERMETIC_WRAPPER_SHA256,
  DISPOSABLE_DEVNET_OUTPUT_PROMOTION_SCHEMA,
  DISPOSABLE_DEVNET_RETAINED_FILE_LEDGER_SCHEMA,
  DISPOSABLE_DEVNET_GENESIS_HASH,
  DISPOSABLE_DEVNET_GENESIS_INPUT_SCHEMA,
  DISPOSABLE_DEVNET_IDENTITY_INPUT_SCHEMA,
  DISPOSABLE_DEVNET_NETWORK,
  DISPOSABLE_DEVNET_RPC_URL,
  PINNED_DISPOSABLE_DEVNET_DOCKER_CLI,
  PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE,
  assessDisposableDevnetExecutionProvenance,
  createDisposableDevnetDockerBuildInvocationPlan,
  createDisposableDevnetHermeticBuildContract,
  createDisposableDevnetHermeticSourceManifest,
  createDisposableDevnetFinalOutputStagePromotion,
  createDisposableDevnetRetainedFileLedger,
  createDisposableDevnetToolchainInvocationPlan,
  disposableDevnetExecutionCanonicalJson,
  disposableDevnetExecutionCanonicalSha256,
  runDisposableDevnetBuildExecutionWithInjectedExecutor,
  scanDisposableDevnetBuildTreeForKeyMaterial,
  validateDisposableDevnetExecutionState,
  validateDisposableDevnetDockerCreateArguments,
  validateDisposableDevnetHermeticBuildContract,
  validateDisposableDevnetHermeticDockerCreateArguments,
  validateDisposableDevnetHermeticDockerExecArguments,
  validateDisposableDevnetHermeticInitializerFrame,
  validateDisposableDevnetHermeticFrameSequence,
  validateDisposableDevnetRetainedFileLedger,
  validateDisposableDevnetGenesisInput,
  validateDisposableDevnetIdentityInput,
} from "../scripts/run-iat-b3-disposable-devnet-build-execution-provenance.mjs";

const SITE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const RUNNER_PATH = resolve(
  SITE_ROOT,
  "scripts/run-iat-b3-disposable-devnet-build-execution-provenance.mjs",
);
const STATE_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-disposable-devnet-build-execution-provenance-state.v1.json",
);
const DOCUMENTATION_PATH = resolve(
  SITE_ROOT,
  "docs/b3/DISPOSABLE_DEVNET_BUILD_EXECUTION_PROVENANCE.md",
);
const LANE_ID = "b15-devnet-20260813T120000Z-0123456789abcdef";
const GENERATED_AT = "2026-08-13T12:00:00.000Z";
const NOW = Date.parse("2026-08-13T12:05:00.000Z");
const LAW_ID = "561MgDFoPA7SZsF5EEnDgaQGt55CoskK84za35FKvfUZ";
const ECONOMY_ID = "Fk3zwPUFjXzLcrLpNecyrdFG9EAPaYTESqcXVNQbNmBw";
const MINT_ID = "9SPZ7uR8eXMaFtNc5b9DKG1RS94e3YgkMDzCWDGbjset";
const PINNED_MODULE_PATHS = Object.freeze([
  "scripts/run-iat-b3-combined-law-reproducible-build.mjs",
  "scripts/run-iat-b3-economy-reproducible-build.mjs",
  "scripts/validate-iat-b3-identity-freeze.mjs",
  "scripts/validate-iat-b3-owner-policy-freeze.mjs",
  "scripts/iat-b3-native-wsl-build-backend.mjs",
]);
const SOURCE_MATERIALIZATION_SCHEMA =
  "iat-b3-combined-law-exact-git-object-materialization/v1";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function retainedDescriptor(root, relativePath) {
  const path = resolve(root, ...relativePath.split("/"));
  const bytes = readFileSync(path);
  const stat = lstatSync(path, { bigint: true });
  return {
    relativePath,
    sha256: sha256(bytes),
    byteLength: bytes.length,
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
  };
}

function makeTemporaryRoot(t, prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function identityEnvironment() {
  return {
    IAT_B3_PRODUCTION_LAW_PROGRAM_ID: LAW_ID,
    IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: ECONOMY_ID,
    IAT_B3_PRODUCTION_CANONICAL_MINT: MINT_ID,
    IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH: DISPOSABLE_DEVNET_GENESIS_HASH,
  };
}

function identityInput() {
  return {
    schema: DISPOSABLE_DEVNET_IDENTITY_INPUT_SCHEMA,
    generatedAtUtc: GENERATED_AT,
    laneId: LANE_ID,
    lawProgramId: LAW_ID,
    economyProgramId: ECONOMY_ID,
    canonicalMint: MINT_ID,
  };
}

function genesisInput() {
  return {
    schema: DISPOSABLE_DEVNET_GENESIS_INPUT_SCHEMA,
    generatedAtUtc: GENERATED_AT,
    laneId: LANE_ID,
    network: DISPOSABLE_DEVNET_NETWORK,
    rpcUrl: DISPOSABLE_DEVNET_RPC_URL,
    genesisHash: DISPOSABLE_DEVNET_GENESIS_HASH,
  };
}

function hermeticSourceEntries() {
  return [
    {
      path: "Cargo.lock",
      gitMode: "100644",
      gitObjectSha1: "1".repeat(40),
      byteLength: 11,
      sha256: "2".repeat(64),
      lfsPointer: false,
    },
    {
      path: "projects/star-ascent/site/build.sh",
      gitMode: "100755",
      gitObjectSha1: "3".repeat(40),
      byteLength: 17,
      sha256: "4".repeat(64),
      lfsPointer: false,
    },
  ];
}

function hermeticSourceClosure(entries = hermeticSourceEntries()) {
  const core = {
    schema: SOURCE_MATERIALIZATION_SCHEMA,
    declaredHeadSha: "5".repeat(40),
    treeSha: "6".repeat(40),
    entries,
  };
  return {
    declaredHeadSha: core.declaredHeadSha,
    treeSha: core.treeSha,
    mountedInputSha256: disposableDevnetExecutionCanonicalSha256(core),
    entries,
  };
}

function hermeticLocalByteRoots() {
  return {
    rustToolchain: "/host/rust-toolchain",
    solanaRelease: "/host/solana-release",
    platformTools: "/host/platform-tools",
    criterion: "/host/criterion",
    registryCache: "/host/registry-cache",
    registryIndex: "/host/registry-index",
  };
}

function hermeticPlan(kind = "law", ordinal = 1) {
  return createDisposableDevnetHermeticBuildContract({
    sourceClosure: hermeticSourceClosure(),
    sourceSnapshotRoot: "/host/source",
    localByteRoots: hermeticLocalByteRoots(),
    exportRoot: `/host/export-${kind}-${ordinal}`,
    ordinal,
    kind,
    laneId: LANE_ID,
    identityEnvironment: identityEnvironment(),
  });
}

function hermeticArtifact() {
  const bytes = Buffer.alloc(1_024, 0);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]);
  bytes.writeUInt16LE(3, 16);
  bytes.writeUInt16LE(247, 18);
  return bytes;
}

function hermeticFrameBytes(contract, artifactBytes = hermeticArtifact(), mutate = (frames) => frames) {
  const common = (phase) => ({
    contractSha256: contract.contractSha256,
    kind: contract.kind,
    laneId: contract.laneId,
    ordinal: contract.ordinal,
    phase,
    recipeSha256: contract.recipe.sha256,
    schema: DISPOSABLE_DEVNET_HERMETIC_FRAME_SCHEMA,
    sourceManifestSha256: contract.source.manifest.sha256,
    toolchainClosureSha256: PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.closureSha256,
  });
  const frames = [
    common("PRIVATE_INPUT_CLOSURE_PRE_CARGO"),
    common("PRIVATE_INPUT_CLOSURE_POST_CARGO"),
    {
      artifactByteLength: artifactBytes.length,
      artifactSha256: sha256(artifactBytes),
      cargoExitStatus: 0,
      ...common("PRIVATE_ARTIFACT_EXPORTED"),
    },
  ];
  return Buffer.from(
    `${mutate(structuredClone(frames)).map(
      (frame) => disposableDevnetExecutionCanonicalJson(frame),
    ).join("\n")}\n`,
    "utf8",
  );
}

test("B15 canonical state is a machine-readable nonauthorizing HOLD", () => {
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  assert.equal(state.schema, DISPOSABLE_DEVNET_EXECUTION_STATE_SCHEMA);
  assert.equal(validateDisposableDevnetExecutionState(state), state);
  assert.equal(state.status, "HOLD");
  assert.equal(state.evidence.transcript, null);
  assert.ok(Object.values(state.truth).every((value) => value === false || value === "HOLD"));
  assert.ok(state.blockers.includes("HERMETIC_MOUNT_CAUSALITY_UNPROVEN"));
  assert.ok(state.blockers.includes(
    "HERMETIC_SAME_CONTAINER_EXECUTION_CONTRACT_NOT_INDEPENDENTLY_ACCEPTED",
  ));
  assert.ok(state.blockers.includes("FINAL_RETAINED_FILE_LEDGER_NOT_INDEPENDENTLY_ACCEPTED"));
  assert.ok(state.blockers.includes("LIVE_PROCESS_BRAND_UNAVAILABLE"));
  assert.ok(state.blockers.includes("MAINNET_HOLD"));
});

test("B15 no-input CLI performs no Docker or external probe and exits HOLD", (t) => {
  const emptyPath = makeTemporaryRoot(t, "iat-b3-b15-empty-path-");
  const result = spawnSync(process.execPath, [RUNNER_PATH], {
    encoding: "utf8",
    env: {
      PATH: emptyPath,
      SystemRoot: process.env.SystemRoot ?? "",
    },
    timeout: 10_000,
  });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.schema, DISPOSABLE_DEVNET_EXECUTION_PROJECTION_SCHEMA);
  assert.equal(report.status, "HOLD");
  assert.equal(report.ready, false);
  assert.equal(report.safety.executionProvenanceObserved, false);
  assert.equal(report.safety.buildExecutionObserved, false);
  assert.equal(report.safety.releaseAuthorized, false);
  assert.equal(report.safety.mainnetExecutionAuthorized, false);
});

test("B15 execute CLI cannot reach any input or Docker path without exact gate", (t) => {
  const root = makeTemporaryRoot(t, "iat-b3-b15-ungated-");
  const result = spawnSync(process.execPath, [
    RUNNER_PATH,
    "--execute",
    "--output-root", join(root, "iat-b3-disposable-devnet-provenance-test"),
    "--identity-input", join(root, "missing-identities.json"),
    "--genesis-input", join(root, "missing-genesis.json"),
  ], {
    encoding: "utf8",
    env: {
      PATH: root,
      SystemRoot: process.env.SystemRoot ?? "",
      IAT_B3_EXACT_SOURCE_HEAD_SHA: "1".repeat(40),
    },
    timeout: 10_000,
  });
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.blocker, "DISPOSABLE_DEVNET_EXECUTION_EXPLICIT_GATE_REQUIRED");
  assert.equal(report.ready, false);
  assert.equal(report.safety.executionProvenanceObserved, false);
});

test("B19 exact gate remains categorically disabled before path reads or external commands", (t) => {
  const root = makeTemporaryRoot(t, "iat-b3-b19-disabled-");
  const marker = join(root, "hostile-command-ran.txt");
  const commandNames = process.platform === "win32"
    ? ["docker.cmd", "git.cmd", "node.cmd"]
    : ["docker", "git", "node"];
  for (const commandName of commandNames) {
    writeFileSync(
      join(root, commandName),
      process.platform === "win32"
        ? `@echo hostile>>"${marker}"\r\n@exit /b 91\r\n`
        : `#!/bin/sh\nprintf hostile >> '${marker}'\nexit 91\n`,
      { mode: 0o700 },
    );
  }
  const outputRoot = join(root, "iat-b3-disposable-devnet-provenance-test");
  const identityPath = join(root, "missing-identities.json");
  const genesisPath = join(root, "missing-genesis.json");
  const result = spawnSync(process.execPath, [
    RUNNER_PATH,
    "--execute",
    "--output-root", outputRoot,
    "--identity-input", identityPath,
    "--genesis-input", genesisPath,
  ], {
    encoding: "utf8",
    env: {
      PATH: root,
      SystemRoot: process.env.SystemRoot ?? "",
      IAT_B3_EXACT_SOURCE_HEAD_SHA: "1".repeat(40),
      [DISPOSABLE_DEVNET_EXECUTION_GATE_ENVIRONMENT_VARIABLE]:
        DISPOSABLE_DEVNET_EXECUTION_GATE_VALUE,
    },
    timeout: 10_000,
  });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.blocker, "HERMETIC_MOUNT_CAUSALITY_UNPROVEN");
  assert.equal(report.ready, false);
  assert.equal(report.safety.modulePrivateLiveProcessBrandObserved, false);
  assert.equal(report.safety.executionProvenanceObserved, false);
  assert.equal(report.safety.buildExecutionObserved, false);
  assert.equal(Object.hasOwn(report, "transcript"), false);
  for (const untouchedPath of [marker, outputRoot, identityPath, genesisPath]) {
    assert.throws(() => readFileSync(untouchedPath), /ENOENT/u);
  }
});

test("B15 build plan is pinned create-inspect-start input with offline confinement", (t) => {
  const root = makeTemporaryRoot(t, "iat-b3-b15-plan-");
  const sourceRoot = join(root, "source");
  const runRoot = join(root, "run-1");
  mkdirSync(sourceRoot);
  mkdirSync(runRoot);
  const plan = createDisposableDevnetDockerBuildInvocationPlan({
    sourceSnapshotRoot: sourceRoot,
    runRoot,
    ordinal: 1,
    laneId: LANE_ID,
    identityEnvironment: identityEnvironment(),
  });
  assert.equal(plan.ordinal, 1);
  assert.notEqual(plan.roots.law, plan.roots.economy);
  for (const kind of ["law", "economy"]) {
    const arguments_ = plan[kind].createArguments;
    assert.equal(arguments_[1], "create");
    assert.ok(arguments_.includes("--pull=never"));
    assert.ok(arguments_.includes("--network=none"));
    assert.ok(arguments_.includes("--read-only"));
    assert.ok(arguments_.includes("--cap-drop=ALL"));
    assert.ok(arguments_.includes("--security-opt=no-new-privileges"));
    assert.ok(arguments_.includes("--platform=linux/amd64"));
    assert.ok(arguments_.includes("--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=268435456"));
    assert.ok(!arguments_.includes("--rm"));
    assert.ok(arguments_.includes("--offline"));
    assert.ok(arguments_.includes("--skip-tools-install"));
    assert.ok(arguments_.some((value) => value.startsWith("--name=iat-b3-b15-")));
  }
  assert.ok(plan.law.createArguments.includes("production-combined-hook"));
  assert.ok(plan.economy.createArguments.includes("runtime-production-entrypoint"));
  assert.ok(!plan.economy.createArguments.includes("sbf-preflight-entrypoint"));
  assert.equal(Object.isFrozen(plan), true);
});

test("B15 toolchain plan observes Rust Cargo SBF and full platform-tools closure offline", () => {
  const plan = createDisposableDevnetToolchainInvocationPlan(LANE_ID);
  assert.deepEqual(plan.map(({ purpose }) => purpose), [
    "rustc-version",
    "cargo-version",
    "cargo-build-sbf-version",
    "platform-tools-v1.52-closure",
  ]);
  for (const { createArguments } of plan) {
    assert.equal(createArguments[1], "create");
    assert.ok(createArguments.includes("--pull=never"));
    assert.ok(createArguments.includes("--network=none"));
    assert.ok(createArguments.includes("--read-only"));
  }
  assert.match(plan[3].createArguments.join(" "), /v1\.52\/platform-tools/u);
});

test("B15 Docker create grammar rejects every contradictory or privilege-expanding mutation", (t) => {
  const root = makeTemporaryRoot(t, "iat-b3-b15-grammar-");
  const sourceRoot = join(root, "source");
  const runRoot = join(root, "run-1");
  mkdirSync(sourceRoot);
  mkdirSync(runRoot);
  const plan = createDisposableDevnetDockerBuildInvocationPlan({
    sourceSnapshotRoot: sourceRoot,
    runRoot,
    ordinal: 1,
    laneId: LANE_ID,
    identityEnvironment: identityEnvironment(),
  });
  assert.equal(validateDisposableDevnetDockerCreateArguments(plan.law.createArguments), true);
  const mutations = [
    [...plan.law.createArguments, "--network=host"],
    [...plan.law.createArguments.slice(0, 6), "--pull=always", ...plan.law.createArguments.slice(6)],
    [...plan.law.createArguments.slice(0, 9), "--privileged=true", ...plan.law.createArguments.slice(9)],
    [...plan.law.createArguments.slice(0, 9), "--cap-add=ALL", ...plan.law.createArguments.slice(9)],
    [...plan.law.createArguments.slice(0, 9), "--pid=host", ...plan.law.createArguments.slice(9)],
    [...plan.law.createArguments.slice(0, 9), "--device=/dev/sda", ...plan.law.createArguments.slice(9)],
    [...plan.law.createArguments, PINNED_DISPOSABLE_DEVNET_DOCKER_CLI.absolutePath],
  ];
  for (const mutated of mutations) {
    assert.throws(
      () => validateDisposableDevnetDockerCreateArguments(mutated),
      /DOCKER_(?:OFFLINE_CONFINEMENT|EXACT_BUILD_GRAMMAR|BUILD_MOUNT_GRAMMAR)_HOLD/u,
    );
  }
});

test("B24 hermetic source manifest binds complete path mode byte and directory closure", () => {
  const entries = hermeticSourceEntries();
  const manifest = createDisposableDevnetHermeticSourceManifest(entries);
  assert.equal(manifest.schema, "iat-b3-disposable-devnet-hermetic-tree-manifest/v1");
  assert.equal(manifest.fileCount, 2);
  assert.equal(manifest.directoryCount, 3);
  assert.equal(manifest.entryCount, 5);
  assert.equal(manifest.sourceByteLength, 28);
  assert.match(manifest.sha256, /^[0-9a-f]{64}$/u);
  for (const mutation of [
    (copy) => { copy[0].path = "Cargo2.lock"; },
    (copy) => { copy[0].gitMode = "100755"; },
    (copy) => { copy[0].sha256 = "9".repeat(64); },
    (copy) => { copy[0].byteLength += 1; },
  ]) {
    const copy = structuredClone(entries);
    mutation(copy);
    assert.notEqual(createDisposableDevnetHermeticSourceManifest(copy).sha256, manifest.sha256);
  }
  assert.throws(
    () => createDisposableDevnetHermeticSourceManifest([...entries, entries[0]]),
    /SOURCE_ENTRY_INVALID/u,
  );
  assert.throws(
    () => createDisposableDevnetHermeticSourceManifest([
      ...entries,
      { ...entries[0], path: "projects" },
    ]),
    /SOURCE_PATH_ALIAS_HOLD/u,
  );
});

test("B24 hermetic contract is exact offline private-copy grammar and remains hard-disabled", () => {
  for (const [kind, ordinal] of [["law", 1], ["economy", 2]]) {
    const plan = hermeticPlan(kind, ordinal);
    assert.equal(validateDisposableDevnetHermeticBuildContract(plan), plan);
    assert.equal(
      validateDisposableDevnetHermeticDockerCreateArguments(plan.createArguments),
      true,
    );
    assert.equal(plan.contract.schema, DISPOSABLE_DEVNET_HERMETIC_EXECUTION_CONTRACT_SCHEMA);
    assert.equal(plan.contract.enabled, false);
    assert.equal(
      plan.contract.implementationStatus,
      "IMPLEMENTED_HARD_DISABLED_PENDING_INDEPENDENT_ACCEPTANCE",
    );
    assert.equal(plan.contract.retryPolicy, "NO_RETRY_WITHIN_CONTRACT");
    assert.equal(plan.contract.privateStore.byteLength, 8 * 1024 * 1024 * 1024);
    assert.equal(
      plan.contract.privateStore.options,
      "rw,nosuid,nodev,exec,uid=0,gid=0,mode=0755",
    );
    assert.equal(plan.contract.privateStore.owner, "UID_GID_0_BUILD_UID_UNWRITABLE");
    assert.equal(plan.contract.buildStore.byteLength, 24 * 1024 * 1024 * 1024);
    assert.equal(plan.contract.buildStore.owner, "UID_GID_65534");
    assert.equal(plan.contract.exportBoundary.hostDirectoryOpenMode, "703");
    assert.equal(plan.contract.exportBoundary.hostDirectoryClosedMode, "700");
    assert.equal(plan.contract.exportBoundary.hostDirectoryOwner, "EXECUTING_NODE_UID_GID");
    assert.equal(plan.contract.exportBoundary.exportedArtifactMode, "444");
    assert.equal(
      plan.contract.exportBoundary.containerWriter,
      "UID_GID_65534_CAP_DROP_ALL_USES_OTHER_WRITE_EXECUTE",
    );
    assert.equal(plan.contract.wrapper.sha256, DISPOSABLE_DEVNET_HERMETIC_WRAPPER_SHA256);
    assert.equal(plan.contract.safety.dockerApiInvoked, false);
    assert.equal(plan.contract.safety.buildExecuted, false);
    assert.equal(plan.contract.safety.executionProvenanceObserved, false);
    assert.equal(plan.contract.safety.mainnetStatus, "HOLD");
    assert.ok(plan.createArguments.includes("--network=none"));
    assert.ok(plan.createArguments.includes("--pull=never"));
    assert.ok(plan.createArguments.includes("--read-only"));
    assert.ok(plan.createArguments.includes("--cap-drop=ALL"));
    assert.ok(plan.createArguments.includes("--security-opt=no-new-privileges"));
    assert.ok(plan.createArguments.includes("--pids-limit=512"));
    assert.ok(!plan.createArguments.includes("--user=65534:65534"));
    assert.ok(plan.execArguments.includes("--user=65534:65534"));
    assert.equal(validateDisposableDevnetHermeticDockerExecArguments(plan.execArguments), true);
    assert.ok(plan.createArguments.includes("--workdir=/usr/bin"));
    assert.ok(!plan.createArguments.includes("--workdir=/home/a/iat-source"));
    assert.ok(plan.createArguments.includes(
      "--tmpfs=/iat-private:rw,nosuid,nodev,exec,size=8589934592,uid=0,gid=0,mode=0755",
    ));
    assert.ok(plan.createArguments.includes(
      "--tmpfs=/iat-build:rw,nosuid,nodev,exec,size=25769803776,uid=65534,gid=65534,mode=0700",
    ));
    assert.ok(plan.createArguments.includes("--entrypoint=/bin/bash"));
    assert.ok(plan.createArguments.includes(DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SCRIPT));
    assert.ok(plan.execArguments.includes(DISPOSABLE_DEVNET_HERMETIC_CONTAINER_WRAPPER_SCRIPT));
    const initializerFrame = Buffer.from(`${disposableDevnetExecutionCanonicalJson({
      contractSha256: plan.contract.contractSha256,
      kind: plan.contract.kind,
      laneId: plan.contract.laneId,
      ordinal: plan.contract.ordinal,
      phase: "PRIVATE_INPUT_CLOSURE_INITIALIZED",
      schema: DISPOSABLE_DEVNET_HERMETIC_FRAME_SCHEMA,
    })}\n`);
    assert.equal(
      validateDisposableDevnetHermeticInitializerFrame(initializerFrame, plan),
      true,
    );
    assert.equal(
      plan.createArguments.filter((value) => value.startsWith("--mount=")).length,
      8,
    );
    assert.equal(Object.isFrozen(plan), true);
  }
});

test("B24 hermetic contract rejects self-digested source recipe safety and enablement forgeries", () => {
  const original = hermeticPlan();
  const rehash = (mutate) => {
    const plan = structuredClone(original);
    mutate(plan);
    const contractCore = structuredClone(plan.contract);
    delete contractCore.contractSha256;
    plan.contract.contractSha256 = disposableDevnetExecutionCanonicalSha256(contractCore);
    plan.environment.IAT_B3_HERMETIC_CONTRACT_SHA256 = plan.contract.contractSha256;
    plan.planSha256 = disposableDevnetExecutionCanonicalSha256({
      contract: plan.contract,
      createArguments: plan.createArguments,
      execArguments: plan.execArguments,
      environment: plan.environment,
    });
    return plan;
  };
  for (const [label, mutation] of [
    ["enabled", (plan) => { plan.contract.enabled = true; }],
    ["status", (plan) => { plan.contract.implementationStatus = "READY"; }],
    ["execution", (plan) => { plan.contract.safety.executionProvenanceObserved = true; }],
    ["docker", (plan) => { plan.contract.safety.dockerApiInvoked = true; }],
    ["mainnet", (plan) => { plan.contract.safety.mainnetStatus = "GO"; }],
    ["toolchain", (plan) => { plan.contract.localByteToolchain.trees.rustToolchain.byteLength += 1; }],
    ["private-owner", (plan) => { plan.contract.privateStore.owner = "ROOT"; }],
    ["private-options", (plan) => { plan.contract.privateStore.options = "rw,exec,mode=0777"; }],
    ["export-mode", (plan) => { plan.contract.exportBoundary.hostDirectoryOpenMode = "777"; }],
    ["ledger", (plan) => { plan.contract.lifecycle.requireFinalRetainedFileLedger = false; }],
  ]) {
    assert.throws(
      () => validateDisposableDevnetHermeticBuildContract(rehash(mutation)),
      /HERMETIC_CONTRACT_(?:SHAPE|BINDING)_HOLD/u,
      label,
    );
  }
  const badSource = hermeticSourceClosure();
  badSource.mountedInputSha256 = "0".repeat(64);
  assert.throws(
    () => createDisposableDevnetHermeticBuildContract({
      sourceClosure: badSource,
      sourceSnapshotRoot: "/host/source",
      localByteRoots: hermeticLocalByteRoots(),
      exportRoot: "/host/export",
      ordinal: 1,
      kind: "law",
      laneId: LANE_ID,
      identityEnvironment: identityEnvironment(),
    }),
    /MOUNTED_INPUT_BINDING_HOLD/u,
  );
});

test("B24 hermetic Docker grammar rejects mounts duplicates privileges wrapper and retry drift", () => {
  const plan = hermeticPlan();
  const mountIndex = plan.createArguments.findIndex(
    (value) => value.includes("target=/iat-host/source"),
  );
  const wrapperIndex = plan.createArguments.indexOf(DISPOSABLE_DEVNET_HERMETIC_CONTAINER_WRAPPER_SCRIPT);
  const mutations = [
    (args) => args.with(args.indexOf("--network=none"), "--network=host"),
    (args) => [...args, "--network=none"],
    (args) => [...args, "--tmpfs=/evil:rw,exec,size=1"],
    (args) => args.with(
      args.findIndex((value) => value.startsWith("--tmpfs=/iat-private:")),
      "--tmpfs=/iat-private:rw,nosuid,nodev,exec,size=8589934592,uid=65534,gid=65534,mode=0755",
    ),
    (args) => [...args.slice(0, 10), "--privileged=true", ...args.slice(10)],
    (args) => args.with(mountIndex, args[mountIndex].replace("/iat-host/source", "/iat-host/export")),
    (args) => args.with(mountIndex, args[mountIndex].replace(",readonly", "")),
    (args) => args.with(wrapperIndex, `${args[wrapperIndex]}\ntrue`),
    (args) => args.with(2, args[2].replace("-law", "-law-retry")),
    (args) => args.with(args.indexOf("--workdir=/usr/bin"), "--workdir=/home/a/iat-source"),
  ];
  for (const mutate of mutations) {
    assert.throws(
      () => validateDisposableDevnetHermeticDockerCreateArguments(mutate([...plan.createArguments])),
      /DISPOSABLE_DEVNET_HERMETIC_DOCKER_/u,
    );
  }
  for (const mutate of [
    (args) => args.with(args.indexOf("--user=65534:65534"), "--user=0:0"),
    (args) => [...args, "--detach"],
    (args) => args.with(args.indexOf("--workdir=/iat-private/home/a/iat-source"), "--workdir=/iat-build"),
  ]) {
    assert.throws(
      () => validateDisposableDevnetHermeticDockerExecArguments(mutate([...plan.execArguments])),
      /HERMETIC_DOCKER_EXEC_GRAMMAR_HOLD/u,
    );
  }
});

test("B24 exact frame parser binds same-container pre post and exported ELF bytes", () => {
  const plan = hermeticPlan("economy", 2);
  const artifact = hermeticArtifact();
  const result = validateDisposableDevnetHermeticFrameSequence(
    hermeticFrameBytes(plan.contract, artifact),
    { contract: plan.contract, exportedArtifactBytes: artifact },
  );
  assert.equal(result.status, "HOLD_HERMETIC_CONTRACT_STRUCTURAL_VALIDATION_ONLY");
  assert.equal(result.ready, false);
  assert.equal(result.structuralContractValidated, true);
  assert.equal(result.exactSourceReceiptValidated, false);
  assert.equal(result.executionProvenanceObserved, false);
  assert.equal(result.buildExecutionObserved, false);
  assert.equal(result.blocker, "HERMETIC_MOUNT_CAUSALITY_UNPROVEN");
  assert.equal(result.mainnetStatus, "HOLD");
});

test("B24 frame parser rejects prefix suffix duplicate reorder and every binding mutation", () => {
  const plan = hermeticPlan();
  const artifact = hermeticArtifact();
  const validate = (bytes, candidateArtifact = artifact) => (
    validateDisposableDevnetHermeticFrameSequence(bytes, {
      contract: plan.contract,
      exportedArtifactBytes: candidateArtifact,
    })
  );
  const canonical = hermeticFrameBytes(plan.contract, artifact);
  for (const bytes of [
    Buffer.concat([Buffer.from("prefix"), canonical]),
    Buffer.concat([canonical, Buffer.from("suffix")]),
    Buffer.concat([canonical, canonical]),
    hermeticFrameBytes(plan.contract, artifact, (frames) => [frames[1], frames[0], frames[2]]),
    hermeticFrameBytes(plan.contract, artifact, (frames) => {
      frames[0].kind = "economy";
      return frames;
    }),
    hermeticFrameBytes(plan.contract, artifact, (frames) => {
      frames[1].ordinal = 2;
      return frames;
    }),
    hermeticFrameBytes(plan.contract, artifact, (frames) => {
      frames[2].contractSha256 = "0".repeat(64);
      return frames;
    }),
    hermeticFrameBytes(plan.contract, artifact, (frames) => {
      frames[2].recipeSha256 = "0".repeat(64);
      return frames;
    }),
    hermeticFrameBytes(plan.contract, artifact, (frames) => {
      frames[1].sourceManifestSha256 = "0".repeat(64);
      return frames;
    }),
    hermeticFrameBytes(plan.contract, artifact, (frames) => {
      frames[0].toolchainClosureSha256 = "0".repeat(64);
      return frames;
    }),
    hermeticFrameBytes(plan.contract, artifact, (frames) => {
      frames[2].artifactSha256 = "0".repeat(64);
      return frames;
    }),
    hermeticFrameBytes(plan.contract, artifact, (frames) => {
      frames[2].artifactByteLength += 1;
      return frames;
    }),
    hermeticFrameBytes(plan.contract, artifact, (frames) => {
      frames[2].cargoExitStatus = 1;
      return frames;
    }),
  ]) {
    assert.throws(validate.bind(null, bytes), /DISPOSABLE_DEVNET_HERMETIC_/u);
  }
  const changedArtifact = Buffer.from(artifact);
  changedArtifact[100] ^= 1;
  assert.throws(
    () => validate(canonical, changedArtifact),
    /FRAME_BINDING_HOLD/u,
  );
});

test("B24 fixed wrapper is frame-only private-copy offline build design", () => {
  const script = DISPOSABLE_DEVNET_HERMETIC_CONTAINER_WRAPPER_SCRIPT;
  const initializer = DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SCRIPT;
  assert.equal(sha256(Buffer.from(script, "utf8")), DISPOSABLE_DEVNET_HERMETIC_WRAPPER_SHA256);
  assert.equal(
    sha256(Buffer.from(initializer, "utf8")),
    DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SHA256,
  );
  assert.match(script, /^set -euo pipefail/mu);
  assert.match(initializer, /PRIVATE_ROOT_NOT_EMPTY/u);
  assert.match(initializer, /ROOT_IDENTITY/u);
  assert.match(initializer, /PRIVATE_INPUT_CLOSURE_INITIALIZED/u);
  assert.match(initializer, /\/usr\/bin\/chown -R 0:0/u);
  assert.match(script, /BUILD_IDENTITY/u);
  assert.match(script, /PRIVATE_INPUTS_NOT_READY/u);
  assert.match(script, /exported=\/iat-host\/export\/\$output_name/u);
  assert.match(script, /set -o noclobber; exec 3>/u);
  assert.match(script, /== 65534:65534/u);
  assert.match(script, /EXPORTED_ARTIFACT_BOUNDARY/u);
  assert.match(initializer, /\/usr\/bin\/cp -a --no-preserve=ownership --reflink=never/u);
  assert.match(script, /source\.private\.pre/u);
  assert.match(script, /source\.private\.post/u);
  assert.match(script, /SOURCE_POST_CARGO/u);
  assert.doesNotMatch(script, /\bsetpriv\b|\bchown\b/u);
  assert.match(script, /TMPDIR=\/iat-build\/tmp/u);
  assert.match(script, /1>&2 2>&2/u);
  assert.match(script, /CARGO_NET_OFFLINE=true/u);
  assert.match(script, /--offline --skip-tools-install/u);
  assert.match(script, /PRIVATE_ARTIFACT_EXPORTED/u);
  assert.match(script, /ARTIFACT_EXPORT/u);
  assert.doesNotMatch(script, /\bdocker\b/iu);
  assert.doesNotMatch(initializer, /\bdocker\b/iu);
  assert.doesNotMatch(script, /\bcurl\b|\bwget\b|\bfetch\b/iu);
});

test("B26 retained-file ledger reopens and binds every exact same file", (t) => {
  const root = makeTemporaryRoot(t, "iat-b3-b26-ledger-");
  for (const name of ["inputs", "logs", "artifacts"]) mkdirSync(join(root, name));
  writeFileSync(join(root, "inputs", "source.cjson"), "source\n");
  writeFileSync(join(root, "logs", "01.stdout.bin"), "stdout\n");
  writeFileSync(join(root, "artifacts", "run-1-law.so"), hermeticArtifact());
  const descriptors = [
    retainedDescriptor(root, "inputs/source.cjson"),
    retainedDescriptor(root, "logs/01.stdout.bin"),
    retainedDescriptor(root, "artifacts/run-1-law.so"),
  ];
  const ledger = createDisposableDevnetRetainedFileLedger(root, descriptors);
  assert.equal(ledger.schema, DISPOSABLE_DEVNET_RETAINED_FILE_LEDGER_SCHEMA);
  assert.equal(ledger.status, "HOLD_RETAINED_FILE_LEDGER_STRUCTURAL_VALIDATION_ONLY");
  assert.equal(ledger.ready, false);
  assert.equal(ledger.executionProvenanceObserved, false);
  assert.equal(ledger.outputStagePromotionAuthorized, false);
  assert.equal(validateDisposableDevnetRetainedFileLedger(root, ledger), ledger);

  const forged = structuredClone(ledger);
  forged.executionProvenanceObserved = true;
  assert.throws(
    () => validateDisposableDevnetRetainedFileLedger(root, forged),
    /RETAINED_FILE_LEDGER_SHAPE_HOLD/u,
  );
  writeFileSync(join(root, "logs", "01.stdout.bin"), "changed\n");
  assert.throws(
    () => validateDisposableDevnetRetainedFileLedger(root, ledger),
    /RETAINED_FILE_(?:SET_OR_IDENTITY|LEDGER_REVALIDATION)_HOLD/u,
  );
});

test("B26 retained-file ledger rejects inode directory replacement hardlink and extra file", (t) => {
  for (const attack of ["replacement", "directory", "hardlink", "missing", "extra"]) {
    const root = makeTemporaryRoot(t, `iat-b3-b26-ledger-${attack}-`);
    mkdirSync(join(root, "logs"));
    const path = join(root, "logs", "01.stdout.bin");
    writeFileSync(path, "original\n");
    const ledger = createDisposableDevnetRetainedFileLedger(
      root,
      [retainedDescriptor(root, "logs/01.stdout.bin")],
    );
    if (attack === "replacement") {
      const replacement = join(root, "replacement.bin");
      const displaced = join(root, "displaced.bin");
      writeFileSync(replacement, "original\n");
      renameSync(path, displaced);
      renameSync(replacement, path);
      rmSync(displaced);
    } else if (attack === "directory") {
      const replacement = join(root, "replacement-logs");
      const displaced = join(root, "displaced-logs");
      mkdirSync(replacement);
      writeFileSync(join(replacement, "01.stdout.bin"), "original\n");
      renameSync(join(root, "logs"), displaced);
      renameSync(replacement, join(root, "logs"));
      rmSync(displaced, { recursive: true });
    } else if (attack === "hardlink") {
      linkSync(path, join(root, "logs", "alias.bin"));
    } else if (attack === "missing") {
      rmSync(path);
    } else {
      writeFileSync(join(root, "logs", "extra.bin"), "extra\n");
    }
    assert.throws(
      () => validateDisposableDevnetRetainedFileLedger(root, ledger),
      /RETAINED_FILE_(?:LEDGER|HARDLINK|SET_OR_IDENTITY)/u,
      attack,
    );
  }
});

test("B26 final output promotion binds the transcript as one additional same file", (t) => {
  const root = makeTemporaryRoot(t, "iat-b3-b26-promotion-");
  const evidenceRoot = join(root, "evidence");
  mkdirSync(evidenceRoot);
  mkdirSync(join(evidenceRoot, "inputs"));
  const evidencePath = join(evidenceRoot, "inputs", "evidence.cjson");
  writeFileSync(evidencePath, "evidence\n");
  const evidenceDescriptors = [retainedDescriptor(evidenceRoot, "inputs/evidence.cjson")];
  const evidenceLedger = createDisposableDevnetRetainedFileLedger(
    evidenceRoot,
    evidenceDescriptors,
  );
  const transcriptPath = join(root, "transcript.json");
  writeFileSync(transcriptPath, "{\"ready\":false}\n");
  const transcriptDescriptor = retainedDescriptor(root, "transcript.json");
  const promotion = createDisposableDevnetFinalOutputStagePromotion({
    stageRoot: root,
    retainedEvidenceLedger: evidenceLedger,
    retainedEvidenceDescriptors: evidenceDescriptors,
    transcriptDescriptor,
  });
  assert.equal(promotion.schema, DISPOSABLE_DEVNET_OUTPUT_PROMOTION_SCHEMA);
  assert.equal(promotion.status, "HOLD_OUTPUT_STAGE_PROMOTION_STRUCTURALLY_VALIDATED_ONLY");
  assert.equal(promotion.outputStageFilesystemPromotionValidated, true);
  assert.equal(promotion.executionProvenanceObserved, false);
  assert.equal(promotion.buildExecutionObserved, false);
  assert.equal(promotion.releaseAuthorized, false);
  assert.equal(promotion.mainnetStatus, "HOLD");
  assert.equal(promotion.finalLedger.files.length, 2);
  assert.equal(
    validateDisposableDevnetRetainedFileLedger(root, promotion.finalLedger),
    promotion.finalLedger,
  );
  assert.throws(
    () => createDisposableDevnetFinalOutputStagePromotion({
      stageRoot: root,
      retainedEvidenceLedger: evidenceLedger,
      retainedEvidenceDescriptors: evidenceDescriptors,
      transcriptDescriptor: { ...transcriptDescriptor, sha256: "0".repeat(64) },
    }),
    /RETAINED_FILE_SET_OR_IDENTITY_HOLD/u,
  );
  const promotedEvidenceForgery = structuredClone(evidenceLedger);
  promotedEvidenceForgery.outputStagePromotionAuthorized = true;
  const { ledgerSha256: discardedLedgerSha256, ...forgedCore } = promotedEvidenceForgery;
  assert.match(discardedLedgerSha256, /^[0-9a-f]{64}$/u);
  promotedEvidenceForgery.ledgerSha256 = disposableDevnetExecutionCanonicalSha256(forgedCore);
  assert.throws(
    () => createDisposableDevnetFinalOutputStagePromotion({
      stageRoot: root,
      retainedEvidenceLedger: promotedEvidenceForgery,
      retainedEvidenceDescriptors: evidenceDescriptors,
      transcriptDescriptor,
    }),
    /RETAINED_FILE_LEDGER_SHAPE_HOLD/u,
  );
  for (const mutate of [
    (ledger) => { ledger.expectedDescriptorClosureSha256 = "0".repeat(64); },
    (ledger) => { ledger.directories[0].modifiedNanoseconds = "0"; },
  ]) {
    const forgedLedger = structuredClone(evidenceLedger);
    mutate(forgedLedger);
    const { ledgerSha256: ignored, ...forgedLedgerCore } = forgedLedger;
    assert.match(ignored, /^[0-9a-f]{64}$/u);
    forgedLedger.ledgerSha256 = disposableDevnetExecutionCanonicalSha256(forgedLedgerCore);
    assert.throws(
      () => createDisposableDevnetFinalOutputStagePromotion({
        stageRoot: root,
        retainedEvidenceLedger: forgedLedger,
        retainedEvidenceDescriptors: evidenceDescriptors,
        transcriptDescriptor,
      }),
      /RETAINED_FILE_LEDGER_REVALIDATION_HOLD/u,
    );
  }
  writeFileSync(evidencePath, "tampered\n");
  assert.throws(
    () => validateDisposableDevnetRetainedFileLedger(root, promotion.finalLedger),
    /RETAINED_FILE_(?:SET_OR_IDENTITY|LEDGER_REVALIDATION)_HOLD/u,
  );
});

test("B15 executable module closure is exact-byte pinned before dynamic evaluation", () => {
  const source = readFileSync(RUNNER_PATH, "utf8");
  for (const relativePath of PINNED_MODULE_PATHS) {
    const bytes = readFileSync(resolve(SITE_ROOT, relativePath));
    assert.match(source, new RegExp(sha256(bytes), "u"), relativePath);
    assert.match(source, new RegExp(`byteLength: ${bytes.length.toLocaleString("en-US").replaceAll(",", "_")}`, "u"));
  }
  assert.match(source, /const BOOTSTRAP_MODULE_CLOSURE = observePinnedExecutionModuleClosure\(\)/u);
  assert.match(source, /validatePinnedExecutionModuleClosureAtHead\(declaredHeadSha\)/u);

  const discovered = new Set();
  const pending = [
    resolve(SITE_ROOT, "scripts/run-iat-b3-combined-law-reproducible-build.mjs"),
    resolve(SITE_ROOT, "scripts/run-iat-b3-economy-reproducible-build.mjs"),
  ];
  while (pending.length > 0) {
    const file = pending.pop();
    const relativePath = relative(SITE_ROOT, file).replaceAll("\\", "/");
    if (discovered.has(relativePath)) continue;
    discovered.add(relativePath);
    const moduleSource = readFileSync(file, "utf8");
    for (const match of moduleSource.matchAll(/\bfrom\s+"(?<specifier>\.\.?\/[^"\r\n]+\.mjs)"/gu)) {
      const dependency = resolve(dirname(file), match.groups.specifier);
      if (dependency.startsWith(resolve(SITE_ROOT, "scripts"))) pending.push(dependency);
    }
  }
  assert.deepEqual([...discovered].sort(), [...PINNED_MODULE_PATHS].sort());
});

test("B15 dependency-injected executor can emit only HOLD_TEST", () => {
  let calls = 0;
  const result = runDisposableDevnetBuildExecutionWithInjectedExecutor({
    execute(invocation) {
      calls += 1;
      return {
        ...invocation,
        status: DISPOSABLE_DEVNET_EXECUTION_STATUS,
        executionProvenanceObserved: true,
        buildExecutionObserved: true,
        ready: true,
      };
    },
    invocations: [{ command: "docker", claimed: "official" }],
  });
  assert.equal(calls, 1);
  assert.equal(result.status, DISPOSABLE_DEVNET_EXECUTION_TEST_STATUS);
  assert.equal(result.ready, false);
  assert.equal(result.safety.modulePrivateLiveProcessBrandObserved, false);
  assert.equal(result.safety.executionProvenanceObserved, false);
  assert.equal(result.safety.buildExecutionObserved, false);
  const projection = assessDisposableDevnetExecutionProvenance(result);
  assert.equal(projection.status, DISPOSABLE_DEVNET_EXECUTION_TEST_STATUS);
  assert.equal(projection.safety.executionProvenanceObserved, false);
});

test("B15 complete self-authored transcript and copied JSON cannot recover live brand", () => {
  const forgedCore = {
    schema: DISPOSABLE_DEVNET_EXECUTION_TRANSCRIPT_SCHEMA,
    status: DISPOSABLE_DEVNET_EXECUTION_STATUS,
    generatedAtUtc: GENERATED_AT,
    laneId: LANE_ID,
    docker: {
      executable: PINNED_DISPOSABLE_DEVNET_DOCKER_CLI,
      arguments: ["--network=none", "--pull=never"],
      imageInspect: { claimed: true },
      containerInspect: { claimed: true },
    },
    artifacts: {
      lawSha256: "1".repeat(64),
      economySha256: "2".repeat(64),
    },
    executionProvenanceObserved: true,
    buildExecutionObserved: true,
    ready: true,
    releaseAuthorized: true,
    mainnetExecutionAuthorized: true,
  };
  const forged = {
    ...forgedCore,
    transcriptSha256: disposableDevnetExecutionCanonicalSha256(forgedCore),
  };
  for (const candidate of [forged, JSON.parse(JSON.stringify(forged)), Buffer.from("ELF")]) {
    const projection = assessDisposableDevnetExecutionProvenance(candidate);
    assert.equal(projection.status, DISPOSABLE_DEVNET_EXECUTION_REPLAY_STATUS);
    assert.equal(projection.ready, false);
    assert.equal(projection.safety.modulePrivateLiveProcessBrandObserved, false);
    assert.equal(projection.safety.executionProvenanceObserved, false);
    assert.equal(projection.safety.productionFinalByteEvidence, false);
    assert.equal(projection.safety.releaseAuthorized, false);
    assert.equal(projection.safety.mainnetExecutionAuthorized, false);
  }
});

test("B15 identity and Genesis inputs are exact fresh domain-bound public data", () => {
  const identity = identityInput();
  const genesis = genesisInput();
  assert.equal(validateDisposableDevnetIdentityInput(identity, { now: NOW }), identity);
  assert.equal(validateDisposableDevnetGenesisInput(genesis, {
    now: NOW,
    laneId: LANE_ID,
  }), genesis);
  assert.throws(
    () => validateDisposableDevnetIdentityInput(identity, {
      now: NOW,
      forbiddenIdentities: new Set([LAW_ID]),
    }),
    /PRODUCTION_OR_CHECKED_IN_IDENTITY_REUSE_HOLD/u,
  );
  assert.throws(
    () => validateDisposableDevnetIdentityInput(
      { ...identity, economyProgramId: LAW_ID },
      { now: NOW },
    ),
    /THREE_DISTINCT_PUBLIC_IDENTITIES_REQUIRED/u,
  );
  assert.throws(
    () => validateDisposableDevnetGenesisInput(
      { ...genesis, genesisHash: "not-devnet" },
      { now: NOW, laneId: LANE_ID },
    ),
    /GENESIS_INPUT_SHAPE_OR_DOMAIN_HOLD/u,
  );
  assert.throws(
    () => validateDisposableDevnetIdentityInput(identity, {
      now: NOW + 20 * 60 * 1000,
    }),
    /STALE_OR_FUTURE_HOLD/u,
  );
});

test("B15 recursive scan accepts ordinary id.rs but rejects key names and secret bytes", (t) => {
  const root = makeTemporaryRoot(t, "iat-b3-b15-scan-");
  const nested = join(root, "target", "debug");
  mkdirSync(join(root, "target"));
  mkdirSync(nested);
  writeFileSync(join(nested, "id.rs"), "pub const ID: u8 = 1;\n");
  writeFileSync(join(nested, "artifact.so"), Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  const clean = scanDisposableDevnetBuildTreeForKeyMaterial(root);
  assert.equal(clean.fileCount, 2);
  assert.equal(clean.forbiddenKeyMaterialObserved, false);

  const namedKey = join(nested, "operator-keypair.json");
  writeFileSync(namedKey, "{}\n");
  assert.throws(
    () => scanDisposableDevnetBuildTreeForKeyMaterial(root),
    /FORBIDDEN_KEY_MATERIAL_FILE_NAME_HOLD/u,
  );
  rmSync(namedKey);

  const secret = join(nested, "unexpected.json");
  writeFileSync(secret, `${JSON.stringify(Array.from({ length: 64 }, (_, index) => index))}\n`);
  assert.throws(
    () => scanDisposableDevnetBuildTreeForKeyMaterial(root),
    /FORBIDDEN_KEY_MATERIAL_BYTES_HOLD/u,
  );
  rmSync(secret);

  for (const [fileName, value] of [
    ["operator_private_key.json", { harmless: "synthetic" }],
    ["operator-secret_key.txt", "synthetic"],
    ["seed_phrase.json", { harmless: "synthetic" }],
    ["RecoveryPhrase.json", { harmless: "synthetic" }],
    ["operatorPrivateKey.json", { harmless: "synthetic" }],
    ["backupSecretKey.txt", "synthetic"],
    ["userSeedPhrase.json", { harmless: "synthetic" }],
    ["operatorKeypair.json", { harmless: "synthetic" }],
    ["operatorWallet.json", { harmless: "synthetic" }],
  ]) {
    const secretName = join(nested, fileName);
    writeFileSync(secretName, `${JSON.stringify(value)}\n`);
    assert.throws(
      () => scanDisposableDevnetBuildTreeForKeyMaterial(root),
      /FORBIDDEN_KEY_MATERIAL_FILE_NAME_HOLD/u,
      fileName,
    );
    rmSync(secretName);
  }

  for (const benignName of ["monkeyPairing.json", "walletView.ts", "privateKeyboard.md"]) {
    const benign = join(nested, benignName);
    writeFileSync(benign, "ordinary non-credential fixture\n");
    assert.doesNotThrow(() => scanDisposableDevnetBuildTreeForKeyMaterial(root), benignName);
    rmSync(benign);
  }

  for (const value of [
    { private_key: "SYNTHETIC_B19_NON_SECRET_MARKER" },
    { SecretKey: "SYNTHETIC_B19_NON_SECRET_MARKER" },
    { "seed-phrase": "SYNTHETIC_B19_NON_SECRET_MARKER" },
    { recovery_phrase: "SYNTHETIC_B19_NON_SECRET_MARKER" },
    { harmless: { nested: Array.from({ length: 64 }, (_, index) => index) } },
  ]) {
    writeFileSync(secret, `${JSON.stringify(value)}\n`);
    assert.throws(
      () => scanDisposableDevnetBuildTreeForKeyMaterial(root),
      /FORBIDDEN_KEY_MATERIAL_BYTES_HOLD/u,
      JSON.stringify(value).slice(0, 80),
    );
    rmSync(secret);
  }

  const paddedPem = join(nested, "late-marker.bin");
  writeFileSync(
    paddedPem,
    `${"x".repeat(1024 * 1024 + 256)}\n-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n`,
  );
  assert.throws(
    () => scanDisposableDevnetBuildTreeForKeyMaterial(root),
    /FORBIDDEN_KEY_MATERIAL_BYTES_HOLD/u,
  );
  rmSync(paddedPem);

  const oversizedJson = join(nested, "oversized.json");
  writeFileSync(oversizedJson, `${" ".repeat(1024 * 1024 + 1)}[]\n`);
  assert.throws(
    () => scanDisposableDevnetBuildTreeForKeyMaterial(root),
    /OVERSIZED_JSON_KEY_SCAN_HOLD/u,
  );
  rmSync(oversizedJson);

  const hardlink = join(nested, "artifact-copy.so");
  linkSync(join(nested, "artifact.so"), hardlink);
  assert.throws(
    () => scanDisposableDevnetBuildTreeForKeyMaterial(root),
    /HARDLINK_HOLD/u,
  );
});

test("B15 state refuses every readiness or authority promotion", () => {
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  for (const key of Object.keys(state.truth).filter((key) => key !== "mainnetStatus")) {
    const mutated = structuredClone(state);
    mutated.truth[key] = true;
    assert.throws(
      () => validateDisposableDevnetExecutionState(mutated),
      /CANONICAL_STATE_INVALID/u,
      key,
    );
  }
  const mainnet = structuredClone(state);
  mainnet.truth.mainnetStatus = "GO";
  assert.throws(
    () => validateDisposableDevnetExecutionState(mainnet),
    /CANONICAL_STATE_INVALID/u,
  );
  const evidence = structuredClone(state);
  evidence.evidence.transcript = { status: DISPOSABLE_DEVNET_EXECUTION_STATUS };
  assert.throws(
    () => validateDisposableDevnetExecutionState(evidence),
    /CANONICAL_STATE_INVALID/u,
  );
});

test("B15 source and docs retain private-brand offline nondeployment boundary", () => {
  const source = readFileSync(RUNNER_PATH, "utf8");
  const documentation = readFileSync(DOCUMENTATION_PATH, "utf8");
  assert.match(source, /const CANONICAL_EXECUTION_BRAND = Symbol/u);
  assert.doesNotMatch(source, /LIVE_CANONICAL_RESULTS/u);
  assert.doesNotMatch(source, /new WeakSet/u);
  assert.doesNotMatch(source, /export\s+(?:const|function)\s+CANONICAL_EXECUTION_BRAND/u);
  assert.doesNotMatch(source, /export\s+function\s+runCanonicalDisposableDevnetExecution/u);
  assert.match(source, /const HERMETIC_MOUNT_CAUSALITY_PROVEN = false/u);
  assert.match(source, /throw new Error\("HERMETIC_MOUNT_CAUSALITY_UNPROVEN"\)/u);
  const constructorStart = source.indexOf("function createCanonicalTranscript(");
  const constructorThrow = source.indexOf(
    'throw new Error("HERMETIC_MOUNT_CAUSALITY_UNPROVEN")',
    constructorStart,
  );
  const constructorBrandCheck = source.indexOf(
    "if (brand !== CANONICAL_EXECUTION_BRAND)",
    constructorStart,
  );
  assert.ok(constructorStart >= 0 && constructorThrow > constructorStart);
  assert.ok(constructorThrow < constructorBrandCheck);
  const runStart = source.indexOf("function runCanonicalDisposableDevnetExecution(");
  const runGuard = source.indexOf(
    "if (HERMETIC_MOUNT_CAUSALITY_PROVEN !== true)",
    runStart,
  );
  assert.ok(runStart >= 0 && runGuard > runStart);
  const preGuardRunSource = source.slice(runStart, runGuard);
  assert.match(preGuardRunSource, /assertDirectInvocation\(\)/u);
  assert.doesNotMatch(
    preGuardRunSource,
    /(?:spawnSync|spawnPinnedDocker|executePinnedContainer|validateOutputRoot|validateHostRuntime|validateDockerExecutable|observePinnedDocker|readStableRegularFile|mkdirSync|openSync|writeExclusiveFile|loadExactDeclaredHeadSource)\s*\(/u,
  );
  for (const boundary of [
    "validateOutputRoot(request.outputRoot)",
    "validateHostRuntime(environment)",
    "validateDockerExecutable()",
    "readStableRegularFile(request.identityPath",
    "readStableRegularFile(request.genesisPath",
  ]) {
    assert.ok(runGuard < source.indexOf(boundary, runStart), boundary);
  }
  assert.match(source, /spawnSync\(PINNED_DISPOSABLE_DEVNET_DOCKER_CLI\.absolutePath/u);
  assert.match(source, /observePinnedDockerHostExecutableBoundary\(\)/u);
  assert.match(source, /`--config=\$\{configBefore\.absolutePath\}`/u);
  assert.match(source, /cwd: DOCKER_TRUSTED_WORKING_DIRECTORY/u);
  assert.match(source, /observePinnedDockerSocket\(\)/u);
  assert.match(source, /observePinnedDockerRuntime/u);
  assert.match(source, /readFileSync\("\/proc\/self\/environ"\)/u);
  assert.match(source, /preexisting-absence-proof/u);
  assert.match(source, /postExecutionContainerAbsenceProven: true/u);
  assert.doesNotMatch(source, /\bfetch\s*\(/u);
  assert.doesNotMatch(source, /@solana\/web3\.js/u);
  assert.match(source, /"--pull=never"/u);
  assert.match(source, /"--network=none"/u);
  assert.match(source, /"--user=65534:65534"/u);
  assert.match(source, /record\.Config\?\.User/u);
  assert.match(source, /uid=0,gid=0,mode=0755/u);
  assert.match(source, /uid=65534,gid=65534,mode=0700/u);
  assert.match(source, /PRIVATE_INPUT_CLOSURE_INITIALIZED/u);
  assert.match(source, /requireStopBeforeArtifactRead: true/u);
  assert.match(source, /"container", "inspect"/u);
  assert.match(source, /"container", "start", name/u);
  assert.match(source, /"container",\s+"exec"/u);
  assert.match(source, /"container", "stop", "--time=10"/u);
  assert.match(source, /"container", "rm", "--force"/u);
  assert.match(source, /IMPLEMENTED_HARD_DISABLED_PENDING_INDEPENDENT_ACCEPTANCE/u);
  assert.match(source, /CONTAINER_PRIVATE_TMPFS/u);
  assert.match(source, /PRIVATE_INPUT_CLOSURE_PRE_CARGO/u);
  assert.match(source, /PRIVATE_INPUT_CLOSURE_POST_CARGO/u);
  assert.match(source, /PRIVATE_ARTIFACT_EXPORTED/u);
  assert.match(source, /SAME_BUILD_CONTAINER_PRIVATE_COPY_PRE_POST_FRAMES/u);
  assert.match(documentation, /does not generate identities/u);
  assert.match(documentation, /no RPC, signing, deployment/u);
  assert.match(documentation, /never promote a transcript read back from disk/u);
  assert.match(documentation, /HERMETIC_MOUNT_CAUSALITY_UNPROVEN/u);
  assert.match(
    documentation,
    /HERMETIC_SAME_CONTAINER_EXECUTION_CONTRACT_NOT_INDEPENDENTLY_ACCEPTED/u,
  );
  assert.match(documentation, /FINAL_RETAINED_FILE_LEDGER_NOT_INDEPENDENTLY_ACCEPTED/u);
  assert.match(documentation, /No Docker API, image creation, container, or build was invoked/u);
  assert.match(documentation, /uid\/gid 65534/u);
  assert.match(documentation, /exactly\s+three\s+canonical JSON frames/u);
  assert.match(documentation, new RegExp(DISPOSABLE_DEVNET_EXECUTION_GATE_ENVIRONMENT_VARIABLE, "u"));
  assert.match(documentation, new RegExp(DISPOSABLE_DEVNET_EXECUTION_GATE_VALUE, "u"));
});
