import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import {
  HandoffCasError,
  IAT_V2_HANDOFF_CAS_ROOT_SENTINEL,
  IAT_V2_HANDOFF_CAS_ROOT_SENTINEL_FILE,
  inspectHandoffReservation,
  reserveHandoffMutation,
} from "../scripts/iat-v2-devnet-buffer-handoff-cas.mjs";
import {
  BufferPreflightError,
  IAT_V2_ARTIFACT_INPUT_PATHS,
  IAT_V2_MIGRATION_ARTIFACT_BINDING,
  calculateUpgradeCapacityPlan,
  observeDevnetUpgradeCapacity,
  verifyDevnetBufferRecoveryRuntimeBinding,
  verifyMigrationArtifactBinding,
} from "../scripts/iat-v2-devnet-buffer-preflight.mjs";

const PROGRAM_DATA_ADDRESS = new PublicKey("6DaESYUqB7th7kkfYAhsqiYfzmdnCFeFeoxDi5WkejTP");
const PROGRAM_ADMIN = new PublicKey("7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH");
const UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sortJson = (value) => {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
};

test("migration buffer helpers use the reviewed static successor public-CI binding", () => {
  assert.deepEqual(IAT_V2_MIGRATION_ARTIFACT_BINDING, {
    schema: "iat-v2-migration-artifact-binding/v1",
    status: "BOUND",
    artifactSha256: "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
    artifactBytes: 649_680,
    sourceHeadCommit: "a03fe71dd66cd1650b8d0353e486786df30b83e9",
    sourceHeadTree: "ffe82fcf8fd3d851c09a937ebec945121137e546",
    ciRunId: 33_161_771_816,
    ciRunAttempt: 1,
    workflowRef: "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge",
    evidenceManifestSha256: "ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9",
  });
  assert.throws(
    () => verifyMigrationArtifactBinding({ artifactPath: "missing.so", evidencePath: "missing.json" }),
    (error) => error instanceof BufferPreflightError
      && error.code === "ARTIFACT_INPUT_MISSING_HOLD"
      && error.hold === true,
  );

  const cli = spawnSync(process.execPath, [
    "scripts/iat-v2-devnet-buffer-preflight.mjs",
    "verify",
    "--artifact",
    "missing.so",
    "--evidence",
    "missing.json",
  ], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(cli.status, 2);
  const error = JSON.parse(cli.stderr.trim());
  assert.equal(error.status, "HOLD");
  assert.equal(error.code, "ARTIFACT_INPUT_MISSING_HOLD");
  assert.equal(error.signing, false);
  assert.equal(error.broadcast, false);
});

test("bound migration bytes must match the exact public-CI evidence and Git source", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "iat-v2-migration-binding-"));
  try {
    const artifact = Buffer.from("reviewed migration SBF fixture", "utf8");
    const artifactSha256 = sha256(artifact);
    const sourceHeadCommit = "a".repeat(40);
    const sourceHeadTree = "b".repeat(40);
    const workflowRef = "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge";
    const manifest = {
      schema: "iat-v2-ci-verifiable-sbf-evidence/v5",
      status: "BUILD_ONLY_HOLD",
      ciProvenance: {
        serverUrl: "https://github.com",
        repository: "InternalAgencyIO/InternalAgency",
        repositoryId: 1_313_660_798,
        workflowRef,
        runId: 123_456,
        runAttempt: 1,
        runnerOs: "Linux",
        runnerArch: "X64",
      },
      buildContainer: {},
      sourceBinding: {
        workflowEvent: "pull_request",
        sourceHeadCommit,
        sourceHeadTree,
        checkoutCommit: "c".repeat(40),
        checkoutTree: sourceHeadTree,
        checkoutRelation: "PR_MERGE_SECOND_PARENT",
        trackedWorktree: "CLEAN",
      },
      programId: "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj",
      toolchain: {},
      artifacts: {
        programBinary: {
          path: "target/verifiable/iat_v2.so",
          sha256: artifactSha256,
          bytes: artifact.length,
        },
      },
      limitations: [
        "Build evidence only; not signed Devnet evidence.",
        "Does not authorize deployment, signing, broadcast, funding, or Mainnet launch.",
      ],
    };
    const evidence = Buffer.from(`${JSON.stringify(sortJson(manifest), null, 2)}\n`, "utf8");
    const target = join(sandbox, "target", "verifiable");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "iat_v2.so"), artifact);
    writeFileSync(join(target, "iat-v2-build-evidence.json"), evidence);
    const binding = {
      schema: "iat-v2-migration-artifact-binding/v1",
      status: "BOUND",
      artifactSha256,
      artifactBytes: artifact.length,
      sourceHeadCommit,
      sourceHeadTree,
      ciRunId: 123_456,
      ciRunAttempt: 1,
      workflowRef,
      evidenceManifestSha256: sha256(evidence),
    };
    let driftedArtifactInput = null;
    let sourceHeadMissing = false;
    let sourceHeadUnrelated = false;
    let sourceTree = sourceHeadTree;
    const git = (_projectRoot, args) => {
      if (args[0] === "cat-file") {
        if (sourceHeadMissing) throw new Error("missing source head");
        return "";
      }
      if (args[0] === "rev-parse") return sourceHeadTree;
      if (args[0] === "merge-base") {
        if (sourceHeadUnrelated) throw new Error("unrelated source head");
        return "";
      }
      if (args[0] === "diff") {
        assert.deepEqual(args, [
          "diff",
          "--no-ext-diff",
          "--no-textconv",
          "--quiet",
          sourceHeadCommit,
          "--",
          ...IAT_V2_ARTIFACT_INPUT_PATHS,
        ]);
        if (driftedArtifactInput !== null) throw new Error(`drifted ${driftedArtifactInput}`);
        return "";
      }
      throw new Error(`unexpected Git call: ${args.join(" ")}`);
    };

    let canonicalValidationCalls = 0;
    const validateCiEvidence = (options) => {
      canonicalValidationCalls += 1;
      assert.equal(options.projectRoot, sandbox);
      assert.equal(options.manifestPath, "target/verifiable/iat-v2-build-evidence.json");
      assert.equal(options.allowDescendantCheckout, true);
      return {
        manifestSha256: binding.evidenceManifestSha256,
        sourceHeadCommit,
        runUrl: "https://github.com/InternalAgencyIO/InternalAgency/actions/runs/123456/attempts/1",
      };
    };

    const result = verifyMigrationArtifactBinding({ projectRoot: sandbox, binding, git, validateCiEvidence });
    assert.equal(result.status, "PASS");
    assert.equal(result.artifactSha256, artifactSha256);
    assert.equal(result.signing, false);
    assert.equal(result.broadcast, false);
    assert.equal(canonicalValidationCalls, 1);

    assert.deepEqual(IAT_V2_ARTIFACT_INPUT_PATHS, [
      "Anchor.toml",
      "Cargo.lock",
      "Cargo.toml",
      "rust-toolchain.toml",
      "programs/iat_v2/Cargo.toml",
      "programs/iat_v2/src",
      "scripts/verify-iat-v2-sbf.sh",
    ]);
    assert.equal(IAT_V2_ARTIFACT_INPUT_PATHS.includes("programs/iat_v2/instructions.mjs"), false);
    assert.equal(IAT_V2_ARTIFACT_INPUT_PATHS.includes("../../../.github/workflows/iat-v2-proof.yml"), false);

    for (const path of IAT_V2_ARTIFACT_INPUT_PATHS) {
      driftedArtifactInput = path;
      assert.throws(
        () => verifyMigrationArtifactBinding({ projectRoot: sandbox, binding, git, validateCiEvidence }),
        (error) => error instanceof BufferPreflightError
          && error.code === "ARTIFACT_INPUT_DRIFT_HOLD",
        `${path} drift must hold`,
      );
    }
    driftedArtifactInput = null;

    sourceHeadMissing = true;
    assert.throws(
      () => verifyMigrationArtifactBinding({ projectRoot: sandbox, binding, git, validateCiEvidence }),
      (error) => error instanceof BufferPreflightError && error.code === "SOURCE_HEAD_MISSING_HOLD",
    );
    sourceHeadMissing = false;

    sourceTree = "d".repeat(40);
    assert.throws(
      () => verifyMigrationArtifactBinding({ projectRoot: sandbox, binding, git: (_root, args) => (
        args[0] === "rev-parse" ? sourceTree : git(_root, args)
      ), validateCiEvidence }),
      (error) => error instanceof BufferPreflightError && error.code === "SOURCE_TREE_MISMATCH_HOLD",
    );
    sourceTree = sourceHeadTree;

    sourceHeadUnrelated = true;
    assert.throws(
      () => verifyMigrationArtifactBinding({ projectRoot: sandbox, binding, git, validateCiEvidence }),
      (error) => error instanceof BufferPreflightError && error.code === "SOURCE_HEAD_NOT_ANCESTOR_HOLD",
    );
    sourceHeadUnrelated = false;

    assert.throws(
      () => verifyMigrationArtifactBinding({
        projectRoot: sandbox,
        binding,
        git,
        validateCiEvidence: () => { throw new Error("toolchain drifted"); },
      }),
      (error) => error instanceof BufferPreflightError
        && error.code === "CANONICAL_CI_EVIDENCE_HOLD"
        && /toolchain drifted/u.test(error.message),
    );

    writeFileSync(join(target, "iat_v2.so"), Buffer.from("mutated", "utf8"));
    assert.throws(
      () => verifyMigrationArtifactBinding({ projectRoot: sandbox, binding, git, validateCiEvidence }),
      (error) => error instanceof BufferPreflightError && error.code === "ARTIFACT_BYTES_MISMATCH_HOLD",
    );
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("recovery runtime binding requires the exact public-CI manifest and retained artifact tuple", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "iat-v2-recovery-runtime-binding-"));
  try {
    const runtimeEvidencePath = "target/verifiable/iat-v2-recovery-runtime-build-evidence.json";
    const target = join(sandbox, "target", "verifiable");
    mkdirSync(target, { recursive: true });
    const sourceHeadCommit = "a".repeat(40);
    const sourceHeadTree = "b".repeat(40);
    const checkoutCommit = "c".repeat(40);
    const checkoutTree = "d".repeat(40);
    const workflowRef = "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge";
    const ciRunId = 123_456;
    const ciRunAttempt = 2;
    const artifactSha256 = "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01";
    const artifactBytes = 649_680;
    const baseManifest = {
      sourceBinding: {
        workflowEvent: "pull_request",
        sourceHeadCommit,
        sourceHeadTree,
        checkoutCommit,
        checkoutTree,
        checkoutRelation: "PR_MERGE_SECOND_PARENT",
      },
      ciProvenance: {
        repository: "InternalAgencyIO/InternalAgency",
        repositoryId: 1_313_660_798,
        workflowRef,
        runId: ciRunId,
        runAttempt: ciRunAttempt,
        runnerOs: "Linux",
        runnerArch: "X64",
      },
      artifacts: {
        programBinary: { sha256: artifactSha256, bytes: artifactBytes },
      },
    };
    const baseRuntime = {
      status: "BOUND",
      sourceHeadCommit,
      sourceHeadTree,
      checkoutCommit,
      checkoutTree,
      checkoutRelation: "PR_MERGE_SECOND_PARENT",
      bindingSuccessorCommit: "e".repeat(40),
      bindingSuccessorTree: "f".repeat(40),
      bindingAnchorSha256: "1".repeat(64),
      runtimeClosureSha256: "2".repeat(64),
      artifactSha256,
      artifactBytes,
      ciRunId,
      ciRunAttempt,
      workflowRef,
      signing: false,
      broadcast: false,
      mainnetAuthorized: false,
    };
    const git = () => "";

    const verify = ({
      manifest = baseManifest,
      runtimeOverrides = {},
      canonicalOverrides = {},
    } = {}) => {
      const evidenceBytes = Buffer.from(`${JSON.stringify(sortJson(manifest), null, 2)}\n`, "utf8");
      writeFileSync(join(sandbox, runtimeEvidencePath), evidenceBytes);
      const runtime = {
        ...baseRuntime,
        evidenceManifestSha256: sha256(evidenceBytes),
        ...runtimeOverrides,
      };
      return verifyDevnetBufferRecoveryRuntimeBinding({
        projectRoot: sandbox,
        binding: Object.freeze({ fixture: true }),
        runtimeEvidencePath,
        git,
        verifyRuntimeBinding: (options) => {
          assert.equal(options.projectRoot, sandbox);
          assert.equal(options.git, git);
          assert.deepEqual(options.binding, { fixture: true });
          return runtime;
        },
        validateRuntimeCiEvidence: (options) => {
          assert.equal(options.projectRoot, sandbox);
          assert.equal(options.manifestPath, runtimeEvidencePath);
          assert.equal(options.allowDescendantCheckout, true);
          assert.equal(options.verifyArtifactFiles, false);
          assert.equal(options.git, git);
          return {
            manifestSha256: sha256(evidenceBytes),
            sourceHeadCommit,
            runUrl: `https://github.com/InternalAgencyIO/InternalAgency/actions/runs/${ciRunId}/attempts/${ciRunAttempt}`,
            ...canonicalOverrides,
          };
        },
      });
    };

    const result = verify();
    assert.equal(result.status, "BOUND");
    assert.equal(result.artifactSha256, artifactSha256);
    assert.equal(result.signing, false);
    assert.equal(result.broadcast, false);
    assert.equal(result.mainnetAuthorized, false);

    const expectCiHold = (operation, pattern) => assert.throws(
      operation,
      (error) => error instanceof BufferPreflightError
        && error.code === "RUNTIME_CI_EVIDENCE_HOLD"
        && pattern.test(error.message),
    );

    expectCiHold(
      () => verify({ runtimeOverrides: { evidenceManifestSha256: "0".repeat(64) } }),
      /evidence SHA-256/u,
    );
    expectCiHold(
      () => verify({ canonicalOverrides: { sourceHeadCommit: "9".repeat(40) } }),
      /source commit/u,
    );
    expectCiHold(
      () => verify({ canonicalOverrides: { runUrl: "https://example.invalid/run" } }),
      /public run/u,
    );

    const wrongTree = structuredClone(baseManifest);
    wrongTree.sourceBinding.sourceHeadTree = "9".repeat(40);
    expectCiHold(() => verify({ manifest: wrongTree }), /source tree/u);

    const wrongCheckout = structuredClone(baseManifest);
    wrongCheckout.sourceBinding.checkoutCommit = "9".repeat(40);
    expectCiHold(() => verify({ manifest: wrongCheckout }), /checkout binding/u);

    const wrongProvenance = structuredClone(baseManifest);
    wrongProvenance.ciProvenance.repositoryId += 1;
    expectCiHold(() => verify({ manifest: wrongProvenance }), /provenance/u);

    const wrongArtifact = structuredClone(baseManifest);
    wrongArtifact.artifacts.programBinary.sha256 = "9".repeat(64);
    expectCiHold(() => verify({ manifest: wrongArtifact }), /artifact tuple/u);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("capacity math pins the reviewed successor artifact rent and excludes transaction fees", () => {
  const plan = calculateUpgradeCapacityPlan({
    artifactBytes: 649_680,
    currentProgramCapacityBytes: 597_336,
    currentProgramDataBytes: 597_381,
    currentProgramDataLamports: 4_158_662_640,
    targetProgramDataRentLamports: 4_522_976_880,
    bufferRentLamports: 4_522_921_200,
    deployerLamports: 1_910_332_608,
    adminLamports: 4_201_193_718,
  });

  assert.equal(plan.extensionRequired, true);
  assert.equal(plan.extensionBytes, 52_344);
  assert.equal(plan.targetProgramDataBytes, 649_725);
  assert.equal(plan.bufferAccountBytes, 649_717);
  assert.equal(plan.programDataRentTopUpLamports, 364_314_240);
  assert.equal(plan.deployerRequiredIfPayingAllLamports, 4_887_235_440);
  assert.equal(plan.deployerShortfallIfPayingAllLamports, 2_976_902_832);
  assert.equal(plan.deployerBufferOnlyShortfallLamports, 2_612_588_592);
  assert.equal(plan.transactionFeesIncluded, false);
});

test("capacity math does not shrink an already-large ProgramData account", () => {
  const plan = calculateUpgradeCapacityPlan({
    artifactBytes: 500_000,
    currentProgramCapacityBytes: 597_336,
    currentProgramDataBytes: 597_381,
    currentProgramDataLamports: 4_158_662_640,
    targetProgramDataRentLamports: 4_158_662_640,
    bufferRentLamports: 3_481_147_520,
    deployerLamports: 4_000_000_000,
    adminLamports: 1,
  });

  assert.equal(plan.extensionRequired, false);
  assert.equal(plan.extensionBytes, 0);
  assert.equal(plan.targetProgramDataBytes, 597_381);
  assert.equal(plan.programDataRentTopUpLamports, 0);
  assert.equal(plan.deployerBufferOnlyShortfallLamports, 0);
});

test("read-only observer validates the reviewed Devnet layout and returns exact capacity inputs", async () => {
  const programData = Buffer.alloc(597_381);
  programData.writeUInt32LE(3, 0);
  programData[12] = 1;
  PROGRAM_ADMIN.toBuffer().copy(programData, 13);
  const program = Buffer.alloc(36);
  program.writeUInt32LE(2, 0);
  PROGRAM_DATA_ADDRESS.toBuffer().copy(program, 4);
  let slot = 488_175_660;
  const requestedRentBytes = [];
  const connection = {
    async getGenesisHash() {
      return "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
    },
    async getSlot() {
      const result = slot;
      slot += 1;
      return result;
    },
    async getMultipleAccountsInfo(addresses) {
      assert.equal(addresses.length, 4);
      return [
        { owner: UPGRADEABLE_LOADER, data: program, lamports: 1_141_440 },
        { owner: UPGRADEABLE_LOADER, data: programData, lamports: 4_158_662_640 },
        { lamports: 1_910_332_608 },
        { lamports: 4_201_193_718 },
      ];
    },
    async getMinimumBalanceForRentExemption(bytes) {
      requestedRentBytes.push(bytes);
      if (bytes === 621_181) return 4_324_310_640;
      if (bytes === 621_173) return 4_324_254_960;
      throw new Error(`unexpected rent query for ${bytes}`);
    },
  };

  const result = await observeDevnetUpgradeCapacity({ artifactBytes: 621_136, connection });
  assert.equal(result.status, "READ_ONLY_CALCULATION");
  assert.equal(result.rpc, "https://api.devnet.solana.com");
  assert.equal(result.commitment, "finalized");
  assert.equal(result.artifactBindingStatus, "BOUND");
  assert.equal(result.artifactBytesSource, "CALLER_SUPPLIED_CALCULATION_ONLY");
  assert.equal(result.extensionBytes, 23_800);
  assert.deepEqual(requestedRentBytes.sort((left, right) => left - right), [621_173, 621_181]);
  assert.equal(result.genesisHash, "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG");
  assert.equal(result.rpcReadExecuted, true);
  assert.equal(result.networkMutation, false);
  assert.equal(result.transactionExecution, false);
  assert.equal(result.signing, false);
  assert.equal(result.broadcast, false);

  await assert.rejects(
    () => observeDevnetUpgradeCapacity({
      artifactBytes: 621_136,
      connection: {
        ...connection,
        async getGenesisHash() {
          return "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
        },
        async getSlot() {
          throw new Error("wrong-genesis observer must stop before account reads");
        },
      },
    }),
    (error) => error instanceof BufferPreflightError
      && error.code === "NETWORK_IDENTITY_HOLD"
      && error.hold === true,
  );
});

test("upload and handoff scripts have separate explicit gates and no stale artifact pin", () => {
  const fresh = readFileSync("scripts/rebuild-iat-v2-devnet-buffer-fresh.sh", "utf8");
  const handoff = readFileSync("scripts/handoff-iat-v2-devnet-buffer.sh", "utf8");
  const toolchain = readFileSync("scripts/lib/iat-v2-attended-solana-toolchain.sh", "utf8");
  const combined = `${fresh}\n${handoff}`;

  assert.doesNotMatch(combined, /634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7/u);
  assert.match(fresh, /iat-v2-devnet-buffer-preflight\.mjs verify/u);
  assert.match(fresh, /iat-v2-devnet-buffer-preflight\.mjs capacity/u);
  assert.doesNotMatch(fresh, /^\s*(?:BUFFER_ADDRESS=.*\\\s*)?bash scripts\/handoff-iat-v2-devnet-buffer\.sh/mu);
  assert.match(fresh, /handoff has NOT run/u);
  assert.match(handoff, /BUFFER_ADDRESS="\$\{BUFFER_ADDRESS:-\}"/u);
  assert.match(handoff, /exec 8<>\/dev\/tty/u);
  assert.match(handoff, /read -r confirmation <&8/u);
  assert.match(handoff, /piped stdin is not an attended confirmation/u);
  assert.doesNotMatch(handoff, /IAT_HANDOFF_CONFIRM/u);
  assert.doesNotMatch(fresh, /IAT_FRESH_REBUILD_CONFIRM/u);
  assert.doesNotMatch(combined, /--evidence "\$EVIDENCE" 2>&1/u, "machine JSON stdout must never merge stderr");
  assert.match(combined, /iat-v2-attended-solana-toolchain\.sh/u);
  assert.match(handoff, /IAT_V2_HANDOFF_CAS_ROOT/u);
  assert.match(handoff, /iat-v2-devnet-buffer-runtime-binding\.mjs/u);
  assert.match(handoff, /exec 12< "\$RUNTIME_BINDING_VERIFIER"/u);
  assert.match(handoff, /IAT_V2_RUNTIME_BINDING_STDIN_CLI=iat-v2-devnet-buffer-runtime-binding-stdin\/v1/u);
  assert.match(handoff, /reconcile-iat-v2-devnet-buffer-finalized\.mjs/u);
  assert.match(handoff, /iat_v2_capture_pinned_cas inspect/u);
  assert.match(handoff, /iat_v2_capture_pinned_cas reserve/u);
  assert.match(handoff, /PAYER_FD_PATH="\/proc\/self\/fd\/9"/u);
  assert.match(handoff, /--buffer-authority "\$PAYER_FD_PATH"/u);
  assert.match(handoff, /--keypair "\$PAYER_FD_PATH"/u);
  assert.match(handoff, /NODE PATH:/u);
  assert.match(handoff, /SOLANA PATH:/u);
  assert.match(handoff, /DEVNET GENESIS:/u);
  assert.match(handoff, /DEVNET_HANDOFF_FEE_FLOOR_LAMPORTS="10000000"/u);
  assert.match(handoff, /observe_handoff_fee_floor 9<&-/u);
  assert.match(handoff, /IAT_V2_CLEAN_ENVIRONMENT:-.*iat-v2-devnet-buffer-v1/u);
  assert.match(handoff, /inherited_name in BASH_ENV CDPATH ENV LD_LIBRARY_PATH LD_PRELOAD NODE_OPTIONS NODE_PATH SOLANA_CONFIG_FILE TMPDIR "\$\{!GIT_@\}"/u);
  assert.match(handoff, /HOME:-.*\/home\/a/u);
  assert.match(handoff, /PATH:-.*\/usr\/bin:\/bin/u);
  assert.match(handoff, /WSLInterop/u);
  assert.match(handoff, /microsoft-standard-WSL2/u);
  assert.match(handoff, /VERSION_ID=.*24\\\.04/u);
  assert.match(handoff, /iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean\/projects\/star-ascent\/site/u);
  assert.match(handoff, /\/usr\/bin\/env -i/u);
  assert.doesNotMatch(handoff, /program (?:show|dump)/u);
  assert.match(handoff, /HOME=\/nonexistent\/iat-v2-buffer-reconciler-home/u);
  assert.match(handoff, /exec 3< "\$ARTIFACT"/u);
  assert.match(handoff, /exec 4< "\$CAS_HELPER"/u);
  assert.match(handoff, /exec 5< "\$NODE_BIN"/u);
  assert.match(handoff, /exec 6< "\$RECONCILER"/u);
  assert.match(handoff, /exec 7< "\$SOLANA_BIN"/u);
  assert.match(handoff, /exec 8< "\$SEALED_EXEC_HELPER"/u);
  assert.match(handoff, /"\$SEALED_EXEC_PYTHON" -I -S -c "\$PINNED_SEALED_EXEC_SOURCE"/u);
  assert.match(handoff, /iat_v2_run_sealed_exec 90 5/u);
  assert.match(handoff, /--inherit-fd 3/u);
  assert.match(handoff, /--inherit-fd 10/u);
  assert.match(handoff, /launcher\+=\(--inherit-fd 9\)/u);
  assert.match(handoff, /IAT_V2_HANDOFF_CAS_ATTEMPTS_FD=10/u);
  assert.match(handoff, /\/usr\/bin\/flock --exclusive --nonblock 10 9<&-/u);
  assert.match(handoff, /\/usr\/bin\/flock --exclusive --nonblock 9/u);
  assert.equal(handoff.match(/iat_v2_open_pinned_pre_prompt_epoch/gmu)?.length, 2, "the pinned epoch must be defined and opened before attended review");
  assert.ok((handoff.match(/iat_v2_reverify_pinned_epoch/gmu)?.length ?? 0) >= 2, "the pinned epoch must be defined and reverified after attended review");
  assert.doesNotMatch(handoff, /iat_v2_open_pinned_post_confirmation_epoch/u);
  assert.doesNotMatch(handoff, /"\$PINNED_NODE_EXEC" --input-type=module -/u);
  assert.doesNotMatch(handoff, /"\$PINNED_SOLANA_EXEC" program set-buffer-authority/u);
  assert.match(handoff, /--artifact "\$PINNED_ARTIFACT_PATH"/u);
  assert.match(
    toolchain,
    /iat_v2_run_keyless_solana\(\)[\s\S]*?\/usr\/bin\/env -i[\s\S]*?"\$solana_path" "\$@" --config \/dev\/null/u,
  );
});

test("authority handoff CAS is target-keyed, canonical, durable, and cannot be reset by identity drift", () => {
  const sandbox = mkdtempSync(join(homedir(), ".iat-v2-handoff-cas-"));
  try {
    chmodSync(sandbox, 0o700);
    const root = join(sandbox, "persistent-state");
    const attempts = join(root, "attempts");
    mkdirSync(root, { mode: 0o700 });
    chmodSync(root, 0o700);
    mkdirSync(attempts, { mode: 0o700 });
    chmodSync(attempts, 0o700);
    const sentinelPath = join(root, IAT_V2_HANDOFF_CAS_ROOT_SENTINEL_FILE);
    writeFileSync(sentinelPath, `${JSON.stringify(sortJson(IAT_V2_HANDOFF_CAS_ROOT_SENTINEL), null, 2)}\n`, {
      mode: 0o600,
    });
    chmodSync(sentinelPath, 0o600);
    const options = {
      root,
      buffer: "Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6",
      "from-authority": "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4",
      "to-authority": "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH",
      "artifact-sha256": "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
      "artifact-bytes": "649680",
      "evidence-manifest-sha256": "ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9",
      "source-head-commit": "a03fe71dd66cd1650b8d0353e486786df30b83e9",
      "source-head-tree": "ffe82fcf8fd3d851c09a937ebec945121137e546",
      "ci-run-id": "33161771816",
      "ci-run-attempt": "1",
      "runtime-source-head-commit": "1".repeat(40),
      "runtime-source-head-tree": "2".repeat(40),
      "runtime-checkout-commit": "3".repeat(40),
      "runtime-checkout-tree": "4".repeat(40),
      "runtime-checkout-relation": "PR_MERGE_SECOND_PARENT",
      "runtime-binding-successor-commit": "5".repeat(40),
      "runtime-binding-successor-tree": "6".repeat(40),
      "runtime-binding-anchor-sha256": "1".repeat(64),
      "runtime-closure-sha256": "2".repeat(64),
      "runtime-evidence-manifest-sha256": "3".repeat(64),
      "runtime-ci-run-id": "33378495895",
      "runtime-ci-run-attempt": "1",
      "runtime-workflow-ref": "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge",
      "runtime-verification-sha256": "4".repeat(64),
      "handoff-sha256": "5".repeat(64),
      "handoff-bytes": "1",
      "reconciler-sha256": "6".repeat(64),
      "reconciler-bytes": "1",
      "cas-helper-sha256": "7".repeat(64),
      "cas-helper-bytes": "1",
      "sealed-exec-sha256": "8".repeat(64),
      "sealed-exec-bytes": "1",
      "runtime-binding-verifier-sha256": "9".repeat(64),
      "runtime-binding-verifier-bytes": "1",
      "toolchain-sha256": "a".repeat(64),
      "toolchain-bytes": "1",
      "sealed-exec-python-path": "/usr/bin/python3.12",
      "sealed-exec-python-version": "Python 3.12.3",
      "sealed-exec-python-sha256": "1643dacd9feaedc58f3cc581e4d22577dfe25c09b10282936186ccf0f2e61118",
      "sealed-exec-python-bytes": "8020928",
      "node-path": "/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node",
      "node-version": "v24.19.0",
      "node-sha256": "bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12",
      "node-bytes": "125989464",
      "git-path": "/usr/bin/git",
      "git-version": "git version 2.43.0",
      "git-sha256": "2a8c18fbf43da9f692d75474c72bea9dfd796c260b0f3dfe456376abc3bbd668",
      "git-bytes": "4066232",
      "devnet-genesis-hash": "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
      "solana-cli-path": "/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana",
      "solana-cli-version": "solana-cli 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)",
      "solana-cli-sha256": "aacc6871e8ff199608987f0364f2ed9e239a32e1e0548f1ae4477e0e533e1dea",
      "solana-cli-bytes": "28546968",
    };
    assert.throws(
      () => inspectHandoffReservation(options),
      (error) => error instanceof HandoffCasError && error.code === "CAS_ROOT_HOLD",
      "test-only roots must never weaken the production root pin",
    );
    const available = inspectHandoffReservation(options, { expectedRoot: root });
    assert.equal(available.status, "AVAILABLE");
    assert.equal(available.mutationMayRun, false);

    const created = reserveHandoffMutation(options, {
      now: () => new Date("2026-08-27T00:00:00.000Z"),
      expectedRoot: root,
    });
    assert.equal(created.status, "RESERVED_CREATED");
    assert.equal(created.mutationReserved, true);
    assert.equal(created.mutationMayRun, true);
    const original = readFileSync(created.recordPath, "utf8");
    assert.equal(original.endsWith("\n"), true);
    const parsed = JSON.parse(original);
    assert.deepEqual(Object.keys(parsed), Object.keys(parsed).toSorted(), "record keys must be canonically sorted");

    const existing = reserveHandoffMutation(options, {
      now: () => new Date("2030-01-01T00:00:00.000Z"),
      expectedRoot: root,
    });
    assert.equal(existing.status, "RESERVED_EXISTING");
    assert.equal(existing.mutationMayRun, false);
    assert.equal(readFileSync(existing.recordPath, "utf8"), original, "existing reservation must be byte-immutable");

    assert.throws(
      () => inspectHandoffReservation(
        { ...options, "artifact-sha256": "8".repeat(64) },
        { expectedRoot: root },
      ),
      (error) => error instanceof HandoffCasError && error.code === "CAS_INPUT_HOLD",
    );
    assert.equal(readFileSync(created.recordPath, "utf8"), original, "identity drift cannot replace the target-keyed reservation");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("buffer authority handoff has one mutation boundary and finalized read-only reconciliation", () => {
  const handoff = readFileSync("scripts/handoff-iat-v2-devnet-buffer.sh", "utf8");
  const mutations = handoff.match(/program set-buffer-authority/gmu) ?? [];
  const reservationWarning = "DO NOT RESUBMIT. A durable mutation reservation exists or may exist; preserve it and use signer-free finalized reconciliation only.";

  assert.equal(mutations.length, 1, "authority mutation command must occur exactly once in source");
  assert.doesNotMatch(handoff, /Authority handoff attempt|retrying verification/u);
  assert.match(handoff, /Submitting the one-use authority mutation exactly once/u);
  assert.match(handoff, /program set-buffer-authority[\s\S]*?--commitment finalized/u);
  assert.doesNotMatch(handoff, /program (?:show|dump)/u);
  assert.match(handoff, /iat_v2_run_signer_free_reconciler/u);
  assert.match(handoff, /IAT_V2_HANDOFF_CAPTURED_SOURCE:-.*iat-v2-devnet-buffer-handoff-captured-source\/v1/u);
  assert.match(handoff, /IAT_V2_HANDOFF_CAPTURED_SHA256:-/u);
  assert.match(handoff, /IAT_V2_HANDOFF_CAPTURED_BYTES:-/u);
  assert.match(handoff, /\$\{BASH_SOURCE\[0\]-\}.*environment/u);
  assert.match(handoff, /direct mutable-path execution is not admitted/u);
  assert.match(handoff, /HANDOFF_SOURCE_SHA256" == "\$CAPTURED_HANDOFF_SOURCE_SHA256"/u);
  assert.match(handoff, /HANDOFF_SOURCE_BYTES" == "\$CAPTURED_HANDOFF_SOURCE_BYTES"/u);
  assert.match(handoff, /--buffer "\$BUFFER_ADDRESS"[\s\S]*?--expected-authority "\$expected_authority"/u);
  assert.match(handoff, /v\.status==="EXACT_FINALIZED_BUFFER"/u);
  assert.match(handoff, /v\.account\?\.programBytes===bytes/u);
  assert.match(handoff, /v\.account\?\.programSha256===artifactHash/u);
  assert.match(handoff, /sealed===evidenceBodySha256/u);
  assert.match(
    handoff,
    /mutation_status=\$\?[\s\S]*?Beginning exact read-only finalized reconciliation[\s\S]*?fetch_buffer_record/u,
  );
  assert.match(handoff, /DO NOT RESUBMIT/gmu);
  assert.doesNotMatch(handoff, /--commitment confirmed/u);
  const reserve = handoff.indexOf("iat_v2_capture_pinned_cas reserve");
  const postPromptReobserve = handoff.indexOf(
    'fetch_buffer_record "$EXPECTED_PAYER"',
    handoff.indexOf("FINALIZED DEVNET PAYER BALANCE"),
  );
  const submitting = handoff.indexOf('echo "Submitting the one-use authority mutation exactly once..."');
  const mutation = handoff.indexOf("program set-buffer-authority");
  const reservationBoundary = handoff.indexOf('CAS_RESERVATION_BOUNDARY_ENTERED="true"');
  const permanentReservation = handoff.indexOf('CAS_MUTATION_PERMANENTLY_RESERVED="true"', reserve);
  const main = handoff.indexOf("iat_v2_main() {");
  const uncertainReservation = handoff.indexOf('CAS_RESERVATION_STATE_UNCERTAIN="true"', main);
  const initialCasInspect = handoff.indexOf('iat_v2_capture_pinned_cas inspect', main);
  const initialCasParse = handoff.indexOf('iat_v2_parse_exact_cas_result "$cas_record" "" "AVAILABLE,RESERVED_EXISTING"', initialCasInspect);
  const certainReservation = handoff.indexOf('CAS_RESERVATION_STATE_UNCERTAIN="false"', initialCasParse);
  const firstLiveGenesis = handoff.indexOf("iat_v2_verify_pinned_devnet_genesis", certainReservation);
  assert.ok(postPromptReobserve >= 0 && reserve > postPromptReobserve && submitting > reserve && mutation > submitting);
  assert.ok(reservationBoundary >= 0 && reservationBoundary < reserve && permanentReservation > reserve);
  assert.ok(
    main >= 0
      && uncertainReservation > main
      && initialCasInspect > uncertainReservation
      && initialCasParse > initialCasInspect
      && certainReservation > initialCasParse
      && firstLiveGenesis > certainReservation,
    "initial CAS uncertainty must be resolved exactly before any live Devnet genesis observation",
  );
  assert.match(handoff, new RegExp(reservationWarning.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(
    handoff,
    /if \(\( status != 0 \)\)[\s\S]*?CAS_RESERVATION_BOUNDARY_ENTERED[\s\S]*?CAS_MUTATION_PERMANENTLY_RESERVED[\s\S]*?CAS_RESERVATION_STATE_UNCERTAIN[\s\S]*?DO NOT RESUBMIT/u,
  );
  assert.doesNotMatch(handoff.slice(submitting, mutation), /reverify_(?:solana|git|node)|fetch_buffer_record|observe_handoff_fee_floor/u);
  assert.doesNotMatch(handoff.slice(reserve), /"\$SOLANA_BIN" program set-buffer-authority/u);
});

test("captured-source runbook pins the exact handoff bytes at both validation boundaries", () => {
  const handoffBytes = readFileSync("scripts/handoff-iat-v2-devnet-buffer.sh");
  const runbook = readFileSync("launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md", "utf8");
  const expectedSha256 = /^expected_sha256='([0-9a-f]{64})'$/mu.exec(runbook);
  const expectedBytes = /^expected_bytes='([1-9][0-9]*)'$/mu.exec(runbook);

  assert.ok(expectedSha256, "runbook must pin one canonical handoff SHA-256");
  assert.ok(expectedBytes, "runbook must pin one canonical handoff byte length");
  assert.equal(runbook.match(/^expected_sha256=/gmu)?.length, 1);
  assert.equal(runbook.match(/^expected_bytes=/gmu)?.length, 1);
  assert.equal(expectedSha256[1], sha256(handoffBytes));
  assert.equal(Number(expectedBytes[1]), handoffBytes.length);
  assert.match(runbook, /observed_sha256=.*\/proc\/\$\$\/fd\/15[\s\S]*?observed_bytes=.*\/proc\/\$\$\/fd\/15/u);
  assert.match(runbook, /"\$observed_sha256" == "\$expected_sha256" && "\$observed_bytes" == "\$expected_bytes"/u);
  assert.match(runbook, /captured_sha256=.*"\$handoff_source"[\s\S]*?captured_bytes=.*"\$handoff_source"/u);
  assert.match(runbook, /"\$captured_sha256" == "\$expected_sha256" && "\$captured_bytes" == "\$expected_bytes"/u);
  assert.match(runbook, /export IAT_V2_HANDOFF_CAPTURED_SHA256="\$captured_sha256"/u);
  assert.match(runbook, /export IAT_V2_HANDOFF_CAPTURED_BYTES="\$captured_bytes"/u);
  assert.match(runbook, /\/usr\/bin\/bash --noprofile --norc -c "\$handoff_source" "\$handoff_path"/u);
});

test("buffer authority helper retries reads but never repeats an ambiguous mutation", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "iat-v2-buffer-handoff-"));
  const bashCommand = process.platform === "win32"
    ? join(process.env.WINDIR ?? "C:\\Windows", "System32", "wsl.exe")
    : "bash";
  const bashPath = (value) => {
    if (process.platform !== "win32") return value;
    const normalized = value.replaceAll("\\", "/");
    const match = /^([A-Za-z]):\/(.*)$/u.exec(normalized);
    assert.ok(match, `cannot map Windows path into the test's WSL bash: ${value}`);
    return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
  };
  const executable = (name, source) => {
    const path = join(sandbox, name);
    writeFileSync(path, source.replaceAll("\r\n", "\n"));
    chmodSync(path, 0o755);
    return bashPath(path);
  };
  let fixtureSolanaLink = "";
  try {
    const artifact = Buffer.from("exact mocked migration artifact", "utf8");
    const artifactPath = join(sandbox, "iat_v2.so");
    writeFileSync(artifactPath, artifact);
    const artifactSha256 = sha256(artifact);
    const fixtureStateDir = bashPath(sandbox);
    const exactCasRoot = bashPath(join(sandbox, "persistent-cas"));
    const exactCasAttempts = join(sandbox, "persistent-cas", "attempts");
    mkdirSync(exactCasAttempts, { recursive: true, mode: 0o700 });
    chmodSync(join(sandbox, "persistent-cas"), 0o700);
    chmodSync(exactCasAttempts, 0o700);
    const runtimeSourceHead = "0".repeat(39) + "4";
    const sourceHead = "0".repeat(39) + "2";
    const evidenceHash = "0".repeat(64);
    const runtimeEvidenceHash = "1".repeat(64);
    const casTarget = {
      schema: "iat-v2-devnet-buffer-authority-target/v1",
      network: "devnet",
      mutation: "SET_BUFFER_AUTHORITY",
      casRootPath: exactCasRoot,
      casRootCeremonyId: "9e691e59-35c8-4861-86a0-7a219885b1c0",
      bufferAddress: "MockBufferAddress",
    };
    const fixtureCasKeySha256 = sha256(Buffer.from(`${JSON.stringify(sortJson(casTarget), null, 2)}\n`));
    const fixtureCasRecordPath = `${exactCasRoot}/attempts/${fixtureCasKeySha256}.json`;
    const fixturePersistedCasRecord = "fixture durable reservation record\n";
    const fixturePersistedCasSha256 = sha256(Buffer.from(fixturePersistedCasRecord));
    const exactCasResult = (status) => JSON.stringify({
      schema: "iat-v2-devnet-buffer-authority-cas-result/v2",
      status,
      casKeySha256: fixtureCasKeySha256,
      recordPath: fixtureCasRecordPath,
      recordSha256: status === "AVAILABLE" ? null : fixturePersistedCasSha256,
      mutationReserved: status !== "AVAILABLE",
      mutationMayRun: status === "RESERVED_CREATED",
      reservedAtUtc: status === "AVAILABLE" ? null : "2026-08-31T00:00:00.000Z",
    });
    const exactReconciliationRecord = (authority) => {
      const body = {
        schema: "iat-v2-devnet-buffer-finalized-reconciliation/v1",
        status: "EXACT_FINALIZED_BUFFER",
        network: "devnet",
        rpc: "https://api.devnet.solana.com",
        genesisHash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
        commitment: "finalized",
        minContextSlot: 100,
        accountContextSlot: 100,
        bufferAddress: "MockBufferAddress",
        expectedAuthority: authority,
        observedAuthority: authority,
        observedAuthorityRole: authority.startsWith("DYURS") ? "DEVNET_DEPLOYER" : "MODEL_T_ADMIN",
        account: {
          owner: "BPFLoaderUpgradeab1e11111111111111111111111",
          executable: false,
          lamports: "4522976880",
          dataBytes: artifact.length + 37,
          metadataBytes: 37,
          stateTag: 1,
          authorityOption: 1,
          programBytes: artifact.length,
          programSha256: artifactSha256,
        },
        publicCiArtifact: {
          bytes: artifact.length,
          sha256: artifactSha256,
          sourceHeadCommit: sourceHead,
          ciRunId: 33161771816,
          evidenceManifestSha256: evidenceHash,
        },
        comparison: {
          classification: "EXACT_ARTIFACT",
          exact: true,
          matchingPrefixBytes: artifact.length,
          expectedRemainingBytes: 0,
          firstMismatchOffset: null,
          observedProgramBytes: artifact.length,
          observedProgramSha256: artifactSha256,
        },
        validation: {
          authorityAdmitted: true,
          authorityMatchesExpected: true,
          sizeMatches: true,
          hashMatches: true,
          exact: true,
          partialExactPrefixZeroTail: false,
          holdReasons: [],
        },
        boundary: {
          mutationAuthorized: false,
          signing: false,
          broadcast: false,
          protectedRecoveryStateRead: false,
          next: "SEPARATE_ATTENDED_ACTION_REVIEW_REQUIRED",
        },
      };
      return JSON.stringify({
        ...body,
        evidenceBodySha256: sha256(Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8")),
        evidenceFile: null,
      });
    };
    const payerReconciliationRecord = exactReconciliationRecord("DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4");
    const adminReconciliationRecord = exactReconciliationRecord("7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH");
    const fixtureReconcilerSource = `import fs from "node:fs";
const stateDir = ${JSON.stringify(fixtureStateDir)};
const payerRecord = ${JSON.stringify(payerReconciliationRecord)};
const adminRecord = ${JSON.stringify(adminReconciliationRecord)};
const casRecordPath = ${JSON.stringify(fixtureCasRecordPath)};
const payer = "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4";
const admin = "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
const read = (name, fallback = "") => {
  try { return fs.readFileSync(stateDir + "/" + name, "utf8").trim(); } catch { return fallback; }
};
const increment = (name) => {
  const next = Number(read(name, "0")) + 1;
  fs.writeFileSync(stateDir + "/" + name, String(next) + "\\n");
  return next;
};
const leaksPayer = () => {
  try {
    const descriptor = fs.fstatSync(9);
    return [stateDir + "/payer.json", stateDir + "/payer.opened"]
      .filter((path) => fs.existsSync(path))
      .some((path) => { const file = fs.statSync(path); return file.dev === descriptor.dev && file.ino === descriptor.ino; });
  } catch { return false; }
};
if (leaksPayer()) process.exit(80);
const scenario = read("scenario");
const count = increment("reconcile-count");
const args = process.argv.slice(2);
let expected = "";
let artifactPath = "";
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--expected-authority") expected = args[++index] ?? "";
  else if (args[index] === "--artifact") artifactPath = args[++index] ?? "";
}
const pinned = process.env.IAT_V2_RECONCILER_STDIN_CLI === "iat-v2-devnet-buffer-finalized-reconciler-stdin/v1";
if (pinned) {
  if (artifactPath !== "/proc/self/fd/3") process.exit(83);
  if (fs.readFileSync(artifactPath, "utf8") !== "exact mocked migration artifact") process.exit(84);
}
if (scenario === "runtime_paths_swap_after_pin" && pinned && count === 3) {
  fs.renameSync(stateDir + "/fixture-site/scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs", stateDir + "/reconciler.swapped");
  fs.renameSync(stateDir + "/fixture-site/scripts/iat-v2-devnet-buffer-handoff-cas.mjs", stateDir + "/cas.swapped");
  fs.renameSync(stateDir + "/fixture-site/scripts/iat-v2-sealed-exec.py", stateDir + "/sealed-exec.swapped");
  fs.writeFileSync(stateDir + "/fixture-site/scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs", "// malicious reconciler replacement\\n");
  fs.writeFileSync(stateDir + "/fixture-site/scripts/iat-v2-devnet-buffer-handoff-cas.mjs", "// malicious CAS replacement\\n");
  fs.writeFileSync(stateDir + "/fixture-site/scripts/iat-v2-sealed-exec.py", "# malicious sealed-exec replacement\\n");
}
if (scenario === "post_reserve_fd11_drift" && pinned && count === 4) {
  fs.writeFileSync(casRecordPath, "adversarial post-open record drift\\n", { flag: "a" });
}
const mutationCount = Number(read("mutation-count", "0"));
if (scenario === "timeout_success" && count === 1) {
  process.stderr.write('{"schema":"iat-v2-devnet-buffer-finalized-reconciliation-error/v1","status":"HOLD","code":"RPC_TRANSPORT_HOLD","message":"Devnet RPC HTTP status 429"}\\n');
  process.exit(2);
}
if (scenario === "ambiguous" && mutationCount !== 0) {
  process.stderr.write('{"schema":"iat-v2-devnet-buffer-finalized-reconciliation-error/v1","status":"HOLD","code":"RPC_TRANSPORT_HOLD","message":"Devnet RPC HTTP status 429"}\\n');
  process.exit(2);
}
if (scenario === "wrong_account") {
  process.stderr.write('{"schema":"iat-v2-devnet-buffer-finalized-reconciliation-error/v1","status":"HOLD","code":"BUFFER_ACCOUNT_HOLD","message":"finalized buffer address mismatch"}\\n');
  process.exit(2);
}
if (scenario === "wrong_bytes") {
  process.stdout.write('{"schema":"iat-v2-devnet-buffer-finalized-reconciliation/v1","status":"HOLD_BUFFER_MISMATCH","observedAuthority":"' + payer + '","validation":{"holdReasons":["PROGRAM_SHA256_MISMATCH"]}}\\n');
  process.exit(2);
}
if (scenario === "payer_symlink" && expected === payer && !fs.lstatSync(stateDir + "/payer.json").isSymbolicLink()) {
  fs.rmSync(stateDir + "/payer.json");
  fs.symlinkSync(stateDir + "/payer-replacement.json", stateDir + "/payer.json");
}
const authority = scenario === "already"
  || (["timeout_success", "runtime_paths_swap_after_pin"].includes(scenario) && mutationCount !== 0)
  ? admin : payer;
if (authority === expected) {
  process.stdout.write((authority === payer ? payerRecord : adminRecord) + "\\n");
  process.exit(0);
}
process.stdout.write('{"schema":"iat-v2-devnet-buffer-finalized-reconciliation/v1","status":"HOLD_BUFFER_MISMATCH","observedAuthority":"' + authority + '","validation":{"holdReasons":["EXPECTED_AUTHORITY_MISMATCH"]}}\\n');
process.exit(2);
`;
    const fixtureCasSource = `import fs from "node:fs";
const stateDir = ${JSON.stringify(fixtureStateDir)};
const available = ${JSON.stringify(exactCasResult("AVAILABLE"))};
const created = ${JSON.stringify(exactCasResult("RESERVED_CREATED"))};
const existing = ${JSON.stringify(exactCasResult("RESERVED_EXISTING"))};
const digestSwapExisting = JSON.stringify({ ...JSON.parse(existing), recordSha256: "f".repeat(64) });
const key = ${JSON.stringify(fixtureCasKeySha256)};
const recordPath = ${JSON.stringify(fixtureCasRecordPath)};
const persistedRecord = ${JSON.stringify(fixturePersistedCasRecord)};
const leaksPayer = () => {
  try {
    const descriptor = fs.fstatSync(9);
    return [stateDir + "/payer.json", stateDir + "/payer.opened"]
      .filter((path) => fs.existsSync(path))
      .some((path) => { const file = fs.statSync(path); return file.dev === descriptor.dev && file.ino === descriptor.ino; });
  } catch { return false; }
};
if (leaksPayer()) process.exit(80);
const scenario = fs.readFileSync(stateDir + "/scenario", "utf8").trim();
const args = process.argv.slice(2);
const command = args[0] ?? "";
if (command === "inspect") {
  const reservationExists = fs.existsSync(recordPath);
  if (!reservationExists && scenario === "initial_cas_inspect_failure") {
    process.stderr.write("fixture initial CAS inspection failure\\n");
    process.exit(90);
  } else if (scenario === "malformed_cas_extra") {
    process.stdout.write(available + "\\nUNREVIEWED\\n");
  } else if (scenario === "malformed_cas_schema") {
    const malformed = JSON.parse(available);
    malformed.schema = "iat-v2-devnet-buffer-authority-cas-result/v0";
    process.stdout.write(JSON.stringify(malformed) + "\\n");
  } else if (reservationExists && scenario === "post_reserve_reinspection_failure") {
    process.stderr.write("fixture post-reservation reinspection failure\\n");
    process.exit(89);
  } else if (reservationExists && scenario === "post_reserve_digest_swap") {
    process.stdout.write(digestSwapExisting + "\\n");
  } else {
    if (reservationExists && scenario === "post_reserve_runtime_drift") {
      fs.writeFileSync(stateDir + "/iat_v2.so", "adversarial runtime drift\\n", { flag: "a" });
    }
    if (reservationExists && scenario === "post_reserve_payer_drift") {
      fs.renameSync(stateDir + "/payer.json", stateDir + "/payer.opened");
      fs.writeFileSync(stateDir + "/payer.json", "REPLACEMENT-PATH-FIXTURE\\n");
    }
    process.stdout.write((reservationExists ? existing : available) + "\\n");
  }
  process.exit(0);
}
if (command !== "reserve") process.exit(88);
if (process.env.IAT_V2_HANDOFF_CAS_ATTEMPTS_FD !== "10") process.exit(86);
if (!fs.statSync("/proc/self/fd/10").isDirectory()) process.exit(87);
let status = created;
try {
  fs.writeFileSync("/proc/self/fd/10/" + key + ".json", persistedRecord, { flag: "wx", mode: 0o600 });
} catch (error) {
  if (error?.code !== "EEXIST") throw error;
  status = existing;
}
if (scenario === "malformed_reserve_success_output" && status === created) {
  process.stdout.write(status + "\\nUNREVIEWED\\n");
  process.exit(0);
}
process.stdout.write(status + "\\n");
`;
    const fixtureSealedExecBytes = readFileSync("scripts/iat-v2-sealed-exec.py");
    const fixtureReconcilerSha256 = sha256(Buffer.from(fixtureReconcilerSource));
    const fixtureCasSha256 = sha256(Buffer.from(fixtureCasSource));
    const fixtureSealedExecSha256 = sha256(fixtureSealedExecBytes);
    const fakeGit = executable("git", `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
  printf 'git version 2.55.0.windows.5\\n'
  exit 0
fi
if [[ "\${1:-}" == "show" ]]; then
  case "\${2:-}" in
    *reconcile-iat-v2-devnet-buffer-finalized.mjs) /usr/bin/cat -- '${fixtureStateDir}/fixture-site/scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs' ;;
    *iat-v2-devnet-buffer-handoff-cas.mjs) /usr/bin/cat -- '${fixtureStateDir}/fixture-site/scripts/iat-v2-devnet-buffer-handoff-cas.mjs' ;;
    *iat-v2-sealed-exec.py) /usr/bin/cat -- '${fixtureStateDir}/fixture-site/scripts/iat-v2-sealed-exec.py' ;;
    *) exit 97 ;;
  esac
  exit 0
fi
if [[ "\${1:-}" == "cat-file" && "\${2:-}" == "-s" ]]; then
  case "\${3:-}" in
    *reconcile-iat-v2-devnet-buffer-finalized.mjs) /usr/bin/stat -c '%s' -- '${fixtureStateDir}/fixture-site/scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs' ;;
    *iat-v2-devnet-buffer-handoff-cas.mjs) /usr/bin/stat -c '%s' -- '${fixtureStateDir}/fixture-site/scripts/iat-v2-devnet-buffer-handoff-cas.mjs' ;;
    *iat-v2-sealed-exec.py) /usr/bin/stat -c '%s' -- '${fixtureStateDir}/fixture-site/scripts/iat-v2-sealed-exec.py' ;;
    *) exit 97 ;;
  esac
  exit 0
fi
exit 98
`);
    const fakeGitBytes = readFileSync(join(sandbox, "git"));
    const fakeGitSha256 = sha256(fakeGitBytes);
    const fixtureRuntimeBindingSource = `import fs from "node:fs";
import { createHash } from "node:crypto";
if (process.env.IAT_V2_RUNTIME_BINDING_STDIN_CLI !== "iat-v2-devnet-buffer-runtime-binding-stdin/v1") process.exit(81);
const root = process.env.IAT_V2_PROJECT_ROOT;
const paths = [
  "scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs",
  "scripts/iat-v2-devnet-buffer-handoff-cas.mjs",
  "scripts/iat-v2-sealed-exec.py",
  "scripts/lib/iat-v2-attended-solana-toolchain.sh",
  "scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs",
  "scripts/handoff-iat-v2-devnet-buffer.sh",
];
const runtimeClosureEntries = paths.map((path) => {
  const bytes = fs.readFileSync(root + "/" + path);
  return { path, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
});
if (fs.readFileSync(${JSON.stringify(fixtureStateDir + "/scenario")}, "utf8").trim() === "cas_swap_before_pin") {
  fs.writeFileSync(root + "/scripts/iat-v2-devnet-buffer-handoff-cas.mjs", "// unreviewed replacement CAS bytes\\n");
}
process.stdout.write(JSON.stringify({
  artifactSha256: ${JSON.stringify(artifactSha256)},
  artifactBytes: ${artifact.length},
  evidenceManifestSha256: ${JSON.stringify(runtimeEvidenceHash)},
  sourceHeadCommit: ${JSON.stringify(runtimeSourceHead)},
  sourceHeadTree: ${JSON.stringify("0".repeat(39) + "5")},
  checkoutCommit: ${JSON.stringify("0".repeat(39) + "a")},
  checkoutTree: ${JSON.stringify("0".repeat(39) + "b")},
  checkoutRelation: "PR_MERGE_SECOND_PARENT",
  bindingSuccessorCommit: ${JSON.stringify("0".repeat(39) + "6")},
  bindingSuccessorTree: ${JSON.stringify("0".repeat(39) + "7")},
  bindingAnchorSha256: ${JSON.stringify("8".repeat(64))},
  runtimeClosureSha256: ${JSON.stringify("9".repeat(64))},
  ciRunId: 33161771816,
  ciRunAttempt: 1,
  workflowRef: "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge",
  runtimeClosureEntries,
}));
`;
    const productionToolchain = readFileSync("scripts/lib/iat-v2-attended-solana-toolchain.sh", "utf8");
    const productionNodeMatch = /^IAT_V2_EXPECTED_NODE_PATH='([^']+)'$/mu.exec(productionToolchain);
    assert.ok(productionNodeMatch);
    const fixtureElf = process.platform === "win32" ? productionNodeMatch[1] : bashPath(process.execPath);
    fixtureSolanaLink = `/tmp/iat-v2-solana-fixture-${sha256(Buffer.from(fixtureStateDir)).slice(0, 20)}`;
    const probeCommand = `set -euo pipefail
p="$1"
solana_link="$2"
/usr/bin/rm -f -- "$solana_link"
/usr/bin/ln -- "$p" "$solana_link"
/usr/bin/chmod 755 -- "$solana_link"
"$p" --version
/usr/bin/sha256sum -- "$p" | /usr/bin/cut -d' ' -f1
/usr/bin/stat -Lc '%s' -- "$p"
/usr/bin/python3.12 --version
/usr/bin/sha256sum -- /usr/bin/python3.12 | /usr/bin/cut -d' ' -f1
/usr/bin/stat -Lc '%s' -- /usr/bin/python3.12
`;
    const probeArgs = process.platform === "win32"
      ? ["--exec", "/usr/bin/bash", "--noprofile", "--norc", "-c", probeCommand, "iat-v2-runtime-probe", fixtureElf, fixtureSolanaLink]
      : ["--noprofile", "--norc", "-c", probeCommand, "iat-v2-runtime-probe", fixtureElf, fixtureSolanaLink];
    const probe = spawnSync(bashCommand, probeArgs, { encoding: "utf8", env: process.env });
    assert.equal(probe.status, 0, probe.stderr || probe.stdout);
    const [fixtureElfVersion, fixtureElfSha256, fixtureElfBytes, fixturePythonVersion, fixturePythonSha256, fixturePythonBytes] = probe.stdout.trim().split(/\r?\n/u);
    assert.match(fixtureElfSha256, /^[0-9a-f]{64}$/u);
    assert.match(fixtureElfBytes, /^[1-9][0-9]*$/u);
    const fakeNode = fixtureElf;
    const fakeSolana = fixtureSolanaLink;
    const fakeNodeBytes = { length: Number(fixtureElfBytes) };
    const fakeSolanaBytes = fakeNodeBytes;
    const fixtureRoot = join(sandbox, "fixture-site");
    const fixtureScripts = join(fixtureRoot, "scripts");
    const fixtureLib = join(fixtureScripts, "lib");
    mkdirSync(fixtureLib, { recursive: true });
    writeFileSync(
      join(fixtureScripts, "reconcile-iat-v2-devnet-buffer-finalized.mjs"),
      fixtureReconcilerSource,
    );
    writeFileSync(
      join(fixtureScripts, "iat-v2-devnet-buffer-handoff-cas.mjs"),
      fixtureCasSource,
    );
    writeFileSync(
      join(fixtureScripts, "iat-v2-sealed-exec.py"),
      fixtureSealedExecBytes,
    );
    writeFileSync(
      join(fixtureLib, "iat-v2-devnet-buffer-runtime-binding.mjs"),
      fixtureRuntimeBindingSource,
    );
    const solanaCommandPrelude = `import fs from "node:fs";
const stateDir = ${JSON.stringify(fixtureStateDir)};
const args = process.argv.slice(2);
const read = (name, fallback = "") => {
  try { return fs.readFileSync(stateDir + "/" + name, "utf8").trim(); } catch { return fallback; }
};
const increment = (name) => {
  const next = Number(read(name, "0")) + 1;
  fs.writeFileSync(stateDir + "/" + name, String(next) + "\\n");
  return next;
};
const leaksPayer = () => {
  try {
    const descriptor = fs.fstatSync(9);
    return [stateDir + "/payer.json", stateDir + "/payer.opened"]
      .filter((path) => fs.existsSync(path))
      .some((path) => { const file = fs.statSync(path); return file.dev === descriptor.dev && file.ino === descriptor.ino; });
  } catch { return false; }
};
`;
    writeFileSync(join(fixtureRoot, "genesis-hash"), `${solanaCommandPrelude}
if (leaksPayer()) process.exit(80);
increment("genesis-count");
process.stdout.write("EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG\\n");
`);
    writeFileSync(join(fixtureRoot, "balance"), `${solanaCommandPrelude}
if (leaksPayer()) process.exit(80);
const balanceCount = increment("balance-count");
process.stdout.write(read("scenario") === "post_reserve_floor_drift" && balanceCount === 3
  ? "0 lamports\\n"
  : "1000000000 lamports\\n");
`);
    writeFileSync(join(fixtureRoot, "address"), `${solanaCommandPrelude}
increment("address-count");
if (args[0] !== "-k" || args[1] !== "/proc/self/fd/9") process.exit(92);
if (!fs.existsSync("/proc/self/fd/9") || fs.readFileSync("/proc/self/fd/9", "utf8").trim() !== "ORIGINAL-PAYER-FIXTURE") process.exit(93);
if (read("scenario") === "payer_swap_after_open") {
  fs.renameSync(stateDir + "/payer.json", stateDir + "/payer.opened");
  fs.writeFileSync(stateDir + "/payer.json", "REPLACEMENT-PATH-FIXTURE\\n");
}
process.stdout.write("DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4\\n");
`);
    writeFileSync(join(fixtureRoot, "program"), `${solanaCommandPrelude}
if (args[0] === "show" || args[0] === "dump") {
  increment("legacy-read-count");
  process.stderr.write("simulated default-signer fallback: legacy program read is forbidden\\n");
  process.exit(95);
}
if (args[0] !== "set-buffer-authority") process.exit(91);
increment("mutation-count");
const includesPair = (name, value) => args.some((entry, index) => entry === name && args[index + 1] === value);
if (!includesPair("--buffer-authority", "/proc/self/fd/9")
    || !includesPair("--keypair", "/proc/self/fd/9")
    || !includesPair("--commitment", "finalized")) process.exit(96);
if (!fs.existsSync("/proc/self/fd/9") || fs.readFileSync("/proc/self/fd/9", "utf8").trim() !== "ORIGINAL-PAYER-FIXTURE") process.exit(97);
if (read("scenario") === "ambiguous") process.exit(124);
process.stdout.write("submitted once\\n");
`);
    writeFileSync(join(sandbox, "payer.json"), "ORIGINAL-PAYER-FIXTURE\n");
    writeFileSync(join(sandbox, "payer-replacement.json"), "REPLACEMENT-PAYER-FIXTURE\n");
    writeFileSync(join(sandbox, "evidence.json"), "{}\n");
    chmodSync(join(sandbox, "payer.json"), 0o600);
    chmodSync(join(sandbox, "payer-replacement.json"), 0o600);

    const replacePin = (source, name, value) => {
      const expression = new RegExp(`^${name}='[^']*'$`, "mu");
      assert.match(source, expression, `fixture pin ${name} must exist in production source`);
      return source.replace(expression, `${name}='${value}'`);
    };
    let fixtureToolchain = readFileSync("scripts/lib/iat-v2-attended-solana-toolchain.sh", "utf8");
    for (const [name, value] of [
      ["IAT_V2_EXPECTED_NODE_PATH", fakeNode],
      ["IAT_V2_EXPECTED_NODE_VERSION", fixtureElfVersion],
      ["IAT_V2_EXPECTED_NODE_SHA256", fixtureElfSha256],
      ["IAT_V2_EXPECTED_NODE_BYTES", String(fakeNodeBytes.length)],
      ["IAT_V2_EXPECTED_GIT_PATH", fakeGit],
      ["IAT_V2_EXPECTED_GIT_VERSION", "git version 2.55.0.windows.5"],
      ["IAT_V2_EXPECTED_GIT_SHA256", fakeGitSha256],
      ["IAT_V2_EXPECTED_GIT_BYTES", String(fakeGitBytes.length)],
      ["IAT_V2_EXPECTED_SOLANA_CLI_PATH", fakeSolana],
      ["IAT_V2_EXPECTED_SOLANA_CLI_VERSION", fixtureElfVersion],
      ["IAT_V2_EXPECTED_SOLANA_CLI_SHA256", fixtureElfSha256],
      ["IAT_V2_EXPECTED_SOLANA_CLI_BYTES", String(fakeSolanaBytes.length)],
    ]) fixtureToolchain = replacePin(fixtureToolchain, name, value);
    fixtureToolchain = fixtureToolchain.replaceAll(" --config /dev/null", "");
    if (process.platform === "win32") {
      fixtureToolchain = fixtureToolchain.replace(
        "(( (8#$observed_mode & 8#022) != 0 ))",
        "(( (8#$observed_mode & 8#000) != 0 ))",
      );
    }
    writeFileSync(
      join(fixtureLib, "iat-v2-attended-solana-toolchain.sh"),
      fixtureToolchain.replaceAll("\r\n", "\n"),
    );
    const fixtureToolchainBytes = readFileSync(join(fixtureLib, "iat-v2-attended-solana-toolchain.sh"));
    const fixtureRuntimeBindingBytes = readFileSync(join(fixtureLib, "iat-v2-devnet-buffer-runtime-binding.mjs"));

    let fixtureHandoff = readFileSync("scripts/handoff-iat-v2-devnet-buffer.sh", "utf8");
    fixtureHandoff = fixtureHandoff.replace(
      'EXPECTED_CAS_ROOT="/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1"',
      `EXPECTED_CAS_ROOT="${exactCasRoot}"`,
    );
    fixtureHandoff = fixtureHandoff.replaceAll(
      "/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site",
      bashPath(fixtureRoot),
    );
    fixtureHandoff = fixtureHandoff.replace(
      'PAYER_KEYPAIR="/home/a/.config/solana/iat-v2-devnet-deployer.json"',
      `PAYER_KEYPAIR="${bashPath(join(sandbox, "payer.json"))}"`,
    );
    fixtureHandoff = fixtureHandoff.replace(
      'ARTIFACT="$SITE_ROOT/target/verifiable/iat_v2.so"',
      `ARTIFACT="${bashPath(artifactPath)}"`,
    );
    fixtureHandoff = fixtureHandoff.replaceAll(' "$@" --config /dev/null', ' "$@"');
    for (const [name, value] of [
      ["TOOLCHAIN_SOURCE_SHA256", sha256(fixtureToolchainBytes)],
      ["TOOLCHAIN_SOURCE_BYTES", String(fixtureToolchainBytes.length)],
      ["EXPECTED_HASH", artifactSha256],
      ["EXPECTED_BYTES", String(artifact.length)],
      ["EVIDENCE_HASH", evidenceHash],
      ["SOURCE_HEAD", sourceHead],
      ["SOURCE_TREE", "0".repeat(39) + "3"],
      ["CI_RUN_ID", "33161771816"],
      ["CI_RUN_ATTEMPT", "1"],
      ["RECONCILER_SOURCE_SHA256", fixtureReconcilerSha256],
      ["RECONCILER_SOURCE_BYTES", String(Buffer.byteLength(fixtureReconcilerSource))],
      ["CAS_HELPER_SOURCE_SHA256", fixtureCasSha256],
      ["CAS_HELPER_SOURCE_BYTES", String(Buffer.byteLength(fixtureCasSource))],
      ["SEALED_EXEC_SOURCE_SHA256", fixtureSealedExecSha256],
      ["SEALED_EXEC_SOURCE_BYTES", String(fixtureSealedExecBytes.length)],
      ["RUNTIME_BINDING_VERIFIER_SOURCE_SHA256", sha256(fixtureRuntimeBindingBytes)],
      ["RUNTIME_BINDING_VERIFIER_SOURCE_BYTES", String(fixtureRuntimeBindingBytes.length)],
      ["SEALED_EXEC_PYTHON", "/usr/bin/python3.12"],
      ["SEALED_EXEC_PYTHON_VERSION", fixturePythonVersion],
      ["SEALED_EXEC_PYTHON_SHA256", fixturePythonSha256],
      ["SEALED_EXEC_PYTHON_BYTES", fixturePythonBytes],
    ]) {
      const expression = new RegExp(`^${name}="[^"]*"$`, "mu");
      assert.match(fixtureHandoff, expression, `fixture pin ${name} must exist in production source`);
      fixtureHandoff = fixtureHandoff.replace(expression, `${name}="${value}"`);
    }
    fixtureHandoff = fixtureHandoff.replace(
      '[[ -e /proc/sys/fs/binfmt_misc/WSLInterop ]] || hold "WSL interoperability boundary is unavailable"',
      ': # Mock fixture runs under the test-selected local Bash boundary.',
    );
    fixtureHandoff = fixtureHandoff.replace(
      '[[ "$(/usr/bin/uname -r)" == *-microsoft-standard-WSL2 ]] || hold "kernel is not the reviewed WSL2 class"',
      ":",
    );
    fixtureHandoff = fixtureHandoff.replace(
      "/usr/bin/grep -Fqx 'ID=ubuntu' /etc/os-release || hold \"distribution is not Ubuntu\"",
      ":",
    );
    fixtureHandoff = fixtureHandoff.replace(
      "/usr/bin/grep -Eq '^VERSION_ID=\"?24\\.04\"?$' /etc/os-release || hold \"distribution is not Ubuntu 24.04\"",
      ":",
    );
    fixtureHandoff = fixtureHandoff.replace(
      '[[ "$(/usr/bin/id -u)" == "1000" ]] || hold "attended POSIX user identity drifted"',
      ":",
    );
    if (process.platform !== "win32") {
      const productionFdUidComparison = '"$fd_uid" != "1000"';
      const productionUidEquality = '"$uid" == "1000"';
      const productionUidInequality = '"$uid" != "1000"';
      assert.equal(
        fixtureHandoff.split(productionFdUidComparison).length - 1,
        2,
        "generated handoff fixture must retain exactly the two reviewed FD UID comparisons",
      );
      assert.equal(
        fixtureHandoff.split(productionUidEquality).length - 1,
        4,
        "generated handoff fixture must retain exactly the four reviewed UID equality comparisons",
      );
      assert.equal(
        fixtureHandoff.split(productionUidInequality).length - 1,
        1,
        "generated handoff fixture must retain exactly the reviewed reserved-CAS UID inequality",
      );
      fixtureHandoff = fixtureHandoff.replaceAll(
        productionFdUidComparison,
        `"$fd_uid" != "${process.getuid()}"`,
      );
      fixtureHandoff = fixtureHandoff.replaceAll(
        productionUidEquality,
        `"$uid" == "${process.getuid()}"`,
      );
      fixtureHandoff = fixtureHandoff.replaceAll(
        productionUidInequality,
        `"$uid" != "${process.getuid()}"`,
      );
    }
    fixtureHandoff = fixtureHandoff.replaceAll("/usr/bin/sleep 10", ":");
    if (process.platform === "win32") {
      fixtureHandoff = fixtureHandoff.replaceAll('"$fd_mode" != "600"', '"$fd_mode" != "777"');
      fixtureHandoff = fixtureHandoff.replaceAll('"$mode" == "700"', '"$mode" == "777"');
      fixtureHandoff = fixtureHandoff.replaceAll('"$mode" == "600"', '"$mode" == "777"');
      fixtureHandoff = fixtureHandoff.replaceAll('"$mode" != "600"', '"$mode" != "777"');
    }
    writeFileSync(
      join(fixtureScripts, "handoff-iat-v2-devnet-buffer.sh"),
      fixtureHandoff.replaceAll("\r\n", "\n"),
    );
    chmodSync(join(fixtureScripts, "handoff-iat-v2-devnet-buffer.sh"), 0o755);

    const shimDir = bashPath(sandbox);
    const runScenario = (scenario, {
      preserveState = false,
      attended = true,
      poisonName = "",
      poisonValue = "",
    } = {}) => {
      if (!preserveState) {
        for (const name of ["reconcile-count", "legacy-read-count", "mutation-count", "address-count", "balance-count", "genesis-count", "cas-reserved", "payer.opened", "fixture-lock-ready"]) {
          rmSync(join(sandbox, name), { force: true });
        }
        rmSync(join(exactCasAttempts, `${fixtureCasKeySha256}.json`), { force: true });
      }
      writeFileSync(artifactPath, artifact);
      const payerPath = join(sandbox, "payer.json");
      try {
        rmSync(payerPath, { force: true });
      } catch (error) {
        if (process.platform !== "win32" || error?.code !== "EACCES") throw error;
        const cleanup = spawnSync(bashCommand, [
          "--exec",
          "/usr/bin/rm",
          "-f",
          "--",
          bashPath(payerPath),
        ], {
          cwd: process.cwd(),
          encoding: "utf8",
          env: process.env,
        });
        assert.equal(
          cleanup.status,
          0,
          `WSL-created payer symlink cleanup failed: ${cleanup.stderr || cleanup.stdout}`,
        );
      }
      writeFileSync(payerPath, "ORIGINAL-PAYER-FIXTURE\n");
      chmodSync(payerPath, 0o600);
      writeFileSync(join(sandbox, "scenario"), `${scenario}\n`);
      const command = `
export IAT_V2_CLEAN_ENVIRONMENT="iat-v2-devnet-buffer-v1"
export HOME="/home/a"
export LANG="C.UTF-8"
export LC_ALL="C.UTF-8"
export PATH="/usr/bin:/bin"
export SOLANA_BIN="$2"
export PAYER_KEYPAIR="$3"
export NODE_BIN="$4"
export ARTIFACT="$6"
export EVIDENCE="$7"
export BUFFER_ADDRESS="MockBufferAddress"
export IAT_V2_HANDOFF_CAS_ROOT="$8/persistent-cas"
export FAKE_SCENARIO="$9"
if [[ -n "\${10}" ]]; then export "\${10}=\${11}"; fi
cd -- "\${12}"
handoff_path="\${12}/scripts/handoff-iat-v2-devnet-buffer.sh"
export IAT_V2_HANDOFF_CAPTURED_SOURCE="iat-v2-devnet-buffer-handoff-captured-source/v1"
export IAT_V2_HANDOFF_SOURCE_PATH="$handoff_path"
IAT_V2_FIXTURE_HANDOFF_SOURCE="$(/usr/bin/cat -- "$handoff_path"; printf '\\x1f')"
[[ "\${IAT_V2_FIXTURE_HANDOFF_SOURCE: -1}" == $'\\x1f' ]] || exit 99
IAT_V2_FIXTURE_HANDOFF_SOURCE="\${IAT_V2_FIXTURE_HANDOFF_SOURCE%$'\\x1f'}"
export IAT_V2_HANDOFF_CAPTURED_SHA256="$(printf '%s' "$IAT_V2_FIXTURE_HANDOFF_SOURCE" | /usr/bin/sha256sum | /usr/bin/cut -d' ' -f1)"
export IAT_V2_HANDOFF_CAPTURED_BYTES="$(printf '%s' "$IAT_V2_FIXTURE_HANDOFF_SOURCE" | /usr/bin/wc -c)"
export IAT_V2_FIXTURE_HANDOFF_SOURCE
if [[ "\${13}" == "attended" ]]; then
  if [[ "$9" == "preheld_cas_lock" || "$9" == "preheld_payer_lock" ]]; then
    lock_target="$8/persistent-cas/attempts"
    if [[ "$9" == "preheld_payer_lock" ]]; then lock_target="$3"; fi
    (
      exec {lock_fd}<"$lock_target"
      /usr/bin/flock --exclusive "$lock_fd"
      printf 'ready\\n' > "$8/fixture-lock-ready"
      exec {wait_fd}</dev/zero
      while :; do
        IFS= read -r -t 1 -u "$wait_fd" _ || true
      done
    ) </dev/null >/dev/null 2>&1 &
    lock_pid=$!
    for _ in $(/usr/bin/seq 1 100); do
      [[ -f "$8/fixture-lock-ready" ]] && break
      /usr/bin/sleep 0.01
    done
    [[ -f "$8/fixture-lock-ready" ]] || exit 98
    set +e
    /usr/bin/script -qefc '/usr/bin/bash -c "$IAT_V2_FIXTURE_HANDOFF_SOURCE"' /dev/null
    handoff_status=$?
    set -e
    /usr/bin/kill "$lock_pid" 2>/dev/null || true
    wait "$lock_pid" 2>/dev/null || true
    exit "$handoff_status"
  fi
  exec /usr/bin/script -qefc '/usr/bin/bash -c "$IAT_V2_FIXTURE_HANDOFF_SOURCE"' /dev/null
fi
exec /usr/bin/setsid -f -w /usr/bin/bash -c "$IAT_V2_FIXTURE_HANDOFF_SOURCE"
`;
      const bashArgs = process.platform === "win32"
        ? ["--exec", "bash", "-c"]
        : ["-c"];
      const result = spawnSync(bashCommand, [
        ...bashArgs,
        command,
        "iat-v2-handoff-test",
        shimDir,
        fakeSolana,
        bashPath(join(sandbox, "payer.json")),
        fakeNode,
        fakeGit,
        bashPath(artifactPath),
        bashPath(join(sandbox, "evidence.json")),
        bashPath(sandbox),
        scenario,
        poisonName,
        poisonValue,
        bashPath(fixtureRoot),
        attended ? "attended" : "non-tty",
      ], {
        cwd: process.cwd(),
        encoding: "utf8",
        input: `TRANSFER-MockBufferAddress-${artifactSha256.slice(0, 12)}\n`,
        env: process.env,
      });
      const counter = (name) => {
        const path = join(sandbox, name);
        try {
          return Number(readFileSync(path, "utf8").trim());
        } catch {
          return 0;
        }
      };
      return { ...result, counter };
    };
    const postReservationWarning = /DO NOT RESUBMIT\. A durable mutation reservation exists or may exist; preserve it and use signer-free finalized reconciliation only\./u;
    const assertPostReservationHold = (result, expectedFailure) => {
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      assert.ok(Number.isInteger(result.status) && result.status !== 0, output);
      assert.ok(result.counter("mutation-count") <= 1, "a post-reservation failure must never repeat the mutation");
      assert.match(output, expectedFailure);
      assert.match(output, postReservationWarning);
    };
    const assertInitialCasHold = (result, expectedFailure) => {
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      assert.ok(Number.isInteger(result.status) && result.status !== 0, output);
      assert.equal(result.counter("genesis-count"), 0, "ambiguous local CAS state must hold before any Devnet genesis query");
      assert.equal(result.counter("reconcile-count"), 0, "ambiguous local CAS state must hold before any Devnet account query");
      assert.equal(result.counter("address-count"), 0, "ambiguous local CAS state must hold before signer inspection");
      assert.equal(result.counter("mutation-count"), 0, "ambiguous local CAS state must never mutate");
      assert.match(output, expectedFailure);
      assert.match(output, postReservationWarning);
    };

    const retried = runScenario("timeout_success");
    assert.equal(
      retried.status,
      0,
      `${retried.error ?? ""}\n${retried.stdout ?? ""}\n${retried.stderr ?? ""}`,
    );
    assert.match(retried.stdout, /Signer-free finalized buffer reconciliation 2 of 12/u);
    assert.equal(retried.counter("mutation-count"), 1);
    assert.equal(retried.counter("reconcile-count"), 6, "every authority phase requires a fresh strict signer-free reconciliation");
    assert.equal(retried.counter("legacy-read-count"), 0, "legacy CLI reads must never run");
    assert.match(retried.stdout, /AT FINALIZED COMMITMENT/u);
    assert.match(retried.stdout, /NODE PATH:[\s\S]*?GIT PATH:[\s\S]*?SOLANA PATH:[\s\S]*?DEVNET GENESIS:/u);

    const already = runScenario("already");
    assert.equal(already.status, 0, already.stderr);
    assert.equal(already.counter("reconcile-count"), 1);
    assert.equal(already.counter("legacy-read-count"), 0);
    assert.equal(already.counter("mutation-count"), 0);
    assert.match(already.stdout, /ALREADY HELD BY 7XZ/u);

    const wrongAccount = runScenario("wrong_account");
    assert.equal(wrongAccount.status, 1);
    assert.equal(wrongAccount.counter("mutation-count"), 0);
    assert.equal(wrongAccount.counter("address-count"), 0);
    assert.equal(wrongAccount.counter("reconcile-count"), 2);
    assert.match(`${wrongAccount.stdout}\n${wrongAccount.stderr}`, /finalized buffer address mismatch/u);

    const wrongBytes = runScenario("wrong_bytes");
    assert.equal(wrongBytes.status, 1);
    assert.equal(wrongBytes.counter("reconcile-count"), 2);
    assert.equal(wrongBytes.counter("mutation-count"), 0);
    assert.equal(wrongBytes.counter("address-count"), 0);
    assert.match(`${wrongBytes.stdout}\n${wrongBytes.stderr}`, /PROGRAM_SHA256_MISMATCH/u);

    assertInitialCasHold(
      runScenario("initial_cas_inspect_failure"),
      /durable one-use authority reservation could not be validated/u,
    );
    assertInitialCasHold(
      runScenario("malformed_cas_extra"),
      /exact canonical schema-valid record/u,
    );
    assertInitialCasHold(
      runScenario("malformed_cas_schema"),
      /exact canonical schema-valid record/u,
    );

    assertPostReservationHold(
      runScenario("malformed_reserve_success_output"),
      /exact canonical schema-valid record/u,
    );
    assertPostReservationHold(
      runScenario("post_reserve_reinspection_failure"),
      /created reservation could not be re-inspected exactly/u,
    );
    assertPostReservationHold(
      runScenario("post_reserve_digest_swap"),
      /created reservation digest changed between reserve and immediate pinned reinspection/u,
    );
    assertPostReservationHold(
      runScenario("post_reserve_fd11_drift"),
      /reserved CAS record changed after its exact pinned validation/u,
    );
    assertPostReservationHold(
      runScenario("post_reserve_runtime_drift"),
      /reviewed artifact descriptor byte length drifted/u,
    );
    assertPostReservationHold(
      runScenario("post_reserve_payer_drift"),
      /opened payer keypair identity, owner, mode, or link count drifted/u,
    );
    assertPostReservationHold(
      runScenario("post_reserve_floor_drift"),
      /finalized payer balance is below the reviewed single-handoff fee floor/u,
    );

    const casLockHeld = runScenario("preheld_cas_lock");
    assert.equal(casLockHeld.status, 1);
    assert.equal(casLockHeld.counter("mutation-count"), 0);
    assert.match(`${casLockHeld.stdout}\n${casLockHeld.stderr}`, /another compliant Devnet buffer handoff owns the CAS namespace lock/u);

    const payerLockHeld = runScenario("preheld_payer_lock");
    assert.equal(payerLockHeld.status, 1);
    assert.equal(payerLockHeld.counter("mutation-count"), 0);
    assert.match(`${payerLockHeld.stdout}\n${payerLockHeld.stderr}`, /another compliant payer-authorized Devnet writer owns the exclusive signer lock/u);

    const nonTty = runScenario("old", { attended: false });
    assert.equal(nonTty.status, 1);
    assert.equal(nonTty.counter("mutation-count"), 0);
    assert.equal(nonTty.counter("address-count"), 0, "piped confirmation cannot unlock payer access");
    assert.match(`${nonTty.stdout}\n${nonTty.stderr}`, /piped stdin is not an attended confirmation/u);

    const poisoned = runScenario("old", {
      attended: false,
      poisonName: "NODE_OPTIONS",
      poisonValue: "--require=/tmp/iat-v2-untrusted-loader.cjs",
    });
    assert.equal(poisoned.status, 1);
    assert.equal(poisoned.counter("reconcile-count"), 0);
    assert.equal(poisoned.counter("mutation-count"), 0);
    assert.match(`${poisoned.stdout}\n${poisoned.stderr}`, /inherited NODE_OPTIONS is not admitted/u);

    const gitRedirected = runScenario("old", {
      attended: false,
      poisonName: "GIT_DIR",
      poisonValue: "/tmp/iat-v2-unreviewed-git-dir",
    });
    assert.equal(gitRedirected.status, 1);
    assert.equal(gitRedirected.counter("reconcile-count"), 0);
    assert.equal(gitRedirected.counter("mutation-count"), 0);
    assert.match(`${gitRedirected.stdout}\n${gitRedirected.stderr}`, /inherited GIT_DIR is not admitted/u);

    const symlinkedPayer = runScenario("payer_symlink");
    assert.equal(symlinkedPayer.status, 1);
    assert.equal(symlinkedPayer.counter("address-count"), 0);
    assert.equal(symlinkedPayer.counter("mutation-count"), 0);
    assert.match(`${symlinkedPayer.stdout}\n${symlinkedPayer.stderr}`, /absolute, non-symlink regular file/u);

    const swappedAfterOpen = runScenario("payer_swap_after_open");
    assert.equal(
      swappedAfterOpen.status,
      1,
      `${swappedAfterOpen.stdout ?? ""}\n${swappedAfterOpen.stderr ?? ""}`,
    );
    assert.equal(swappedAfterOpen.counter("address-count"), 1);
    assert.equal(swappedAfterOpen.counter("mutation-count"), 0);
    assert.equal(readFileSync(join(sandbox, "payer.opened"), "utf8"), "ORIGINAL-PAYER-FIXTURE\n");
    assert.equal(readFileSync(join(sandbox, "payer.json"), "utf8"), "REPLACEMENT-PATH-FIXTURE\n");

    const ambiguous = runScenario("ambiguous");
    assert.equal(ambiguous.status, 1);
    assert.equal(ambiguous.counter("mutation-count"), 1);
    assert.equal(ambiguous.counter("reconcile-count"), 16);
    assert.match(`${ambiguous.stdout}\n${ambiguous.stderr}`, /DO NOT RESUBMIT/u);

    const old = runScenario("old");
    assert.equal(old.status, 1);
    assert.equal(old.counter("mutation-count"), 1);
    assert.equal(old.counter("reconcile-count"), 5);
    assert.match(`${old.stdout}\n${old.stderr}`, /finalized buffer identity, bytes, or authority is ambiguous/u);

    const firstInvocation = runScenario("ambiguous");
    assert.equal(firstInvocation.status, 1);
    assert.equal(firstInvocation.counter("mutation-count"), 1);
    const secondInvocation = runScenario("old", { preserveState: true });
    assert.equal(secondInvocation.status, 1);
    assert.equal(secondInvocation.counter("mutation-count"), 1, "a second process must never repeat the reserved mutation");
    assert.match(`${secondInvocation.stdout}\n${secondInvocation.stderr}`, /durable one-use mutation reservation already exists|permanently reserved/u);

    const swappedBeforePin = runScenario("cas_swap_before_pin");
    assert.equal(swappedBeforePin.status, 1);
    assert.equal(swappedBeforePin.counter("address-count"), 0);
    assert.equal(swappedBeforePin.counter("mutation-count"), 0);
    assert.match(`${swappedBeforePin.stdout}\n${swappedBeforePin.stderr}`, /CAS helper descriptor (?:SHA-256|byte length) drifted/u);
    writeFileSync(
      join(fixtureScripts, "iat-v2-devnet-buffer-handoff-cas.mjs"),
      fixtureCasSource,
    );

    const swappedAfterPin = runScenario("runtime_paths_swap_after_pin");
    assert.equal(
      swappedAfterPin.status,
      0,
      `${swappedAfterPin.stdout ?? ""}\n${swappedAfterPin.stderr ?? ""}`,
    );
    assert.equal(swappedAfterPin.counter("mutation-count"), 1);
    assert.match(swappedAfterPin.stdout, /AT FINALIZED COMMITMENT/u);
    assert.equal(readFileSync(join(sandbox, "reconciler.swapped"), "utf8"), fixtureReconcilerSource);
    assert.equal(readFileSync(join(sandbox, "cas.swapped"), "utf8"), fixtureCasSource);
    assert.deepEqual(readFileSync(join(sandbox, "sealed-exec.swapped")), fixtureSealedExecBytes);
    assert.equal(readFileSync(artifactPath, "utf8"), artifact.toString("utf8"));
  } finally {
    if (fixtureSolanaLink) {
      const cleanupArgs = process.platform === "win32"
        ? ["--exec", "/usr/bin/rm", "-f", "--", fixtureSolanaLink]
        : ["-c", '/usr/bin/rm -f -- "$1"', "iat-v2-solana-cleanup", fixtureSolanaLink];
      spawnSync(bashCommand, cleanupArgs, { encoding: "utf8", env: process.env });
    }
    rmSync(sandbox, { recursive: true, force: true });
  }
});
