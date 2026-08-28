import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  IAT_V2_SBF_ARTIFACT_INPUT_PATHS,
  validateSbfEvidence,
} from "../scripts/validate-iat-v2-ci-sbf-evidence.mjs";

const PROGRAM_ID = "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sortJson = (value) => {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
};
const git = (root, args) => execFileSync("git", args, {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    GIT_AUTHOR_NAME: "IAT fixture",
    GIT_AUTHOR_EMAIL: "iat-fixture@example.invalid",
    GIT_COMMITTER_NAME: "IAT fixture",
    GIT_COMMITTER_EMAIL: "iat-fixture@example.invalid",
  },
}).trim();

function write(root, path, bytes) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
}

test("successor validation accepts only source descendants with an unchanged exact SBF input closure", () => {
  const root = mkdtempSync(join(tmpdir(), "iat-v2-ci-successor-"));
  try {
    git(root, ["init"]);
    const trackedInputs = IAT_V2_SBF_ARTIFACT_INPUT_PATHS.map((path) => (
      path === "programs/iat_v2/src" ? `${path}/lib.rs` : path
    ));
    const originalBytes = new Map();
    for (const path of trackedInputs) {
      const bytes = Buffer.from(`reviewed fixture for ${path}\n`, "utf8");
      originalBytes.set(path, bytes);
      write(root, path, bytes);
    }
    write(root, "programs/iat_v2/instructions.mjs", "export const ARTIFACT = null;\n");
    write(root, ".github/workflows/iat-v2-proof.yml", "name: linux-proof\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "CI source"]);
    const sourceHeadCommit = git(root, ["rev-parse", "HEAD"]);
    const sourceHeadTree = git(root, ["rev-parse", "HEAD^{tree}"]);

    write(root, "programs/iat_v2/instructions.mjs", "export const ARTIFACT = 'bound';\n");
    write(root, ".github/workflows/iat-v2-proof.yml", "name: windows-reset\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "bind artifact without changing SBF bytes"]);

    const programBinary = Buffer.from("program binary fixture", "utf8");
    const programIdl = Buffer.from(`${JSON.stringify({ address: PROGRAM_ID })}\n`, "utf8");
    const buildLog = Buffer.from("verifiable build log\n", "utf8");
    write(root, "target/verifiable/iat_v2.so", programBinary);
    write(root, "target/idl/iat_v2.json", programIdl);
    write(root, "target/iat-v2-sbf-build.log", buildLog);

    const manifestPath = "target/verifiable/iat-v2-build-evidence.json";
    const writeManifest = ({
      sourceCommit = sourceHeadCommit,
      sourceTree = sourceHeadTree,
      checkoutCommit = "f".repeat(40),
      checkoutTree = sourceHeadTree,
    } = {}) => {
      const manifest = {
        schema: "iat-v2-ci-verifiable-sbf-evidence/v5",
        status: "BUILD_ONLY_HOLD",
        ciProvenance: {
          serverUrl: "https://github.com",
          repository: "InternalAgencyIO/InternalAgency",
          repositoryId: 1_313_660_798,
          workflowRef: "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-proof.yml@refs/pull/14/merge",
          runId: 123_456,
          runAttempt: 1,
          runnerOs: "Linux",
          runnerArch: "X64",
        },
        buildContainer: {
          image: "solanafoundation/anchor",
          tag: "v1.0.2",
          indexDigest: "sha256:05a13b9f0a6d7dd5dc86955dd0e14a098110f12d2862ac5e0cf588049a48841b",
          platform: "linux/amd64",
          platformManifestDigest: "sha256:28fde4e63a063727c9520a925de4e9a3be29fcc717b5d759363c23ddea28f59d",
          reference: "solanafoundation/anchor@sha256:05a13b9f0a6d7dd5dc86955dd0e14a098110f12d2862ac5e0cf588049a48841b",
          registryVerification: "DOCKER_MANIFEST_AND_LOCAL_PLATFORM",
        },
        sourceBinding: {
          workflowEvent: "pull_request",
          sourceHeadCommit: sourceCommit,
          sourceHeadTree: sourceTree,
          checkoutCommit,
          checkoutTree,
          checkoutRelation: "PR_MERGE_SECOND_PARENT",
          trackedWorktree: "CLEAN",
        },
        programId: PROGRAM_ID,
        toolchain: {
          rustc: "rustc 1.97.1 (abcdef0 2026-08-01)",
          anchor: "anchor-cli 1.0.2",
          solana: "solana-cli 3.1.10 (src:fixture)",
        },
        artifacts: {
          programBinary: {
            path: "target/verifiable/iat_v2.so",
            sha256: sha256(programBinary),
            bytes: programBinary.length,
          },
          programIdl: {
            path: "target/idl/iat_v2.json",
            sha256: sha256(programIdl),
            bytes: programIdl.length,
          },
          buildLog: {
            path: "target/iat-v2-sbf-build.log",
            sha256: sha256(buildLog),
            bytes: buildLog.length,
          },
        },
        limitations: [
          "Build evidence only; not signed Devnet evidence.",
          "Does not authorize deployment, signing, broadcast, funding, or Mainnet launch.",
        ],
      };
      write(root, manifestPath, `${JSON.stringify(sortJson(manifest), null, 2)}\n`);
    };

    writeManifest();
    assert.equal(validateSbfEvidence({ projectRoot: root, manifestPath, allowDescendantCheckout: true }).status, "PASS");

    const outsideManifest = `${root}-outside.json`;
    try {
      writeFileSync(outsideManifest, "{}\n");
      assert.throws(
        () => validateSbfEvidence({
          projectRoot: root,
          manifestPath: outsideManifest,
          allowDescendantCheckout: true,
          verifyArtifactFiles: false,
        }),
        /outside the project root/u,
      );
    } finally {
      rmSync(outsideManifest, { force: true });
    }

    rmSync(join(root, "target", "verifiable", "iat_v2.so"));
    rmSync(join(root, "target", "idl", "iat_v2.json"));
    rmSync(join(root, "target", "iat-v2-sbf-build.log"));
    assert.equal(validateSbfEvidence({
      projectRoot: root,
      manifestPath,
      allowDescendantCheckout: true,
      verifyArtifactFiles: false,
    }).status, "PASS");
    assert.throws(
      () => validateSbfEvidence({ projectRoot: root, manifestPath, allowDescendantCheckout: true }),
      /ENOENT|no such file/u,
    );
    write(root, "target/verifiable/iat_v2.so", programBinary);
    write(root, "target/idl/iat_v2.json", programIdl);
    write(root, "target/iat-v2-sbf-build.log", buildLog);

    const unrelatedCommit = git(root, ["commit-tree", sourceHeadTree, "-m", "unrelated"]);
    writeManifest({ sourceCommit: unrelatedCommit });
    assert.throws(
      () => validateSbfEvidence({ projectRoot: root, manifestPath, allowDescendantCheckout: true }),
      /not a descendant of the validated CI source head/u,
    );
    writeManifest();

    for (const path of trackedInputs) {
      write(root, path, Buffer.concat([originalBytes.get(path), Buffer.from("drift\n")]));
      git(root, ["add", "--", path]);
      git(root, ["commit", "-m", `drift ${path}`]);
      assert.throws(
        () => validateSbfEvidence({ projectRoot: root, manifestPath, allowDescendantCheckout: true }),
        /changed a CI-bound SBF artifact input/u,
        `${path} drift must be rejected`,
      );
      write(root, path, originalBytes.get(path));
      git(root, ["add", "--", path]);
      git(root, ["commit", "-m", `restore ${path}`]);
    }
    assert.equal(validateSbfEvidence({ projectRoot: root, manifestPath, allowDescendantCheckout: true }).status, "PASS");

    const baseCommit = git(root, ["commit-tree", sourceHeadTree, "-m", "base"]);
    const checkoutCommit = git(root, [
      "commit-tree",
      sourceHeadTree,
      "-p",
      baseCommit,
      "-p",
      sourceHeadCommit,
      "-m",
      "synthetic merge",
    ]);
    writeManifest({ checkoutCommit, checkoutTree: "e".repeat(40) });
    assert.throws(
      () => validateSbfEvidence({ projectRoot: root, manifestPath, allowDescendantCheckout: true }),
      /checkout tree does not match Git/u,
    );

    const wrongCheckout = git(root, [
      "commit-tree",
      sourceHeadTree,
      "-p",
      baseCommit,
      "-p",
      unrelatedCommit,
      "-m",
      "wrong synthetic merge",
    ]);
    writeManifest({ checkoutCommit: wrongCheckout });
    assert.throws(
      () => validateSbfEvidence({ projectRoot: root, manifestPath, allowDescendantCheckout: true }),
      /source head is not merge parent 2/u,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
