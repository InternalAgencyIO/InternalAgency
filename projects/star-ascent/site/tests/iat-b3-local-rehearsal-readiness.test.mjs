import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "../scripts/assess-iat-b3-all-feature-devnet-readiness.mjs";
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
  LOCAL_REHEARSAL_DISK_POLICY,
  LOCAL_REHEARSAL_HOLD,
  LOCAL_REHEARSAL_READY,
  LOCAL_REHEARSAL_READINESS_INPUT_SCHEMA,
  LOCAL_REHEARSAL_READINESS_SCHEMA,
  assessLocalRehearsalReadiness,
  deriveLawBoundaryAndGrindingPlan,
  deriveProductionOpcodeDispositions,
  observeLocalRehearsalGitSource,
  projectCombinedLawBuildReceiptForLocalRehearsal,
  projectEconomyBuildReceiptForLocalRehearsal,
  selectLocalRehearsalToolchainObservations,
  validateLocalRehearsalReadinessAssessment,
  validateLocalRehearsalToolchain,
} from "../scripts/assess-iat-b3-local-rehearsal-readiness.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT_PATH = resolve(
  SITE_ROOT,
  "scripts/assess-iat-b3-local-rehearsal-readiness.mjs",
);
const INSTRUCTION_PATH = resolve(
  SITE_ROOT,
  "programs/iat_b3_economy/src/production_instruction.rs",
);
const DISPATCH_PATH = resolve(
  SITE_ROOT,
  "programs/iat_b3_economy/src/production_dispatch.rs",
);
const ENTRYPOINT_PATH = resolve(
  SITE_ROOT,
  "programs/iat_b3_economy/src/production_entrypoint.rs",
);
const CLAIM_LANE_EXECUTOR_PATH = resolve(
  SITE_ROOT,
  "programs/iat_b3_economy/src/production_claim_lane_principal_executor.rs",
);
const CONSENSUS_PATH = resolve(
  SITE_ROOT,
  "programs/iat_b3_consensus/src/lib.rs",
);
const LAW_PATH = resolve(SITE_ROOT, "programs/iat_b3_law/src/lib.rs");

const HEAD = "1".repeat(40);
const TREE = "2".repeat(40);
const RUNNER_SHA256 = "3".repeat(64);
const LAW_RECEIPT_SHA256 = "6".repeat(64);
const ECONOMY_RECEIPT_SHA256 = "7".repeat(64);
const LAW_PROGRAM_ID = "29dv8e1WcjL4w6a7HDaHbUfXrF12yiJiVcKQ1qgeT3rF";
const ECONOMY_PROGRAM_ID = "2xfTrFbdiJtncBaCWoVK5yvgn9XT4UYZCWKGiQDqR3ij";
const CANONICAL_MINT = "3uXbrU7mzV3xZT5Jcz4BAEjNCNUGVNA32DeTXirDsiEd";
const GENESIS_HASH = "4zEL9HZwTFoanu5RbmGspF5a6uqVGP99xkJxToZoq3Pw";

const sources = Object.freeze({
  instructionSource: readFileSync(INSTRUCTION_PATH, "utf8"),
  dispatchSource: readFileSync(DISPATCH_PATH, "utf8"),
  entrypointSource: readFileSync(ENTRYPOINT_PATH, "utf8"),
  claimLaneExecutorSource: readFileSync(CLAIM_LANE_EXECUTOR_PATH, "utf8"),
});

function productionDispositions(overrides = {}) {
  return deriveProductionOpcodeDispositions({ ...sources, ...overrides });
}

function artifactDescriptor({
  kind,
  path,
  digest,
  byteLength,
  receiptPath,
  receiptSha256,
  identityBindingSha256,
  firstBuildLogSha256 = "8".repeat(64),
  secondBuildLogSha256 = "9".repeat(64),
}) {
  return {
    kind,
    path,
    sha256: digest,
    byteLength,
    sourceHeadSha: HEAD,
    identityBindingSha256,
    firstBuildSha256: digest,
    firstBuildByteLength: byteLength,
    firstBuildLogSha256,
    secondBuildSha256: digest,
    secondBuildByteLength: byteLength,
    secondBuildLogSha256,
    receiptPath,
    receiptSha256,
  };
}

