import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PINNED_COMBINED_LAW_BUILD_CONTAINER } from
  "../scripts/run-iat-b3-combined-law-reproducible-build.mjs";
import {
  DISPOSABLE_DEVNET_EVIDENCE_STATE_SCHEMA,
  DISPOSABLE_DEVNET_GENESIS_HASH,
  DISPOSABLE_DEVNET_GENESIS_OBSERVATION_SCHEMA,
  DISPOSABLE_DEVNET_IDENTITY_OBSERVATION_SCHEMA,
  DISPOSABLE_DEVNET_MAINNET_STATUS,
  DISPOSABLE_DEVNET_NETWORK,
  DISPOSABLE_DEVNET_PREFLIGHT_STRUCTURAL_HOLD,
  DISPOSABLE_DEVNET_RECEIPT_STRUCTURAL_HOLD,
  DISPOSABLE_DEVNET_RPC_URL,
  DISPOSABLE_DEVNET_SCOPE,
  createDisposableDevnetDualBuildPreflight,
  createDisposableDevnetDualBuildReceipt,
  describeDisposableDevnetExternalFile,
  disposableDevnetCanonicalSha256,
  formatDisposableDevnetBuildLog,
  observeDisposableDevnetExactGitSource,
  validateDisposableDevnetDualBuildPreflight,
  validateDisposableDevnetDualBuildReceipt,
  validateDisposableDevnetEvidenceState,
} from "../scripts/validate-iat-b3-disposable-devnet-dual-build-evidence.mjs";

const SITE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPOSITORY_ROOT = resolve(SITE_ROOT, "../../../..");
const SOURCE_REPOSITORY_ROOT = resolve(SITE_ROOT, "../../..");
const RUNNER_PATH = resolve(
  SITE_ROOT,
  "scripts/validate-iat-b3-disposable-devnet-dual-build-evidence.mjs",
);
const STATE_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-disposable-devnet-dual-build-evidence-state.v1.json",
);
const DOCUMENTATION_PATH = resolve(
  SITE_ROOT,
  "docs/b3/DISPOSABLE_DEVNET_DUAL_BUILD_CONTRACT.md",
);
const LAW_ID = "561MgDFoPA7SZsF5EEnDgaQGt55CoskK84za35FKvfUZ";
const ECONOMY_ID = "Fk3zwPUFjXzLcrLpNecyrdFG9EAPaYTESqcXVNQbNmBw";
const MINT_ID = "9SPZ7uR8eXMaFtNc5b9DKG1RS94e3YgkMDzCWDGbjset";
const FORBIDDEN_PRODUCTION_ID = "FSh75Nh67AvXravbH4XbW1gMKbZeWNCWHtVcM7MXnzfd";
const GENERATED_AT = "2026-08-13T08:05:00.000Z";
const OBSERVED_AT = "2026-08-13T08:00:00.000Z";
const RECEIPT_AT = "2026-08-13T08:15:00.000Z";
const LANE_ID = "b09-devnet-20260813T080000Z-0123456789abcdef";

function shaCharacter(character) {
  return character.repeat(64);
}

function createSourceContext(overrides = {}) {
  return {
    mode: "COMMITTED_REPOSITORY_DIRECT",
    headSha: "1".repeat(40),
    treeSha: "2".repeat(40),
    statusPorcelain: "",
    runnerPath:
      "projects/star-ascent/site/scripts/validate-iat-b3-disposable-devnet-dual-build-evidence.mjs",
    executedRunnerSha256: shaCharacter("3"),
    committedRunnerSha256: shaCharacter("3"),
    sourceClosureFileCount: 47,
    sourceClosureSha256: shaCharacter("4"),
    lawProductionFeatureClosureSha256: shaCharacter("5"),
    economyProductionFeatureClosureSha256: shaCharacter("6"),
    devnetDriverSha256: shaCharacter("7"),
    rpcUrl: DISPOSABLE_DEVNET_RPC_URL,
    genesisHash: DISPOSABLE_DEVNET_GENESIS_HASH,
    forbiddenIdentities: [FORBIDDEN_PRODUCTION_ID],
    ...overrides,
  };
}

function descriptor(path, maximumBytes = 16 * 1024 * 1024) {
  return describeDisposableDevnetExternalFile({
    absolutePath: resolve(path),
    repositoryRoot: REPOSITORY_ROOT,
    maximumBytes,
  });
}

function json(path, value) {
  writeFileSync(path, `${JSON.stringify(value)}\n`, "utf8");
  return descriptor(path, 16 * 1024);
}

function artifactBytes(label) {
  return Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from(label)]);
}

