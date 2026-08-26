import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import {
  BufferPreflightError,
  IAT_V2_ARTIFACT_INPUT_PATHS,
  IAT_V2_MIGRATION_ARTIFACT_BINDING,
  calculateUpgradeCapacityPlan,
  observeDevnetUpgradeCapacity,
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

test("migration buffer helpers use the exact first-run public-CI binding", () => {
  assert.deepEqual(IAT_V2_MIGRATION_ARTIFACT_BINDING, {
    schema: "iat-v2-migration-artifact-binding/v1",
    status: "BOUND",
    artifactSha256: "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
    artifactBytes: 649_680,
    sourceHeadCommit: "bb09bd292bab546b3585806fc475c3747dbb8011",
    sourceHeadTree: "d533dae2994a7464412fa2ffd36fd99f4cc4db07",
    ciRunId: 32_943_011_981,
    ciRunAttempt: 1,
    workflowRef: "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge",
    evidenceManifestSha256: "1458fb1d736230bbd6aba9edbc7629538ec11babb9c75b3d8ee03af075f905b5",
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

test("capacity math pins the exact first-run artifact rent and excludes transaction fees", () => {
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
  assert.equal(result.networkExecution, false);
  assert.equal(result.signing, false);
  assert.equal(result.broadcast, false);
});

test("upload and handoff scripts have separate explicit gates and no stale artifact pin", () => {
  const fresh = readFileSync("scripts/rebuild-iat-v2-devnet-buffer-fresh.sh", "utf8");
  const handoff = readFileSync("scripts/handoff-iat-v2-devnet-buffer.sh", "utf8");
  const combined = `${fresh}\n${handoff}`;

  assert.doesNotMatch(combined, /634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7/u);
  assert.match(fresh, /iat-v2-devnet-buffer-preflight\.mjs verify/u);
  assert.match(fresh, /iat-v2-devnet-buffer-preflight\.mjs capacity/u);
  assert.doesNotMatch(fresh, /^\s*(?:BUFFER_ADDRESS=.*\\\s*)?bash scripts\/handoff-iat-v2-devnet-buffer\.sh/mu);
  assert.match(fresh, /handoff has NOT run/u);
  assert.match(handoff, /BUFFER_ADDRESS="\$\{BUFFER_ADDRESS:-\}"/u);
  assert.match(handoff, /read -r -p "Type TRANSFER-7XZ exactly to continue/u);
  assert.doesNotMatch(handoff, /IAT_HANDOFF_CONFIRM/u);
  assert.doesNotMatch(fresh, /IAT_FRESH_REBUILD_CONFIRM/u);
});