function combinedLawReceipt() {
  const bytes = Buffer.from("r01-deterministic-combined-law-sbf-bytes");
  const sourceObservations = Array.from({ length: 4 }, () => ({
    headSha: HEAD,
    treeSha: TREE,
    statusPorcelain: "",
  }));
  const materializedSourceObservations = Array.from({ length: 4 }, () => ({
    schema: COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
    declaredHeadSha: HEAD,
    treeSha: TREE,
    mountedInputSha256: "c".repeat(64),
    fileCount: 2,
    byteLength: 42,
    lfsPointerCount: 0,
    ignoredWorktreeBytesIncluded: false,
    submodulePolicy: COMBINED_LAW_SUBMODULE_POLICY,
    lfsPolicy: COMBINED_LAW_LFS_POLICY,
  }));
  const artifact = (log) => ({
    fileName: "iat_b3_law.so",
    bytes,
    logSha256: log.repeat(64),
  });
  return createCombinedLawBuildReceipt({
    generatedAt: "2033-05-18T03:33:20.000Z",
    declaredHeadSha: HEAD,
    sourceObservations,
    materializedSourceObservations,
    runnerBinding: {
      executedRunnerSha256: "9".repeat(64),
      committedRunnerSha256: "9".repeat(64),
    },
    identityBinding: {
      manifestPath: "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
      manifestSha256: "a".repeat(64),
      environmentBindingSha256: "b".repeat(64),
      canonicalManifestReady: true,
    },
    containerObservation: {
      ...PINNED_COMBINED_LAW_BUILD_CONTAINER,
      localImageId: `sha256:${"d".repeat(64)}`,
    },
    toolchainObservation: {
      rustc: "rustc 1.97.1 (8bab26f4f 2026-07-14)",
      cargo: "cargo 1.97.1 (c980f4866 2026-06-30)",
      cargoBuildSbf: "solana-cargo-build-sbf 3.1.10",
    },
    firstArtifact: artifact("e"),
    secondArtifact: artifact("f"),
    preservedArtifact: {
      fileName: "iat_b3_law.so",
      bytes,
      atomicNoOverwrite: true,
      readbackVerified: true,
    },
  });
}

