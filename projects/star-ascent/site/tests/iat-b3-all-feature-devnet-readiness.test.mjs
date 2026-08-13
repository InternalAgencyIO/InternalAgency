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
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALL_FEATURE_DEVNET_ASSESSMENT_SCHEMA,
  ALL_FEATURE_DEVNET_AUTOMATED_VERIFIER_LANE,
  ALL_FEATURE_DEVNET_AUTOMATED_VERIFIER_TYPE,
  ALL_FEATURE_DEVNET_AUTHORIZATION_CONFIRMATION,
  ALL_FEATURE_DEVNET_AUTHORIZATION_SCOPE,
  ALL_FEATURE_DEVNET_IDENTITY_POLICY,
  ALL_FEATURE_DEVNET_INPUT_SCHEMA,
  ALL_FEATURE_DEVNET_SIGNATURE_DEVICE,
  ALL_FEATURE_DEVNET_SOLE_HUMAN_GATE,
  ALL_FEATURE_PRODUCTION_BYTE_EVIDENCE_POLICY,
  ALL_FEATURE_PUBLIC_DEVNET_BEHAVIORAL_EVIDENCE_POLICY,
  REQUIRED_ALL_FEATURE_DEVNET_FAILURE_POLICY,
  assessAllFeatureDevnetReadiness,
  canonicalSha256,
  extractCanonicalCeremonyStages,
  extractCanonicalDevnetBoundary,
  observeAllFeatureDevnetExactSource,
  readAllFeatureDevnetExactCommittedFile,
} from "../scripts/assess-iat-b3-all-feature-devnet-readiness.mjs";
import {
  COMBINED_LAW_LFS_POLICY,
  COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
  COMBINED_LAW_SUBMODULE_POLICY,
  PINNED_COMBINED_LAW_BUILD_CONTAINER,
  createCombinedLawBuildReceipt,
} from "../scripts/run-iat-b3-combined-law-reproducible-build.mjs";
import {
  createEconomyBuildReceipt,
  inspectEconomyProductionSourceClosure,
} from "../scripts/run-iat-b3-economy-reproducible-build.mjs";
import {
  IAT_B3_PRODUCTION_SOURCE_KEYS,
  extractIatB3ProductionTransactionMaps,
  validateIatB3ProductionTransactionMaps,
} from "../scripts/lib/iat-b3-production-transaction-map.mjs";
import {
  COMBINED_HOOK_HOST_TEST_IDENTITIES,
  PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
  TEST_FIXTURE_IDENTITIES,
} from "../scripts/validate-iat-b3-identity-freeze.mjs";
import {
  loadProductionIdentityAuthorityEvidenceManifest,
  validateProductionIdentityAuthorityEvidenceManifest,
} from "../scripts/validate-iat-b3-production-identity-authority-evidence.mjs";
import {
  DISPOSABLE_DEVNET_GENESIS_HASH,
  DISPOSABLE_DEVNET_GENESIS_OBSERVATION_SCHEMA,
  DISPOSABLE_DEVNET_IDENTITY_OBSERVATION_SCHEMA,
  DISPOSABLE_DEVNET_RPC_URL,
  createDisposableDevnetDualBuildPreflight,
  createDisposableDevnetDualBuildReceipt,
  describeDisposableDevnetExternalFile,
  disposableDevnetCanonicalSha256,
  formatDisposableDevnetBuildLog,
} from "../scripts/validate-iat-b3-disposable-devnet-dual-build-evidence.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT_PATH = resolve(SITE_ROOT, "scripts/assess-iat-b3-all-feature-devnet-readiness.mjs");
const DOCUMENTATION_PATH = resolve(SITE_ROOT, "docs/b3/ALL_FEATURE_DEVNET_READINESS.md");
const PACKAGE_PATH = resolve(SITE_ROOT, "package.json");
const AUTHORITY_EVIDENCE_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-production-identity-authority-evidence.v1.json",
);
const DEVNET_DRIVER_PATH = resolve(SITE_ROOT, "scripts/iat-b3-devnet-rehearsal-driver.mjs");
const EVALUATION_UNIX_SECONDS = 2_000_000_000n;
const B09_OBSERVED_AT = "2033-05-18T03:23:20.000Z";
const B09_PREFLIGHT_AT = "2033-05-18T03:28:20.000Z";
const B09_RECEIPT_AT = "2033-05-18T03:30:20.000Z";
const B09_LANE_ID = "b09-devnet-20330518T032320Z-0123456789abcdef";
const HEAD = "1".repeat(40);
const TREE = "2".repeat(40);
const HEX = (character) => character.repeat(64);
const TOOLCHAIN = Object.freeze({
  rustc: "rustc 1.97.1 (8bab26f4f 2026-07-14)",
  cargo: "cargo 1.97.1 (c980f4866 2026-06-30)",
  cargoBuildSbf: "solana-cargo-build-sbf 3.1.10",
});
const CONTAINER = Object.freeze({
  ...PINNED_COMBINED_LAW_BUILD_CONTAINER,
  localImageId: `sha256:${"b".repeat(64)}`,
});
const PRODUCTION_SOURCE_PATHS = Object.freeze({
  economySource: "programs/iat_b3_economy/src/lib.rs",
  instructionSource: "programs/iat_b3_economy/src/production_instruction.rs",
  entrypointSource: "programs/iat_b3_economy/src/production_entrypoint.rs",
  dispatchSource: "programs/iat_b3_economy/src/production_dispatch.rs",
  initializationHoldSource: "programs/iat_b3_economy/src/production_initialization_policy_hold.rs",
  nativeAdapterSource: "programs/iat_b3_economy/src/native_adapter.rs",
  setEligibilitySource: "programs/iat_b3_economy/src/production_set_eligibility.rs",
  openPositionSource: "programs/iat_b3_economy/src/production_open_position.rs",
  openExecutorSource: "programs/iat_b3_economy/src/production_open_position_executor.rs",
  settleExecutorSource: "programs/iat_b3_economy/src/production_settle_position_week_executor.rs",
  settleCoreHoldSource: "programs/iat_b3_economy/src/production_settle_position_week.rs",
  claimLanePrincipalSource: "programs/iat_b3_economy/src/production_claim_lane_principal.rs",
  claimExecutorSource: "programs/iat_b3_economy/src/production_claim_lane_principal_executor.rs",
  withdrawPositionSource: "programs/iat_b3_economy/src/production_withdraw_position.rs",
  withdrawExecutorSource: "programs/iat_b3_economy/src/production_withdraw_position_executor.rs",
  closeSource: "programs/iat_b3_economy/src/production_close_position.rs",
  closeSpecSource: "programs/iat_b3_economy/tests/production_close_position_spec.rs",
  disabledRoundSource: "programs/iat_b3_economy/src/production_round_disabled.rs",
  stakeIngressRuntimeSource: "programs/iat_b3_economy/src/stake_ingress_runtime.rs",
  economicWriteGatesSource: "docs/b3/iat-b3-economic-write-gates.v1.json",
});
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (path) => readFileSync(resolve(SITE_ROOT, path), "utf8");
const sourceInput = () => Object.fromEntries(
  IAT_B3_PRODUCTION_SOURCE_KEYS.map((key) => [key, read(PRODUCTION_SOURCE_PATHS[key])]),
);
const PRODUCTION_MAP = extractIatB3ProductionTransactionMaps(sourceInput());
const authorityManifest = loadProductionIdentityAuthorityEvidenceManifest(AUTHORITY_EVIDENCE_PATH);
const authorityValidation = validateProductionIdentityAuthorityEvidenceManifest(authorityManifest);
const canonicalCeremonyStages = extractCanonicalCeremonyStages(
  authorityManifest,
  authorityValidation,
);
const devnetBoundary = extractCanonicalDevnetBoundary(readFileSync(DEVNET_DRIVER_PATH, "utf8"));
const temporaryRoots = [];
after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function materializedObservations() {
  return Array.from({ length: 4 }, () => ({
    schema: COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
    declaredHeadSha: HEAD,
    treeSha: TREE,
    mountedInputSha256: HEX("c"),
    fileCount: 40,
    byteLength: 80_000,
    lfsPointerCount: 0,
    ignoredWorktreeBytesIncluded: false,
    submodulePolicy: COMBINED_LAW_SUBMODULE_POLICY,
    lfsPolicy: COMBINED_LAW_LFS_POLICY,
  }));
}