function repin(value, digestKey) {
  value[digestKey] = disposableDevnetCanonicalSha256(
    Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey)),
  );
  return value;
}

function makeFixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), "iat-b3-b09-contract-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sourceContext = createSourceContext(options.sourceContext);
  const identityPath = join(root, "identity-observation.json");
  const genesisPath = join(root, "genesis-observation.json");
  const identityRecord = {
    schema: DISPOSABLE_DEVNET_IDENTITY_OBSERVATION_SCHEMA,
    laneId: options.laneId ?? LANE_ID,
    observedAtUtc: OBSERVED_AT,
    sourceHeadSha: sourceContext.headSha,
    runnerSha256: sourceContext.committedRunnerSha256,
    generationMode: "FRESH_ISOLATED_OFFLINE_KEYGEN",
    lawProgramId: options.lawProgramId ?? LAW_ID,
    economyProgramId: ECONOMY_ID,
    canonicalMint: MINT_ID,
    publicKeysOnly: true,
    privateKeyMaterialIncluded: false,
  };
  const genesisRecord = {
    schema: DISPOSABLE_DEVNET_GENESIS_OBSERVATION_SCHEMA,
    laneId: options.laneId ?? LANE_ID,
    observedAtUtc: OBSERVED_AT,
    sourceHeadSha: sourceContext.headSha,
    runnerSha256: sourceContext.committedRunnerSha256,
    rpcUrl: DISPOSABLE_DEVNET_RPC_URL,
    method: "getGenesisHash",
    request: { jsonrpc: "2.0", id: 1, method: "getGenesisHash" },
    response: {
      jsonrpc: "2.0",
      id: 1,
      result: options.genesisHash ?? DISPOSABLE_DEVNET_GENESIS_HASH,
    },
  };
  const identityObservation = json(identityPath, identityRecord);
  const genesisObservation = json(genesisPath, genesisRecord);
  const container = {
    ...PINNED_COMBINED_LAW_BUILD_CONTAINER,
    localImageId: PINNED_COMBINED_LAW_BUILD_CONTAINER.platformManifestDigest,
  };
  const toolchain = {
    rustc: "rustc 1.97.1 (abcdef123 2026-07-14)",
    cargo: "cargo 1.97.1 (abcdef123 2026-06-30)",
    cargoBuildSbf: "solana-cargo-build-sbf 3.1.10",
  };
  const preflight = createDisposableDevnetDualBuildPreflight({
    generatedAtUtc: GENERATED_AT,
    laneId: options.laneId ?? LANE_ID,
    sourceContext,
    identityObservation,
    genesisObservation,
    container,
    toolchain,
    repositoryRoot: REPOSITORY_ROOT,
  });
  const firstRoot = join(root, "fresh-build-1");
  const secondRoot = join(root, "fresh-build-2");
  const preservedRoot = join(root, "preserved");
  for (const directory of [firstRoot, secondRoot, preservedRoot]) {
    mkdirSync(directory);
  }
  const lawBytes = artifactBytes("law-disposable-devnet");
  const economyBytes = artifactBytes("economy-disposable-devnet");
  function build(ordinal, workspaceRoot) {
    const lawArtifactPath = join(workspaceRoot, "iat_b3_law.so");
    const economyArtifactPath = join(workspaceRoot, "iat_b3_economy.so");
    const lawLogPath = join(workspaceRoot, "law-build.log");
    const economyLogPath = join(workspaceRoot, "economy-build.log");
    writeFileSync(lawArtifactPath, lawBytes);
    writeFileSync(economyArtifactPath, economyBytes);
    const lawArtifact = descriptor(lawArtifactPath);
    const economyArtifact = descriptor(economyArtifactPath);
    for (const [kind, path, builtArtifact] of [
      ["LAW", lawLogPath, lawArtifact],
      ["ECONOMY", economyLogPath, economyArtifact],
    ]) {
      writeFileSync(path, formatDisposableDevnetBuildLog({
        laneId: preflight.laneId,
        preflightSha256: preflight.preflightSha256,
        sourceHeadSha: preflight.source.declaredHeadSha,
        sourceClosureSha256: preflight.source.sourceClosureSha256,
        identityBindingSha256: preflight.identities.bindingSha256,
        buildOrdinal: ordinal,
        kind,
        workspaceRoot,
        backend: "DOCKER_ONLY",
        containerExecutionReference: preflight.container.executionReference,
        networkMode: "none",
        pullPolicy: "never",
        recipeSha256: preflight.recipes[kind.toLowerCase()].recipeSha256,
        environmentSha256: preflight.recipes[kind.toLowerCase()].environmentSha256,
        artifactSha256: builtArtifact.sha256,
        artifactByteLength: builtArtifact.byteLength,
        rawBuildOutput: `offline cargo build output ${kind} ${ordinal}\n`,
      }));
    }
    return {
      ordinal,
      workspaceRoot,
      workspaceWasFresh: true,
      targetDirectoryWasFresh: true,
      outputDirectoryWasFresh: true,
      law: {
        artifact: lawArtifact,
        rawLog: descriptor(lawLogPath),
      },
      economy: {
        artifact: economyArtifact,
        rawLog: descriptor(economyLogPath),
      },
    };
  }
  const firstBuild = build(1, firstRoot);
  const secondBuild = build(2, secondRoot);
  const preservedLawPath = join(preservedRoot, "iat_b3_law.so");
  const preservedEconomyPath = join(preservedRoot, "iat_b3_economy.so");
  writeFileSync(preservedLawPath, lawBytes);
  writeFileSync(preservedEconomyPath, economyBytes);
  const receipt = createDisposableDevnetDualBuildReceipt({
    generatedAtUtc: RECEIPT_AT,
    preflight,
    sourceContext,
    firstBuild,
    secondBuild,
    preservedRoot,
    preservedLawArtifact: descriptor(preservedLawPath),
    preservedEconomyArtifact: descriptor(preservedEconomyPath),
    repositoryRoot: REPOSITORY_ROOT,
  });
  return {
    root,
    sourceContext,
    identityPath,
    genesisPath,
    identityRecord,
    genesisRecord,
    preflight,
    receipt,
  };
}

