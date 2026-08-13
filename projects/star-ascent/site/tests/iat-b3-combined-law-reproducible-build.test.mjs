import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  assertIdentityAndOwnerPolicyBytes,
  assertExactCleanSourceSequence,
  assertExactMaterializedSourceSequence,
  assertPinnedContainerObservation,
  assertPinnedToolchainObservation,
  createExactSourceGitEnvironment,
  createCombinedLawBuildPreflight,
  createCombinedLawBuildRoot,
  createCombinedLawBuildReceipt,
  createCombinedLawDockerBuildArguments,
  loadExactDeclaredHeadSource,
  materializeExactSourceSnapshot,
  observeExactSource,
  observeCombinedLawBuildPreflight,
  observeMaterializedSourceSnapshot,
  observePreservedArtifact,
  parseExactGitBlobBatchResponse,
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
  assert.equal(preflight.source.repositoryCleanTrackedAndUntracked, true);
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
      blocker: "REPOSITORY_CLEAN_TRACKED_AND_UNTRACKED",
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
    ({ id }) => id === "REPOSITORY_CLEAN_TRACKED_AND_UNTRACKED",
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
  assert.equal(receipt.source.repositoryCleanTrackedAndUntracked, true);
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
  await t.test("tracked and untracked dirt both fail closed", () => {
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
    GIT_NO_REPLACE_OBJECTS: "0",
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
      ]) assert.equal(Object.prototype.hasOwnProperty.call(scrubbed, name), false, name);
      assert.equal(scrubbed.GIT_NO_REPLACE_OBJECTS, "1");
      assert.equal(scrubbed.GIT_CONFIG_NOSYSTEM, "1");
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
  assert.match(script, /git[\s\S]*status[\s\S]*--porcelain=v1[\s\S]*--untracked-files=all/u);
  assert.match(script, /loadCanonicalIdentityBinding\(sourceSnapshot\)/u);
  assert.match(script, /sourceSnapshotRoot[\s\S]*target=\/iat-source,readonly/u);
  assert.doesNotMatch(script, /--manifest/u);
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