function sourceObservations() {
  return Array.from({ length: 4 }, () => ({
    headSha: HEAD,
    treeSha: TREE,
    statusPorcelain: "",
  }));
}

function disposableDevnetSourceContext(overrides = {}) {
  return {
    mode: "COMMITTED_REPOSITORY_DIRECT",
    headSha: HEAD,
    treeSha: TREE,
    statusPorcelain: "",
    runnerPath:
      "projects/star-ascent/site/scripts/validate-iat-b3-disposable-devnet-dual-build-evidence.mjs",
    executedRunnerSha256: HEX("b"),
    committedRunnerSha256: HEX("b"),
    sourceClosureFileCount: 47,
    sourceClosureSha256: HEX("c"),
    lawProductionFeatureClosureSha256: HEX("d"),
    economyProductionFeatureClosureSha256: HEX("e"),
    devnetDriverSha256: HEX("f"),
    rpcUrl: DISPOSABLE_DEVNET_RPC_URL,
    genesisHash: DISPOSABLE_DEVNET_GENESIS_HASH,
    forbiddenIdentities: [TEST_FIXTURE_IDENTITIES.lawProgramId],
    ...overrides,
  };
}

function readyContext() {
  const identities = {
    lawProgramId: TEST_FIXTURE_IDENTITIES.lawProgramId,
    economyProgramId: TEST_FIXTURE_IDENTITIES.economyProgramId,
    canonicalMint: TEST_FIXTURE_IDENTITIES.canonicalMint,
    compiledLawDomainGenesisHash: TEST_FIXTURE_IDENTITIES.genesisHash,
  };
  return {
    source: { headSha: HEAD, treeSha: TREE, statusPorcelain: "" },
    devnetBoundary,
    operationMaps: {
      ready: true,
      failure: null,
      executedModuleSha256: HEX("1"),
      committedModuleSha256: HEX("1"),
      bindingSha256: PRODUCTION_MAP.canonicalMapSha256,
      map: PRODUCTION_MAP,
    },
    ceremonyStages: { ...canonicalCeremonyStages, valid: true, failure: null },
    dispatchTruth: {
      instruction_abi_frozen: true,
      all_15_instruction_routes_frozen: true,
      account_identity_graph_complete: true,
      handler_dispatch_exposed: true,
      entrypoint_exposed: true,
      account_writes_executed: true,
      any_handler_complete: true,
    },
    all15MatrixTruth: {
      complete: true,
      accountIdentityGraphComplete: true,
      instructionAbiFrozen: true,
      solanaEntrypoint: true,
      publicDispatcher: true,
      configCodecSupported: true,
      ownerPolicyFrozen: true,
      anyHandlerComplete: true,
      publicDevnetDriverWired: true,
    },
    ownerPolicyValidation: {
      valid: true,
      ownerChoicesStructurallyComplete: true,
      safeDecisionOrderSatisfied: true,
      blockers: [],
      violations: [],
    },
    authorityValidation: { valid: true, violations: [] },
    releaseValidation: {
      valid: true,
      dependencyInventoryComplete: true,
      dependencyGraphValid: true,
      violations: [],
    },
    releaseNodes: [],
    knownProductionIdentities: {
      lawProgramId: identities.lawProgramId,
      economyProgramId: identities.economyProgramId,
      canonicalMint: identities.canonicalMint,
    },
    forbiddenDevnetIdentities: [],
    productionBuildSource: {
      ready: true,
      failure: null,
      manifestSha256: HEX("5"),
      ownerPolicySha256: HEX("6"),
      lawEnvironmentSha256: HEX("7"),
      economyEnvironmentSha256: HEX("8"),
      identities,
      identityBindingSha256: canonicalSha256(identities),
      runnerSha256: { law: HEX("9"), economy: HEX("a") },
    },
    disposableDevnetBuildSource: {
      ready: true,
      failure: null,
      sourceContext: disposableDevnetSourceContext(),
    },
    toolchainPolicy: {
      hostPlatform: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.hostPlatform,
      rustToolchain: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.rustToolchain,
      cargoBuildSbfVersion: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.cargoBuildSbfVersion,
      platformToolsVersion: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.platformToolsVersion,
      containerExecutionReference: PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
      networkPolicy: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.networkPolicy,
      dualFreshBuilds: true,
    },
  };
}