test("canonical state is evidence-null HOLD and cannot authorize any execution", () => {
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  assert.equal(state.schema, DISPOSABLE_DEVNET_EVIDENCE_STATE_SCHEMA);
  assert.equal(validateDisposableDevnetEvidenceState(state), state);
  assert.equal(state.implementationBaseHeadSha, "21ad639a3a68d2352dcf53ba6097089f0418d236");
  assert.equal(state.status, "HOLD");
  assert.equal(state.contract.classification, "STRUCTURAL_CONTRACT_ONLY");
  assert.equal(state.contract.authorizing, false);
  assert.equal(state.evidence.preflight, null);
  assert.equal(state.evidence.receipt, null);
  assert.deepEqual(new Set(Object.values(state.truth)), new Set([false, "HOLD"]));
  assert(state.blockers.includes("DISPOSABLE_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE"));
});

test("a fully self-authored bundle is structural-only HOLD and proves no execution", (t) => {
  const fixture = makeFixture(t);
  assert.equal(
    validateDisposableDevnetDualBuildPreflight(fixture.preflight, {
      sourceContext: fixture.sourceContext,
      repositoryRoot: REPOSITORY_ROOT,
    }),
    fixture.preflight,
  );
  assert.equal(
    validateDisposableDevnetDualBuildReceipt(fixture.receipt, {
      preflight: fixture.preflight,
      sourceContext: fixture.sourceContext,
      repositoryRoot: REPOSITORY_ROOT,
    }),
    fixture.receipt,
  );
  assert.equal(
    fixture.preflight.status,
    DISPOSABLE_DEVNET_PREFLIGHT_STRUCTURAL_HOLD,
  );
  assert.equal(
    fixture.receipt.status,
    DISPOSABLE_DEVNET_RECEIPT_STRUCTURAL_HOLD,
  );
  assert.equal(fixture.receipt.scope, DISPOSABLE_DEVNET_SCOPE);
  assert.equal(fixture.preflight.devnet.network, DISPOSABLE_DEVNET_NETWORK);
  assert.equal(fixture.preflight.devnet.observedGenesisHash, DISPOSABLE_DEVNET_GENESIS_HASH);
  assert.equal(fixture.receipt.safety.classification, "STRUCTURAL_CONTRACT_ONLY");
  assert.equal(fixture.receipt.safety.selfAuthoredBundlePossible, true);
  assert.equal(fixture.receipt.safety.structuralByteEqualityRecorded, true);
  assert.equal(fixture.receipt.safety.executionProvenanceObserved, false);
  assert.equal(fixture.receipt.safety.buildExecutionObserved, false);
  assert.equal(fixture.receipt.safety.behavioralDevnetEvidence, false);
  assert.equal(fixture.receipt.safety.adversarialDevnetExecutionEvidence, false);
  assert.equal("directEvidenceObserved" in fixture.receipt.safety, false);
  assert.equal("behavioralDevnetBuildEvidence" in fixture.receipt.safety, false);
  assert.equal(fixture.receipt.safety.productionCandidate, false);
  assert.equal(fixture.receipt.safety.productionFinalByteEvidence, false);
  assert.equal(fixture.receipt.safety.devnetExecutionObserved, false);
  assert.equal(fixture.receipt.safety.mainnetStatus, DISPOSABLE_DEVNET_MAINNET_STATUS);
});

