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

function readyFixture() {
  const context = readyContext();
  const root = mkdtempSync(join(tmpdir(), "iat-b3-d03-"));
  temporaryRoots.push(root);
  const production = createProductionEvidence(context, root);
  const devnetLaw = writeBound(
    root,
    "devnet-law.so",
    Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from("devnet-law")]),
  );
  const devnetEconomy = writeBound(
    root,
    "devnet-economy.so",
    Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.from("devnet-economy")]),
  );
  const identities = { ...COMBINED_HOOK_HOST_TEST_IDENTITIES };
  const clusterBinding = canonicalSha256(identities);
  const publicEvidence = {
    policy: ALL_FEATURE_PUBLIC_DEVNET_BEHAVIORAL_EVIDENCE_POLICY,
    artifacts: {
      law: {
        kind: "LAW", path: devnetLaw.path, sha256: devnetLaw.sha256,
        byteLength: devnetLaw.byteLength, sourceHeadSha: HEAD,
        identityBindingSha256: clusterBinding, networkGenesisHash: devnetBoundary.genesisHash,
      },
      economy: {
        kind: "ECONOMY", path: devnetEconomy.path, sha256: devnetEconomy.sha256,
        byteLength: devnetEconomy.byteLength, sourceHeadSha: HEAD,
        identityBindingSha256: clusterBinding, networkGenesisHash: devnetBoundary.genesisHash,
      },
    },
    devnetDomain: devnetBoundary.genesisHash,
    disposableIdentities: true,
    productionArtifactReuseForbidden: true,
    finalByteEvidenceAccepted: false,
  };
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
  return { context, packet, production, root };
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

test("self-consistent arbitrary public-Devnet ELF descriptors never become behavioral evidence", () => {
  const fixture = readyFixture();
  const result = assess(fixture);
  assert.equal(result.publicDevnetBehavioralEvidence.artifacts.law.kind, "LAW");
  assert.equal(result.publicDevnetBehavioralEvidence.artifacts.economy.kind, "ECONOMY");
  assert.equal(result.publicDevnetBehavioralEvidence.ready, false);
  assert.equal(result.publicDevnetBehavioralEvidence.exactSourceReceiptValidated, false);
  assert(blockerCodes(result).has("DISPOSABLE_DEVNET_EXACT_SOURCE_RECEIPT_UNAVAILABLE"));
});

test("public Devnet cannot reuse a production final artifact by bytes or path", () => {
  const fixture = readyFixture();
  const productionLaw = fixture.packet.productionByteEvidence.artifacts.law;
  fixture.packet.publicDevnetBehavioralEvidence.artifacts.law = {
    ...fixture.packet.publicDevnetBehavioralEvidence.artifacts.law,
    path: productionLaw.artifactPath,
    sha256: productionLaw.artifactSha256,
    byteLength: productionLaw.artifactByteLength,
  };
  const result = assess(fixture);
  const codes = blockerCodes(result);
  assert(codes.has("PUBLIC_DEVNET_PRODUCTION_ARTIFACT_REUSE"));
  assert(codes.has("PUBLIC_DEVNET_PRODUCTION_ARTIFACT_PATH_REUSE"));
  assert.equal(result.publicDevnetBehavioralEvidence.ready, false);
});

test("legacy v2 input and injected observations cannot bypass the v3 strict evidence schema", () => {
  const fixture = readyFixture();
  fixture.packet.schema = "iat-b3-all-feature-devnet-readiness-input/v2";
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
  assert.match(documentation, /never signs, broadcasts, deploys,\s+funds, activates, or queries RPC/u);
  assert.match(documentation, /exit code `2`/u);
});