function writeBound(root, name, bytes) {
  const path = join(root, name);
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  writeFileSync(path, value);
  return { path, sha256: sha256(value), byteLength: value.length };
}

function createProductionEvidence(context, root) {
  const lawArtifactBytes = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from("law-final")]);
  const economyArtifactBytes = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from("economy-final")]);
  const lawLogOne = Buffer.from("law build one\n");
  const lawLogTwo = Buffer.from("law build two\n");
  const economyLogOne = Buffer.from("economy build one\n");
  const economyLogTwo = Buffer.from("economy build two\n");
  const lawReceipt = createCombinedLawBuildReceipt({
    generatedAt: "2033-05-18T03:33:20.000Z",
    declaredHeadSha: HEAD,
    sourceObservations: sourceObservations(),
    materializedSourceObservations: materializedObservations(),
    runnerBinding: {
      executedRunnerSha256: context.productionBuildSource.runnerSha256.law,
      committedRunnerSha256: context.productionBuildSource.runnerSha256.law,
    },
    identityBinding: {
      manifestPath: "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
      manifestSha256: context.productionBuildSource.manifestSha256,
      environmentBindingSha256: context.productionBuildSource.lawEnvironmentSha256,
      canonicalManifestReady: true,
    },
    containerObservation: CONTAINER,
    toolchainObservation: TOOLCHAIN,
    firstArtifact: {
      fileName: "iat_b3_law.so", bytes: lawArtifactBytes, logSha256: sha256(lawLogOne),
    },
    secondArtifact: {
      fileName: "iat_b3_law.so", bytes: lawArtifactBytes, logSha256: sha256(lawLogTwo),
    },
    preservedArtifact: {
      fileName: "iat_b3_law.so", bytes: lawArtifactBytes,
      atomicNoOverwrite: true, readbackVerified: true,
    },
  });
  const sourceClosure = inspectEconomyProductionSourceClosure({
    cargoManifestSource: read("programs/iat_b3_economy/Cargo.toml"),
    librarySource: read("programs/iat_b3_economy/src/lib.rs"),
    entrypointSource: read("programs/iat_b3_economy/src/production_entrypoint.rs"),
    buildScriptSource: read("programs/iat_b3_economy/build.rs"),
  });
  const economyReceipt = createEconomyBuildReceipt({
    generatedAt: "2033-05-18T03:33:20.000Z",
    declaredHeadSha: HEAD,
    sourceObservations: sourceObservations(),
    materializedSourceObservations: materializedObservations(),
    runnerBinding: {
      executedRunnerSha256: context.productionBuildSource.runnerSha256.economy,
      committedRunnerSha256: context.productionBuildSource.runnerSha256.economy,
    },
    sourceClosure,
    identityBinding: {
      manifestPath: "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
      manifestSha256: context.productionBuildSource.manifestSha256,
      ownerPolicyPath: "projects/star-ascent/site/docs/b3/iat-b3-owner-policy-freeze.v1.json",
      ownerPolicySha256: context.productionBuildSource.ownerPolicySha256,
      environmentNames: [
        "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
        "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
        "IAT_B3_PRODUCTION_CANONICAL_MINT",
        "IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH",
      ],
      environmentBindingSha256: context.productionBuildSource.economyEnvironmentSha256,
      canonicalManifestReady: true,
    },
    containerObservation: CONTAINER,
    toolchainObservation: TOOLCHAIN,
    firstArtifact: {
      fileName: "iat_b3_economy.so", bytes: economyArtifactBytes,
      logSha256: sha256(economyLogOne),
    },
    secondArtifact: {
      fileName: "iat_b3_economy.so", bytes: economyArtifactBytes,
      logSha256: sha256(economyLogTwo),
    },
    preservedArtifact: {
      fileName: "iat_b3_economy.so", bytes: economyArtifactBytes,
      atomicNoOverwrite: true, readbackVerified: true,
    },
  });
  const files = {
    lawArtifact: writeBound(root, "law.so", lawArtifactBytes),
    lawReceipt: writeBound(root, "law-receipt.json", JSON.stringify(lawReceipt)),
    lawLogOne: writeBound(root, "law-one.log", lawLogOne),
    lawLogTwo: writeBound(root, "law-two.log", lawLogTwo),
    economyArtifact: writeBound(root, "economy.so", economyArtifactBytes),
    economyReceipt: writeBound(root, "economy-receipt.json", JSON.stringify(economyReceipt)),
    economyLogOne: writeBound(root, "economy-one.log", economyLogOne),
    economyLogTwo: writeBound(root, "economy-two.log", economyLogTwo),
    localPreflight: writeBound(root, "local-preflight.json", "{}"),
    localExecution: writeBound(root, "local-execution.json", "{}"),
  };
  const descriptor = (kind, artifact, receipt, firstLog, secondLog) => ({
    kind,
    artifactPath: artifact.path,
    artifactSha256: artifact.sha256,
    artifactByteLength: artifact.byteLength,
    receiptPath: receipt.path,
    receiptFileSha256: receipt.sha256,
    firstBuildLogPath: firstLog.path,
    firstBuildLogSha256: firstLog.sha256,
    secondBuildLogPath: secondLog.path,
    secondBuildLogSha256: secondLog.sha256,
  });
  return {
    evidence: {
      policy: ALL_FEATURE_PRODUCTION_BYTE_EVIDENCE_POLICY,
      identities: {
        ...context.productionBuildSource.identities,
        bindingSha256: context.productionBuildSource.identityBindingSha256,
      },
      artifacts: {
        law: descriptor("LAW", files.lawArtifact, files.lawReceipt, files.lawLogOne, files.lawLogTwo),
        economy: descriptor("ECONOMY", files.economyArtifact, files.economyReceipt, files.economyLogOne, files.economyLogTwo),
      },
      localValidator: {
        preflightPath: files.localPreflight.path,
        preflightFileSha256: files.localPreflight.sha256,
        executionReceiptPath: files.localExecution.path,
        executionReceiptFileSha256: files.localExecution.sha256,
        isolatedLoopbackOnly: true,
        productionPublicIdsPreloaded: true,
        productionPrivateKeysUsed: false,
        compiledMainnetLawDomain: true,
        validatorGenesisClaimedMainnet: false,
        publicNetworkUsed: false,
      },
      publicDevnetCannotSatisfyFinalByteProof: true,
    },
    files,
    receipts: { law: lawReceipt, economy: economyReceipt },
  };
}

