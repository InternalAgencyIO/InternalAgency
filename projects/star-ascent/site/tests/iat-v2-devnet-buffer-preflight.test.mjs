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
    sourceHeadCommit: "2b68cebecff756655d140277c67f8f46ac832d88",
    sourceHeadTree: "d574530655579e925fdc61b921b4013a322f9a85",
    ciRunId: 33_029_576_920,
    ciRunAttempt: 1,
    workflowRef: "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge",
    evidenceManifestSha256: "31ac038476e72c964f79a29bae5090aa7172f7013cc5454a0b96f9b343d0186b",
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
  assert.match(handoff, /iat-v2-devnet-buffer-handoff-cas\.mjs inspect/u);
  assert.match(handoff, /iat-v2-devnet-buffer-handoff-cas\.mjs reserve/u);
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
  assert.doesNotMatch(handoff, /program (?:show|dump)[\s\S]{0,240}?--keypair/u);
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
      "evidence-manifest-sha256": "31ac038476e72c964f79a29bae5090aa7172f7013cc5454a0b96f9b343d0186b",
      "source-head-commit": "2b68cebecff756655d140277c67f8f46ac832d88",
      "source-head-tree": "d574530655579e925fdc61b921b4013a322f9a85",
      "ci-run-id": "33029576920",
      "ci-run-attempt": "1",
      "node-path": "/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node",
      "node-version": "v24.19.0",
      "node-sha256": "bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12",
      "node-bytes": "125989464",
      "git-path": "/mnt/c/Program Files/Git/mingw64/bin/git.exe",
      "git-version": "git version 2.55.0.windows.3",
      "git-sha256": "1a0043555d254618f2d56c936c3d9a1fbfb878bc878416a133c346bc7835eda9",
      "git-bytes": "4383048",
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

  assert.equal(mutations.length, 1, "authority mutation command must occur exactly once in source");
  assert.doesNotMatch(handoff, /Authority handoff attempt|retrying verification/u);
  assert.match(handoff, /Submitting the one-use authority mutation exactly once/u);
  assert.match(handoff, /program set-buffer-authority[\s\S]*?--commitment finalized/u);
  assert.match(handoff, /program show[\s\S]*?--commitment finalized/u);
  assert.match(handoff, /program dump[\s\S]*?--commitment finalized/u);
  assert.match(handoff, /Buffer Address: \$BUFFER_ADDRESS/u);
  assert.match(handoff, /observed_bytes" != "\$EXPECTED_BYTES"/u);
  assert.match(handoff, /observed_hash" != "\$EXPECTED_HASH"/u);
  assert.match(
    handoff,
    /mutation_status=\$\?[\s\S]*?Beginning exact read-only finalized reconciliation[\s\S]*?fetch_buffer_record/u,
  );
  assert.match(handoff, /DO NOT RESUBMIT/gmu);
  assert.doesNotMatch(handoff, /--commitment confirmed/u);
  const reserve = handoff.indexOf("iat-v2-devnet-buffer-handoff-cas.mjs reserve");
  const postPromptReobserve = handoff.indexOf("fetch_buffer_record 9<&-");
  const submitting = handoff.indexOf('echo "Submitting the one-use authority mutation exactly once..."');
  const mutation = handoff.indexOf("program set-buffer-authority");
  assert.ok(postPromptReobserve >= 0 && reserve > postPromptReobserve && submitting > reserve && mutation > submitting);
  assert.doesNotMatch(handoff.slice(submitting, mutation), /reverify_(?:solana|git|node)|fetch_buffer_record|observe_handoff_fee_floor/u);
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
  try {
    const artifact = Buffer.from("exact mocked migration artifact", "utf8");
    const artifactPath = join(sandbox, "iat_v2.so");
    writeFileSync(artifactPath, artifact);
    const artifactSha256 = sha256(artifact);
    const fixtureStateDir = bashPath(sandbox);
    const fakeGit = executable("git", `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
  printf 'git version 2.55.0.windows.3\\n'
  exit 0
fi
exit 98
`);
    const fakeGitBytes = readFileSync(join(sandbox, "git"));
    const fakeGitSha256 = sha256(fakeGitBytes);
    const fakeNode = executable("node", `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
  printf 'v24.19.0\n'
elif [[ "\${1:-}" == "-e" ]]; then
  input="$(/usr/bin/cat)"
  case "$input" in
    *'"status":"AVAILABLE"'*) printf 'AVAILABLE' ;;
    *'"status":"RESERVED_CREATED"'*) printf 'RESERVED_CREATED' ;;
    *'"status":"RESERVED_EXISTING"'*) printf 'RESERVED_EXISTING' ;;
    *) printf '%s\\n%s\\n%064d\\n%040d\\n%040d\\n33029576920\\n1\\n%s\\n%s\\n%s\\n%s\\n' '${artifactSha256}' '${artifact.length}' 0 2 3 '${fakeGit}' 'git version 2.55.0.windows.3' '${fakeGitSha256}' '${fakeGitBytes.length}' ;;
  esac
elif [[ "\${1:-}" == "scripts/iat-v2-devnet-buffer-handoff-cas.mjs" ]]; then
  if [[ "\${2:-}" == "inspect" ]]; then
    if [[ -f '${fixtureStateDir}/cas-reserved' ]]; then
      printf '{"status":"RESERVED_EXISTING"}\\n'
    else
      printf '{"status":"AVAILABLE"}\\n'
    fi
  elif [[ "\${2:-}" == "reserve" ]]; then
    if ( set -o noclobber; printf 'reserved\\n' > '${fixtureStateDir}/cas-reserved' ) 2>/dev/null; then
      printf '{"status":"RESERVED_CREATED"}\\n'
    else
      printf '{"status":"RESERVED_EXISTING"}\\n'
    fi
  else
    exit 88
  fi
else
  printf 'simulated dependency warning on stderr\\n' >&2
  printf '{"artifactSha256":"${artifactSha256}","artifactBytes":${artifact.length},"evidenceManifestSha256":"%064d","sourceHeadCommit":"%040d","sourceHeadTree":"%040d","ciRunId":33029576920,"ciRunAttempt":1,"gitPath":"${fakeGit}","gitVersion":"git version 2.55.0.windows.3","gitSha256":"${fakeGitSha256}","gitBytes":${fakeGitBytes.length}}\\n' 0 2 3
fi
`);
    const fakeSolana = executable("solana", `#!/usr/bin/env bash
set -euo pipefail
increment() {
  local file='${fixtureStateDir}/'"$1"
  local value=0
  if [[ -f "$file" ]]; then read -r value < "$file"; fi
  value=$((value + 1))
  printf '%s\\n' "$value" > "$file"
  printf '%s' "$value"
}
if [[ " $* " != *" --config /dev/null "* ]]; then exit 89; fi
scenario="$(/usr/bin/cat -- '${fixtureStateDir}/scenario')"
if [[ "\${1:-}" == "address" ]]; then
  increment address-count >/dev/null
  if [[ "\${2:-}" != "-k" || "\${3:-}" != "/proc/self/fd/9" ]]; then exit 92; fi
  if [[ "$(/usr/bin/cat -- /proc/self/fd/9)" != "ORIGINAL-PAYER-FIXTURE" ]]; then exit 93; fi
  if [[ "$scenario" == "payer_swap_after_open" ]]; then
    /usr/bin/mv -- '${fixtureStateDir}/payer.json' '${fixtureStateDir}/payer.opened'
    printf 'REPLACEMENT-PATH-FIXTURE\\n' > '${fixtureStateDir}/payer.json'
  fi
  printf '%s\\n' 'DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4'
  exit 0
fi
if [[ "\${1:-}" == "--version" ]]; then
  printf 'solana-cli 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)\\n'
  exit 0
fi
if [[ "\${1:-}" == "genesis-hash" ]]; then
  printf 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG\\n'
  exit 0
fi
if [[ "\${1:-}" == "balance" ]]; then
  printf '1000000000 lamports\\n'
  exit 0
fi
if [[ "\${1:-}" == "program" && "\${2:-}" == "dump" ]]; then
  increment dump-count >/dev/null
  if [[ " $* " != *" --commitment finalized "* ]]; then exit 94; fi
  if [[ "$scenario" == "wrong_bytes" ]]; then
    printf 'wrong finalized bytes' > "$4"
  else
    /usr/bin/cp -- '${bashPath(artifactPath)}' "$4"
  fi
  if [[ "$scenario" == "payer_symlink" ]]; then
    /usr/bin/rm -f -- '${fixtureStateDir}/payer.json'
    /usr/bin/ln -s -- '${fixtureStateDir}/payer-replacement.json' '${fixtureStateDir}/payer.json'
  fi
  exit 0
fi
if [[ "\${1:-}" == "program" && "\${2:-}" == "show" ]]; then
  if [[ " $* " != *" --commitment finalized "* ]]; then exit 95; fi
  count="$(increment show-count)"
  case "$scenario" in
    timeout_success)
      if [[ "$count" == "1" ]]; then exit 124; fi
      if (( count <= 3 )); then authority='DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4'; else authority='7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH'; fi
      ;;
    already) authority='7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH' ;;
    ambiguous)
      if (( count <= 2 )); then authority='DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4'; else exit 124; fi
      ;;
    old|wrong_bytes|payer_symlink) authority='DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4' ;;
    payer_swap_after_open)
      if [[ "$count" == "1" ]]; then authority='DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4'; else authority='7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH'; fi
      ;;
    wrong_account)
      printf 'Buffer Address: OtherMockBufferAddress\\n'
      printf 'Authority: %s\\n' '7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH'
      exit 0
      ;;
    *) exit 90 ;;
  esac
  printf 'Buffer Address: MockBufferAddress\\n'
  printf 'Authority: %s\\n' "$authority"
  exit 0
fi
if [[ "\${1:-}" == "program" && "\${2:-}" == "set-buffer-authority" ]]; then
  increment mutation-count >/dev/null
  if [[ " $* " != *" --buffer-authority /proc/self/fd/9 "* \
      || " $* " != *" --keypair /proc/self/fd/9 "* \
      || " $* " != *" --commitment finalized "* ]]; then exit 96; fi
  if [[ "$(/usr/bin/cat -- /proc/self/fd/9)" != "ORIGINAL-PAYER-FIXTURE" ]]; then exit 97; fi
  if [[ "$scenario" == "ambiguous" ]]; then exit 124; fi
  printf 'submitted once\\n'
  exit 0
fi
exit 91
`);
    const fakeNodeBytes = readFileSync(join(sandbox, "node"));
    const fakeSolanaBytes = readFileSync(join(sandbox, "solana"));
    const fixtureRoot = join(sandbox, "fixture-site");
    const fixtureScripts = join(fixtureRoot, "scripts");
    const fixtureLib = join(fixtureScripts, "lib");
    mkdirSync(fixtureLib, { recursive: true });
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
      ["IAT_V2_EXPECTED_NODE_VERSION", "v24.19.0"],
      ["IAT_V2_EXPECTED_NODE_SHA256", sha256(fakeNodeBytes)],
      ["IAT_V2_EXPECTED_NODE_BYTES", String(fakeNodeBytes.length)],
      ["IAT_V2_EXPECTED_GIT_PATH", fakeGit],
      ["IAT_V2_EXPECTED_GIT_VERSION", "git version 2.55.0.windows.3"],
      ["IAT_V2_EXPECTED_GIT_SHA256", fakeGitSha256],
      ["IAT_V2_EXPECTED_GIT_BYTES", String(fakeGitBytes.length)],
      ["IAT_V2_EXPECTED_SOLANA_CLI_PATH", fakeSolana],
      ["IAT_V2_EXPECTED_SOLANA_CLI_VERSION", "solana-cli 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)"],
      ["IAT_V2_EXPECTED_SOLANA_CLI_SHA256", sha256(fakeSolanaBytes)],
      ["IAT_V2_EXPECTED_SOLANA_CLI_BYTES", String(fakeSolanaBytes.length)],
    ]) fixtureToolchain = replacePin(fixtureToolchain, name, value);
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

    const exactCasRoot = bashPath(join(sandbox, "persistent-cas"));
    let fixtureHandoff = readFileSync("scripts/handoff-iat-v2-devnet-buffer.sh", "utf8");
    fixtureHandoff = fixtureHandoff.replace(
      'EXPECTED_CAS_ROOT="/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1"',
      `EXPECTED_CAS_ROOT="${exactCasRoot}"`,
    );
    fixtureHandoff = fixtureHandoff.replace(
      "/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site",
      bashPath(fixtureRoot),
    );
    fixtureHandoff = fixtureHandoff.replace(
      'PAYER_KEYPAIR="/home/a/.config/solana/iat-v2-devnet-deployer.json"',
      `PAYER_KEYPAIR="${bashPath(join(sandbox, "payer.json"))}"`,
    );
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
    fixtureHandoff = fixtureHandoff.replaceAll("/usr/bin/sleep 10", ":");
    if (process.platform === "win32") {
      fixtureHandoff = fixtureHandoff.replaceAll('"$fd_mode" != "600"', '"$fd_mode" != "777"');
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
        for (const name of ["show-count", "dump-count", "mutation-count", "address-count", "cas-reserved", "payer.opened"]) {
          rmSync(join(sandbox, name), { force: true });
        }
      }
      rmSync(join(sandbox, "payer.json"), { force: true });
      writeFileSync(join(sandbox, "payer.json"), "ORIGINAL-PAYER-FIXTURE\n");
      chmodSync(join(sandbox, "payer.json"), 0o600);
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
if [[ "\${13}" == "attended" ]]; then
  exec /usr/bin/script -qefc "/usr/bin/bash scripts/handoff-iat-v2-devnet-buffer.sh" /dev/null
fi
exec /usr/bin/setsid -f -w /usr/bin/bash scripts/handoff-iat-v2-devnet-buffer.sh
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

    const retried = runScenario("timeout_success");
    assert.equal(
      retried.status,
      0,
      `${retried.error ?? ""}\n${retried.stdout ?? ""}\n${retried.stderr ?? ""}`,
    );
    assert.match(retried.stdout, /Finalized buffer identity read 2 of 12/u);
    assert.equal(retried.counter("mutation-count"), 1);
    assert.equal(retried.counter("dump-count"), 3, "pre-prompt, post-prompt, and reconciled authority classifications require exact dumps");
    assert.match(retried.stdout, /AT FINALIZED COMMITMENT/u);
    assert.match(retried.stdout, /NODE PATH:[\s\S]*?GIT PATH:[\s\S]*?SOLANA PATH:[\s\S]*?DEVNET GENESIS:/u);

    const already = runScenario("already");
    assert.equal(already.status, 0, already.stderr);
    assert.equal(already.counter("show-count"), 1);
    assert.equal(already.counter("dump-count"), 1, "already-held classification still requires exact finalized bytes");
    assert.equal(already.counter("mutation-count"), 0);
    assert.match(already.stdout, /ALREADY HELD BY 7XZ/u);

    const wrongAccount = runScenario("wrong_account");
    assert.equal(wrongAccount.status, 1);
    assert.equal(wrongAccount.counter("mutation-count"), 0);
    assert.equal(wrongAccount.counter("address-count"), 0);
    assert.match(`${wrongAccount.stdout}\n${wrongAccount.stderr}`, /did not identify exactly the requested Buffer Address/u);

    const wrongBytes = runScenario("wrong_bytes");
    assert.equal(wrongBytes.status, 1);
    assert.equal(wrongBytes.counter("dump-count"), 1);
    assert.equal(wrongBytes.counter("mutation-count"), 0);
    assert.equal(wrongBytes.counter("address-count"), 0);
    assert.match(`${wrongBytes.stdout}\n${wrongBytes.stderr}`, /finalized buffer bytes do not match/u);

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
    assert.equal(poisoned.counter("show-count"), 0);
    assert.equal(poisoned.counter("mutation-count"), 0);
    assert.match(`${poisoned.stdout}\n${poisoned.stderr}`, /inherited NODE_OPTIONS is not admitted/u);

    const gitRedirected = runScenario("old", {
      attended: false,
      poisonName: "GIT_DIR",
      poisonValue: "/tmp/iat-v2-unreviewed-git-dir",
    });
    assert.equal(gitRedirected.status, 1);
    assert.equal(gitRedirected.counter("show-count"), 0);
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
    assert.equal(ambiguous.counter("show-count"), 14);
    assert.match(`${ambiguous.stdout}\n${ambiguous.stderr}`, /DO NOT RESUBMIT/u);

    const old = runScenario("old");
    assert.equal(old.status, 1);
    assert.equal(old.counter("mutation-count"), 1);
    assert.equal(old.counter("show-count"), 3);
    assert.match(`${old.stdout}\n${old.stderr}`, /finalized state still shows the expected payer/u);

    const firstInvocation = runScenario("ambiguous");
    assert.equal(firstInvocation.status, 1);
    assert.equal(firstInvocation.counter("mutation-count"), 1);
    const secondInvocation = runScenario("old", { preserveState: true });
    assert.equal(secondInvocation.status, 1);
    assert.equal(secondInvocation.counter("mutation-count"), 1, "a second process must never repeat the reserved mutation");
    assert.match(`${secondInvocation.stdout}\n${secondInvocation.stderr}`, /durable one-use mutation reservation already exists|permanently reserved/u);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