test("native backend or production-feature recipe drift is rejected", (t) => {
  const fixture = makeFixture(t);
  for (const mutate of [
    (value) => { value.recipes.law.backend = "NATIVE_WSL"; },
    (value) => { value.recipes.economy.feature = "sbf-preflight-entrypoint"; },
    (value) => { value.recipes.economy.networkPolicy = "ONLINE"; },
  ]) {
    const changed = structuredClone(fixture.preflight);
    mutate(changed);
    repin(changed, "preflightSha256");
    assert.throws(
      () => validateDisposableDevnetDualBuildPreflight(changed, {
        sourceContext: fixture.sourceContext,
        repositoryRoot: REPOSITORY_ROOT,
      }),
      /PRODUCTION_FEATURE_RECIPE|DRIFT_HOLD/u,
    );
  }
});

test("unpinned, online, or wrong-version container/toolchain claims are rejected", (t) => {
  const fixture = makeFixture(t);
  const cases = [
    (value) => { value.container.networkMode = "bridge"; },
    (value) => { value.container.pullPolicy = "always"; },
    (value) => { value.toolchain.rustc = "rustc 1.96.0 (abcdef123 2026-06-01)"; },
    (value) => { value.toolchain.cargoBuildSbf = "solana-cargo-build-sbf 3.2.0"; },
  ];
  for (const mutate of cases) {
    const changed = structuredClone(fixture.preflight);
    mutate(changed);
    repin(changed, "preflightSha256");
    assert.throws(
      () => validateDisposableDevnetDualBuildPreflight(changed, {
        sourceContext: fixture.sourceContext,
        repositoryRoot: REPOSITORY_ROOT,
      }),
      /CONTAINER|RUSTC_VERSION|CARGO_BUILD_SBF_VERSION/u,
    );
  }
});

test("source closure drift and runner drift fail closed even after digest repinning", (t) => {
  const fixture = makeFixture(t);
  for (const mutate of [
    (value) => { value.source.sourceClosureSha256 = shaCharacter("8"); },
    (value) => { value.source.executedRunnerSha256 = shaCharacter("9"); },
    (value) => { value.source.observedTreeSha = "a".repeat(40); },
  ]) {
    const changed = structuredClone(fixture.preflight);
    mutate(changed);
    repin(changed, "preflightSha256");
    assert.throws(
      () => validateDisposableDevnetDualBuildPreflight(changed, {
        sourceContext: fixture.sourceContext,
        repositoryRoot: REPOSITORY_ROOT,
      }),
      /SOURCE_BINDING_DRIFT_HOLD/u,
    );
  }
});

test("source context cannot claim a dirty tree or an uncommitted executed runner", (t) => {
  const fixture = makeFixture(t);
  for (const changedContext of [
    createSourceContext({ statusPorcelain: "?? injected.rs" }),
    createSourceContext({ executedRunnerSha256: shaCharacter("8") }),
  ]) {
    assert.throws(
      () => validateDisposableDevnetDualBuildPreflight(fixture.preflight, {
        sourceContext: changedContext,
        repositoryRoot: REPOSITORY_ROOT,
      }),
      /TRUSTED_SOURCE_CONTEXT_INVALID/u,
    );
  }
});