function describeB09(path, maximumBytes = 16 * 1024 * 1024) {
  return describeDisposableDevnetExternalFile({
    absolutePath: resolve(path),
    repositoryRoot: SITE_ROOT,
    maximumBytes,
  });
}

function writeB09Json(path, value) {
  writeFileSync(path, `${JSON.stringify(value)}\n`, "utf8");
  return describeB09(path, 16 * 1024);
}

function repinB09(value, digestKey) {
  value[digestKey] = disposableDevnetCanonicalSha256(
    Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey)),
  );
  return value;
}

function createB09Evidence(
  context,
  root,
  { lawBytes: lawBytesOverride, laneId = B09_LANE_ID } = {},
) {
  const sourceContext = context.disposableDevnetBuildSource.sourceContext;
  const identityPath = join(root, "b09-identity-observation.json");
  const genesisPath = join(root, "b09-genesis-observation.json");
  const identityRecord = {
    schema: DISPOSABLE_DEVNET_IDENTITY_OBSERVATION_SCHEMA,
    laneId,
    observedAtUtc: B09_OBSERVED_AT,
    sourceHeadSha: sourceContext.headSha,
    runnerSha256: sourceContext.committedRunnerSha256,
    generationMode: "FRESH_ISOLATED_OFFLINE_KEYGEN",
    ...COMBINED_HOOK_HOST_TEST_IDENTITIES,
    publicKeysOnly: true,
    privateKeyMaterialIncluded: false,
  };
  const genesisRecord = {
    schema: DISPOSABLE_DEVNET_GENESIS_OBSERVATION_SCHEMA,
    laneId,
    observedAtUtc: B09_OBSERVED_AT,
    sourceHeadSha: sourceContext.headSha,
    runnerSha256: sourceContext.committedRunnerSha256,
    rpcUrl: DISPOSABLE_DEVNET_RPC_URL,
    method: "getGenesisHash",
    request: { jsonrpc: "2.0", id: 1, method: "getGenesisHash" },
    response: { jsonrpc: "2.0", id: 1, result: DISPOSABLE_DEVNET_GENESIS_HASH },
  };
  const identityObservation = writeB09Json(identityPath, identityRecord);
  const genesisObservation = writeB09Json(genesisPath, genesisRecord);
  const preflight = createDisposableDevnetDualBuildPreflight({
    generatedAtUtc: B09_PREFLIGHT_AT,
    laneId,
    sourceContext,
    identityObservation,
    genesisObservation,
    container: CONTAINER,
    toolchain: TOOLCHAIN,
    repositoryRoot: SITE_ROOT,
  });
  const firstRoot = join(root, "b09-fresh-build-1");
  const secondRoot = join(root, "b09-fresh-build-2");
  const preservedRoot = join(root, "b09-preserved");
  for (const directory of [firstRoot, secondRoot, preservedRoot]) mkdirSync(directory);
  const lawBytes = lawBytesOverride ?? Buffer.concat([
    Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
    Buffer.from("b09-law-disposable-devnet"),
  ]);
  const economyBytes = Buffer.concat([
    Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
    Buffer.from("b09-economy-disposable-devnet"),
  ]);
  function build(ordinal, workspaceRoot) {
    const lawArtifactPath = join(workspaceRoot, "iat_b3_law.so");
    const economyArtifactPath = join(workspaceRoot, "iat_b3_economy.so");
    const lawLogPath = join(workspaceRoot, "law-build.log");
    const economyLogPath = join(workspaceRoot, "economy-build.log");
    writeFileSync(lawArtifactPath, lawBytes);
    writeFileSync(economyArtifactPath, economyBytes);
    const lawArtifact = describeB09(lawArtifactPath);
    const economyArtifact = describeB09(economyArtifactPath);
    for (const [kind, path, artifact] of [
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
        artifactSha256: artifact.sha256,
        artifactByteLength: artifact.byteLength,
        rawBuildOutput: `synthetic offline Docker output ${kind} ${ordinal}\n`,
      }));
    }
    return {
      ordinal,
      workspaceRoot,
      workspaceWasFresh: true,
      targetDirectoryWasFresh: true,
      outputDirectoryWasFresh: true,
      law: { artifact: lawArtifact, rawLog: describeB09(lawLogPath) },
      economy: { artifact: economyArtifact, rawLog: describeB09(economyLogPath) },
    };
  }
  const firstBuild = build(1, firstRoot);
  const secondBuild = build(2, secondRoot);
  const preservedLawPath = join(preservedRoot, "iat_b3_law.so");
  const preservedEconomyPath = join(preservedRoot, "iat_b3_economy.so");
  writeFileSync(preservedLawPath, lawBytes);
  writeFileSync(preservedEconomyPath, economyBytes);
  const receipt = createDisposableDevnetDualBuildReceipt({
    generatedAtUtc: B09_RECEIPT_AT,
    preflight,
    sourceContext,
    firstBuild,
    secondBuild,
    preservedRoot,
    preservedLawArtifact: describeB09(preservedLawPath),
    preservedEconomyArtifact: describeB09(preservedEconomyPath),
    repositoryRoot: SITE_ROOT,
  });
  const preflightFile = writeBound(root, "b09-preflight.json", JSON.stringify(preflight));
  const receiptFile = writeBound(root, "b09-receipt.json", JSON.stringify(receipt));
  return {
    evidence: {
      policy: ALL_FEATURE_PUBLIC_DEVNET_BEHAVIORAL_EVIDENCE_POLICY,
      preflightPath: preflightFile.path,
      preflightFileSha256: preflightFile.sha256,
      receiptPath: receiptFile.path,
      receiptFileSha256: receiptFile.sha256,
      devnetDomain: devnetBoundary.genesisHash,
      disposableIdentities: true,
      productionArtifactReuseForbidden: true,
      finalByteEvidenceAccepted: false,
    },
    sourceContext,
    preflight,
    receipt,
    identityRecord,
    genesisRecord,
    files: { identityPath, genesisPath, preflightFile, receiptFile },
  };
}