function economyReceipt() {
  const bytes = Buffer.from("r01-deterministic-production-economy-sbf-bytes");
  const sourceObservations = Array.from({ length: 4 }, () => ({
    headSha: HEAD,
    treeSha: TREE,
    statusPorcelain: "",
  }));
  const materializedSourceObservations = Array.from({ length: 4 }, () => ({
    schema: COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
    declaredHeadSha: HEAD,
    treeSha: TREE,
    mountedInputSha256: "1".repeat(64),
    fileCount: 4,
    byteLength: 84,
    lfsPointerCount: 0,
    ignoredWorktreeBytesIncluded: false,
    submodulePolicy: COMBINED_LAW_SUBMODULE_POLICY,
    lfsPolicy: COMBINED_LAW_LFS_POLICY,
  }));
  const sourceClosure = inspectEconomyProductionSourceClosure({
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
  const artifact = (log) => ({
    fileName: "iat_b3_economy.so",
    bytes,
    logSha256: log.repeat(64),
  });
  return createEconomyBuildReceipt({
    generatedAt: "2033-05-18T03:33:20.000Z",
    declaredHeadSha: HEAD,
    sourceObservations,
    materializedSourceObservations,
    runnerBinding: {
      executedRunnerSha256: "2".repeat(64),
      committedRunnerSha256: "2".repeat(64),
    },
    sourceClosure,
    identityBinding: {
      manifestPath: "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
      manifestSha256: "a".repeat(64),
      ownerPolicyPath: "projects/star-ascent/site/docs/b3/iat-b3-owner-policy-freeze.v1.json",
      ownerPolicySha256: "3".repeat(64),
      environmentNames: [
        "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
        "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
        "IAT_B3_PRODUCTION_CANONICAL_MINT",
        "IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH",
      ],
      environmentBindingSha256: "c".repeat(64),
      canonicalManifestReady: true,
    },
    containerObservation: {
      ...PINNED_COMBINED_LAW_BUILD_CONTAINER,
      localImageId: `sha256:${"d".repeat(64)}`,
    },
    toolchainObservation: {
      rustc: "rustc 1.97.1 (8bab26f4f 2026-07-14)",
      cargo: "cargo 1.97.1 (c980f4866 2026-06-30)",
      cargoBuildSbf: "solana-cargo-build-sbf 3.1.10",
    },
    firstArtifact: artifact("e"),
    secondArtifact: artifact("f"),
    preservedArtifact: {
      fileName: "iat_b3_economy.so",
      bytes,
      atomicNoOverwrite: true,
      readbackVerified: true,
    },
  });
}

function readyAssessment() {
  const lawReceiptBinding = projectCombinedLawBuildReceiptForLocalRehearsal(
    combinedLawReceipt(),
  );
  const economyReceiptBinding = projectEconomyBuildReceiptForLocalRehearsal(
    economyReceipt(),
  );
  const identityBindingCore = {
    policy: "EXACT_PRODUCTION_CANDIDATE_IDENTITIES_ON_DISPOSABLE_LOCAL_LEDGER",
    lawProgramId: LAW_PROGRAM_ID,
    economyProgramId: ECONOMY_PROGRAM_ID,
    canonicalMint: CANONICAL_MINT,
    networkGenesisHash: GENESIS_HASH,
  };
  const identityBinding = {
    ...identityBindingCore,
    bindingSha256: canonicalSha256(identityBindingCore),
  };
  const lawPath = "C:\\outside-r01\\iat_b3_law.so";
  const lawReceiptPath = "C:\\outside-r01\\law-receipt.json";
  const economyPath = "C:\\outside-r01\\iat_b3_economy.so";
  const economyReceiptPath = "C:\\outside-r01\\economy-receipt.json";
  const inputPacket = {
    schema: LOCAL_REHEARSAL_READINESS_INPUT_SCHEMA,
    declaredHeadSha: HEAD,
    identityBinding,
    artifacts: {
      law: artifactDescriptor({
        kind: "LAW",
        path: lawPath,
        digest: lawReceiptBinding.artifactSha256,
        byteLength: lawReceiptBinding.artifactByteLength,
        receiptPath: lawReceiptPath,
        receiptSha256: LAW_RECEIPT_SHA256,
        identityBindingSha256: identityBinding.bindingSha256,
        firstBuildLogSha256: lawReceiptBinding.firstBuildLogSha256,
        secondBuildLogSha256: lawReceiptBinding.secondBuildLogSha256,
      }),
      economy: artifactDescriptor({
        kind: "ECONOMY",
        path: economyPath,
        digest: economyReceiptBinding.artifactSha256,
        byteLength: economyReceiptBinding.artifactByteLength,
        receiptPath: economyReceiptPath,
        receiptSha256: ECONOMY_RECEIPT_SHA256,
        identityBindingSha256: identityBinding.bindingSha256,
        firstBuildLogSha256: economyReceiptBinding.firstBuildLogSha256,
        secondBuildLogSha256: economyReceiptBinding.secondBuildLogSha256,
      }),
    },
  };
  const toolchain = validateLocalRehearsalToolchain({
    node: { available: true, output: "24.14.0" },
    bash: { available: true, output: "GNU bash, version 5.2.21" },
    rustc: { available: true, output: "rustc 1.97.1 (fixture)" },
    cargo: { available: true, output: "cargo 1.97.1 (fixture)" },
    cargoBuildSbf: {
      available: true,
      output: "solana-cargo-build-sbf 3.1.10\nplatform-tools v1.52\nrustc 1.89.0",
    },
    solana: { available: true, output: "solana-cli 3.1.10 (fixture)" },
    solanaKeygen: { available: true, output: "solana-keygen 3.1.10 (fixture)" },
    solanaTestValidator: {
      available: true,
      output: "solana-test-validator 3.1.10 (fixture)",
    },
    splToken: { available: true, output: "spl-token-cli 5.5.0" },
    sha256sum: { available: true, output: "sha256sum fixture" },
  });
  return assessLocalRehearsalReadiness({
    generatedAt: "2033-05-18T03:33:20.000Z",
    source: {
      headSha: HEAD,
      treeSha: TREE,
      statusPorcelain: "",
      executedRunnerSha256: RUNNER_SHA256,
      committedRunnerSha256: RUNNER_SHA256,
      hostPlatform: "linux",
      hostArchitecture: "x64",
      identityManifestSha256: "a".repeat(64),
      lawIdentityEnvironmentSha256: "b".repeat(64),
      economyIdentityEnvironmentSha256: "c".repeat(64),
    },
    opcodeDispositions: productionDispositions(),
    ceremonyStages: { count: 17, stages: [], bindingSha256: "b".repeat(64) },
    lawPlan: deriveLawBoundaryAndGrindingPlan({
      consensusSource: readFileSync(CONSENSUS_PATH, "utf8"),
      lawSource: readFileSync(LAW_PATH, "utf8"),
    }),
    identityManifest: {
      identities: {
        lawProgramId: LAW_PROGRAM_ID,
        economyProgramId: ECONOMY_PROGRAM_ID,
        canonicalMint: CANONICAL_MINT,
      },
      networkBinding: { genesisHash: GENESIS_HASH },
    },
    identityValidation: { productionCombinedArtifactBindingReady: true },
    authorityValidation: { phaseCComplete: false },
    toolchain,
    disk: { path: "/tmp", freeBytes: LOCAL_REHEARSAL_DISK_POLICY.minimumFreeBytes },
    inputPacket,
    artifactObservations: {
      law: {
        path: lawPath,
        sha256: lawReceiptBinding.artifactSha256,
        byteLength: lawReceiptBinding.artifactByteLength,
        receiptPath: lawReceiptPath,
        receiptSha256: LAW_RECEIPT_SHA256,
        receiptBinding: lawReceiptBinding,
      },
      economy: {
        path: economyPath,
        sha256: economyReceiptBinding.artifactSha256,
        byteLength: economyReceiptBinding.artifactByteLength,
        receiptPath: economyReceiptPath,
        receiptSha256: ECONOMY_RECEIPT_SHA256,
        receiptBinding: economyReceiptBinding,
      },
    },
  });
}

test("R01 derives all 15 production dispositions, including opcode 9 lane semantics", () => {
  const result = productionDispositions();
  assert.equal(result.count, 15);
  assert.deepEqual(result.counts, {
    ACTIVE: 6,
    INITIALIZATION_POLICY_HOLD: 5,
    CCC_DISABLED: 3,
    CORE_CUSTODY_HOLD: 1,
  });
  assert.deepEqual(
    result.dispositions.map(({ opcode, name, disposition }) => ({ opcode, name, disposition })),
    [
      [0, "initialize_config", "INITIALIZATION_POLICY_HOLD"],
      [1, "initialize_lane_vault", "INITIALIZATION_POLICY_HOLD"],
      [2, "initialize_stake_vault", "INITIALIZATION_POLICY_HOLD"],
      [3, "activate", "INITIALIZATION_POLICY_HOLD"],
      [4, "register_agency", "INITIALIZATION_POLICY_HOLD"],
      [5, "set_eligibility", "ACTIVE"],
      [6, "open_position", "ACTIVE"],
      [7, "settle_position_week", "ACTIVE"],
      [8, "settle_core_week", "CORE_CUSTODY_HOLD"],
      [9, "claim_lane_principal", "ACTIVE"],
      [10, "withdraw_position_principal", "ACTIVE"],
      [11, "close_position", "ACTIVE"],
      [12, "commit_round", "CCC_DISABLED"],
      [13, "settle_round", "CCC_DISABLED"],
      [14, "expire_round", "CCC_DISABLED"],
    ].map(([opcode, name, disposition]) => ({ opcode, name, disposition })),
  );
  const claim = result.dispositions[9];
  assert.deepEqual(claim.conditionalDisposition.supportedNonCoreLanes, [
    "TREASURY",
    "ECOSYSTEM",
    "LIQUIDITY",
  ]);
  assert.equal(claim.conditionalDisposition.supportedNonCoreDisposition, "ACTIVE");
  assert.equal(claim.conditionalDisposition.coreLaneDisposition, "CORE_CUSTODY_HOLD");
  assert.equal(claim.conditionalDisposition.classificationBeforeOperationAccountRead, true);
  assert.equal(claim.conditionalDisposition.coreLaneExpectedMutation, "NONE");
});

test("R01 fails closed when conditional custody, count, or Daily Law truth drifts", () => {
  assert.throws(
    () => productionDispositions({
      dispatchSource: sources.dispatchSource.replace(
        "claim_lane_principal_core_policy_held: true",
        "claim_lane_principal_core_policy_held: false",
      ),
    }),
    /R01_OPCODE_9_CONDITIONAL_CORE_CUSTODY_TRUTH_MISSING/u,
  );
  assert.throws(
    () => productionDispositions({
      claimLaneExecutorSource: sources.claimLaneExecutorSource.replace(
        "core_team_policy_hold_precedes_account_reads: true",
        "core_team_policy_hold_precedes_account_reads: false",
      ),
    }),
    /R01_OPCODE_9_CONDITIONAL_CORE_CUSTODY_TRUTH_MISSING/u,
  );
  assert.throws(
    () => productionDispositions({
      dispatchSource: sources.dispatchSource.replace(
        "PRODUCTION_ACTIVE_HANDLER_COUNT: usize = 6",
        "PRODUCTION_ACTIVE_HANDLER_COUNT: usize = 5",
      ),
    }),
    /R01_PRODUCTION_DISPOSITION_COUNT_DRIFT/u,
  );
  assert.throws(
    () => productionDispositions({
      entrypointSource: sources.entrypointSource.replaceAll(
        "verify_runtime_daily_law_open_account_info",
        "removed_daily_law_verifier",
      ),
    }),
    /R01_DAILY_LAW_NOT_AUTHENTICATED_BEFORE_DISPATCH/u,
  );
});

test("R01 binds the exact Daily Law boundary and grinding vectors", () => {
  const plan = deriveLawBoundaryAndGrindingPlan({
    consensusSource: readFileSync(CONSENSUS_PATH, "utf8"),
    lawSource: readFileSync(LAW_PATH, "utf8"),
  });
  assert.deepEqual(plan.constants, {
    protocolUtcOffsetSeconds: 10_800,
    decisionLocalSecond: 60,
    secondsPerDay: 86_400,
    normalNumerator: 100,
    fridayNumerator: 6_667,
    denominator: 10_000,
    entropyLagSlots: 150,
  });
  assert.equal(plan.boundaryVectors.length, 16);
  assert.equal(plan.grindingVectors.length, 5);
  assert.equal(plan.empiricalDevnetOrMainnetMeasurementComplete, false);
  assert.equal(plan.entropyRiskAcceptance, null);
  assert.equal(plan.finalEntropyLagFrozen, false);
});

test("R01 accepts only the complete pinned local-validator toolchain", () => {
  const valid = validateLocalRehearsalToolchain({
    node: { available: true, output: "24.19.0" },
    bash: { available: true, output: "GNU bash, version 5.2.21" },
    rustc: { available: true, output: "rustc 1.97.1 (fixture)" },
    cargo: { available: true, output: "cargo 1.97.1 (fixture)" },
    cargoBuildSbf: {
      available: true,
      output: "solana-cargo-build-sbf 3.1.10\nplatform-tools v1.52\nrustc 1.89.0",
    },
    solana: { available: true, output: "solana-cli 3.1.10 (fixture)" },
    solanaKeygen: { available: true, output: "solana-keygen 3.1.10 (fixture)" },
    solanaTestValidator: {
      available: true,
      output: "solana-test-validator 3.1.10 (fixture)",
    },
    splToken: { available: true, output: "spl-token-cli 5.5.0" },
    sha256sum: { available: true, output: "sha256sum fixture" },
  });
  assert.equal(valid.ready, true);
  const missing = validateLocalRehearsalToolchain({
    ...valid.observations,
    solanaTestValidator: { available: false, output: null },
  });
  assert.equal(missing.ready, false);
  assert.equal(missing.checks.solanaTestValidator, false);
});

test("R01 no-input toolchain observation is explicit HOLD and launches no external probe", () => {
  let invocationCount = 0;
  const runner = () => {
    invocationCount += 1;
    throw new Error("external probe must not run without a readiness input");
  };
  const noInput = selectLocalRehearsalToolchainObservations({
    inputPath: null,
    runner,
    nodeVersion: "24.10.0",
  });
  assert.equal(invocationCount, 0);
  assert.equal(noInput.node.available, true);
  for (const name of [
    "bash",
    "rustc",
    "cargo",
    "cargoBuildSbf",
    "solana",
    "solanaKeygen",
    "solanaTestValidator",
    "splToken",
    "sha256sum",
  ]) {
    assert.equal(noInput[name].available, false);
    assert.equal(noInput[name].failure, "NOT_PROBED_NO_INPUT_FAIL_CLOSED");
  }
  assert.equal(validateLocalRehearsalToolchain(noInput).ready, false);

  selectLocalRehearsalToolchainObservations({
    inputPath: "/outside/readiness-input.json",
    runner: () => {
      invocationCount += 1;
      return { status: 1, stdout: "", stderr: "missing" };
    },
  });
  assert.equal(invocationCount, 9);
});

test("R01 law handoff accepts only the canonical validated build receipt", () => {
  const receipt = combinedLawReceipt();
  const projection = projectCombinedLawBuildReceiptForLocalRehearsal(receipt);
  assert.equal(projection.kind, "LAW");
  assert.equal(projection.sourceHeadSha, HEAD);
  assert.equal(projection.artifactFileName, "iat_b3_law.so");
  assert.equal(projection.artifactSha256, receipt.artifact.sha256);
  assert.equal(projection.recordSha256, receipt.receiptSha256);

  const tampered = structuredClone(receipt);
  tampered.artifact.firstBuildLogSha256 = "0".repeat(64);
  assert.throws(
    () => projectCombinedLawBuildReceiptForLocalRehearsal(tampered),
    /IAT_B3_COMBINED_LAW_BUILD_RECEIPT_DIGEST_MISMATCH/u,
  );
  assert.throws(
    () => projectCombinedLawBuildReceiptForLocalRehearsal({}),
    /INVALID_IAT_B3_COMBINED_LAW_BUILD_RECEIPT/u,
  );

  const economy = economyReceipt();
  const economyProjection = projectEconomyBuildReceiptForLocalRehearsal(economy);
  assert.equal(economyProjection.kind, "ECONOMY");
  assert.equal(economyProjection.artifactFileName, "iat_b3_economy.so");
  assert.equal(economyProjection.artifactSha256, economy.artifact.sha256);
  const economyTamper = structuredClone(economy);
  economyTamper.artifact.secondBuildLogSha256 = economyTamper.artifact.firstBuildLogSha256;
  assert.throws(
    () => projectEconomyBuildReceiptForLocalRehearsal(economyTamper),
    /INVALID_IAT_B3_ECONOMY_BUILD_ARTIFACT/u,
  );
});

test("R01 reaches READY only with both validated exact-source receipts", () => {
  const assessment = readyAssessment();
  assert.equal(
    LOCAL_REHEARSAL_READINESS_SCHEMA,
    "iat-b3-local-rehearsal-readiness-assessment/v2",
  );
  assert.equal(assessment.schema, LOCAL_REHEARSAL_READINESS_SCHEMA);
  assert.equal(assessment.status, LOCAL_REHEARSAL_READY);
  assert.equal(assessment.exitCode, 0);
  assert.equal(assessment.artifacts.lawReady, true);
  assert.equal(assessment.artifacts.economyReady, true);
  assert.equal(
    assessment.artifacts.lawReceiptContract,
    "iat-b3-combined-law-exact-source-dual-sbf-build/v2",
  );
  assert.equal(
    assessment.artifacts.economyReceiptContract,
    "iat-b3-economy-exact-source-dual-sbf-build/v2",
  );
  assert.equal(assessment.source.repositoryCleanTrackedAndNonignoredUntracked, true);
  assert.equal(
    Object.hasOwn(assessment.source, "repositoryCleanTrackedAndUntracked"),
    false,
  );
  assert.deepEqual(assessment.blockers, []);
  assert.equal(assessment.scope.readyDoesNotMeanAll15Active, true);
  assert.equal(assessment.scope.readyDoesNotAuthorizeDevnetOrMainnet, true);
  assert.equal(assessment.safety.validatorStarted, false);
  assert.equal(assessment.safety.transactionSigned, false);
  assert.equal(assessment.safety.mainnetStatus, LOCAL_REHEARSAL_HOLD);

  const tampered = structuredClone(assessment);
  tampered.disk.freeBytes += 1;
  assert.throws(
    () => validateLocalRehearsalReadinessAssessment(tampered),
    /IAT_B3_LOCAL_REHEARSAL_DIGEST_MISMATCH/u,
  );
});

test("R01 no-input CLI is a network-free HOLD with no execution side effects", () => {
  // WSL must scan the complete Windows-linked worktree, including every
  // untracked path. The scan measured 17.2-20.3s alone and 33.8s under the
  // parallel build-contract suite; retain that fail-closed scan and allow its
  // measured contention instead of weakening the source gate.
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
  });
  assert.equal(result.status, 2, result.stderr);
  const assessment = JSON.parse(result.stdout);
  assert.equal(assessment.status, LOCAL_REHEARSAL_HOLD);
  assert.ok(assessment.blockers.includes("READINESS_INPUT_VALID"));
  assert.equal(assessment.safety.validatorStarted, false);
  assert.equal(assessment.safety.artifactBuildExecuted, false);
  assert.equal(assessment.safety.keyGenerated, false);
  assert.equal(assessment.safety.rpcUsed, false);
  assert.equal(assessment.safety.transactionSigned, false);
  assert.equal(assessment.safety.broadcastAttempted, false);

  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.doesNotMatch(source, /@solana\/web3\.js|\bKeypair\b|\bTransactionInstruction\b/u);
  assert.doesNotMatch(source, /\bsendTransaction\s*\(|\bsendAndConfirmTransaction\s*\(|\bfetch\s*\(/u);
});

test("R01 exact-source observer reads a linked worktree without weakening dirty detection", () => {
  const root = mkdtempSync(resolve(tmpdir(), "iat-b3-r01-linked-worktree-test-"));
  const primary = resolve(root, "primary");
  const linked = resolve(root, "linked");
  const lfsPayload = Buffer.from("R01 exact smudged LFS payload\n", "utf8");
  const lfsOid = createHash("sha256").update(lfsPayload).digest("hex");
  const lfsPointer = [
    "version https://git-lfs.github.com/spec/v1",
    `oid sha256:${lfsOid}`,
    `size ${lfsPayload.length}`,
    "",
  ].join("\n");
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
    git(primary, ["config", "user.name", "R01 linked worktree test"]);
    git(primary, ["config", "user.email", "r01@example.invalid"]);
    writeFileSync(resolve(primary, "bound.txt"), "committed\n");
    writeFileSync(resolve(primary, "asset.bin"), lfsPointer);
    git(primary, ["add", "bound.txt", "asset.bin"]);
    git(primary, ["commit", "--quiet", "-m", "bound source"]);
    git(primary, ["worktree", "add", "--quiet", "--detach", linked, "HEAD"]);
    git(linked, ["config", "core.autocrlf", "false"]);
    git(linked, ["reset", "--hard", "--quiet", "HEAD"]);
    writeFileSync(resolve(linked, "asset.bin"), lfsPayload);
    const clean = observeLocalRehearsalGitSource(linked);
    assert.match(clean.headSha, /^[0-9a-f]{40}$/u);
    assert.match(clean.treeSha, /^[0-9a-f]{40}$/u);
    assert.equal(clean.statusPorcelain, "");
    const control = readFileSync(resolve(linked, ".git"), "utf8").trim();
    const gitDirectory = /^gitdir: (?<path>.+)$/u.exec(control)?.groups?.path;
    assert.ok(gitDirectory);
    const backlinkPath = resolve(gitDirectory, "gitdir");
    const originalBacklink = readFileSync(backlinkPath, "utf8");
    try {
      writeFileSync(backlinkPath, `${resolve(primary, ".git")}\n`);
      assert.throws(
        () => observeLocalRehearsalGitSource(linked),
        /IAT_B3_EXACT_SOURCE_WSL_GITDIR_BACKLINK_MISMATCH/u,
      );
    } finally {
      writeFileSync(backlinkPath, originalBacklink);
    }
    const wrongLfsPayload = Buffer.from(lfsPayload);
    wrongLfsPayload[0] ^= 0xff;
    writeFileSync(resolve(linked, "asset.bin"), wrongLfsPayload);
    assert.match(
      observeLocalRehearsalGitSource(linked).statusPorcelain,
      / M asset\.bin\0/u,
    );
    writeFileSync(resolve(linked, "asset.bin"), lfsPayload);
    assert.equal(observeLocalRehearsalGitSource(linked).statusPorcelain, "");
    writeFileSync(resolve(linked, "untracked.txt"), "drift\n");
    const dirty = observeLocalRehearsalGitSource(linked);
    assert.notEqual(dirty.statusPorcelain, "");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
