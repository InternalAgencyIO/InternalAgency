import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMBINED_LAW_BUILD_DISK_BUDGET,
  COMBINED_LAW_BUILD_MAINNET_STATUS,
  COMBINED_LAW_BUILD_PREFLIGHT_HOLD,
  COMBINED_LAW_BUILD_PREFLIGHT_READY,
  COMBINED_LAW_BUILD_PREFLIGHT_SCHEMA,
  COMBINED_LAW_BUILD_RECEIPT_SCHEMA,
  COMBINED_LAW_BUILD_RECEIPT_STATUS,
  COMBINED_LAW_LFS_POLICY,
  COMBINED_LAW_PROGRAMDATA_BINDING,
  COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
  COMBINED_LAW_SUBMODULE_POLICY,
  PINNED_COMBINED_LAW_BUILD_CONTAINER,
  PINNED_DOCKER_COMMAND_PURPOSE,
  assertIdentityAndOwnerPolicyBytes,
  assertExactCleanSourceSequence,
  assertExactMaterializedSourceSequence,
  assertPinnedContainerObservation,
  assertPinnedDockerCommandArguments,
  assertPinnedExactSourceGitObservation,
  assertPinnedToolchainObservation,
  createExactSourceGitEnvironment,
  createPinnedDockerEnvironment,
  createCombinedLawBuildPreflight,
  createCombinedLawBuildRoot,
  createCombinedLawBuildReceipt,
  createCombinedLawDockerBuildArguments,
  loadExactDeclaredHeadSource,
  materializeExactSourceSnapshot,
  observeExactSource,
  observeCombinedLawBuildPreflight,
  observeMaterializedSourceSnapshot,
  observePinnedDockerHostExecutableBoundary,
  observePreservedArtifact,
  parseCanonicalLfsPointer,
  parseExactGitBlobBatchResponse,
  parseExactGitIndexListing,
  parseExactGitTreeListing,
  preserveReceiptBoundArtifact,
  removeSelfCreatedBuildRoot,
  validateCombinedLawBuildPreflight,
  validateCombinedLawBuildReceipt,
} from "../scripts/run-iat-b3-combined-law-reproducible-build.mjs";
import {
  PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
  assertProductionCombinedArtifactBindingReady,
  parseIdentityFreezeJson,
} from "../scripts/validate-iat-b3-identity-freeze.mjs";

const HEAD_SHA = "a".repeat(40);
const TREE_SHA = "b".repeat(40);
const GENERATED_AT = "2026-08-11T08:00:00.000Z";
const TOOLCHAIN = Object.freeze({
  rustc: "rustc 1.97.1 (8bab26f4f 2026-07-14)",
  cargo: "cargo 1.97.1 (c980f4866 2026-06-30)",
  cargoBuildSbf: "solana-cargo-build-sbf 3.1.10",
});
const CONTAINER = Object.freeze({
  ...PINNED_COMBINED_LAW_BUILD_CONTAINER,
  localImageId: `sha256:${"c".repeat(64)}`,
});
const IDENTITY_BINDING = Object.freeze({
  manifestPath: "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
  manifestSha256: "d".repeat(64),
  environmentBindingSha256: "e".repeat(64),
  canonicalManifestReady: true,
});
const MATERIALIZED_SOURCE_OBSERVATION = Object.freeze({
  schema: COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
  declaredHeadSha: HEAD_SHA,
  treeSha: TREE_SHA,
  mountedInputSha256: "7".repeat(64),
  fileCount: 2,
  byteLength: 42,
  lfsPointerCount: 0,
  ignoredWorktreeBytesIncluded: false,
  submodulePolicy: COMBINED_LAW_SUBMODULE_POLICY,
  lfsPolicy: COMBINED_LAW_LFS_POLICY,
});
const IDENTITY_MANIFEST_BYTES = readFileSync(
  new URL("../docs/b3/iat-b3-identity-freeze.v1.json", import.meta.url),
);
const OWNER_POLICY_BYTES = readFileSync(
  new URL("../docs/b3/iat-b3-owner-policy-freeze.v1.json", import.meta.url),
);
const EXACT_TEST_GIT_ENVIRONMENT = createExactSourceGitEnvironment(process.env);
const TRUSTED_TEST_GIT_EXECUTABLE = process.platform === "win32"
  ? "C:\\Program Files\\Git\\bin\\git.exe"
  : "/usr/bin/git";

test("mismatched pinned Git observations report exact diagnostics but never pass", () => {
  const expected = Object.freeze({
    resolvedExecutablePath: "/usr/bin/git",
    version: "git version 2.55.0",
    sha256: "d4d2ba562243015206d4248edfec871a74786499292d00ed072dbca2f5ae8073",
    byteLength: 4_576_040,
    linkCount: 1,
  });
  const observed = Object.freeze({
    resolvedExecutablePath: "/usr/bin/git",
    version: "git version 2.56.0",
    sha256: "b".repeat(64),
    byteLength: 4_200_000,
    linkCount: 2,
  });
  assert.throws(
    () => assertPinnedExactSourceGitObservation({
      label: "EXECUTABLE",
      expected,
      observed,
    }),
    (error) => {
      assert.equal(error.code, "IAT_B3_COMBINED_LAW_PINNED_GIT_EXECUTABLE_BOUNDARY_HOLD");
      assert.deepEqual(error.diagnostic, {
        schema: "iat-b3-pinned-exact-source-git-hold-diagnostic/v1",
        status: "HOLD",
        accepted: false,
        code: "IAT_B3_COMBINED_LAW_PINNED_GIT_EXECUTABLE_BOUNDARY_HOLD",
        label: "EXECUTABLE",
        expected,
        observed,
      });
      assert.match(error.message, /"version":"git version 2\.56\.0"/u);
      assert.match(error.message, /"sha256":"b{64}"/u);
      assert.match(error.message, /"byteLength":4200000/u);
      assert.match(error.message, /"linkCount":2/u);
      return true;
    },
  );
});

function sourceObservations() {
  return Array.from({ length: 4 }, () => ({
    headSha: HEAD_SHA,
    treeSha: TREE_SHA,
    statusPorcelain: "",
  }));
}

function materializedSourceObservations() {
  return Array.from({ length: 4 }, () => ({ ...MATERIALIZED_SOURCE_OBSERVATION }));
}

function buildArtifact(bytes = Buffer.from("deterministic-sbf-bytes"), log = "f") {
  return {
    fileName: "iat_b3_law.so",
    bytes,
    logSha256: log.repeat(64),
  };
}

function preservedArtifact(bytes = Buffer.from("deterministic-sbf-bytes")) {
  return {
    fileName: "iat_b3_law.so",
    bytes,
    atomicNoOverwrite: true,
    readbackVerified: true,
  };
}

function exactGitBlob(path, value, gitMode = "100644") {
  const bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, "utf8");
  const gitObjectSha1 = createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
    .update(bytes)
    .digest("hex");
  return { path, gitMode, gitObjectSha1, bytes };
}

function canonicalTestJson(value) {
  if (Array.isArray(value)) return value.map(canonicalTestJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalTestJson(value[key])]),
    );
  }
  return value;
}

function testRecordSha256(value) {
  return createHash("sha256").update(JSON.stringify(canonicalTestJson(value))).digest("hex");
}