function refreshPublicBindings(fixture) {
  const binding = canonicalSha256(fixture.packet.publicDevnetBehavioralEvidence);
  fixture.packet.authorization.publicDevnetBehavioralEvidenceSha256 = binding;
  fixture.packet.automatedVerification.publicDevnetBehavioralEvidenceSha256 = binding;
}

function readyFixture({ reuseProductionLawBytes = false, laneId = B09_LANE_ID } = {}) {
  const context = readyContext();
  const root = mkdtempSync(join(tmpdir(), "iat-b3-d03-"));
  temporaryRoots.push(root);
  const production = createProductionEvidence(context, root);
  const publicBuild = createB09Evidence(context, root, {
    lawBytes: reuseProductionLawBytes
      ? readFileSync(production.files.lawArtifact.path)
      : undefined,
    laneId,
  });
  const identities = { ...COMBINED_HOOK_HOST_TEST_IDENTITIES };
  const publicEvidence = publicBuild.evidence;
  const funding = {
    mode: "EXPLICIT_DISPOSABLE_DEVNET_PAYER",
    payerPublicKey: "D8FDYUMd5PZxDenEDvE3KRERzKdU8k3rrebw173HUZLh",
    observedBalanceLamports: "5000000000",
    requiredPeakLamports: "4000000000",
    observationUnixSeconds: EVALUATION_UNIX_SECONDS.toString(),
    observationSha256: HEX("f"),
    approvalId: "funding-approval/fixture-0001",
    approved: true,
  };
  const failurePolicy = structuredClone(REQUIRED_ALL_FEATURE_DEVNET_FAILURE_POLICY);
  const bindings = {
    declaredHeadSha: HEAD,
    productionByteEvidenceSha256: HEX("d"),
    publicDevnetBehavioralEvidenceSha256: canonicalSha256(publicEvidence),
    operationMapsSha256: context.operationMaps.bindingSha256,
    ceremonyStagesSha256: context.ceremonyStages.bindingSha256,
    fundingSha256: canonicalSha256(funding),
    failurePolicySha256: canonicalSha256(failurePolicy),
  };
  const packet = {
    schema: ALL_FEATURE_DEVNET_INPUT_SCHEMA,
    declaredHeadSha: HEAD,
    productionToolchain: structuredClone(context.toolchainPolicy),
    productionByteEvidence: production.evidence,
    publicDevnetBehavioralEvidence: publicEvidence,
    clusterPolicy: {
      network: "solana-devnet",
      rpcUrl: devnetBoundary.rpcUrl,
      genesisHash: devnetBoundary.genesisHash,
      identityPolicy: ALL_FEATURE_DEVNET_IDENTITY_POLICY,
      identities,
      allIdentitiesNonProduction: true,
      programsDisposable: true,
      mintDisposable: true,
      mainnetIdentityReuseForbidden: true,
      keysRetainedUntilFinalReconciliation: true,
      cleanupPlanSha256: HEX("e"),
    },
    funding,
    authorization: {
      confirmation: ALL_FEATURE_DEVNET_AUTHORIZATION_CONFIRMATION,
      scope: ALL_FEATURE_DEVNET_AUTHORIZATION_SCOPE,
      soleHumanGate: ALL_FEATURE_DEVNET_SOLE_HUMAN_GATE,
      signatureDeviceModel: ALL_FEATURE_DEVNET_SIGNATURE_DEVICE,
      allNonSignatureClaimsDirectlyObserved: true,
      authorizationId: "devnet-authorization/fixture-0001",
      authorizedBy: "owner-authorizer/fixture-0001",
      authorized: true,
      authorizedAtUnixSeconds: EVALUATION_UNIX_SECONDS.toString(),
      expiresAtUnixSeconds: (EVALUATION_UNIX_SECONDS + 1_800n).toString(),
      ...bindings,
    },
    automatedVerification: {
      verificationId: "automated-verification/fixture-0001",
      verifierType: ALL_FEATURE_DEVNET_AUTOMATED_VERIFIER_TYPE,
      verifierLane: ALL_FEATURE_DEVNET_AUTOMATED_VERIFIER_LANE,
      directEvidenceOnly: true,
      humanReviewerRequired: false,
      accepted: true,
      verifiedAtUnixSeconds: EVALUATION_UNIX_SECONDS.toString(),
      ...bindings,
    },
    failurePolicy,
  };
  return { context, packet, production, publicBuild, root };
}

function assess(fixture) {
  return assessAllFeatureDevnetReadiness({
    packet: fixture.packet,
    context: fixture.context,
    repositoryRoot: SITE_ROOT,
    evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
  });
}

function blockerCodes(result) {
  return new Set(result.blockers.map(({ code }) => code));
}

test("R06 production map binds the Daily-Law prefix, all 15 exact meta counts, and opcode9 conditional lanes", () => {
  assert.equal(validateIatB3ProductionTransactionMaps(PRODUCTION_MAP), true);
  assert.equal(PRODUCTION_MAP.operations.length, 15);
  assert.deepEqual(
    PRODUCTION_MAP.operations.map(({ variants }) => [...new Set(variants.map(({ totalMetaCount }) => totalMetaCount))]),
    [[1], [1], [1], [1], [1], [6], [17, 18], [17], [1], [12, 1], [12], [7], [1], [1], [1]],
  );
  assert.deepEqual(PRODUCTION_MAP.transactionPrefix, {
    accountCount: 1,
    role: "daily_law_state",
    isSigner: false,
    isWritable: false,
    authenticatedBeforeAbiDecode: true,
  });
  assert.deepEqual(
    PRODUCTION_MAP.operations[9].variants.map(({ name, lanes, excludedLanes, totalMetaCount }) => ({
      name, lanes: lanes ?? null, excludedLanes: excludedLanes ?? null, totalMetaCount,
    })),
    [
      { name: "NON_CORE_ACTIVE", lanes: [1, 2, 4], excludedLanes: null, totalMetaCount: 12 },
      { name: "CORE_CUSTODY_HOLD", lanes: [3], excludedLanes: null, totalMetaCount: 1 },
      { name: "INVALID_LANE", lanes: null, excludedLanes: [1, 2, 3, 4], totalMetaCount: 1 },
    ],
  );
});