test("wrong Devnet Genesis is rejected from the self-authored raw record", (t) => {
  assert.throws(
    () => makeFixture(t, { genesisHash: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY" }),
    /SELF_AUTHORED_GENESIS_RECORD_INVALID/u,
  );
});

test("production or checked-in identity reuse is rejected", (t) => {
  assert.throws(
    () => makeFixture(t, { lawProgramId: FORBIDDEN_PRODUCTION_ID }),
    /PRODUCTION_OR_CHECKED_IN_IDENTITY_REUSE_HOLD/u,
  );
});

test("identity and Genesis records are time-windowed, lane-bound, and public-key-only", (t) => {
  const fixture = makeFixture(t);
  const cases = [
    (record) => { record.observedAtUtc = "2026-08-13T07:00:00.000Z"; },
    (record) => { record.laneId = "b09-devnet-20260813T080000Z-fedcba9876543210"; },
    (record) => { record.privateKeyMaterialIncluded = true; },
  ];
  for (const mutate of cases) {
    const record = structuredClone(fixture.identityRecord);
    mutate(record);
    const observation = json(fixture.identityPath, record);
    const changed = structuredClone(fixture.preflight);
    changed.identities.observation = observation;
    repin(changed, "preflightSha256");
    assert.throws(
      () => validateDisposableDevnetDualBuildPreflight(changed, {
        sourceContext: fixture.sourceContext,
        repositoryRoot: REPOSITORY_ROOT,
      }),
      /SELF_AUTHORED_IDENTITY_RECORD/u,
    );
  }
});

test("forged or self-repinned artifact digests cannot replace observed bytes", (t) => {
  const fixture = makeFixture(t);
  const changed = structuredClone(fixture.receipt);
  changed.builds.first.law.artifact.sha256 = shaCharacter("f");
  repin(changed, "receiptSha256");
  assert.throws(
    () => validateDisposableDevnetDualBuildReceipt(changed, {
      preflight: fixture.preflight,
      sourceContext: fixture.sourceContext,
      repositoryRoot: REPOSITORY_ROOT,
    }),
    /OBSERVED_BYTES_MISMATCH/u,
  );
});

test("different second-build bytes cannot produce a dual-build receipt", (t) => {
  const fixture = makeFixture(t);
  const artifactPath = fixture.receipt.builds.second.law.artifact.absolutePath;
  writeFileSync(artifactPath, artifactBytes("different-law-bytes"));
  const secondBuild = structuredClone(fixture.receipt.builds.second);
  secondBuild.law.artifact = descriptor(artifactPath);
  const logPath = secondBuild.law.rawLog.absolutePath;
  writeFileSync(logPath, formatDisposableDevnetBuildLog({
    laneId: fixture.preflight.laneId,
    preflightSha256: fixture.preflight.preflightSha256,
    sourceHeadSha: fixture.preflight.source.declaredHeadSha,
    sourceClosureSha256: fixture.preflight.source.sourceClosureSha256,
    identityBindingSha256: fixture.preflight.identities.bindingSha256,
    buildOrdinal: 2,
    kind: "LAW",
    workspaceRoot: secondBuild.workspaceRoot,
    backend: "DOCKER_ONLY",
    containerExecutionReference: fixture.preflight.container.executionReference,
    networkMode: "none",
    pullPolicy: "never",
    recipeSha256: fixture.preflight.recipes.law.recipeSha256,
    environmentSha256: fixture.preflight.recipes.law.environmentSha256,
    artifactSha256: secondBuild.law.artifact.sha256,
    artifactByteLength: secondBuild.law.artifact.byteLength,
    rawBuildOutput: "offline cargo build output LAW 2 with different bytes\n",
  }));
  secondBuild.law.rawLog = descriptor(logPath);
  assert.throws(
    () => createDisposableDevnetDualBuildReceipt({
      generatedAtUtc: RECEIPT_AT,
      preflight: fixture.preflight,
      sourceContext: fixture.sourceContext,
      firstBuild: fixture.receipt.builds.first,
      secondBuild,
      preservedRoot: fixture.receipt.preservedRoot,
      preservedLawArtifact: fixture.receipt.artifacts.law.preservedArtifact,
      preservedEconomyArtifact: fixture.receipt.artifacts.economy.preservedArtifact,
      repositoryRoot: REPOSITORY_ROOT,
    }),
    /DUAL_BUILD_BYTES_DIFFER_HOLD/u,
  );
});

test("cross-lane receipt and build-log substitution fail closed", (t) => {
  const fixture = makeFixture(t);
  const changed = structuredClone(fixture.receipt);
  changed.laneId = "b09-devnet-20260813T080000Z-fedcba9876543210";
  repin(changed, "receiptSha256");
  assert.throws(
    () => validateDisposableDevnetDualBuildReceipt(changed, {
      preflight: fixture.preflight,
      sourceContext: fixture.sourceContext,
      repositoryRoot: REPOSITORY_ROOT,
    }),
    /RECEIPT_SHAPE_OR_LANE_INVALID/u,
  );

  const logPath = fixture.receipt.builds.second.economy.rawLog.absolutePath;
  writeFileSync(logPath, formatDisposableDevnetBuildLog({
    laneId: "b09-devnet-20260813T080000Z-fedcba9876543210",
    preflightSha256: fixture.preflight.preflightSha256,
    sourceHeadSha: fixture.preflight.source.declaredHeadSha,
    sourceClosureSha256: fixture.preflight.source.sourceClosureSha256,
    identityBindingSha256: fixture.preflight.identities.bindingSha256,
    buildOrdinal: 2,
    kind: "ECONOMY",
    workspaceRoot: fixture.receipt.builds.second.workspaceRoot,
    backend: "DOCKER_ONLY",
    containerExecutionReference: fixture.preflight.container.executionReference,
    networkMode: "none",
    pullPolicy: "never",
    recipeSha256: fixture.preflight.recipes.economy.recipeSha256,
    environmentSha256: fixture.preflight.recipes.economy.environmentSha256,
    artifactSha256: fixture.receipt.builds.second.economy.artifact.sha256,
    artifactByteLength: fixture.receipt.builds.second.economy.artifact.byteLength,
    rawBuildOutput: "substituted cross-lane log\n",
  }));
  const substituted = structuredClone(fixture.receipt);
  substituted.builds.second.economy.rawLog = descriptor(logPath);
  repin(substituted, "receiptSha256");
  assert.throws(
    () => validateDisposableDevnetDualBuildReceipt(substituted, {
      preflight: fixture.preflight,
      sourceContext: fixture.sourceContext,
      repositoryRoot: REPOSITORY_ROOT,
    }),
    /BUILD_LOG_LANE_BINDING_DRIFT_HOLD/u,
  );
});

test("raw logs structurally bind Docker-only, recipe, and environment claims", (t) => {
  const fixture = makeFixture(t);
  const logPath = fixture.receipt.builds.first.law.rawLog.absolutePath;
  writeFileSync(logPath, formatDisposableDevnetBuildLog({
    laneId: fixture.preflight.laneId,
    preflightSha256: fixture.preflight.preflightSha256,
    sourceHeadSha: fixture.preflight.source.declaredHeadSha,
    sourceClosureSha256: fixture.preflight.source.sourceClosureSha256,
    identityBindingSha256: fixture.preflight.identities.bindingSha256,
    buildOrdinal: 1,
    kind: "LAW",
    workspaceRoot: fixture.receipt.builds.first.workspaceRoot,
    backend: "NATIVE_WSL",
    containerExecutionReference: fixture.preflight.container.executionReference,
    networkMode: "none",
    pullPolicy: "never",
    recipeSha256: fixture.preflight.recipes.law.recipeSha256,
    environmentSha256: fixture.preflight.recipes.law.environmentSha256,
    artifactSha256: fixture.receipt.builds.first.law.artifact.sha256,
    artifactByteLength: fixture.receipt.builds.first.law.artifact.byteLength,
    rawBuildOutput: "native output relabeled as Docker\n",
  }));
  const changed = structuredClone(fixture.receipt);
  changed.builds.first.law.rawLog = descriptor(logPath);
  repin(changed, "receiptSha256");
  assert.throws(
    () => validateDisposableDevnetDualBuildReceipt(changed, {
      preflight: fixture.preflight,
      sourceContext: fixture.sourceContext,
      repositoryRoot: REPOSITORY_ROOT,
    }),
    /BUILD_LOG_LANE_BINDING_DRIFT_HOLD/u,
  );
});

test("production receipt schemas and authorization promotion are impossible", (t) => {
  const fixture = makeFixture(t);
  const schemaSwap = structuredClone(fixture.receipt);
  schemaSwap.schema = "iat-b3-economy-exact-source-dual-sbf-build/v1";
  repin(schemaSwap, "receiptSha256");
  assert.throws(
    () => validateDisposableDevnetDualBuildReceipt(schemaSwap, {
      preflight: fixture.preflight,
      sourceContext: fixture.sourceContext,
      repositoryRoot: REPOSITORY_ROOT,
    }),
    /RECEIPT_SHAPE_OR_LANE_INVALID/u,
  );
  for (const key of [
    "executionProvenanceObserved",
    "buildExecutionObserved",
    "behavioralDevnetEvidence",
    "adversarialDevnetExecutionEvidence",
    "productionCandidate",
    "productionReceiptCompatible",
    "productionFinalByteEvidence",
    "devnetExecutionObserved",
    "releaseAuthorized",
    "mainnetExecutionAuthorized",
  ]) {
    const changed = structuredClone(fixture.receipt);
    changed.safety[key] = true;
    repin(changed, "receiptSha256");
    assert.throws(
      () => validateDisposableDevnetDualBuildReceipt(changed, {
        preflight: fixture.preflight,
        sourceContext: fixture.sourceContext,
        repositoryRoot: REPOSITORY_ROOT,
      }),
      /RECEIPT_SAFETY_DRIFT_HOLD/u,
    );
  }
});

test("paths must be external, distinct, regular, single-link files", (t) => {
  const fixture = makeFixture(t);
  const alias = structuredClone(fixture.receipt);
  alias.builds.second.law.rawLog = alias.builds.first.law.rawLog;
  repin(alias, "receiptSha256");
  assert.throws(
    () => validateDisposableDevnetDualBuildReceipt(alias, {
      preflight: fixture.preflight,
      sourceContext: fixture.sourceContext,
      repositoryRoot: REPOSITORY_ROOT,
    }),
    /BUILD_LOG_LANE_BINDING|PATH_ALIAS|PATH_ESCAPES_WORKSPACE/u,
  );
});

test("hard links, inode swaps, workspace replacement, and reparse parents fail closed", (t) => {
  {
    const fixture = makeFixture(t);
    const artifactPath = fixture.receipt.builds.first.law.artifact.absolutePath;
    linkSync(artifactPath, join(fixture.root, "law-hardlink.so"));
    assert.throws(
      () => validateDisposableDevnetDualBuildReceipt(fixture.receipt, {
        preflight: fixture.preflight,
        sourceContext: fixture.sourceContext,
        repositoryRoot: REPOSITORY_ROOT,
      }),
      /SAFE_BOUNDED_SINGLE_LINK_FILE_REQUIRED/u,
    );
  }
  {
    const fixture = makeFixture(t);
    const artifactPath = fixture.receipt.builds.first.law.artifact.absolutePath;
    const originalBytes = readFileSync(artifactPath);
    renameSync(artifactPath, `${artifactPath}.replaced`);
    writeFileSync(artifactPath, originalBytes);
    assert.throws(
      () => validateDisposableDevnetDualBuildReceipt(fixture.receipt, {
        preflight: fixture.preflight,
        sourceContext: fixture.sourceContext,
        repositoryRoot: REPOSITORY_ROOT,
      }),
      /OBSERVED_BYTES_MISMATCH/u,
    );
  }
  {
    const fixture = makeFixture(t);
    const workspace = fixture.receipt.builds.first.workspaceRoot;
    renameSync(workspace, `${workspace}.replaced`);
    mkdirSync(workspace);
    assert.throws(
      () => validateDisposableDevnetDualBuildReceipt(fixture.receipt, {
        preflight: fixture.preflight,
        sourceContext: fixture.sourceContext,
        repositoryRoot: REPOSITORY_ROOT,
      }),
      /DIRECTORY_IDENTITY_OR_PARENT_CHAIN_CHANGED_HOLD/u,
    );
  }
  {
    const root = mkdtempSync(join(tmpdir(), "iat-b3-b09-reparse-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const realDirectory = join(root, "real");
    const linkedDirectory = join(root, "linked");
    mkdirSync(realDirectory);
    writeFileSync(join(realDirectory, "record.json"), "{}\n");
    symlinkSync(
      realDirectory,
      linkedDirectory,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.throws(
      () => descriptor(join(linkedDirectory, "record.json")),
      /PARENT_REPARSE_OR_(?:NON_DIRECTORY|ALIAS)_HOLD/u,
    );
  }
});

test("Git replacement objects are ignored and the complete canonical tree is bound", (t) => {
  const root = mkdtempSync(join(tmpdir(), "iat-b3-b09-git-source-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (arguments_) => {
    const result = spawnSync("git", ["-C", root, ...arguments_], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(["init", "--quiet"]);
  git(["config", "user.name", "B09 source test"]);
  git(["config", "user.email", "b09@example.invalid"]);
  writeFileSync(join(root, "bound.txt"), "first tree\n");
  git(["add", "bound.txt"]);
  git(["commit", "--quiet", "-m", "first tree"]);
  const firstHead = git(["rev-parse", "HEAD"]);
  mkdirSync(join(root, "nested"));
  writeFileSync(join(root, "bound.txt"), "second tree\n");
  writeFileSync(join(root, "nested", "also-bound.txt"), "complete closure\n");
  git(["add", "bound.txt", "nested/also-bound.txt"]);
  git(["commit", "--quiet", "-m", "second tree"]);
  const secondHead = git(["rev-parse", "HEAD"]);
  const secondTree = git(["rev-parse", "HEAD^{tree}"]);
  git(["replace", secondHead, firstHead]);

  const observed = observeDisposableDevnetExactGitSource(root);
  assert.equal(observed.headSha, secondHead);
  assert.equal(observed.treeSha, secondTree);
  assert.equal(observed.statusPorcelain, "");
  assert.match(observed.treeClosureSha256, /^[0-9a-f]{64}$/u);
  assert.equal("treeEntries" in observed, false);

  writeFileSync(join(root, "nested", "third-bound.txt"), "tree drift\n");
  git(["add", "nested/third-bound.txt"]);
  git(["commit", "--quiet", "-m", "third tree"]);
  const changed = observeDisposableDevnetExactGitSource(root);
  assert.notEqual(changed.treeSha, observed.treeSha);
  assert.notEqual(changed.treeClosureSha256, observed.treeClosureSha256);
});

test("shared exact-source observation never invokes hostile clean or process filters", (t) => {
  const root = mkdtempSync(join(tmpdir(), "iat-b3-b09-hostile-filter-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const marker = join(root, "filter-invoked.txt");
  const trap = join(root, "filter-trap.cjs");
  const git = (arguments_) => {
    const result = spawnSync("git", ["-C", root, ...arguments_], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(["init", "--quiet"]);
  git(["config", "user.name", "B09 hostile-filter test"]);
  git(["config", "user.email", "b09-filter@example.invalid"]);
  writeFileSync(join(root, ".gitattributes"), "bound.txt filter=hostile\n");
  writeFileSync(join(root, "bound.txt"), "committed bytes\n");
  git(["add", ".gitattributes", "bound.txt"]);
  git(["commit", "--quiet", "-m", "hostile-filter fixture"]);
  writeFileSync(
    trap,
    `require("node:fs").appendFileSync(${JSON.stringify(marker)}, "invoked\\n"); process.stdin.pipe(process.stdout);\n`,
  );
  const command = `\"${process.execPath}\" \"${trap}\"`;
  git(["config", "filter.hostile.clean", command]);
  git(["config", "filter.hostile.process", command]);
  git(["config", "filter.hostile.required", "true"]);
  writeFileSync(join(root, "bound.txt"), "dirty bytes\n");

  const observed = observeDisposableDevnetExactGitSource(root);
  assert.match(observed.statusPorcelain, / M bound\.txt\0/u);
  assert.equal(existsSync(marker), false, "repository-local filters must not execute");
});

test("shared observer resolves the current Windows-linked worktree from WSL", () => {
  const observed = observeDisposableDevnetExactGitSource(SOURCE_REPOSITORY_ROOT);
  assert.match(observed.headSha, /^[0-9a-f]{40}$/u);
  assert.match(observed.treeSha, /^[0-9a-f]{40}$/u);
  assert.equal(typeof observed.statusPorcelain, "string");
  assert.match(observed.treeClosureSha256, /^[0-9a-f]{64}$/u);
});

test("contract source has no build, network, keygen, sign, or deploy executor", () => {
  const source = readFileSync(RUNNER_PATH, "utf8");
  const documentation = readFileSync(DOCUMENTATION_PATH, "utf8");
  assert.doesNotMatch(source, /execFileSync\("(?:docker|cargo|solana|rustc|trezorctl)"/u);
  assert.doesNotMatch(source, /from\s+["'](?:node:http|node:https|@solana\/web3\.js)["']/u);
  assert.doesNotMatch(source, /\b(?:sendAndConfirmTransaction|signTransaction|deployProgram)\s*\(/u);
  assert.doesNotMatch(source, /execFileSync|\["status"|status --porcelain/u);
  assert.match(source, /observeExactSource/u);
  assert.match(source, /readExactCommittedFile/u);
  assert.match(source, /O_NOFOLLOW/u);
  assert.match(source, /LSTAT_FSTAT_IDENTITY_MISMATCH_HOLD/u);
  assert.doesNotMatch(
    source,
    /PREFLIGHT_READY|RECEIPT_VERIFIED|directEvidenceObserved|behavioralDevnetBuildEvidence/u,
  );
  assert.match(documentation, /One process can self-author every JSON record/iu);
  assert.match(documentation, /executionProvenanceObserved = false/u);
  assert.match(documentation, /No platform-tools runtime observation is claimed/u);
});

test("no-input CLI validates the canonical packet and returns machine HOLD", () => {
  const result = spawnSync(process.execPath, [RUNNER_PATH], {
    cwd: SITE_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.status, "HOLD");
  assert.equal(report.structuralContractOnly, true);
  assert.equal(report.structuralContractValidated, false);
  assert.equal(report.executionProvenanceObserved, false);
  assert.equal(report.buildExecutionObserved, false);
  assert.equal(report.behavioralDevnetEvidence, false);
  assert.equal(report.productionFinalByteEvidence, false);
  assert.equal(report.mainnetExecutionAuthorized, false);
  assert.equal(report.mainnetStatus, "HOLD");
});
