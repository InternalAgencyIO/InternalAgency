import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
  DISPOSABLE_DEVNET_GENESIS_HASH,
  DISPOSABLE_DEVNET_GENESIS_INPUT_SCHEMA,
  DISPOSABLE_DEVNET_IDENTITY_INPUT_SCHEMA,
  DISPOSABLE_DEVNET_NETWORK,
  DISPOSABLE_DEVNET_RPC_URL,
  PINNED_DISPOSABLE_DEVNET_DOCKER_CLI,
  assessDisposableDevnetExecutionProvenance,
  createDisposableDevnetDockerBuildInvocationPlan,
  createDisposableDevnetToolchainInvocationPlan,
  disposableDevnetExecutionCanonicalSha256,
  runDisposableDevnetBuildExecutionWithInjectedExecutor,
  scanDisposableDevnetBuildTreeForKeyMaterial,
  validateDisposableDevnetExecutionState,
  validateDisposableDevnetDockerCreateArguments,
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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

test("B15 canonical state is a machine-readable nonauthorizing HOLD", () => {
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  assert.equal(state.schema, DISPOSABLE_DEVNET_EXECUTION_STATE_SCHEMA);
  assert.equal(validateDisposableDevnetExecutionState(state), state);
  assert.equal(state.status, "HOLD");
  assert.equal(state.evidence.transcript, null);
  assert.ok(Object.values(state.truth).every((value) => value === false || value === "HOLD"));
  assert.ok(state.blockers.includes("HERMETIC_MOUNT_CAUSALITY_UNPROVEN"));
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
  assert.match(source, /"container", "inspect"/u);
  assert.match(source, /"container", "start", "--attach"/u);
  assert.match(source, /"container", "rm", "--force"/u);
  assert.match(documentation, /does not generate identities/u);
  assert.match(documentation, /no RPC, signing, deployment/u);
  assert.match(documentation, /never promote a transcript read back from disk/u);
  assert.match(documentation, /HERMETIC_MOUNT_CAUSALITY_UNPROVEN/u);
  assert.match(documentation, new RegExp(DISPOSABLE_DEVNET_EXECUTION_GATE_ENVIRONMENT_VARIABLE, "u"));
  assert.match(documentation, new RegExp(DISPOSABLE_DEVNET_EXECUTION_GATE_VALUE, "u"));
});