test("production-map source mutation and a legacy-map-shaped injected context fail closed", () => {
  const drift = sourceInput();
  drift.entrypointSource = drift.entrypointSource.replace(".split_first()", ".split_last()");
  assert.throws(
    () => extractIatB3ProductionTransactionMaps(drift),
    /one Law prefix split/u,
  );
  const fixture = readyFixture();
  fixture.context.operationMaps = { count: 15, maps: [], bindingSha256: HEX("0") };
  const result = assess(fixture);
  assert.equal(result.status, "HOLD_TEST");
  assert(blockerCodes(result).has("PRODUCTION_TRANSACTION_MAP_UNAVAILABLE"));
});

test("strict Docker receipts and raw logs are observed, but unavailable local execution remains HOLD_TEST", () => {
  const fixture = readyFixture();
  const result = assess(fixture);
  assert.equal(result.status, "HOLD_TEST");
  assert.equal(result.productionByteEvidence.artifacts.law.dockerReceiptValidated, true);
  assert.equal(result.productionByteEvidence.artifacts.economy.dockerReceiptValidated, true);
  assert.equal(result.productionByteEvidence.ready, false);
  const codes = blockerCodes(result);
  assert(codes.has("PRODUCTION_LOCAL_VALIDATOR_EVIDENCE_INVALID"));
  assert(codes.has("PRODUCTION_LOCAL_FINAL_BYTE_EXECUTION_NOT_ACCEPTED"));
  assert(codes.has("TEST_ONLY_CONTEXT_INJECTED"));
  assert.equal(result.safety.injectedTestEvidenceAccepted, false);
});

test("forged runner binding is rejected even after attacker recomputes the receipt digest", () => {
  const fixture = readyFixture();
  const forged = structuredClone(fixture.production.receipts.law);
  forged.source.executedRunnerSha256 = HEX("4");
  forged.source.committedRunnerSha256 = HEX("4");
  const { receiptSha256: ignored, ...core } = forged;
  assert(ignored);
  forged.receiptSha256 = canonicalSha256(core);
  const bytes = Buffer.from(JSON.stringify(forged));
  writeFileSync(fixture.production.files.lawReceipt.path, bytes);
  fixture.packet.productionByteEvidence.artifacts.law.receiptFileSha256 = sha256(bytes);
  const result = assess(fixture);
  assert.equal(result.productionByteEvidence.artifacts.law, null);
  assert(blockerCodes(result).has("PRODUCTION_LAW_EVIDENCE_INVALID"));
});

test("native, duplicate-key, and hard-linked receipt files are categorically rejected", () => {
  for (const variant of ["native", "duplicate", "hardlink"]) {
    const fixture = readyFixture();
    if (variant === "native") {
      const bytes = Buffer.from(JSON.stringify({ schema: "iat-b3-native-wsl-build-receipt/v1" }));
      writeFileSync(fixture.production.files.lawReceipt.path, bytes);
      fixture.packet.productionByteEvidence.artifacts.law.receiptFileSha256 = sha256(bytes);
    } else if (variant === "duplicate") {
      const bytes = Buffer.from('{"schema":"a","schema":"b"}');
      writeFileSync(fixture.production.files.lawReceipt.path, bytes);
      fixture.packet.productionByteEvidence.artifacts.law.receiptFileSha256 = sha256(bytes);
    } else {
      linkSync(
        fixture.production.files.lawReceipt.path,
        join(fixture.root, "law-receipt-hardlink.json"),
      );
    }
    const result = assess(fixture);
    assert.equal(result.productionByteEvidence.artifacts.law, null, variant);
    assert(blockerCodes(result).has("PRODUCTION_LAW_EVIDENCE_INVALID"), variant);
  }
});

test("a complete synthetic B09 bundle validates structure but cannot prove execution", () => {
  const fixture = readyFixture();
  const result = assess(fixture);
  assert.equal(result.status, "HOLD_TEST");
  assert.equal(result.publicDevnetBehavioralEvidence.artifacts.law.kind, "LAW");
  assert.equal(result.publicDevnetBehavioralEvidence.artifacts.economy.kind, "ECONOMY");
  assert.equal(result.publicDevnetBehavioralEvidence.ready, false);
  assert.equal(result.publicDevnetBehavioralEvidence.structuralContractValidated, true);
  assert.equal(result.publicDevnetBehavioralEvidence.exactSourceReceiptValidated, true);
  assert.equal(result.publicDevnetBehavioralEvidence.executionProvenanceObserved, false);
  assert.equal(result.publicDevnetBehavioralEvidence.descriptorBytesObservedOnly, false);
  assert.equal(result.publicDevnetBehavioralEvidence.finalByteEvidenceAccepted, false);
  assert.equal(result.input.publicDevnetBehavioralEvidenceReady, false);
  assert.equal(result.productionByteEvidence.ready, false);
  const codes = blockerCodes(result);
  assert(!codes.has("DISPOSABLE_DEVNET_EXACT_SOURCE_RECEIPT_UNAVAILABLE"));
  assert(codes.has("DISPOSABLE_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE"));
  assert(codes.has("PRODUCTION_LOCAL_FINAL_BYTE_EXECUTION_NOT_ACCEPTED"));
  assert(codes.has("TEST_ONLY_CONTEXT_INJECTED"));
});