function temporaryDirectory(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function runGit(repositoryRoot, arguments_, {
  environment = EXACT_TEST_GIT_ENVIRONMENT,
  input,
} = {}) {
  const result = spawnSync("git", ["-C", repositoryRoot, ...arguments_], {
    env: environment,
    input,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  assert.equal(
    result.status,
    0,
    `git ${arguments_.join(" ")} failed: ${result.error?.message ?? result.stderr}`,
  );
  return result.stdout.trim();
}

function runTrustedGit(repositoryRoot, arguments_, { input } = {}) {
  const result = spawnSync(TRUSTED_TEST_GIT_EXECUTABLE, [
    `--git-dir=${join(repositoryRoot, ".git")}`,
    `--work-tree=${repositoryRoot}`,
    ...arguments_,
  ], {
    cwd: dirname(TRUSTED_TEST_GIT_EXECUTABLE),
    env: EXACT_TEST_GIT_ENVIRONMENT,
    input,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  assert.equal(
    result.status,
    0,
    `trusted git ${arguments_.join(" ")} failed: ${result.error?.message ?? result.stderr}`,
  );
  return result.stdout.trim();
}

function gitShellQuote(path) {
  return `'${path.replaceAll("\\", "/").replaceAll("'", `'\\''`)}'`;
}

function createCommittedRepository(prefix, content) {
  const root = temporaryDirectory(prefix);
  runGit(root, ["init", "--quiet"]);
  runGit(root, ["config", "user.name", "IAT B3 hostile review"]);
  runGit(root, ["config", "user.email", "iat-b3-review@example.invalid"]);
  writeFileSync(join(root, "input.txt"), content, "utf8");
  runGit(root, ["add", "--", "input.txt"]);
  runGit(root, ["commit", "--quiet", "-m", "exact source"]);
  return Object.freeze({
    root,
    headSha: runGit(root, ["rev-parse", "HEAD"]),
    treeSha: runGit(root, ["rev-parse", "HEAD^{tree}"]),
  });
}

function withProcessEnvironment(overrides, callback) {
  const previous = new Map(Object.keys(overrides).map((name) => [
    name,
    Object.prototype.hasOwnProperty.call(process.env, name) ? process.env[name] : undefined,
  ]));
  try {
    for (const [name, value] of Object.entries(overrides)) process.env[name] = value;
    return callback();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function createReceipt(overrides = {}) {
  return createCombinedLawBuildReceipt({
    generatedAt: GENERATED_AT,
    declaredHeadSha: HEAD_SHA,
    sourceObservations: sourceObservations(),
    materializedSourceObservations: materializedSourceObservations(),
    runnerBinding: {
      executedRunnerSha256: "8".repeat(64),
      committedRunnerSha256: "8".repeat(64),
    },
    identityBinding: { ...IDENTITY_BINDING },
    containerObservation: { ...CONTAINER },
    toolchainObservation: { ...TOOLCHAIN },
    firstArtifact: buildArtifact(),
    secondArtifact: buildArtifact(Buffer.from("deterministic-sbf-bytes"), "1"),
    preservedArtifact: preservedArtifact(),
    ...overrides,
  });
}

function validPreflightInput(overrides = {}) {
  return {
    generatedAt: GENERATED_AT,
    declaredHeadSha: HEAD_SHA,
    sourceObservation: {
      headSha: HEAD_SHA,
      treeSha: TREE_SHA,
      statusPorcelain: "",
    },
    sourceFailure: null,
    executedRunnerSha256: "8".repeat(64),
    committedRunnerSha256: "8".repeat(64),
    nodeVersion: "24.19.0",
    hostPlatform: "linux",
    hostArchitecture: "x64",
    diskVolumePath: "/var/tmp",
    diskFreeBytes: COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes,
    diskFailure: null,
    identityObservation: {
      ready: true,
      manifestSha256: "9".repeat(64),
      manifestByteLength: 4_096,
      ownerPolicySha256: "a".repeat(64),
      ownerPolicyByteLength: 2_048,
      environmentBindingSha256: "b".repeat(64),
      failure: null,
    },
    containerObservation: { ...CONTAINER },
    containerFailure: null,
    toolchainObservation: { ...TOOLCHAIN },
    toolchainFailure: null,
    ...overrides,
  };
}

test("offline preflight binds the exact dual-build contract without proving a build", () => {
  const preflight = createCombinedLawBuildPreflight(validPreflightInput());
  assert.equal(preflight.schema, COMBINED_LAW_BUILD_PREFLIGHT_SCHEMA);
  assert.equal(preflight.status, COMBINED_LAW_BUILD_PREFLIGHT_READY);
  assert.equal(preflight.exitCode, 0);
  assert.equal(preflight.buildExecuted, false);
  assert.equal(preflight.source.repositoryCleanTrackedAndNonignoredUntracked, true);
  assert.equal(preflight.tooling.hostNodeExactPin, null);
  assert.equal(preflight.tooling.hostNodeMinimumVersion, "22.13.0");
  assert.equal(preflight.tooling.ciNodeMajor, 24);
  assert.equal(preflight.identityBinding.canonicalProductionBindingReady, true);
  assert.deepEqual(
    preflight.recipe.arguments,
    PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments,
  );
  assert.equal(preflight.recipe.productionFeature, "production-combined-hook");
  assert.equal(preflight.recipe.repetitions, 2);
  assert.equal(preflight.disk.minimumFreeBytes, 24 * 1024 ** 3);
  assert.equal(preflight.disk.containerImageBytesIncluded, false);
  assert.equal(preflight.programDataBinding.programAccount.byteLength, 36);
  assert.equal(preflight.programDataBinding.programDataAccount.programBytesOffset, 45);
  assert.equal(
    preflight.programDataBinding.programDataAccount.terminalUpgradeAuthorityOption,
    0,
  );
  assert.equal(preflight.programDataBinding, COMBINED_LAW_PROGRAMDATA_BINDING);
  assert.equal(preflight.safety.reproducibleBuildVerified, false);
  assert.equal(preflight.safety.finalProgramDataBindingVerified, false);
  assert.equal(preflight.safety.mainnetStatus, COMBINED_LAW_BUILD_MAINNET_STATUS);
  assert.equal(validateCombinedLawBuildPreflight(preflight), preflight);
});

test("preflight fails closed for every source, host, identity, toolchain, and disk prerequisite", () => {
  const cases = [
    {
      blocker: "EXACT_SOURCE_HEAD_MATCH",
      input: { declaredHeadSha: "c".repeat(40) },
    },
    {
      blocker: "REPOSITORY_CLEAN_TRACKED_AND_NONIGNORED_UNTRACKED",
      input: {
        sourceObservation: {
          headSha: HEAD_SHA,
          treeSha: TREE_SHA,
          statusPorcelain: " M programs/iat_b3_law/src/lib.rs\0",
        },
      },
    },
    {
      blocker: "EXECUTED_RUNNER_MATCHES_DECLARED_HEAD",
      input: { executedRunnerSha256: "7".repeat(64) },
    },
    {
      blocker: "LINUX_AMD64_HOST",
      input: { hostPlatform: "win32" },
    },
    {
      blocker: "HOST_NODE_AT_LEAST_22_13_0",
      input: { nodeVersion: "22.12.9" },
    },
    {
      blocker: "PRODUCTION_COMBINED_IDENTITY_BINDING",
      input: {
        identityObservation: {
          ...validPreflightInput().identityObservation,
          ready: false,
          environmentBindingSha256: null,
          failure: "production identity freeze is unresolved",
        },
      },
    },
    {
      blocker: "PINNED_CONTAINER_PRESENT",
      input: { containerObservation: null, containerFailure: "image absent" },
    },
    {
      blocker: "PINNED_CONTAINER_TOOLCHAIN",
      input: {
        toolchainObservation: { ...TOOLCHAIN, cargoBuildSbf: "solana-cargo-build-sbf 3.1.11" },
      },
    },
    {
      blocker: "BUILD_VOLUME_MINIMUM_24_GIB_FREE",
      input: { diskFreeBytes: COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes - 1 },
    },
  ];
  for (const { blocker, input } of cases) {
    const preflight = createCombinedLawBuildPreflight(validPreflightInput(input));
    assert.equal(preflight.status, COMBINED_LAW_BUILD_PREFLIGHT_HOLD, blocker);
    assert.equal(preflight.exitCode, 2, blocker);
    assert.equal(preflight.buildExecuted, false, blocker);
    assert.ok(preflight.blockers.includes(blocker), blocker);
  }
});

test("preflight digest and blocker-set tampering fail validation", () => {
  const valid = createCombinedLawBuildPreflight(validPreflightInput());
  const digestTamper = JSON.parse(JSON.stringify(valid));
  digestTamper.identityBinding.failure = "tampered narrative";
  assert.throws(
    () => validateCombinedLawBuildPreflight(digestTamper),
    /PREFLIGHT_DIGEST_MISMATCH/u,
  );

  const blockerTamper = JSON.parse(JSON.stringify(valid));
  blockerTamper.blockers.push("FABRICATED_BLOCKER");
  assert.throws(
    () => validateCombinedLawBuildPreflight(blockerTamper),
    /PREFLIGHT_BLOCKER_SET_MISMATCH/u,
  );

  const dirty = createCombinedLawBuildPreflight(validPreflightInput({
    sourceObservation: {
      headSha: HEAD_SHA,
      treeSha: TREE_SHA,
      statusPorcelain: " M Cargo.lock\0",
    },
  }));
  const promotionTamper = JSON.parse(JSON.stringify(dirty));
  promotionTamper.status = COMBINED_LAW_BUILD_PREFLIGHT_READY;
  promotionTamper.exitCode = 0;
  promotionTamper.checks.find(
    ({ id }) => id === "REPOSITORY_CLEAN_TRACKED_AND_NONIGNORED_UNTRACKED",
  ).passed = true;
  promotionTamper.blockers = [];
  const { preflightSha256: ignoredSha256, ...promotionCore } = promotionTamper;
  assert.equal(typeof ignoredSha256, "string");
  promotionTamper.preflightSha256 = testRecordSha256(promotionCore);
  assert.throws(
    () => validateCombinedLawBuildPreflight(promotionTamper),
    /PREFLIGHT_CHECK_SET_MISMATCH/u,
  );
});

test("runtime preflight can be probed without container execution and never runs SBF", () => {
  const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
  const currentHead = observeExactSource(repositoryRoot).headSha;
  const preflight = observeCombinedLawBuildPreflight({
    repositoryRoot,
    environment: { ...process.env, IAT_B3_EXACT_SOURCE_HEAD_SHA: currentHead },
    generatedAt: GENERATED_AT,
    probeContainer: false,
  });
  assert.equal(preflight.status, COMBINED_LAW_BUILD_PREFLIGHT_HOLD);
  assert.equal(preflight.exitCode, 2);
  assert.equal(preflight.buildExecuted, false);
  assert.equal(preflight.source.observedHeadSha, currentHead);
  assert.equal(preflight.identityBinding.canonicalProductionBindingReady, false);
  assert.equal(preflight.safety.reproducibleBuildVerified, false);
  assert.equal(preflight.safety.deployment, false);
});

test("a valid receipt proves only exact-source dual-build equality and preserves Mainnet HOLD", () => {
  const receipt = createReceipt();
  assert.equal(receipt.schema, COMBINED_LAW_BUILD_RECEIPT_SCHEMA);
  assert.equal(receipt.status, COMBINED_LAW_BUILD_RECEIPT_STATUS);
  assert.equal(receipt.source.declaredHeadSha, HEAD_SHA);
  assert.equal(receipt.source.observedHeadSha, HEAD_SHA);
  assert.equal(receipt.source.repositoryCleanTrackedAndNonignoredUntracked, true);
  assert.equal(receipt.source.executedRunnerSha256, "8".repeat(64));
  assert.equal(receipt.source.committedRunnerSha256, "8".repeat(64));
  assert.equal(receipt.source.revalidationCount, 4);
  assert.equal(receipt.source.materializationSchema, COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA);
  assert.equal(receipt.source.materializedTreeSha, TREE_SHA);
  assert.equal(receipt.source.mountedInputSha256, "7".repeat(64));
  assert.equal(receipt.source.ignoredWorktreeBytesIncluded, false);
  assert.equal(receipt.source.submodulePolicy, COMBINED_LAW_SUBMODULE_POLICY);
  assert.equal(receipt.source.lfsPolicy, COMBINED_LAW_LFS_POLICY);
  assert.equal(receipt.source.materializationRevalidationCount, 4);
  assert.equal(receipt.container.executionReference, PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference);
  assert.equal(receipt.container.pullPolicy, "never");
  assert.equal(receipt.container.networkMode, "none");
  assert.equal(receipt.toolchain.platformToolsVersion, "1.52");
  assert.equal(receipt.toolchain.preinstalledToolsOnly, true);
  assert.deepEqual(receipt.recipe.arguments, PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments);
  assert.equal(receipt.artifact.identicalByteLength, true);
  assert.equal(receipt.artifact.identicalSha256, true);
  assert.equal(receipt.artifact.identicalBytes, true);
  assert.equal(receipt.artifact.preservedArtifactSha256, receipt.artifact.sha256);
  assert.equal(receipt.artifact.preservedArtifactByteLength, receipt.artifact.byteLength);
  assert.equal(receipt.artifact.preservedOutputAtomicNoOverwrite, true);
  assert.equal(receipt.artifact.preservedOutputReadbackVerified, true);
  assert.equal(receipt.safety.publicNetworkWrites, false);
  assert.equal(receipt.safety.signing, false);
  assert.equal(receipt.safety.deployment, false);
  assert.equal(receipt.safety.identityAuthorityVerified, false);
  assert.equal("sourceBoundAutomatedDirectEvidenceVerified" in receipt.safety, false);
  assert.equal(receipt.safety.adversarialDevnetFinalBinaryAccepted, false);
  assert.equal(receipt.safety.productionCandidate, false);
  assert.equal(receipt.safety.mainnetExecutionAuthorized, false);
  assert.equal(receipt.safety.reproducibleBuildVerified, false);
  assert.equal(receipt.safety.mainnetStatus, COMBINED_LAW_BUILD_MAINNET_STATUS);
  assert.equal(receipt.safety.mainnetStatus, "HOLD");
  assert.equal(validateCombinedLawBuildReceipt(receipt), receipt);
  const serializedCopy = JSON.parse(JSON.stringify(receipt));
  assert.equal(validateCombinedLawBuildReceipt(serializedCopy), serializedCopy);
});

test("law receipt requires the exact committed runner bytes", () => {
  assert.throws(
    () => createReceipt({
      runnerBinding: {
        executedRunnerSha256: "8".repeat(64),
        committedRunnerSha256: "9".repeat(64),
      },
    }),
    /IAT_B3_COMBINED_LAW_RECEIPT_RUNNER_BINDING_INVALID/u,
  );
  const receipt = structuredClone(createReceipt());
  receipt.source.committedRunnerSha256 = "9".repeat(64);
  assert.throws(
    () => validateCombinedLawBuildReceipt(receipt),
    /INVALID_IAT_B3_COMBINED_LAW_BUILD_SOURCE_BINDING/u,
  );
});

test("source binding rejects missing, mismatched, dirty, and drifting observations", async (t) => {
  await t.test("missing or malformed declared head", () => {
    assert.throws(
      () => assertExactCleanSourceSequence({ declaredHeadSha: "", observations: sourceObservations() }),
      /EXACT_SOURCE_HEAD_SHA_INVALID/u,
    );
    assert.throws(
      () => assertExactCleanSourceSequence({ declaredHeadSha: "A".repeat(40), observations: sourceObservations() }),
      /EXACT_SOURCE_HEAD_SHA_INVALID/u,
    );
  });
  await t.test("head mismatch", () => {
    const observations = sourceObservations();
    observations[2].headSha = "9".repeat(40);
    assert.throws(
      () => assertExactCleanSourceSequence({ declaredHeadSha: HEAD_SHA, observations }),
      /SOURCE_HEAD_MISMATCH_AT_2/u,
    );
  });
  await t.test("tracked and nonignored untracked dirt both fail closed", () => {
    for (const statusPorcelain of [" M tracked.rs\0", "?? untracked.json\0"]) {
      const observations = sourceObservations();
      observations[1].statusPorcelain = statusPorcelain;
      assert.throws(
        () => assertExactCleanSourceSequence({ declaredHeadSha: HEAD_SHA, observations }),
        /DIRTY_TRACKED_OR_UNTRACKED_HOLD_AT_1/u,
      );
    }
  });
  await t.test("tree drift and insufficient revalidation", () => {
    const observations = sourceObservations();
    observations[3].treeSha = "8".repeat(40);
    assert.throws(
      () => assertExactCleanSourceSequence({ declaredHeadSha: HEAD_SHA, observations }),
      /SOURCE_TREE_DRIFT_HOLD_AT_3/u,
    );
    assert.throws(
      () => assertExactCleanSourceSequence({
        declaredHeadSha: HEAD_SHA,
        observations: sourceObservations().slice(0, 2),
      }),
      /SOURCE_REVALIDATIONS_REQUIRED/u,
    );
  });
});

test("mounted-source receipt binding rejects worktree inclusion, tree drift, and weak policies", () => {
  assert.deepEqual(
    assertExactMaterializedSourceSequence({
      declaredHeadSha: HEAD_SHA,
      observations: materializedSourceObservations(),
    }),
    MATERIALIZED_SOURCE_OBSERVATION,
  );
  for (const mutate of [
    (value) => { value.treeSha = "8".repeat(40); },
    (value) => { value.mountedInputSha256 = "9".repeat(64); },
    (value) => { value.ignoredWorktreeBytesIncluded = true; },
    (value) => { value.submodulePolicy = "ALLOW"; },
    (value) => { value.lfsPolicy = "SMUDGE"; },
  ]) {
    const observations = materializedSourceObservations();
    mutate(observations[2]);
    assert.throws(
      () => assertExactMaterializedSourceSequence({ declaredHeadSha: HEAD_SHA, observations }),
      /MATERIALIZED_SOURCE_(?:OBSERVATION_INVALID|DRIFT_HOLD)/u,
    );
  }
  assert.throws(
    () => assertExactMaterializedSourceSequence({
      declaredHeadSha: HEAD_SHA,
      observations: materializedSourceObservations().slice(0, 2),
    }),
    /MATERIALIZED_SOURCE_REVALIDATIONS_REQUIRED/u,
  );
  assert.throws(
    () => createReceipt({
      materializedSourceObservations: materializedSourceObservations().map((value) => ({
        ...value,
        treeSha: "8".repeat(40),
      })),
    }),
    /MATERIALIZED_TREE_HEAD_MISMATCH_HOLD/u,
  );
});

test("container and toolchain observations reject every mutable or wrong pin", async (t) => {
  assert.deepEqual(assertPinnedContainerObservation({ ...CONTAINER }), CONTAINER);
  assert.deepEqual(assertPinnedToolchainObservation({ ...TOOLCHAIN }), TOOLCHAIN);

  await t.test("container platform, digest reference, pull policy, and image ID", () => {
    for (const mutate of [
      (value) => { value.platform = "linux/arm64"; },
      (value) => { value.executionReference = "solanafoundation/anchor:v1.0.2"; },
      (value) => { value.dockerEndpoint = "tcp://builder.example:2376"; },
      (value) => { value.pullPolicy = "missing"; },
      (value) => { value.networkMode = "bridge"; },
      (value) => { value.localImageId = "sha256:not-a-digest"; },
    ]) {
      const observation = { ...CONTAINER };
      mutate(observation);
      assert.throws(
        () => assertPinnedContainerObservation(observation),
        /CONTAINER_.+(?:DRIFT_HOLD|INVALID)/u,
      );
    }
  });

  await t.test("Rust, Cargo, and cargo-build-sbf versions", () => {
    for (const [field, value] of [
      ["rustc", "rustc 1.97.0 (8bab26f4f 2026-07-14)"],
      ["cargo", "cargo 1.97.1-nightly (c980f4866 2026-06-30)"],
      ["cargoBuildSbf", "solana-cargo-build-sbf 3.1.11"],
    ]) {
      const observation = { ...TOOLCHAIN, [field]: value };
      assert.throws(
        () => assertPinnedToolchainObservation(observation),
        /VERSION_DRIFT_HOLD/u,
      );
    }
  });
});

test("receipt construction rejects recipe drift and nonidentical or invalid artifacts", () => {
  assert.throws(
    () => createReceipt({ generatedAt: "2026-02-30T08:00:00.000Z" }),
    /RECEIPT_TIME_INVALID/u,
  );
  assert.throws(
    () => createReceipt({
      recipe: {
        ...PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
        repetitions: 1,
      },
    }),
    /BUILD_RECIPE_DRIFT_HOLD/u,
  );
  assert.throws(
    () => createReceipt({ secondArtifact: buildArtifact(Buffer.from("one-byte-different!"), "1") }),
    /SBF_(?:BYTE_LENGTH|SHA256)_MISMATCH_HOLD/u,
  );
  assert.throws(
    () => createReceipt({ firstArtifact: buildArtifact(Buffer.alloc(0)) }),
    /FIRST_ARTIFACT_INVALID/u,
  );
  assert.throws(
    () => createReceipt({ preservedArtifact: preservedArtifact(Buffer.from("different-preserved-bytes")) }),
    /PRESERVED_SBF_MISMATCH_HOLD/u,
  );
  assert.throws(
    () => createReceipt({
      preservedArtifact: {
        ...preservedArtifact(),
        atomicNoOverwrite: false,
      },
    }),
    /PRESERVED_ARTIFACT_INVALID/u,
  );
  assert.throws(
    () => createReceipt({
      secondArtifact: {
        ...buildArtifact(Buffer.from("deterministic-sbf-bytes"), "1"),
        fileName: "substituted.so",
      },
    }),
    /SECOND_ARTIFACT_INVALID/u,
  );
});

test("serialized receipt tampering cannot elevate any Mainnet truth", () => {
  const receipt = createReceipt();
  for (const mutate of [
    (value) => { value.safety.mainnetExecutionAuthorized = true; },
    (value) => { value.safety.productionCandidate = true; },
    (value) => { value.safety.reproducibleBuildVerified = true; },
    (value) => { value.artifact.identicalBytes = false; },
    (value) => { value.container.executionReference = "solanafoundation/anchor:v1.0.2"; },
    (value) => { value.source.observedHeadSha = "9".repeat(40); },
    (value) => { value.source.mountedInputSha256 = "8".repeat(64); },
    (value) => { value.artifact.preservedOutputReadbackVerified = false; },
    (value) => { value.extra = true; },
    (value) => { value.recipe.arguments.extra = "ignored-by-JSON"; },
  ]) {
    const copy = JSON.parse(JSON.stringify(receipt));
    mutate(copy);
    assert.throws(
      () => validateCombinedLawBuildReceipt(copy),
      /INVALID_|DIGEST_MISMATCH|DRIFT_HOLD/u,
    );
  }
  const digestOnly = JSON.parse(JSON.stringify(receipt));
  digestOnly.receiptSha256 = "0".repeat(64);
  assert.throws(
    () => validateCombinedLawBuildReceipt(digestOnly),
    /RECEIPT_DIGEST_MISMATCH/u,
  );
});

test("Docker build argv is immutable, offline, non-signing, and uses fresh external mounts", () => {
  const environmentNames = [
    "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
    "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
    "IAT_B3_PRODUCTION_CANONICAL_MINT",
  ];
  const arguments_ = createCombinedLawDockerBuildArguments({
    sourceSnapshotRoot: "/runner/temp/exact-source",
    hostBuildRoot: "/runner/temp/run-1",
    containerBuildRoot: "/iat-build/run-1",
    identityEnvironmentNames: environmentNames,
  });
  for (const required of [
    "--host=unix:///var/run/docker.sock",
    "--pull=never",
    "--network=none",
    "--platform=linux/amd64",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--mount=type=bind,source=/runner/temp/exact-source,target=/iat-source,readonly",
    "--mount=type=bind,source=/runner/temp/run-1,target=/iat-build/run-1",
    "--env=IAT_B3_EXACT_SOURCE_HEAD_SHA",
    "--entrypoint=cargo",
    PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
    "--offline",
    "--skip-tools-install",
    "--locked",
    "/iat-build/run-1/output",
    "/iat-build/run-1/target",
  ]) assert.ok(arguments_.includes(required), `missing immutable Docker/build argument: ${required}`);
  for (const name of environmentNames) assert.ok(arguments_.includes(`--env=${name}`));
  assert.equal(arguments_.some((argument) => argument.includes("deploy")), false);
  assert.equal(arguments_.some((argument) => argument.includes("sign")), false);
  assert.equal(arguments_.some((argument) => argument.includes("mainnet")), false);
  assert.equal(arguments_.some((argument) => argument.includes("<FRESH_")), false);
  assert.throws(
    () => createCombinedLawDockerBuildArguments({
      sourceSnapshotRoot: "/runner/temp/exact-source",
      hostBuildRoot: "/runner/temp/run-1",
      containerBuildRoot: "/iat-build/run-1",
      identityEnvironmentNames: [...environmentNames.slice(0, 2), "AWS_SECRET_ACCESS_KEY"],
    }),
    /DOCKER_BUILD_ARGUMENT_INPUT_INVALID/u,
  );
  assert.throws(
    () => createCombinedLawDockerBuildArguments({
      sourceSnapshotRoot: "/workspace/repository,other",
      hostBuildRoot: "/runner/temp/run-1",
      containerBuildRoot: "/iat-build/run-1",
      identityEnvironmentNames: environmentNames,
    }),
    /DOCKER_MOUNT_PATH_UNSAFE/u,
  );

  assert.equal(
    assertPinnedDockerCommandArguments(
      arguments_,
      PINNED_DOCKER_COMMAND_PURPOSE.lawBuild,
    ),
    true,
  );
  for (const mutate of [
    (value) => value.splice(5, 0, "--network=host"),
    (value) => value.push("--pull=always"),
    (value) => value.push("--privileged=true"),
    (value) => value.push("--cap-add=ALL"),
    (value) => value.push("--security-opt=seccomp=unconfined"),
    (value) => value.splice(2, 0, "--pid", "host"),
    (value) => { value[0] = "--host=tcp://attacker.invalid:2375"; },
    (value) => { value[value.indexOf("--entrypoint=cargo")] = "--entrypoint=/bin/sh"; },
    (value) => value.splice(9, 0, "--device=/dev/sda"),
    (value) => value.splice(9, 0, "--mount=type=bind,source=/,target=/host"),
  ]) {
    const forged = [...arguments_];
    mutate(forged);
    assert.throws(
      () => assertPinnedDockerCommandArguments(
        forged,
        PINNED_DOCKER_COMMAND_PURPOSE.lawBuild,
      ),
      /PINNED_DOCKER_.+HOLD/u,
    );
  }
});

test("pinned Docker host boundary ignores repository-local and hostile PATH shims without invoking Docker", () => {
  const repository = createCommittedRepository(
    "iat-b3-repository-local-docker-shim-",
    "docker-shim-boundary\n",
  );
  const helperRoot = temporaryDirectory("iat-b3-hostile-docker-path-");
  const configRoot = join(helperRoot, "empty-docker-config");
  const markerPath = join(helperRoot, "hostile-docker-ran.marker");
  const previousPath = process.env.PATH;
  try {
    mkdirSync(configRoot);
    let probe;
    if (process.platform === "win32") {
      writeFileSync(join(repository.root, "docker.cmd"), `@echo ran>>"${markerPath}"\r\n`, "utf8");
      writeFileSync(join(repository.root, "docker.bat"), `@echo ran>>"${markerPath}"\r\n`, "utf8");
      copyFileSync(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "where.exe"), join(repository.root, "docker.exe"));
      probe = spawnSync(
        join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"),
        ["/d", "/c", `${join(repository.root, "docker.cmd")} --version`],
        { cwd: repository.root, encoding: "utf8", windowsHide: true },
      );
    } else {
      const shim = join(repository.root, "docker");
      writeFileSync(shim, `#!/bin/sh\nprintf 'ran\\n' >> ${gitShellQuote(markerPath)}\nexit 0\n`, "utf8");
      chmodSync(shim, 0o755);
      probe = spawnSync(shim, ["--version"], {
        cwd: repository.root,
        encoding: "utf8",
      });
    }
    assert.equal(probe.status, 0, probe.stderr);
    assert.equal(existsSync(markerPath), true);
    unlinkSync(markerPath);
    process.env.PATH = [repository.root, "", ".", helperRoot, previousPath ?? ""]
      .join(delimiter);

    if (process.platform === "linux") {
      let observation = null;
      let hostedBoundaryHold = null;
      try {
        observation = observePinnedDockerHostExecutableBoundary();
      } catch (error) {
        assert(error instanceof Error);
        assert([
          "IAT_B3_PINNED_DOCKER_EXECUTABLE_REQUIRED_HOLD",
          "IAT_B3_PINNED_DOCKER_EXECUTABLE_BOUNDARY_HOLD",
          "IAT_B3_PINNED_DOCKER_EXECUTABLE_BYTES_DRIFT_HOLD",
        ].includes(error.message), `unexpected hosted Docker boundary failure: ${error.message}`);
        hostedBoundaryHold = error.message;
      }
      if (observation !== null) {
        assert.equal(observation.executablePath, "/usr/bin/docker");
      } else {
        assert.equal(typeof hostedBoundaryHold, "string");
      }
      const environment = createPinnedDockerEnvironment({
        configRoot,
        environment: {
          PATH: process.env.PATH,
          DOCKER_HOST: "tcp://attacker.invalid:2375",
          DOCKER_CONTEXT: "attacker",
          DOCKER_CONFIG: repository.root,
          LD_PRELOAD: join(repository.root, "hostile.so"),
          IAT_B3_EXACT_SOURCE_HEAD_SHA: "a".repeat(40),
        },
      });
      assert.equal(environment.PATH, "/usr/bin:/bin");
      assert.equal(environment.DOCKER_CONFIG, configRoot);
      assert.equal("DOCKER_HOST" in environment, false);
      assert.equal("DOCKER_CONTEXT" in environment, false);
      assert.equal("LD_PRELOAD" in environment, false);
    } else {
      assert.throws(
        () => observePinnedDockerHostExecutableBoundary(),
        /PINNED_DOCKER_HOST_PLATFORM_HOLD/u,
      );
    }
    const source = readFileSync(
      new URL("../scripts/run-iat-b3-combined-law-reproducible-build.mjs", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /spawnSync\(\s*["']docker["']/u);
    assert.doesNotMatch(source, /execute\(\s*["']docker["']/u);
    assert.match(source, /spawnSync\(executable\.absolutePath/u);
    assert.equal(existsSync(markerPath), false, "pinned boundary executed hostile Docker shim");
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    rmSync(repository.root, { recursive: true, force: true });
    rmSync(helperRoot, { recursive: true, force: true });
  }
});

test("Git tree intake rejects submodules, symlinks, unsafe paths, and malformed listings", () => {
  const blobSha = "1".repeat(40);
  assert.deepEqual(
    parseExactGitTreeListing(Buffer.from(`100644 blob ${blobSha}\tCargo.toml\0`, "utf8")),
    [{ path: "Cargo.toml", gitMode: "100644", gitObjectSha1: blobSha }],
  );
  for (const [record, expression] of [
    [`160000 commit ${"2".repeat(40)}\tvendor/submodule\0`, /SUBMODULE_GITLINK_FORBIDDEN_HOLD/u],
    [`120000 blob ${blobSha}\tlink\0`, /NONREGULAR_GIT_ENTRY_FORBIDDEN_HOLD/u],
    [`100644 blob ${blobSha}\t../escape\0`, /GIT_TREE_PATH_UNSAFE/u],
    [`100644 blob ${blobSha}\tdir\\windows-escape\0`, /GIT_TREE_PATH_UNSAFE/u],
    [`100644 blob ${blobSha} missing-tab\0`, /GIT_TREE_LISTING_MALFORMED/u],
  ]) {
    assert.throws(
      () => parseExactGitTreeListing(Buffer.from(record, "utf8")),
      expression,
    );
  }
});

test("Git blob batch intake binds every exact object and rejects truncation, substitution, or trailing data", () => {
  const file = exactGitBlob("Cargo.toml", "exact-object-bytes");
  const descriptors = [{
    path: file.path,
    gitMode: file.gitMode,
    gitObjectSha1: file.gitObjectSha1,
  }];
  const response = Buffer.concat([
    Buffer.from(`${file.gitObjectSha1} blob ${file.bytes.length}\n`, "utf8"),
    file.bytes,
    Buffer.from("\n", "utf8"),
  ]);
  assert.deepEqual(parseExactGitBlobBatchResponse({ descriptors, response }), [file]);
  const wrongObject = Buffer.from(response);
  wrongObject[0] = wrongObject[0] === 97 ? 98 : 97;
  assert.throws(
    () => parseExactGitBlobBatchResponse({ descriptors, response: wrongObject }),
    /GIT_BLOB_BATCH_BINDING_MISMATCH/u,
  );
  assert.throws(
    () => parseExactGitBlobBatchResponse({
      descriptors,
      response: response.subarray(0, response.length - 1),
    }),
    /GIT_BLOB_BATCH_TRUNCATED/u,
  );
  assert.throws(
    () => parseExactGitBlobBatchResponse({
      descriptors,
      response: Buffer.concat([response, Buffer.from("trailing")]),
    }),
    /GIT_BLOB_BATCH_TRAILING_DATA/u,
  );
});

test("canonical Git-LFS pointers and index records bind exact object identity and size", () => {
  const payload = Buffer.from("source-bound-smudged-lfs-object\n", "utf8");
  const oidSha256 = createHash("sha256").update(payload).digest("hex");
  const pointer = Buffer.from([
    "version https://git-lfs.github.com/spec/v1",
    `oid sha256:${oidSha256}`,
    `size ${payload.length}`,
    "",
  ].join("\n"), "utf8");
  assert.deepEqual(parseCanonicalLfsPointer(pointer), {
    oidSha256,
    byteLength: payload.length,
  });
  assert.equal(parseCanonicalLfsPointer(Buffer.from("ordinary\n")), null);
  assert.throws(
    () => parseCanonicalLfsPointer(Buffer.from(
      `version https://git-lfs.github.com/spec/v1\noid sha256:${oidSha256}\nsize 01\n`,
    )),
    /LFS_POINTER_NONCANONICAL_HOLD/u,
  );

  const blob = exactGitBlob("asset.bin", pointer);
  const listing = Buffer.from(
    `${blob.gitMode} ${blob.gitObjectSha1} 0\t${blob.path}\0`,
    "utf8",
  );
  assert.deepEqual(parseExactGitIndexListing(listing), [{
    path: blob.path,
    gitMode: blob.gitMode,
    gitObjectSha1: blob.gitObjectSha1,
  }]);
  assert.throws(
    () => parseExactGitIndexListing(Buffer.from(
      `${blob.gitMode} ${blob.gitObjectSha1} 1\t${blob.path}\0`,
      "utf8",
    )),
    /GIT_INDEX_ENTRY_INVALID_HOLD/u,
  );
});

test("linked-worktree exact-source observation validates smudged LFS bytes without filters and rejects adversarial drift", async (t) => {
  const root = temporaryDirectory("iat-b3-lfs-linked-observer-");
  const primary = join(root, "primary");
  const linked = join(root, "linked");
  const outside = join(root, "outside");
  const payload = Buffer.from("source-bound-smudged-lfs-object\n", "utf8");
  const sameSizeWrongPayload = Buffer.from(payload);
  sameSizeWrongPayload[0] ^= 0xff;
  const oidSha256 = createHash("sha256").update(payload).digest("hex");
  const pointer = Buffer.from([
    "version https://git-lfs.github.com/spec/v1",
    `oid sha256:${oidSha256}`,
    `size ${payload.length}`,
    "",
  ].join("\n"), "utf8");
  const assetPath = join(linked, "asset.bin");
  try {
    mkdirSync(primary, { recursive: true });
    runGit(primary, ["init", "--quiet"]);
    runGit(primary, ["config", "user.name", "IAT B3 LFS observer"]);
    runGit(primary, ["config", "user.email", "iat-b3-lfs@example.invalid"]);
    writeFileSync(join(primary, ".gitattributes"), "*.bin filter=lfs diff=lfs merge=lfs -text\n");
    writeFileSync(join(primary, "asset.bin"), pointer);
    writeFileSync(join(primary, "ordinary.txt"), "ordinary committed bytes\n");
    mkdirSync(join(primary, "nested"));
    writeFileSync(join(primary, "nested", "bound.txt"), "nested committed bytes\n");
    const committedPaths = [
      ".gitattributes", "asset.bin", "ordinary.txt", "nested/bound.txt",
    ];
    if (process.platform !== "win32") {
      writeFileSync(join(primary, "executable.sh"), "#!/bin/sh\nexit 0\n");
      chmodSync(join(primary, "executable.sh"), 0o755);
      committedPaths.push("executable.sh");
    }
    runGit(primary, ["add", "--", ...committedPaths]);
    runGit(primary, ["commit", "--quiet", "-m", "exact LFS pointer source"]);
    runGit(primary, ["worktree", "add", "--quiet", "--detach", linked, "HEAD"]);
    runGit(linked, ["config", "core.autocrlf", "false"]);
    writeFileSync(assetPath, payload);

    runGit(linked, ["config", "filter.lfs.clean", "false"]);
    runGit(linked, ["config", "filter.lfs.smudge", "false"]);
    runGit(linked, ["config", "filter.lfs.process", "false"]);
    runGit(linked, ["config", "filter.lfs.required", "true"]);
    const clean = observeExactSource(linked);
    assert.equal(clean.statusPorcelain, "");

    await t.test("linked-worktree control and reciprocal backlink are authenticated on every host", () => {
      const controlPath = join(linked, ".git");
      const control = readFileSync(controlPath, "utf8");
      const gitDirectory = /^gitdir: (?<path>[^\r\n]+)\r?\n?$/u.exec(control)?.groups?.path;
      assert.ok(gitDirectory);
      const backlinkPath = join(gitDirectory, "gitdir");
      const originalBacklink = readFileSync(backlinkPath, "utf8");
      try {
        writeFileSync(backlinkPath, `${join(primary, ".git")}\n`);
        assert.throws(
          () => observeExactSource(linked),
          /IAT_B3_EXACT_SOURCE_WSL_GITDIR_BACKLINK_MISMATCH/u,
        );
      } finally {
        writeFileSync(backlinkPath, originalBacklink);
      }
      assert.equal(observeExactSource(linked).statusPorcelain, "");
    });

    await t.test("ordinary tracked mutation and every untracked path remain dirty", () => {
      const ordinaryPath = join(linked, "ordinary.txt");
      writeFileSync(ordinaryPath, "ordinary mutation\n");
      assert.match(observeExactSource(linked).statusPorcelain, / M ordinary\.txt\0/u);
      writeFileSync(ordinaryPath, "ordinary committed bytes\n");
      writeFileSync(join(linked, "untracked.txt"), "untracked\n");
      assert.match(observeExactSource(linked).statusPorcelain, /\?\? untracked\.txt\0/u);
      rmSync(join(linked, "untracked.txt"));
      assert.equal(observeExactSource(linked).statusPorcelain, "");
    });

    await t.test("tracked hardlinks and POSIX execute-bit drift fail closed", () => {
      const ordinaryPath = join(linked, "ordinary.txt");
      const aliasPath = join(root, "ordinary-hardlink.txt");
      linkSync(ordinaryPath, aliasPath);
      try {
        assert.throws(
          () => observeExactSource(linked),
          /WORKTREE_TRACKED_FILE_HARDLINK_HOLD/u,
        );
      } finally {
        unlinkSync(aliasPath);
      }
      assert.equal(observeExactSource(linked).statusPorcelain, "");

      if (process.platform !== "win32") {
        chmodSync(ordinaryPath, 0o755);
        assert.throws(
          () => observeExactSource(linked),
          /WORKTREE_TRACKED_FILE_EXECUTE_MODE_DRIFT_HOLD/u,
        );
        chmodSync(ordinaryPath, 0o644);
        const executablePath = join(linked, "executable.sh");
        chmodSync(executablePath, 0o644);
        assert.throws(
          () => observeExactSource(linked),
          /WORKTREE_TRACKED_FILE_EXECUTE_MODE_DRIFT_HOLD/u,
        );
        chmodSync(executablePath, 0o755);
        assert.equal(observeExactSource(linked).statusPorcelain, "");
      }
    });

    await t.test("linked commondir is same-file bound to the canonical common Git directory", () => {
      const control = readFileSync(join(linked, ".git"), "utf8");
      const gitDirectory = /^gitdir: (?<path>[^\r\n]+)\r?\n?$/u.exec(control)?.groups?.path;
      assert.ok(gitDirectory);
      const commondirPath = join(gitDirectory, "commondir");
      const original = readFileSync(commondirPath, "utf8");
      try {
        mkdirSync(outside, { recursive: true });
        writeFileSync(commondirPath, `${outside}\n`, "utf8");
        assert.throws(
          () => observeExactSource(linked),
          /IAT_B3_EXACT_SOURCE_COMMONDIR_CONTROL_INVALID/u,
        );
        writeFileSync(commondirPath, "../../../outside\n", "utf8");
        assert.throws(
          () => observeExactSource(linked),
          /IAT_B3_EXACT_SOURCE_COMMONDIR_BOUNDARY_INVALID/u,
        );
      } finally {
        writeFileSync(commondirPath, original, "utf8");
      }
      assert.equal(observeExactSource(linked).statusPorcelain, "");
    });

    await t.test("linked common object-store alternates are forbidden", () => {
      const alternatesPath = join(primary, ".git", "objects", "info", "alternates");
      mkdirSync(outside, { recursive: true });
      writeFileSync(alternatesPath, `${outside}\n`, "utf8");
      try {
        assert.throws(
          () => observeExactSource(linked),
          /IAT_B3_EXACT_SOURCE_GIT_OBJECT_ALTERNATES_FORBIDDEN_HOLD/u,
        );
      } finally {
        rmSync(alternatesPath, { force: true });
      }
      assert.equal(observeExactSource(linked).statusPorcelain, "");
    });

    await t.test("LFS pointer mutation, wrong size, and wrong SHA-256 remain dirty", () => {
      writeFileSync(assetPath, Buffer.from(
        pointer.toString("utf8").replace(oidSha256, "f".repeat(64)),
        "utf8",
      ));
      assert.match(observeExactSource(linked).statusPorcelain, / M asset\.bin\0/u);
      writeFileSync(assetPath, payload.subarray(0, payload.length - 1));
      assert.match(observeExactSource(linked).statusPorcelain, / M asset\.bin\0/u);
      writeFileSync(assetPath, sameSizeWrongPayload);
      assert.match(observeExactSource(linked).statusPorcelain, / M asset\.bin\0/u);
      writeFileSync(assetPath, payload);
      assert.equal(observeExactSource(linked).statusPorcelain, "");
    });

    await t.test("missing tracked files and nonstandard index flags fail closed", () => {
      rmSync(assetPath);
      assert.throws(
        () => observeExactSource(linked),
        /WORKTREE_TRACKED_FILE_REQUIRED_HOLD/u,
      );
      writeFileSync(assetPath, payload);
      runGit(linked, ["update-index", "--skip-worktree", "ordinary.txt"]);
      assert.throws(
        () => observeExactSource(linked),
        /GIT_INDEX_NONSTANDARD_FLAG_HOLD/u,
      );
      runGit(linked, ["update-index", "--no-skip-worktree", "ordinary.txt"]);
      assert.equal(observeExactSource(linked).statusPorcelain, "");
    });

    await t.test("staged index drift never receives the LFS exception", () => {
      writeFileSync(assetPath, sameSizeWrongPayload);
      const wrongBlobSha = runGit(linked, [
        "hash-object",
        "-w",
        "--no-filters",
        "--",
        "asset.bin",
      ]);
      runGit(linked, ["update-index", "--cacheinfo", `100644,${wrongBlobSha},asset.bin`]);
      assert.throws(
        () => observeExactSource(linked),
        /INDEX_HEAD_TREE_MISMATCH_HOLD/u,
      );
      const pointerBlobSha = runGit(linked, ["rev-parse", "HEAD:asset.bin"]);
      runGit(linked, [
        "update-index",
        "--cacheinfo",
        `100644,${pointerBlobSha},asset.bin`,
      ]);
      writeFileSync(assetPath, payload);
      assert.equal(observeExactSource(linked).statusPorcelain, "");
    });

    if (process.platform === "linux") {
      await t.test("file and parent-directory symlink drift fail closed", () => {
        mkdirSync(outside, { recursive: true });
        const outsideAsset = join(outside, "asset.bin");
        writeFileSync(outsideAsset, payload);
        rmSync(assetPath);
        symlinkSync(outsideAsset, assetPath);
        assert.throws(
          () => observeExactSource(linked),
          /WORKTREE_TRACKED_FILE_REPARSE_OR_TYPE_DRIFT_HOLD/u,
        );
        rmSync(assetPath);
        writeFileSync(assetPath, payload);

        const nestedPath = join(linked, "nested");
        const outsideNested = join(outside, "nested");
        mkdirSync(outsideNested);
        writeFileSync(join(outsideNested, "bound.txt"), "nested committed bytes\n");
        rmSync(nestedPath, { recursive: true, force: true });
        symlinkSync(outsideNested, nestedPath, "dir");
        assert.throws(
          () => observeExactSource(linked),
          /WORKTREE_DIRECTORY_REPARSE_OR_TYPE_DRIFT_HOLD/u,
        );
        unlinkSync(nestedPath);
        mkdirSync(nestedPath);
        writeFileSync(join(nestedPath, "bound.txt"), "nested committed bytes\n");
        assert.equal(observeExactSource(linked).statusPorcelain, "");
      });
    }

    await t.test("a missing committed pointer blob fails closed", () => {
      const pointerBlobSha = runGit(primary, ["rev-parse", "HEAD:asset.bin"]);
      const objectPath = join(
        primary,
        ".git",
        "objects",
        pointerBlobSha.slice(0, 2),
        pointerBlobSha.slice(2),
      );
      assert.equal(existsSync(objectPath), true);
      rmSync(objectPath);
      assert.throws(
        () => observeExactSource(linked),
        /COMBINED_LAW_COMMAND_FAILED|GIT_BLOB_BATCH/u,
      );
      const restored = runGit(primary, ["hash-object", "-w", "--stdin"], { input: pointer });
      assert.equal(restored, pointerBlobSha);
      assert.equal(observeExactSource(linked).statusPorcelain, "");
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("exact source loading ignores mutable Git replacement refs", () => {
  const repository = createCommittedRepository(
    "iat-b3-replace-ref-source-",
    "immutable-original-head\n",
  );
  const buildRoot = createCombinedLawBuildRoot();
  try {
    writeFileSync(join(repository.root, "input.txt"), "mutable-replacement-tree\n", "utf8");
    runGit(repository.root, ["commit", "--quiet", "-am", "replacement source"]);
    const replacementHead = runGit(repository.root, ["rev-parse", "HEAD"]);
    runGit(repository.root, ["replace", repository.headSha, replacementHead]);

    const replacementEnabledEnvironment = { ...EXACT_TEST_GIT_ENVIRONMENT };
    delete replacementEnabledEnvironment.GIT_NO_REPLACE_OBJECTS;
    assert.equal(
      runGit(repository.root, ["rev-parse", "--verify", `${repository.headSha}^{commit}`], {
        environment: replacementEnabledEnvironment,
      }),
      repository.headSha,
      "the hostile fixture must pass the same declared-commit identity check",
    );
    assert.notEqual(
      runGit(repository.root, ["rev-parse", `${repository.headSha}^{tree}`], {
        environment: replacementEnabledEnvironment,
      }),
      repository.treeSha,
      "the hostile fixture must redirect the tree when replacements are enabled",
    );

    const snapshot = loadExactDeclaredHeadSource({
      repositoryRoot: repository.root,
      buildRoot,
      declaredHeadSha: repository.headSha,
    });
    assert.equal(snapshot.treeSha, repository.treeSha);
    assert.equal(
      readFileSync(join(snapshot.root, "input.txt"), "utf8"),
      "immutable-original-head\n",
    );
    assert.equal(observeMaterializedSourceSnapshot(snapshot).treeSha, repository.treeSha);
  } finally {
    removeSelfCreatedBuildRoot(buildRoot);
    rmSync(repository.root, { recursive: true, force: true });
  }
});

test("source Git environment strips repository, object, index, namespace, and config injection", () => {
  const canonical = createCommittedRepository(
    "iat-b3-canonical-git-environment-",
    "canonical-source\n",
  );
  const poison = createCommittedRepository(
    "iat-b3-poison-git-environment-",
    "poison-source\n",
  );
  const buildRoot = createCombinedLawBuildRoot();
  const overrides = {
    GIT_DIR: join(poison.root, ".git"),
    GIT_WORK_TREE: poison.root,
    GIT_COMMON_DIR: join(poison.root, ".git"),
    GIT_INDEX_FILE: join(poison.root, ".git", "index"),
    GIT_OBJECT_DIRECTORY: join(poison.root, ".git", "objects"),
    GIT_ALTERNATE_OBJECT_DIRECTORIES: join(poison.root, ".git", "objects"),
    GIT_NAMESPACE: "hostile-namespace",
    GIT_REPLACE_REF_BASE: "refs/hostile-replacements/",
    GIT_CONFIG: join(poison.root, ".git", "config"),
    GIT_CONFIG_GLOBAL: join(poison.root, ".git", "config"),
    GIT_CONFIG_SYSTEM: join(poison.root, ".git", "config"),
    GIT_CONFIG_NOSYSTEM: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.worktree",
    GIT_CONFIG_VALUE_0: poison.root,
    GIT_CONFIG_PARAMETERS: `'core.worktree=${poison.root}'`,
    GIT_ALLOW_PROTOCOL: "http:https:ssh:file",
    GIT_NO_LAZY_FETCH: "0",
    GIT_NO_REPLACE_OBJECTS: "0",
    GIT_OPTIONAL_LOCKS: "1",
    GIT_PROTOCOL_FROM_USER: "1",
    GIT_TERMINAL_PROMPT: "1",
    GCM_INTERACTIVE: "Always",
    SSH_ASKPASS_REQUIRE: "force",
    GIT_ASKPASS: join(poison.root, "askpass"),
    GIT_EDITOR: join(poison.root, "editor"),
    GIT_EXTERNAL_DIFF: join(poison.root, "external-diff"),
    GIT_PAGER: join(poison.root, "pager"),
    GIT_SEQUENCE_EDITOR: join(poison.root, "sequence-editor"),
    BASH_ENV: join(poison.root, "bash-env"),
    EDITOR: join(poison.root, "editor"),
    LD_AUDIT: join(poison.root, "audit"),
    LD_PRELOAD: join(poison.root, "preload"),
    PAGER: join(poison.root, "pager"),
    SSH_ASKPASS: join(poison.root, "ssh-askpass"),
    VISUAL: join(poison.root, "visual"),
  };
  try {
    assert.equal(
      runGit(canonical.root, ["rev-parse", "HEAD"], {
        environment: {
          ...EXACT_TEST_GIT_ENVIRONMENT,
          GIT_DIR: overrides.GIT_DIR,
          GIT_WORK_TREE: overrides.GIT_WORK_TREE,
        },
      }),
      poison.headSha,
      "the hostile fixture must redirect an unsanitized git -C invocation",
    );

    withProcessEnvironment(overrides, () => {
      const scrubbed = createExactSourceGitEnvironment(process.env);
      for (const name of [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_COMMON_DIR",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_NAMESPACE",
        "GIT_REPLACE_REF_BASE",
        "GIT_CONFIG",
        "GIT_CONFIG_SYSTEM",
        "GIT_CONFIG_COUNT",
        "GIT_CONFIG_KEY_0",
        "GIT_CONFIG_VALUE_0",
        "GIT_CONFIG_PARAMETERS",
        "BASH_ENV",
        "EDITOR",
        "LD_AUDIT",
        "LD_PRELOAD",
        "PAGER",
        "SSH_ASKPASS",
        "VISUAL",
      ]) assert.equal(Object.prototype.hasOwnProperty.call(scrubbed, name), false, name);
      assert.equal(scrubbed.GCM_INTERACTIVE, "Never");
      assert.equal(scrubbed.SSH_ASKPASS_REQUIRE, "never");
      assert.equal(scrubbed.GIT_ALLOW_PROTOCOL, "file");
      assert.equal(scrubbed.GIT_NO_LAZY_FETCH, "1");
      assert.equal(scrubbed.GIT_NO_REPLACE_OBJECTS, "1");
      assert.equal(scrubbed.GIT_OPTIONAL_LOCKS, "0");
      assert.equal(scrubbed.GIT_PROTOCOL_FROM_USER, "0");
      assert.equal(scrubbed.GIT_TERMINAL_PROMPT, "0");
      assert.equal(scrubbed.GIT_CONFIG_NOSYSTEM, "1");
      assert.equal(scrubbed.GIT_ASKPASS, "");
      assert.equal(scrubbed.GIT_EDITOR, "");
      assert.equal(scrubbed.GIT_EXTERNAL_DIFF, "");
      assert.equal(scrubbed.GIT_PAGER, "");
      assert.equal(scrubbed.GIT_SEQUENCE_EDITOR, "");
      assert.notEqual(scrubbed.GIT_CONFIG_GLOBAL, overrides.GIT_CONFIG_GLOBAL);

      const observation = observeExactSource(canonical.root);
      assert.equal(observation.headSha, canonical.headSha);
      assert.equal(observation.treeSha, canonical.treeSha);
      assert.equal(observation.statusPorcelain, "");

      const snapshot = loadExactDeclaredHeadSource({
        repositoryRoot: canonical.root,
        buildRoot,
        declaredHeadSha: canonical.headSha,
      });
      assert.equal(snapshot.treeSha, canonical.treeSha);
      assert.equal(readFileSync(join(snapshot.root, "input.txt"), "utf8"), "canonical-source\n");
    });
  } finally {
    removeSelfCreatedBuildRoot(buildRoot);
    rmSync(canonical.root, { recursive: true, force: true });
    rmSync(poison.root, { recursive: true, force: true });
  }
});

test("repository-local fsmonitor and other process-bearing Git config never execute", () => {
  const repository = createCommittedRepository(
    "iat-b3-hostile-fsmonitor-source-",
    "canonical-source-with-hostile-local-config\n",
  );
  const helperRoot = temporaryDirectory("iat-b3-hostile-fsmonitor-helper-");
  const helperPath = join(helperRoot, "hostile-fsmonitor.mjs");
  const markerPath = join(helperRoot, "hostile-fsmonitor-ran.marker");
  const buildRoot = createCombinedLawBuildRoot();
  const helperSource = [
    'import { appendFileSync } from "node:fs";',
    'appendFileSync(process.argv[2], "ran\\n", "utf8");',
    'process.stdout.write("b16-token\\0");',
    "",
  ].join("\n");
  writeFileSync(helperPath, helperSource, "utf8");
  const hostileCommand = [process.execPath, helperPath, markerPath]
    .map(gitShellQuote)
    .join(" ");
  try {
    runGit(repository.root, ["config", "core.fsmonitor", hostileCommand]);
    runGit(repository.root, ["config", "core.fsmonitorHookVersion", "2"]);
    runGit(repository.root, ["config", "core.untrackedCache", "true"]);
    runGit(repository.root, ["config", "core.splitIndex", "true"]);
    runGit(repository.root, ["config", "core.hooksPath", helperRoot]);
    runGit(repository.root, ["config", "core.pager", hostileCommand]);
    runGit(repository.root, ["config", "core.editor", hostileCommand]);
    runGit(repository.root, ["config", "sequence.editor", hostileCommand]);
    runGit(repository.root, ["config", "credential.helper", `!${hostileCommand}`]);
    runGit(repository.root, ["config", "core.sshCommand", hostileCommand]);
    runGit(repository.root, ["config", "diff.external", hostileCommand]);
    runGit(repository.root, ["config", "interactive.diffFilter", hostileCommand]);
    runGit(repository.root, ["update-index", "--untracked-cache"]);
    runGit(repository.root, ["update-index", "--split-index"]);

    runGit(repository.root, ["status", "--porcelain=v1"]);
    assert.equal(
      existsSync(markerPath),
      true,
      "the hostile fixture must prove ordinary Git executes core.fsmonitor",
    );
    unlinkSync(markerPath);

    const observation = observeExactSource(repository.root);
    assert.equal(observation.headSha, repository.headSha);
    assert.equal(observation.treeSha, repository.treeSha);
    assert.equal(observation.statusPorcelain, "");
    assert.equal(existsSync(markerPath), false, "exact-source observation invoked hostile config");

    const snapshot = loadExactDeclaredHeadSource({
      repositoryRoot: repository.root,
      buildRoot,
      declaredHeadSha: repository.headSha,
    });
    assert.equal(snapshot.treeSha, repository.treeSha);
    assert.equal(
      readFileSync(join(snapshot.root, "input.txt"), "utf8"),
      "canonical-source-with-hostile-local-config\n",
    );
    assert.equal(existsSync(markerPath), false, "source materialization invoked hostile config");
  } finally {
    removeSelfCreatedBuildRoot(buildRoot);
    rmSync(repository.root, { recursive: true, force: true });
    rmSync(helperRoot, { recursive: true, force: true });
  }
});

test("exact-source Git is absolute and ignores repository-local executables and hostile PATH", () => {
  const repository = createCommittedRepository(
    "iat-b3-repository-local-git-shim-",
    "canonical-source-with-hostile-git-shim\n",
  );
  const helperRoot = temporaryDirectory("iat-b3-hostile-git-path-");
  const markerPath = join(helperRoot, "hostile-git-ran.marker");
  const previousPath = process.env.PATH;
  try {
    if (process.platform === "win32") {
      copyFileSync(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "where.exe"), join(repository.root, "git.exe"));
      writeFileSync(join(repository.root, "git.cmd"), `@echo ran>>"${markerPath}"\r\n`, "utf8");
      writeFileSync(join(repository.root, "git.bat"), `@echo ran>>"${markerPath}"\r\n`, "utf8");
    } else {
      const shim = join(repository.root, "git");
      writeFileSync(shim, `#!/bin/sh\nprintf 'ran\\n' >> ${gitShellQuote(markerPath)}\nexec /usr/bin/git "$@"\n`, "utf8");
      chmodSync(shim, 0o755);
      writeFileSync(join(repository.root, "git.shim"), "hostile-path-shim\n", "utf8");
    }
    runTrustedGit(repository.root, ["add", "--", "."]);
    runTrustedGit(repository.root, ["commit", "--quiet", "-m", "hostile local Git shims"]);
    const expectedHead = runTrustedGit(repository.root, ["rev-parse", "HEAD"]);
    const expectedTree = runTrustedGit(repository.root, ["rev-parse", "HEAD^{tree}"]);
    process.env.PATH = [repository.root, "", ".", helperRoot, previousPath ?? ""]
      .join(delimiter);

    const bareProbe = process.platform === "win32"
      ? spawnSync(
        join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"),
        ["/d", "/c", `${join(repository.root, "git.cmd")} --version`],
        { cwd: repository.root, env: process.env, encoding: "utf8", windowsHide: true },
      )
      : spawnSync(join(repository.root, "git"), ["--version"], {
        cwd: repository.root,
        env: process.env,
        encoding: "utf8",
        windowsHide: true,
      });
    assert.equal(bareProbe.status, 0, bareProbe.stderr);
    assert.equal(
      existsSync(markerPath),
      true,
      "the hostile fixture must prove the repository-local Git shim is executable",
    );
    unlinkSync(markerPath);

    const scrubbed = createExactSourceGitEnvironment(process.env);
    assert.ok(scrubbed.PATH.split(delimiter).every(
      (path) => path.length > 0 && path !== "." && path !== repository.root,
    ));
    const observation = observeExactSource(repository.root);
    assert.equal(observation.headSha, expectedHead);
    assert.equal(observation.treeSha, expectedTree);
    assert.equal(observation.statusPorcelain, "");
    assert.equal(existsSync(markerPath), false, "exact-source observer executed a hostile Git shim");
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    rmSync(repository.root, { recursive: true, force: true });
    rmSync(helperRoot, { recursive: true, force: true });
  }
});

test("explicit authenticated work-tree defeats core.worktree and mutable exclude redirection", () => {
  const repository = createCommittedRepository(
    "iat-b3-core-worktree-redirection-",
    "canonical-source-with-explicit-worktree\n",
  );
  const outsideWorktree = temporaryDirectory("iat-b3-hostile-core-worktree-");
  const externalExclude = join(outsideWorktree, "external-excludes");
  try {
    writeFileSync(externalExclude, "external-hidden.txt\n", "utf8");
    writeFileSync(
      join(repository.root, ".git", "info", "exclude"),
      "info-hidden.txt\n",
      "utf8",
    );
    runTrustedGit(repository.root, ["config", "core.excludesFile", externalExclude]);
    runTrustedGit(repository.root, ["config", "core.bare", "true"]);
    runTrustedGit(repository.root, ["config", "core.worktree", outsideWorktree]);
    writeFileSync(join(repository.root, "root-untracked.txt"), "must be seen\n", "utf8");
    writeFileSync(join(repository.root, "external-hidden.txt"), "must be seen\n", "utf8");
    writeFileSync(join(repository.root, "info-hidden.txt"), "must be seen\n", "utf8");

    const observation = observeExactSource(repository.root);
    assert.equal(observation.headSha, repository.headSha);
    assert.equal(observation.treeSha, repository.treeSha);
    assert.match(observation.statusPorcelain, /\?\? root-untracked\.txt\0/u);
    assert.match(observation.statusPorcelain, /\?\? external-hidden\.txt\0/u);
    assert.match(observation.statusPorcelain, /\?\? info-hidden\.txt\0/u);
  } finally {
    rmSync(repository.root, { recursive: true, force: true });
    rmSync(outsideWorktree, { recursive: true, force: true });
  }
});

test("ordinary repositories reject local and HTTP object alternates before Git executes", () => {
  const repository = createCommittedRepository(
    "iat-b3-object-alternates-",
    "self-contained-object-store\n",
  );
  const outsideObjects = temporaryDirectory("iat-b3-external-object-store-");
  const infoRoot = join(repository.root, ".git", "objects", "info");
  try {
    for (const name of ["alternates", "http-alternates"]) {
      const path = join(infoRoot, name);
      writeFileSync(path, `${outsideObjects}\n`, "utf8");
      assert.throws(
        () => observeExactSource(repository.root),
        /IAT_B3_EXACT_SOURCE_GIT_OBJECT_ALTERNATES_FORBIDDEN_HOLD/u,
        name,
      );
      rmSync(path, { force: true });
    }
    if (process.platform !== "win32") {
      const dangling = join(infoRoot, "alternates");
      symlinkSync(join(outsideObjects, "missing-alternates"), dangling);
      assert.throws(
        () => observeExactSource(repository.root),
        /IAT_B3_EXACT_SOURCE_GIT_OBJECT_ALTERNATES_FORBIDDEN_HOLD/u,
      );
      rmSync(dangling, { force: true });
    }
    const outsideInfo = join(outsideObjects, "info");
    rmSync(infoRoot, { recursive: true, force: true });
    mkdirSync(outsideInfo);
    symlinkSync(outsideInfo, infoRoot, process.platform === "win32" ? "junction" : "dir");
    assert.throws(
      () => observeExactSource(repository.root),
      /IAT_B3_EXACT_SOURCE_GIT_OBJECT_INFO_REPARSE_HOLD/u,
    );
    rmSync(infoRoot, { recursive: true, force: true });
    mkdirSync(infoRoot);
    assert.equal(observeExactSource(repository.root).statusPorcelain, "");
  } finally {
    rmSync(repository.root, { recursive: true, force: true });
    rmSync(outsideObjects, { recursive: true, force: true });
  }
});

test("missing promisor objects fail closed without lazy fetch or object-store mutation", () => {
  const repository = createCommittedRepository(
    "iat-b3-no-lazy-fetch-client-",
    "promisor-bound-source\n",
  );
  const remote = temporaryDirectory("iat-b3-no-lazy-fetch-remote-");
  try {
    runGit(remote, ["init", "--bare", "--quiet"]);
    runGit(repository.root, ["remote", "add", "origin", remote]);
    runGit(repository.root, ["push", "--quiet", "origin", "HEAD:refs/heads/main"]);
    const blobSha = runGit(repository.root, ["rev-parse", "HEAD:input.txt"]);
    const objectPath = join(
      repository.root,
      ".git",
      "objects",
      blobSha.slice(0, 2),
      blobSha.slice(2),
    );
    assert.equal(existsSync(objectPath), true);
    runGit(repository.root, ["config", "core.repositoryformatversion", "1"]);
    runGit(repository.root, ["config", "extensions.partialClone", "origin"]);
    runGit(repository.root, ["config", "remote.origin.promisor", "true"]);
    runGit(repository.root, ["config", "remote.origin.partialCloneFilter", "blob:none"]);
    rmSync(objectPath);
    assert.equal(existsSync(objectPath), false);
    const packDirectory = join(repository.root, ".git", "objects", "pack");
    const beforePacks = readdirSync(packDirectory).sort();

    assert.throws(
      () => observeExactSource(repository.root),
      /GIT_BLOB_BATCH|COMBINED_LAW_COMMAND_FAILED/u,
    );
    assert.equal(existsSync(objectPath), false);
    assert.deepEqual(readdirSync(packDirectory).sort(), beforePacks);
  } finally {
    rmSync(repository.root, { recursive: true, force: true });
    rmSync(remote, { recursive: true, force: true });
  }
});

test("exact Git-object materialization excludes ignored/live worktree bytes and survives transient worktree mutation", () => {
  const liveRoot = temporaryDirectory("iat-b3-live-worktree-");
  const buildRoot = createCombinedLawBuildRoot();
  try {
    mkdirSync(join(liveRoot, "src"), { recursive: true });
    writeFileSync(join(liveRoot, "Cargo.toml"), "live-worktree-poison", "utf8");
    writeFileSync(join(liveRoot, ".ignored-build-input"), "ignored-poison", "utf8");
    const lfsPointer = [
      "version https://git-lfs.github.com/spec/v1",
      `oid sha256:${"3".repeat(64)}`,
      "size 123",
      "",
    ].join("\n");
    const snapshot = materializeExactSourceSnapshot({
      buildRoot,
      declaredHeadSha: HEAD_SHA,
      treeSha: TREE_SHA,
      files: [
        exactGitBlob("Cargo.toml", "committed-cargo-bytes"),
        exactGitBlob("src/lib.rs", "pub fn exact() {}\n"),
        exactGitBlob("assets/pointer.bin", lfsPointer),
      ],
    });
    const before = observeMaterializedSourceSnapshot(snapshot);
    assert.equal(before.fileCount, 3);
    assert.equal(before.lfsPointerCount, 1);
    assert.equal(before.ignoredWorktreeBytesIncluded, false);
    assert.equal(readFileSync(join(snapshot.root, "Cargo.toml"), "utf8"), "committed-cargo-bytes");
    assert.equal(existsSync(join(snapshot.root, ".ignored-build-input")), false);

    writeFileSync(join(liveRoot, "Cargo.toml"), "transient-host-mutation", "utf8");
    writeFileSync(join(liveRoot, ".ignored-build-input"), "changed-ignored-poison", "utf8");
    assert.deepEqual(observeMaterializedSourceSnapshot(snapshot), before);

    const arguments_ = createCombinedLawDockerBuildArguments({
      sourceSnapshotRoot: snapshot.root,
      hostBuildRoot: join(buildRoot, "run-1"),
      containerBuildRoot: "/iat-build/run-1",
      identityEnvironmentNames: [
        "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
        "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
        "IAT_B3_PRODUCTION_CANONICAL_MINT",
      ],
    });
    assert.ok(arguments_.includes(
      `--mount=type=bind,source=${snapshot.root},target=/iat-source,readonly`,
    ));
    assert.equal(arguments_.some((argument) => argument.includes(liveRoot)), false);
  } finally {
    removeSelfCreatedBuildRoot(buildRoot);
    rmSync(liveRoot, { recursive: true, force: true });
  }
});

test("materialized archive drift, blob substitution, malformed LFS pointers, and extra paths fail closed", async (t) => {
  await t.test("committed blob bytes cannot disagree with their Git object ID", () => {
    const buildRoot = createCombinedLawBuildRoot();
    try {
      const file = exactGitBlob("Cargo.toml", "committed");
      file.bytes = Buffer.from("substituted", "utf8");
      assert.throws(
        () => materializeExactSourceSnapshot({
          buildRoot,
          declaredHeadSha: HEAD_SHA,
          treeSha: TREE_SHA,
          files: [file],
        }),
        /SOURCE_MATERIALIZATION_BLOB_DRIFT_HOLD/u,
      );
    } finally {
      removeSelfCreatedBuildRoot(buildRoot);
    }
  });

  await t.test("noncanonical LFS pointer text is rejected without smudging", () => {
    const buildRoot = createCombinedLawBuildRoot();
    try {
      const malformed = [
        "version https://git-lfs.github.com/spec/v1",
        "oid sha256:not-a-digest",
        "size 1",
        "",
      ].join("\n");
      assert.throws(
        () => materializeExactSourceSnapshot({
          buildRoot,
          declaredHeadSha: HEAD_SHA,
          treeSha: TREE_SHA,
          files: [exactGitBlob("asset.bin", malformed)],
        }),
        /LFS_POINTER_NONCANONICAL_HOLD/u,
      );
    } finally {
      removeSelfCreatedBuildRoot(buildRoot);
    }
  });

  await t.test("content drift after materialization", () => {
    const buildRoot = createCombinedLawBuildRoot();
    try {
      const snapshot = materializeExactSourceSnapshot({
        buildRoot,
        declaredHeadSha: HEAD_SHA,
        treeSha: TREE_SHA,
        files: [exactGitBlob("Cargo.toml", "committed")],
      });
      const path = join(snapshot.root, "Cargo.toml");
      chmodSync(path, 0o600);
      writeFileSync(path, "tampered", "utf8");
      assert.throws(
        () => observeMaterializedSourceSnapshot(snapshot),
        /MATERIALIZED_SOURCE_CONTENT_DRIFT_HOLD/u,
      );
    } finally {
      removeSelfCreatedBuildRoot(buildRoot);
    }
  });

  await t.test("unexpected path after materialization", () => {
    const buildRoot = createCombinedLawBuildRoot();
    try {
      const snapshot = materializeExactSourceSnapshot({
        buildRoot,
        declaredHeadSha: HEAD_SHA,
        treeSha: TREE_SHA,
        files: [exactGitBlob("Cargo.toml", "committed")],
      });
      chmodSync(snapshot.root, 0o700);
      writeFileSync(join(snapshot.root, "ignored-extra"), "poison", "utf8");
      assert.throws(
        () => observeMaterializedSourceSnapshot(snapshot),
        /MATERIALIZED_SOURCE_PATH_SET_DRIFT_HOLD/u,
      );
    } finally {
      removeSelfCreatedBuildRoot(buildRoot);
    }
  });
});

test("receipt-bound artifact publication is atomic, no-overwrite, and detects readback tamper", () => {
  const outputDirectory = temporaryDirectory("iat-b3-preserved-artifact-");
  const outputPath = join(outputDirectory, "iat_b3_law.so");
  const bytes = Buffer.from("exact-final-sbf-bytes", "utf8");
  const expectedSha256 = createHash("sha256").update(bytes).digest("hex");
  try {
    const preserved = preserveReceiptBoundArtifact({
      outputPath,
      artifact: { fileName: "iat_b3_law.so", bytes },
    });
    assert.equal(preserved.atomicNoOverwrite, true);
    assert.equal(preserved.readbackVerified, true);
    assert.equal(createHash("sha256").update(preserved.bytes).digest("hex"), expectedSha256);
    assert.equal(readdirSync(outputDirectory).some((name) => name.endsWith(".partial")), false);

    assert.throws(
      () => preserveReceiptBoundArtifact({
        outputPath,
        artifact: { fileName: "iat_b3_law.so", bytes: Buffer.from("replacement") },
      }),
      /ARTIFACT_MUST_NOT_ALREADY_EXIST/u,
    );
    assert.deepEqual(readFileSync(outputPath), bytes);

    chmodSync(outputPath, 0o600);
    writeFileSync(outputPath, "tampered-after-copy", "utf8");
    assert.throws(
      () => observePreservedArtifact({
        outputPath,
        expectedFileName: "iat_b3_law.so",
        expectedByteLength: bytes.length,
        expectedSha256,
      }),
      /PRESERVED_ARTIFACT_READBACK_DRIFT_HOLD/u,
    );
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("process-created build-root cleanup removes snapshots but preserves the external final artifact", () => {
  const outputDirectory = temporaryDirectory("iat-b3-cleanup-output-");
  const outputPath = join(outputDirectory, "iat_b3_law.so");
  const buildRoot = createCombinedLawBuildRoot();
  const unbrandedRoot = temporaryDirectory("iat-b3-combined-law-sbf-unbranded-");
  try {
    const snapshot = materializeExactSourceSnapshot({
      buildRoot,
      declaredHeadSha: HEAD_SHA,
      treeSha: TREE_SHA,
      files: [exactGitBlob("Cargo.toml", "committed")],
    });
    assert.equal(existsSync(snapshot.root), true);
    preserveReceiptBoundArtifact({
      outputPath,
      artifact: { fileName: "iat_b3_law.so", bytes: Buffer.from("retained") },
    });
    assert.throws(
      () => removeSelfCreatedBuildRoot(unbrandedRoot),
      /BUILD_ROOT_NOT_PROCESS_CREATED/u,
    );
    assert.equal(existsSync(unbrandedRoot), true);
    removeSelfCreatedBuildRoot(buildRoot);
    assert.equal(existsSync(buildRoot), false);
    assert.equal(readFileSync(outputPath, "utf8"), "retained");
  } finally {
    if (existsSync(buildRoot)) {
      try {
        removeSelfCreatedBuildRoot(buildRoot);
      } catch {
        // A failed boundary check must never widen cleanup scope.
      }
    }
    rmSync(unbrandedRoot, { recursive: true, force: true });
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("canonical identity and owner-policy byte intake rejects duplicate and drifting packets", () => {
  const duplicateIdentity = Buffer.from(
    IDENTITY_MANIFEST_BYTES.toString("utf8").replace(
      '  "schema": "iat-b3-identity-freeze/v1",',
      '  "schema": "iat-b3-identity-freeze/v1",\n  "schema": "iat-b3-identity-freeze/v1",',
    ),
  );
  assert.throws(
    () => assertIdentityAndOwnerPolicyBytes({
      identityManifestBytes: duplicateIdentity,
      ownerPolicyBytes: OWNER_POLICY_BYTES,
    }),
    /duplicate JSON member/iu,
  );

  const duplicateOwnerPolicy = Buffer.from(
    OWNER_POLICY_BYTES.toString("utf8").replace(
      '  "schema": "iat-b3-owner-policy-freeze/v2",',
      '  "schema": "iat-b3-owner-policy-freeze/v2",\n  "schema": "iat-b3-owner-policy-freeze/v2",',
    ),
  );
  assert.throws(
    () => assertIdentityAndOwnerPolicyBytes({
      identityManifestBytes: IDENTITY_MANIFEST_BYTES,
      ownerPolicyBytes: duplicateOwnerPolicy,
    }),
    /owner-policy bytes do not match the frozen digest/iu,
  );

  const strictOwnerParserProbe = parseIdentityFreezeJson(
    IDENTITY_MANIFEST_BYTES.toString("utf8"),
    "strict-owner-parser-probe",
  );
  strictOwnerParserProbe.ownerPolicyBinding.packetSha256 = createHash("sha256")
    .update(duplicateOwnerPolicy)
    .digest("hex");
  assert.throws(
    () => assertIdentityAndOwnerPolicyBytes({
      identityManifestBytes: Buffer.from(JSON.stringify(strictOwnerParserProbe)),
      ownerPolicyBytes: duplicateOwnerPolicy,
    }),
    /strict owner-policy parse failed \([^)]*duplicate JSON member/iu,
  );

  const driftedOwnerPolicy = Buffer.from(OWNER_POLICY_BYTES);
  driftedOwnerPolicy[driftedOwnerPolicy.length - 2] ^= 1;
  assert.throws(
    () => assertIdentityAndOwnerPolicyBytes({
      identityManifestBytes: IDENTITY_MANIFEST_BYTES,
      ownerPolicyBytes: driftedOwnerPolicy,
    }),
    /owner-policy bytes do not match the frozen digest/iu,
  );

  assert.throws(
    () => assertIdentityAndOwnerPolicyBytes({
      identityManifestBytes: IDENTITY_MANIFEST_BYTES,
      ownerPolicyBytes: OWNER_POLICY_BYTES,
    }),
    (error) => {
      assert.doesNotMatch(error.message, /bytes were not supplied|frozen digest/iu);
      assert.match(error.message, /production combined-artifact binding is not ready/iu);
      return true;
    },
  );
});

test("the executable path is canonical-manifest-only and the current production manifest remains HOLD", () => {
  const script = readFileSync(
    new URL("../scripts/run-iat-b3-combined-law-reproducible-build.mjs", import.meta.url),
    "utf8",
  );
  assert.match(script, /parseIdentityFreezeJson\([\s\S]*identityManifestBytes/u);
  assert.match(script, /assertProductionCombinedArtifactBindingReady\(manifest, \{ ownerPolicyBytes \}\)/u);
  assert.match(script, /"ls-tree"[\s\S]*"--full-tree"/u);
  assert.match(script, /"cat-file"[\s\S]*"--batch"/u);
  assert.match(script, /"ls-files"[\s\S]*"--stage"[\s\S]*"--others"[\s\S]*"--exclude-per-directory=\.gitignore"/u);
  assert.match(script, /parseCanonicalLfsPointer\(file\.bytes\)[\s\S]*sha256\(bytes\) === pointer\.oidSha256/u);
  assert.match(script, /GIT_NO_LAZY_FETCH: "1"[\s\S]*GIT_TERMINAL_PROMPT: "0"/u);
  assert.match(script, /"-c", "core\.fsmonitor=false"/u);
  assert.match(script, /"-c", "core\.hooksPath="/u);
  assert.match(script, /"-c", "diff\.external="/u);
  assert.match(script, /"--no-optional-locks"[\s\S]*"--no-pager"/u);
  assert.match(script, /stat\.nlink !== 1n[\s\S]*WORKTREE_TRACKED_FILE_HARDLINK_HOLD/u);
  assert.match(script, /finalUntrackedListing[\s\S]*assertObservedTrackedWorktreeStable\(trackedObservation\)/u);
  assert.match(script, /loadCanonicalIdentityBinding\(sourceSnapshot\)/u);
  assert.match(script, /sourceSnapshotRoot[\s\S]*target=\/iat-source,readonly/u);
  const cliSurface = /function parseCliArguments\(argv\)[\s\S]*?const invokedPath/u.exec(script)?.[0];
  assert.ok(cliSurface);
  assert.doesNotMatch(cliSurface, /--manifest/u);
  assert.equal(script.includes('execute("docker", ["pull"'), false);

  const manifest = parseIdentityFreezeJson(
    IDENTITY_MANIFEST_BYTES.toString("utf8"),
    fileURLToPath(new URL("../docs/b3/iat-b3-identity-freeze.v1.json", import.meta.url)),
  );
  assert.throws(
    () => assertProductionCombinedArtifactBindingReady(manifest, {
      ownerPolicyBytes: OWNER_POLICY_BYTES,
    }),
    /production combined-artifact binding is not ready/iu,
  );
});