test("public Devnet cannot reuse a production final artifact by bytes or path", () => {
  const fixture = readyFixture({ reuseProductionLawBytes: true });
  fixture.packet.productionByteEvidence.artifacts.law.artifactPath =
    fixture.publicBuild.receipt.artifacts.law.preservedArtifact.absolutePath;
  const result = assess(fixture);
  const codes = blockerCodes(result);
  assert(codes.has("PUBLIC_DEVNET_PRODUCTION_ARTIFACT_REUSE"));
  assert(codes.has("PUBLIC_DEVNET_PRODUCTION_ARTIFACT_PATH_REUSE"));
  assert.equal(result.publicDevnetBehavioralEvidence.ready, false);
});

test("missing, forged, native, and wrong-Genesis B09 inputs fail closed", () => {
  for (const variant of ["missing", "forged", "native", "wrong-genesis"]) {
    const fixture = readyFixture();
    if (variant === "missing") {
      fixture.packet.publicDevnetBehavioralEvidence.preflightPath =
        join(fixture.root, "missing-b09-preflight.json");
    } else if (variant === "forged") {
      const receipt = structuredClone(fixture.publicBuild.receipt);
      receipt.builds.first.law.artifact.sha256 = HEX("7");
      repinB09(receipt, "receiptSha256");
      const bytes = Buffer.from(JSON.stringify(receipt));
      writeFileSync(fixture.publicBuild.files.receiptFile.path, bytes);
      fixture.packet.publicDevnetBehavioralEvidence.receiptFileSha256 = sha256(bytes);
    } else {
      const preflight = structuredClone(fixture.publicBuild.preflight);
      if (variant === "native") preflight.recipes.law.backend = "NATIVE_WSL";
      else preflight.devnet.observedGenesisHash = TEST_FIXTURE_IDENTITIES.genesisHash;
      repinB09(preflight, "preflightSha256");
      const bytes = Buffer.from(JSON.stringify(preflight));
      writeFileSync(fixture.publicBuild.files.preflightFile.path, bytes);
      fixture.packet.publicDevnetBehavioralEvidence.preflightFileSha256 = sha256(bytes);
    }
    refreshPublicBindings(fixture);
    const result = assess(fixture);
    assert.equal(result.status, "HOLD_TEST", variant);
    assert.equal(result.publicDevnetBehavioralEvidence.ready, false, variant);
    assert.equal(result.publicDevnetBehavioralEvidence.exactSourceReceiptValidated, false, variant);
    assert(
      blockerCodes(result).has("DISPOSABLE_DEVNET_EXACT_SOURCE_RECEIPT_UNAVAILABLE"),
      variant,
    );
  }
});

test("production-identity, cross-lane receipt, and dirty-source substitutions fail closed", () => {
  {
    const fixture = readyFixture();
    const identityRecord = structuredClone(fixture.publicBuild.identityRecord);
    identityRecord.lawProgramId = TEST_FIXTURE_IDENTITIES.lawProgramId;
    const observation = writeB09Json(fixture.publicBuild.files.identityPath, identityRecord);
    const preflight = structuredClone(fixture.publicBuild.preflight);
    preflight.identities.lawProgramId = identityRecord.lawProgramId;
    preflight.identities.observation = observation;
    repinB09(preflight, "preflightSha256");
    const bytes = Buffer.from(JSON.stringify(preflight));
    writeFileSync(fixture.publicBuild.files.preflightFile.path, bytes);
    fixture.packet.publicDevnetBehavioralEvidence.preflightFileSha256 = sha256(bytes);
    fixture.packet.clusterPolicy.identities.lawProgramId = identityRecord.lawProgramId;
    refreshPublicBindings(fixture);
    const result = assess(fixture);
    const codes = blockerCodes(result);
    assert(codes.has("CLUSTER_IDENTITIES_NOT_FRESH"));
    assert(codes.has("DISPOSABLE_DEVNET_EXACT_SOURCE_RECEIPT_UNAVAILABLE"));
    assert.equal(result.publicDevnetBehavioralEvidence.ready, false);
  }
  {
    const fixture = readyFixture();
    const other = readyFixture({
      laneId: "b09-devnet-20330518T032320Z-fedcba9876543210",
    });
    fixture.packet.publicDevnetBehavioralEvidence.receiptPath =
      other.publicBuild.files.receiptFile.path;
    fixture.packet.publicDevnetBehavioralEvidence.receiptFileSha256 =
      other.publicBuild.files.receiptFile.sha256;
    refreshPublicBindings(fixture);
    const result = assess(fixture);
    assert(blockerCodes(result).has("DISPOSABLE_DEVNET_EXACT_SOURCE_RECEIPT_UNAVAILABLE"));
    assert.equal(result.publicDevnetBehavioralEvidence.ready, false);
  }
  {
    const fixture = readyFixture();
    fixture.context.source.statusPorcelain = "?? dirty-source";
    fixture.context.disposableDevnetBuildSource.sourceContext.statusPorcelain =
      "?? dirty-source";
    const result = assess(fixture);
    const codes = blockerCodes(result);
    assert(codes.has("SOURCE_NOT_CLEAN"));
    assert(codes.has("DISPOSABLE_DEVNET_EXACT_SOURCE_RECEIPT_UNAVAILABLE"));
    assert.equal(result.publicDevnetBehavioralEvidence.ready, false);
  }
});

test("legacy v3 input and injected observations cannot bypass the v4 strict evidence schema", () => {
  const fixture = readyFixture();
  fixture.packet.schema = "iat-b3-all-feature-devnet-readiness-input/v3";
  fixture.packet.artifacts = { law: {}, economy: {} };
  const result = assessAllFeatureDevnetReadiness({
    packet: fixture.packet,
    context: fixture.context,
    artifactObservations: {
      law: { sha256: HEX("a"), byteLength: 1 },
      economy: { sha256: HEX("b"), byteLength: 1 },
    },
    repositoryRoot: SITE_ROOT,
    evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
  });
  assert.equal(result.status, "HOLD_TEST");
  assert(blockerCodes(result).has("READINESS_INPUT_SCHEMA_INVALID"));
  assert.equal(result.safety.injectedTestEvidenceAccepted, false);
});

test("ambiguous-send retry, stale funding, and reintroduced human review fail closed", () => {
  const fixture = readyFixture();
  fixture.packet.failurePolicy.automaticRetry = true;
  fixture.packet.funding.observationUnixSeconds = (EVALUATION_UNIX_SECONDS - 3_601n).toString();
  fixture.packet.authorization.soleHumanGate = "SEPARATE_HUMAN_REVIEW";
  fixture.packet.automatedVerification.humanReviewerRequired = true;
  const result = assess(fixture);
  const codes = blockerCodes(result);
  assert.equal(result.status, "HOLD_TEST");
  assert(codes.has("FAILURE_POLICY_AUTOMATICRETRY_UNSAFE"));
  assert(codes.has("FUNDING_OBSERVATION_STALE"));
  assert(codes.has("DEVNET_AUTHORIZATION_ABSENT"));
  assert(codes.has("AUTOMATED_VERIFICATION_ABSENT"));
});

test("D03 exact-source reads a linked worktree with reciprocal control validation and dirty detection", () => {
  const root = mkdtempSync(join(tmpdir(), "iat-b3-d03-linked-worktree-"));
  const primary = resolve(root, "primary");
  const linked = resolve(root, "linked");
  try {
    mkdirSync(primary, { recursive: true });
    const git = (cwd, arguments_) => {
      const result = spawnSync("git", ["-C", cwd, ...arguments_], {
        encoding: "utf8",
        windowsHide: true,
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    git(primary, ["init", "--quiet"]);
    git(primary, ["config", "user.name", "D03 linked worktree test"]);
    git(primary, ["config", "user.email", "d03@example.invalid"]);
    writeFileSync(resolve(primary, "bound.txt"), "committed D03 bytes\n");
    git(primary, ["add", "bound.txt"]);
    git(primary, ["commit", "--quiet", "-m", "bound source"]);
    git(primary, ["worktree", "add", "--quiet", "--detach", linked, "HEAD"]);
    git(linked, ["config", "core.autocrlf", "false"]);
    git(linked, ["reset", "--hard", "--quiet", "HEAD"]);

    const clean = observeAllFeatureDevnetExactSource(linked);
    assert.match(clean.headSha, /^[0-9a-f]{40}$/u);
    assert.match(clean.treeSha, /^[0-9a-f]{40}$/u);
    assert.equal(clean.statusPorcelain, "");
    assert.equal(
      readAllFeatureDevnetExactCommittedFile(linked, clean.headSha, "bound.txt")
        .toString("utf8"),
      "committed D03 bytes\n",
    );

    if (process.platform === "linux") {
      const control = readFileSync(resolve(linked, ".git"), "utf8").trim();
      const gitDirectory = /^gitdir: (?<path>.+)$/u.exec(control)?.groups?.path;
      assert.ok(gitDirectory);
      const backlinkPath = resolve(gitDirectory, "gitdir");
      const originalBacklink = readFileSync(backlinkPath, "utf8");
      try {
        writeFileSync(backlinkPath, `${resolve(primary, ".git")}\n`);
        assert.throws(
          () => observeAllFeatureDevnetExactSource(linked),
          /IAT_B3_EXACT_SOURCE_WSL_GITDIR_BACKLINK_MISMATCH/u,
        );
      } finally {
        writeFileSync(backlinkPath, originalBacklink);
      }
    }

    writeFileSync(resolve(linked, "untracked.txt"), "drift\n");
    const dirty = observeAllFeatureDevnetExactSource(linked);
    assert.notEqual(dirty.statusPorcelain, "");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("current exact source exits 2/HOLD with enumerated blockers, never ASSESSMENT_ERROR", () => {
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: SITE_ROOT,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(result.status, 2, result.stderr);
  const assessment = JSON.parse(result.stdout);
  assert.equal(assessment.schema, ALL_FEATURE_DEVNET_ASSESSMENT_SCHEMA);
  assert.equal(assessment.status, "HOLD");
  const codes = new Set(assessment.blockers.map(({ code }) => code));
  assert(codes.has("READINESS_INPUT_REQUIRED"));
  assert(!codes.has("ASSESSMENT_ERROR"));
  assert.equal(assessment.safety.networkAccess, false);
  assert.equal(assessment.safety.signing, false);
  assert.equal(assessment.safety.broadcast, false);
  assert.equal(assessment.safety.deployment, false);
  assert.equal(assessment.safety.mainnetExecutionAuthorized, false);
});

test("orchestrator source and docs freeze two lanes and remain observation-only", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  const packageManifest = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
  const documentation = readFileSync(DOCUMENTATION_PATH, "utf8");
  assert.doesNotMatch(source, /rehearsal_adapter\.rs/u);
  assert.match(source, /extractIatB3ProductionTransactionMaps/u);
  assert.match(source, /DISPOSABLE_DEVNET_EXACT_SOURCE_RECEIPT_UNAVAILABLE/u);
  assert.match(source, /DISPOSABLE_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE/u);
  assert.match(source, /validateDisposableDevnetDualBuildPreflight/u);
  assert.match(source, /validateDisposableDevnetDualBuildReceipt/u);
  assert.doesNotMatch(source, /\.(?:sendRawTransaction|sendTransaction|requestAirdrop|confirmTransaction)\s*\(/u);
  assert.doesNotMatch(source, /\b(?:Keypair|TransactionInstruction|SystemProgram)\b/u);
  assert.doesNotMatch(source, /api\.mainnet-beta\.solana\.com/iu);
  assert.doesNotMatch(source, /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\b/u);
  assert.equal(
    packageManifest.scripts["check:iat-b3-all-feature-devnet-readiness"],
    "node scripts/assess-iat-b3-all-feature-devnet-readiness.mjs",
  );
  assert.match(documentation, /production-byte|production byte/iu);
  assert.match(documentation, /public Devnet/iu);
  assert.match(documentation, /readiness-input\/v4/u);
  assert.match(documentation, /B09 disposable-Devnet preflight and receipt/u);
  assert.match(documentation, /can never satisfy\s+the production final-byte/u);
  assert.match(documentation, /DISPOSABLE_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE/u);
  assert.match(documentation, /never signs, broadcasts, deploys,\s+funds, activates, or queries RPC/u);
  assert.match(documentation, /exit code `2`/u);
});
